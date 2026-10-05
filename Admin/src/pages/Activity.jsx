import { useState, useEffect } from "react";
import { getActivityLog } from "../services/api";

export default function Activity() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadLogs();
  }, [page]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await getActivityLog({ page, limit: 50 });
      setLogs(res.data?.data?.logs || []);
      setTotal(res.data?.data?.pagination?.total || 0);
    } catch (err) {
      console.error("Failed to load activity log:", err);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / 50);

  const formatAction = (action) => {
    return action
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div>
      <h1 style={{ marginBottom: "24px" }}>Activity Log</h1>

      <div className="card">
        {loading ? (
          <div className="loading">Loading activity log...</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">No activity recorded yet</div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Admin</th>
                  <th>Store</th>
                  <th>Target</th>
                  <th>Details</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td>
                      <span className="badge" style={{ background: "#334155", color: "#e2e8f0" }}>
                        {formatAction(log.action)}
                      </span>
                    </td>
                    <td>{log.admin_name}</td>
                    <td>{log.store_name}</td>
                    <td>
                      {log.target_type && (
                        <span>
                          {log.target_type}: {log.target_name || log.target_id}
                        </span>
                      )}
                    </td>
                    <td style={{ maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {log.details}
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{log.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "20px" }}>
                <button className="btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  Previous
                </button>
                <span style={{ padding: "8px", color: "#94a3b8" }}>
                  Page {page} of {totalPages}
                </span>
                <button className="btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
