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
    design: "",
    design_comment: "",
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
    comment: "",
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
  kareegar: {
    name: "", // tailor (kareegar) who will stitch
  },
  additional_comments: {
    gala: "",
    daman: "",
    other: "",
  },

  // Keep Urdu label consistency for print
  notes: "",
  cloth_type: "شلوار قمیض",
};

// Older builds wrote some hardcoded Urdu labels after decoding UTF-8 as
// Latin-1. Repair only strings containing the characteristic mojibake markers;
// ordinary user-entered text is returned unchanged.
const repairMojibake = (value) => {
  if (typeof value !== "string" || !/[ÃÂØÙÚÛ]/.test(value)) return value;
  try {
    const cp1252Bytes = {
      "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89,
      "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92,
      "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "˜": 0x98,
      "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
    };
    const bytes = Uint8Array.from([...value].map((char) => cp1252Bytes[char] ?? char.charCodeAt(0)));
    const repaired = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return repaired.includes("\uFFFD") ? value : repaired;
  } catch {
    return value;
  }
};

const clearInvalidDependentValues = (details) => {
  const cleaned = {
    ...details,
    gala: { ...defaultMeasurementDetails.gala, ...(details.gala || {}) },
    pocket: { ...defaultMeasurementDetails.pocket, ...(details.pocket || {}) },
    baazoo: { ...defaultMeasurementDetails.baazoo, ...(details.baazoo || {}) },
    patai: { ...defaultMeasurementDetails.patai, ...(details.patai || {}) },
    bukram: { ...defaultMeasurementDetails.bukram, ...(details.bukram || {}) },
    silai: { ...defaultMeasurementDetails.silai, ...(details.silai || {}) },
  };

  if (cleaned.gala.type !== "کالر") {
    cleaned.gala.collar_type = "";
    cleaned.gala.collar_size = "";
  }
  if (!["Half Bain", "Full Bain", "بین", "Ban"].includes(cleaned.gala.type)) {
    cleaned.gala.bain_type = "";
    cleaned.gala.bain_size = "";
  }
  if (
    cleaned.gala.collar_type !== "گول کالر" &&
    cleaned.gala.collar_type !== "سیدھا کالر" &&
    cleaned.gala.collar_type !== "چھوٹا کالر"
  ) {
    cleaned.gala.collar_size = "";
  }
  if (!cleaned.gala.bain_type) cleaned.gala.bain_size = "";

  if (!cleaned.pocket.front) cleaned.pocket.front_details = "";
  if (!cleaned.pocket.side) {
    cleaned.pocket.side_count = "";
    cleaned.pocket.side_details = "";
  }

  if (cleaned.baazoo.design !== "کنی بازو" && cleaned.baazoo.design !== "گول بازو") {
    cleaned.baazoo.size = "";
    cleaned.baazoo.extra = "";
  }
  if (cleaned.baazoo.design !== "کف") {
    cleaned.baazoo.cuff_type = "";
    cleaned.baazoo.cuff_size = "";
    cleaned.baazoo.cuff_extra = "";
    cleaned.baazoo.cuff_motai = "";
    cleaned.baazoo.cuff_motai_comment = "";
  }
  if (!cleaned.baazoo.cuff_type) {
    cleaned.baazoo.cuff_size = "";
    cleaned.baazoo.cuff_extra = "";
    cleaned.baazoo.cuff_motai = "";
    cleaned.baazoo.cuff_motai_comment = "";
  }

  if (!cleaned.patai.type) cleaned.patai.patai_lambai = "";
  if (!cleaned.patai.design) cleaned.patai.design_comment = "";
  if (!cleaned.bukram.type) cleaned.bukram.value = "";
  if (!cleaned.button_design?.type && cleaned.button_design) cleaned.button_design.comment = "";
  if (!cleaned.kaaj_design?.type && cleaned.kaaj_design) cleaned.kaaj_design.comment = "";
  if (cleaned.silai.type !== "واٹس ایپ") {
    cleaned.silai.whatsapp_number = "";
    cleaned.silai.whatsapp_name = "";
    cleaned.silai.extra_style_design = "";
  }

  return cleaned;
};


const normalizeLegacy = (source) => {
  // Legacy records only had gala.type + collar_size/bain_size.
  // Safe defaults for new fields:
  // - collar_type: if legacy had collar_size (or any collar data), assume Ú¯ÙˆÙ„ Ú©Ø§Ù„Ø±.
  // - bain_type: default Ú¯ÙˆÙ„ Ø¨ÛŒÙ†.
  // - button/kaaj design fields: may not exist in old data.
  const legacyGalaType = source.galla_type || "";
  const legacyHasCollar = legacyGalaType === "Ú©Ø§Ù„Ø±" || Boolean(source.collar_size);
  const legacyHasBain = legacyGalaType === "Ø¨ÛŒÙ†" || legacyGalaType === "Ban" || Boolean(source.bain_size);


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
      type: legacyGalaType === "Ø¨ÛŒÙ†" ? "Half Bain" : legacyGalaType,
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
    cloth_type: source.cloth_type || "Ø´Ù„ÙˆØ§Ø± Ù‚Ù…ÛŒØ¶",
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

    if (merged.gala?.type === "Ú©Ø§Ù„Ø±") {
      if (merged.gala.collar_type === "Gol Collar") merged.gala.collar_type = "Ú¯ÙˆÙ„ Ú©Ø§Ù„Ø±";
      if (merged.gala.collar_type === "Chota Collar") merged.gala.collar_type = "Ú†Ú¾ÙˆÙ¹Ø§ Ú©Ø§Ù„Ø±";

      merged.gala.collar_type = merged.gala.collar_type || "";
      if (merged.gala.collar_type === "Ú†Ú¾ÙˆÙ¹Ø§ Ú©Ø§Ù„Ø±") merged.gala.collar_size = "";
    }

    if (merged.gala?.type === "Ø¨ÛŒÙ†") merged.gala.type = "Half Bain";
    if (["Half Bain", "Full Bain"].includes(merged.gala?.type)) {
      if (merged.gala.bain_type === "Gol Bain") merged.gala.bain_type = "Ú¯ÙˆÙ„ Ø¨ÛŒÙ†";
      if (merged.gala.bain_type === "Seedha Bain") merged.gala.bain_type = "Ø³ÛŒØ¯Ú¾Ø§ Ø¨ÛŒÙ†";

      merged.gala.bain_type = merged.gala.bain_type || "";
      merged.gala.bain_size = merged.gala.bain_size ?? "";
    }

    merged.patai.patai_lambai = merged.patai.patai_lambai || "";
    merged.patai.design = merged.patai.design || "";
    merged.patai.design_comment = merged.patai.design_comment || "";
    merged.kareegar = { name: merged.kareegar?.name || "" };
    merged.additional_comments = {
      ...defaultMeasurementDetails.additional_comments,
      ...(merged.additional_comments || {}),
    };

merged.coat_farmaish = source.coat_farmaish ?? source.measurement_details?.coat_farmaish ?? defaultMeasurementDetails.coat_farmaish;
    merged.waistcoat_farmaish = source.waistcoat_farmaish ?? source.measurement_details?.waistcoat_farmaish ?? defaultMeasurementDetails.waistcoat_farmaish;
    return clearInvalidDependentValues(merged);
  }

  // Detect if source is already new-format measurement_details
  // (e.g., when backend returns parsed measurements directly)
  const isNewFormat = source && (
    source.hasOwnProperty("measurements") ||
    source.hasOwnProperty("coat_farmaish") ||
    source.hasOwnProperty("waistcoat_farmaish") ||
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
      measurements: {
        ...defaultMeasurementDetails.measurements,
        ...(source.measurements || {}),
      },
    };

    if (merged.gala?.type === "Ú©Ø§Ù„Ø±") {
      if (merged.gala.collar_type === "Gol Collar") merged.gala.collar_type = "Ú¯ÙˆÙ„ Ú©Ø§Ù„Ø±";
      if (merged.gala.collar_type === "Chota Collar") merged.gala.collar_type = "Ú†Ú¾ÙˆÙ¹Ø§ Ú©Ø§Ù„Ø±";

      merged.gala.collar_type = merged.gala.collar_type || "";
      if (merged.gala.collar_type === "Ú†Ú¾ÙˆÙ¹Ø§ Ú©Ø§Ù„Ø±") merged.gala.collar_size = "";
    }

    if (merged.gala?.type === "Ø¨ÛŒÙ†") merged.gala.type = "Half Bain";
    if (["Half Bain", "Full Bain"].includes(merged.gala?.type)) {
      if (merged.gala.bain_type === "Gol Bain") merged.gala.bain_type = "Ú¯ÙˆÙ„ Ø¨ÛŒÙ†";
      if (merged.gala.bain_type === "Seedha Bain") merged.gala.bain_type = "Ø³ÛŒØ¯Ú¾Ø§ Ø¨ÛŒÙ†";

      merged.gala.bain_type = merged.gala.bain_type || "";
      merged.gala.bain_size = merged.gala.bain_size ?? "";
    }

    merged.patai.patai_lambai = merged.patai.patai_lambai || "";
    merged.patai.design = merged.patai.design || "";
    merged.patai.design_comment = merged.patai.design_comment || "";
    merged.kareegar = { name: merged.kareegar?.name || "" };
    merged.additional_comments = {
      ...defaultMeasurementDetails.additional_comments,
      ...(merged.additional_comments || {}),
    };

    return clearInvalidDependentValues(merged);
  }

  // Legacy records
  const merged = {
    ...defaultMeasurementDetails,
    ...normalizeLegacy(source),
  };

  if (merged.gala?.type === "Ú©Ø§Ù„Ø±") {
    if (merged.gala.collar_type === "Gol Collar") merged.gala.collar_type = "Ú¯ÙˆÙ„ Ú©Ø§Ù„Ø±";
    if (merged.gala.collar_type === "Chota Collar") merged.gala.collar_type = "Ú†Ú¾ÙˆÙ¹Ø§ Ú©Ø§Ù„Ø±";

    merged.gala.collar_type = merged.gala.collar_type || "";
    if (merged.gala.collar_type === "Ú†Ú¾ÙˆÙ¹Ø§ Ú©Ø§Ù„Ø±") merged.gala.collar_size = "";
  }
  if (merged.gala?.type === "Ø¨ÛŒÙ†") merged.gala.type = "Half Bain";
  if (["Half Bain", "Full Bain"].includes(merged.gala?.type)) {
    if (merged.gala.bain_type === "Gol Bain") merged.gala.bain_type = "Ú¯ÙˆÙ„ Ø¨ÛŒÙ†";
    if (merged.gala.bain_type === "Seedha Bain") merged.gala.bain_type = "Ø³ÛŒØ¯Ú¾Ø§ Ø¨ÛŒÙ†";

    merged.gala.bain_type = merged.gala.bain_type || "";
    merged.gala.bain_size = merged.gala.bain_size ?? "";
  }

  merged.patai.patai_lambai = merged.patai.patai_lambai || "";
  merged.patai.design = merged.patai.design || "";
  merged.patai.design_comment = merged.patai.design_comment || "";
  merged.kareegar = { name: merged.kareegar?.name || "" };

  return clearInvalidDependentValues(merged);
};

// Older exports may contain UTF-8 bytes decoded as Windows-1252. Keep the
// repair narrow and apply it only after field normalization so comparisons
// against legacy option values remain backward compatible.
export const repairMojibakeText = repairMojibake;


export const prepareMeasurementPayload = (measurementDetails) => ({
  measurement_details: measurementDetails,
  cloth_type: measurementDetails.cloth_type,
});

const measurementLabelMap = {
  gala: "Ú¯Ù„Ø§",
  hips: "ÛÙ¾Ø³",
  bazoo: "Ø¨Ø§Ø²Ùˆ",
  lambai: "Ù„Ù…Ø¨Ø§Ø¦ÛŒ",
  bazu: "Ø¨Ø§Ø²Ùˆ",
  taira: "ØªÛŒØ±Ø§",
  collar: "Ú©Ø§Ù„Ø±",
  seena: "Ú†Ú¾Ø§ØªÛŒ",
  half_seena: "ÛØ§Ù Ú†Ú¾Ø§ØªÛŒ",
  kamar: "Ú©Ù…Ø±",
  daaman: "Ø¯Ø§Ù…Ù†",
  shalwar: "Ø´Ù„ÙˆØ§Ø±",
  pancha: "Ù¾Ø§Ù†Ú†Û",
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
  return order
    .filter((key) => Object.prototype.hasOwnProperty.call(values || {}, key))
    .map((key) => [key, values[key]]);
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

export const getMeasurementLabel = (key) => repairMojibake(measurementLabelMap[key] || key);

export const cleanPrintMeasurementValue = (value) =>
  (() => {
    const text = String(value ?? "");
    // Comment and free-text fields (including Urdu) are opaque print content.
    if (/[^\d\s./۰-۹٠-٩+-]/u.test(text.replace(/(?:انچ|in(?:ches?)?)/giu, ""))) return text;
    return text.replace(/([\d/۰-۹٠-٩])\s*(?:انچ|in(?:ches?)?)(?=$|[\s.,;:/)])/giu, "$1").trim();
  })();

export const formatMeasurementList = (details) =>
  measurementListFields.map((key) => ({ label: measurementLabelMap[key], value: details.measurements[key] || "-" }));

export const FARMAISH_CANONICAL_ORDER = [
  { key: "gala", label: "Ú¯Ù„Û" },
  { key: "baazoo", label: "Ø¨Ø§Ø²Ùˆ" },
  { key: "patai", label: "Ù¾Ù¹Ø§Ø¦ÛŒ" },
  { key: "pocketFront", label: "\u0633\u0627\u0645\u0646\u06d2 \u067e\u0627\u06a9\u0679" },
  { key: "pocketSide", label: "\u0633\u0627\u0626\u06cc\u0688 \u067e\u0627\u06a9\u0679" },
  { key: "shalwarPocket", label: "Ø´Ù„ÙˆØ§Ø± Ø¬ÛŒØ¨" },
  { key: "buttonDesign", label: "Ø¨Ù¹Ù† ÚˆÛŒØ²Ø§Ø¦Ù†" },
  { key: "kaajDesign", label: "Ú©Ø§Ø¬ ÚˆÛŒØ²Ø§Ø¦Ù†" },
  { key: "silai", label: "Ø³Ù„Ø§Ø¦ÛŒ" },
  { key: "shalwar", label: "Ø´Ù„ÙˆØ§Ø±" },
  { key: "daaman", label: "Ø¯Ø§Ù…Ù†" },
];

const safe = (v) => v !== undefined && v !== null && String(v).trim() !== "";
const galaDisplayLabels = {
  "Goal Gala": "Ú¯ÙˆÙ„ Ú¯Ù„Ø§",
  "V Gala": "ÙˆÛŒ Ú¯Ù„Ø§",
  Ban: "Ø¨ÛŒÙ†",
  "Half Bain": "ÛØ§Ù Ø¨ÛŒÙ†",
  "Full Bain": "ÙÙ„ Ø¨ÛŒÙ†",
};
const getGalaDisplayLabel = (value) => galaDisplayLabels[value] || value;
const farmaishDisplayLabels = {
  "Half Bain": "ہاف بین",
  "Full Bain": "فل بین",
  "بین": "بین",
  "Gol Bain": "گول بین",
  "Seedha Bain": "سیدھا بین",
  "ÚˆØ¨Ù„ CTC": "ÚˆØ¨Ù„ Ø³ÛŒ Ù¹ÛŒ Ø³ÛŒ",
  "Double CTC": "ÚˆØ¨Ù„ Ø³ÛŒ Ù¹ÛŒ Ø³ÛŒ",
  "D Ú©Ù": "ÚˆÛŒ Ú©Ù",
  "Cut Cuff": "کٹ کف",
  "Gol Collar": "Ú¯ÙˆÙ„ Ú©Ø§Ù„Ø±",
  "Seedha Collar": "Ø³ÛŒØ¯Ú¾Ø§ Ú©Ø§Ù„Ø±",
  "Chota Collar": "Ú†Ú¾ÙˆÙ¹Ø§ Ú©Ø§Ù„Ø±",
  "2 Buttons": "Ø¯Ùˆ Ø¨Ù¹Ù†",
  "3 Buttons": "ØªÛŒÙ† Ø¨Ù¹Ù†",
  "Single Chaak": "Ø³Ù†Ú¯Ù„ Ú†Ø§Ú©",
  "Double Chaak": "ÚˆØ¨Ù„ Ú†Ø§Ú©",
};
const getFarmaishDisplayLabel = (value) => repairMojibake(farmaishDisplayLabels[value] || value);

export const getFarmaishRows = (details) => {
  const rows = [];
  const normalizedValue = (value) => repairMojibake(String(value ?? "").trim());
  const push = (label, value) => {
    const v = value === undefined || value === null ? "" : String(value).trim();
    if (!v) return;
    rows.push({ label: repairMojibake(label), value: repairMojibake(cleanPrintMeasurementValue(v)) });
  };
  const pushText = (label, value) => {
    if (!safe(value)) return;
    rows.push({ label: repairMojibake(label), value: String(value) });
  };

  const d = details || {};

  if (Array.isArray(d.waistcoat_farmaish)) {
    const waistcoatLabels = {
      "Boan Pocket": "Ø¨ÙˆÙ† Ù¾Ø§Ú©Ù¹",
      "Cut Daman": "Ú©Ù¹ Ø¯Ø§Ù…Ù†",
      "Down Zyada": "Ú¯ÙˆÙ„ Ø¯Ø§Ù…Ù†",
      "Daman Zyada": "Ú¯ÙˆÙ„ Ø¯Ø§Ù…Ù†",
      "Goal Daman": "Ú¯ÙˆÙ„ Ø¯Ø§Ù…Ù†",
    };
    d.waistcoat_farmaish.forEach((value) => push("ÙØ±Ù…Ø§Ø¦Ø´", waistcoatLabels[value] || value));
    // Fall through to process generic farmaish types (removed early return to prevent data loss bugs)
  }
  if (d.coat_farmaish && (safe(d.coat_farmaish.buttons) || safe(d.coat_farmaish.chaak))) {
    const buttonLabels = { "2 Buttons": "Ø¯Ùˆ Ø¨Ù¹Ù†", "3 Buttons": "ØªÛŒÙ† Ø¨Ù¹Ù†" };
    const chaakLabels = { "Single Chaak": "Ø³Ù†Ú¯Ù„ Ú†Ø§Ú©", "Double Chaak": "ÚˆØ¨Ù„ Ú†Ø§Ú©" };
    if (safe(d.coat_farmaish.buttons)) push("Ø¨Ù¹Ù†", buttonLabels[d.coat_farmaish.buttons] || d.coat_farmaish.buttons);
    if (safe(d.coat_farmaish.chaak)) push("Ú†Ø§Ú©", chaakLabels[d.coat_farmaish.chaak] || d.coat_farmaish.chaak);
    // Fall through to process generic farmaish types (removed early return to prevent data loss bugs)
  }

  // Track if gala type was already processed by waistcoat/coat blocks

  const galaValues = [];
  const appendGalaValue = (value) => {
    if (Array.isArray(value)) {
      value.forEach(appendGalaValue);
      return;
    }
    if (value && typeof value === "object") {
      Object.values(value).forEach(appendGalaValue);
      return;
    }
    const normalized = normalizedValue(value);
    if (!normalized || galaValues.includes(normalized)) return;
    const displayValue = {
      "Half Bain": "ہاف بین",
      "Full Bain": "فل بین",
      Ban: "بین",
      "Gol Bain": "گول بین",
      "Seedha Bain": "سیدھا بین",
    }[normalized] || normalized;
    if (!galaValues.includes(displayValue)) galaValues.push(displayValue);
  };
  appendGalaValue(d.gala);
  const galaComment = d.additional_comments?.gala;
  if (galaValues.length || safe(galaComment)) {
    pushText("گلا", [galaValues.join(" - "), safe(galaComment) ? String(galaComment) : ""].filter(Boolean).join(" - "));
  }

  // Ø¨Ø§Ø²Ùˆ
  const baazooDesign = normalizedValue(d.baazoo?.design);
  if (safe(baazooDesign)) {
    if (baazooDesign === "کنی بازو" || baazooDesign === "گول بازو") {
      const size = safe(d.baazoo.size) ? d.baazoo.size : "";
      push("Ø¨Ø§Ø²Ùˆ", size ? `${baazooDesign} (Ø³Ø§Ø¦Ø²: ${size})` : baazooDesign);
    } else if (baazooDesign === "کف") {
      const parts = [
        safe(d.baazoo.cuff_type) ? d.baazoo.cuff_type : "",
        safe(d.baazoo.cuff_size) ? d.baazoo.cuff_size : "",
        safe(d.baazoo.cuff_motai) ? `موٹائی: ${d.baazoo.cuff_motai}` : "",
      ].filter(Boolean);
      if (parts.length) push("بازو", parts.map(getFarmaishDisplayLabel).join(" - "));
      if (safe(d.baazoo.cuff_extra)) pushText("Ø§Ø¶Ø§ÙÛŒ Ú©Ù Ø³Ø§Ø¦Ø²", d.baazoo.cuff_extra);
      if (safe(d.baazoo.cuff_motai_comment)) pushText("Ú©Ù Ù…ÙˆÙ¹Ø§Ø¦ÛŒ Ú©Û’ ØªØ¨ØµØ±Û’", d.baazoo.cuff_motai_comment);
    } else {
      push("Ø¨Ø§Ø²Ùˆ", baazooDesign);
    }
  }

  // Ù¾Ù¹Ø§Ø¦ÛŒ
  if (safe(d.patai?.type)) {
    push("Ù¾Ù¹Ø§Ø¦ÛŒ", d.patai.type);
  }
  if (safe(d.patai?.patai_lambai)) {
    push("Ù¾Ù¹Ø§Ø¦ÛŒ Ù„Ù…Ø¨Ø§Ø¦ÛŒ", d.patai.patai_lambai);
  }
  const pataiDesign = safe(d.patai?.design) ? d.patai.design : "";
  const pataiDesignComment = safe(d.patai?.design_comment) ? d.patai.design_comment : "";
  if (pataiDesign && pataiDesignComment) {
    pushText("Ù¾Ù¹Ø§Ø¦ÛŒ ÚˆÛŒØ²Ø§Ø¦Ù†", `${pataiDesign} (${pataiDesignComment})`);
  } else if (pataiDesign) {
    push("Ù¾Ù¹Ø§Ø¦ÛŒ ÚˆÛŒØ²Ø§Ø¦Ù†", pataiDesign);
  } else if (pataiDesignComment) {
    pushText("Ù¾Ù¹Ø§Ø¦ÛŒ ÚˆÛŒØ²Ø§Ø¦Ù†", pataiDesignComment);
  }

  // Ø³Ø§Ù…Ù†Û’ Ù¾Ø§Ú©Ù¹
  if (d.pocket?.front || d.pocket?.side) {
    if (d.pocket?.front) {
      const frontDetails = d.pocket.front_details ? ` (${d.pocket.front_details})` : "";
      pushText("\u0633\u0627\u0645\u0646\u06d2 \u067e\u0627\u06a9\u0679", `\u06c1\u0627\u06ba${frontDetails}`);
    }
    if (d.pocket?.side) {
      const sideCount = d.pocket.side_count ? `${d.pocket.side_count} \u0633\u0627\u0626\u06cc\u0688 \u067e\u0627\u06a9\u0679` : "";
      const sideDetails = d.pocket.side_details ? d.pocket.side_details : "";
      const suffix = [sideCount, sideDetails].filter(Boolean).join("\u060c ");
      pushText("\u0633\u0627\u0626\u06cc\u0688 \u067e\u0627\u06a9\u0679", suffix ? `\u06c1\u0627\u06ba (${suffix})` : "\u06c1\u0627\u06ba");
    }
  }

  // Ø´Ù„ÙˆØ§Ø± Ø¬ÛŒØ¨
  const additionalPocket = d.shalwar?.additional_pocket;
  if (additionalPocket !== undefined && additionalPocket !== null && safe(additionalPocket)) {
    const pocketValue = repairMojibake(additionalPocket);
    const displayValue = pocketValue === "ہاں" ? "ہاں" : pocketValue === "نہیں" ? "نہیں" : pocketValue;
    push("Ø´Ù„ÙˆØ§Ø± Ø¬ÛŒØ¨", displayValue);
  }

  // Ø¨Ù¹Ù† ÚˆÛŒØ²Ø§Ø¦Ù†
  if (safe(d.button_design?.type)) {
    const base = d.button_design.type;
    const comment = safe(d.button_design?.comment) ? d.button_design.comment : "";
    pushText("Ø¨Ù¹Ù† ÚˆÛŒØ²Ø§Ø¦Ù†", comment ? `${base} (${comment})` : base);
  }

  // Ú©Ø§Ø¬ ÚˆÛŒØ²Ø§Ø¦Ù†
  if (safe(d.kaaj_design?.type)) {
    const base = d.kaaj_design.type;
    const comment = safe(d.kaaj_design?.comment) ? d.kaaj_design.comment : "";
    pushText("Ú©Ø§Ø¬ ÚˆÛŒØ²Ø§Ø¦Ù†", comment ? `${base} (${comment})` : base);
  }

  // Ø¨Ú©Ø±Ù…
  const bukramType = d.bukram?.type || "";
  const bukramValue = d.bukram?.value || "";
  if (safe(bukramType) || safe(bukramValue)) {
    push("Ø¨Ú©Ø±Ù…", [bukramType, bukramValue].filter(safe).join(" â€” "));
  }

  // Ù…Ù†ÚˆØ§
  if (safe(d.munda?.value)) {
    push("Ù…Ù†ÚˆØ§", d.munda.value);
  }
  if (safe(d.munda?.comment)) {
    pushText("Ù…Ù†ÚˆØ§ Ú©Ù…Ù†Ù¹Ø³", d.munda.comment);
  }

  if (safe(d.baazoo?.extra)) {
    pushText("Ø¨Ø§Ø²Ùˆ Ø§Ø¶Ø§ÙÛŒ Ø³Ø§Ø¦Ø²", d.baazoo.extra);
  }

  // Ø³Ù„Ø§Ø¦ÛŒ
  if (safe(d.silai?.type)) {
    let line = getFarmaishDisplayLabel(d.silai.type);
    if (normalizedValue(d.silai.type) === "واٹس ایپ") {
      const parts = [];
      if (safe(d.silai.whatsapp_number)) parts.push(`Ù†Ù…Ø¨Ø±: ${String(d.silai.whatsapp_number)}`);
      if (safe(d.silai.whatsapp_name)) parts.push(`Ù†Ø§Ù…: ${String(d.silai.whatsapp_name)}`);
      if (safe(d.silai.extra_style_design)) parts.push(`Ø§Ø¶Ø§ÙÛŒ: ${String(d.silai.extra_style_design)}`);
      if (parts.length) line = `${line} (${parts.join(" ØŒ ")})`;
    }
    pushText("Ø³Ù„Ø§Ø¦ÛŒ", line);
  }
  if (safe(d.silai?.extra_style_design) && normalizedValue(d.silai.type) !== "واٹس ایپ") {
    pushText("Ø§Ø¶Ø§ÙÛŒ Ø§Ø³Ù¹Ø§Ø¦Ù„ / ÚˆÛŒØ²Ø§Ø¦Ù†", d.silai.extra_style_design);
  }

  // Ø´Ù„ÙˆØ§Ø±
  if (safe(d.shalwar?.style)) {
    const shalwarComment = safe(d.shalwar?.comment) ? ` (${d.shalwar.comment})` : "";
    pushText("Ø´Ù„ÙˆØ§Ø±", d.shalwar.style + shalwarComment);
  }

  // Ø¯Ø§Ù…Ù†
  if (safe(d.daaman?.type)) {
    push("Ø¯Ø§Ù…Ù†", d.daaman.type);
  }

  const appendComment = (comment, labels, fallbackLabel) => {
    if (!safe(comment)) return;
    const repairedLabels = labels.map(repairMojibake);
    const row = rows.find((item) => repairedLabels.includes(item.label));
    if (row) {
      row.value = `${row.value} (${String(comment)})`;
    } else {
      pushText(repairMojibake(fallbackLabel), comment);
    }
  };
  appendComment(d.additional_comments?.daman, ["Ø¯Ø§Ù…Ù†", "دامن"], "Ø¯Ø§Ù…Ù†");
  appendComment(d.additional_comments?.other, [], "\u062e\u0635\u0648\u0635\u06cc \u06c1\u062f\u0627\u06cc\u0627\u062a");

  return rows;
};
