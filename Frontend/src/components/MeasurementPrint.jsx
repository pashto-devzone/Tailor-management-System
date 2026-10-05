import { normalizeMeasurementData, getFarmaishRows } from "../utils/measurementUtils";

export default function MeasurementPrint({ shop, settings, customer, measurement }) {
  if (!customer || !measurement) return null;

  const shopName = settings?.shopName || shop?.name || "Tailor Shop";
  const phone = settings?.phone || shop?.phone || "";
  const address = settings?.address || shop?.address || "";
  const footer =
    "Need a professional app or website for your business? Contact on WhatsApp: 03245020658";

  const details = normalizeMeasurementData(measurement.measurements || measurement);
  const values = details.measurements;
  const notes = details.notes || measurement.comments || "";

  const safe = (v) => v !== undefined && v !== null && String(v).trim() !== "";

  // --------------------
  // MEASUREMENTS (fixed order, fixed list)
  // --------------------
  const measurementRows = [
    { label: "لمبائی", value: values.lambai },
    { label: "بازو", value: values.bazu },
    { label: "تیرا", value: values.taira },
    { label: "کالر", value: values.collar },
    { label: "چھاتی", value: values.seena },
    { label: "ہاف چھاتی", value: values.half_seena },
    { label: "کمر", value: values.kamar },
    { label: "دامن", value: values.daaman },
    { label: "شلوار", value: values.shalwar },
    { label: "پانچہ", value: values.pancha },
  ].filter((r) => safe(r.value));

  const farmaishRows = getFarmaishRows(details);

  const renderFixedTable = (rows) => (
    <div className="fixed-table" role="table">
      {rows.map((r, idx) => (
        <div className="fixed-row" role="row" key={`${r.label}-${idx}`}>
          <div className="fixed-cell fixed-label" role="cell">
            {r.label}
          </div>
          <div className="fixed-cell fixed-value" role="cell">
            {r.value}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="print-only measurement-preview-content">
      <style>{`
        .print-only {
          direction: rtl;
          font-family: Arial, Helvetica, sans-serif;
          display: block !important;
        }
        .measurement-preview-content {
          display: block !important;
        }

        @media all {
          .print-only { display: block !important; }
        }

        .measurement-print-card {
          width: 70%;
          max-width: 70%;
          margin: 0 auto;
          box-sizing: border-box;
          border: 1.2px solid #111;
          padding: 6px 6px;
          color: #000;
          background: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-height: 94vh;
        }


        .print-header {
          display: flex;
          justify-content: space-between;
          gap: 6px;
          align-items: flex-start;
        }

        .print-header-title {
          font-weight: 800;
          font-size: 19px;
          margin-bottom: 1px;
          line-height: 1.05;
        }


        .print-mini {
          font-size: 14px;
          line-height: 1.25;
          margin-top: 1px;
        }

        .print-meta-grid {
          margin-top: 1px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2px 6px;
        }

        .meta-row {
          display: flex;
          justify-content: space-between;
          gap: 6px;
          font-size: 14px;
          line-height: 1.1;
        }
        .meta-label { font-weight: 700; }
        .meta-value { font-weight: 500; }

        .print-body {
          display: flex;
          flex-direction: column;
          gap: 16px;
          align-items: stretch;
        }

        .section-title {
          font-size: 20px;
          font-weight: 800;
          margin: 0;
          text-align: right;
        }

        .fixed-table {
          width: 100%;
          border: 0;
          display: flex;
          flex-direction: column;
        }

        .fixed-row {
          display: flex;
          width: 100%;
          border-bottom: 1px solid #111;
          min-height: 35px;
        }

        .fixed-row:last-child {
          border-bottom: 1px solid #111;
        }

        .fixed-cell {
          box-sizing: border-box;
          padding: 3px 4px;
          font-size: 18px;
          line-height: 1.18;
          display: flex;
          align-items: center;
          overflow-wrap: anywhere;
          word-break: break-word;
          white-space: normal;
        }


        .fixed-label {
          flex: 0 0 42%;
          border: 1px solid #111;
          border-right: 1px solid #111;
          justify-content: center;
          font-weight: 800;
        }

        .fixed-value {
          flex: 0 0 58%;
          border: 1px solid #111;
          border-left: 0;
          justify-content: flex-end;
          text-align: right;
          font-weight: 600;
          padding: 2px 4px;
        }

        .notes-block {
          border: 1px solid #111;
          padding: 3px 5px;
          font-size: 14px;
          line-height: 1.25;
          white-space: pre-wrap;
        }

        .print-footer {
          margin-top: 0;
          font-size: 12px;
          text-align: center;
        }

        @media print {
          .modal-actions { display: none !important; }
          .print-only { width: 100%; }
          .measurement-print-card { width: 70%; max-width: 70%; border: 1.2px solid #000; }
        }
      `}</style>

      <div className="print-area">
        <div className="print-card measurement-print-card">
          <div className="print-header">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="print-header-title">{shopName}</div>
              {address ? <div className="print-mini">پتہ: {address}</div> : null}
              {phone ? <div className="print-mini">فون نمبر: {phone}</div> : null}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="print-meta-grid">
                <div className="meta-row">
                  <span className="meta-label">کسٹمر :</span>
                  <span className="meta-value">{customer?.name || ""}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">سیریل :</span>
                  <span className="meta-value">{customer?.serial_number || ""}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">آرڈر نمبر :</span>
                  <span className="meta-value">{measurement?.order_number || measurement?.orderId || measurement?.orderIdNumber || ""}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">تاریخ :</span>
                  <span className="meta-value">
                    {measurement.created_at ? new Date(measurement.created_at).toLocaleDateString() : ""}
                  </span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">ڈیلیوری :</span>
                  <span className="meta-value">
                    {measurement.delivery_date ? new Date(measurement.delivery_date).toLocaleDateString() : ""}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="print-body">
            <div>
              <div className="section-title">پیمائش</div>
              {renderFixedTable(measurementRows)}
            </div>

            <div>
              <div className="section-title">فرمائش</div>
              {renderFixedTable(farmaishRows)}
            </div>
          </div>

          {notes ? (
            <div>
              <div className="section-title" style={{ fontSize: 17, marginTop: 2 }}>
                خصوصی نوٹس :
              </div>
              <div className="notes-block">{notes}</div>
            </div>
          ) : null}

          <div className="print-footer">
            <p>{footer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}



