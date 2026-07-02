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

function buildGraphData({ selfHandle, directRels, graphData, discoverable, mustBeRomantic, mustBeSexual, mustBeQPR }) {
    const nodes = [];
    const edges = [];

    nodes.push({
        id: "self",
        type: "self",
        label: getLabel(selfHandle) || selfHandle,
        hidden: !discoverable,
    });

    const passesFilter = (rel) =>
        !(mustBeRomantic && !rel.romantic) &&
        !(mustBeSexual && !rel.sexual) &&
        !(mustBeQPR && (rel.romantic || rel.sexual));

    const directNodeByHandle = new Map();
    for (const rel of directRels) {
        const nodeId = `direct:${rel.relationshipUUID}`;
        const matches = passesFilter(rel);
        if (rel.otherHandle) {
            // Keep the direct node even when the edge is filtered out, so the wider
            // graph can still map this partner's ephemeral ID back to a known handle.
            const label = getLabel(rel.otherHandle) || rel.otherHandle;
            nodes.push({
                id: nodeId,
                type: "direct",
                label,
                handle: rel.otherHandle,
                romantic: rel.romantic,
                sexual: rel.sexual,
            });
            directNodeByHandle.set(rel.otherHandle, nodeId);
        } else if (matches) {
            // Pending node only exists as an anchor for the dashed edge; drop it with the edge.
            const pendingLabel = getLabel(rel.relationshipUUID) || "pending";
            nodes.push({ id: nodeId, type: "pending", label: pendingLabel });
        }
        if (!matches) continue;
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
            if (!passesFilter({ romantic, sexual })) continue;
            const aId = idMap.get(a);
            const bId = idMap.get(b);
            if (!aId || !bId) continue;
            const involvesSelf = aId === "self" || bId === "self";
            const otherId = aId === "self" ? bId : aId;
            if (involvesSelf && typeof otherId === "string" && otherId.startsWith("direct:")) continue;
            edges.push({ source: aId, target: bId, romantic, sexual });
        }
    }

    // Keep only nodes reachable from "self" through the filtered edge set.
    // A simple "has any edge" check leaves disconnected subgraphs visible when
    // filters sever their only path back to self.
    const adj = new Map();
    for (const e of edges) {
        if (!adj.has(e.source)) adj.set(e.source, []);
        if (!adj.has(e.target)) adj.set(e.target, []);
        adj.get(e.source).push(e.target);
        adj.get(e.target).push(e.source);
    }
    const reachable = new Set(["self"]);
    const queue = ["self"];
    while (queue.length) {
        const cur = queue.shift();
        for (const nb of (adj.get(cur) || [])) {
            if (!reachable.has(nb)) { reachable.add(nb); queue.push(nb); }
        }
    }
    const visibleNodes = nodes.filter(n => reachable.has(n.id));

    return { nodes: visibleNodes, edges };
}

// Stats are computed against the unfiltered polycule so the numbers stay stable
// when the user toggles the Romantic/Sexual filter.
function computePolyculeStats({ directRels, graphData, discoverable }) {
    let people = 1; // self
    const edges = []; // {romantic, sexual}
    const degree = new Map();
    const adj = new Map();

    const addEdge = (a, b, rel) => {
        edges.push(rel);
        degree.set(a, (degree.get(a) || 0) + 1);
        degree.set(b, (degree.get(b) || 0) + 1);
        if (!adj.has(a)) adj.set(a, []);
        if (!adj.has(b)) adj.set(b, []);
        adj.get(a).push(b);
        adj.get(b).push(a);
    };

    if (discoverable && graphData) {
        people = graphData.nodeCount;
        for (const [a, b, romantic, sexual] of graphData.edges) {
            addEdge(a, b, { romantic, sexual });
        }
        // Pending direct relationships never appear in the wider graph; attach
        // each to a phantom partner so they participate in degree/leaf/diameter.
        const selfId = graphData.selfNodeId;
        let pendingIdx = 0;
        for (const rel of directRels) {
            if (!rel.otherHandle) {
                addEdge(selfId, `pending-${pendingIdx++}`, { romantic: rel.romantic, sexual: rel.sexual });
                people += 1;
            }
        }
    } else {
        // Without discoverable access we only see the direct ring.
        directRels.forEach((rel, i) => {
            addEdge("self", `partner-${i}`, { romantic: rel.romantic, sexual: rel.sexual });
            people += 1;
        });
    }

    const E = edges.length;
    const N = people;
    let both = 0, romanticOnly = 0, sexualOnly = 0, qpr = 0;
    for (const e of edges) {
        if (e.romantic && e.sexual) both += 1;
        else if (e.romantic) romanticOnly += 1;
        else if (e.sexual) sexualOnly += 1;
        else qpr += 1;
    }
    const pct = (n) => (E > 0 ? n / E : 0);

    let leafCount = 0;
    for (const d of degree.values()) {
        if (d === 1) leafCount += 1;
    }

    // Graph diameter: BFS from each node, track the deepest level reached.
    let diameter = 0;
    for (const start of adj.keys()) {
        const dist = new Map([[start, 0]]);
        const queue = [start];
        let head = 0;
        while (head < queue.length) {
            const cur = queue[head++];
            const d = dist.get(cur);
            for (const next of adj.get(cur)) {
                if (dist.has(next)) continue;
                dist.set(next, d + 1);
                queue.push(next);
                if (d + 1 > diameter) diameter = d + 1;
            }
        }
    }

    return {
        people: N,
        relationships: E,
        density: N > 1 ? (2 * E) / (N * (N - 1)) : 0,
        avgPartners: N > 0 ? (2 * E) / N : 0,
        maxPartners: degree.size > 0 ? Math.max(0, ...degree.values()) : 0,
        leafCount,
        diameter,
        types: {
            both: { count: both, pct: pct(both) },
            romanticOnly: { count: romanticOnly, pct: pct(romanticOnly) },
            sexualOnly: { count: sexualOnly, pct: pct(sexualOnly) },
            qpr: { count: qpr, pct: pct(qpr) },
        },
    };
}

function StatsPanel({ stats, discoverable, collapsed, onToggle }) {
    const fmtPct = (v) => `${Math.round(v * 100)}%`;
    return (
        <div className="stats-panel">
            <button className="stats-toggle" onClick={onToggle}>
                <span className="stats-title">Polycule stats</span>
                <span className="stats-toggle-arrow">{collapsed ? '▸' : '▾'}</span>
            </button>
            {!collapsed && <>
                <div className="stats-grid">
                    <span>People</span><strong>{stats.people}</strong>
                    <span>Relationships</span><strong>{stats.relationships}</strong>
                    {stats.people > 1 && <>
                        <span title="Fraction of all possible pairs that share a relationship.">Density</span>
                        <strong>{fmtPct(stats.density)}</strong>
                        <span title="Mean number of partners per person.">Avg partners</span>
                        <strong>{stats.avgPartners.toFixed(1)}</strong>
                        <span title="People who are in exactly one relationship.">Leaf members</span>
                        <strong>{stats.leafCount}</strong>
                        <span title="Longest shortest path between any two members.">Max separation</span>
                        <strong>{stats.diameter}</strong>
                        <span title="Highest partner count in the polycule.">Most partners</span>
                        <strong>{stats.maxPartners}</strong>
                    </>}
                </div>
                <div className="stats-divider" />
                <div className="stats-subtitle">Types</div>
                <div className="stats-types">
                    <div className="stats-type-row">
                        <span className="stats-swatch" style={{ background: "#340c46" }} />
                        <span className="stats-type-label">Romantic + sexual</span>
                        <strong>{stats.types.both.count} <span className="stats-pct">({fmtPct(stats.types.both.pct)})</span></strong>
                    </div>
                    <div className="stats-type-row">
                        <span className="stats-swatch" style={{ background: "#009fe3" }} />
                        <span className="stats-type-label">Romantic only</span>
                        <strong>{stats.types.romanticOnly.count} <span className="stats-pct">({fmtPct(stats.types.romanticOnly.pct)})</span></strong>
                    </div>
                    <div className="stats-type-row">
                        <span className="stats-swatch" style={{ background: "#e50051" }} />
                        <span className="stats-type-label">Sexual only</span>
                        <strong>{stats.types.sexualOnly.count} <span className="stats-pct">({fmtPct(stats.types.sexualOnly.pct)})</span></strong>
                    </div>
                    <div className="stats-type-row">
                        <span className="stats-swatch" style={{ background: "#16a34a" }} />
                        <span className="stats-type-label">Queerplatonic (QPR)</span>
                        <strong>{stats.types.qpr.count} <span className="stats-pct">({fmtPct(stats.types.qpr.pct)})</span></strong>
                    </div>
                </div>
                {!discoverable && (
                    <div className="stats-note">Only direct relationships are visible. Enable discoverable to include the wider graph.</div>
                )}
            </>}
        </div>
    );
}

export default function Dashboard() {
    const navigate = useNavigate();
    const [selfHandle, setSelfHandle] = useState("");
    const [discoverable, setDiscoverable] = useState(false);
    const [directRels, setDirectRels] = useState([]);
    // Wider graph is fetched unfiltered; the Romantic/Sexual filter is applied
    // client-side. This keeps filter toggles instant and avoids the flicker that
    // happened when display showed old filtered data while a refetch was in flight.
    const [graphData, setGraphData] = useState(null);
    const [openModal, setOpenModal] = useState(null); // null | "self" | { type: "edge", relationshipUUID }    const [createOpen, setCreateOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [toast, setToast] = useState("");
    // Bumped when a local label changes so the memoised graph data picks up the new label.
    const [labelVersion, setLabelVersion] = useState(0);
    // Wider-graph filters. They have no effect on the direct ring.
    const [filterRomantic, setFilterRomantic] = useState(false);
    const [filterSexual, setFilterSexual] = useState(false);
    const [filterQPR, setFilterQPR] = useState(false);
    const [statsCollapsed, setStatsCollapsed] = useState(() => window.innerWidth < 640);
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

    const loadGraph = useCallback(async () => {
        try {
            const g = await api.getRelationshipGraph({ mustberomantic: false, mustbesexual: false });
            setGraphData(g);
        } catch (err) {
            // 403 here is expected when discoverable is off. Silently clear.
            setGraphData(null);
        }
    }, []);

    const loadAll = useCallback(async (isDiscoverable) => {
        await loadDirect();
        if (isDiscoverable) await loadGraph();
        else setGraphData(null);
    }, [loadDirect, loadGraph]);

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate]);

    const { nodes, edges } = useMemo(
        () => buildGraphData({
            selfHandle,
            directRels,
            graphData,
            discoverable,
            mustBeRomantic: filterRomantic,
            mustBeSexual: filterSexual,
            mustBeQPR: filterQPR,
        }),
        // labelVersion is included so saved local labels propagate to the graph.
        [selfHandle, directRels, graphData, discoverable, labelVersion, filterRomantic, filterSexual, filterQPR]
    );

    const stats = useMemo(
        () => computePolyculeStats({ directRels, graphData, discoverable }),
        [directRels, graphData, discoverable]
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
            if (discoverable) await loadGraph();
            setCreateOpen(false);
            showToast("Pending relationship created. Click the dashed edge to copy the join link.");
        } catch (err) {
            showToast(err.message || "Failed to create relationship.");
        }
    };

    const handleEdgeClick = (edgeRaw) => {
        if (!edgeRaw?.relationshipUUID) return;

        setOpenModal({
            type: "edge",
            relationshipUUID: edgeRaw.relationshipUUID
        });
    };

    const handleNodeClick = (node) => {
        if (!node) return;
        if (node.type !== "direct" && node.type !== "pending") return;

        const prefix = "direct:";
        if (!node.id?.startsWith(prefix)) return;

        const uuid = node.id.slice(prefix.length);

        setOpenModal({
            type: "edge",
            relationshipUUID: uuid
        });
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
                        <label className="filter-checkbox">
                            <input
                                type="checkbox"
                                checked={filterQPR}
                                onChange={(e) => setFilterQPR(e.target.checked)}
                            />
                            {" "}Queerplatonic (QPR)
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

            <div className="floating bottom-left">
                <StatsPanel stats={stats} discoverable={discoverable} collapsed={statsCollapsed} onToggle={() => setStatsCollapsed(v => !v)} />
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
                onNodeClick={handleNodeClick}
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
                            if (val) await loadGraph();
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
                    relationshipUUID={openModal.relationshipUUID}
                    directRels={directRels}
                    onClose={() => setOpenModal(null)}
                    onChange={async () => {
                        await loadDirect();
                        if (discoverable) await loadGraph();
                    }}
                    onLabelSaved={() => {
                        setLabelVersion(v => v + 1);
                        showToast("Label saved locally.");
                    }}
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
                        The wider graph returns the structural shape of the connected component with romantic, sexual, and queerplatonic flags on each edge. Node IDs are randomised on every request, but anyone running the query can see how many partners you have, how many partners your partners have, and the flag pattern of each edge. In a small community, this shape can be enough to identify you. The server admin can read the full edge list with real handles regardless of this setting.
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

function EdgeMenu({ relationshipUUID, directRels, onClose, onChange, onLabelSaved }) {
    const rel = directRels.find(r => r.relationshipUUID === relationshipUUID);
    const isPending = !rel?.otherHandle;
    const joinUrl = `${window.location.origin}/join-relationship/${rel.relationshipUUID}`;
    const joinMessage = `PPMap is a private map of romantic, sexual, and queerplatonic relationships. Open this link to connect with me on PPMap. Log in or register first if you need to.\n\n${joinUrl}`;
    const [partnerLabel, setPartnerLabel] = useState(() => rel.otherHandle ? (getLabel(rel.otherHandle) || "") : "");
    const [pendingLabel, setPendingLabel] = useState(() => isPending ? (getLabel(rel.relationshipUUID) || "") : "");
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
                <>
                    <section className="modal-section">
                        <p className="modal-hint">Send this link to your partner. They log in (or register) and use it to connect with you. Once they're in, ask them to invite their own partners too — that's how the map grows.</p>
                    </section>
                    <section className="modal-section">
                        <label className="modal-label">Join link</label>
                        <div className="handle-block">
                            <code>{joinUrl}</code>
                            <button onClick={() => navigator.clipboard?.writeText(joinUrl)}>Copy link</button>
                        </div>
                    </section>
                    <section className="modal-section">
                        <label className="modal-label">Label (this browser only)</label>
                        <div className="row">
                            <input
                                type="text"
                                value={pendingLabel}
                                onChange={(e) => setPendingLabel(e.target.value)}
                                placeholder="Who is this for? e.g. Alex"
                            />
                            <button onClick={() => { setLabel(rel.relationshipUUID, pendingLabel.trim()); onLabelSaved?.(); }}>Save</button>
                        </div>
                        <p className="modal-hint">Shown on the pending node so multiple invites stay distinct. Never sent to the server.</p>
                    </section>
                </>
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
                {!rel.romantic && !rel.sexual && (
                    <p className="modal-hint" style={{ color: "#16a34a" }}>
                        Queerplatonic (QPR) — intimate and committed, but platonic and non-sexual.
                    </p>
                )}
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
                <p className="modal-hint">Leave both unchecked for a queerplatonic (QPR) relationship.</p>
            </section>
            <section className="modal-section">
                <button className="primary-button" onClick={() => onSubmit({ romantic, sexual })}>Create</button>
                <p className="modal-hint" style={{ marginTop: "10px" }}>
                    Once your partner joins, ask them to invite their partners too — that's how the map grows.
                </p>
            </section>
        </Modal>
    );
}
