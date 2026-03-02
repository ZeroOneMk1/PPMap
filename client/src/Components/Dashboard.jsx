import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../api";
import "./Login/Login.css"; // reuse same styles

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
    } catch (err) {
      setMessage(err.message || JSON.stringify(err));
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

  // state holders for each field to avoid token inputs
  const [newNick, setNewNick] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [discoverable, setDiscoverable] = useState(false);
  const [filterDepth, setFilterDepth] = useState(1);
  const [mustBeRomantic, setMustBeRomantic] = useState(false);
  const [mustBeSexual, setMustBeSexual] = useState(false);
  // relationship-specific fields
  const [createRomantic, setCreateRomantic] = useState(false);
  const [createSexual, setCreateSexual] = useState(false);
  const [joinUUID, setJoinUUID] = useState("");
  const [endUUID, setEndUUID] = useState("");
  const [editUUID, setEditUUID] = useState("");
  const [editRomantic, setEditRomantic] = useState(false);
  const [editSexual, setEditSexual] = useState(false);

  const logout = () => {
    api.clearTokenCookie();
    navigate("/");
  };

  const token = api.getTokenCookie();
  return (
    <div className="login-container">
      <h2>Dashboard</h2>
      <p>Token: {token}</p>
      <button onClick={logout}>Logout</button>
      <p className="message">{message}</p>

      {renderSection(
        "Get me by token",
        [],
        api.getPersonByToken,
        "Get Person"
      )}

      {renderSection(
        "Get all persons (admin)",
        [],
        api.getAllPersons,
        "Get All"
      )}

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

      {renderSection(
        "Toggle discoverability",
        [
          { name: "discoverable", placeholder: "true/false", handler: (v) => setDiscoverable(v === "true") },
        ],
        () => api.toggleDiscoverability({ discoverable }),
        "Set"
      )}

      {/* Relationship endpoints */}
      {renderSection(
        "Create relationship",
        [
          { name: "romantic", placeholder: "true/false", handler: (v) => setCreateRomantic(v === "true") },
          { name: "sexual", placeholder: "true/false", handler: (v) => setCreateSexual(v === "true") },
        ],
        () => api.createRelationship({ romantic: createRomantic, sexual: createSexual }),
        "Create"
      )}

      {renderSection(
        "Join relationship",
        [
          { name: "relationshipUUID", placeholder: "Relationship UUID", handler: setJoinUUID },
        ],
        () => api.joinRelationship({ relationshipUUID: joinUUID }),
        "Join"
      )}

      {renderSection(
        "End relationship",
        [
          { name: "relationshipUUID", placeholder: "Relationship UUID", handler: setEndUUID },
        ],
        () => api.endRelationship({ relationshipUUID: endUUID }),
        "End"
      )}

      {renderSection(
        "Edit relationship",
        [
          { name: "relationshipUUID", placeholder: "Relationship UUID", handler: setEditUUID },
          { name: "romantic", placeholder: "true/false", handler: (v) => setEditRomantic(v === "true") },
          { name: "sexual", placeholder: "true/false", handler: (v) => setEditSexual(v === "true") },
        ],
        () => api.editRelationship({ relationshipUUID: editUUID, romantic: editRomantic, sexual: editSexual }),
        "Edit"
      )}

      {renderSection(
        "Clean invalid relationships",
        [],
        api.cleanRelationships,
        "Clean"
      )}

      {renderSection(
        "Get related persons",
        [
          { name: "depth", placeholder: "Depth", handler: (v) => setFilterDepth(parseInt(v, 10) || 1) },
          { name: "mustberomantic", placeholder: "true/false", handler: (v) => setMustBeRomantic(v === "true") },
          { name: "mustbesexual", placeholder: "true/false", handler: (v) => setMustBeSexual(v === "true") },
        ],
        () =>
          api.getRelatedPersons({
            depth: filterDepth,
            mustberomantic: mustBeRomantic,
            mustbesexual: mustBeSexual,
          }),
        "Lookup"
      )}

      {renderSection(
        "Get pending relationships",
        [],
        api.getPendingRelationships,
        "Get Pending"
      )}

      <pre className="result">{JSON.stringify(result, null, 2)}</pre>
    </div>
  );
}
