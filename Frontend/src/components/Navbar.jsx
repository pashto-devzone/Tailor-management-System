import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { FaHome, FaUsers, FaClipboardList, FaRuler, FaChartBar, FaCog, FaCut, FaSignOutAlt, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { appInfo } from "../constants/appInfo.js";

export default function Navbar({ user, onLogout }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem("tms_sidebar_collapsed");
      return saved == null ? window.innerWidth < 1000 : saved === "true";
    } catch { return window.innerWidth < 1000; }
  });
  useEffect(() => {
    try { localStorage.setItem("tms_sidebar_collapsed", String(collapsed)); } catch {}
  }, [collapsed]);
  const name = user?.user?.name || user?.user?.full_name || user?.user?.email || "Shop Owner";
  const links = [
    ["/dashboard", "Dashboard", FaHome], ["/customers", "Customers", FaUsers],
    ["/orders", "Orders", FaClipboardList], ["/measurements", "Measurements", FaRuler],
    ["/budget", "Budget", FaChartBar], ["/settings", "Settings", FaCog],
  ];
  return (
    <aside className={`app-sidebar${collapsed ? " is-collapsed" : ""}`}>
      <div className="sidebar-brand-row">
        <div className="brand-icon"><FaCut /></div>
        {!collapsed && <div className="sidebar-brand"><strong>Tailor Hub</strong><span>Shop Manager</span></div>}
        <button type="button" className="sidebar-toggle" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed((value) => !value)}>{collapsed ? <FaChevronRight /> : <FaChevronLeft />}</button>
      </div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {links.map(([to, label, Icon]) => <NavLink key={to} to={to} title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined} className={({ isActive }) => isActive ? "active" : ""}><Icon /><span>{label}</span></NavLink>)}
      </nav>
      <div className="sidebar-account">
        <div className="sidebar-avatar" title={name}>{String(name).trim().charAt(0).toUpperCase()}</div>
        {!collapsed && <div className="sidebar-account-copy"><strong>{name}</strong><span>v{appInfo.version} · Owner</span></div>}
        <button type="button" className="sidebar-logout" title="Logout" aria-label="Logout" onClick={onLogout}><FaSignOutAlt /></button>
      </div>
    </aside>
  );
}
