import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../api";
import "./Login/Login.css"; // reuse same styles
import RelationshipGraph from "./RelationshipGraph";

// helper to decode JWT payload
function decodeToken(token) {
    try {
        const payload = token.split('.')[1];
        return JSON.parse(atob(payload));
    } catch (e) {
        return null;
    }
}

export default function Dashboard() {
    const [message, setMessage] = useState("");
    const [result, setResult] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const token = api.getTokenCookie();
        if (!token) {
            navigate("/");
        }
    }, [navigate]);

    const handleSubmit = async (callback) => {
        try {
            const res = await callback();
            setResult(res);
            return res;
        } catch (err) {
            setMessage(err.message || JSON.stringify(err));
            // don't rethrow so callers that don't await don't get unhandled rejections
            return null;
        }
    };

    const renderSection = (title, fields, action, buttonText) => (
        <div className="section">
            <h3>{title}</h3>
            {fields.map((f) => (
                <input
                    key={f.name}
                    type={f.type || "text"}
                    name={f.name}
                    placeholder={f.placeholder || f.name}
                    onChange={(e) => (f.handler ? f.handler(e.target.value) : null)}
                />
            ))}
            <button onClick={() => handleSubmit(action)}>{buttonText}</button>
        </div>
    );

    const copyToClipboard = async (uuid, link) => {
        await navigator.clipboard.writeText(link);
        setCopiedUUID(uuid);

        setTimeout(() => {
            setCopiedUUID(null);
        }, 1500);
    };

    // state holders for each field to avoid token inputs
    const [newNick, setNewNick] = useState("");
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [discoverable, setDiscoverable] = useState(false);
    const [filterDepth, setFilterDepth] = useState(1);
    const [mustBeRomantic, setMustBeRomantic] = useState(false);
    const [mustBeSexual, setMustBeSexual] = useState(false);

    // matrix display state
    const [matrixLabels, setMatrixLabels] = useState([]);
    const [matrixData, setMatrixData] = useState([]);
    // relationship-specific fields
    const [createRomantic, setCreateRomantic] = useState(false);
    const [createSexual, setCreateSexual] = useState(false);

    // direct relationships table
    const [directRelationships, setDirectRelationships] = useState([]);

    // link hanlding
    const [copiedUUID, setCopiedUUID] = useState(null);

    // load degree-1 relationships for the table
    const loadDirect = async () => {
        try {
            const res = await api.getRelatedPersons({ depth: 1 });
            setDirectRelationships(res.directRelationships || []);
        } catch (err) {
            setMessage(err.message || JSON.stringify(err));
        }
    };

    const logout = () => {
        api.clearTokenCookie();
        navigate("/");
    };

    useEffect(() => {
        // once dashboard mounts, grab degree‑1 relationships
        loadDirect();
    }, []);

    const token = api.getTokenCookie();
    const decoded = decodeToken(token);
    const userUUID = decoded?.UUID;
    const isAdmin = userUUID === "69420";
    const [userNickname, setUserNickname] = useState("");

    // fetch my profile to get nickname
    useEffect(() => {
        if (token) {
            api.getPersonByToken().then((p) => {
                if (p && p.nickname) setUserNickname(p.nickname);
            }).catch(() => { });
        }
    }, [token]);

    return (
        <div className="login-container">
            <h2>Dashboard</h2>
            <p>Logged in as: <strong>{userNickname || "..."}</strong></p>
            <button onClick={logout}>Logout</button>
            <p className="message">{message}</p>

            {renderSection(
                "Rename me",
                [
                    { name: "nickname", placeholder: "New nickname", handler: setNewNick },
                ],
                () => api.renamePerson({ nickname: newNick }),
                "Rename"
            )}

            {renderSection(
                "Update password",
                [
                    { name: "password", type: "password", placeholder: "Old password", handler: setOldPassword },
                    { name: "newpassword", type: "password", placeholder: "New password", handler: setNewPassword },
                ],
                () =>
                    api.updatePersonPassword({ password: oldPassword, newpassword: newPassword }),
                "Change Password"
            )}

            {/* Toggle discoverability */}
            <div className="section">
                <h3>Toggle discoverability</h3>
                <label>
                    <input
                        type="checkbox"
                        checked={discoverable}
                        onChange={(e) => {
                            const newState = e.target.checked;
                            setDiscoverable(newState);
                            handleSubmit(() => api.toggleDiscoverability({ discoverable: newState }));
                        }}
                    />
                    Discoverable
                </label>
            </div>

            {/* Create relationship */}
            <div className="section">
                <h3>Create relationship</h3>
                <label>
                    <input
                        type="checkbox"
                        checked={createRomantic}
                        onChange={(e) => setCreateRomantic(e.target.checked)}
                    />
                    Romantic
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={createSexual}
                        onChange={(e) => setCreateSexual(e.target.checked)}
                    />
                    Sexual
                </label>
                <br></br>
                <button
                    onClick={async () => {
                        try {
                            await handleSubmit(() =>
                                api.createRelationship({ romantic: createRomantic, sexual: createSexual })
                            );
                            loadDirect();
                        } catch { }
                    }}
                >
                    Create
                </button>
            </div>

            {/* Direct (degree-1) relationships table */}
            <div className="section">
                <h3>My Relationships</h3>
                {directRelationships.length === 0 ? (
                    <p>
                        you're not in any relationships yet. create them and send them to
                        the people you love to accept.
                    </p>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>Person</th>
                                <th>Romantic</th>
                                <th>Sexual</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {directRelationships.map((rel) => (
                                <tr key={rel.relationshipUUID}>
                                    <td>
                                        {rel.otherNickname ? (
                                            rel.otherNickname
                                        ) : (
                                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                <span
                                                    style={{
                                                        background: "#eee",
                                                        padding: "4px 8px",
                                                        borderRadius: "6px",
                                                        fontSize: "0.9em"
                                                    }}
                                                >
                                                    Pending Invite
                                                </span>

                                                <button
                                                    style={{
                                                        color: "#1976d2",
                                                        background: "none",
                                                        border: "none",
                                                        cursor: "pointer",
                                                        fontWeight: "bold"
                                                    }}
                                                    onClick={() =>
                                                        copyToClipboard(
                                                            rel.relationshipUUID,
                                                            `http://localhost:3000/join-relationship/${rel.relationshipUUID}`
                                                        )
                                                    }
                                                >
                                                    📋 Copy Link
                                                </button>

                                                {copiedUUID === rel.relationshipUUID && (
                                                    <span style={{ color: "green", fontSize: "0.9em" }}>
                                                        Copied!
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={rel.romantic}
                                            disabled={!rel.otherNickname}
                                            onChange={async (e) => {
                                                const newVal = e.target.checked;
                                                await api.editRelationship({
                                                    relationshipUUID: rel.relationshipUUID,
                                                    romantic: newVal,
                                                });
                                                loadDirect();
                                            }}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={rel.sexual}
                                            disabled={!rel.otherNickname}
                                            onChange={async (e) => {
                                                const newVal = e.target.checked;
                                                await api.editRelationship({
                                                    relationshipUUID: rel.relationshipUUID,
                                                    sexual: newVal,
                                                });
                                                loadDirect();
                                            }}
                                        />
                                    </td>
                                    <td>
                                        <button
                                            onClick={async () => {
                                                await api.endRelationship({
                                                    relationshipUUID: rel.relationshipUUID,
                                                });
                                                loadDirect();
                                            }}
                                        >
                                            End
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Custom Get related persons section */}
            <div className="section">
                <h3>Get related persons</h3>
                <label>
                    <input
                        type="checkbox"
                        checked={mustBeRomantic}
                        onChange={(e) => setMustBeRomantic(e.target.checked)}
                    />
                    Must be romantic
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={mustBeSexual}
                        onChange={(e) => setMustBeSexual(e.target.checked)}
                    />
                    Must be sexual
                </label>
                <br></br>
                <label>
                    Depth:
                    {isAdmin ? (
                        <input
                            type="number"
                            min="1"
                            value={filterDepth}
                            onChange={(e) => setFilterDepth(parseInt(e.target.value, 10) || 1)}
                            style={{ marginLeft: "8px", width: "60px" }}
                        />
                    ) : (
                        <select
                            value={filterDepth}
                            onChange={(e) => setFilterDepth(parseInt(e.target.value, 10))}
                            style={{ marginLeft: "8px" }}
                        >
                            <option value={1}>1</option>
                            <option value={2}>2</option>
                        </select>
                    )}
                </label>
                <br></br>
                <button
                    onClick={async () => {
                        const res = await handleSubmit(() =>
                            api.getRelatedPersons({
                                depth: filterDepth,
                                mustberomantic: mustBeRomantic,
                                mustbesexual: mustBeSexual,
                            })
                        );
                        if (res) {
                            setMatrixLabels(res.nicknames || []);
                            setMatrixData(res.matrix || []);
                        }
                    }}
                >
                    Lookup
                </button>
            </div>

            {/* relationship matrix visualization */}
            {/* New relationship graph visualization */}
            <div className="section">
                <h3>Relationship Graph</h3>
                {matrixData.length === 0 ? (
                    <p>No data&nbsp;(run lookup with depth≥1)</p>
                ) : (
                    <RelationshipGraph
                        matrixData={matrixData}
                        matrixLabels={matrixLabels}
                    />
                )}
            </div>

            {renderSection(
                "Clean invalid relationships",
                [],
                api.cleanRelationships,
                "Clean"
            )}

            {isAdmin && renderSection(
                "Get all persons (admin)",
                [],
                api.getAllPersons,
                "Get All"
            )}

            <pre className="result">{JSON.stringify(result, null, 2)}</pre>
        </div>
    );
}
