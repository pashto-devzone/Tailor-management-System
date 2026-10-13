import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { handleApiError, requestPasswordReset } from "../services/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err?.friendlyMessage || "Invalid email/username or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault(); setError(""); setRecoveryMessage(""); setLoading(true);
    try {
      const response = await requestPasswordReset(email);
      setRecoveryMessage(response.data?.message || "If an account exists for that email, a recovery link has been sent.");
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to request password recovery.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      padding: "2rem 1rem",
      background: "var(--bg)"
    }}>
      <div className="card" style={{
        width: "100%",
        maxWidth: 420,
        padding: "2.5rem"
      }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.5rem" }}>Login</h2>
          <p style={{ margin: "0.5rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
            Apni account se login karein
          </p>
        </div>

        {error && (
          <div className="message error" style={{ marginBottom: "1.25rem", textAlign: "center" }}>
            {error}
          </div>
        )}

        <form onSubmit={forgotMode ? handleForgotPassword : handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="name@example.com"
              dir="auto"
              autoComplete="email"
              style={{ width: "100%", padding: "0.75rem 1rem", borderRadius: 12, border: "1px solid var(--border)" }}
            />
          </label>

          {!forgotMode && <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              dir="auto"
              autoComplete="current-password"
              style={{ width: "100%", padding: "0.75rem 1rem", borderRadius: 12, border: "1px solid var(--border)" }}
            />
          </label>}

          <button type="submit" className="button primary" disabled={loading} style={{ marginTop: "0.5rem" }}>
            {loading ? "Please wait..." : forgotMode ? "Send Recovery Link" : "Login"}
          </button>
        </form>

        {recoveryMessage && <p className="message success" role="status">{recoveryMessage}</p>}
        <p style={{ margin: "1rem 0 0", textAlign: "center", fontSize: "0.9rem" }}>
          <button type="button" className="text-button" onClick={() => { setForgotMode((value) => !value); setError(""); setRecoveryMessage(""); }}>
            {forgotMode ? "Back to Login" : "Forgot Password?"}
          </button>
        </p>

        <p style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.9rem", color: "var(--muted)" }}>
          Account nahi hai?{" "}
          <Link to="/register" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}>
            Register karein
          </Link>
        </p>
      </div>
    </div>
  );
}
