import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getStoreById, updateStoreStatus } from "../services/api";

export default function StoreDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStore();
  }, [id]);

  const loadStore = async () => {
    try {
      const res = await getStoreById(id);
      setStore(res.data?.data);
    } catch (err) {
      console.error("Failed to load store:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await updateStoreStatus(id, newStatus);
      loadStore();
    } catch (err) {
      alert(err.friendlyMessage || "Failed to update status");
    }
  };

  if (loading) {
    return <div className="loading">Loading store details...</div>;
  }

  if (!store) {
    return <div className="empty-state">Store not found</div>;
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1>{store.store.name}</h1>
        <button className="btn-sm" onClick={() => navigate("/stores")}>
          ← Back to Stores
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        <div className="card">
          <h2>Store Information</h2>
          <div style={{ display: "grid", gap: "12px" }}>
            <div>
              <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Store Name</div>
              <div style={{ fontWeight: 600 }}>{store.store.name}</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Slug</div>
              <div style={{ fontFamily: "monospace", fontSize: "13px" }}>{store.store.slug}</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Status</div>
              <span className={`badge badge-${store.store.status}`}>{store.store.status}</span>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Registration Date</div>
              <div>{formatDate(store.store.created_at)}</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Last Activity</div>
              <div>{formatDate(store.store.last_activity_at)}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Owner Information</h2>
          {store.owner ? (
            <div style={{ display: "grid", gap: "12px" }}>
              <div>
                <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Name</div>
                <div style={{ fontWeight: 600 }}>{store.owner.name}</div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Email</div>
                <div>{store.owner.email}</div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Role</div>
                <div style={{ textTransform: "capitalize" }}>{store.owner.role}</div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Created</div>
                <div>{formatDate(store.owner.created_at)}</div>
              </div>
            </div>
          ) : (
            <div className="empty-state">No owner information available</div>
          )}
        </div>

        <div className="card">
          <h2>Statistics</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Customers</div>
              <div style={{ fontSize: "24px", fontWeight: 700 }}>{store.stats.customer_count}</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Orders</div>
              <div style={{ fontSize: "24px", fontWeight: 700 }}>{store.stats.order_count}</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Measurements</div>
              <div style={{ fontSize: "24px", fontWeight: 700 }}>{store.stats.measurement_count}</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Users</div>
              <div style={{ fontSize: "24px", fontWeight: 700 }}>{store.stats.user_count}</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Active API Keys</div>
              <div style={{ fontSize: "24px", fontWeight: 700 }}>{store.stats.active_api_keys}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Store Status</h2>
          <p style={{ color: "#94a3b8", marginBottom: "16px", fontSize: "14px" }}>
            Changing the store status will affect the store's ability to access the system.
          </p>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className={`btn-sm ${store.store.status === "active" ? "active" : ""}`}
              onClick={() => handleStatusChange("active")}
              style={store.store.status === "active" ? { background: "#059669", color: "white", border: "none" } : {}}
            >
              Activate
            </button>
            <button
              className={`btn-sm ${store.store.status === "suspended" ? "active" : ""}`}
              onClick={() => handleStatusChange("suspended")}
              style={store.store.status === "suspended" ? { background: "#d97706", color: "white", border: "none" } : {}}
            >
              Suspend
            </button>
            <button
              className={`btn-sm ${store.store.status === "disabled" ? "active" : ""}`}
              onClick={() => handleStatusChange("disabled")}
              style={store.store.status === "disabled" ? { background: "#dc2626", color: "white", border: "none" } : {}}
            >
              Disable
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
