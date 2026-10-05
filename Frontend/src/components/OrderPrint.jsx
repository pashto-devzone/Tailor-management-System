export default function OrderPrint({ shop, settings, order }) {
  if (!order) return null;

  const shopName = settings?.shopName || shop?.name || "Tailor Shop";
  const phone = settings?.phone || shop?.phone || "";
  const address = settings?.address || shop?.address || "";
  const currency = settings?.currency || "PKR";
  const footer =
    "Need a professional app or website for your business? Contact on WhatsApp: 03195341283";

  return (
    <div className="print-only">
      <div className="print-area">
        <div className="print-card">
          <div className="print-header">
            <h2>{shopName}</h2>
            {phone && (
              <p>
                <strong>Phone:</strong> {phone}
              </p>
            )}
            {address && (
              <p>
                <strong>Address:</strong> {address}
              </p>
            )}
          </div>

          <div className="print-content">
            <h3>Customer Receipt</h3>
            <p>
              <strong>Customer:</strong> {order.customer_name}
              {order.order_number ? (
                <>
                  <br />
                  <strong>Order #:</strong> {order.order_number}
                </>
              ) : (
                <>
                  <br />
                  <strong>Order #:</strong> -
                </>
              )}
            </p>

            <p>
              <strong>Phone:</strong> {order.customer_phone}
            </p>
            <p>
              <strong>Dress Type:</strong> {order.dress_type}
            </p>
            <div className="print-grid receipt-grid">
              <div className="measurement-row print-row">
                <span>Price</span>
                <strong>
                  {currency} {order.price}
                </strong>
              </div>
              <div className="measurement-row print-row">
                <span>Advance</span>
                <strong>
                  {currency} {order.advance}
                </strong>
              </div>
              <div className="measurement-row print-row">
                <span>Remaining</span>
                <strong>
                  {currency} {order.balance}
                </strong>
              </div>
              <div className="measurement-row print-row">
                <span>Delivery Date</span>
                <strong>{order.delivery_date}</strong>
              </div>
            </div>
          </div>
          <div className="print-footer">
            <p>{footer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
