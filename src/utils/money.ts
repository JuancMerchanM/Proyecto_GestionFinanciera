import { getCurrency } from '../config/currencies.ts';

// Formatea enteros en unidad mínima a decimal solo al mostrar (ej: 50000 COP → $50.000).
export function formatMoney(amountMinor: number, currency: string): string {
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

export function parseMinor(value: unknown, decimals: number): number {
  if (Number.isSafeInteger(value)) return value as number;
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return Number(value);
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 10 ** decimals);
  }
  return NaN;
}
