import { useEffect, useState } from "react";
import { FaTimes } from "react-icons/fa";

export default function PaymentModal({ open, onClose, onSubmit, order, loading, error }) {
  const [paymentAmount, setPaymentAmount] = useState("");
  const [action, setAction] = useState("partial");

  useEffect(() => {
    if (open) {
      setPaymentAmount("");
      setAction(order?.remaining_amount > 0 ? "partial" : "full");
    }
  }, [open, order]);

  if (!open || !order) return null;

  const remaining = Number(order.remaining_amount ?? order.balance ?? 0);
  const amountValue = action === "full" ? remaining : Number(paymentAmount || 0);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (action === "partial" && (!paymentAmount || Number(paymentAmount) <= 0)) return;
    onSubmit({ payment_amount: amountValue, action });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Receive Payment</h3>
            <p className="modal-subtitle">Order #{order.id} • {order.customer_name}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-section">
            <label>
              Total Amount
              <input type="text" value={`Rs ${Number(order.total_amount ?? order.price ?? 0).toLocaleString()}`} disabled />
            </label>
            <label>
              Paid Amount
              <input type="text" value={`Rs ${Number(order.paid_amount ?? order.advance ?? 0).toLocaleString()}`} disabled />
            </label>
            <label>
              Remaining Amount
              <input type="text" value={`Rs ${remaining.toLocaleString()}`} disabled />
            </label>
          </div>

          <div className="modal-section">
            <label>
              Payment Type
              <select value={action} onChange={(event) => setAction(event.target.value)}>
                <option value="partial">Partial Payment</option>
                <option value="full">Mark Fully Paid</option>
              </select>
            </label>
            {action === "partial" && (
              <label>
                Amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  placeholder="Enter payment amount"
                  required
                />
              </label>
            )}
          </div>

          {error && <p className="message error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button primary" disabled={loading}>
              {loading ? "Saving..." : action === "full" ? "Mark Full Paid" : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
