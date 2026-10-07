import { getCurrency } from '../config/currencies.mjs';

// Formatea enteros en unidad mínima a decimal solo al mostrar (ej: 50000 COP → $50.000).
export function formatMoney(amountMinor, currency) {
  const c = getCurrency(currency);
  if (!c) return String(amountMinor);
  const value = amountMinor / 10 ** c.decimals;
  return new Intl.NumberFormat(c.locale, {
    style: 'currency',
    currency: c.code,
    minimumFractionDigits: c.decimals,
    maximumFractionDigits: c.decimals,
  }).format(value);
}

export function parseMinor(value, decimals) {
  if (Number.isSafeInteger(value)) return value;
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return Number(value);
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 10 ** decimals);
  }
  return NaN;
}
