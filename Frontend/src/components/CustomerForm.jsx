import { useState } from "react";
import { FaUserPlus } from "react-icons/fa";

export default function CustomerForm({ onSave }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({ name, phone, address });
    setName("");
    setPhone("");
    setAddress("");
  };

  return (
    <form className="card form-card" onSubmit={handleSubmit}>
      <h2>Add New Customer</h2>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" required />
      </label>
      <label>
        Phone
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0300 1234567" required />
      </label>
      <label>
        Address
        <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Customer address" required />
      </label>
      <button type="submit" className="button primary">
        <FaUserPlus /> Save Customer
      </button>
    </form>
  );
}
