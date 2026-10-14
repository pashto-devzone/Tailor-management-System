import { useEffect, useMemo, useRef, useState } from "react";
import {
  getFarmaishRows,
  getMeasurementLabel,
  getOrderedMeasurementEntries,
  normalizeMeasurementData,
} from "../utils/measurementUtils";
import { normalizePrintSettings, printSettingsCssVars } from "../utils/printConfig";

export default function MeasurementPreviewModal({
  open,
  onCancel,
  onEditMeasurement,
  onPrintMeasurement,
  shop,
  settings,
  customer,
  measurement,
  order,
  isPrintingDisabled = false,
  title = "Measurement Preview",
}) {
  const [printError, setPrintError] = useState("");
  const [printing, setPrinting] = useState(false);
  const [contentOverflows, setContentOverflows] = useState(false);
  const printInFlight = useRef(false);
  const sheetRef = useRef(null);

  // One configuration-to-print path: the saved Print Settings (or the safe
  // defaults) drive this preview AND the Electron print document. The same
  // resolved object is passed to webContents.print via IPC.
  const printSettings = useMemo(
    () => normalizePrintSettings(settings?.printSettings).settings,
    [settings?.printSettings],
  );
  const printCssVars = useMemo(() => printSettingsCssVars(printSettings), [printSettings]);

  // Report (instead of silently clipping) when the complete slip is taller
  // than the selected paper. Measures the natural height after Urdu fonts
  // are ready.
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const measure = async () => {
      try {
        if (document.fonts?.ready) await document.fonts.ready;
      } catch (_) {}
      if (cancelled) return;
      const sheet = sheetRef.current;
      if (!sheet) return;
      const paperMm = parseFloat(getComputedStyle(sheet).getPropertyValue("--ps-paper-h")) || 0;
      const paperPx = paperMm * (96 / 25.4);
      const prevHeight = sheet.style.height;
      sheet.style.height = "auto";
      const naturalPx = sheet.scrollHeight;
      sheet.style.height = prevHeight;
      if (!cancelled) setContentOverflows(paperPx > 0 && naturalPx > paperPx + 4);
    };
    const raf = requestAnimationFrame(measure);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [open, printSettings]);

  const details = normalizeMeasurementData(measurement?.measurements || measurement || {});
  const safe = (value) => value !== undefined && value !== null && String(value).trim() !== "";
  const dressType = String(order?.dress_type || measurement?.dress_type || "shalwar kameez")
    .toLowerCase()
    .replace(/\s+/g, "");
  const measurementRows = getOrderedMeasurementEntries(details.measurements, dressType)
    .filter(([, value]) => safe(value))
    .map(([key, value]) => ({ label: getMeasurementLabel(key), value }));
  const farmaishRows = getFarmaishRows(details);
  const noteValue = measurement?.comments != null && String(measurement.comments).trim() !== ""
    ? measurement.comments
    : details.notes != null && String(details.notes).trim() !== ""
      ? details.notes
      : measurement?.measurement_notes ?? "";
  const notes = String(noteValue);
  const dateLabel = new Intl.DateTimeFormat("en-GB").format(new Date());
  const deliveryRaw = order?.delivery_date || measurement?.delivery_date || measurement?.deliveryDate ||
    customer?.delivery_date || customer?.latest_order?.delivery_date || "";
  const isoDeliveryDate = String(deliveryRaw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const deliveryDate = !deliveryRaw
    ? ""
    : isoDeliveryDate
      ? `${isoDeliveryDate[3]}/${isoDeliveryDate[2]}/${isoDeliveryDate[1]}`
      : Number.isNaN(new Date(deliveryRaw).getTime())
        ? String(deliveryRaw)
        : new Intl.DateTimeFormat("en-GB").format(new Date(deliveryRaw));
  const previewMetaRows = [
    ["\u06af\u0627\u06c1\u06a9:", customer?.name],
    ["\u0641\u0648\u0646 \u0646\u0645\u0628\u0631:", customer?.phone],
    ["Serial:", customer?.serial_number],
    ["Order Number:", order?.order_number],
    ["Date:", dateLabel],
    ["Delivery:", deliveryDate],
    ["Garment Type:", order?.dress_type || measurement?.dress_type],
    ["Suit Quantity:", order?.suit_quantity ?? 1],
  ].filter(([, value]) => safe(value));
  const renderPreviewTable = (rows, variant) => (
    <div
      className={`measurement-preview-table${variant ? ` measurement-preview-table--${variant}` : ""}`}
      style={{ "--preview-row-count": Math.max(rows.length, 1) }}
    >
      {rows.map((row, index) => (
        <div className="measurement-preview-row" key={`${row.label}-${index}`}>
          <div className="measurement-preview-label">{row.label}</div>
          <div className="measurement-preview-value">{row.value}</div>
        </div>
      ))}
    </div>
  );

  if (!open) return null;

  const handlePrint = async () => {
    if (printInFlight.current || isPrintingDisabled) return;
    printInFlight.current = true;
    setPrintError("");
    setPrinting(true);
    try {
      const printPage = window.electronAPI?.printCurrentPage;
      if (printPage) {
        const result = await printPage(printSettings);
        if (result?.canceled) return;
        if (result?.ok === false) {
          throw new Error(result.message || "Electron could not start printing.");
        }
      } else {
        window.print();
      }
      // The Electron callback resolves after the dialog completes. It is used
      // by the caller only to release preview state; it must never print again.
      onPrintMeasurement?.();
    } catch (error) {
      setPrintError(error?.message || "Unable to print this measurement.");
    } finally {
      setPrinting(false);
      printInFlight.current = false;
    }
  };

  return (
    <div className="modal-backdrop measurement-preview-backdrop" onClick={onCancel}>
      <div
        className="modal-card measurement-preview-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 1200 }}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button type="button" className="icon-button" onClick={onCancel} aria-label="Close">×</button>
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
          <div
            className="measurement-preview-content"
            style={{
              flex: 1,
              overflowY: "auto",
              width: "100%",
              height: "100%",
            }}
          >
            <style>{`
              .measurement-preview-content {
                display: flex;
                justify-content: center;
                align-items: flex-start;
                overflow: auto;
                padding: 8px 0;
                box-sizing: border-box;
              }
              .measurement-preview-backdrop > .measurement-preview-dialog > div > .measurement-preview-content {
                display: flex !important;
              }
              :root {
                ${printCssVars};
              }
              .measurement-print-sheet {
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                width: var(--ps-paper-w);
                min-height: var(--ps-paper-h);
                padding: var(--ps-pad-top) var(--ps-pad-right) var(--ps-pad-bottom) var(--ps-pad-left);
                border: 1px solid #111;
                background: #fff;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.14);
              }
              .measurement-preview-page {
                direction: rtl;
                box-sizing: border-box;
                display: flex;
                flex: 1 1 auto;
                flex-direction: column;
                gap: 1.5mm;
                width: 100%;
                min-height: 0;
                background: #fff;
                color: #111;
                font-family: "Noto Nastaliq Urdu", "Nirmala UI", Arial, sans-serif;
              }
              .measurement-print-fit-warning {
                box-sizing: border-box;
                width: var(--ps-paper-w);
                margin: 6px auto 0;
                padding: 6px 8px;
                border: 1px solid #d97706;
                background: #fffbeb;
                color: #92400e;
                font: 600 13px/1.4 Arial, sans-serif;
                text-align: center;
              }
              @media print {
                .measurement-print-fit-warning { display: none !important; }
              }
              .measurement-preview-header {
                display: grid;
                grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.75fr);
                gap: 3mm;
                align-items: start;
                direction: ltr;
                padding-bottom: 2mm;
                border-bottom: 1px solid #111;
                line-height: 1.65;
                min-width: 0;
              }
              .measurement-preview-meta {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 1mm 1.5mm;
                min-width: 0;
                direction: ltr;
                font-family: Arial, sans-serif;
                font-size: var(--ps-table-size);
                line-height: 1.3;
              }
              .measurement-preview-meta-row {
                display: grid;
                grid-template-columns: max-content minmax(0, 1fr);
                gap: 1.5mm;
                min-width: 0;
                direction: ltr;
                unicode-bidi: isolate;
              }
              .measurement-preview-meta-label {
                font-weight: 700;
                white-space: nowrap;
              }
              .measurement-preview-meta-value {
                min-width: 0;
                overflow-wrap: anywhere;
                word-break: break-word;
              }
              .measurement-preview-shop {
                min-width: 0;
                direction: rtl;
                text-align: right;
                overflow-wrap: anywhere;
                word-break: break-word;
              }
              .measurement-preview-shop-name {
                font-family: Arial, sans-serif;
                font-size: var(--ps-header-size);
                font-weight: var(--ps-header-weight);
                line-height: 1.3;
                margin-bottom: 1mm;
              }
              .measurement-preview-shop-detail {
                font-size: var(--ps-table-size);
                line-height: 1.45;
                overflow-wrap: anywhere;
                word-break: break-word;
              }
              .measurement-preview-body {
                display: grid;
                grid-template-columns: minmax(0, 35fr) minmax(0, 65fr);
                gap: 2mm;
                flex: 1 1 auto;
                min-height: 0;
              }
              .measurement-preview-section {
                display: flex;
                flex-direction: column;
                min-width: 0;
                min-height: 0;
              }
              .measurement-preview-section-title {
                flex: 0 0 auto;
                margin: 0 0 1mm;
                font-size: var(--ps-header-size);
                line-height: 1.35;
                font-weight: var(--ps-header-weight);
                text-align: right;
              }
              .measurement-preview-table {
                display: grid;
                grid-template-rows: repeat(var(--preview-row-count), minmax(0, 1fr));
                flex: 1 1 0;
                min-height: 0;
                width: 100%;
              }
              .measurement-preview-row {
                display: grid;
                grid-template-columns: 38% 62%;
                min-height: 0;
              }
              .measurement-preview-label,
              .measurement-preview-value {
                box-sizing: border-box;
                display: flex;
                align-items: center;
                min-width: 0;
                border: 1px solid #111;
                padding: 0.6mm 1mm;
                font-size: var(--ps-table-size);
                line-height: 1.35;
                font-weight: 700;
                overflow-wrap: anywhere;
                word-break: break-word;
              }
              .measurement-preview-table--farmaish .measurement-preview-label,
              .measurement-preview-table--farmaish .measurement-preview-value {
                font-size: var(--ps-farmaish-size);
              }
              .measurement-preview-label {
                justify-content: flex-start;
                background: #fafafa;
              }
              .measurement-preview-value {
                justify-content: flex-end;
                text-align: right;
              }
              .measurement-preview-notes-title {
                margin: 0 0 1mm;
                font-size: var(--ps-header-size);
                font-weight: var(--ps-header-weight);
                line-height: 1.4;
              }
              .measurement-preview-notes {
                border: 1px solid #111;
                padding: 1mm 1.5mm;
                font-size: var(--ps-table-size);
                line-height: 1.45;
                font-weight: 700;
                white-space: pre-wrap;
                overflow-wrap: anywhere;
                word-break: break-word;
              }
              .measurement-preview-footer {
                flex: 0 0 auto;
                border-top: 1px solid #111;
                padding-top: 1.5mm;
                text-align: center;
                direction: ltr;
                font: 8.5pt/1.3 Arial, sans-serif;
              }
              @media (max-width: 700px) {
                .measurement-print-sheet {
                  width: 100%;
                  min-height: 0;
                }
                .measurement-preview-header {
                  grid-template-columns: minmax(0, 1fr) minmax(0, 0.72fr);
                }
                .measurement-preview-meta {
                  grid-template-columns: minmax(0, 1fr);
                }
              }
              @media print {
                .measurement-preview-backdrop > .measurement-preview-dialog > div > .measurement-preview-content {
                  display: block !important;
                }
                .measurement-preview-page {
                  display: flex !important;
                  box-shadow: none !important;
                }
                .measurement-preview-header {
                  grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.75fr) !important;
                }
                .measurement-preview-meta {
                  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                }
              }
            `}</style>
            <div className="measurement-print-sheet" ref={sheetRef}>
              <div className="measurement-preview-page">
              <div className="measurement-preview-header">
                <div className="measurement-preview-meta">
                  {previewMetaRows.map(([label, value]) => (
                    <div
                      className="measurement-preview-meta-row"
                      key={label}
                      data-preview-customer={label === "\u06af\u0627\u06c1\u06a9:" ? "" : undefined}
                    >
                      <span className="measurement-preview-meta-label">{label}</span>
                      <span className="measurement-preview-meta-value">{value ?? ""}</span>
                    </div>
                  ))}
                </div>
                <div className="measurement-preview-shop">
                  <div className="measurement-preview-shop-name">
                    {settings?.shopName || shop?.name || "Tailor Shop"}
                  </div>
                  {(settings?.address || shop?.address) ? (
                    <div className="measurement-preview-shop-detail">{"\u067e\u062a\u06c1:"} {settings?.address || shop?.address}</div>
                  ) : null}
                  {(settings?.phone || shop?.phone) ? (
                    <div className="measurement-preview-shop-detail">{"\u062f\u06a9\u0627\u0646 \u0641\u0648\u0646:"} {settings?.phone || shop?.phone}</div>
                  ) : null}
                </div>
              </div>

              <div className="measurement-preview-body">
                <section className="measurement-preview-section">
                  <h4 className="measurement-preview-section-title">{"\u067e\u06cc\u0645\u0627\u0626\u0634"}</h4>
                  {renderPreviewTable(measurementRows)}
                </section>
                <section className="measurement-preview-section">
                  <h4 className="measurement-preview-section-title">{"\u0641\u0631\u0645\u0627\u0626\u0634"}</h4>
                  {renderPreviewTable(farmaishRows, "farmaish")}
                </section>
              </div>

              {notes ? (
                <section>
                  <h4 className="measurement-preview-notes-title">{"\u062e\u0635\u0648\u0635\u06cc \u0646\u0648\u0679\u0633:"}</h4>
                  <div className="measurement-preview-notes">{notes}</div>
                </section>
              ) : null}

              <div className="measurement-preview-footer">
                Need a professional app or website for your business? Contact on WhatsApp: 03245020658
              </div>
              </div>
            </div>
            {contentOverflows ? (
              <div className="measurement-print-fit-warning" role="alert">
                ⚠ This measurement slip does not fit the selected paper size — printing will
                clip the bottom. Increase the paper size, reduce margins, or lower the font
                sizes in Settings → Print Settings.
              </div>
            ) : null}
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
                onClick={handlePrint}
                disabled={isPrintingDisabled || printing}
              >
                {printing ? "Preparing Print..." : "Print Measurement"}
              </button>

              <button
                type="button"
                className="button secondary"
                onClick={onCancel}
              >
                Cancel
              </button>
            </div>
            {printError ? (
              <p role="alert" style={{ color: "#b91c1c", margin: "8px 0 0" }}>
                {printError}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// prop-types removed to avoid missing dependency.


