import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Navbar from "./components/Navbar.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Customers from "./pages/Customers.jsx";
import Orders from "./pages/Orders.jsx";
import Measurements from "./pages/Measurements.jsx";
import Budget from "./pages/Budget.jsx";
import Setup from "./pages/Setup.jsx";
import Settings from "./pages/Settings.jsx";
import UpdateNotification from "./components/UpdateNotification.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import { useAuth } from "./contexts/AuthContext.jsx";
import { useShop } from "./contexts/ShopContext.jsx";
import { getShopInfo } from "./services/api";

export default function App() {
  const { user, loading: authLoading, logout } = useAuth();
  const { shop, clearShop, setShop } = useShop();
  const [shopLoading, setShopLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [cloudUnavailable, setCloudUnavailable] = useState(false);

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  useEffect(() => {
    if (user) {
      setShopLoading(true);
      getShopInfo()
        .then((res) => {
          setShop(res.data || null);
        setCloudUnavailable(false);
        if (res.data?.name && user.user?.store_id) {
          localStorage.setItem(`tms_shop_${user.user.store_id}`, JSON.stringify(res.data));
        }
      })
      .catch((error) => {
        if (!error.response) {
          const cached = localStorage.getItem(`tms_shop_${user.user?.store_id}`);
          setShop(cached ? JSON.parse(cached) : { name: "Offline mode" });
          setCloudUnavailable(true);
        } else {
          setShop(null);
        }
      })
        .finally(() => setShopLoading(false));
    } else {
      clearShop();
    }
  }, [user, setShop, clearShop]);

  if (authLoading || shopLoading) {
    return <div className="page-loading">Loading...</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (!shop) {
    return <Setup />;
  }

  return (
    <div className="app-shell">
      {(!isOnline || cloudUnavailable) && (
        <div className="message error" role="status">
          Internet connection required. Please turn on your internet connection to load and sync your account data.
        </div>
      )}
      <Navbar />
      <main className="page-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/measurements" element={<Measurements />} />
          <Route path="/budget" element={<Budget />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/setup" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          <Route path="/register" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </main>
      <UpdateNotification />
    </div>
  );
}
