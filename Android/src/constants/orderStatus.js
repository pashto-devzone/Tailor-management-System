/**
 * Order statuses and payment statuses used across the desktop and Android apps.
 * Mirrors the backend orderModel / orderController status values.
 */
export const ORDER_STATUSES = {
  PENDING: 'pending',
  READY: 'ready',
  DELIVERED: 'delivered',
};

export const ORDER_STATUS_CONFIG = {
  [ORDER_STATUSES.PENDING]: {
    label: 'Pending',
    color: '#f59e0b',
    bg: '#fef3c7',
  },
  [ORDER_STATUSES.READY]: {
    label: 'Ready',
    color: '#0ea5e9',
    bg: '#e0f2fe',
  },
  [ORDER_STATUSES.DELIVERED]: {
    label: 'Delivered',
    color: '#16a34a',
    bg: '#dcfce7',
  },
};

// The standard next-status progression (matches desktop OrderCard)
export const ORDER_NEXT_STATUS = (status) => {
  if (status === 'pending') return 'ready';
  if (status === 'ready') return 'delivered';
  return 'delivered';
};

export const PAYMENT_STATUSES = {
  UNPAID: 'Unpaid',
  PARTIAL: 'Partial',
  PAID: 'Paid',
};

export const PAYMENT_STATUS_CONFIG = {
  [PAYMENT_STATUSES.UNPAID]: { label: 'Unpaid', color: '#dc2626', bg: '#fee2e2' },
  [PAYMENT_STATUSES.PARTIAL]: { label: 'Partially Paid', color: '#d97706', bg: '#fef3c7' },
  [PAYMENT_STATUSES.PAID]: { label: 'Fully Paid', color: '#16a34a', bg: '#dcfce7' },
};

export const getStatusConfig = (status) =>
  ORDER_STATUS_CONFIG[status] || ORDER_STATUS_CONFIG.ORDER_STATUSES?.[status] || null;

export const getPaymentStatusConfig = (status) =>
  PAYMENT_STATUS_CONFIG[status] || null;

export const DRESS_TYPES = [
  { label: 'Shalwar Kameez', value: 'shalwar kameez' },
  { label: 'Waistcoat', value: 'waistcoat' },
  { label: 'Sherwani', value: 'sherwani' },
];

export default {
  ORDER_STATUSES,
  ORDER_STATUS_CONFIG,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_CONFIG,
  DRESS_TYPES,
};