import MeasurementPrint from "./MeasurementPrint";


export default function MeasurementPreviewModal({
  open,
  onCancel,
  onEditMeasurement,
  onPrintMeasurement,
  shop,
  settings,
  customer,
  measurement,
  isPrintingDisabled = false,
  title = "Measurement Preview",
}) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 1200 }}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button
            type="button"
            className="icon-button"
            onClick={onCancel}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div
          style={{
            padding: "0 1rem 1rem",
            width: "100%",
            height: "80vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Exact printable layout comes from MeasurementPrint */}
          <div
            className="measurement-preview-content"
            style={{
              flex: 1,
              overflowY: "auto",
              width: "100%",
              height: "100%",
            }}
          >
            <div style={{ width: "100%", height: "auto" }}>
              <MeasurementPrint
                shop={shop}
                settings={settings}
                customer={customer}
                measurement={measurement}
              />
            </div>
          </div>

          <div
            className="preview-actions"
            style={{
              position: "sticky",
              bottom: 0,
              background: "#fff",
              borderTop: "1px solid #ddd",
              padding: 12,
              zIndex: 10,
            }}
          >
            <div className="modal-actions" style={{ marginTop: 0 }}>
              <button
                type="button"
                className="button secondary"
                onClick={onEditMeasurement}
              >
                Edit Measurement
              </button>

              <button
                type="button"
                className="button primary"
                onClick={onPrintMeasurement}
                disabled={isPrintingDisabled}
              >
                Print Measurement
              </button>

              <button
                type="button"
                className="button secondary"
                onClick={onCancel}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// prop-types removed to avoid missing dependency.


