import { useEffect, useState } from "react";
import {
  getSettings,
  saveSettings,
  createBackup,
  restoreBackup,
  listApiKeys,
  createApiKey,
  getUserSupabaseConfig,
  saveUserSupabaseConfig,
  testSupabaseConnection,
  disconnectUserSupabase,
} from "../services/api";
import RecycleBinSection from "./RecycleBinSection";
import ProfessionalFooter from "../components/ProfessionalFooter.jsx";
import PrintSettingsSection from "../components/PrintSettingsSection.jsx";
import { useShop } from "../contexts/ShopContext";
import { useAuth } from "../contexts/AuthContext";
import { FaSignOutAlt } from "react-icons/fa";
import { FaChevronDown } from "react-icons/fa";
import { FaDatabase } from "react-icons/fa";
import { changePassword } from "../services/api";
import { logout } from "../services/api";


const initialForm = {


  shopName: "",
  ownerName: "",
  phone: "",
  address: "",
  currency: "PKR",
  logo: "",
  customerSerialStart: "",
  orderNumberStartingPoint: "",
};


function todayFilename() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `TailorHub_Backup_${yyyy}_${mm}_${dd}.zip`;
}

export default function Settings() {
  const { user } = useAuth();
  const [form, setForm] = useState(initialForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [backupMessage, setBackupMessage] = useState("");
  const [backupError, setBackupError] = useState("");

  const [shopInfoOpen, setShopInfoOpen] = useState(false);
  const [recycleBinOpen, setRecycleBinOpen] = useState(false);
  const [backupRestoreOpen, setBackupRestoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const apiKeyStorageKey = `tms_orders_api_key_${user?.user?.store_id || "current"}`;
  const [ordersApiKey, setOrdersApiKey] = useState(() => localStorage.getItem(apiKeyStorageKey) || "");
  const [ordersApiOpen, setOrdersApiOpen] = useState(false);
  const [apiKeyMessage, setApiKeyMessage] = useState("");
  const [apiKeyError, setApiKeyError] = useState("");
  const publicApiBase = import.meta.env.VITE_PUBLIC_API_URL || import.meta.env.VITE_API_URL || window.location.origin;
  const ordersApiEndpoint = `${publicApiBase.replace(/\/$/, "")}/api/v1/orders/{orderId}`;

  // Supabase Database Configuration state
  const [supabaseConfig, setSupabaseConfig] = useState(null);
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  const [supabaseMessage, setSupabaseMessage] = useState("");
  const [supabaseError, setSupabaseError] = useState("");
  const [supabaseOpen, setSupabaseOpen] = useState(false);
  const [connString, setConnString] = useState("");
  const [connHost, setConnHost] = useState("");
  const [connPort, setConnPort] = useState("5432");
  const [connDatabase, setConnDatabase] = useState("postgres");
  const [connUsername, setConnUsername] = useState("");
  const [connPassword, setConnPassword] = useState("");
  const [sslMode, setSslMode] = useState("no-verify");
  const [newProjectUrl, setNewProjectUrl] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newAnonKey, setNewAnonKey] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    let mounted = true;
    getUserSupabaseConfig()
      .then((res) => {
        if (!mounted) return;
        setSupabaseConfig(res.data);
      })
      .catch((err) => {
        if (!mounted) return;
        setSupabaseConfig(null);
      });
    return () => { mounted = false; };
  }, []);

  const handleSaveSupabaseConfig = async (e) => {
    e.preventDefault();
    setSupabaseError("");
    setSupabaseMessage("");
    if (!connString && (!connHost || !connPort || !connDatabase || !connUsername || !connPassword)) {
      setSupabaseError("Provide a connection string or host, port, database, username and password.");
      return;
    }
    setSupabaseLoading(true);
    try {
      const res = await saveUserSupabaseConfig({
        connectionString: connString || undefined,
        connectionHost: connHost || undefined,
        connectionPort: connPort || undefined,
        connectionDatabase: connDatabase || undefined,
        connectionUsername: connUsername || undefined,
        connectionPassword: connPassword || undefined,
        sslMode,
        projectUrl: newProjectUrl || undefined,
        projectName: newProjectName || undefined,
        anonKey: newAnonKey || undefined,
      });
      setSupabaseMessage(res.data.message || "Supabase configuration saved.");
      setSupabaseConfig(res.data.config || null);
      setNewProjectUrl("");
      setNewProjectName("");
      setNewAnonKey("");
    } catch (err) {
      setSupabaseError(err?.friendlyMessage || "Failed to save Supabase configuration.");
    } finally {
      setSupabaseLoading(false);
    }
  };

  const handleTestSupabaseConnection = async (e) => {
    e.preventDefault();
    setSupabaseError("");
    setSupabaseMessage("");
    if (!connString && (!connHost || !connPort || !connDatabase || !connUsername || !connPassword)) {
      setSupabaseError("Provide a connection string or host, port, database, username and password.");
      return;
    }
    setTestingConnection(true);
    try {
      const res = await testSupabaseConnection({
        connectionString: connString || undefined,
        connectionHost: connHost || undefined,
        connectionPort: connPort || undefined,
        connectionDatabase: connDatabase || undefined,
        connectionUsername: connUsername || undefined,
        connectionPassword: connPassword || undefined,
        sslMode,
        projectUrl: newProjectUrl || undefined,
        projectName: newProjectName || undefined,
        anonKey: newAnonKey || undefined,
      });
      if (res.data.ok) {
        setSupabaseMessage("Connection test passed. Your Supabase project is reachable.");
      } else {
        setSupabaseError(res.data.error || "Connection test failed.");
        if (res.data.missing_tables && res.data.missing_tables.length) {
          setSupabaseError(
            `Missing tables: ${res.data.missing_tables.join(", ")}. Set them up before saving.`
          );
        }
      }
    } catch (err) {
      setSupabaseError(err?.friendlyMessage || "Unable to test connection.");
    } finally {
      setTestingConnection(false);
    }
  };

  const handleDisconnectSupabase = async () => {
    if (!window.confirm("Disconnecting will stop using your personal Supabase project. Business data will remain in its original project. Continue?")) {
      return;
    }
    setSupabaseLoading(true);
    try {
      const res = await disconnectUserSupabase();
      setSupabaseMessage(res.data.message || "Disconnected.");
      setSupabaseConfig(null);
    } catch (err) {
      setSupabaseError(err?.friendlyMessage || "Failed to disconnect.");
    } finally {
      setSupabaseLoading(false);
    }
  };


  useEffect(() => {
    let mounted = true;
    getSettings()
      .then((res) => {
        if (!mounted) return;
        setForm((prev) => ({
          ...prev,
          ...(res.data || {}),
          // keep only required keys
          receiptFooter: undefined,
          whatsappNumber: undefined,
        }));
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.response?.data?.message || "Settings load failed.");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    listApiKeys().catch(() => {});
  }, []);

  const copyText = async (value, label) => {
    await navigator.clipboard.writeText(value);
    setApiKeyMessage(`${label} copied.`);
  };

  const generateOrdersApiKey = async () => {
    setApiKeyError("");
    setApiKeyMessage("");
    try {
      const response = await createApiKey("External Orders", ["orders:read", "orders:write"]);
      const key = response.data?.data?.apiKey;
      if (!key) throw new Error("The server did not return an API key.");
      localStorage.setItem(apiKeyStorageKey, key);
      setOrdersApiKey(key);
      setApiKeyMessage("Orders API key generated. Store it securely; it is shown only once.");
    } catch (err) {
      setApiKeyError(err.response?.data?.message || err.message || "API key generation failed.");
    }
  };

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleLogoUpload = (file) => {
    if (!file) {
      handleChange("logo", "");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      handleChange("logo", result);
    };
    reader.onerror = () => setError("Logo upload failed.");
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await saveSettings(form);
      setMessage("Settings saved successfully");
    } catch (err) {
      setError(err.response?.data?.message || "Settings save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBackup = async () => {
    setBackupMessage("");
    setBackupError("");

    try {
      const resp = await createBackup();
      const data = resp.data;
      const fileLocation = data?.filePath || data?.fileLocation;

      setBackupMessage(
        `Backup created: ${data?.filename || todayFilename()}\nLocation: ${fileLocation || "(unknown)"}`,
      );
    } catch (e) {
      setBackupError(e?.response?.data?.message || e?.message || "Backup create failed.");
    }
  };

  const handleRestoreBackup = async (file) => {
    setBackupMessage("");
    setBackupError("");

    if (!file) return;

    try {
      if (!String(file.name || "").toLowerCase().endsWith(".zip")) {
        throw new Error("Please select a .zip backup file.");
      }

      await restoreBackup(file);

      window.location.reload();

      setBackupMessage("Backup restored successfully.");
    } catch (e) {
      setBackupError(e?.response?.data?.message || e?.message || "Backup restore failed.");
    }
  };

  if (loading) {
    return <div className="page-loading">Loading settings...</div>;
  }

  return (
    <div className="page-settings">
      <div className="section-header">
        <div>
          <h2>Settings</h2>
          <p>Shop information and backup/restore.</p>
        </div>
      </div>

      <div className="message-row">
        {message && <p className="message success">{message}</p>}
        {error && <p className="message error">{error}</p>}
      </div>

      <div style={{ marginBottom: 12 }}>
        <button type="button" className="button secondary small" onClick={async () => {
          setError("");
          try {
            await window.electronAPI?.update?.check?.();
          } catch (e) {
            setError(e?.message || "Update check failed");
          }
        }}>
          Check for Updates
        </button>
      </div>

      <div className="settings-grid">
        {/* SECTION 1: Shop Information */}
        <div className="collapsible-card">
          <div className="collapsible-header" onClick={() => setShopInfoOpen((prev) => !prev)}>
            <h3>Shop Information</h3>
            <FaChevronDown className={`collapsible-icon ${shopInfoOpen ? "open" : ""}`} />
          </div>
          <div className={`collapsible-body ${shopInfoOpen ? "" : "collapsed"}`}>
            <form onSubmit={handleSubmit}>
              <label>
                Shop Name
                <input
                  value={form.shopName}
                  onChange={(e) => handleChange("shopName", e.target.value)}
                  required
                />
              </label>

              <label>
                Owner Name
                <input
                  value={form.ownerName}
                  onChange={(e) => handleChange("ownerName", e.target.value)}
                />
              </label>

              <label>
                Phone Number
                <input
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  required
                />
              </label>

              <label>
                Address
                <textarea
                  value={form.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  required
                />
              </label>

              <label>
                Currency
                <input
                  value={form.currency}
                  onChange={(e) => handleChange("currency", e.target.value)}
                  placeholder="PKR"
                />
              </label>

              <label>
                Shop Logo
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                />
              </label>

              <label>
                Customer Serial Starting Number
                <input
                  value={form.customerSerialStart}
                  onChange={(e) => handleChange("customerSerialStart", e.target.value)}
                  placeholder="1000"
                />
              </label>

              <label>
                Order Number Starting Point
                <input
                  value={form.orderNumberStartingPoint}
                  onChange={(e) => handleChange("orderNumberStartingPoint", e.target.value)}
                  placeholder="5000"
                />
              </label>

              <div className="modal-actions">
                <button type="submit" className="button primary" disabled={saving}>

                  {saving ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* SECTION 2: Recycle Bin */}
        <div className="collapsible-card">
          <div className="collapsible-header" onClick={() => setRecycleBinOpen((prev) => !prev)}>
            <h3>Recycle Bin</h3>
            <FaChevronDown className={`collapsible-icon ${recycleBinOpen ? "open" : ""}`} />
          </div>
          <div className={`collapsible-body ${recycleBinOpen ? "" : "collapsed"}`}>
            <RecycleBinSection />
          </div>
        </div>

        {/* SECTION 3: Backup & Restore */}
        <div className="collapsible-card">
          <div className="collapsible-header" onClick={() => setOrdersApiOpen((prev) => !prev)}>
            <h3>External Orders API</h3>
            <FaChevronDown className={`collapsible-icon ${ordersApiOpen ? "open" : ""}`} />
          </div>
          <div className={`collapsible-body ${ordersApiOpen ? "" : "collapsed"}`}>
            <p>Use this store-scoped key to accept orders from your website.</p>
            <label>
              API key
              <div style={{ display: "flex", gap: 8 }}>
                <input value={ordersApiKey} readOnly placeholder="Generate an Orders API key" />
                {ordersApiKey && <button type="button" className="button secondary" onClick={() => copyText(ordersApiKey, "API key")}>Copy</button>}
              </div>
            </label>
            <label>
              Endpoint
              <div style={{ display: "flex", gap: 8 }}>
                <input value={ordersApiEndpoint} readOnly />
                <button type="button" className="button secondary" onClick={() => copyText(ordersApiEndpoint, "Endpoint")}>Copy</button>
              </div>
            </label>
            <p>Use <code>GET {ordersApiEndpoint}/ORDER_ID</code> with <code>X-API-Key</code> to retrieve an order as JSON. To create an order, use POST with the required customer and order fields.</p>
            <button type="button" className="button secondary" onClick={generateOrdersApiKey}>Generate new key</button>
            {apiKeyMessage && <p className="message success">{apiKeyMessage}</p>}
            {apiKeyError && <p className="message error">{apiKeyError}</p>}
          </div>
        </div>

        {/* SECTION 4: Backup & Restore */}
        <div className="collapsible-card">
          <div className="collapsible-header" onClick={() => setBackupRestoreOpen((prev) => !prev)}>
            <h3>Backup &amp; Restore</h3>
            <FaChevronDown className={`collapsible-icon ${backupRestoreOpen ? "open" : ""}`} />
          </div>
          <div className={`collapsible-body ${backupRestoreOpen ? "" : "collapsed"}`}>
            <div className="settings-right-section">

              <div className="section-divider" />

              <div className="modal-actions">
                <button type="button" className="button secondary" onClick={handleCreateBackup}>
                  Create Backup
                </button>

                <button
                  type="button"
                  className="button secondary"
                  onClick={() => document.getElementById("backup-restore-input")?.click()}
                >
                  Restore Backup
                </button>

                <input
                  id="backup-restore-input"
                  type="file"
                  accept=".zip"
                  style={{ display: "none" }}
                  onChange={(e) => handleRestoreBackup(e.target.files?.[0])}
                />
              </div>

              {backupMessage && (
                <p className="message success" style={{ whiteSpace: "pre-line" }}>
                  {backupMessage}
                </p>
              )}
              {backupError && <p className="message error">{backupError}</p>}

              <div className="section-divider" />

              <div className="backup-guide">
                <h4>Backup Guide</h4>

                <div className="backup-guide-box">
                  <h5>ENGLISH</h5>
                  <p>How to keep your data safe:</p>
                  <ol>
                    <li>Click Create Backup.</li>
                    <li>Save the ZIP file.</li>
                    <li>
                      Upload the ZIP file to your Google Drive manually.
                    </li>
                    <li>
                      If your computer is damaged or changed:
                      <ul>
                        <li>Install Tailor Hub again.</li>
                        <li>Download the ZIP from Google Drive.</li>
                        <li>Click Restore Backup.</li>
                        <li>Select the ZIP file.</li>
                        <li>All customers, measurements, orders and settings will be restored.</li>
                      </ul>
                    </li>
                  </ol>
                </div>

                <div className="backup-guide-box">
                  <h5>URDU</h5>
                  <p>Ø§Ù¾Ù†Ø§ ÚˆÛŒÙ¹Ø§ Ù…Ø­ÙÙˆØ¸ Ø±Ú©Ú¾Ù†Û’ Ú©Ø§ Ø·Ø±ÛŒÙ‚Û:</p>
                  <ol>
                    <li>"Create Backup" Ù¾Ø± Ú©Ù„Ú© Ú©Ø±ÛŒÚºÛ”</li>
                    <li>ZIP ÙØ§Ø¦Ù„ Ù…Ø­ÙÙˆØ¸ Ú©Ø±ÛŒÚºÛ”</li>
                    <li>
                      Ø§Ø³ ZIP ÙØ§Ø¦Ù„ Ú©Ùˆ Ø§Ù¾Ù†Û’ Google Drive Ù…ÛŒÚº Ø§Ù¾ Ù„ÙˆÚˆ Ú©Ø±ÛŒÚºÛ”
                    </li>
                    <li>
                      Ø§Ú¯Ø± Ú©Ù…Ù¾ÛŒÙˆÙ¹Ø± Ø®Ø±Ø§Ø¨ ÛÙˆ Ø¬Ø§Ø¦Û’ ÛŒØ§ Ù†ÛŒØ§ Ú©Ù…Ù¾ÛŒÙˆÙ¹Ø± Ø§Ø³ØªØ¹Ù…Ø§Ù„ Ú©Ø±ÛŒÚº:
                      <ul>
                        <li>Tailor Hub Ø¯ÙˆØ¨Ø§Ø±Û Ø§Ù†Ø³Ù¹Ø§Ù„ Ú©Ø±ÛŒÚºÛ”</li>
                        <li>Google Drive Ø³Û’ Backup ZIP ÚˆØ§Ø¤Ù† Ù„ÙˆÚˆ Ú©Ø±ÛŒÚºÛ”</li>
                        <li>Restore Backup Ù¾Ø± Ú©Ù„Ú© Ú©Ø±ÛŒÚºÛ”</li>
                        <li>ZIP ÙØ§Ø¦Ù„ Ù…Ù†ØªØ®Ø¨ Ú©Ø±ÛŒÚºÛ”</li>
                        <li>ØªÙ…Ø§Ù… Ú¯Ø§ÛÚ©ØŒ Ù…ÛŒØ¬Ø±Ù…Ù†Ù¹Ø³ØŒ Ø¢Ø±ÚˆØ±Ø² Ø§ÙˆØ± Ø³ÛŒÙ¹Ù†Ú¯Ø² ÙˆØ§Ù¾Ø³ Ø¨Ø­Ø§Ù„ ÛÙˆ Ø¬Ø§Ø¦ÛŒÚº Ú¯ÛŒÛ”</li>
                      </ul>
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION: Supabase Database Configuration (Danger Zone) */}
        <div className="collapsible-card" style={{ marginTop: 16, border: "1px solid var(--danger)", borderRadius: 8 }}>
          <div className="collapsible-header" onClick={() => setSupabaseOpen((prev) => !prev)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FaDatabase style={{ color: "var(--danger)" }} />
            <h3 style={{ margin: 0, color: "var(--danger)" }}>Supabase Database Configuration</h3>
          </div>
          <div className={supabaseOpen ? "collapsible-body" : "collapsible-body collapsed"} style={{ padding: "1rem" }}>
            <p style={{ fontSize: "0.9rem", color: "var(--muted)", marginBottom: 12 }}>
              {supabaseConfig && supabaseConfig.has_personal_db ? "Your account uses your own Supabase project for business data." : "Your account uses the central TMS Supabase database."}
            </p>

            {supabaseConfig?.config && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 4 }}>Project URL</label>
                  <input
                    readOnly
                    value={supabaseConfig.config.project_url || ""}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: 6, border: "1px solid var(--border)", fontSize: "0.85rem" }}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 4 }}>Connection Status</label>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.85rem", fontWeight: 600, color: supabaseConfig.config.status === "verified" ? "var(--success)" : "var(--danger)" }}>
                    {supabaseConfig.config.status === "verified" ? "â— Verified" : "â— " + String(supabaseConfig.config.status || "unknown").charAt(0).toUpperCase() + String(supabaseConfig.config.status || "unknown").slice(1)}
                  </span>
                </div>
                {supabaseConfig.config.anon_key_masked && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 4 }}>Anon Key (masked)</label>
                    <input
                      readOnly
                      value={supabaseConfig.config.anon_key_masked}
                      style={{ width: "100%", padding: "0.5rem", borderRadius: 6, border: "1px solid var(--border)", fontSize: "0.85rem", fontFamily: "monospace" }}
                    />
                    <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>
                      Key is encrypted at rest. Full value is never shown.
                    </p>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="button secondary" onClick={handleTestSupabaseConnection} disabled={testingConnection || supabaseLoading}>
                    {testingConnection ? "Testing..." : "Test Connection"}
                  </button>
                  <button type="button" className="button secondary" style={{ color: "var(--danger)" }} onClick={handleDisconnectSupabase} disabled={supabaseLoading}>
                    {supabaseLoading ? "..." : "Disconnect Project"}
                  </button>
                </div>
                {supabaseError && <p className="message error" style={{ marginTop: 8, fontSize: "0.85rem" }}>{supabaseError}</p>}
                {supabaseMessage && <p className="message success" style={{ marginTop: 8, fontSize: "0.85rem" }}>{supabaseMessage}</p>}
              </>
            )}

            {!supabaseConfig?.has_personal_db && (
              <form onSubmit={handleSaveSupabaseConfig} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Connection String (Session Pooler URI)</span>
                  <input
                    type="text"
                    value={connString}
                    onChange={(e) => setConnString(e.target.value)}
                    placeholder="postgresql://user:password@host:5432/postgres"
                    style={{ padding: "0.5rem 0.75rem", borderRadius: 6, border: "1px solid var(--border)", fontFamily: "monospace", fontSize: "0.85rem" }}
                  />
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Host</span>
                    <input type="text" value={connHost} onChange={(e) => setConnHost(e.target.value)} placeholder="aws-...pooler.supabase.com" style={{ padding: "0.5rem 0.75rem", borderRadius: 6, border: "1px solid var(--border)" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Port</span>
                    <input type="text" value={connPort} onChange={(e) => setConnPort(e.target.value)} placeholder="5432" style={{ padding: "0.5rem 0.75rem", borderRadius: 6, border: "1px solid var(--border)" }} />
                  </label>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Database</span>
                    <input type="text" value={connDatabase} onChange={(e) => setConnDatabase(e.target.value)} placeholder="postgres" style={{ padding: "0.5rem 0.75rem", borderRadius: 6, border: "1px solid var(--border)" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Username</span>
                    <input type="text" value={connUsername} onChange={(e) => setConnUsername(e.target.value)} placeholder="postgres.xxx" style={{ padding: "0.5rem 0.75rem", borderRadius: 6, border: "1px solid var(--border)" }} />
                  </label>
                </div>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Password</span>
                  <input type="password" value={connPassword} onChange={(e) => setConnPassword(e.target.value)} placeholder="••••••••" style={{ padding: "0.5rem 0.75rem", borderRadius: 6, border: "1px solid var(--border)" }} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>SSL Mode</span>
                  <select value={sslMode} onChange={(e) => setSslMode(e.target.value)} style={{ padding: "0.5rem 0.75rem", borderRadius: 6, border: "1px solid var(--border)" }}>
                    <option value="no-verify">Require SSL (no verify)</option>
                    <option value="require">Require SSL (verify)</option>
                    <option value="disable">Disable SSL</option>
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Project URL (optional)</span>
                  <input type="url" value={newProjectUrl} onChange={(e) => setNewProjectUrl(e.target.value)} placeholder="https://your-project.supabase.co" style={{ padding: "0.5rem 0.75rem", borderRadius: 6, border: "1px solid var(--border)" }} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Anon Key (optional)</span>
                  <input type="text" value={newAnonKey} onChange={(e) => setNewAnonKey(e.target.value)} placeholder="eyJ..." style={{ padding: "0.5rem 0.75rem", borderRadius: 6, border: "1px solid var(--border)", fontFamily: "monospace", fontSize: "0.85rem" }} />
                </label>
                {supabaseError && <p className="message error" style={{ margin: 0, fontSize: "0.85rem" }}>{supabaseError}</p>}
                {supabaseMessage && <p className="message success" style={{ margin: 0, fontSize: "0.85rem" }}>{supabaseMessage}</p>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="button secondary" onClick={handleTestSupabaseConnection} disabled={testingConnection || supabaseLoading}>
                    {testingConnection ? "Testing..." : "Test Connection"}
                  </button>
                  <button type="submit" className="button primary" disabled={supabaseLoading}>
                    {supabaseLoading ? "Saving..." : "Connect Project"}
                  </button>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>
                  New users connect their own Supabase project via Session Pooler. Credentials are encrypted before storage.
                </p>
              </form>
            )}
          </div>
        </div>

        {/* SECTION: Print Settings (measurement-slip paper, margins, fonts) */}
        <PrintSettingsSection />

        <div className="collapsible-card" style={{ marginTop: 16 }}>
          <div className="collapsible-header" onClick={() => setAccountOpen((prev) => !prev)}>
            <h3>Account</h3>
            <FaChevronDown className={`collapsible-icon ${accountOpen ? "open" : ""}`} />
          </div>
          <div className={`collapsible-body ${accountOpen ? "" : "collapsed"}`}>
            <AccountSection />
          </div>
        </div>

        <ProfessionalFooter />


      </div>
    </div>
  );
}

function AccountSection() {
  const { user, logout } = useAuth();
  const { shop } = useShop();
  const [loggingOut, setLoggingOut] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    setPasswordMessage("");
    setPasswordError("");
    if (newPassword.length < 6) return setPasswordError("New password must be at least 6 characters.");
    if (newPassword !== confirmPassword) return setPasswordError("New password and confirmation do not match.");
    setPasswordSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordMessage("Password updated successfully. Other signed-in sessions have been logged out.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (error) {
      setPasswordError(error.response?.data?.message || "Password update failed.");
    } finally { setPasswordSaving(false); }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch (_) {}
  };

  if (!user) return null;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2 }}>Name</div>
          <div style={{ fontWeight: 600 }}>{user.user?.name || "-"}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2 }}>Email</div>
          <div style={{ fontWeight: 600, direction: "ltr", textAlign: "left" }}>{user.user?.email || "-"}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2 }}>Role</div>
          <div style={{ fontWeight: 600, textTransform: "capitalize" }}>{user.user?.role || "-"}</div>
        </div>
        {shop && (
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2 }}>Shop</div>
            <div style={{ fontWeight: 600 }}>{shop.name}</div>
          </div>
        )}
      </div>

      <form onSubmit={handlePasswordChange} style={{ display: "grid", gap: 10, maxWidth: 480 }}>
        <h4 style={{ margin: "8px 0 0" }}>Change Password</h4>
        <label className="form-field"><span>Current password</span><input type="password" autoComplete="current-password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></label>
        <label className="form-field"><span>New password</span><input type="password" autoComplete="new-password" minLength={6} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label>
        <label className="form-field"><span>Confirm new password</span><input type="password" autoComplete="new-password" minLength={6} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></label>
        {passwordMessage && <p className="message success">{passwordMessage}</p>}
        {passwordError && <p className="message error">{passwordError}</p>}
        <button type="submit" className="button primary" disabled={passwordSaving}>{passwordSaving ? "Updating..." : "Update Password"}</button>
      </form>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="button secondary" onClick={handleLogout} disabled={loggingOut}>
          <FaSignOutAlt style={{ marginRight: 6 }} />
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </div>
  );
}





