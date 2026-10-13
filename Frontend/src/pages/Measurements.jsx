import { useEffect, useRef, useState } from "react";
import { FaPlus, FaEdit, FaPrint, FaTrash, FaChevronDown, FaChevronRight } from "react-icons/fa";
import {
  getCustomers,
  getMeasurements,
  getOrdersByCustomerId,
  addMeasurements,
  updateMeasurement,
  deleteMeasurement,
  addCustomer,
  getSettings,
} from "../services/api";
import NewCustomerModal from "../components/NewCustomerModal";
import MeasurementModal from "../components/MeasurementModal";
import MeasurementPreviewModal from "../components/MeasurementPreviewModal";

import { normalizeMeasurementData, getFarmaishRows, getMeasurementLabel, getOrderedMeasurementEntries } from "../utils/measurementUtils";

import { useShop } from "../contexts/ShopContext";

export default function Measurements() {
  const { shop } = useShop();
  const [settings, setSettings] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedCustomerObj, setSelectedCustomerObj] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [measurementModalOpen, setMeasurementModalOpen] = useState(false);
  const [measurementMode, setMeasurementMode] = useState("add");
  const [measurementRecord, setMeasurementRecord] = useState(null);
  const [cardExpanded, setCardExpanded] = useState(false);
  const [expandedMeasurements, setExpandedMeasurements] = useState({});
  const [showGarmentPicker, setShowGarmentPicker] = useState(false);
  const [selectedGarment, setSelectedGarment] = useState("");
  // (legacy state removed) measurement printing now uses MeasurementPreviewModal

  const [measurementPreviewOpen, setMeasurementPreviewOpen] = useState(false);
  const [measurementPreviewMeasurement, setMeasurementPreviewMeasurement] = useState(null);
  const [measurementPreviewCustomer, setMeasurementPreviewCustomer] = useState(null);

  const [savingMeasurement, setSavingMeasurement] = useState(false);
  const selectionRequest = useRef(0);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [measurementDeleteTarget, setMeasurementDeleteTarget] = useState(null);

  const loadCustomers = async () => {
    try {
      const res = await getCustomers();
      setCustomers(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Customer load failed.");
    }
  };

  const loadMeasurements = async (customerId) => {
    const requestId = ++selectionRequest.current;
    if (!customerId) {
      setMeasurements([]);
      setLoading(false);
      return;
    }
    setMeasurements([]);
    setLoading(true);
    setError("");
    try {
      const res = await getMeasurements(customerId);
      if (requestId === selectionRequest.current && String(customerId) === String(selectedCustomer)) {
        setMeasurements(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      if (requestId === selectionRequest.current && String(customerId) === String(selectedCustomer)) {
        setMeasurements([]);
        setError(err.response?.data?.message || "Measurements load failed.");
      }
    } finally {
      if (requestId === selectionRequest.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    getSettings()
      .then((res) => setSettings(res.data))
      .catch(() => setSettings(null));
  }, []);

  useEffect(() => {
    setSelectedCustomerObj(customers.find((customer) => String(customer.id) === String(selectedCustomer)) || null);
    loadMeasurements(selectedCustomer);
    setCustomerOrders([]);
    if (selectedCustomer) {
      const customerId = selectedCustomer;
      getOrdersByCustomerId(customerId).then((res) => {
        if (String(customerId) === String(selectedCustomer)) setCustomerOrders(Array.isArray(res.data) ? res.data : []);
      }).catch(() => {
        if (String(customerId) === String(selectedCustomer)) setCustomerOrders([]);
      });
    } else setCustomerOrders([]);
  }, [selectedCustomer, customers]);

  const handleCustomerSave = async (customerData) => {
    setError("");
    setMessage("");
    try {
      const response = await addCustomer(customerData);
      const customer = response.data.customer || response.data;
      setSelectedCustomer(customer.id);
      setSelectedCustomerObj(customer);
      setModalOpen(false);
      await loadCustomers();
      setMessage("New customer saved successfully");
    } catch (err) {
      setError(err.response?.data?.message || "Error adding new customer");
      throw err;
    }
  };

  const openMeasurementModal = (mode, record = null, garment = "") => {
    setMeasurementMode(mode);
    setMeasurementRecord(record);
    setSelectedGarment(garment || record?.dress_type || "");
    setMeasurementModalOpen(true);
  };

  const handleSaveMeasurement = async (data) => {
    setError("");
    setMessage("");
    setSavingMeasurement(true);
    try {
      const { comments = "", measurements: measurementPayload = null, customer_id = selectedCustomer, dress_type = measurementRecord?.dress_type || "shalwar kameez" } = data || {};
      const payload = measurementPayload || {};
      const garmentKey = (value) => String(value || "").toLowerCase().replace(/\s+/g, "");
      const recordToUpdate = measurementMode === "update" ? measurementRecord : null;
      if (recordToUpdate && (
        String(recordToUpdate.customer_id) !== String(customer_id) ||
        garmentKey(recordToUpdate.dress_type) !== garmentKey(dress_type)
      )) {
        throw new Error("The selected measurement context changed. Reload the customer and garment before saving.");
      }
      if (recordToUpdate?.id) {
        await updateMeasurement(recordToUpdate.id, {
          measurements: payload,
          comments,
          dress_type,
        });
      } else {
        await addMeasurements({
          customer_id,
          dress_type,
          measurements: payload,
          comments,
        });
      }
      await loadMeasurements(customer_id || selectedCustomer);
      setMeasurementModalOpen(false);
      setMessage("Measurements saved successfully");
      setMeasurementRecord(null);
    } catch (err) {
      setError(err.response?.data?.message || "Error saving measurements");
      throw err;
    } finally {
      setSavingMeasurement(false);
    }
  };

  const handleOpenPrintPreview = (item) => {
    setMeasurementPreviewMeasurement(item);
    setMeasurementPreviewCustomer(selectedCustomerObj);
    setMeasurementPreviewOpen(true);
  };


  const promptDeleteMeasurement = (item) => {
    setMeasurementDeleteTarget(item);
    setConfirmDeleteOpen(true);
  };

  const cancelDeleteMeasurement = () => {
    setConfirmDeleteOpen(false);
    setMeasurementDeleteTarget(null);
  };

  const handleDeleteMeasurement = async () => {
    if (!measurementDeleteTarget?.id) return;
    setError("");
    setMessage("");
    setSavingMeasurement(true);

    try {
      await deleteMeasurement(measurementDeleteTarget.id);
      setMessage("Measurement deleted successfully");
      await loadMeasurements(selectedCustomer);
    } catch (err) {
      setError(err.response?.data?.message || "Error deleting measurement");
    } finally {
      setSavingMeasurement(false);
      setConfirmDeleteOpen(false);
      setMeasurementDeleteTarget(null);
    }
  };

  return (
    <div className="page-measurements">
      <div className="section-header">
        <div>
          <h2>Measurements</h2>
          <p>View, add, or update customer measurements.</p>
        </div>
        <button className="button primary small" disabled={!selectedCustomer} onClick={() => { setSelectedGarment(""); setShowGarmentPicker((value) => !value); }}>
          <FaPlus /> Add Measurement
        </button>
      </div>

      {showGarmentPicker && selectedCustomer && <div className="card garment-picker">
        <label>Choose garment type<select value={selectedGarment} onChange={(event) => setSelectedGarment(event.target.value)}>
          <option value="">Select garment type</option><option value="shalwar kameez">Shalwar Qameez</option><option value="waistcoat">Waist Coat</option><option value="coat">Coat</option><option value="sherwani">Sherwani</option>
        </select></label>
        <button className="button primary small" disabled={!selectedGarment} onClick={() => {
          const garmentKey = (value) => String(value || "").toLowerCase().replace(/\s+/g, "");
          const existing = measurements.find((item) => garmentKey(item.dress_type) === garmentKey(selectedGarment));
          setShowGarmentPicker(false);
          openMeasurementModal(existing ? "update" : "add", existing || null, selectedGarment);
        }}>{measurements.some((item) => String(item.dress_type || "").toLowerCase().replace(/\s+/g, "") === selectedGarment.toLowerCase().replace(/\s+/g, "")) ? "Edit Existing Measurement" : "Continue"}</button>
      </div>}

      <NewCustomerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCustomerSave}
        loading={savingMeasurement}
        error={error}
      />

      <MeasurementModal
        open={measurementModalOpen}
        onClose={() => setMeasurementModalOpen(false)}
        onSave={handleSaveMeasurement}
        customer={selectedCustomerObj}
        customers={customers}
        mode={measurementMode}
        dressType={selectedGarment || measurementRecord?.dress_type || ""}
        initialData={measurementRecord}
        loading={savingMeasurement}
        error={error}
      />

      <div className="message-row">
        {message && <p className="message success">{message}</p>}
        {error && <p className="message error">{error}</p>}
      </div>

      <div className="card form-card">
        <div className="form-header">
          <div>
            <h3>Select Customer</h3>
            <p className="form-description">Select the customer whose measurements you want to manage.</p>
          </div>
          <button className="button secondary small" onClick={() => setModalOpen(true)}>
            <FaPlus /> New Customer
          </button>
        </div>

        <label>
          Select Customer
          <div className="customer-select-row">
            <select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)}>
              <option value="">Select customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} ({customer.phone})
                </option>
              ))}
            </select>
          </div>
        </label>
      </div>

      <div className="card measurements-card">
        <button type="button" className="measurement-card-toggle" aria-expanded={cardExpanded} onClick={() => setCardExpanded((value) => !value)}>
          {cardExpanded ? <FaChevronDown /> : <FaChevronRight />}<h3>{selectedCustomerObj ? `Measurements for ${selectedCustomerObj.name}` : "Saved Measurements"}</h3>
        </button>

        {cardExpanded && (selectedCustomer === "" ? (
          <p>Please select a customer to view measurements.</p>
        ) : loading ? (
          <p>Loading measurements...</p>
        ) : measurements.length === 0 ? (
          <p>No measurements available.</p>
        ) : (
          <div className="measurement-list">
            {measurements.map((item) => {
              const details = normalizeMeasurementData(item.measurements || item);
              const orderedFields = getOrderedMeasurementEntries(details.measurements, item.dress_type);
              return (
                <div key={item.id} className="measurement-item card small-card">
                  <div className="measurement-print-row">
                    <button type="button" className="measurement-card-toggle garment-measurement-toggle" aria-expanded={Boolean(expandedMeasurements[item.id])} onClick={() => setExpandedMeasurements((previous) => ({ ...previous, [item.id]: !previous[item.id] }))}>
                      {expandedMeasurements[item.id] ? <FaChevronDown /> : <FaChevronRight />}
                      <strong>{item.dress_type || "Measurement"}</strong>
                      <span className="measurement-date">{new Date(item.created_at).toLocaleString()}</span>
                    </button>
                    <div className="measurement-buttons">
                      <button className="button secondary small" onClick={() => openMeasurementModal("update", item)}>
                        <FaEdit /> Update
                      </button>
                      <button className="button secondary small" onClick={() => handleOpenPrintPreview(item)}>
                        <FaPrint /> Print
                      </button>

                      <button className="button danger small" onClick={() => promptDeleteMeasurement(item)}>
                        <FaTrash /> Delete
                      </button>
                    </div>
                  </div>

                  {expandedMeasurements[item.id] && <>

                  <div className="measurement-detail-cards">
                    <div className="measurement-detail-card">
                      <h4>Measurements</h4>
                      {orderedFields.map(([key, value]) => (
                        <div className="measurement-detail-row" key={key}>
                          <span>{getMeasurementLabel(key)}</span>
                          <strong>{value || "-"}</strong>
                        </div>
                      ))}
                    </div>
                  <div className="measurement-detail-card">
                    <h4>فرمائش</h4>

                    {(() => {
                      const rows = getFarmaishRows(details);

                      return (
                        <>
                          {rows.map((r, idx) => (
                            <div key={`${r.label}-${idx}`} className="measurement-detail-row">
                              <span>{r.label}</span>
                              <strong>{r.value}</strong>
                            </div>
                          ))}
                          {rows.length === 0 ? (
                            <div className="measurement-detail-row">
                              <span>کوئی فرمائش موجود نہیں</span>
                              <strong>-</strong>
                            </div>
                          ) : null}
                        </>
                      );
                    })()}
                   </div>

                  </div>
                  {details.notes ? (
                    <div className="measurement-notes-card">
                      <strong>خصوصی نوٹس</strong>
                      <p>{details.notes}</p>
                    </div>
                  ) : null}
                  </>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {confirmDeleteOpen && (
        <div className="confirm-backdrop" onClick={cancelDeleteMeasurement}>
          <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-message">Are you sure you want to delete this measurement?</p>
            <div className="confirm-actions">
              <button className="button danger" onClick={handleDeleteMeasurement} disabled={savingMeasurement}>
                Delete
              </button>
              <button className="button secondary" onClick={cancelDeleteMeasurement}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {measurementPreviewOpen && measurementPreviewMeasurement && (
        <MeasurementPreviewModal
          open={measurementPreviewOpen}
          shop={shop}
          settings={settings}
          customer={measurementPreviewCustomer}
          measurement={measurementPreviewMeasurement}
          order={customerOrders.find((item) => String(item.dress_type || "").toLowerCase().replace(/\s+/g, "") === String(measurementPreviewMeasurement.dress_type || "shalwar kameez").toLowerCase().replace(/\s+/g, "")) || null}
          onCancel={() => {
            setMeasurementPreviewOpen(false);
            setMeasurementPreviewMeasurement(null);
            setMeasurementPreviewCustomer(null);
          }}
          onEditMeasurement={() => {
            setMeasurementPreviewOpen(false);
            setMeasurementPreviewMeasurement(null);
            setMeasurementPreviewCustomer(null);
            openMeasurementModal("update", measurementPreviewMeasurement);
          }}
          onPrintMeasurement={() => {
            setMeasurementPreviewOpen(false);
            setMeasurementPreviewMeasurement(null);
            setMeasurementPreviewCustomer(null);
          }}
        />
      )}

    </div>
  );
}
