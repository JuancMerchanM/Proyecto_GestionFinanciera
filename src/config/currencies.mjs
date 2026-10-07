export const CURRENCIES = {
  COP: { code: 'COP', name: 'Peso colombiano', symbol: '$', decimals: 0, locale: 'es-CO' },
  USD: { code: 'USD', name: 'US Dollar', symbol: 'US$', decimals: 2, locale: 'en-US' },
};

export const CURRENCY_CODES = Object.keys(CURRENCIES);

export const isSupportedCurrency = (code) =>
  typeof code === 'string' && Object.hasOwn(CURRENCIES, code.toUpperCase());

export const getCurrency = (code) => CURRENCIES[code?.toUpperCase()] ?? null;
