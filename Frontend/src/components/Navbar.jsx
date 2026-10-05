import { NavLink } from "react-router-dom";
import { useState } from "react";
import { FaHome, FaUsers, FaClipboardList, FaRuler, FaChartBar, FaCog } from "react-icons/fa";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="navbar sticky-navbar">
      <div className="brand">
        <div className="brand-icon">✂️</div>
        <div>
          <h1>Tailor Hub</h1>
          <p>Customer / Measurement / Order dashboard</p>
        </div>
      </div>

      <button
        type="button"
        className="mobile-menu-button"
        aria-expanded={menuOpen}
        aria-controls="store-navigation"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span aria-hidden="true">{menuOpen ? "✕" : "☰"}</span>
        <span>{menuOpen ? "Close menu" : "Open menu"}</span>
      </button>

      <nav id="store-navigation" className={`nav-links ${menuOpen ? "open" : ""}`}>
        <NavLink to="/dashboard" onClick={closeMenu} className={({ isActive }) => (isActive ? "active" : "")}>
          <FaHome /> Dashboard
        </NavLink>
        <NavLink to="/customers" onClick={closeMenu} className={({ isActive }) => (isActive ? "active" : "")}>
          <FaUsers /> Customers
        </NavLink>
        <NavLink to="/orders" onClick={closeMenu} className={({ isActive }) => (isActive ? "active" : "")}>
          <FaClipboardList /> Orders
        </NavLink>
        <NavLink to="/measurements" onClick={closeMenu} className={({ isActive }) => (isActive ? "active" : "")}>
          <FaRuler /> Measurements
        </NavLink>
        <NavLink to="/budget" onClick={closeMenu} className={({ isActive }) => (isActive ? "active" : "")}>
          <FaChartBar /> Budget
        </NavLink>
        <NavLink to="/settings" onClick={closeMenu} className={({ isActive }) => (isActive ? "active" : "")}>
          <FaCog /> Settings
        </NavLink>
      </nav>
    </header>
  );
}
