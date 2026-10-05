import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getStores, updateStoreStatus } from "../services/api";

export default function Stores() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    loadStores();
  }, [search, statusFilter, sort, page]);

  const loadStores = async () => {
    setLoading(true);
    try {
      const res = await getStores({ search, status: statusFilter, sort, page, limit: 20 });
      setStores(res.data?.data?.stores || []);
      setTotal(res.data?.data?.pagination?.total || 0);
    } catch (err) {
      console.error("Failed to load stores:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await updateStoreStatus(id, newStatus);
      loadStores();
    } catch (err) {
      alert(err.friendlyMessage || "Failed to update status");
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <h1 style={{ marginBottom: "24px" }}>Store Management</h1>

      <div className="card">
        <div className="filters">
          <input
            type="text"
            placeholder="Search stores..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ minWidth: "250px" }}
          />
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="disabled">Disabled</option>
          </select>
          <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>

        {loading ? (
          <div className="loading">Loading stores...</div>
        ) : stores.length === 0 ? (
          <div className="empty-state">No stores found</div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Store Name</th>
                  <th>Owner</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Customers</th>
                  <th>Orders</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((store) => (
                  <tr key={store.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{store.name}</div>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>{store.slug}</div>
                    </td>
                    <td>{store.owner_name}</td>
                    <td>{store.owner_email}</td>
                    <td>
                      <span className={`badge badge-${store.status}`}>{store.status}</span>
                    </td>
                    <td>{store.customer_count}</td>
                    <td>{store.order_count}</td>
                    <td>{new Date(store.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="btn-sm" onClick={() => navigate(`/stores/${store.id}`)}>
                        View
                      </button>
                      <select
                        value={store.status}
                        onChange={(e) => handleStatusChange(store.id, e.target.value)}
                        style={{ padding: "4px 8px", fontSize: "12px" }}
                      >
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                        <option value="disabled">Disabled</option>
                      </select>
                    </td>
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
