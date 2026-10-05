/**
 * Measurement utility functions (ported from the desktop frontend).
 *
 * These preserve the exact collar / cuff / Farmaish / measurement concepts so
 * the Android app reads and writes the same JSONB structure the backend
 * stores and the desktop app displays.
 */
import { defaultMeasurementDetails, measurementRows } from '../constants/measurementFields';

const parse = (source) => {
  if (!source) return null;
  if (typeof source === 'string') {
    try {
      return JSON.parse(source);
    } catch {
      return null;
    }
  }
  return source;
};

/** Normalize any incoming measurement payload to the canonical structure. */
export const normalizeMeasurementData = (source) => {
  if (!source) return { ...defaultMeasurementDetails };
  const data = parse(source);
  if (!data) return { ...defaultMeasurementDetails };

  // Newer stored format that carries measurement_details
  if (data.measurement_details) {
    const merged = {
      ...defaultMeasurementDetails,
      ...data.measurement_details,
      notes: data.comments ?? data.measurement_details.notes ?? data.notes ?? '',
      cloth_type:
        data.cloth_type ?? data.measurement_details.cloth_type ?? defaultMeasurementDetails.cloth_type,
      button_design:
        data.button_design ??
        data.measurement_details?.button_design ??
        defaultMeasurementDetails.button_design,
      kaaj_design:
        data.kaaj_design ??
        data.measurement_details?.kaaj_design ??
        defaultMeasurementDetails.kaaj_design,
    };
    return normalizeGala(merged);
  }

  // Already canonical measurement_details object
  const isNewFormat =
    data &&
    (Object.prototype.hasOwnProperty.call(data, 'gala') ||
      Object.prototype.hasOwnProperty.call(data, 'daaman') ||
      Object.prototype.hasOwnProperty.call(data, 'pocket') ||
      Object.prototype.hasOwnProperty.call(data, 'baazoo') ||
      Object.prototype.hasOwnProperty.call(data, 'button_design') ||
      Object.prototype.hasOwnProperty.call(data, 'kaaj_design'));

  if (isNewFormat) {
    const merged = {
      ...defaultMeasurementDetails,
      ...data,
      notes: data.notes ?? data.comments ?? '',
      cloth_type: data.cloth_type ?? defaultMeasurementDetails.cloth_type,
    };
    return normalizeGala(merged);
  }

    // Legacy flat records
  const merged = {
    ...defaultMeasurementDetails,
    ...normalizeLegacy(data),
  };
  return normalizeGala(merged);
};

const normalizeGala = (merged) => {
  if (merged.gala && merged.gala.type === 'کالر') {
    if (merged.gala.collar_type === 'Gol Collar') merged.gala.collar_type = 'گول کالر';
    if (merged.gala.collar_type === 'Chota Collar') merged.gala.collar_type = 'چھوٹا کالر';
    merged.gala.collar_type = merged.gala.collar_type || '';
    if (merged.gala.collar_type === 'چھوٹا کالر') merged.gala.collar_size = '';
  }
  if (merged.gala && merged.gala.type === 'بین') {
    if (merged.gala.bain_type === 'Gol Bain') merged.gala.bain_type = 'گول بین';
    if (merged.gala.bain_type === 'Seedha Bain') merged.gala.bain_type = 'سیدھا بین';
    merged.gala.bain_type = merged.gala.bain_type || '';
    merged.gala.bain_size = merged.gala.bain_size ?? '';
  }
  merged.patai = merged.patai || {};
  merged.patai.patai_lambai = merged.patai.patai_lambai || '';
  return merged;
};

const normalizeLegacy = (source) => {
  const legacyGalaType = source.galla_type || '';
  const legacyHasCollar = legacyGalaType === 'کالر' || Boolean(source.collar_size);
  const legacyHasBain = legacyGalaType === 'بین' || Boolean(source.bain_size);
  return {
    measurements: {
      lambai: source.lambai || '',
      bazu: source.bazu || '',
      taira: source.taira || '',
      collar: source.collar || '',
      seena: source.seena || '',
      half_seena: source.half_seena || '',
      kamar: source.kamar || '',
      daaman: source.daaman || '',
      shalwar: source.shalwar || '',
      pancha: source.pancha || '',
    },
    button_design: source.button_design || defaultMeasurementDetails.button_design,
    kaaj_design: source.kaaj_design || defaultMeasurementDetails.kaaj_design,
    gala: {
      type: legacyGalaType,
      collar_type: legacyHasCollar ? source.collar_type || '' : '',
      collar_size: source.collar_size || '',
      bain_type: legacyHasBain ? source.bain_type || '' : '',
      bain_size: source.bain_size || '',
    },
    daaman: { type: source.daman || '' },
    pocket: {
      front: Boolean(source.pocket_front),
      front_details: source.pocket_front_details || '',
      side: Boolean(source.pocket_side),
      side_count: source.pocket_side_count || '',
      side_details: source.pocket_side_details || '',
    },
    baazoo: {
      design: source.bazu_design || '',
      size: source.bazu_size || '',
      extra: source.bazu_extra || '',
      cuff_type: source.cuff_type || '',
      cuff_size: source.cuff_size || '',
      cuff_extra: source.cuff_extra || '',
      cuff_motai: source.cuff_motai || '',
      cuff_motai_comment: source.cuff_motai_comment || '',
    },
    patai: { type: source.pitai || '', patai_lambai: source.patai_lambai || '' },
    silai: {
      type: source.silai || '',
      whatsapp_number: source.whatsapp_number || '',
      whatsapp_name: source.whatsapp_name || '',
      extra_style_design: source.extra_style_design || '',
    },
    shalwar: {
      style: source.shalwar_style || '',
      additional_pocket: source.additional_pocket || '',
    },
    notes: source.notes || source.comments || '',
    cloth_type: source.cloth_type || 'شلوار قمیض',
  };
};

/** Build the payload sent to POST/PUT /api/measurements. */
export const prepareMeasurementPayload = (measurementDetails) => ({
  measurements: measurementDetails,
  comments: measurementDetails.notes || '',
});

const safe = (v) => v !== undefined && v !== null && String(v).trim() !== '';

export const measurementLabelMap = Object.fromEntries(
  measurementRows.map((r) => [r.key, r.label]),
);

export const getMeasurementLabel = (key) => measurementLabelMap[key] || key;
export const formatMeasurementList = (details) =>
  measurementRows.map((r) => ({ label: r.label, value: details.measurements[r.key] || '-' }));

export const FARMAISH_CANONICAL_ORDER = [
  { key: 'gala', label: 'گلہ' },
  { key: 'baazoo', label: 'بازو' },
  { key: 'patai', label: 'پٹائی' },
  { key: 'pocketFront', label: 'سامنے پاکٹ' },
  { key: 'pocketSide', label: 'سائیڈ پاکٹ' },
  { key: 'shalwarPocket', label: 'شلوار جیب' },
  { key: 'buttonDesign', label: 'بٹن ڈیزائن' },
  { key: 'kaajDesign', label: 'کاج ڈیزائن' },
  { key: 'silai', label: 'سلائی' },
  { key: 'shalwar', label: 'شلوار' },
    { key: 'daaman', label: 'دامن' },
];

/**
 * Extract "Farmaish" (additional instructions / design choices) rows for display,
 * exactly mirroring the desktop Frontend logic so both apps read the same data.
 */
export const getFarmaishRows = (details) => {
  const rows = [];
  const push = (label, value) => {
    const v = value === undefined || value === null ? '' : String(value).trim();
    if (!v) return;
    rows.push({ label, value: v });
  };

  const d = details || {};

  // گلہ
  const galaType = d.gala?.type || '';
  if (safe(galaType)) {
    if (galaType === 'کالر') {
      const collarType = d.gala.collar_type || '';
      const collarSize = safe(d.gala.collar_size) ? d.gala.collar_size : '';
      if (safe(collarType)) {
        push('کالر', collarSize ? `${collarType} (سائز: ${collarSize})` : collarType);
      }
    } else if (galaType === 'بین') {
      const bainType = d.gala.bain_type || '';
      const bainSize = safe(d.gala.bain_size) ? d.gala.bain_size : '';
      if (safe(bainType)) {
        push('بین', bainSize ? `${bainType} (سائز: ${bainSize})` : bainType);
      }
    } else {
      push('گلہ', galaType);
    }
  }

  // بازو
  const baazooDesign = d.baazoo?.design || '';
  if (safe(baazooDesign)) {
    if (baazooDesign === 'کنی بازو' || baazooDesign === 'گول بازو') {
      const size = safe(d.baazoo.size) ? d.baazoo.size : '';
      push('بازو', size ? `${baazooDesign} (سائز: ${size})` : baazooDesign);
    } else if (baazooDesign === 'کف') {
      const parts = [
        safe(d.baazoo.cuff_type) ? d.baazoo.cuff_type : '',
        safe(d.baazoo.cuff_size) ? d.baazoo.cuff_size : '',
        safe(d.baazoo.cuff_motai) ? `موٹائی: ${d.baazoo.cuff_motai}` : '',
      ].filter(Boolean);
      if (parts.length) push('کف', parts.join(' / '));
      if (safe(d.baazoo.cuff_extra)) push('اضافی کف سائز', d.baazoo.cuff_extra);
      if (safe(d.baazoo.cuff_motai_comment)) push('Cuff Motai کمنٹس', d.baazoo.cuff_motai_comment);
    } else {
      push('بازو', baazooDesign);
    }
  }

  // پٹائی
  if (safe(d.patai?.type)) push('پٹائی', d.patai.type);
  if (safe(d.patai?.patai_lambai)) push('پٹائی لمبائی', d.patai.patai_lambai);

  // سامنے / سائیڈ پاکٹ
  if (d.pocket?.front || d.pocket?.side) {
    if (d.pocket?.front) {
      const frontDetails = d.pocket.front_details ? ` (${d.pocket.front_details})` : '';
      push('سامنے پاکٹ', `ہاں${frontDetails}`);
    }
    if (d.pocket?.side) {
      const sideCount = d.pocket.side_count ? `${d.pocket.side_count} سائیڈ پاکٹ` : '';
      const sideDetails = d.pocket.side_details ? d.pocket.side_details : '';
      const suffix = [sideCount, sideDetails].filter(Boolean).join('، ');
      push('سائیڈ پاکٹ', suffix ? `ہاں (${suffix})` : 'ہاں');
    }
  }

  // شلوار جیب
  const additionalPocket = d.shalwar?.additional_pocket;
  if (additionalPocket !== undefined && additionalPocket !== null && safe(additionalPocket)) {
    push('شلوار جیب', additionalPocket === 'ہاں' ? 'ہاں' : 'نہیں');
  }

  // بٹن ڈیزائن
  if (safe(d.button_design?.type)) {
    const base = d.button_design.type;
    const comment = safe(d.button_design?.comment) ? d.button_design.comment : '';
    push('بٹن ڈیزائن', comment ? `${base} (${comment})` : base);
  }

  // کاج ڈیزائن
  if (safe(d.kaaj_design?.type)) {
    const base = d.kaaj_design.type;
    const comment = safe(d.kaaj_design?.comment) ? d.kaaj_design.comment : '';
    push('کاج ڈیزائن', comment ? `${base} (${comment})` : base);
  }

  // سلائی
  if (safe(d.silai?.type)) {
    let line = d.silai.type;
    if (d.silai.type === 'واٹس ایپ') {
      const parts = [];
      if (safe(d.silai.whatsapp_number)) parts.push(`نمبر: ${d.silai.whatsapp_number}`);
      if (safe(d.silai.whatsapp_name)) parts.push(`نام: ${d.silai.whatsapp_name}`);
      if (safe(d.silai.extra_style_design)) parts.push(`اضافی: ${d.silai.extra_style_design}`);
      if (parts.length) line = `${line} (${parts.join(' ، ')})`;
    }
    push('سلائی', line);
  }

  // شلوار
  if (safe(d.shalwar?.style)) push('شلوار', d.shalwar.style);

  // دامن
  if (safe(d.daaman?.type)) push('دامن', d.daaman.type);

  return rows;
};

export default {
  normalizeMeasurementData,
  prepareMeasurementPayload,
  getFarmaishRows,
  formatMeasurementList,
  getMeasurementLabel,
  FARMAISH_CANONICAL_ORDER,
};

