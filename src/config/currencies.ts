export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  locale: string;
}

export const CURRENCIES: Record<string, CurrencyInfo> = {
  COP: { code: 'COP', name: 'Peso colombiano', symbol: '$', decimals: 0, locale: 'es-CO' },
  USD: { code: 'USD', name: 'US Dollar', symbol: 'US$', decimals: 2, locale: 'en-US' },
};

export const CURRENCY_CODES: string[] = Object.keys(CURRENCIES);

export const isSupportedCurrency = (code: unknown): code is string =>
  typeof code === 'string' && Object.hasOwn(CURRENCIES, code.toUpperCase());

export const getCurrency = (code: string | null | undefined): CurrencyInfo | null =>
  code ? (CURRENCIES[code.toUpperCase()] ?? null) : null;
