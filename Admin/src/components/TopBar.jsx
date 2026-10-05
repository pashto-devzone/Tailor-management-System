import { useAdminAuth } from "../contexts/AdminAuthContext";

export default function TopBar() {
  const { admin, logout } = useAdminAuth();

  if (!admin) return null;

  const initials = admin.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="top-bar">
      <h1>Admin Panel</h1>
      <div className="top-bar-right">
        <div className="admin-info">
          <div className="admin-avatar">{initials}</div>
          <span>{admin.name}</span>
        </div>
        <button className="btn-logout" onClick={logout}>
          Logout
        </button>
      </div>
    </header>
  );
}
