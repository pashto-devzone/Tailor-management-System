import { useState } from "react";
import { FaTimes } from "react-icons/fa";

export default function NewCustomerModal({ open, onClose, onSave, loading, error }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [serialNumber, setSerialNumber] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({ name, phone, address, serial_number: serialNumber || null });
    setName("");
    setPhone("");
    setAddress("");
    setSerialNumber("");
  };


  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add New Customer</h3>
          <button type="button" className="icon-button" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Customer name" />
          </label>
          <label>
            Phone
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="0300 1234567" />
          </label>
          <label>
            Address
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} required placeholder="Customer address" />
          </label>
          <label>
            Customer Serial Number
            <input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="01" />
          </label>
          {error && <p className="message error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button primary" disabled={loading}>
              {loading ? "Saving..." : "Save Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
