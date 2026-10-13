import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resetPassword } from "../services/api";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault(); setError(""); setMessage("");
    if (!token) return setError("This recovery link is missing its token. Request a new link from login.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirmation) return setError("Passwords do not match.");
    setLoading(true);
    try {
      const response = await resetPassword(token, password);
      setMessage(response.data?.message || "Password reset. You can sign in now.");
      setPassword(""); setConfirmation("");
    } catch (err) {
      setError(err.response?.data?.message || "The recovery link is invalid or expired. Request a new one.");
    } finally { setLoading(false); }
  };

  return <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: 20 }}>
    <form className="card" onSubmit={submit} style={{ width: "min(100%, 440px)", display: "grid", gap: 14 }}>
      <h2 style={{ margin: 0 }}>Set a New Password</h2>
      {!token && <p className="message error" role="alert">This recovery link is missing its token. Request a new link from login.</p>}
      <label className="form-field"><span>New password</span><input type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <label className="form-field"><span>Confirm new password</span><input type="password" autoComplete="new-password" minLength={6} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
      {message && <p className="message success" role="status">{message}</p>}
      {error && <p className="message error" role="alert">{error}</p>}
      <button className="button primary" disabled={loading || !token}>{loading ? "Updating..." : "Reset Password"}</button>
      <Link to="/login">Back to Login</Link>
    </form>
  </div>;
}
