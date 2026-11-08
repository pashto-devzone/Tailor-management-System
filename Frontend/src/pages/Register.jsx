import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import {
  testSupabaseConnection,
} from "../services/api";

export default function Register() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [shopName, setShopName] = useState("");

  const [projectUrl, setProjectUrl] = useState("");
  const [projectName, setProjectName] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [connectionString, setConnectionString] = useState("");
  const [connectionHost, setConnectionHost] = useState("");
  const [connectionPort, setConnectionPort] = useState("5432");
  const [connectionDatabase, setConnectionDatabase] = useState("postgres");
  const [connectionUsername, setConnectionUsername] = useState("");
  const [connectionPassword, setConnectionPassword] = useState("");
  const [sslMode, setSslMode] = useState("no-verify");

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const goBack = () => {
    if (step === 2) {
      setStep(1);
      setError("");
      setInfo("");
    } else {
      navigate("/login");
    }
  };

  const goSkip = async () => {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      await register(name, email, password, shopName, null);
      setStep(3);
    } catch (err) {
      setError(err?.friendlyMessage || "Unable to create your account right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDetailsSubmit = (e) => {
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
    setStep(2);
  };

  const handleTestConnection = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    const hasConnString = Boolean(connectionString);
    const hasFields = Boolean(connectionHost && connectionPort && connectionDatabase && connectionUsername && connectionPassword);
    if (!hasConnString && !hasFields) {
      setError("Please enter either a Connection String or Host, Port, Database, Username and Password.");
      return;
    }
    setTesting(true);
    try {
      const res = await testSupabaseConnection({
        connectionString: connectionString || undefined,
        connectionHost: connectionHost || undefined,
        connectionPort: connectionPort || undefined,
        connectionDatabase: connectionDatabase || undefined,
        connectionUsername: connectionUsername || undefined,
        connectionPassword: connectionPassword || undefined,
        sslMode,
        projectUrl: projectUrl || undefined,
        projectName: projectName || undefined,
        anonKey: anonKey || undefined,
      });
      if (res.data.ok) {
        setInfo("Connection successful. Your Supabase project is reachable.");
      } else {
        setError(res.data.error || "Connection test failed.");
        if (res.data.missing_tables && res.data.missing_tables.length) {
          setError(
            `Missing tables: ${res.data.missing_tables.join(", ")}. Set them up before saving.`
          );
        }
      }
    } catch (err) {
      setError(err?.friendlyMessage || "Unable to test connection.");
    } finally {
      setTesting(false);
    }
  };

  const handleSupabaseSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    const hasConnString = Boolean(connectionString);
    const hasFields = Boolean(connectionHost && connectionPort && connectionDatabase && connectionUsername && connectionPassword);
    const hasSupabaseApi = Boolean(projectUrl || anonKey);

    if (!hasConnString && !hasFields && !hasSupabaseApi) {
      setError("Please enter either database connection details or Supabase Project URL/Anon Key.");
      return;
    }

    setLoading(true);
    try {
      await register(
        name,
        email,
        password,
        shopName,
        {
          projectUrl,
          projectName,
          anonKey,
          connectionString: connectionString || undefined,
          connectionHost: connectionHost || undefined,
          connectionPort: connectionPort || undefined,
          connectionDatabase: connectionDatabase || undefined,
          connectionUsername: connectionUsername || undefined,
          connectionPassword: connectionPassword || undefined,
          sslMode,
        }
      );
      setStep(3);
    } catch (err) {
      const friendlyMessage =
        err?.friendlyMessage || "Unable to create your account right now. Please try again.";
      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const finish = () => {
    navigate("/dashboard", { replace: true });
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
        {step === 3 ? (
          <div style={{ textAlign: "center" }}>
            <h2 style={{ margin: 0, fontSize: "1.5rem" }}>Account Created</h2>
            <p style={{ margin: "0.5rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
              Your Tailor Hub account is ready.
            </p>
            <button type="button" className="button primary" onClick={finish} style={{ marginTop: "1.5rem" }}>
              Go to Dashboard
            </button>
            <div style={{ marginTop: "1rem" }}>
              <button type="button" className="button secondary" onClick={goBack} style={{ marginRight: "0.5rem" }}>
                Back
              </button>
              <button type="button" className="button secondary" onClick={() => navigate("/login")}>
                Login
              </button>
            </div>
          </div>
        ) : step === 2 ? (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <button type="button" className="button secondary" onClick={goBack}>Back</button>
              <button type="button" className="button secondary" onClick={goSkip}>Skip for Now</button>
            </div>
            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.5rem" }}>Connect Your Supabase Project</h2>
              <p style={{ margin: "0.5rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
                New users connect their own Supabase project for business data (customers, orders, measurements).
              </p>
            </div>

            {error && (
              <div className="message error" style={{ marginBottom: "1.25rem", textAlign: "center" }}>
                {error}
              </div>
            )}
            {info && (
              <div className="message success" style={{ marginBottom: "1.25rem", textAlign: "center" }}>
                {info}
              </div>
            )}

            <form onSubmit={handleSupabaseSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Connection String (Session Pooler URI)</span>
                <input
                  type="text"
                  value={connectionString}
                  onChange={(e) => setConnectionString(e.target.value)}
                  placeholder="postgresql://user:password@host:5432/postgres?sslmode=no-verify"
                  dir="auto"
                  style={{ width: "100%", padding: "0.75rem 1rem", borderRadius: 12, border: "1px solid var(--border)", fontFamily: "monospace", fontSize: "0.85rem" }}
                />
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)" }}>
                  Or fill individual fields below. Find this in Supabase Dashboard &rarr; Settings &rarr; Database &rarr; Connection string &rarr; Session Pooler.
                </p>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Project Name <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional)</span></span>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="My Tailor Shop"
                  dir="auto"
                  style={{ width: "100%", padding: "0.75rem 1rem", borderRadius: 12, border: "1px solid var(--border)" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Anon Key (public)</span>
                <input
                  type="text"
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  required
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  dir="auto"
                  autoComplete="off"
                  style={{ width: "100%", padding: "0.75rem 1rem", borderRadius: 12, border: "1px solid var(--border)", fontFamily: "monospace", fontSize: "0.85rem" }}
                />
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)" }}>
                  This is the publishable anon key (not the secret service_role key). It is safe to use in the app.
                </p>
              </label>

              <button type="button" className="button secondary" onClick={handleTestConnection} disabled={testing}>
                {testing ? "Testing..." : "Test Connection"}
              </button>

              <button type="submit" className="button primary" disabled={loading} style={{ marginTop: "0.5rem" }}>
                {loading ? "Creating account..." : "Connect & Complete Registration"}
              </button>
            </form>

            <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--border)", paddingTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button type="button" className="text-button" onClick={() => setStep(1)}>
                &larr; Back to details
              </button>
              <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)" }}>
                Step 2 of 2
              </p>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.5rem" }}>Create Account</h2>
              <p style={{ margin: "0.5rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
                Naya account banayein
              </p>
            </div>

            {error && (
              <div className="message error" style={{ marginBottom: "1.25rem", textAlign: "center" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleDetailsSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
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
                {loading ? "Creating account..." : "Continue to Supabase Setup"}
              </button>
            </form>

            <p style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.9rem", color: "var(--muted)" }}>
              Pehle se account hai?{" "}
              <Link to="/login" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}>
                Login karein
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
