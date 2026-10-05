import { NavLink } from "react-router-dom";
import { useAdminAuth } from "../contexts/AdminAuthContext";

export default function Sidebar() {
  const { admin, logout } = useAdminAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>TailorHub</h2>
        <span>Admin Panel</span>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
          <span>📊</span>
          Dashboard
        </NavLink>
        <NavLink to="/stores" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
          <span>🏪</span>
          Stores
        </NavLink>
        <NavLink to="/users" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
          <span>👥</span>
          Users
        </NavLink>
        <NavLink to="/activity" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
          <span>📋</span>
          Activity Log
        </NavLink>
      </nav>
      <div className="sidebar-footer">
        <button className="nav-item" onClick={handleLogout}>
          <span>🚪</span>
          Logout
        </button>
      </div>
    </aside>
  );
}
