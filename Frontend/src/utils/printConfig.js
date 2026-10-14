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
  marginTop: 3.5,
  marginBottom: 3.5,
  marginLeft: 3.5,
  marginRight: 3.5,
  // Extra padding inside the margins (applied to the print sheet).
  innerPadding: 1,
  // Header (shop name, section titles) stays bold but compact so it cannot
  // wrap into the table on the narrow slip.
  headerFontSize: 10,
  headerFontWeight: 700,
  tableFontSize: 8,
  farmaishFontSize: 8,
};

export const PRINT_LIMITS = {
  paperMinMm: 20,
  paperMaxMm: 600,
  marginMin: 0,
  marginMax: 30,
  innerPaddingMin: 0,
  innerPaddingMax: 10,
  headerFontMin: 6,
  headerFontMax: 22,
  tableFontMin: 6,
  tableFontMax: 18,
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

  const headerFontSize = normalizeBoundedNumber(src.headerFontSize, PRINT_LIMITS.headerFontMin, PRINT_LIMITS.headerFontMax, DEFAULT_PRINT_SETTINGS.headerFontSize, "Header font size", errors);
  const tableFontSize = normalizeBoundedNumber(src.tableFontSize, PRINT_LIMITS.tableFontMin, PRINT_LIMITS.tableFontMax, DEFAULT_PRINT_SETTINGS.tableFontSize, "Measurement font size", errors);
  const farmaishFontSize = normalizeBoundedNumber(src.farmaishFontSize, PRINT_LIMITS.tableFontMin, PRINT_LIMITS.tableFontMax, DEFAULT_PRINT_SETTINGS.farmaishFontSize, "Farmaish font size", errors);

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
      headerFontSize,
      headerFontWeight,
      tableFontSize,
      farmaishFontSize,
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
  return [
    `--ps-paper-w: ${round2(widthMm)}mm`,
    `--ps-paper-h: ${round2(heightMm)}mm`,
    `--ps-pad-top: ${round2(settings.marginTop + settings.innerPadding)}mm`,
    `--ps-pad-right: ${round2(settings.marginRight + settings.innerPadding)}mm`,
    `--ps-pad-bottom: ${round2(settings.marginBottom + settings.innerPadding)}mm`,
    `--ps-pad-left: ${round2(settings.marginLeft + settings.innerPadding)}mm`,
    `--ps-header-size: ${settings.headerFontSize}pt`,
    `--ps-header-weight: ${settings.headerFontWeight}`,
    `--ps-table-size: ${settings.tableFontSize}pt`,
    `--ps-farmaish-size: ${settings.farmaishFontSize}pt`,
  ].join(";");
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
    `Fonts: header ${settings.headerFontSize}pt (weight ${settings.headerFontWeight}), measurements ${settings.tableFontSize}pt, farmaish & notes ${settings.farmaishFontSize}pt`,
    "The printer driver may substitute its own paper size — confirm the selected paper in the print dialog and print at 100% / Actual size.",
  ].join("\n");
}
