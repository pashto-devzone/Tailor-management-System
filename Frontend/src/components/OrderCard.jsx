import { FaPrint, FaTrash, FaSyncAlt, FaMoneyBillWave, FaFilePdf } from "react-icons/fa";

const statusLabel = (status) => {
  if (!status) return "Pending";
  if (status === "Unpaid") return "Pending";
  if (status === "Partial") return "Partially Paid";
  if (status === "Paid") return "Fully Paid";
  return status;
};

export default function OrderCard({
  order,
  onStatusChange,
  onDelete,
  onPrint,
  onPayment,
  onDownloadInvoice,
}) {
  const nextStatus =
    order.status === "pending"
      ? "ready"
      : order.status === "ready"
        ? "delivered"
        : "delivered";

  const totalAmount = order.total_amount ?? order.price;
  const paidAmount = order.paid_amount ?? order.advance;
  const remainingAmount = order.remaining_amount ?? order.balance;

  const orderNumberText = order.order_number ? `#${order.order_number}` : "-";

  // Keep payment status mapping for potential future use,
  // but DO NOT render it to avoid duplicate status text on cards.
  void statusLabel(order.payment_status || order.paymentStatus || "Unpaid");

  return (
    <div className="order-card card">
      <div className="order-header">
        <div>
          <p className="order-customer">
            <strong>Order {orderNumberText}</strong>
            {order.customer_name ? ` • ${order.customer_name}` : ""}
          </p>
          <h3 className="order-dress">{order.dress_type}</h3>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <span className={`status ${order.status}`}>{order.status}</span>
        </div>
      </div>

      <div className="order-body">
        <div className="order-card__row">
          <div>
            <strong>Delivery:</strong> {order.delivery_date}
          </div>
          <div>
            <strong>Remaining:</strong> Rs {remainingAmount}
          </div>
        </div>

        <div className="order-card__row">
          <div>
            <strong>Total:</strong> Rs {totalAmount}
          </div>
          <div>
            <strong>Paid:</strong> Rs {paidAmount}
          </div>
          <div>
            <strong>Delivery Date:</strong> {order.delivery_date}
          </div>
        </div>

        <div className="order-actions">
          {order.status !== "delivered" && (
            <button
              className="button secondary order-action"
              onClick={() => onStatusChange(order, nextStatus)}
            >
              <FaSyncAlt />
              <span className="order-action__text">Update</span>
            </button>
          )}

          <button className="button secondary order-action" onClick={() => onPayment(order)}>
            <FaMoneyBillWave />
            <span className="order-action__text">Payment</span>
          </button>

          <button
            className="button secondary order-action"
            onClick={() => onDownloadInvoice(order)}
          >
            <FaFilePdf />
            <span className="order-action__text">Print</span>
          </button>

          <button className="button secondary order-action" onClick={() => onPrint(order)}>
            <FaPrint />
            <span className="order-action__text">Receipt</span>
          </button>

          <button className="button danger order-action" onClick={() => onDelete(order.id)}>
            <FaTrash />
            <span className="order-action__text">Delete</span>
          </button>
        </div>

        {order.comments ? (
          <div className="order-comments">
            <strong>Comments:</strong> {order.comments}
          </div>
        ) : null}
      </div>
    </div>
  );
}


