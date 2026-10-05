/**
 * Measurement field definitions and option lists.
 *
 * These are ported faithfully from the desktop frontend
 * (Frontend/src/utils/measurementUtils.js + components/MeasurementModal.jsx)
 * so the Android app supports the SAME collar / cuff / Farmaish / measurement
 * concepts and options. Do NOT simplify or replace these fields.
 *
 * The stored `measurements` JSON object matches defaultMeasurementDetails below
 * and is sent to /api/measurements as the `measurements` JSONB field.
 */

export const defaultMeasurementDetails = {
  measurements: {
    lambai: '',
    bazu: '',
    taira: '',
    collar: '',
    seena: '',
    half_seena: '',
    kamar: '',
    daaman: '',
    shalwar: '',
    pancha: '',
  },
  gala: {
    type: '',
    // New enhancement fields (backward compatible)
    collar_type: '',
    collar_size: '',
    bain_type: '',
    bain_size: '',
  },
  daaman: {
    type: '',
  },
  pocket: {
    front: false,
    front_details: '',
    side: false,
    side_count: '',
    side_details: '',
  },
  baazoo: {
    design: '',
    size: '',
    extra: '',
    cuff_type: '',
    cuff_size: '',
    cuff_extra: '',
    cuff_motai: '',
    cuff_motai_comment: '',
  },
  patai: {
    type: '',
    patai_lambai: '',
  },
  silai: {
    type: '',
    whatsapp_number: '',
    whatsapp_name: '',
    extra_style_design: '',
  },
  shalwar: {
    style: '',
    additional_pocket: '',
  },
  // NEW: Button + Kaaj design values stored inside measurement_details
  button_design: {
    type: '',
    comment: '',
  },
  kaaj_design: {
    type: '',
    comment: '',
  },
  notes: '',
  cloth_type: 'شلوار قمیض',
};

// --- Option lists (ported from MeasurementModal.jsx) ---

export const galaOptions = ['کالر', 'بین', 'مغزی گلہ', 'ہندی گلہ', 'قاسمی گلہ'];

export const collarTypes = ['گول کالر', 'سیدھا کالر', 'چھوٹا کالر'];
export const collarSizes = ['1.25 انچ', '1.5 انچ', '1.75 انچ', '2 انچ', '2.25 انچ', '2.5 انچ', '2.75 انچ', '3 انچ'];

export const bainTypes = ['گول بین', 'سیدھا بین'];
export const bainSizes = ['0.5 انچ', '0.75 انچ', '1 انچ', '1.1 انچ', '1.25 انچ', '1.5 انچ'];

export const damanOptions = ['گول دامن', 'سیدھا دامن'];

export const bazuDesigns = ['کنی بازو', 'گول بازو', 'کف'];
export const bazuSizes = ['5 انچ', '5.5 انچ', '5.75 انچ', '6 انچ', '6.25 انچ', '6.5 انچ', '7 انچ'];
export const cuffTypes = ['عام کف', 'سیدھا کف', 'گول کف', 'D کف'];
export const cuffSizes = ['8 انچ', '8.25 انچ', '8.5 انچ', '8.75 انچ', '9 انچ', '9.25 انچ', '9.5 انچ', '9.75 انچ', '10 انچ'];
export const cuffMotaiOptions = ['2.5 انچ', '3 انچ'];

export const pataiOptions = ['0.5 انچ', '0.75 انچ', '1 انچ', '1.1 انچ', '1.25 انچ', '1.5 انچ'];

export const silaiOptions = [
  'سادہ سلائی',
  'ڈبل سلائی سادہ',
  'سنگل چمک سلائی',
  'ڈبل چمک سلائی',
  'ٹک پہ ٹک سلائی',
  'سنگل زنجیر سلائی',
  'ڈبل زنجیر سلائی',
  'نزدیک سلائی سادہ',
  'نزدیک سلائی چمک',
  'ڈبل CTC',
  'واٹس ایپ',
];

export const shalwarOptions = [
  'نارمل شلوار',
  'پٹیالہ شلوار',
  'فل پٹیالہ شلوار',
  'پینٹ شلوار (جیب والی)',
  'پینٹ شلوار (بغیر جیب)',
];

// Button + Kaaj options — exact Urdu values used by the desktop MeasurementModal.
export const buttonDesignOptions = ['فینسی رنگ', 'سادہ رنگ', 'ہک بٹن', 'اسپیشل بٹن'];
export const kaajDesignOptions = ['ڈبل کاج', 'اسٹڈ کاج', 'سادہ کاج'];

// Pocket side count (desktop stores the plain number "1" or "2")
export const pocketSideCountOptions = ['1 سائیڈ پاکٹ', '2 سائیڈ پاکٹ'];

// Shalwar additional pocket
export const shalwarPocketOptions = ['ہاں', 'نہیں'];

// Human-readable labels for the basic measurement inputs
export const measurementLabels = {
  lambai: 'لمبائی',
  bazu: 'بازو',
  taira: 'تیرا',
  collar: 'کالر',
  seena: 'چھاتی',
  half_seena: 'ہاف چھاتی',
  kamar: 'کمر',
  daaman: 'دامن',
  shalwar: 'شلوار',
  pancha: 'پانچہ',
};

export const measurementRows = [
  { key: 'lambai', label: 'لمبائی' },
  { key: 'bazu', label: 'بازو' },
  { key: 'taira', label: 'تیرا' },
  { key: 'collar', label: 'کالر' },
  { key: 'seena', label: 'چھاتی' },
  { key: 'half_seena', label: 'ہاف چھاتی' },
  { key: 'kamar', label: 'کمر' },
  { key: 'daaman', label: 'دامن' },
  { key: 'shalwar', label: 'شلوار' },
  { key: 'pancha', label: 'پانچہ' },
];

export default {
  defaultMeasurementDetails,
  galaOptions,
  collarTypes,
  collarSizes,
  bainTypes,
  bainSizes,
  damanOptions,
  bazuDesigns,
  bazuSizes,
  cuffTypes,
  cuffSizes,
  cuffMotaiOptions,
  pataiOptions,
  silaiOptions,
  shalwarOptions,
  buttonDesignOptions,
  kaajDesignOptions,
  pocketSideCountOptions,
  shalwarPocketOptions,
};