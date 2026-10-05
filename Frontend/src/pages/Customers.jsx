import { useEffect, useMemo, useState, useCallback } from "react";
import {
  getCustomers,
  getOrdersByCustomerId,
  getMeasurements,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  addMeasurements,
  updateMeasurement,
} from "../services/api";
import { getSettings } from "../services/api";

import CustomerForm from "../components/CustomerForm";
import MeasurementModal from "../components/MeasurementModal";
import MeasurementPreviewModal from "../components/MeasurementPreviewModal";
import { useShop } from "../contexts/ShopContext";




const FooterLink = null;




const formatMoney = (value) => {
  const num = Number(value ?? 0);
  if (Number.isNaN(num)) return "Rs 0";
  return `Rs ${num.toLocaleString()}`;
};

const formatDate = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString();
};

const safeString = (v) => (v == null ? "" : String(v));

const getLatestMeasurement = (measurementsList) => {
  if (!Array.isArray(measurementsList) || measurementsList.length === 0) return null;
  return measurementsList.reduce((latest, item) => {
    const t = new Date(item.created_at || item.date || 0).getTime();
    const lt = new Date(latest.created_at || latest.date || 0).getTime();
    return t > lt ? item : latest;
  }, measurementsList[0]);
};

const computeCustomerValue = (ordersList) => {
  const list = Array.isArray(ordersList) ? ordersList : [];
  const totalEarned = list.reduce((sum, o) => sum + Number(o.total_amount ?? o.price ?? 0), 0);
  const totalPaid = list.reduce((sum, o) => sum + Number(o.paid_amount ?? o.advance ?? 0), 0);
  const totalRemaining = list.reduce((sum, o) => sum + Number(o.remaining_amount ?? o.balance ?? 0), 0);
  return {
    totalOrders: list.length,
    totalEarned,
    totalPaid,
    totalRemaining,
  };
};

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [customerOrders, setCustomerOrders] = useState([]);
  const [customerOrderLoading, setCustomerOrderLoading] = useState(false);
  const [customerStatusFilter, setCustomerStatusFilter] = useState("all");

  const [measurements, setMeasurements] = useState([]);
  const [measurementsLoading, setMeasurementsLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Edit Customer modal
  const [editCustomerOpen, setEditCustomerOpen] = useState(false);
  const [editCustomerSaving, setEditCustomerSaving] = useState(false);
  const [editCustomerError, setEditCustomerError] = useState("");
  const [editCustomerForm, setEditCustomerForm] = useState({
    name: "",
    phone: "",
    address: "",
    serial_number: "",
  });

  // Edit Measurements modal
  const [measurementModalOpen, setMeasurementModalOpen] = useState(false);
  const [measurementMode, setMeasurementMode] = useState("update");
  const [measurementRecord, setMeasurementRecord] = useState(null);
  const [measurementSaving, setMeasurementSaving] = useState(false);

  // Measurement preview modal
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [printMeasurementForPreview, setPrintMeasurementForPreview] = useState(null);
  const [printCustomerForPreview, setPrintCustomerForPreview] = useState(null);
  const [printLoading, setPrintLoading] = useState(false);

  const { shop } = useShop();
  const [settings, setSettings] = useState(null);





  const handleMeasurementPrintPreview = () => {
    // REQUIRED flow (same logic as Measurements.jsx): set preview measurement + preview customer + open MeasurementPreviewModal.
    if (!selectedCustomer || !selectedMeasurementsLatest) return;

    const latestMeasurement = selectedMeasurementsLatest;

    setPrintLoading(true);
    try {
      setPrintMeasurementForPreview(latestMeasurement);
      setPrintCustomerForPreview(selectedCustomer);
      setPrintPreviewOpen(true);
    } finally {
      setPrintLoading(false);
    }
  }; 









  const closePrintPreview = () => {
    setPrintPreviewOpen(false);
    setPrintCustomerForPreview(null);
    setPrintMeasurementForPreview(null);
  };

  // Print handled by MeasurementPreviewModal

  const loadCustomers = useCallback(() => {
    setLoading(true);
    return getCustomers()
      .then((res) => setCustomers(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        setError(err.response?.data?.message || "Error loading customers");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const filteredCustomers = useMemo(() => {
    const term = search.toLowerCase();
    if (!term) return customers;
    return customers.filter(
      (c) =>
        safeString(c.name).toLowerCase().includes(term) ||
        safeString(c.phone).toLowerCase().includes(term),
    );
  }, [customers, search]);

  const filteredCustomerOrders = useMemo(() => {
    if (customerStatusFilter === "all") return customerOrders;
    return customerOrders.filter((o) => o.status === customerStatusFilter);
  }, [customerOrders, customerStatusFilter]);

  const selectedMeasurementsLatest = useMemo(() => getLatestMeasurement(measurements), [measurements]);

  const measurementSummary = useMemo(() => {
    const count = Array.isArray(measurements) ? measurements.length : 0;
    const latest = selectedMeasurementsLatest ? selectedMeasurementsLatest.created_at : null;
    return {
      totalMeasurementRecords: count,
      latestMeasurementDate: latest,
    };
  }, [measurements, selectedMeasurementsLatest]);

  const customerValueSummary = useMemo(() => computeCustomerValue(customerOrders), [customerOrders]);

  const ordersStats = useMemo(() => {
    const list = Array.isArray(customerOrders) ? customerOrders : [];
    return {
      totalOrders: list.length,
      pending: list.filter((o) => o.status === "pending").length,
      ready: list.filter((o) => o.status === "ready").length,
      delivered: list.filter((o) => o.status === "delivered").length,
    };
  }, [customerOrders]);

  const loadCustomerOrdersAndMeasurements = useCallback(async (customer) => {
    if (!customer) {
      setSelectedCustomer(null);
      setCustomerOrders([]);
      setMeasurements([]);
      return;
    }

    setSelectedCustomer(customer);
    setError("");
    setMessage("");

    setCustomerOrderLoading(true);
    setMeasurementsLoading(true);
    setCustomerStatusFilter("all");

    try {
      const [ordersRes, measurementsRes] = await Promise.all([
        getOrdersByCustomerId(customer.id),
        getMeasurements(customer.id),
      ]);

      setCustomerOrders(Array.isArray(ordersRes.data) ? ordersRes.data : []);
      setMeasurements(Array.isArray(measurementsRes.data) ? measurementsRes.data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load customer data.");
    } finally {
      setCustomerOrderLoading(false);
      setMeasurementsLoading(false);
    }
  }, []);

  const handleAdd = async (data) => {
    setError("");
    setMessage("");
    try {
      const response = await addCustomer(data);
      setMessage(response.data?.message || "Customer saved successfully");
      await loadCustomers();
    } catch (err) {
      setError(err.response?.data?.message || "Error adding customer");
    }
  };

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [customerDeleteTarget, setCustomerDeleteTarget] = useState(null);

  const cancelDeleteCustomer = () => {
    setConfirmDeleteOpen(false);
    setCustomerDeleteTarget(null);
  };

  const confirmDeleteCustomer = async () => {
    if (!customerDeleteTarget?.id) return;
    const id = customerDeleteTarget.id;

    setError("");
    setMessage("");
    try {
      await deleteCustomer(id);
      setMessage("Customer deleted successfully");
      await loadCustomers();
      if (selectedCustomer?.id === id) {
        setSelectedCustomer(null);
        setCustomerOrders([]);
        setMeasurements([]);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error deleting customer");
    } finally {
      setConfirmDeleteOpen(false);
      setCustomerDeleteTarget(null);
    }
  };

  const handleDelete = (id) => {
    setCustomerDeleteTarget({ id });
    setConfirmDeleteOpen(true);
  };

  const openEditCustomer = () => {
    if (!selectedCustomer) return;
    setEditCustomerError("");
    setEditCustomerForm({
      name: selectedCustomer.name || "",
      phone: selectedCustomer.phone || "",
      address: selectedCustomer.address || "",
      serial_number: selectedCustomer.serial_number ?? "",
    });
    setEditCustomerOpen(true);
  };

  const saveEditCustomer = async () => {
    if (!selectedCustomer) return;
    setEditCustomerError("");
    setEditCustomerSaving(true);

    try {
      await updateCustomer(selectedCustomer.id, {
        name: editCustomerForm.name,
        phone: editCustomerForm.phone,
        address: editCustomerForm.address,
        // Preserve existing serial if user left it empty
        serial_number:
          editCustomerForm.serial_number === "" || editCustomerForm.serial_number == null
            ? null
            : editCustomerForm.serial_number,
      });

      setMessage("Customer updated successfully");
      setEditCustomerOpen(false);
      await loadCustomers();

      const updated = customers.find((c) => c.id === selectedCustomer.id);
      await loadCustomerOrdersAndMeasurements(updated || selectedCustomer);
    } catch (err) {
      setEditCustomerError(err.response?.data?.message || "Error updating customer");
    } finally {
      setEditCustomerSaving(false);
    }
  };

  const openMeasurementsEdit = () => {
    if (!selectedCustomer) return;
    const latest = selectedMeasurementsLatest;
    if (latest) {
      setMeasurementRecord(latest);
      setMeasurementMode("update");
    } else {
      setMeasurementRecord(null);
      setMeasurementMode("add");
    }
    setMeasurementModalOpen(true);
  };

  const handleSaveMeasurements = async (data) => {
    if (!selectedCustomer) return;
    setError("");
    setMessage("");
    setMeasurementSaving(true);

    try {
      const { comments = "", measurements: payloadMeasurements = null } = data || {};
      const normalizedPayload = payloadMeasurements || {};

      if (measurementMode === "update" && measurementRecord?.id) {
        await updateMeasurement(measurementRecord.id, {
          measurements: normalizedPayload,
          comments,
        });
      } else {
        await addMeasurements({
          customer_id: selectedCustomer.id,
          measurements: normalizedPayload,
          comments,
        });
      }

      setMeasurementModalOpen(false);
      setMeasurementRecord(null);

      const [ordersRes, measurementsRes] = await Promise.all([
        getOrdersByCustomerId(selectedCustomer.id),
        getMeasurements(selectedCustomer.id),
      ]);

      setCustomerOrders(Array.isArray(ordersRes.data) ? ordersRes.data : []);
      setMeasurements(Array.isArray(measurementsRes.data) ? measurementsRes.data : []);

      setMessage("Measurements saved successfully");
    } catch (err) {
      setError(err.response?.data?.message || "Error saving measurements");
    } finally {
      setMeasurementSaving(false);
    }
  };

  const pendingOrders = filteredCustomerOrders.filter((o) => o.status === "pending");
  const orderHistoryNewestFirst = useMemo(() => {
    return [...customerOrders].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [customerOrders]);

  return (
    <div className="page-customers">
      <div className="section-header">
        <div>
          <h2>Customers</h2>
          <p>Complete customer profile management</p>
        </div>
      </div>

      <div className="message-row">
        {message && <p className="message success">{message}</p>}
        {error && <p className="message error">{error}</p>}
      </div>

      <div className="page-grid">
        <CustomerForm onSave={handleAdd} />

        <section className="card customers-card">
          <div className="section-title">
            <h3>Customer List</h3>
            <input
              type="search"
              placeholder="Search name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Serial</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Address</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      className={selectedCustomer?.id === customer.id ? "selected-row" : ""}
                      onClick={() => loadCustomerOrdersAndMeasurements(customer)}
                    >
                      <td>{customer.serial_number || ""}</td>
                      <td>{customer.name}</td>
                      <td>{customer.phone}</td>
                      <td>{customer.address}</td>
                      <td>
                        <button
                          className="button danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(customer.id);
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Customer Summary Modal */}
      {selectedCustomer && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedCustomer(null)}
          role="presentation"
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 560 }}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Customer Summary</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setSelectedCustomer(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "0.5rem 0.75rem 0.75rem" }}>
              <div style={{ display: "grid", gap: 10 }}>

                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{selectedCustomer.name}</div>
                    <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>{selectedCustomer.phone}</div>
                    <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>{selectedCustomer.address}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>Serial Number</div>
                    <div style={{ fontWeight: 800 }}>{selectedCustomer.serial_number || "-"}</div>
                  </div>
                </div>

                <div className="stats-grid">
                  <div className="stat-card card" style={{ boxShadow: "none" }}>
                    <div>
                      <p>Total Orders</p>
                      <h3>{ordersStats.totalOrders}</h3>
                    </div>
                  </div>
                  <div className="stat-card card" style={{ boxShadow: "none" }}>
                    <div>
                      <p>Pending Orders</p>
                      <h3>{ordersStats.pending}</h3>
                    </div>
                  </div>
                  <div className="stat-card card" style={{ boxShadow: "none" }}>
                    <div>
                      <p>Latest Delivery</p>
                      <h3 style={{ fontSize: 18 }}>
                        {pendingOrders.length
                          ? pendingOrders
                              .slice()
                              .sort((a, b) => new Date(b.delivery_date || 0) - new Date(a.delivery_date || 0))[0]
                              .delivery_date
                          : "-"}
                      </h3>
                    </div>
                  </div>
                  <div className="stat-card card" style={{ boxShadow: "none" }}>
                    <div>
                      <p>Total Earned</p>
                      <h3>{formatMoney(customerValueSummary.totalEarned)}</h3>
                    </div>
                  </div>
                </div>

                <div className="measurement-detail-card" style={{ padding: "0.5rem 0.75rem" }}>
                  <div className="measurement-detail-row" style={{ paddingTop: 2, paddingBottom: 2 }}>

                    <span>Latest Measurement Date</span>
                    <strong>
                      {measurementSummary.latestMeasurementDate ? formatDate(measurementSummary.latestMeasurementDate) : "-"}
                    </strong>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8, marginTop: 2 }}>

                  {selectedMeasurementsLatest ? (
                    <>
                      <div style={{ fontWeight: 700, color: "var(--muted)", fontSize: 13 }}>
                        Measurements available
                      </div>
                      {/* Buttons only here (no duplicates) */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                          gap: 10,
                        }}
                      >
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => {
                            handleMeasurementPrintPreview();
                          }}
                          disabled={customerOrderLoading || measurementsLoading || printLoading}
                        >
                          {printLoading ? "Preparing..." : "Print Measurement"}
                        </button>

                        <button
                          type="button"
                          className="button secondary"
                          onClick={openEditCustomer}
                        >
                          Edit Customer
                        </button>
                        <button
                          type="button"
                          className="button secondary"
                          onClick={openMeasurementsEdit}
                        >
                          Edit Measurement
                        </button>

                        <button
                          type="button"
                          className="button danger"
                          onClick={() => handleDelete(selectedCustomer.id)}
                        >
                          Delete Customer
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="message error">No measurement available for this customer.</div>
                      <button
                        type="button"
                        className="button primary"
                        onClick={() => {
                          setMeasurementRecord(null);
                          setMeasurementMode("add");
                          setMeasurementModalOpen(true);
                        }}
                      >
                        Add Measurement
                      </button>

                      <button
                        type="button"
                        className="button secondary"
                        onClick={openEditCustomer}
                      >
                        Edit Customer
                      </button>
                    </>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
      )}



      {confirmDeleteOpen && (
        <div
          className="confirm-backdrop"
          onClick={cancelDeleteCustomer}
          role="presentation"
        >
          <div
            className="confirm-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <p className="confirm-message">Are you sure you want to delete this customer?</p>
            <div className="confirm-actions">
              <button
                className="button danger"
                onClick={confirmDeleteCustomer}
              >
                Delete
              </button>
              <button className="button secondary" onClick={cancelDeleteCustomer}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editCustomerOpen && selectedCustomer && (
        <div className="modal-backdrop" onClick={() => setEditCustomerOpen(false)}>

          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3>Edit Customer</h3>
              <button type="button" className="icon-button" onClick={() => setEditCustomerOpen(false)}>
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
              <label>
                Serial Number (optional)
                <input
                  value={editCustomerForm.serial_number}
                  onChange={(e) => setEditCustomerForm((p) => ({ ...p, serial_number: e.target.value }))}
                  placeholder="01"
                />
              </label>

              <label>
                Customer Name
                <input
                  value={editCustomerForm.name}
                  onChange={(e) => setEditCustomerForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Customer name"
                  required
                />
              </label>

              <label>
                Phone Number
                <input
                  value={editCustomerForm.phone}
                  onChange={(e) => setEditCustomerForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="0300 1234567"
                  required
                />
              </label>

              <label>
                Address
                <textarea
                  value={editCustomerForm.address}
                  onChange={(e) => setEditCustomerForm((p) => ({ ...p, address: e.target.value }))}
                  placeholder="Customer address"
                  required
                />
              </label>

              {editCustomerError ? <p className="message error">{editCustomerError}</p> : null}

              <div className="modal-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setEditCustomerOpen(false)}
                  disabled={editCustomerSaving}
                >
                  Cancel
                </button>
                <button type="button" className="button primary" onClick={saveEditCustomer} disabled={editCustomerSaving}>
                  {editCustomerSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Universal Measurement Preview Modal */}
      {printPreviewOpen && selectedCustomer && printMeasurementForPreview && (
        <MeasurementPreviewModal
          open={printPreviewOpen}
          shop={shop}
          settings={settings}
          customer={selectedCustomer}
          measurement={printMeasurementForPreview}

          onCancel={closePrintPreview}
          onEditMeasurement={() => {
            // Must open existing measurement edit modal
            closePrintPreview();
            openMeasurementsEdit();
          }}
          onPrintMeasurement={() => {
            // Print exactly the preview shown
            window.print();
            closePrintPreview();
          }}
          isPrintingDisabled={printLoading}
        />
      )}


      {/* Edit Measurements Modal */}
      <MeasurementModal

        open={measurementModalOpen}
        onClose={() => setMeasurementModalOpen(false)}
        onSave={handleSaveMeasurements}
        customer={selectedCustomer}
        customers={customers}
        mode={measurementMode}
        initialData={measurementRecord}
        loading={measurementSaving}
        error={error}
      />
    </div>
  );
}
