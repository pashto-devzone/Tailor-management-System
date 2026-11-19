import { getSettings } from "../services/api";

/**
 * Shared print configuration for the desktop measurement-slip printing flow.
 *
 * Single source of truth for paper presets, validation, unit conversion and
 * the layout values that drive both the on-screen preview and the real print
 * document. The resolved settings are:
 *   1. edited in Settings -> Print Settings (PrintSettingsSection.jsx),
 *   2. applied to the measurement preview via CSS custom properties
 *      (MeasurementPreviewModal.jsx),
 *   3. passed over IPC to electron/main.js, which maps them to the @page
 *      rule, the print-sheet geometry and the webContents.print /
 *      printToPDF page options.
 *
 * All canonical lengths are stored in millimeters and all font sizes in
 * points. The unit selector only changes how values are displayed.
 */

export const MM_PER_INCH = 25.4;

/** Paper-size presets. Orientation (portrait/landscape) swaps w/h. */
export const PRINT_PAPER_PRESETS = {
  slip: { id: "slip", label: "Custom Slip — 4.25 × 5.75 in (default)", widthMm: 107.95, heightMm: 146.05 },
  sixByEight: { id: "sixByEight", label: "6 × 8 in — 152.4 × 203.2 mm", widthMm: 152.4, heightMm: 203.2 },
  a5: { id: "a5", label: "A5 — 148 × 210 mm", widthMm: 148, heightMm: 210 },
  a4: { id: "a4", label: "A4 — 210 × 297 mm", widthMm: 210, heightMm: 297 },
  custom: { id: "custom", label: "Custom size", widthMm: null, heightMm: null },
};

export const DEFAULT_PRINT_SETTINGS = {
  paper: "slip",
  orientation: "portrait",
  unit: "mm",
  // Stored canonically in millimeters regardless of the display unit.
  customWidthMm: 107.95,
  customHeightMm: 146.05,
  // Printer-safe inset for the default 4.25 x 5.75 in slip. Increase in
  // Settings if the physical printer's unprintable edge clips content.
  marginTop: 2.5,
  marginBottom: 2.5,
  marginLeft: 2.5,
  marginRight: 2.5,
  // Extra padding inside the margins (applied to the print sheet).
  innerPadding: 0.5,
  borderWidth: 0.3,
  rowSpacing: 1.5,
  bodyColumnWidth: 42,
  labelColumnWidth: 44,
  metadataColumns: 3,
  lineHeightScale: 100,
  // Header and table fonts scale together from the selected paper size.
  baseFontSize: 12.2,
  headerFontSize: 13.3,
  headerFontWeight: 700,
  labelFontSize: 12.2,
  valueFontSize: 12.2,
  farmaishFontSize: 12.2,
  footerFontSize: 8.5,
};

export const PRINT_LIMITS = {
  paperMinMm: 20,
  paperMaxMm: 600,
  marginMin: 0,
  marginMax: 30,
  innerPaddingMin: 0,
  innerPaddingMax: 10,
  borderWidthMin: 0,
  borderWidthMax: 2,
  rowSpacingMin: 0,
  rowSpacingMax: 10,
  headerFontMin: 6,
  headerFontMax: 22,
  baseFontMin: 6,
  baseFontMax: 22,
  footerFontMin: 6,
  footerFontMax: 14,
  lineHeightMin: 70,
  lineHeightMax: 160,
  metadataColumnsMin: 1,
  metadataColumnsMax: 6,
  // Keep large selections usable on the smallest supported slip.
  tableFontMin: 6,
  tableFontMax: 22,
  // After margins + inner padding, at least this much of the paper must
  // remain as printable area in both directions.
  minPrintableMm: 15,
};

export const HEADER_FONT_WEIGHTS = [400, 500, 600, 700, 800, 900];

export const round2 = (value) => Math.round(value * 100) / 100;

export const mmToIn = (mm) => mm / MM_PER_INCH;
export const inToMm = (inch) => inch * MM_PER_INCH;
export const mmToMicrons = (mm) => Math.round(mm * 1000);

/** Convert a canonical mm value into the value shown in the given unit. */
export const mmToDisplay = (mm, unit) => (unit === "in" ? round2(mmToIn(mm)) : round2(mm));

/** Convert a value typed in the given unit back into canonical mm. */
export const displayToMm = (value, unit) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  return unit === "in" ? round2(inToMm(n)) : round2(n);
};

const finiteOr = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeBoundedNumber = (value, min, max, fallback, label, errors) => {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    errors.push(`${label} must be a number; "${value}" was ignored.`);
    return fallback;
  }
  if (n < min || n > max) {
    const clamped = clamp(n, min, max);
    errors.push(`${label} must be between ${min} and ${max}; changed to ${clamped}.`);
    return round2(clamped);
  }
  return round2(n);
};

/** Resolve the effective paper dimensions (mm) after orientation. */
export function paperDimensionsMm(settings) {
  const s = settings || DEFAULT_PRINT_SETTINGS;
  const preset = PRINT_PAPER_PRESETS[s.paper] || PRINT_PAPER_PRESETS.slip;
  let widthMm = s.paper === "custom" ? finiteOr(s.customWidthMm, DEFAULT_PRINT_SETTINGS.customWidthMm) : preset.widthMm;
  let heightMm = s.paper === "custom" ? finiteOr(s.customHeightMm, DEFAULT_PRINT_SETTINGS.customHeightMm) : preset.heightMm;
  if (s.orientation === "landscape") {
    [widthMm, heightMm] = [heightMm, widthMm];
  }
  return { widthMm: round2(widthMm), heightMm: round2(heightMm) };
}

/** Printable content area after margins and inner padding (mm). */
export function printableAreaMm(settings) {
  const s = settings || DEFAULT_PRINT_SETTINGS;
  const { widthMm, heightMm } = paperDimensionsMm(s);
  return {
    widthMm: round2(widthMm - s.marginLeft - s.marginRight - 2 * s.innerPadding),
    heightMm: round2(heightMm - s.marginTop - s.marginBottom - 2 * s.innerPadding),
  };
}

/**
 * Validate raw (possibly partial/unsaved) settings.
 * Returns { settings, errors }: `settings` is always complete and safe to
 * render/print; `errors` describes anything invalid so the UI can reject the
 * save with a useful message.
 */
export function normalizePrintSettings(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const errors = [];

  let paper = src.paper ?? DEFAULT_PRINT_SETTINGS.paper;
  if (!PRINT_PAPER_PRESETS[paper]) {
    if (src.paper !== undefined && src.paper !== null && src.paper !== "") {
      errors.push(`Unknown paper size "${src.paper}"; using the Custom Slip preset.`);
    }
    paper = DEFAULT_PRINT_SETTINGS.paper;
  }

  let orientation = src.orientation ?? DEFAULT_PRINT_SETTINGS.orientation;
  if (orientation !== "portrait" && orientation !== "landscape") {
    if (src.orientation) errors.push(`Unknown orientation "${src.orientation}"; using portrait.`);
    orientation = DEFAULT_PRINT_SETTINGS.orientation;
  }

  let unit = src.unit ?? DEFAULT_PRINT_SETTINGS.unit;
  if (unit !== "mm" && unit !== "in") {
    if (src.unit) errors.push(`Unknown unit "${src.unit}"; using mm.`);
    unit = DEFAULT_PRINT_SETTINGS.unit;
  }

  const customWidthMm = normalizeBoundedNumber(
    src.customWidthMm, PRINT_LIMITS.paperMinMm, PRINT_LIMITS.paperMaxMm,
    DEFAULT_PRINT_SETTINGS.customWidthMm, "Custom paper width", errors,
  );
  const customHeightMm = normalizeBoundedNumber(
    src.customHeightMm, PRINT_LIMITS.paperMinMm, PRINT_LIMITS.paperMaxMm,
    DEFAULT_PRINT_SETTINGS.customHeightMm, "Custom paper height", errors,
  );

  const preset = PRINT_PAPER_PRESETS[paper];
  let widthMm = paper === "custom" ? customWidthMm : preset.widthMm;
  let heightMm = paper === "custom" ? customHeightMm : preset.heightMm;
  if (orientation === "landscape") [widthMm, heightMm] = [heightMm, widthMm];

  let marginTop = normalizeBoundedNumber(src.marginTop, PRINT_LIMITS.marginMin, PRINT_LIMITS.marginMax, DEFAULT_PRINT_SETTINGS.marginTop, "Top margin", errors);
  let marginBottom = normalizeBoundedNumber(src.marginBottom, PRINT_LIMITS.marginMin, PRINT_LIMITS.marginMax, DEFAULT_PRINT_SETTINGS.marginBottom, "Bottom margin", errors);
  let marginLeft = normalizeBoundedNumber(src.marginLeft, PRINT_LIMITS.marginMin, PRINT_LIMITS.marginMax, DEFAULT_PRINT_SETTINGS.marginLeft, "Left margin", errors);
  let marginRight = normalizeBoundedNumber(src.marginRight, PRINT_LIMITS.marginMin, PRINT_LIMITS.marginMax, DEFAULT_PRINT_SETTINGS.marginRight, "Right margin", errors);
  const innerPadding = normalizeBoundedNumber(src.innerPadding, PRINT_LIMITS.innerPaddingMin, PRINT_LIMITS.innerPaddingMax, DEFAULT_PRINT_SETTINGS.innerPadding, "Inner padding", errors);
  const borderWidth = normalizeBoundedNumber(src.borderWidth, PRINT_LIMITS.borderWidthMin, PRINT_LIMITS.borderWidthMax, DEFAULT_PRINT_SETTINGS.borderWidth, "Border width", errors);
  const rowSpacing = normalizeBoundedNumber(src.rowSpacing, PRINT_LIMITS.rowSpacingMin, PRINT_LIMITS.rowSpacingMax, DEFAULT_PRINT_SETTINGS.rowSpacing, "Row spacing", errors);

  // Guard: margins can never shrink the printable area below the minimum.
  const fitPair = (a, b, total, direction) => {
    const insets = a + b + 2 * innerPadding;
    if (total - insets >= PRINT_LIMITS.minPrintableMm) return [a, b];
    const available = Math.max(0, total - PRINT_LIMITS.minPrintableMm - 2 * innerPadding);
    const sum = a + b;
    if (sum <= 0) return [0, 0];
    errors.push(
      `${direction} margins leave less than ${PRINT_LIMITS.minPrintableMm}mm of printable space on this paper; they were reduced to fit.`,
    );
    return [round2(a * (available / sum)), round2(b * (available / sum))];
  };
  [marginTop, marginBottom] = fitPair(marginTop, marginBottom, heightMm, "Vertical");
  [marginLeft, marginRight] = fitPair(marginLeft, marginRight, widthMm, "Horizontal");

  const legacyTableFontSize = src.tableFontSize;
  const baseFontSize = normalizeBoundedNumber(src.baseFontSize ?? legacyTableFontSize, PRINT_LIMITS.baseFontMin, PRINT_LIMITS.baseFontMax, DEFAULT_PRINT_SETTINGS.baseFontSize, "Base font size", errors);
  const headerFontSize = normalizeBoundedNumber(src.headerFontSize, PRINT_LIMITS.headerFontMin, PRINT_LIMITS.headerFontMax, DEFAULT_PRINT_SETTINGS.headerFontSize, "Header font size", errors);
  const labelFontSize = normalizeBoundedNumber(src.labelFontSize ?? legacyTableFontSize, PRINT_LIMITS.tableFontMin, PRINT_LIMITS.tableFontMax, DEFAULT_PRINT_SETTINGS.labelFontSize, "Measurement label font size", errors);
  const valueFontSize = normalizeBoundedNumber(src.valueFontSize ?? legacyTableFontSize, PRINT_LIMITS.tableFontMin, PRINT_LIMITS.tableFontMax, DEFAULT_PRINT_SETTINGS.valueFontSize, "Measurement value font size", errors);
  const farmaishFontSize = normalizeBoundedNumber(src.farmaishFontSize, PRINT_LIMITS.tableFontMin, PRINT_LIMITS.tableFontMax, DEFAULT_PRINT_SETTINGS.farmaishFontSize, "Farmaish / comment font size", errors);
  const footerFontSize = normalizeBoundedNumber(src.footerFontSize, PRINT_LIMITS.footerFontMin, PRINT_LIMITS.footerFontMax, DEFAULT_PRINT_SETTINGS.footerFontSize, "Footer font size", errors);
  const bodyColumnWidth = normalizeBoundedNumber(src.bodyColumnWidth, 30, 70, DEFAULT_PRINT_SETTINGS.bodyColumnWidth, "Measurements column width", errors);
  const labelColumnWidth = normalizeBoundedNumber(src.labelColumnWidth, 25, 75, DEFAULT_PRINT_SETTINGS.labelColumnWidth, "Measurement label column width", errors);
  const lineHeightScale = normalizeBoundedNumber(src.lineHeightScale, PRINT_LIMITS.lineHeightMin, PRINT_LIMITS.lineHeightMax, DEFAULT_PRINT_SETTINGS.lineHeightScale, "Line-height scale", errors);
  const normalizedMetadataColumns = normalizeBoundedNumber(src.metadataColumns, PRINT_LIMITS.metadataColumnsMin, PRINT_LIMITS.metadataColumnsMax, DEFAULT_PRINT_SETTINGS.metadataColumns, "Metadata columns", errors);
  const metadataColumns = Math.round(normalizedMetadataColumns);
  if (metadataColumns !== normalizedMetadataColumns) errors.push("Metadata columns must be a whole number.");

  let headerFontWeight = DEFAULT_PRINT_SETTINGS.headerFontWeight;
  if (src.headerFontWeight !== undefined && src.headerFontWeight !== null && src.headerFontWeight !== "") {
    const w = Number(src.headerFontWeight);
    if (HEADER_FONT_WEIGHTS.includes(w)) headerFontWeight = w;
    else errors.push(`Header font weight must be one of ${HEADER_FONT_WEIGHTS.join(", ")}.`);
  }

  return {
    settings: {
      paper,
      orientation,
      unit,
      customWidthMm,
      customHeightMm,
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
      innerPadding,
      borderWidth,
      rowSpacing,
      bodyColumnWidth,
      labelColumnWidth,
      metadataColumns,
      lineHeightScale,
      baseFontSize,
      headerFontSize,
      headerFontWeight,
      labelFontSize,
      valueFontSize,
      farmaishFontSize,
      footerFontSize,
    },
    errors,
  };
}

/**
 * CSS custom-property declaration (without the wrapping selector) used by
 * both the preview modal and, via DOM extraction, the print document.
 */
export function printSettingsCssVars(settings) {
  const { widthMm, heightMm } = paperDimensionsMm(settings);
  const scale = Math.min(widthMm / 107.95, heightMm / 146.05);
  const rowSpacing = settings.rowSpacing;
  const lineHeight = (value) => round2(value * settings.lineHeightScale / 100);
  return [
    `--ps-paper-w: ${round2(widthMm)}mm`,
    `--ps-paper-h: ${round2(heightMm)}mm`,
    `--ps-border-width: ${round2(settings.borderWidth * scale)}mm`,
    `--ps-pad-top: ${round2(settings.marginTop + settings.innerPadding)}mm`,
    `--ps-pad-right: ${round2(settings.marginRight + settings.innerPadding)}mm`,
    `--ps-pad-bottom: ${round2(settings.marginBottom + settings.innerPadding)}mm`,
    `--ps-pad-left: ${round2(settings.marginLeft + settings.innerPadding)}mm`,
    `--ps-scale: ${round2(scale)}`,
    `--ps-base-size: ${round2(settings.baseFontSize * scale)}pt`,
    `--ps-header-size: ${round2(settings.headerFontSize * scale)}pt`,
    `--ps-shop-size: ${round2((settings.headerFontSize + 1) * scale)}pt`,
    `--ps-header-weight: ${settings.headerFontWeight}`,
    `--ps-label-size: ${round2(settings.labelFontSize * scale)}pt`,
    `--ps-value-size: ${round2(settings.valueFontSize * scale)}pt`,
    `--ps-table-size: ${round2(settings.baseFontSize * scale)}pt`,
    `--ps-farmaish-size: ${round2(settings.farmaishFontSize * scale)}pt`,
    `--ps-footer-size: ${round2(settings.footerFontSize * scale)}pt`,
    `--ps-line-height-scale: ${round2(settings.lineHeightScale / 100)}`,
    `--ps-line-height-110: ${lineHeight(1.1)}`,
    `--ps-line-height-115: ${lineHeight(1.15)}`,
    `--ps-line-height-120: ${lineHeight(1.2)}`,
    `--ps-line-height-125: ${lineHeight(1.25)}`,
    `--ps-line-height-130: ${lineHeight(1.3)}`,
    `--ps-line-height-135: ${lineHeight(1.35)}`,
    `--ps-line-height-140: ${lineHeight(1.4)}`,
    `--ps-line-height-145: ${lineHeight(1.45)}`,
    `--ps-line-height-150: ${lineHeight(1.5)}`,
    `--ps-body-column-fr: ${settings.bodyColumnWidth}fr`,
    `--ps-other-column-fr: ${round2(100 - settings.bodyColumnWidth)}fr`,
    `--ps-label-column-fr: ${settings.labelColumnWidth}fr`,
    `--ps-value-column-fr: ${round2(100 - settings.labelColumnWidth)}fr`,
    `--ps-metadata-columns: ${settings.metadataColumns}`,
    `--ps-space-xs: ${round2(rowSpacing * 0.4 * scale)}mm`,
    `--ps-space-sm: ${round2((rowSpacing * 2) / 3 * scale)}mm`,
    `--ps-space-md: ${round2(rowSpacing * scale)}mm`,
    `--ps-cell-pad-y: ${round2((rowSpacing * 0.5) * scale)}mm`,
    `--ps-cell-pad-x: ${round2((rowSpacing * 2) / 3 * scale)}mm`,
    `--ps-notes-pad-x: ${round2(rowSpacing * scale)}mm`,
  ].join(";");
}

/** Fetch the saved configuration when a preview opens or printing begins. */
export async function getActivePrintConfig() {
  const response = await getSettings();
  const { settings } = normalizePrintSettings(response?.data?.printSettings);
  return { ...settings, ...paperDimensionsMm(settings) };
}

/** Human-readable summary of the effective settings. */
export function describePrintSettings(settings) {
  const { widthMm, heightMm } = paperDimensionsMm(settings);
  const area = printableAreaMm(settings);
  const presetLabel = PRINT_PAPER_PRESETS[settings.paper]?.label || "Custom Slip";
  return [
    `Paper: ${presetLabel} — ${round2(widthMm)} × ${round2(heightMm)} mm (${round2(mmToIn(widthMm))} × ${round2(mmToIn(heightMm))} in), ${settings.orientation}`,
    `Margins: top ${settings.marginTop} / right ${settings.marginRight} / bottom ${settings.marginBottom} / left ${settings.marginLeft} mm, inner padding ${settings.innerPadding} mm`,
    `Printable area: ${round2(area.widthMm)} × ${round2(area.heightMm)} mm`,
    `Fonts: base ${settings.baseFontSize}pt, header ${settings.headerFontSize}pt (weight ${settings.headerFontWeight}), labels ${settings.labelFontSize}pt, values ${settings.valueFontSize}pt, farmaish / comments ${settings.farmaishFontSize}pt, footer ${settings.footerFontSize}pt`,
    `Layout: row spacing ${settings.rowSpacing} mm, measurements section ${settings.bodyColumnWidth}%, label column ${settings.labelColumnWidth}%, ${settings.metadataColumns} header columns, line-height scale ${settings.lineHeightScale}%`,
    "The printer driver may substitute its own paper size — confirm the selected paper in the print dialog and print at 100% / Actual size.",
  ].join("\n");
}
