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
import ResetPassword from "./pages/ResetPassword.jsx";
import { useAuth } from "./contexts/AuthContext.jsx";
import { useShop } from "./contexts/ShopContext.jsx";
import { getShopInfo, reconnectUserSupabase } from "./services/api";

const PERSONAL_DB_MESSAGE = "Your Supabase database is not reachable yet. If you just resumed it, wait a few minutes and press Retry.";

export default function App() {
  const { user, loading: authLoading, logout } = useAuth();
  const { shop, clearShop, setShop } = useShop();
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [cloudUnavailable, setCloudUnavailable] = useState(false);
  const [personalDbUnavailable, setPersonalDbUnavailable] = useState(false);
  const [personalDbMessage, setPersonalDbMessage] = useState(PERSONAL_DB_MESSAGE);
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    const unavailable = (event) => {
      setPersonalDbMessage(event?.detail?.message || PERSONAL_DB_MESSAGE);
      setPersonalDbUnavailable(true);
    };
    window.addEventListener("tms-personal-db-unavailable", unavailable);
    return () => window.removeEventListener("tms-personal-db-unavailable", unavailable);
  }, []);

  useEffect(() => {
    if (!personalDbUnavailable || !user) return undefined;
    const timer = setInterval(() => {
      reconnectUserSupabase().then((result) => {
        if (result.data?.ok) {
          setPersonalDbUnavailable(false);
          window.dispatchEvent(new CustomEvent("tms-personal-db-recovered"));
          window.location.reload();
        }
      }).catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [personalDbUnavailable, user]);

  const retryPersonalDatabase = async () => {
    setReconnecting(true);
    try {
      const result = await reconnectUserSupabase();
      if (result.data?.ok) {
        setPersonalDbUnavailable(false);
        window.dispatchEvent(new CustomEvent("tms-personal-db-recovered"));
        window.location.reload();
      }
    } catch (_) {
      setPersonalDbUnavailable(true);
    } finally {
      setReconnecting(false);
    }
  };

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
      if (user.user?.personal_store_id) setShop((current) => current || { name: "Your Shop" });
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
          const userId = user?.user?.id;
          const skipped = userId && localStorage.getItem("tms_shop_skipped_" + userId);
          setShop(skipped ? { skipped: true, name: "Pending setup" } : { name: "Your Shop" });
        }
      });
    } else {
      clearShop();
    }
  }, [user, setShop, clearShop]);

  if (authLoading) {
    return <div className="page-loading">Loading...</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (!shop) {
    return (
      <div className="app-shell">
        <main className="page-content">
          <Routes>
            <Route path="/settings" element={<Settings />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="*" element={<Setup />} />
          </Routes>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {(!isOnline || cloudUnavailable) && (
        <div className="message error" role="status">
          Internet connection required. Please turn on your internet connection to load and sync your account data.
        </div>
      )}
      <Navbar user={user} onLogout={logout} />
      <main className="page-content app-main">
        {personalDbUnavailable && <div className="personal-db-banner" role="status"><span>{personalDbMessage}</span><button className="button secondary small" onClick={retryPersonalDatabase} disabled={reconnecting}>{reconnecting ? "Retrying..." : "Retry connection"}</button></div>}
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
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </main>
      <UpdateNotification />
    </div>
  );
}
