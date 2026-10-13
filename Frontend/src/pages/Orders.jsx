import { useEffect, useMemo, useState } from "react";
import { FaPlus, FaSyncAlt } from "react-icons/fa";

import jsPDF from "jspdf";
import {
  getCustomers,
  getOrders,
  addOrder,
  updateOrder,
  updateOrderPayment,
  deleteOrder,
  addCustomer,
  getMeasurements,
  addMeasurements,
  getSettings,
} from "../services/api";
import OrderCard from "../components/OrderCard";
import NewCustomerModal from "../components/NewCustomerModal";
import MeasurementModal from "../components/MeasurementModal";
import PaymentModal from "../components/PaymentModal";
import OrderPrint from "../components/OrderPrint";
import MeasurementPreviewModal from "../components/MeasurementPreviewModal";
import { useShop } from "../contexts/ShopContext";

const hasCompleteGarmentMeasurements = (record, dressType) => {
  const type = String(dressType || "").toLowerCase();
  if (!["coat", "waistcoat", "waist coat"].includes(type)) return Boolean(record);
  const stored = record?.measurements?.measurement_details || record?.measurements || {};
  const measured = stored.measurements || {};
  const required = ["lambai", "taira", "gala", "seena", "kamar", "hips", ...(type === "coat" ? ["bazoo"] : [])];
  if (required.some((key) => !String(measured[key] ?? "").trim()) || !stored.gala?.type) return false;
  return type !== "coat" || Boolean(stored.coat_farmaish?.buttons && stored.coat_farmaish?.chaak);
};

export default function Orders() {

  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [loading, setLoading] = useState(true);
  const [orderLoading, setOrderLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [measurementCheckOpen, setMeasurementCheckOpen] = useState(false);
  const [measurementModalOpen, setMeasurementModalOpen] = useState(false);
  const [measurementMode, setMeasurementMode] = useState("add");
  const [measurementRecord, setMeasurementRecord] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [measurementCustomer, setMeasurementCustomer] = useState(null);
  const [checkingMeasurements, setCheckingMeasurements] = useState(false);
  const [measurementLoading, setMeasurementLoading] = useState(false);
  const [formData, setFormData] = useState({
    dress_type: "shalwar kameez",
    price: "",
    advance: "",
    delivery_date: "",
    status: "pending",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [printOrder, setPrintOrder] = useState(null);
  const [paymentOrder, setPaymentOrder] = useState(null);

  // Measurement print preview modal (after Create Order)
  const [measurementPrintPreviewOpen, setMeasurementPrintPreviewOpen] = useState(false);
  const [measurementPrintPreviewCustomer, setMeasurementPrintPreviewCustomer] = useState(null);
  const [measurementPrintPreviewMeasurement, setMeasurementPrintPreviewMeasurement] = useState(null);
  const [measurementPrintPreviewOrder, setMeasurementPrintPreviewOrder] = useState(null);
  const [pendingMeasurementOrder, setPendingMeasurementOrder] = useState(null);
  // kept for backward-compat with earlier versions; not used here
  const [measurementPrintPreviewLoading, setMeasurementPrintPreviewLoading] = useState(false);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const { shop } = useShop();
  const [settings, setSettings] = useState(null);

  const loadCustomers = async () => {
    try {
      const res = await getCustomers();
      setCustomers(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Customer load failed.");
    }
  };

  const loadOrders = (q = "") => {
    setLoading(true);
    getOrders(q)
      .then((res) => setOrders(res.data))

      .catch((err) =>
        setError(err.response?.data?.message || "Orders load failed."),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  // Debounced search: avoid API call on every keystroke and avoid competing
  // initial requests that can overwrite a successful Orders response.
  useEffect(() => {
    const t = setTimeout(() => loadOrders(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);


  useEffect(() => {
    getSettings()
      .then((res) => setSettings(res.data))
      .catch(() => setSettings(null));
  }, []);

  const filteredOrders = useMemo(() => {
    const statusFiltered =
      statusFilter === "all"
        ? orders
        : orders.filter((order) => order.status === statusFilter);

    // loadOrders(searchQuery) already queries server-side,
    // but keep a client-side fallback to satisfy partial matching even if API ignores q.
    const q = String(searchQuery ?? "").trim().toLowerCase();
    if (!q) return statusFiltered;

    return statusFiltered.filter((o) => {
      const orderNum = String(o.order_number ?? "").toLowerCase();
      const name = String(o.customer_name ?? "").toLowerCase();
      const phone = String(o.customer_phone ?? "").toLowerCase();
      return (
        orderNum.includes(q) || name.includes(q) || phone.includes(q)
      );
    });
  }, [orders, statusFilter, searchQuery]);


  const getOrderPaymentStatus = (order) => {
    if (!order) return "Unpaid";
    return order.payment_status || order.paymentStatus || "Unpaid";
  };

 const handleCustomerSelection = async (id) => {
  const normalizedId = id == null ? "" : String(id);
  setSelectedCustomer(normalizedId);
  setMessage("");
  setError("");
  setMeasurementRecord(null);

  setMeasurementCustomer(
    customers.find((customer) => String(customer.id) === normalizedId) || null
  );

  if (!normalizedId) {
    setMeasurementCheckOpen(false);
    return;
  }

  setCheckingMeasurements(false);
  setMeasurementCheckOpen(false);
  return;
};

  const handleStatusChange = async (order, newStatus) => {
    setError("");
    setMessage("");
    try {
      await updateOrder(order.id, {
        dress_type: order.dress_type,
        total_amount: Number(order.total_amount ?? order.price ?? 0),
        paid_amount: Number(order.paid_amount ?? order.advance ?? 0),
        remaining_amount: Number(order.remaining_amount ?? order.balance ?? 0),
        delivery_date: order.delivery_date,
        suit_quantity: order.suit_quantity ?? 1,
        status: newStatus,
      });
      setMessage("Order updated successfully");
      loadOrders();
    } catch (err) {
      setError(err.response?.data?.message || "Error updating order");
    }
  };

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [orderDeleteTarget, setOrderDeleteTarget] = useState(null);

  const cancelDeleteOrder = () => {
    setConfirmDeleteOpen(false);
    setOrderDeleteTarget(null);
  };

  const confirmDeleteOrder = async () => {
    if (!orderDeleteTarget?.id) return;
    const id = orderDeleteTarget.id;

    setError("");
    setMessage("");
    try {
      await deleteOrder(id);
      setMessage("Order deleted successfully");
      loadOrders();
    } catch (err) {
      setError(err.response?.data?.message || "Error deleting order");
    } finally {
      setConfirmDeleteOpen(false);
      setOrderDeleteTarget(null);
    }
  };

  const handleDelete = (id) => {
    setOrderDeleteTarget({ id });
    setConfirmDeleteOpen(true);
  };

  const handleOrderInput = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const computePaymentStatus = (paid, total) => {
    if (paid <= 0) return "Unpaid";
    if (paid >= total) return "Paid";
    return "Partial";
  };

  const handleAddOrder = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!selectedCustomer) {
      setError("Please select a customer or add a new customer");
      return;
    }

    const suitQuantity = Number(formData.suit_quantity);
    if (!Number.isInteger(suitQuantity) || suitQuantity < 1) {
      setError("Suit quantity must be a positive whole number");
      return;
    }

    setOrderLoading(true);
    try {
      const price = Number(formData.price);
      const advance = Number(formData.advance);
      const balance = price - advance;
      const payment_status = computePaymentStatus(advance, price);

      const customerId =
        selectedCustomer?.id ??
        selectedCustomer?._id ??
        selectedCustomer;

      const payload = {
        customer_id: customerId,
        dress_type: formData.dress_type,
        price,
        advance,
        remaining_amount: balance,
        payment_status,
        delivery_date: formData.delivery_date,
        suit_quantity: suitQuantity,
        status: formData.status,
      };

      const created = await addOrder(payload);
      const savedOrder = { ...payload, ...(created.data?.order || {}), customer_name: measurementCustomer?.name };

      setMessage("Order created successfully");

      // Step 2 (Task 2): open Measurement Print Preview popup automatically.
      // Fetch latest measurement fresh (do not rely on possibly stale state).
      const customer_id_for_measurement = payload.customer_id;
      let latest = null;
      let matchingRecord = null;
      try {
        const res = await getMeasurements(customer_id_for_measurement, payload.dress_type);
        const list = Array.isArray(res.data) ? res.data : [];
        matchingRecord = list[0] || null;
        latest = matchingRecord && hasCompleteGarmentMeasurements(matchingRecord, payload.dress_type) ? matchingRecord : null;
      } catch (_) {
        latest = null;
      }

      // Ensure preview has the correct customer + measurement payload.
      // IMPORTANT: use just-saved order's customer_id; never depend on stale state.
      const previewCustomer = customers.find(
        (c) => String(c.id) === String(payload.customer_id),
      );

      setMeasurementPrintPreviewCustomer(previewCustomer || measurementCustomer || null);
      setMeasurementPrintPreviewOrder(savedOrder);
      if (latest) {
        setMeasurementPrintPreviewMeasurement(latest);
        setMeasurementPrintPreviewOpen(true);
      } else {
        setPendingMeasurementOrder(savedOrder);
        setMeasurementRecord(matchingRecord);
        setMeasurementMode(matchingRecord ? "update" : "add");
        setMeasurementModalOpen(true);
        setError(`No ${payload.dress_type} measurements exist. Add measurements for this saved order before printing.`);
      }

      setFormData({
        dress_type: "shalwar kameez",
        price: "",
        advance: "",
        delivery_date: "",
        suit_quantity: "1",
        status: "pending",
      });
      loadOrders();
    } catch (err) {
      setError(err.response?.data?.message || "Error creating order");
    } finally {
      setOrderLoading(false);
    }
  };

  const handleCustomerSave = async (customerData) => {
    setError("");
    setMessage("");
    try {
      const response = await addCustomer(customerData);
      const customer = response.data.customer || response.data;
      setSelectedCustomer(customer.id);
      setMeasurementCustomer(customer);
      setModalOpen(false);
      loadCustomers();
      setMessage("New customer saved successfully");

      // Seamless workflow: immediately open Measurement Modal and continue order
      setMeasurementMode("add");
      setMeasurementRecord(null);
      setMeasurementCheckOpen(false);
      setMeasurementModalOpen(true);
      setMeasurementCustomer(customer);

    } catch (err) {
      setError(err.response?.data?.message || "Error adding new customer");
      throw err;
    }
  };


  const handlePrint = (order) => {
    setPrintOrder(order);
    setTimeout(() => {
      window.print();
      setPrintOrder(null);
    }, 50);
  };

  const handlePrintOrderMeasurements = async (order) => {
    setError("");
    setMeasurementPrintPreviewLoading(true);
    try {
      const response = await getMeasurements(order.customer_id, order.dress_type);
      const records = Array.isArray(response.data) ? response.data : [];
      const record = records.find((item) => String(item.dress_type || "").toLowerCase().replace(/[^a-z]/g, "") === String(order.dress_type || "").toLowerCase().replace(/[^a-z]/g, "")) || null;
      const customer = customers.find((item) => String(item.id) === String(order.customer_id)) || {
        id: order.customer_id,
        name: order.customer_name || "",
        phone: order.customer_phone || "",
        address: order.customer_address || "",
      };
      if (record && hasCompleteGarmentMeasurements(record, order.dress_type)) {
        setMeasurementPrintPreviewCustomer(customer);
        setMeasurementPrintPreviewMeasurement(record);
        setMeasurementPrintPreviewOrder(order);
        setMeasurementPrintPreviewOpen(true);
        return;
      }
      setMeasurementCustomer(customer);
      setPendingMeasurementOrder(order);
      setMeasurementRecord(record);
      setMeasurementMode(record ? "update" : "add");
      setMeasurementModalOpen(true);
      setError(`No complete ${order.dress_type} measurements are available for order ${order.order_number || order.id}. Add or complete them before printing.`);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load this order's garment measurements.");
    } finally {
      setMeasurementPrintPreviewLoading(false);
    }
  };

  const openMeasurementModal = (mode) => {
    setMeasurementMode(mode);
    setMeasurementModalOpen(true);
    setMeasurementCheckOpen(false);
  };

  const handleSaveMeasurement = async (data) => {
    setError("");
    setMessage("");
    setMeasurementLoading(true);
    try {
      const { comments = "", measurements = null, customer_id, dress_type } = data || {};
      const expectedCustomerId = pendingMeasurementOrder?.customer_id || selectedCustomer;
      const normalizeGarment = (value) => String(value || "").toLowerCase().replace(/[^a-z]/g, "");
      if (!customer_id || String(customer_id) !== String(expectedCustomerId) || !dress_type || (pendingMeasurementOrder && normalizeGarment(dress_type) !== normalizeGarment(pendingMeasurementOrder.dress_type))) {
        throw new Error("The measurement customer or garment does not match this order. Reopen the measurement from the order.");
      }
      const measurementPayload = measurements || {};

      if (measurementMode === "update" && measurementRecord?.id) {
        if (String(measurementRecord.customer_id) !== String(customer_id) || normalizeGarment(measurementRecord.dress_type) !== normalizeGarment(dress_type)) {
          throw new Error("The selected measurement changed. Reload the order and garment before saving.");
        }
        await updateMeasurement(measurementRecord.id, {
          measurements: measurementPayload,
          comments,
          dress_type,
        });
      } else {
        await addMeasurements({
          customer_id,
          dress_type,
          measurements: measurementPayload,
          comments,
        });
      }
      setMessage("Measurements saved successfully");
      setMeasurementModalOpen(false);
      setMeasurementCheckOpen(false);
      setMeasurementRecord({
        ...(measurementRecord || {}),
        customer_id,
        dress_type,
        measurements: measurementPayload,
        comments,
      });
      if (pendingMeasurementOrder) {
        const refreshed = await getMeasurements(customer_id, pendingMeasurementOrder.dress_type);
        const matching = Array.isArray(refreshed.data) ? refreshed.data[0] : null;
        if (matching) {
          setMeasurementPrintPreviewCustomer(measurementCustomer || customers.find((c) => String(c.id) === String(customer_id)) || null);
          setMeasurementPrintPreviewMeasurement(matching);
          setMeasurementPrintPreviewOrder(pendingMeasurementOrder);
          setMeasurementPrintPreviewOpen(true);
          setPendingMeasurementOrder(null);
          setError("");
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error saving measurements");
      throw err;
    } finally {
      setMeasurementLoading(false);
    }
  };

  const openPaymentModal = (order) => {
    setPaymentOrder(order);
    setPaymentError("");
    setPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async ({ payment_amount, action }) => {
    if (!paymentOrder) return;
    setPaymentLoading(true);
    setPaymentError("");
    setMessage("");
    try {
      await updateOrderPayment(paymentOrder.id, { payment_amount, action });
      setMessage("Payment updated successfully");
      setPaymentModalOpen(false);
      loadOrders();
    } catch (err) {
      setPaymentError(err.response?.data?.message || "Error recording payment");
    } finally {
      setPaymentLoading(false);
    }
  };

  const downloadInvoicePdf = async (order) => {
    let invoiceMeasurements = null;
    try {
      const res = await getMeasurements(order.customer_id);
      const list = Array.isArray(res.data) ? res.data : [];
      invoiceMeasurements = list.length > 0 ? list[0] : null;
    } catch (_) {
      invoiceMeasurements = null;
    }

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    let y = 60;

    const shopName = settings?.shopName || shop?.name || "Tailor Shop";
    const phone = settings?.phone || shop?.phone || "-";
    const address = settings?.address || shop?.address || "-";
    const currency = settings?.currency || "PKR";

    doc.setFontSize(18);
    doc.text(shopName, margin, y);

    doc.setFontSize(11);
    doc.text(`Phone: ${phone}`, margin, y + 20);
    doc.text(`Address: ${address}`, margin, y + 36);
    y += 60;

    doc.setFontSize(14);
    doc.text("Invoice", margin, y);
    y += 24;

    doc.setFontSize(10);
    doc.text(`Order ID: ${order.id}`, margin, y);
    doc.text(order.order_number ? `Order # : ${order.order_number}` : `Order # : -`, margin + 230, y);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, margin + 300, y);
    y += 18;
    doc.text(`Customer: ${order.customer_name || "-"}`, margin, y);
    doc.text(`Phone: ${order.customer_phone || "-"}`, margin + 300, y);
    y += 24;

    doc.setFontSize(12);
    doc.text("Order Details", margin, y);
    y += 18;

    const totalAmount = Number(order.total_amount ?? order.price ?? 0);
    const paidAmount = Number(order.paid_amount ?? order.advance ?? 0);
    const remainingAmount = Number(
      order.remaining_amount ?? order.balance ?? 0,
    );
    const paymentStatus =
      order.payment_status ||
      order.paymentStatus ||
      computePaymentStatus(paidAmount, totalAmount);

    doc.setFontSize(10);
    doc.text(`Dress Type: ${order.dress_type}`, margin, y);
    y += 16;
    doc.text(`Total Amount: ${currency} ${totalAmount.toLocaleString()}`, margin, y);
    y += 16;
    doc.text(`Paid Amount: ${currency} ${paidAmount.toLocaleString()}`, margin, y);
    y += 16;
    doc.text(
      `Remaining Amount: ${currency} ${remainingAmount.toLocaleString()}`,
      margin,
      y,
    );
    y += 16;
    doc.text(`Payment Status: ${paymentStatus}`, margin, y);
    y += 24;

    if (invoiceMeasurements) {
      doc.setFontSize(12);
      doc.text("Measurements", margin, y);
      y += 18;
      doc.setFontSize(10);
      const measurements =
        invoiceMeasurements.measurements || invoiceMeasurements;
      Object.entries(measurements).forEach(([key, value]) => {
        if (key === "created_at" || key === "customer_id") return;
        doc.text(`${key.replace(/_/g, " ")}: ${value}`, margin, y);
        y += 14;
      });
      y += 8;
    }

    const footer =
      "Need a professional app or website for your business? Contact on WhatsApp: 03195341283";
    doc.setFontSize(9);
    doc.text(footer, margin, y + 40);
    doc.save(`invoice-order-${order.id}.pdf`);
  };

  const measurementStatus = () => {
    if (!selectedCustomer || checkingMeasurements) return "";
    return measurementRecord
      ? "This customer has measurements"
      : "This customer does not have measurements yet";
  };

  return (
    <div className="page-orders">
      <div className="section-header">
        <div>
          <h2>Orders</h2>
          <p>Create orders and use smart measurement workflow</p>
        </div>
      </div>

      <NewCustomerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCustomerSave}
        loading={orderLoading}
        error={error}
      />

      <MeasurementModal
        open={measurementModalOpen}
        onClose={() => setMeasurementModalOpen(false)}
        onSave={handleSaveMeasurement}
        customer={measurementCustomer}
        dressType={pendingMeasurementOrder?.dress_type || formData.dress_type}
        mode={measurementMode}
        initialData={measurementRecord}
        loading={measurementLoading}
        error={error}
      />

      <PaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onSubmit={handlePaymentSubmit}
        order={paymentOrder}
        loading={paymentLoading}
        error={paymentError}
      />

      {/* Task 2: Measurement Print Preview popup */}
      {measurementPrintPreviewOpen && measurementPrintPreviewCustomer && measurementPrintPreviewMeasurement ? (
        <MeasurementPreviewModal
          open={measurementPrintPreviewOpen}
          shop={shop}
          settings={settings}
          customer={measurementPrintPreviewCustomer}
          measurement={measurementPrintPreviewMeasurement}
          order={measurementPrintPreviewOrder}

          onCancel={() => {
            setMeasurementPrintPreviewOpen(false);
            setMeasurementPrintPreviewCustomer(null);
            setMeasurementPrintPreviewMeasurement(null);
            setMeasurementPrintPreviewOrder(null);
          }}

          onEditMeasurement={() => {
            // Must open existing measurement edit modal
            setMeasurementPrintPreviewOpen(false);
            setMeasurementPrintPreviewCustomer(null);
            setMeasurementPrintPreviewMeasurement(null);
            setMeasurementPrintPreviewOrder(null);

            // Ensure correct measurement is loaded for edit
            setMeasurementRecord(measurementPrintPreviewMeasurement);
            setMeasurementMode("update");
            setMeasurementModalOpen(true);
            setMeasurementCheckOpen(false);
          }}

          onPrintMeasurement={() => {
            // Electron has completed (or cancelled) its single print request.
            setMeasurementPrintPreviewOpen(false);
            setMeasurementPrintPreviewCustomer(null);
            setMeasurementPrintPreviewMeasurement(null);
            setMeasurementPrintPreviewOrder(null);
          }}

          isPrintingDisabled={measurementPrintPreviewLoading}
        />
      ) : null}



      {measurementCheckOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setMeasurementCheckOpen(false)}
        >
          <div
            className="modal-card check-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>
              {measurementRecord
                ? "Measurements Exist"
                : "No Measurements Found"}
            </h3>
            <p className="modal-subtitle">
              {measurementRecord
                ? "You can update the measurements or continue with the order."
                : "You can add measurements for this customer now."}
            </p>
            <div className="modal-actions">
              {measurementRecord ? (
                <>
                  <button
                    className="button secondary"
                    onClick={() => setMeasurementCheckOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => openMeasurementModal("update")}
                  >
                    Update Measurements
                  </button>
                  <button
                    className="button primary"
                    onClick={() => setMeasurementCheckOpen(false)}
                  >
                    Continue Order
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="button secondary"
                    onClick={() => setMeasurementCheckOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="button primary"
                    onClick={() => openMeasurementModal("add")}
                  >
                    Add Measurements
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

<div className="message-row">
        {message && <p className="message success">{message}</p>}
        {error && <p className="message error">{error}</p>}
      </div>

      {confirmDeleteOpen && (
        <div className="confirm-backdrop" onClick={cancelDeleteOrder}>
          <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-message">کیا آپ واقعی یہ آرڈر حذف کرنا چاہتے ہیں؟</p>
            <div className="confirm-actions">
              <button className="button danger" onClick={confirmDeleteOrder}>
                حذف کریں
              </button>
              <button className="button secondary" onClick={cancelDeleteOrder}>
                منسوخ کریں
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-grid">
        <div className="card form-card order-form-card">
          <div className="form-header">
            <div>
              <h3>New Order</h3>
              <p className="form-description">
                Set customer, price and delivery date.
              </p>
            </div>
            <button
              className="button secondary small"
              onClick={() => setModalOpen(true)}
            >
              <FaPlus /> New Customer
            </button>
          </div>

          <label>
            Select Customer
            <div className="customer-select-row">
              <select
                value={selectedCustomer}
                onChange={(e) => handleCustomerSelection(e.target.value)}
              >
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} ({customer.phone})
                  </option>
                ))}
              </select>
            </div>
          </label>

          {/* <label>
            Select Customer
            <div className="customer-select-row">
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Select customer</option>

                {customers.map((customer) => (
                  <option key={customer._id} value={customer._id}>
                    {customer.name} ({customer.phone})
                  </option>
                ))}
              </select>
            </div> */}
          {/* </label> */}

          {checkingMeasurements && selectedCustomer && (
            <div className="measurement-banner">
              <FaSyncAlt
                className={checkingMeasurements ? "loading-icon" : ""}
              />
              <span>
                {checkingMeasurements
                  ? "Measurements check ho rahe hain..."
                  : measurementStatus()}
              </span>
            </div>
          )}

          <label>
            Dress Type
            <select
              value={formData.dress_type}
              onChange={(e) => handleOrderInput("dress_type", e.target.value)}
            >
              <option value="shalwar kameez">Shalwar Kameez</option>
      <option value="waistcoat">Waist Coat</option>
      <option value="sherwani">Sherwani</option>
      <option value="coat">Coat</option>
            </select>
          </label>
          <label>
            Suit Quantity
            <input type="number" min="1" step="1" required value={formData.suit_quantity}
              onChange={(e) => handleOrderInput("suit_quantity", e.target.value)} />
          </label>
          <label>
            Price
            <input
              type="number"
              value={formData.price}
              onChange={(e) => handleOrderInput("price", e.target.value)}
              required
            />
          </label>
          <label>
            Advance
            <input
              type="number"
              value={formData.advance}
              onChange={(e) => handleOrderInput("advance", e.target.value)}
              required
            />
          </label>
          <label>
            Delivery Date
            <input
              type="date"
              value={formData.delivery_date}
              onChange={(e) =>
                handleOrderInput("delivery_date", e.target.value)
              }
              required
            />
          </label>
          <button
            type="button"
            className="button primary"
            onClick={handleAddOrder}
            disabled={orderLoading}
          >
            {orderLoading ? "Saving..." : "Create Order"}
          </button>
        </div>

        <div>
      <div className="card filter-card">
            <label>
              Search
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Order #, Customer Name or Phone"
              />
            </label>

            <label>
              Filter by status
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >

                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="ready">Ready</option>
                <option value="delivered">Delivered</option>
              </select>
            </label>
          </div>

          {loading ? (
            <p>Loading orders...</p>
          ) : filteredOrders.length === 0 ? (
            <p>No orders found.</p>
          ) : (
            <div className="orders-grid">
              {filteredOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                  onPrint={() => handlePrint(order)}
                  onPrintMeasurements={handlePrintOrderMeasurements}
                  onPayment={openPaymentModal}
                  onDownloadInvoice={downloadInvoicePdf}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {printOrder && <OrderPrint shop={shop} settings={settings} order={printOrder} />}
      {/* Prevent blank screen: show error banner instead of crashing render */}
      {error && <div style={{ display: "none" }}>{error}</div>}

    </div>
  );
}
