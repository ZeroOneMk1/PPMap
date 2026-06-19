import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as api from "../../api";
import "../../common.css";
import "./JoinRelationship.css";

export default function JoinRelationship() {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("Joining...");

  useEffect(() => {
    const join = async () => {
      try {
        await api.joinRelationship({ relationshipUUID: uuid });
        setStatus("Successfully joined! Redirecting...");
        setTimeout(() => navigate("/dashboard"), 1500);
      } catch (err) {
        if (err?.message === "Not authenticated") {
          setStatus("Please log in first.");
          setTimeout(() => navigate("/"), 2000);
          return;
        }
        setStatus(`Error: ${err.message || JSON.stringify(err)}`);
        setTimeout(() => navigate("/dashboard"), 3000);
      }
    };

    join();
  }, [uuid, navigate]);

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "40px 20px", textAlign: "center" }}>
      <p
        style={{
          fontSize: "0.95em",
          lineHeight: 1.5,
          color: "#555",
          padding: "12px 14px",
          background: "#f4f8fb",
          borderLeft: "3px solid #009fe3",
          margin: "0 0 24px 0",
          textAlign: "left",
        }}
      >
        PPMap is a private map of romantic and sexual relationships. Someone shared this link to add you as their partner. Once you join, you can edit or end the relationship from your dashboard.
      </p>
      <h2>{status}</h2>
    </div>
  );
}
