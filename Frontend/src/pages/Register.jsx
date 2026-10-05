import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [shopName, setShopName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!name || !email || !password) {
      setError("Please complete all required fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      await register(name, email, password, shopName);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const friendlyMessage = err?.friendlyMessage || "Unable to create your account right now. Please try again.";
      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
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
          <h2 style={{ margin: 0, fontSize: "1.5rem" }}>Register</h2>
          <p style={{ margin: "0.5rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
            Naya account banayein
          </p>
        </div>

        {error && (
          <div className="message error" style={{ marginBottom: "1.25rem", textAlign: "center" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Full Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Apna naam"
              dir="auto"
              autoComplete="name"
              style={{ width: "100%", padding: "0.75rem 1rem", borderRadius: 12, border: "1px solid var(--border)" }}
            />
          </label>

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

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              dir="auto"
              autoComplete="new-password"
              style={{ width: "100%", padding: "0.75rem 1rem", borderRadius: 12, border: "1px solid var(--border)" }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Confirm Password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="••••••••"
              dir="auto"
              autoComplete="new-password"
              style={{ width: "100%", padding: "0.75rem 1rem", borderRadius: 12, border: "1px solid var(--border)" }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Shop Name <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional)</span></span>
            <input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="Apne shop ka naam"
              dir="auto"
              style={{ width: "100%", padding: "0.75rem 1rem", borderRadius: 12, border: "1px solid var(--border)" }}
            />
          </label>

          <button type="submit" className="button primary" disabled={loading} style={{ marginTop: "0.5rem" }}>
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>

        <p style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.9rem", color: "var(--muted)" }}>
          Pehle se account hai?{" "}
          <Link to="/login" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}>
            Login karein
          </Link>
        </p>
      </div>
    </div>
  );
}
