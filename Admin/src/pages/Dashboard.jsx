import { useState, useEffect } from "react";
import { getDashboardStats } from "../services/api";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await getDashboardStats();
      setStats(res.data?.data);
    } catch (err) {
      console.error("Failed to load stats:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (!stats) {
    return <div className="empty-state">Failed to load dashboard statistics</div>;
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div>
      <h1 style={{ marginBottom: "24px" }}>Dashboard</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Stores</h3>
          <div className="value">{stats.totalStores}</div>
          <div className="change">{stats.activeStores} active</div>
        </div>
        <div className="stat-card">
          <h3>Total Users</h3>
          <div className="value">{stats.totalUsers}</div>
          <div className="change">Store users</div>
        </div>
        <div className="stat-card">
          <h3>Total Customers</h3>
          <div className="value">{stats.totalCustomers}</div>
          <div className="change">Across all stores</div>
        </div>
        <div className="stat-card">
          <h3>Total Orders</h3>
          <div className="value">{stats.totalOrders}</div>
          <div className="change">All time</div>
        </div>
        <div className="stat-card">
          <h3>Total Revenue</h3>
          <div className="value">{formatCurrency(stats.totalRevenue)}</div>
          <div className="change">Paid orders</div>
        </div>
        <div className="stat-card">
          <h3>Store Status</h3>
          <div className="value">
            {stats.suspendedStores > 0 || stats.disabledStores > 0 ? (
              <span style={{ color: "#f59e0b" }}>
                {stats.suspendedStores + stats.disabledStores} issues
              </span>
            ) : (
              <span style={{ color: "#10b981" }}>All healthy</span>
            )}
          </div>
          <div className="change">
            {stats.suspendedStores} suspended, {stats.disabledStores} disabled
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        <div className="card">
          <h2>Recent Stores</h2>
          {stats.recentStores?.length === 0 ? (
            <div className="empty-state">No stores yet</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentStores.map((store) => (
                  <tr key={store.id}>
                    <td>{store.name}</td>
                    <td>{store.owner_name}</td>
                    <td>
                      <span className={`badge badge-${store.status}`}>{store.status}</span>
                    </td>
                    <td>{new Date(store.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>Recent Orders</h2>
          {stats.recentOrders?.length === 0 ? (
            <div className="empty-state">No orders yet</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Store</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentOrders.map((order) => (
                  <tr key={order.order_number}>
                    <td>{order.order_number}</td>
                    <td>{order.store_name}</td>
                    <td>{order.status}</td>
                    <td>{new Date(order.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
