export const defaultMeasurementDetails = {
  measurements: {
    lambai: "",
    bazu: "",
    taira: "",
    collar: "",
    seena: "",
    half_seena: "",
    kamar: "",
    daaman: "",
    shalwar: "",
    pancha: "",
  },
  gala: {
    type: "",
    // New enhancement fields (backward compatible)
    collar_type: "",
    collar_size: "",
    bain_type: "",
    bain_size: "",
  },
  daaman: {
    type: "",
  },
  pocket: {
    front: false,
    front_details: "",
    side: false,
    side_count: "",
    side_details: "",
  },
  baazoo: {
    design: "",
    size: "",
    extra: "",
    cuff_type: "",
    cuff_size: "",
    cuff_extra: "",
    cuff_motai: "",
    cuff_motai_comment: "",
  },
  patai: {
    type: "",
    // New enhancement field (backward compatible)
    patai_lambai: "",
  },
  bukram: {
    type: "",
    value: "",
  },
  munda: {
    value: "",
  },
  silai: {
    type: "",
    whatsapp_number: "",
    whatsapp_name: "",
    extra_style_design: "",
  },
  shalwar: {
    style: "",
    additional_pocket: "",
  },
  // NEW: Button + Kaaj design values stored inside measurement_details
  button_design: {
    type: "", // Fancy Ring | Saada Ring | Hook Button | Special Button
    comment: "", // custom comment value
  },
  kaaj_design: {
    type: "", // Double Kaaj | Stud Kaaj | Saada Kaaj
    comment: "", // custom comment value
  },

  // Keep Urdu label consistency for print
  notes: "",
  cloth_type: "شلوار قمیض",
};


const normalizeLegacy = (source) => {
  // Legacy records only had gala.type + collar_size/bain_size.
  // Safe defaults for new fields:
  // - collar_type: if legacy had collar_size (or any collar data), assume گول کالر.
  // - bain_type: default گول بین.
  // - button/kaaj design fields: may not exist in old data.
  const legacyGalaType = source.galla_type || "";
  const legacyHasCollar = legacyGalaType === "کالر" || Boolean(source.collar_size);
  const legacyHasBain = legacyGalaType === "بین" || legacyGalaType === "Ban" || Boolean(source.bain_size);


  return {
    measurements: {
      lambai: source.lambai ?? "",
      bazu: source.bazu ?? "",
      taira: source.taira ?? "",
      collar: source.collar ?? "",
      seena: source.seena ?? "",
      half_seena: source.half_seena ?? "",
      kamar: source.kamar ?? "",
      daaman: source.daaman ?? "",
      shalwar: source.shalwar ?? "",
      pancha: source.pancha ?? "",
    },
    // Ensure new design objects exist for legacy records
    button_design: source.button_design || defaultMeasurementDetails.button_design,
    kaaj_design: source.kaaj_design || defaultMeasurementDetails.kaaj_design,
    gala: {
      type: legacyGalaType === "بین" ? "Half Bain" : legacyGalaType,
      collar_type: legacyHasCollar ? (source.collar_type || "") : "",
      collar_size: source.collar_size || "",
      bain_type: legacyHasBain ? (source.bain_type || "") : "",
      bain_size: source.bain_size || "",
    },
    daaman: {
      type: source.daman || "",
    },
    pocket: {
      front: Boolean(source.pocket_front),
      front_details: source.pocket_front_details || "",
      side: Boolean(source.pocket_side),
      side_count: source.pocket_side_count || "",
      side_details: source.pocket_side_details || "",
    },
    baazoo: {
      design: source.bazu_design || "",
      size: source.bazu_size || "",
      extra: source.bazu_extra || "",
      cuff_type: source.cuff_type || "",
      cuff_size: source.cuff_size || "",
      cuff_extra: source.cuff_extra || "",
      cuff_motai: source.cuff_motai || "",
      cuff_motai_comment: source.cuff_motai_comment || "",
    },
    patai: {
      type: source.pitai || "",
      patai_lambai: source.patai_lambai || "",
    },
    bukram: {
      type: source.bukram || source.bukram_type || "",
      value: source.bukram_value || source.bukram_sub_option || "",
    },
    munda: {
      value: source.munda_value || source.munda || "",
      comment: source.munda_comment || "",
    },
    silai: {
      type: source.silai || "",
      whatsapp_number: source.whatsapp_number || "",
      whatsapp_name: source.whatsapp_name || "",
      extra_style_design: source.extra_style_design || "",
    },
    shalwar: {
      style: source.shalwar_style || "",
      additional_pocket: source.additional_pocket || "",
    },
    notes: source.notes || source.comments || "",
    cloth_type: source.cloth_type || "شلوار قمیض",
  };
};


export const normalizeMeasurementData = (source) => {
  if (!source) return { ...defaultMeasurementDetails };

  // Backward/forward compatible normalization.
  // Goal: preserve ALL saved measurement fields for exact preview/print sync.

  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      return { ...defaultMeasurementDetails };
    }
  }

  // Newer stored format: payload object (already measurement_details)
  if (source.measurement_details) {
    const merged = {
      ...defaultMeasurementDetails,
      ...source.measurement_details,
      notes: source.comments ?? source.measurement_details.notes ?? source.notes ?? "",
      cloth_type:
        source.cloth_type ??
        source.measurement_details.cloth_type ??
        defaultMeasurementDetails.cloth_type,

      button_design:
        source.button_design ??
        source.measurement_details?.button_design ??
        defaultMeasurementDetails.button_design,
      kaaj_design:
        source.kaaj_design ??
        source.measurement_details?.kaaj_design ??
        defaultMeasurementDetails.kaaj_design,
    };

    if (merged.gala?.type === "کالر") {
      if (merged.gala.collar_type === "Gol Collar") merged.gala.collar_type = "گول کالر";
      if (merged.gala.collar_type === "Chota Collar") merged.gala.collar_type = "چھوٹا کالر";

      merged.gala.collar_type = merged.gala.collar_type || "";
      if (merged.gala.collar_type === "چھوٹا کالر") merged.gala.collar_size = "";
    }

    if (merged.gala?.type === "بین") merged.gala.type = "Half Bain";
    if (["Half Bain", "Full Bain"].includes(merged.gala?.type)) {
      if (merged.gala.bain_type === "Gol Bain") merged.gala.bain_type = "گول بین";
      if (merged.gala.bain_type === "Seedha Bain") merged.gala.bain_type = "سیدھا بین";

      merged.gala.bain_type = merged.gala.bain_type || "";
      merged.gala.bain_size = merged.gala.bain_size ?? "";
    }

    merged.patai.patai_lambai = merged.patai.patai_lambai || "";

    return merged;
  }

  // Detect if source is already new-format measurement_details
  // (e.g., when backend returns parsed measurements directly)
  const isNewFormat = source && (
    source.hasOwnProperty("gala") ||
    source.hasOwnProperty("daaman") ||
    source.hasOwnProperty("pocket") ||
    source.hasOwnProperty("baazoo") ||
    source.hasOwnProperty("button_design") ||
    source.hasOwnProperty("kaaj_design")
  );

  if (isNewFormat) {
    const merged = {
      ...defaultMeasurementDetails,
      ...source,
      notes: source.notes ?? source.comments ?? "",
      cloth_type: source.cloth_type ?? defaultMeasurementDetails.cloth_type,
    };

    if (merged.gala?.type === "کالر") {
      if (merged.gala.collar_type === "Gol Collar") merged.gala.collar_type = "گول کالر";
      if (merged.gala.collar_type === "Chota Collar") merged.gala.collar_type = "چھوٹا کالر";

      merged.gala.collar_type = merged.gala.collar_type || "";
      if (merged.gala.collar_type === "چھوٹا کالر") merged.gala.collar_size = "";
    }

    if (merged.gala?.type === "بین") merged.gala.type = "Half Bain";
    if (["Half Bain", "Full Bain"].includes(merged.gala?.type)) {
      if (merged.gala.bain_type === "Gol Bain") merged.gala.bain_type = "گول بین";
      if (merged.gala.bain_type === "Seedha Bain") merged.gala.bain_type = "سیدھا بین";

      merged.gala.bain_type = merged.gala.bain_type || "";
      merged.gala.bain_size = merged.gala.bain_size ?? "";
    }

    merged.patai.patai_lambai = merged.patai.patai_lambai || "";

    return merged;
  }

  // Legacy records
  const merged = {
    ...defaultMeasurementDetails,
    ...normalizeLegacy(source),
  };

  if (merged.gala?.type === "کالر") {
    if (merged.gala.collar_type === "Gol Collar") merged.gala.collar_type = "گول کالر";
    if (merged.gala.collar_type === "Chota Collar") merged.gala.collar_type = "چھوٹا کالر";

    merged.gala.collar_type = merged.gala.collar_type || "";
    if (merged.gala.collar_type === "چھوٹا کالر") merged.gala.collar_size = "";
  }
  if (merged.gala?.type === "بین") merged.gala.type = "Half Bain";
  if (["Half Bain", "Full Bain"].includes(merged.gala?.type)) {
    if (merged.gala.bain_type === "Gol Bain") merged.gala.bain_type = "گول بین";
    if (merged.gala.bain_type === "Seedha Bain") merged.gala.bain_type = "سیدھا بین";

    merged.gala.bain_type = merged.gala.bain_type || "";
    merged.gala.bain_size = merged.gala.bain_size ?? "";
  }

  merged.patai.patai_lambai = merged.patai.patai_lambai || "";

  return merged;
};


export const prepareMeasurementPayload = (measurementDetails) => ({
  measurement_details: measurementDetails,
  cloth_type: measurementDetails.cloth_type,
});

const measurementLabelMap = {
  gala: "گلا",
  hips: "ہپس",
  bazoo: "بازو",
  lambai: "لمبائی",
  bazu: "بازو",
  taira: "تیرا",
  collar: "کالر",
  seena: "چھاتی",
  half_seena: "ہاف چھاتی",
  kamar: "کمر",
  daaman: "دامن",
  shalwar: "شلوار",
  pancha: "پانچہ",
};

export const MEASUREMENT_FIELD_ORDER = {
  shalwarkameez: ["lambai", "bazu", "taira", "collar", "seena", "half_seena", "kamar", "daaman", "shalwar", "pancha"],
  sherwani: ["lambai", "bazu", "taira", "collar", "seena", "half_seena", "kamar", "daaman", "shalwar", "pancha"],
  coat: ["lambai", "bazoo", "taira", "gala", "seena", "kamar", "hips"],
  waistcoat: ["lambai", "taira", "gala", "seena", "kamar", "hips"],
};

export const getOrderedMeasurementEntries = (values, dressType) => {
  const normalizedType = String(dressType || "shalwar kameez").toLowerCase().replace(/\s+/g, "");
  const garment = normalizedType === "waistcoat" ? "waistcoat" : normalizedType;
  const order = MEASUREMENT_FIELD_ORDER[garment] || MEASUREMENT_FIELD_ORDER.shalwarkameez;
  const known = new Set(order);
  const entries = order.filter((key) => Object.prototype.hasOwnProperty.call(values || {}, key)).map((key) => [key, values[key]]);
  const extras = Object.keys(values || {}).filter((key) => !known.has(key));
  return [...entries, ...extras.map((key) => [key, values[key]])];
};

export const measurementListFields = [
  "lambai",
  "bazu",
  "taira",
  "collar",
  "seena",
  "half_seena",
  "kamar",
  "daaman",
  "shalwar",
  "pancha",
];

export const getMeasurementLabel = (key) => measurementLabelMap[key] || key;

export const formatMeasurementList = (details) =>
  measurementListFields.map((key) => ({ label: measurementLabelMap[key], value: details.measurements[key] || "-" }));

export const FARMAISH_CANONICAL_ORDER = [
  { key: "gala", label: "گلہ" },
  { key: "baazoo", label: "بازو" },
  { key: "patai", label: "پٹائی" },
  { key: "pocketFront", label: "سامنے پاکٹ" },
  { key: "pocketSide", label: "سائیڈ پاکٹ" },
  { key: "shalwarPocket", label: "شلوار جیب" },
  { key: "buttonDesign", label: "بٹن ڈیزائن" },
  { key: "kaajDesign", label: "کاج ڈیزائن" },
  { key: "silai", label: "سلائی" },
  { key: "shalwar", label: "شلوار" },
  { key: "daaman", label: "دامن" },
];

const safe = (v) => v !== undefined && v !== null && String(v).trim() !== "";
const galaDisplayLabels = {
  "Goal Gala": "گول گلا",
  "V Gala": "وی گلا",
  Ban: "بین",
  "Half Bain": "ہاف بین",
  "Full Bain": "فل بین",
};
const getGalaDisplayLabel = (value) => galaDisplayLabels[value] || value;
const farmaishDisplayLabels = {
  "ڈبل CTC": "ڈبل سی ٹی سی",
  "Double CTC": "ڈبل سی ٹی سی",
  "D کف": "ڈی کف",
  "Gol Collar": "گول کالر",
  "Seedha Collar": "سیدھا کالر",
  "Chota Collar": "چھوٹا کالر",
  "2 Buttons": "دو بٹن",
  "3 Buttons": "تین بٹن",
  "Single Chaak": "سنگل چاک",
  "Double Chaak": "ڈبل چاک",
};
const getFarmaishDisplayLabel = (value) => farmaishDisplayLabels[value] || value;

export const getFarmaishRows = (details) => {
  const rows = [];
  const push = (label, value) => {
    const v = value === undefined || value === null ? "" : String(value).trim();
    if (!v) return;
    rows.push({ label, value: v });
  };

  const d = details || {};

  if (Array.isArray(d.waistcoat_farmaish)) {
    const waistcoatLabels = {
      "Boan Pocket": "بون پاکٹ",
      "Cut Daman": "کٹ دامن",
      "Down Zyada": "گول دامن",
      "Daman Zyada": "گول دامن",
      "Goal Daman": "گول دامن",
    };
    d.waistcoat_farmaish.forEach((value) => push("فرمائش", waistcoatLabels[value] || value));
    if (safe(d.gala?.type)) push("\u06af\u0644\u0627 \u06a9\u06cc \u0642\u0633\u0645", getGalaDisplayLabel(d.gala.type));
    return rows;
  }
  if (d.coat_farmaish && (safe(d.coat_farmaish.buttons) || safe(d.coat_farmaish.chaak))) {
    const buttonLabels = { "2 Buttons": "دو بٹن", "3 Buttons": "تین بٹن" };
    const chaakLabels = { "Single Chaak": "سنگل چاک", "Double Chaak": "ڈبل چاک" };
    if (safe(d.coat_farmaish.buttons)) push("بٹن", buttonLabels[d.coat_farmaish.buttons] || d.coat_farmaish.buttons);
    if (safe(d.coat_farmaish.chaak)) push("چاک", chaakLabels[d.coat_farmaish.chaak] || d.coat_farmaish.chaak);
    if (safe(d.gala?.type)) push("\u06af\u0644\u0627 \u06a9\u06cc \u0642\u0633\u0645", getGalaDisplayLabel(d.gala.type));
    return rows;
  }

  // گلہ
  const galaType = d.gala?.type || "";
  if (safe(galaType)) {
    if (galaType === "کالر") {
      const collarType = d.gala.collar_type || "";
      const collarSize = safe(d.gala.collar_size) ? d.gala.collar_size : "";
      if (safe(collarType)) {
        push("کالر", collarSize ? `${getFarmaishDisplayLabel(collarType)} (سائز: ${collarSize})` : getFarmaishDisplayLabel(collarType));
      }
    } else if (["بین", "Ban", "Half Bain", "Full Bain"].includes(galaType)) {
      const bainType = d.gala.bain_type || "";
      const bainSize = safe(d.gala.bain_size) ? d.gala.bain_size : "";
      if (safe(bainType)) {
        const parentLabel = galaType === "Full Bain" ? "فل بین" : "ہاف بین";
        push(parentLabel, bainSize ? `${bainType} (سائز: ${bainSize})` : bainType);
      }
    } else {
      push("گلہ", getGalaDisplayLabel(galaType));
    }
  }

  // بازو
  const baazooDesign = d.baazoo?.design || "";
  if (safe(baazooDesign)) {
    if (baazooDesign === "کنی بازو" || baazooDesign === "گول بازو") {
      const size = safe(d.baazoo.size) ? d.baazoo.size : "";
      push("بازو", size ? `${baazooDesign} (سائز: ${size})` : baazooDesign);
    } else if (baazooDesign === "کف") {
      const parts = [safe(d.baazoo.cuff_type) ? d.baazoo.cuff_type : "", safe(d.baazoo.cuff_size) ? d.baazoo.cuff_size : "", safe(d.baazoo.cuff_motai) ? `موٹائی: ${d.baazoo.cuff_motai}` : ""].filter(Boolean);
      if (parts.length) push("کف", parts.map(getFarmaishDisplayLabel).join(" / "));
      if (safe(d.baazoo.cuff_extra)) push("اضافی کف سائز", d.baazoo.cuff_extra);
      if (safe(d.baazoo.cuff_motai_comment)) push("کف موٹائی کے تبصرے", d.baazoo.cuff_motai_comment);
    } else {
      push("بازو", baazooDesign);
    }
  }

  // پٹائی
  if (safe(d.patai?.type)) {
    push("پٹائی", d.patai.type);
  }
  if (safe(d.patai?.patai_lambai)) {
    push("پٹائی لمبائی", d.patai.patai_lambai);
  }

  // سامنے پاکٹ
  if (d.pocket?.front || d.pocket?.side) {
    if (d.pocket?.front) {
      const frontDetails = d.pocket.front_details ? ` (${d.pocket.front_details})` : "";
      push("سامنے پاکٹ", `ہاں${frontDetails}`);
    }
    if (d.pocket?.side) {
      const sideCount = d.pocket.side_count ? `${d.pocket.side_count} سائیڈ پاکٹ` : "";
      const sideDetails = d.pocket.side_details ? d.pocket.side_details : "";
      const suffix = [sideCount, sideDetails].filter(Boolean).join("، ");
      push("سائیڈ پاکٹ", suffix ? `ہاں (${suffix})` : "ہاں");
    }
  }

  // شلوار جیب
  const additionalPocket = d.shalwar?.additional_pocket;
  if (additionalPocket !== undefined && additionalPocket !== null && safe(additionalPocket)) {
    push("شلوار جیب", additionalPocket === "ہاں" ? "ہاں" : "نہیں");
  }

  // بٹن ڈیزائن
  if (safe(d.button_design?.type)) {
    const base = d.button_design.type;
    const comment = safe(d.button_design?.comment) ? d.button_design.comment : "";
    push("بٹن ڈیزائن", comment ? `${base} (${comment})` : base);
  }

  // کاج ڈیزائن
  if (safe(d.kaaj_design?.type)) {
    const base = d.kaaj_design.type;
    const comment = safe(d.kaaj_design?.comment) ? d.kaaj_design.comment : "";
    push("کاج ڈیزائن", comment ? `${base} (${comment})` : base);
  }

  // بکرم
  const bukramType = d.bukram?.type || "";
  const bukramValue = d.bukram?.value || "";
  if (safe(bukramType) || safe(bukramValue)) {
    push("بکرم", [bukramType, bukramValue].filter(safe).join(" — "));
  }

  // منڈا
  if (safe(d.munda?.value)) {
    push("منڈا", d.munda.value);
  }
  if (safe(d.munda?.comment)) {
    push("منڈا کمنٹس", d.munda.comment);
  }

  if (safe(d.baazoo?.extra)) {
    push("بازو اضافی سائز", d.baazoo.extra);
  }

  // سلائی
  if (safe(d.silai?.type)) {
    let line = d.silai.type;
    if (d.silai.type === "واٹس ایپ") {
      const parts = [];
      if (safe(d.silai.whatsapp_number)) parts.push(`نمبر: ${d.silai.whatsapp_number}`);
      if (safe(d.silai.whatsapp_name)) parts.push(`نام: ${d.silai.whatsapp_name}`);
      if (safe(d.silai.extra_style_design)) parts.push(`اضافی: ${d.silai.extra_style_design}`);
      if (parts.length) line = `${line} (${parts.join(" ، ")})`;
    }
    push("سلائی", getFarmaishDisplayLabel(line));
  }
  if (safe(d.silai?.extra_style_design) && d.silai.type !== "واٹس ایپ") {
    push("اضافی اسٹائل / ڈیزائن", d.silai.extra_style_design);
  }

  // شلوار
  if (safe(d.shalwar?.style)) {
    push("شلوار", d.shalwar.style);
  }

  // دامن
  if (safe(d.daaman?.type)) {
    push("دامن", d.daaman.type);
  }

  return rows;
};
