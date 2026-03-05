import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import * as api from "../../api";
import "../../common.css";
import "./EditAccount.css";

export default function EditAccount() {
    const [message, setMessage] = useState("");
    const [nickname, setNickname] = useState("");
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [discoverable, setDiscoverable] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const token = api.getTokenCookie();
        if (!token) {
            navigate("/");
            return;
        }
        api.getPersonByToken().then((p) => {
            if (p) {
                setNickname(p.nickname || "");
                setDiscoverable(p.discoverable || false);
            }
        });
    }, [navigate]);

    const handleAction = async (callback) => {
        try {
            await callback();
            setMessage("Success!");
        } catch (err) {
            setMessage(err.message || "An error occurred");
        }
    };

    return (
        <div className="login-container">
            <Link to="/dashboard">← Back to Dashboard</Link>
            <h2>Account Settings</h2>
            <p className="message">{message}</p>

            <div className="section">
                <h3>Update Nickname</h3>
                <input 
                    type="text" 
                    value={nickname} 
                    onChange={(e) => setNickname(e.target.value)} 
                    placeholder="New nickname" 
                />
                <button onClick={() => handleAction(() => api.renamePerson({ nickname }))}>
                    Update Name
                </button>
            </div>

            <div className="section">
                <h3>Change Password</h3>
                <input 
                    type="password" 
                    placeholder="Old Password" 
                    onChange={(e) => setOldPassword(e.target.value)} 
                />
                <input 
                    type="password" 
                    placeholder="New Password" 
                    onChange={(e) => setNewPassword(e.target.value)} 
                />
                <button onClick={() => handleAction(() => api.updatePersonPassword({ password: oldPassword, newpassword: newPassword }))}>
                    Update Password
                </button>
            </div>

            <div className="section">
                <h3>Privacy</h3>
                <label>
                    <input
                        type="checkbox"
                        checked={discoverable}
                        onChange={(e) => {
                            const val = e.target.checked;
                            setDiscoverable(val);
                            handleAction(() => api.toggleDiscoverability({ discoverable: val }));
                        }}
                    />
                    Discoverable (Visible in wider graph searches)
                </label>
            </div>
        </div>
    );
}