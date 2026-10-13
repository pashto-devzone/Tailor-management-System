import {
  getFarmaishRows,
  getMeasurementLabel,
  getOrderedMeasurementEntries,
  normalizeMeasurementData,
} from "../utils/measurementUtils";

export default function MeasurementPrint({ shop, settings, customer, measurement, order }) {
  if (!customer || !measurement) return null;

  const shopName = settings?.shopName || shop?.name || "Tailor Shop";
  const phone = settings?.phone || shop?.phone || "";
  const address = settings?.address || shop?.address || "";
  const footer =
    "Need a professional app or website for your business? Contact on WhatsApp: 03245020658";

  const details = normalizeMeasurementData(measurement.measurements || measurement);
  const values = details.measurements;
  // `comments` is the canonical database field. The details/legacy fields are
  // fallbacks only; combining them can print a duplicated or unrelated note.
  const noteValue = measurement.comments != null && String(measurement.comments).trim() !== ""
    ? measurement.comments
    : details.notes != null && String(details.notes).trim() !== ""
      ? details.notes
      : measurement.measurement_notes ?? measurement.comments ?? "";
  const notes = String(noteValue);
  const safe = (v) => v !== undefined && v !== null && String(v).trim() !== "";
  const displayDeliveryDate = (value) => {
    if (!value) return "";
    const isoDate = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  };
  const deliveryDateValue = displayDeliveryDate(
    order?.delivery_date ||
      measurement?.delivery_date ||
      measurement?.deliveryDate ||
      customer?.delivery_date ||
      customer?.latest_order?.delivery_date ||
      "",
  );

  const dressType = String(order?.dress_type || measurement?.dress_type || "shalwar kameez").toLowerCase().replace(/\s+/g, "");
  const measurementRows = getOrderedMeasurementEntries(values, dressType)
    .filter(([, value]) => safe(value))
    .map(([key, value]) => ({ label: getMeasurementLabel(key), value }));

  const farmaishRows = getFarmaishRows(details);

  const renderFixedTable = (rows) => (
    <table
      className="fixed-table"
      style={{ "--row-count": Math.max(rows.length, 1) }}
    >
      <tbody>
        {rows.map((row, idx) => (
          <tr className="fixed-row" key={`${row.label}-${idx}`}>
            <th className="fixed-cell fixed-label" scope="row">
              {row.label}
            </th>
            <td className="fixed-cell fixed-value">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="print-only measurement-preview-content">
      <style>{`
        .print-only {
          direction: rtl;
          font-family: "Noto Nastaliq Urdu", "Nirmala UI", Arial, Helvetica, sans-serif;
          display: block !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .measurement-preview-content {
          display: block !important;
        }

        .measurement-preview-content .print-area {
          box-sizing: border-box;
          width: calc(148mm - 8px);
          max-width: none;
          margin: 0 auto;
          padding: 0;
          background: #fff;
        }

        .measurement-print-card {
          width: 100%;
          max-width: 100%;
          margin: 0 auto;
          box-sizing: border-box;
          border: 1.2px solid #111;
          padding: 3mm;
          color: #000;
          background: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          display: flex;
          flex-direction: column;
          gap: 2mm;
          min-height: 0;
          height: calc(210mm - 8px);
        }

        .measurement-preview-content .measurement-print-card {
          width: calc(148mm - 8px);
          max-width: none;
          height: calc(210mm - 8px);
          margin: 0;
          padding: 2mm;
          border: 1.2px solid #111;
          background: #fff;
        }

        .print-header {
          display: grid;
          grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
          direction: ltr;
          gap: 8px;
          align-items: flex-start;
          padding-bottom: 6px;
          border-bottom: 1px solid #111;
          line-height: 1.7;
          min-width: 0;
        }

        .print-shop-info {
          min-width: 0;
          direction: rtl;
          text-align: right;
          unicode-bidi: plaintext;
        }

        .print-header-fields {
          min-width: 0;
          direction: ltr;
          unicode-bidi: isolate;
        }

        .print-header-title {
          font-weight: 800;
          font-size: 22px;
          margin-bottom: 2px;
          line-height: 1.1;
        }

        .print-mini {
          font-size: 11pt;
          line-height: 1.7;
          margin-top: 1px;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .print-meta-grid {
          margin-top: 1px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 4px 6px;
          font-size: 11pt;
          min-width: 0;
          direction: ltr;
        }

        .meta-row {
          display: flex;
          justify-content: space-between;
          gap: 6px;
          line-height: 1.5;
          direction: ltr;
          unicode-bidi: isolate;
          min-width: 0;
          overflow-wrap: normal;
          word-break: normal;
        }
        .meta-label { font-weight: 700; }
        .meta-value { font-weight: 500; }
        .meta-label, .meta-value {
          direction: ltr;
          unicode-bidi: isolate;
        }
        .meta-label {
          flex: 0 0 auto;
          white-space: nowrap;
        }
        .meta-value {
          min-width: 0;
          text-align: right;
          unicode-bidi: plaintext;
          overflow-wrap: break-word;
          word-break: normal;
        }
        .meta-label[dir="rtl"] {
          direction: rtl;
          unicode-bidi: isolate;
        }

        .print-body {
          display: grid;
          grid-template-columns: minmax(0, 35fr) minmax(0, 65fr);
          align-items: stretch;
          gap: 2mm;
          flex: 1 1 auto;
          width: 100%;
          min-height: 0;
          height: auto;
        }

        .print-body-section {
          min-width: 0;
          display: flex;
          flex-direction: column;
          min-height: 0;
          height: 100%;
        }

        .section-title {
          font-size: 18px;
          font-weight: 800;
          margin: 0 0 6px;
          text-align: right;
          line-height: 1.2;
        }

        .fixed-table {
          box-sizing: border-box;
          display: grid;
          grid-template-rows: minmax(0, 1fr);
          width: 100%;
          flex: 1 1 0;
          min-height: 0;
          height: 100%;
          direction: rtl;
        }

        .fixed-table tbody {
          display: grid;
          grid-template-rows: repeat(var(--row-count), minmax(0, 1fr));
          min-height: 0;
        }

        .fixed-row {
          display: grid;
          grid-template-columns: 38% 62%;
          min-height: 0;
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .fixed-cell {
          box-sizing: border-box;
          border: 1px solid #111;
          padding: 2px 4px;
          font-size: 18px;
          line-height: 1.3;
          vertical-align: middle;
          overflow-wrap: anywhere;
          word-break: break-word;
          white-space: normal;
          font-weight: 700;
          color: #111;
        }

        .fixed-label {
          justify-content: center;
          font-weight: 800;
          background: #fafafa;
          text-align: right;
        }

        .fixed-value {
          justify-content: flex-end;
          text-align: right;
          font-weight: 800;
        }

        .notes-block {
          border: 1px solid #111;
          padding: 1.5mm 2mm;
          font-size: 11pt;
          font-weight: 700;
          line-height: 1.3;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .print-footer {
          margin-top: 0;
          font-size: 12px;
          text-align: center;
          border-top: 1px solid #111;
          padding-top: 6px;
        }

        .print-footer p {
          margin: 0;
        }

        @page {
          size: A5 portrait;
          margin: 4px;
        }

        @media print {
          .measurement-preview-backdrop,
          .measurement-preview-backdrop * {
            visibility: visible !important;
          }
          .measurement-preview-backdrop {
            display: block !important;
            position: static !important;
            inset: auto !important;
            padding: 0 !important;
            background: transparent !important;
          }
          .measurement-preview-backdrop > .measurement-preview-dialog {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
          }
          .measurement-preview-dialog > div {
            height: auto !important;
            overflow: visible !important;
            padding: 0 !important;
          }
          html, body {
            width: auto !important;
            height: auto !important;
            margin: 0 !important;
            overflow: visible !important;
          }

          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .modal-backdrop,
          .modal-card:not(.measurement-preview-dialog),
          .preview-actions,
          .modal-actions {
            display: none !important;
            visibility: hidden !important;
          }

          .measurement-preview-content {
            display: block !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            visibility: visible !important;
          }

          .measurement-preview-backdrop .print-area {
            display: block !important;
            position: static !important;
            inset: auto !important;
            padding: 0 !important;
            background: #fff !important;
          }

          .measurement-preview-content .print-area {
            width: 100% !important;
            max-width: none !important;
          }

          .print-only.measurement-preview-content {
            position: static !important;
            inset: auto !important;
            width: 100% !important;
            height: auto !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            visibility: visible !important;
            display: block !important;
          }

          .measurement-print-card {
            display: flex !important;
            box-sizing: border-box !important;
            width: 100% !important;
            min-height: 0 !important;
            height: calc(210mm - 8px) !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 2mm !important;
            border: 1.2px solid #000 !important;
            box-shadow: none !important;
            overflow: hidden !important;
          }

          .print-body {
            display: grid !important;
            grid-template-columns: minmax(0, 35fr) minmax(0, 65fr) !important;
            width: 100% !important;
            flex: 1 1 0 !important;
            min-height: 0 !important;
            height: auto !important;
            align-items: stretch !important;
          }

          .print-body-section {
            display: flex !important;
            flex-direction: column !important;
            min-width: 0 !important;
            min-height: 0 !important;
            width: auto !important;
            max-width: none !important;
            height: 100% !important;
          }

          .fixed-table {
            display: grid !important;
            width: 100% !important;
            height: 100% !important;
            min-height: 0 !important;
            flex: 1 1 0 !important;
            grid-template-rows: minmax(0, 1fr) !important;
          }

          .fixed-table tbody {
            display: grid !important;
            height: 100% !important;
            min-height: 0 !important;
            grid-template-rows: repeat(var(--row-count), minmax(0, 1fr)) !important;
          }

          .fixed-row {
            display: grid !important;
            grid-template-columns: 38% 62% !important;
            min-height: 0 !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .fixed-cell {
            padding: 2px 4px;
            font-size: 10pt !important;
            font-weight: 700;
            line-height: 1.15;
            vertical-align: middle;
            white-space: normal !important;
            overflow-wrap: anywhere;
            word-break: break-word;
          }

          .fixed-label,
          .fixed-value {
            font-weight: 800 !important;
          }

          .notes-block {
            white-space: pre-wrap !important;
            overflow-wrap: anywhere;
            word-break: break-word;
          }
        }
      `}</style>

      <div className="print-area">
        <div className="print-card measurement-print-card">
          <div className="print-header">
            <div className="print-shop-info">
              <div className="print-header-title">{shopName}</div>
              {address ? <div className="print-mini">{"\u067e\u062a\u06c1:"} <bdi dir="auto">{address}</bdi></div> : null}
              {phone ? <div className="print-mini">{"\u062f\u06a9\u0627\u0646 \u0641\u0648\u0646:"} <bdi dir="auto">{phone}</bdi></div> : null}
            </div>

            <div className="print-header-fields">
              <div className="print-meta-grid">
                <div className="meta-row" data-print-customer>
                  <span className="meta-label" dir="rtl">{"\u06af\u0627\u06c1\u06a9:"}</span>
                  <span className="meta-value" dir="auto">{customer?.name || ""}</span>
                </div>
                {safe(customer?.phone) ? (
                  <div className="meta-row" data-print-phone>
                    <span className="meta-label" dir="rtl">{"\u0641\u0648\u0646 \u0646\u0645\u0628\u0631:"}</span>
                    <span className="meta-value" dir="auto">{customer.phone}</span>
                  </div>
                ) : null}
                {safe(customer?.serial_number) ? (
                  <div className="meta-row">
                    <span className="meta-label">Serial:</span>
                    <span className="meta-value">{customer.serial_number}</span>
                  </div>
                ) : null}
                {safe(order?.order_number) ? (
                  <div className="meta-row">
                    <span className="meta-label">Order Number:</span>
                    <span className="meta-value">{order.order_number}</span>
                  </div>
                ) : null}
                <div className="meta-row">
                  <span className="meta-label">Date:</span>
                  <span className="meta-value">
                    {new Intl.DateTimeFormat("en-GB").format(new Date())}
                  </span>
                </div>
                {safe(deliveryDateValue) ? (
                  <div className="meta-row">
                    <span className="meta-label">Delivery:</span>
                    <span className="meta-value">{deliveryDateValue}</span>
                  </div>
                ) : null}
                <div className="meta-row"><span className="meta-label">Garment Type:</span><span className="meta-value">{order?.dress_type || measurement?.dress_type || ""}</span></div>
                <div className="meta-row"><span className="meta-label">Suit Quantity:</span><span className="meta-value">{order?.suit_quantity ?? 1}</span></div>
              </div>
            </div>
          </div>

          <div className="print-body">
            <div className="print-body-section" style={{ display: "flex", flexDirection: "column" }}>
              <div className="section-title">{"\u067e\u06cc\u0645\u0627\u0626\u0634"}</div>
              {renderFixedTable(measurementRows)}
            </div>

            <div className="print-body-section" style={{ display: "flex", flexDirection: "column" }}>
              <div className="section-title">{"\u0641\u0631\u0645\u0627\u0626\u0634"}</div>
              {renderFixedTable(farmaishRows)}
            </div>
          </div>

          {notes ? (
            <div>
              <div className="section-title" style={{ fontSize: 17, marginTop: 2 }}>
                {"\u062e\u0635\u0648\u0635\u06cc \u0646\u0648\u0679\u0633:"}
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
