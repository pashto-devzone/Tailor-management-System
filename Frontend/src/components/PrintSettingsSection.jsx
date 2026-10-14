import { useEffect, useMemo, useState } from "react";
import { FaChevronDown } from "react-icons/fa";
import { getSettings, saveSettings } from "../services/api";
import {
  DEFAULT_PRINT_SETTINGS,
  HEADER_FONT_WEIGHTS,
  MM_PER_INCH,
  PRINT_PAPER_PRESETS,
  describePrintSettings,
  normalizePrintSettings,
  paperDimensionsMm,
  round2,
} from "../utils/printConfig";

// Length fields are edited as strings in the selected display unit and
// converted to canonical millimeters before validation/printing.
const LENGTH_KEYS = [
  "customWidthMm",
  "customHeightMm",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "innerPadding",
];

const round4 = (n) => Math.round(n * 10000) / 10000;

const canonicalFromRaw = (raw) => {
  const unit = raw.unit === "in" ? "in" : "mm";
  const out = { ...raw };
  for (const key of LENGTH_KEYS) {
    const n = Number(out[key]);
    if (Number.isFinite(n)) out[key] = unit === "in" ? round4(n * MM_PER_INCH) : round2(n);
  }
  return out;
};

const rawFromCanonical = (settings) => {
  const unit = settings.unit === "in" ? "in" : "mm";
  const out = { ...settings };
  for (const key of LENGTH_KEYS) {
    const n = Number(out[key]);
    if (Number.isFinite(n)) out[key] = String(unit === "in" ? round4(n / MM_PER_INCH) : n);
  }
  return out;
};

const convertLengthsUnit = (raw, toUnit) => {
  if ((raw.unit || "mm") === toUnit) return raw;
  const fromUnit = raw.unit || "mm";
  const out = { ...raw, unit: toUnit };
  for (const key of LENGTH_KEYS) {
    const n = Number(out[key]);
    if (!Number.isFinite(n)) continue;
    out[key] = String(toUnit === "in" ? round4(n / MM_PER_INCH) : round2(n * MM_PER_INCH));
  }
  return out;
};

export default function PrintSettingsSection() {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState(() => rawFromCanonical(DEFAULT_PRINT_SETTINGS));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    getSettings()
      .then((res) => {
        if (!mounted) return;
        const saved = res.data?.printSettings || {};
        setRaw(rawFromCanonical({ ...DEFAULT_PRINT_SETTINGS, ...saved }));
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.response?.data?.message || "Print settings load failed; defaults are shown.");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const canonical = useMemo(() => canonicalFromRaw(raw), [raw]);
  const { settings: normalized, errors } = useMemo(() => normalizePrintSettings(canonical), [canonical]);
  const dims = paperDimensionsMm(normalized);

  const update = (patch) => setRaw((prev) => ({ ...prev, ...patch }));

  const handleUnitChange = (unit) => setRaw((prev) => convertLengthsUnit(prev, unit));

  const handleRestore = () => {
    setMessage("");
    setError("");
    setRaw(rawFromCanonical({ ...DEFAULT_PRINT_SETTINGS, unit: raw.unit }));
    setMessage("Default print settings loaded. Click Save Print Settings to apply them.");
  };

  const handleSave = async () => {
    setMessage("");
    setError("");
    if (errors.length) {
      setError(errors.join("\n"));
      return;
    }
    setSaving(true);
    try {
      // Re-read the full settings first so saving print settings can never
      // overwrite shop fields with stale/empty values (the API replaces all
      // fields it receives).
      const fresh = await getSettings();
      const payload = { ...(fresh.data || {}), printSettings: normalized };
      const saved = await saveSettings(payload);
      if (saved?.data?.printSettingsPersisted === false) {
        setError(
          "Print settings could not be persisted: the database is missing the printsettings column and " +
            "automatic creation was denied. Run Backend/migrations/003_print_settings.sql in the Supabase " +
            "SQL editor once, restart the app, then save again.",
        );
      } else {
        setRaw(rawFromCanonical({ ...DEFAULT_PRINT_SETTINGS, ...(saved.data?.printSettings || payload.printSettings) }));
        setMessage("Print settings saved. The measurement preview and printed slip now use them.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Print settings save failed.");
    } finally {
      setSaving(false);
    }
  };

  const lengthInput = (key, label) => (
    <label>
      {label} ({raw.unit})
      <input
        inputMode="decimal"
        value={raw[key]}
        onChange={(e) => update({ [key]: e.target.value })}
      />
    </label>
  );

  const fontInput = (key, label) => (
    <label>
      {label} (pt)
      <input
        inputMode="numeric"
        value={raw[key]}
        onChange={(e) => update({ [key]: e.target.value })}
      />
    </label>
  );

  return (
    <div className="collapsible-card">
      <div className="collapsible-header" onClick={() => setOpen((prev) => !prev)}>
        <h3>Print Settings</h3>
        <FaChevronDown className={`collapsible-icon ${open ? "open" : ""}`} />
      </div>
      <div className={`collapsible-body ${open ? "" : "collapsed"}`}>
        {loading ? (
          <p>Loading print settings...</p>
        ) : (
          <>
            <p>
              Controls the measurement-slip paper, margins and fonts used by the preview,
              the print dialog and PDF export. Receipts and invoices keep their own format.
            </p>

            <label>
              Paper size
              <select value={normalized.paper} onChange={(e) => update({ paper: e.target.value })}>
                {Object.values(PRINT_PAPER_PRESETS).map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <label>
                Orientation
                <select value={normalized.orientation} onChange={(e) => update({ orientation: e.target.value })}>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </label>
              <label>
                Unit
                <select value={normalized.unit} onChange={(e) => handleUnitChange(e.target.value)}>
                  <option value="mm">Millimeters (mm)</option>
                  <option value="in">Inches (in)</option>
                </select>
              </label>
            </div>

            {normalized.paper === "custom" ? (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {lengthInput("customWidthMm", "Custom paper width")}
                {lengthInput("customHeightMm", "Custom paper height")}
              </div>
            ) : null}

            <p style={{ margin: "6px 0", fontWeight: 700 }}>
              Current paper: {round2(dims.widthMm)} × {round2(dims.heightMm)} mm (
              {round2(dims.widthMm / MM_PER_INCH)} × {round2(dims.heightMm / MM_PER_INCH)} in)
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {lengthInput("marginTop", "Top margin")}
              {lengthInput("marginBottom", "Bottom margin")}
              {lengthInput("marginLeft", "Left margin")}
              {lengthInput("marginRight", "Right margin")}
              {lengthInput("innerPadding", "Extra inner padding")}
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {fontInput("headerFontSize", "Header font size")}
              <label>
                Header font weight
                <select
                  value={raw.headerFontWeight ?? 700}
                  onChange={(e) => update({ headerFontWeight: Number(e.target.value) })}
                >
                  {HEADER_FONT_WEIGHTS.map((weight) => (
                    <option key={weight} value={weight}>
                      {weight}
                    </option>
                  ))}
                </select>
              </label>
              {fontInput("tableFontSize", "Measurement table font size")}
              {fontInput("farmaishFontSize", "Farmaish / comment font size")}
            </div>

            {errors.length ? (
              <div className="message error" style={{ whiteSpace: "pre-line" }}>
                {errors.join("\n")}
              </div>
            ) : null}
            {message ? <p className="message success">{message}</p> : null}
            {error ? <p className="message error" style={{ whiteSpace: "pre-line" }}>{error}</p> : null}

            <label style={{ display: "block" }}>
              Effective settings
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  background: "#f6f6f6",
                  border: "1px solid #ddd",
                  borderRadius: 4,
                  padding: 8,
                  fontSize: 12,
                  margin: "4px 0 0",
                }}
              >
                {describePrintSettings(normalized)}
              </pre>
            </label>

            <div className="modal-actions" style={{ marginTop: 12 }}>
              <button type="button" className="button secondary" onClick={handleRestore} disabled={saving}>
                Restore Default Print Settings
              </button>
              <button
                type="button"
                className="button primary"
                onClick={handleSave}
                disabled={saving || errors.length > 0}
              >
                {saving ? "Saving..." : "Save Print Settings"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

