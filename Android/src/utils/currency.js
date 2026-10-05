/**
 * Currency helpers. Mirrors the desktop Frontend currency formatting.
 * Default currency is PKR (set during registration).
 */
export const formatCurrency = (value, currency = 'PKR') => {
  const num = Number(value);
  if (Number.isNaN(num)) return '0';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(num);
};

export const formatCurrencyFull = (value, currency = 'PKR') => {
  if (value === null || value === undefined || value === '') return `${currency} 0`;
  return `${currency} ${formatCurrency(value, currency)}`;
};

export const parseCurrency = (value) => {
  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
};

export default { formatCurrency, formatCurrencyFull, parseCurrency };