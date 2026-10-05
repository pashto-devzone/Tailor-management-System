import { useEffect, useMemo, useState } from "react";
import {
  cleanupRecycleBin,
  deleteRecycleBinItemForever,
  getRecycleBin,
  restoreRecycleBinItem,
} from "../services/api";

const MAX_DAYS = 30;

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString();
}

function daysRemainingLabel(days) {
  if (days == null) return "-";
  const n = Number(days);
  if (!Number.isFinite(n)) return "-";
  return n === 0 ? "⚠ 0 Days Remaining" : `⚠ ${n} Days Remaining`;
}

export default function RecycleBinSection() {
  const [tab, setTab] = useState("customers");
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      // Backend route is mounted at /api, controller expects query: type|filter|q
      const res = await getRecycleBin({ type: tab, filter, q });

      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Recycle bin load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, filter]);

  const warningCount = useMemo(() => {
    return rows.filter((r) => Number(r.days_remaining) <= 5).length;
  }, [rows]);

  const handleRestore = async (type, id) => {
    setMessage("");
    setError("");
    try {
      await restoreRecycleBinItem(type, id);
      setMessage("Restored successfully");
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Restore failed");
    }
  };

  const handleDeleteForever = async (type, id) => {
    const ok = window.confirm("Delete permanently? This cannot be undone.");
    if (!ok) return;

    setMessage("");
    setError("");
    try {
      await deleteRecycleBinItemForever(type, id);
      setMessage("Deleted forever");
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Permanent delete failed");
    }
  };

  return (
    <div className="card form-card">
      <h3 style={{ marginTop: 0 }}>🗑️ Recycle Bin</h3>

      <div className="recycle-tabs" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className={tab === "customers" ? "button primary small" : "button secondary small"} onClick={() => setTab("customers")}>Customers</button>
        <button className={tab === "measurements" ? "button primary small" : "button secondary small"} onClick={() => setTab("measurements")}>Measurements</button>
        <button className={tab === "orders" ? "button primary small" : "button secondary small"} onClick={() => setTab("orders")}>Orders</button>
      </div>

      <div style={{ height: 10 }} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 10 }}>
        <label>
          Search
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Customer name / phone or Order #" onKeyDown={(e) => { if (e.key === "Enter") load(); }} />
        </label>

        <label>
          Filter
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="customers">Customers</option>
            <option value="measurements">Measurements</option>
            <option value="orders">Orders</option>
          </select>
        </label>
      </div>

      {warningCount > 0 ? (
        <p className="message error" style={{ marginTop: 10 }}>
          {warningCount} items will be permanently deleted within 5 days.
        </p>
      ) : null}

      <div style={{ marginTop: 14 }}>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Delete Date</th>
                  <th>Days Remaining</th>
                  <th>Type</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center" }}>No deleted records found.</td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const days = Number(r.days_remaining);
                    const isWarn = Number.isFinite(days) && days <= 5;
                    const typeKey = r.type === "Customer" ? "customers" : r.type === "Measurement" ? "measurements" : "orders";

                    return (
                      <tr key={`${r.type}-${r.id}`} style={isWarn ? { color: "#b42318" } : undefined}>
                        <td>{r.name || "-"}</td>
                        <td>{formatDate(r.deleted_at)}</td>
                        <td>{isWarn ? daysRemainingLabel(days) : (Number.isFinite(days) ? `${days} Days Remaining` : "-")}</td>
                        <td>{r.type}</td>
                        <td>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button className="button primary small" onClick={() => handleRestore(typeKey, r.id)}>Restore</button>
                            <button className="button danger small" onClick={() => handleDeleteForever(typeKey, r.id)}>Delete Forever</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="button secondary small" onClick={async () => { await cleanupRecycleBin(); await load(); }}>
          Cleanup Expired
        </button>
      </div>

      {message ? <p className="message success">{message}</p> : null}
      {error ? <p className="message error">{error}</p> : null}
    </div>
  );
}

