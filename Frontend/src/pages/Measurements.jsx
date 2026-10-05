import { useEffect, useState } from "react";
import { FaPlus, FaEdit, FaPrint, FaTrash } from "react-icons/fa";
import {
  getCustomers,
  getMeasurements,
  addMeasurements,
  updateMeasurement,
  deleteMeasurement,
  addCustomer,
  getSettings,
} from "../services/api";
import NewCustomerModal from "../components/NewCustomerModal";
import MeasurementModal from "../components/MeasurementModal";
import MeasurementPreviewModal from "../components/MeasurementPreviewModal";

import { normalizeMeasurementData, getFarmaishRows } from "../utils/measurementUtils";

import { useShop } from "../contexts/ShopContext";

export default function Measurements() {
  const { shop } = useShop();
  const [settings, setSettings] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedCustomerObj, setSelectedCustomerObj] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [measurementModalOpen, setMeasurementModalOpen] = useState(false);
  const [measurementMode, setMeasurementMode] = useState("add");
  const [measurementRecord, setMeasurementRecord] = useState(null);
  // (legacy state removed) measurement printing now uses MeasurementPreviewModal

  const [measurementPreviewOpen, setMeasurementPreviewOpen] = useState(false);
  const [measurementPreviewMeasurement, setMeasurementPreviewMeasurement] = useState(null);
  const [measurementPreviewCustomer, setMeasurementPreviewCustomer] = useState(null);

  const [savingMeasurement, setSavingMeasurement] = useState(false);

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
    if (!customerId) {
      setMeasurements([]);
      return;
    }

    try {
      const res = await getMeasurements(customerId);
      setMeasurements(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Measurements load failed.");
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

  const openMeasurementModal = (mode, record = null) => {
    setMeasurementMode(mode);
    setMeasurementRecord(record);
    setMeasurementModalOpen(true);
  };

  const handleSaveMeasurement = async (data) => {
    setError("");
    setMessage("");
    setSavingMeasurement(true);
    try {
      const { comments = "", measurements = null, customer_id = selectedCustomer } = data || {};
      const measurementPayload = measurements || {};
      if (measurementMode === "update" && measurementRecord?.id) {
        await updateMeasurement(measurementRecord.id, {
          measurements: measurementPayload,
          comments,
        });
      } else {
        await addMeasurements({
          customer_id,
          measurements: measurementPayload,
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
        <button className="button primary small" onClick={() => openMeasurementModal("add")}> 
          <FaPlus /> Add Measurements
        </button>
      </div>

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
        <div className="section-title">
          <h3>{selectedCustomerObj ? `Measurements for ${selectedCustomerObj.name}` : "Saved Measurements"}</h3>
          {selectedCustomer && (
            <button className="button secondary small" onClick={() => openMeasurementModal(measurements.length ? "update" : "add", measurements[0] || null)}>
              <FaEdit /> {measurements.length ? "Update Last Naap" : "Add Naap"}
            </button>
          )}
        </div>

        {selectedCustomer === "" ? (
          <p>Please select a customer to view measurements.</p>
        ) : loading ? (
          <p>Loading measurements...</p>
        ) : measurements.length === 0 ? (
          <p>Koi measurement available nahi hai.</p>
        ) : (
          <div className="measurement-list">
            {measurements.map((item) => {
              const details = normalizeMeasurementData(item.measurements || item);
              return (
                <div key={item.id} className="measurement-item card small-card">
                  <div className="measurement-print-row">
                    <p className="measurement-date">{new Date(item.created_at).toLocaleString()}</p>
                    <div className="measurement-buttons">
                      <button className="button secondary small" onClick={() => openMeasurementModal("update", item)}>
                        <FaEdit /> Update
                      </button>
                      <button className="button secondary small" onClick={() => handleOpenPrintPreview(item)}>
                        <FaPrint /> Print
                      </button>

                      <button className="button danger small" onClick={() => promptDeleteMeasurement(item)}>
                        <FaTrash /> حذف
                      </button>
                    </div>
                  </div>

                  <div className="measurement-detail-cards">
                    <div className="measurement-detail-card">
                      <h4>پیمائش</h4>
                      <div className="measurement-detail-row">
                        <span>لمبائی</span>
                        <strong>{details.measurements.lambai || "-"}</strong>
                      </div>
                      <div className="measurement-detail-row">
                        <span>بازو</span>
                        <strong>{details.measurements.bazu || "-"}</strong>
                      </div>
                      <div className="measurement-detail-row">
                        <span>تیرا</span>
                        <strong>{details.measurements.taira || "-"}</strong>
                      </div>
                      <div className="measurement-detail-row">
                        <span>کالر</span>
                        <strong>{details.measurements.collar || "-"}</strong>
                      </div>
                      <div className="measurement-detail-row">
                        <span>چھاتی</span>
                        <strong>{details.measurements.seena || "-"}</strong>
                      </div>
                      <div className="measurement-detail-row">
                        <span>ہاف چھاتی</span>
                        <strong>{details.measurements.half_seena || "-"}</strong>
                      </div>
                      <div className="measurement-detail-row">
                        <span>کمر</span>
                        <strong>{details.measurements.kamar || "-"}</strong>
                      </div>
                      <div className="measurement-detail-row">
                        <span>دامن</span>
                        <strong>{details.measurements.daaman || "-"}</strong>
                      </div>
                      <div className="measurement-detail-row">
                        <span>شلوار</span>
                        <strong>{details.measurements.shalwar || "-"}</strong>
                      </div>
                      <div className="measurement-detail-row">
                        <span>پانچہ</span>
                        <strong>{details.measurements.pancha || "-"}</strong>
                      </div>
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      {confirmDeleteOpen && (
        <div className="confirm-backdrop" onClick={cancelDeleteMeasurement}>
          <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-message">کیا آپ واقعی یہ پیمائش حذف کرنا چاہتے ہیں؟</p>
            <div className="confirm-actions">
              <button className="button danger" onClick={handleDeleteMeasurement} disabled={savingMeasurement}>
                حذف کریں
              </button>
              <button className="button secondary" onClick={cancelDeleteMeasurement}>
                منسوخ کریں
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
            // Browser prints the exact DOM currently rendered inside MeasurementPrint.
            window.print();
          }}
        />
      )}

    </div>
  );
}
