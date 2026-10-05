import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useShop } from "../contexts/ShopContext";

export default function Setup() {
  const { shop, loading, saveShop } = useShop();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
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
      setError("Error saving setup");
    } finally {
      setSaving(false);
    }
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
            <div className="modal-actions">
              <button type="submit" className="button primary" disabled={saving}>
                {saving ? "Saving..." : "Complete Setup"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
