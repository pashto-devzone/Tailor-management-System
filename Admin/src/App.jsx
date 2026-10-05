import { Routes, Route, Navigate } from "react-router-dom";
import { useAdminAuth } from "./contexts/AdminAuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Stores from "./pages/Stores";
import StoreDetail from "./pages/StoreDetail";
import Users from "./pages/Users";
import Activity from "./pages/Activity";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";

export default function App() {
  const { admin, loading } = useAdminAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!admin) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="main-content">
        <TopBar />
        <div className="page-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/stores" element={<Stores />} />
            <Route path="/stores/:id" element={<StoreDetail />} />
            <Route path="/users" element={<Users />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
