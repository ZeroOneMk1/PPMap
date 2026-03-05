import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import * as api from "../../api";
import "../../common.css";
import "./Dashboard.css";
import RelationshipGraph from "../RelationshipGraph/RelationshipGraph";

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
    const navigate = useNavigate();

    // Relationship State
    const [directRelationships, setDirectRelationships] = useState([]);
    const [filterDepth, setFilterDepth] = useState(1);
    const [mustBeRomantic, setMustBeRomantic] = useState(false);
    const [mustBeSexual, setMustBeSexual] = useState(false);
    const [createRomantic, setCreateRomantic] = useState(false);
    const [createSexual, setCreateSexual] = useState(false);
    const [matrixLabels, setMatrixLabels] = useState([]);
    const [matrixData, setMatrixData] = useState([]);
    const [copiedUUID, setCopiedUUID] = useState(null);
    const [userNickname, setUserNickname] = useState("");

    const token = api.getTokenCookie();
    const decoded = decodeToken(token);
    const isAdmin = decoded?.UUID === "69420";

    useEffect(() => {
        if (!token) {
            navigate("/");
        } else {
            loadDirect();
            api.getPersonByToken().then((p) => {
                if (p?.nickname) setUserNickname(p.nickname);
            }).catch(() => { });
        }
    }, [token, navigate]);

    const loadDirect = async () => {
        try {
            const res = await api.getRelatedPersons({ depth: 1 });
            setDirectRelationships(res.directRelationships || []);
        } catch (err) {
            setMessage(err.message);
        }
    };

    const handleSubmit = async (callback) => {
        try {
            const res = await callback();
            return res;
        } catch (err) {
            setMessage(err.message || JSON.stringify(err));
            return null;
        }
    };

    const copyToClipboard = async (uuid, link) => {
        await navigator.clipboard.writeText(link);
        setCopiedUUID(uuid);
        setTimeout(() => setCopiedUUID(null), 1500);
    };

    const logout = () => {
        api.clearTokenCookie();
        navigate("/");
    };

    return (
        <div className="login-container">
            <nav style={{ marginBottom: "20px" }}>
                <Link to="/edit-account">⚙️ Edit Account</Link> | 
                <button onClick={logout} style={{ marginLeft: "10px" }}>Logout</button>
            </nav>

            <h2>Dashboard</h2>
            <p>Welcome, <strong>{userNickname || "..."}</strong></p>
            <p className="message">{message}</p>

            {/* Create relationship */}
            <div className="section">
                <h3>Create relationship</h3>
                <label><input type="checkbox" checked={createRomantic} onChange={(e) => setCreateRomantic(e.target.checked)} /> Romantic</label>
                <label><input type="checkbox" checked={createSexual} onChange={(e) => setCreateSexual(e.target.checked)} /> Sexual</label>
                <br /><br />
                <button onClick={async () => {
                    await handleSubmit(() => api.createRelationship({ romantic: createRomantic, sexual: createSexual }));
                    loadDirect();
                }}>Create</button>
            </div>

            {/* Relationships table */}
            <div className="section">
                <h3>My Relationships</h3>
                {directRelationships.length === 0 ? (
                    <p>No relationships yet. Create one and share the link!</p>
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
                                        {rel.otherNickname || (
                                            <>
                                                <span>Pending...</span>
                                                <button onClick={() => copyToClipboard(rel.relationshipUUID, `${window.location.origin}/join-relationship/${rel.relationshipUUID}`)}>
                                                    📋 Copy
                                                </button>
                                                {copiedUUID === rel.relationshipUUID && <small>Copied!</small>}
                                            </>
                                        )}
                                    </td>
                                    <td>
                                        <input type="checkbox" checked={rel.romantic} disabled={!rel.otherNickname} 
                                            onChange={async (e) => {
                                                await api.editRelationship({ relationshipUUID: rel.relationshipUUID, romantic: e.target.checked });
                                                loadDirect();
                                            }} 
                                        />
                                    </td>
                                    <td>
                                        <input type="checkbox" checked={rel.sexual} disabled={!rel.otherNickname} 
                                            onChange={async (e) => {
                                                await api.editRelationship({ relationshipUUID: rel.relationshipUUID, sexual: e.target.checked });
                                                loadDirect();
                                            }} 
                                        />
                                    </td>
                                    <td>
                                        <button onClick={async () => {
                                            await api.endRelationship({ relationshipUUID: rel.relationshipUUID });
                                            loadDirect();
                                        }}>End</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Lookup / Graph section */}
            <div className="section">
                <h3>Graph Lookup</h3>
                <label><input type="checkbox" checked={mustBeRomantic} onChange={(e) => setMustBeRomantic(e.target.checked)} /> Romantic</label>
                <label><input type="checkbox" checked={mustBeSexual} onChange={(e) => setMustBeSexual(e.target.checked)} /> Sexual</label>
                <br />
                <label>Depth: 
                    <input 
                        type="number" 
                        value={filterDepth} 
                        onChange={(e) => setFilterDepth(parseInt(e.target.value) || 1)} 
                        max={isAdmin ? 10 : 2} 
                    />
                </label>
                <button onClick={async () => {
                    const res = await handleSubmit(() => api.getRelatedPersons({ depth: filterDepth, mustberomantic: mustBeRomantic, mustbesexual: mustBeSexual }));
                    if (res) { setMatrixLabels(res.nicknames || []); setMatrixData(res.matrix || []); }
                }}>Refresh Graph</button>
            </div>

            <div className="section">
                <h3>Relationship Graph</h3>
                {matrixData.length > 0 ? (
                    <RelationshipGraph matrixData={matrixData} matrixLabels={matrixLabels} />
                ) : <p>Run lookup to see graph.</p>}
            </div>
        </div>
    );
}