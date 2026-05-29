import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../../api";
import { getLabel, setLabel } from "../../localLabels";
import RelationshipGraph from "../RelationshipGraph/RelationshipGraph";
import "./Dashboard.css";

function Modal({ onClose, children, title }) {
    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);
    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{title}</h3>
                    <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
                </div>
                <div className="modal-body">{children}</div>
            </div>
        </div>
    );
}

function buildGraphData({ selfHandle, directRels, graphData, discoverable }) {
    const nodes = [];
    const edges = [];

    nodes.push({
        id: "self",
        type: "self",
        label: getLabel(selfHandle) || selfHandle,
        hidden: !discoverable,
    });

    const directNodeByHandle = new Map();
    for (const rel of directRels) {
        const nodeId = `direct:${rel.relationshipUUID}`;
        if (rel.otherHandle) {
            const label = getLabel(rel.otherHandle) || rel.otherHandle;
            nodes.push({ id: nodeId, type: "direct", label, handle: rel.otherHandle });
            directNodeByHandle.set(rel.otherHandle, nodeId);
        } else {
            nodes.push({ id: nodeId, type: "pending", label: "pending" });
        }
        edges.push({
            source: "self",
            target: nodeId,
            romantic: rel.romantic,
            sexual: rel.sexual,
            relationshipUUID: rel.relationshipUUID,
            pending: !rel.otherHandle,
            otherHandle: rel.otherHandle,
        });
    }

    if (graphData) {
        const { edges: graphEdges, selfNodeId, nodeCount, directNeighborHandles } = graphData;
        const idMap = new Map();
        idMap.set(selfNodeId, "self");
        for (const [ephIdStr, handle] of Object.entries(directNeighborHandles || {})) {
            const ephId = parseInt(ephIdStr, 10);
            if (directNodeByHandle.has(handle)) {
                idMap.set(ephId, directNodeByHandle.get(handle));
            }
        }
        for (let i = 0; i < nodeCount; i++) {
            if (!idMap.has(i)) {
                const anonId = `anon:${i}`;
                nodes.push({ id: anonId, type: "anon" });
                idMap.set(i, anonId);
            }
        }
        for (const [a, b, romantic, sexual] of graphEdges) {
            const aId = idMap.get(a);
            const bId = idMap.get(b);
            if (!aId || !bId) continue;
            const involvesSelf = aId === "self" || bId === "self";
            const otherId = aId === "self" ? bId : aId;
            if (involvesSelf && typeof otherId === "string" && otherId.startsWith("direct:")) continue;
            edges.push({ source: aId, target: bId, romantic, sexual });
        }
    }

    return { nodes, edges };
}

export default function Dashboard() {
    const navigate = useNavigate();
    const [selfHandle, setSelfHandle] = useState("");
    const [discoverable, setDiscoverable] = useState(false);
    const [directRels, setDirectRels] = useState([]);
    const [graphData, setGraphData] = useState(null);
    const [openModal, setOpenModal] = useState(null); // null | "self" | { type: "edge", rel }
    const [createOpen, setCreateOpen] = useState(false);
    const [toast, setToast] = useState("");
    // Bumped when a local label changes so the memoised graph data picks up the new label.
    const [labelVersion, setLabelVersion] = useState(0);
    // Wider-graph filters. They have no effect on the direct ring.
    const [filterRomantic, setFilterRomantic] = useState(false);
    const [filterSexual, setFilterSexual] = useState(false);
    // viewport reported up from the graph; used to compute where to draw the
    // discoverability notice so it tracks the self ball on pan and zoom.
    const [viewport, setViewport] = useState({ x: 0, y: 0, w: 1000, h: 1000 });
    const rootRef = useRef(null);
    const [rootSize, setRootSize] = useState({ w: 0, h: 0 });

    useLayoutEffect(() => {
        const measure = () => {
            if (!rootRef.current) return;
            const r = rootRef.current.getBoundingClientRect();
            setRootSize({ w: r.width, h: r.height });
        };
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, []);

    const loadDirect = useCallback(async () => {
        try {
            const res = await api.getDirectRelationships();
            setDirectRels(res.directRelationships || []);
        } catch (err) {
            setToast(err.message || "Failed to load relationships.");
        }
    }, []);

    const loadGraph = useCallback(async (opts = {}) => {
        try {
            const g = await api.getRelationshipGraph({
                mustberomantic: opts.romantic ?? false,
                mustbesexual: opts.sexual ?? false,
            });
            setGraphData(g);
        } catch (err) {
            // 403 here is expected when discoverable is off. Silently clear.
            setGraphData(null);
        }
    }, []);

    const loadAll = useCallback(async (isDiscoverable) => {
        await loadDirect();
        if (isDiscoverable) await loadGraph({ romantic: filterRomantic, sexual: filterSexual });
        else setGraphData(null);
    }, [loadDirect, loadGraph, filterRomantic, filterSexual]);

    useEffect(() => {
        api.getPersonByToken()
            .then((p) => {
                if (!p) {
                    navigate("/");
                    return;
                }
                setSelfHandle(p.handle || "");
                const d = !!p.discoverable;
                setDiscoverable(d);
                loadAll(d);
            })
            .catch(() => navigate("/"));
        // loadAll closes over the filter state; we only want this to run once on mount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate]);

    // Refetch the wider graph when filters change (only if discoverable).
    useEffect(() => {
        if (discoverable) loadGraph({ romantic: filterRomantic, sexual: filterSexual });
    }, [filterRomantic, filterSexual, discoverable, loadGraph]);

    const { nodes, edges } = useMemo(
        () => buildGraphData({ selfHandle, directRels, graphData, discoverable }),
        // labelVersion is included so saved local labels propagate to the graph.
        [selfHandle, directRels, graphData, discoverable, labelVersion]
    );

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(""), 2000);
    };

    const logout = async () => {
        try { await api.logout(); } catch {}
        navigate("/");
    };

    const handleCreate = async ({ romantic, sexual }) => {
        try {
            await api.createRelationship({ romantic, sexual });
            await loadDirect();
            setCreateOpen(false);
            showToast("Pending relationship created. Click the dashed edge to copy the join link.");
        } catch (err) {
            showToast(err.message || "Failed to create relationship.");
        }
    };

    const handleEdgeClick = (edgeRaw) => {
        if (!edgeRaw?.relationshipUUID) return;
        const rel = directRels.find(r => r.relationshipUUID === edgeRaw.relationshipUUID);
        if (rel) setOpenModal({ type: "edge", rel });
    };

    // Convert the self node's viewBox position (500, 500) to screen pixels.
    // Matches the SVG's preserveAspectRatio="xMidYMid meet" layout.
    const ballScreen = useMemo(() => {
        const sw = rootSize.w, sh = rootSize.h;
        if (!sw || !sh) return { x: 0, y: 0 };
        const scale = Math.min(sw / viewport.w, sh / viewport.h);
        const letterX = (sw - viewport.w * scale) / 2;
        const letterY = (sh - viewport.h * scale) / 2;
        return {
            x: (500 - viewport.x) * scale + letterX,
            y: (500 - viewport.y) * scale + letterY,
            scale,
        };
    }, [viewport, rootSize]);

    return (
        <div className="dashboard-root" ref={rootRef}>
            <div className="floating top-left">
                <button className="primary-button" onClick={() => setCreateOpen(true)}>
                    + Create relationship
                </button>
                {discoverable && (
                    <div className="filter-panel">
                        <span className="filter-label">Show only:</span>
                        <label className="filter-checkbox">
                            <input
                                type="checkbox"
                                checked={filterRomantic}
                                onChange={(e) => setFilterRomantic(e.target.checked)}
                            />
                            {" "}Romantic
                        </label>
                        <label className="filter-checkbox">
                            <input
                                type="checkbox"
                                checked={filterSexual}
                                onChange={(e) => setFilterSexual(e.target.checked)}
                            />
                            {" "}Sexual
                        </label>
                    </div>
                )}
            </div>
            <div className="floating top-right">
                <button className="secondary-button" onClick={logout}>Logout</button>
            </div>

            <div className="floating bottom-right">
                <button
                    className="secondary-button"
                    onClick={() => setViewport({ x: 0, y: 0, w: 1000, h: 1000 })}
                    title="Return to self"
                >
                    ⌖ Recenter
                </button>
            </div>

            {!discoverable && rootSize.w > 0 && (
                <div
                    className="subtle"
                    style={{
                        position: "absolute",
                        left: ballScreen.x,
                        top: ballScreen.y + 28 * (ballScreen.scale || 1) + 16,
                        transform: "translateX(-50%)",
                        maxWidth: "320px",
                        textAlign: "center",
                        pointerEvents: "none",
                        background: "rgba(255,255,255,0.9)",
                        border: "1px solid #ddd",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        fontSize: "0.85em",
                        color: "#555",
                    }}
                >
                    Wider graph hidden. Enable "discoverable" in account settings (click yourself) to see it.
                </div>
            )}

            {toast && <div className="toast">{toast}</div>}

            <RelationshipGraph
                nodes={nodes}
                edges={edges}
                onSelfClick={() => setOpenModal("self")}
                onEdgeClick={handleEdgeClick}
                viewport={viewport}
                onViewportChange={setViewport}
            />

            {openModal === "self" && (
                <SelfMenu
                    handle={selfHandle}
                    discoverable={discoverable}
                    onClose={() => setOpenModal(null)}
                    onDiscoverableChange={async (val) => {
                        try {
                            await api.toggleDiscoverability({ discoverable: val });
                            setDiscoverable(val);
                            if (val) await loadGraph({ romantic: filterRomantic, sexual: filterSexual });
                            else setGraphData(null);
                            showToast(val ? "Discoverable on. Loading wider graph." : "Discoverable off.");
                        } catch (err) {
                            showToast(err.message || "Failed.");
                        }
                    }}
                    onLabelSaved={() => {
                        setLabelVersion(v => v + 1);
                        showToast("Display name saved locally.");
                    }}
                    onPasswordChanged={() => {
                        showToast("Password updated.");
                    }}
                    onDeleteAccount={async () => {
                        if (!window.confirm("Permanently delete your account? This cannot be undone.")) return;
                        try {
                            await api.deletePerson();
                            navigate("/");
                        } catch (err) {
                            showToast(err.message || "Failed to delete.");
                        }
                    }}
                />
            )}

            {openModal?.type === "edge" && (
                <EdgeMenu
                    rel={openModal.rel}
                    onClose={() => setOpenModal(null)}
                    onChange={async () => { await loadDirect(); if (discoverable) await loadGraph(); }}
                    onLabelSaved={() => { setLabelVersion(v => v + 1); showToast("Label saved locally."); }}
                />
            )}

            {createOpen && (
                <CreateMenu
                    onClose={() => setCreateOpen(false)}
                    onSubmit={handleCreate}
                />
            )}
        </div>
    );
}

function SelfMenu({ handle, discoverable, onClose, onDiscoverableChange, onLabelSaved, onPasswordChanged, onDeleteAccount }) {
    const [displayName, setDisplayName] = useState(() => getLabel(handle) || "");
    const [oldPw, setOldPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [error, setError] = useState("");

    const saveLabel = () => {
        setLabel(handle, displayName.trim());
        onLabelSaved?.();
    };

    const changePassword = async () => {
        setError("");
        try {
            await api.updatePersonPassword({ password: oldPw, newpassword: newPw });
            setOldPw("");
            setNewPw("");
            onPasswordChanged?.();
        } catch (err) {
            setError(err.message || "Failed.");
        }
    };

    return (
        <Modal title="Your account" onClose={onClose}>
            <section className="modal-section">
                <label className="modal-label">Your handle</label>
                <div className="handle-block">
                    <code>{handle}</code>
                    <button onClick={() => navigator.clipboard?.writeText(handle)}>Copy</button>
                </div>
                <p className="modal-hint">Share this with someone if you want to connect with them. They cannot find you on the system without it.</p>
            </section>

            <section className="modal-section">
                <label className="modal-label">Display name (this browser only)</label>
                <div className="row">
                    <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="A name only you see"
                    />
                    <button onClick={saveLabel}>Save</button>
                </div>
                <p className="modal-hint">Stored in this browser. Never sent to the server.</p>
            </section>

            <section className="modal-section">
                <label className="modal-label">
                    <input
                        type="checkbox"
                        checked={discoverable}
                        onChange={(e) => onDiscoverableChange(e.target.checked)}
                    />
                    {" "}Discoverable
                </label>
                <p className="modal-hint">
                    Off: only people you are directly connected to see you. The wider graph is hidden from your view too.
                    <br />
                    On: you appear as a node in anyone's wider graph view, and your view shows the full connected component you are part of.
                </p>
                <details className="modal-details">
                    <summary>What enabling this exposes</summary>
                    <div>
                        The wider graph returns the structural shape of the connected component with romantic and sexual flags on each edge. Node IDs are randomised on every request, but anyone running the query can see how many partners you have, how many partners your partners have, and the flag pattern of each edge. In a small community, this shape can be enough to identify you. The server admin can read the full edge list with real handles regardless of this setting.
                    </div>
                </details>
            </section>

            <section className="modal-section">
                <label className="modal-label">Change password</label>
                <div className="col">
                    <input type="password" placeholder="Old password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
                    <input type="password" placeholder="New password (min 12 characters)" minLength={12} value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                    <button onClick={changePassword}>Update password</button>
                    {error && <p className="modal-error">{error}</p>}
                </div>
            </section>

            <section className="modal-section">
                <label className="modal-label">Delete account</label>
                <p className="modal-hint">
                    Removes your account and every relationship you are part of. Your partners will lose their edge to you. There is no recovery.
                </p>
                <button className="danger-button" onClick={onDeleteAccount}>Delete account</button>
            </section>
        </Modal>
    );
}

function EdgeMenu({ rel, onClose, onChange, onLabelSaved }) {
    const isPending = !rel.otherHandle;
    const joinUrl = `${window.location.origin}/join-relationship/${rel.relationshipUUID}`;
    const [partnerLabel, setPartnerLabel] = useState(() => rel.otherHandle ? (getLabel(rel.otherHandle) || "") : "");
    const [error, setError] = useState("");

    const setFlag = async (key, value) => {
        setError("");
        try {
            await api.editRelationship({ relationshipUUID: rel.relationshipUUID, [key]: value });
            await onChange?.();
        } catch (err) {
            setError(err.message || "Failed.");
        }
    };

    const end = async () => {
        if (!window.confirm("End this relationship?")) return;
        setError("");
        try {
            await api.endRelationship({ relationshipUUID: rel.relationshipUUID });
            await onChange?.();
            onClose();
        } catch (err) {
            setError(err.message || "Failed.");
        }
    };

    const saveLabel = () => {
        if (!rel.otherHandle) return;
        setLabel(rel.otherHandle, partnerLabel.trim());
        onLabelSaved?.();
    };

    return (
        <Modal title={isPending ? "Pending relationship" : "Relationship"} onClose={onClose}>
            {isPending ? (
                <section className="modal-section">
                    <p>This relationship is waiting for someone to join. Send them this link.</p>
                    <div className="handle-block">
                        <code style={{ wordBreak: "break-all" }}>{joinUrl}</code>
                        <button onClick={() => navigator.clipboard?.writeText(joinUrl)}>Copy</button>
                    </div>
                    <p className="modal-hint">Share over a channel you trust. Anyone who opens this link while logged in can join.</p>
                </section>
            ) : (
                <>
                    <section className="modal-section">
                        <label className="modal-label">Partner's handle</label>
                        <div className="handle-block">
                            <code>{rel.otherHandle}</code>
                        </div>
                    </section>
                    <section className="modal-section">
                        <label className="modal-label">Label for this partner (this browser only)</label>
                        <div className="row">
                            <input
                                type="text"
                                value={partnerLabel}
                                onChange={(e) => setPartnerLabel(e.target.value)}
                                placeholder="A name only you see"
                            />
                            <button onClick={saveLabel}>Save</button>
                        </div>
                    </section>
                </>
            )}

            <section className="modal-section">
                <label className="modal-label">Type</label>
                <label className="modal-checkbox">
                    <input
                        type="checkbox"
                        checked={rel.romantic}
                        disabled={isPending}
                        onChange={(e) => setFlag("romantic", e.target.checked)}
                    />
                    {" "}Romantic
                </label>
                <label className="modal-checkbox">
                    <input
                        type="checkbox"
                        checked={rel.sexual}
                        disabled={isPending}
                        onChange={(e) => setFlag("sexual", e.target.checked)}
                    />
                    {" "}Sexual
                </label>
                {isPending && <p className="modal-hint">You can change the type once the other person has joined.</p>}
            </section>

            <section className="modal-section">
                <button className="danger-button" onClick={end}>End relationship</button>
                {error && <p className="modal-error">{error}</p>}
            </section>
        </Modal>
    );
}

function CreateMenu({ onClose, onSubmit }) {
    const [romantic, setRomantic] = useState(false);
    const [sexual, setSexual] = useState(false);

    return (
        <Modal title="Create relationship" onClose={onClose}>
            <section className="modal-section">
                <p>Pick the type. A pending edge will appear on your graph. Click that edge to get the link to share with the other person.</p>
                <label className="modal-checkbox">
                    <input type="checkbox" checked={romantic} onChange={(e) => setRomantic(e.target.checked)} />
                    {" "}Romantic
                </label>
                <label className="modal-checkbox">
                    <input type="checkbox" checked={sexual} onChange={(e) => setSexual(e.target.checked)} />
                    {" "}Sexual
                </label>
            </section>
            <section className="modal-section">
                <button className="primary-button" onClick={() => onSubmit({ romantic, sexual })}>Create</button>
            </section>
        </Modal>
    );
}
