import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useShop } from "../contexts/ShopContext";
import { useAuth } from "../contexts/AuthContext";

export default function Setup() {
  const { shop, loading, saveShop, setShop } = useShop();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (shop) {
      navigate("/dashboard", { replace: true });
    }
  }, [shop, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name || !phone || !address) {
      setError("Shop name, phone and address are required");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await saveShop({ name, phone, address });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err?.friendlyMessage || err?.response?.data?.message || "Error saving setup");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    setSkipping(true);
    setError("");
    try {
      const userId = user?.user?.id;
      if (userId) {
        localStorage.setItem(`tms_shop_skipped_${userId}`, "1");
      }
      setShop({ skipped: true, name: "Pending setup" });
      navigate("/dashboard", { replace: true });
    } finally {
      setSkipping(false);
    }
  };

  const handleBack = () => {
    navigate("/settings", { replace: true });
  };

  if (loading) {
    return <div className="page-loading">Loading setup...</div>;
  }

  return (
    <div className="page-setup">
      <div className="page-content">
        <div className="section-header">
          <div>
            <h2>Shop Setup</h2>
            <p>Set up your tailor shop. This is only needed once.</p>
          </div>
        </div>

        <div className="card setup-card">
          <form onSubmit={handleSubmit}>
            <label>
              Shop Name
              <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Shop name" />
            </label>
            <label>
              Phone Number
              <input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="0300 1234567" />
            </label>
            <label>
              Address
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} required placeholder="Shop address" />
            </label>
            {error && <p className="message error">{error}</p>}
            <div className="modal-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="button secondary" onClick={handleBack} disabled={saving || skipping}>
                Back
              </button>
              <button type="button" className="button secondary" onClick={handleSkip} disabled={saving || skipping}>
                {skipping ? "Skipping..." : "Skip for Now"}
              </button>
              <button type="submit" className="button primary" disabled={saving || skipping}>
                {saving ? "Saving..." : "Complete Setup"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
