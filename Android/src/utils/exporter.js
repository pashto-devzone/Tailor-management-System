/**
 * Lightweight export / share helpers.
 *
 * The desktop app prints orders and measurements. On Android the practical
 * equivalent — without adding native dependencies — is the built-in `Share`
 * API, which lets the owner send a record's summary to WhatsApp / email / a
 * notes app / the system print service. No files are written, no cloud call is
 * made, and no new dependency is required.
 */
import { Share, Alert } from 'react-native';
import { formatCurrency } from './currency';

const shareOrAlert = async (title, message) => {
  try {
    await Share.share({ title, message });
    return true;
  } catch (error) {
    // User cancelled the share sheet — not an error worth surfacing.
    if (error && error.message && /cancel/i.test(error.message)) return false;
    Alert.alert('Share unavailable', 'This device could not open the share sheet.');
    return false;
  }
};

/** Build a plain-text summary of an order (desktop order-print equivalent). */
export const buildOrderSummary = (order, currency = 'PKR') => {
  if (!order) return '';
  const total = Number(order.total_amount ?? order.price ?? 0);
  const paid = Number(order.paid_amount ?? order.advance ?? 0);
  const remaining = Math.max(total - paid, 0);
  const line = (label, value) => `${label}: ${value === undefined || value === null || value === '' ? '-' : value}`;

  return [
    '--- ORDER ---',
    line('Order #', order.order_number || order.id),
    line('Customer', order.customer_name),
    line('Phone', order.customer_phone),
    line('Dress', order.dress_type),
    line('Delivery date', order.delivery_date),
    line('Status', order.status),
    '',
    `Total: ${formatCurrency(total, currency)}`,
    `Paid: ${formatCurrency(paid, currency)}`,
    `Balance: ${formatCurrency(remaining, currency)}`,
    `Payment status: ${order.payment_status || '-'}`,
    '',
    'Tailor Management System',
  ].join('\n');
};

/** Build a plain-text summary of a measurement record (Farmaish included). */
export const buildMeasurementSummary = (record, customerName) => {
  if (!record) return '';
  // Imported lazily to avoid a circular import with measurementUtils.
  // eslint-disable-next-line global-require
  const { normalizeMeasurementData, getFarmaishRows } = require('./measurementUtils');
  const details = normalizeMeasurementData(record.measurements || record);
  const farmaish = getFarmaishRows(details);
  const basic = Object.entries(details.measurements || {})
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '');

  const lines = ['--- MEASUREMENT ---'];
  if (customerName) lines.push(`Customer: ${customerName}`);
  if (basic.length > 0) {
    lines.push('');
    basic.forEach(([key, value]) => lines.push(`${key}: ${value}`));
  }
  if (farmaish.length > 0) {
    lines.push('');
    lines.push('Farmaish:');
    farmaish.forEach((row) => lines.push(`${row.label}: ${row.value}`));
  }
  if (details.cloth_type) {
    lines.push('');
    lines.push(`Cloth: ${details.cloth_type}`);
  }
  const notes = record.comments || details.notes;
  if (notes) {
    lines.push('');
    lines.push(`Notes: ${notes}`);
  }
  lines.push('');
  lines.push('Tailor Management System');
  return lines.join('\n');
};

export const shareText = (title, message) => shareOrAlert(title, message);

export default { buildOrderSummary, buildMeasurementSummary, shareText };
