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
    <div style={{ textAlign: "center", padding: "40px" }}>
      <h2>{status}</h2>
    </div>
  );
}
