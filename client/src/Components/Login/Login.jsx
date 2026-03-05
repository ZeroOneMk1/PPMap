import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../../api";
import "./Login.css";
import "../../common.css";

export default function Login() {
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [registerMode, setRegisterMode] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await api.loginPerson({ nickname, password });
      if (res.token) {
        api.setTokenCookie(res.token);
        navigate("/dashboard");
      }
    } catch (err) {
      setMessage(err.message || JSON.stringify(err));
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await api.createPerson({ nickname, password });
      if (res.token) {
        api.setTokenCookie(res.token);
        navigate("/dashboard");
      }
    } catch (err) {
      setMessage(err.message || JSON.stringify(err));
    }
  };

  return (
    <div className="login-container">
      <h2>{registerMode ? "Register" : "Login"}</h2>
      <p>Enter your credentials to {registerMode ? "create an account" : "log in"}.</p>
      {message && <p className="message">{message}</p>}
      <form
        onSubmit={registerMode ? handleRegister : handleLogin}
        className="section"
      >
        <input
          type="text"
          name="nickname"
          placeholder="Nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">
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
          }}
        >
          {registerMode ? "Login" : "Register"}
        </button>
      </p>
    </div>
  );
}
