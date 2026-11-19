import { useEffect, useMemo, useRef, useState } from "react";
import {
  getFarmaishRows,
  getMeasurementLabel,
  getOrderedMeasurementEntries,
  normalizeMeasurementData,
  cleanPrintMeasurementValue,
} from "../utils/measurementUtils";
import {
  getActivePrintConfig,
  normalizePrintSettings,
  paperDimensionsMm,
  printSettingsCssVars,
} from "../utils/printConfig";

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
  const [printSettings, setPrintSettings] = useState(
    () => normalizePrintSettings(settings?.printSettings).settings,
  );
  const printCssVars = useMemo(() => printSettingsCssVars(printSettings), [printSettings]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    getActivePrintConfig()
      .then((config) => {
        if (!cancelled) setPrintSettings(config);
      })
      .catch((error) => {
        if (!cancelled) {
          setPrintError(error?.response?.data?.message || error?.message || "Unable to load the latest print settings.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

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
    .map(([key, value]) => ({ label: getMeasurementLabel(key), value: cleanPrintMeasurementValue(value) }));
  const farmaishRows = getFarmaishRows(details);
  const noteValue = measurement?.comments != null && String(measurement.comments).trim() !== ""
    ? measurement.comments
    : details.notes != null && String(details.notes).trim() !== ""
      ? details.notes
      : measurement?.measurement_notes ?? "";
  const notes = String(noteValue);
  const formatDate = (value) => {
    if (!value) return "";
    const isoDate = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("en-GB").format(date);
  };
  const bookingDate = formatDate(order?.created_at || measurement?.created_at || measurement?.date);
  const deliveryDate = formatDate(order?.delivery_date);
  const kareegarName = details.kareegar?.name;
  const kareegarRow = ["\u06a9\u0627\u0631\u06cc\u06af\u0631:", safe(kareegarName) ? kareegarName : "\u00A0"];
  const filteredRows = [
    ["\u06af\u0627\u06c1\u06a9:", customer?.name ?? "\u00A0"],
    ["Serial:", customer?.serial_number ?? "\u00A0"],
    ["B. Date:", bookingDate || "\u00A0"],
    ["Suit Quantity:", order?.suit_quantity ?? 1],
    ["Delivery:", deliveryDate || "\u00A0"],
    [kareegarRow[0], kareegarRow[1]],
  ];
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
      const activePrintConfig = await getActivePrintConfig();
      setPrintSettings(activePrintConfig);
      const { widthMm, heightMm } = paperDimensionsMm(activePrintConfig);
      let printStyle = document.getElementById("measurement-active-print-config");
      if (!printStyle) {
        printStyle = document.createElement("style");
        printStyle.id = "measurement-active-print-config";
        document.head.appendChild(printStyle);
      }
      printStyle.textContent = `:root{${printSettingsCssVars(activePrintConfig)}}@page{size:${widthMm}mm ${heightMm}mm;margin:0}`;
      const printPage = window.electronAPI?.printCurrentPage;
      if (printPage) {
        const result = await printPage(activePrintConfig);
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
              @font-face {
                font-family: "Noto Nastaliq Urdu";
                src: url("./fonts/NotoNastaliqUrdu.ttf") format("truetype");
                font-display: swap;
              }
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
                height: var(--ps-paper-h);
                min-height: 0;
                flex: 0 0 auto;
                padding: var(--ps-pad-top) var(--ps-pad-right) var(--ps-pad-bottom) var(--ps-pad-left);
                border: var(--ps-border-width) solid #111;
                background: #fff;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.14);
              }
              .measurement-preview-page {
                direction: rtl;
                box-sizing: border-box;
                display: flex;
                flex: 1 1 auto;
                flex-direction: column;
                gap: var(--ps-space-md);
                width: 100%;
                min-height: 0;
                background: #fff;
                color: #111;
                font-family: "Noto Nastaliq Urdu", "Jameel Noori Nastaleeq", "Nirmala UI", serif;
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
                display: block;
                direction: ltr;
                padding-bottom: var(--ps-space-sm);
                border-bottom: var(--ps-border-width) solid #111;
                line-height: var(--ps-line-height-135);
                min-width: 0;
              }
              .measurement-preview-meta {
                display: grid;
                grid-template-columns: repeat(var(--ps-metadata-columns), minmax(0, 1fr));
                gap: var(--ps-space-xs) var(--ps-space-sm);
                min-width: 0;
                direction: ltr;
                font-family: Arial, sans-serif;
                font-size: var(--ps-base-size);
                line-height: var(--ps-line-height-125);
              }
              .measurement-preview-meta-row {
                display: grid;
                grid-template-columns: max-content minmax(0, 1fr);
                gap: var(--ps-space-sm);
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
                overflow-wrap: normal;
                word-break: normal;
                hyphens: none;
              }
              .measurement-preview-shop {
                min-width: 0;
                direction: rtl;
                text-align: center;
                overflow-wrap: normal;
                word-break: normal;
                hyphens: none;
              }
              .measurement-preview-shop-name {
                font-family: Arial, sans-serif;
                font-size: var(--ps-shop-size);
                font-weight: 800;
                line-height: var(--ps-line-height-130);
                margin-bottom: var(--ps-space-md);
                overflow-wrap: normal;
                word-break: normal;
                hyphens: none;
              }
              .measurement-preview-kareegar {
                display: contents;
              }
              .measurement-preview-kareegar-label {
                font-weight: 700;
              }
              .measurement-preview-shop-detail {
                font-size: var(--ps-table-size);
                line-height: var(--ps-line-height-145);
                overflow-wrap: anywhere;
                word-break: break-word;
              }
              .measurement-preview-body {
                display: grid;
                grid-template-columns: minmax(0, var(--ps-body-column-fr)) minmax(0, var(--ps-other-column-fr));
                gap: var(--ps-space-md);
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
                margin: 0 0 var(--ps-space-sm);
                font-size: var(--ps-header-size);
                line-height: var(--ps-line-height-135);
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
                grid-template-columns: minmax(0, var(--ps-label-column-fr)) minmax(0, var(--ps-value-column-fr));
                min-height: 0;
              }
              .measurement-preview-label,
              .measurement-preview-value {
                box-sizing: border-box;
                display: flex;
                align-items: center;
                min-width: 0;
                border: var(--ps-border-width) solid #111;
                padding: var(--ps-cell-pad-y) var(--ps-cell-pad-x);
                font-size: var(--ps-label-size);
                line-height: var(--ps-line-height-135);
                font-weight: 750;
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
                margin: 0 0 var(--ps-space-sm);
                font-size: var(--ps-header-size);
                font-weight: var(--ps-header-weight);
                line-height: var(--ps-line-height-140);
              }
              .measurement-preview-notes {
                border: var(--ps-border-width) solid #111;
                padding: var(--ps-space-sm) var(--ps-notes-pad-x);
                font-size: var(--ps-farmaish-size);
                line-height: var(--ps-line-height-145);
                font-weight: 750;
                white-space: pre-wrap;
                overflow-wrap: anywhere;
                word-break: break-word;
              }
              .measurement-preview-footer {
                flex: 0 0 auto;
                border-top: var(--ps-border-width) solid #111;
                padding-top: var(--ps-space-md);
                text-align: center;
                direction: ltr;
                font: var(--ps-footer-size)/var(--ps-line-height-130) Arial, sans-serif;
              }
              @media (max-width: 700px) {
                .measurement-print-sheet {
                  width: 100%;
                  min-height: 0;
                }
                .measurement-preview-meta {
                  grid-template-columns: minmax(0, 1fr);
                }
              }
              @media print {
                .measurement-print-sheet {
                  width: var(--ps-paper-w) !important;
                  height: var(--ps-paper-h) !important;
                  min-height: 0 !important;
                  flex: 0 0 auto !important;
                  margin: 0 !important;
                  box-shadow: none !important;
                  break-inside: avoid;
                  page-break-after: avoid;
                }
                .measurement-preview-backdrop > .measurement-preview-dialog > div > .measurement-preview-content {
                  display: block !important;
                }
                .measurement-preview-page {
                  display: flex !important;
                  box-shadow: none !important;
                }
                .measurement-preview-header {
                  display: block !important;
                }
                .measurement-preview-meta {
                  grid-template-columns: repeat(var(--ps-metadata-columns), minmax(0, 1fr)) !important;
                }
              }
              @page {
                size: ${paperDimensionsMm(printSettings).widthMm}mm ${paperDimensionsMm(printSettings).heightMm}mm;
                margin: 0;
              }
            `}</style>
            <div className="measurement-print-sheet" ref={sheetRef}>
              <div className="measurement-preview-page">
              <div className="measurement-preview-header">
                <div className="measurement-preview-shop">
                  <div className="measurement-preview-shop-name">
                    {settings?.shopName || shop?.name || "Tailor Shop"}
                  </div>
                </div>
                <div className="measurement-preview-meta">
                  {filteredRows.map(([label, value], index) => (
                    <div
                      className="measurement-preview-meta-row"
                      key={`${label}-${index}`}
                      data-preview-customer={label === "\u06af\u0627\u06c1\u06a9:" ? "" : undefined}
                    >
                      {label ? <span className="measurement-preview-meta-label">{label}</span> : null}
                      <span className="measurement-preview-meta-value">{value ?? ""}</span>
                    </div>
                  ))}
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
