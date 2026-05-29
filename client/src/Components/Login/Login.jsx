import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../../api";
import "./Login.css";
import "../../common.css";

const LAST_HANDLE_KEY = "ppmap:lastHandle";

function ConsentBlock() {
  return (
    <div style={{ fontSize: "0.9em", lineHeight: 1.5, padding: "12px", background: "#f8f8f8", border: "1px solid #ddd", marginBottom: "12px" }}>
      <p><strong>Before you sign up, read this.</strong> PPMap stores a map of who is in romantic or sexual relationships with whom.</p>

      <p><strong>What the server limits its exposure to:</strong></p>
      <ul>
        <li>Your stable identifier is a random handle. Your display name is set in your own browser and never sent to the server.</li>
        <li>In the wider graph view, all node IDs are randomised on every request, so the same node cannot be tracked across queries.</li>
        <li>You only appear in graph queries beyond your direct partners if you turn on "discoverable" in account settings. This is off by default.</li>
      </ul>

      <p><strong>What the server stores about you, and therefore what is exposed if the server is seized or compromised:</strong></p>
      <ul>
        <li>Your handle.</li>
        <li>The handles of every account you are connected to.</li>
        <li>For each connection: whether it is romantic, whether it is sexual, and when it was created.</li>
        <li>A bcrypt hash of your password (not the plaintext, but a weak password can be cracked offline).</li>
        <li>Your discoverability setting.</li>
      </ul>

      <p><strong>What this design cannot protect you from:</strong></p>
      <ul>
        <li>The shape of your connections is visible to anyone who can run the graph view. In a small community, the pattern of your relationships can identify you to someone who already knows one or two of your partners.</li>
        <li>The server administrator holds the JWT signing key and can impersonate any account.</li>
        <li>Anyone you share your handle with can confirm you have an account and check whether they are connected to you.</li>
      </ul>

      <p>If any of that is too much risk for your situation, do not sign up.</p>
    </div>
  );
}

export default function Login() {
  const [handle, setHandle] = useState(() => localStorage.getItem(LAST_HANDLE_KEY) || "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [newHandle, setNewHandle] = useState(null);
  const [registerMode, setRegisterMode] = useState(false);
  const [consented, setConsented] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await api.loginPerson({ handle, password });
      localStorage.setItem(LAST_HANDLE_KEY, handle);
      navigate("/dashboard");
    } catch (err) {
      setMessage(err.message || JSON.stringify(err));
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!consented) {
      setMessage("You must read and acknowledge the notice before creating an account.");
      return;
    }
    try {
      const res = await api.createPerson({ password });
      if (res?.handle) {
        localStorage.setItem(LAST_HANDLE_KEY, res.handle);
        setNewHandle(res.handle);
      }
    } catch (err) {
      setMessage(err.message || JSON.stringify(err));
    }
  };

  if (newHandle) {
    return (
      <div className="login-container">
        <h2>Account created</h2>
        <p>Your handle is the only way to log in. Save it somewhere safe before you continue. There is no recovery if you lose it.</p>
        <div className="section" style={{ fontFamily: "monospace", fontSize: "1.2em", padding: "12px", background: "#f4f4f4" }}>
          {newHandle}
        </div>
        <button onClick={() => {
          navigator.clipboard?.writeText(newHandle);
        }}>Copy</button>
        <button onClick={() => navigate("/dashboard")} style={{ marginLeft: "10px" }}>
          I've saved it, continue
        </button>
      </div>
    );
  }

  return (
    <div className="login-container">
      <h2>{registerMode ? "Register" : "Login"}</h2>
      <p>
        {registerMode
          ? "Enter a password. The server will generate your handle."
          : "Enter your handle and password."}
      </p>
      {message && <p className="message">{message}</p>}

      {registerMode && <ConsentBlock />}

      <form
        onSubmit={registerMode ? handleRegister : handleLogin}
        className="section"
      >
        {!registerMode && (
          <input
            type="text"
            name="handle"
            placeholder="Handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            autoComplete="username"
          />
        )}
        <input
          type="password"
          name="password"
          placeholder={registerMode ? "Password (min 12 characters)" : "Password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={registerMode ? "new-password" : "current-password"}
          minLength={registerMode ? 12 : undefined}
        />

        {registerMode && (
          <label style={{ display: "block", margin: "8px 0", fontSize: "0.9em" }}>
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
            />
            {" "}I have read the above and I want to create an account.
          </label>
        )}

        <button type="submit" disabled={registerMode && !consented}>
          {registerMode ? "Register" : "Login"}
        </button>
      </form>
      <p>
        {registerMode ? "Already have an account?" : "Don't have an account?"}{" "}
        <button
          className="link-button"
          onClick={() => {
            setRegisterMode(!registerMode);
            setMessage("");
            setConsented(false);
          }}
        >
          {registerMode ? "Login" : "Register"}
        </button>
      </p>
    </div>
  );
}
