const INR_TO_LOCAL_RATES: Record<string, number> = {
  INR: 1,
  THB: 0.42,
  SGD: 0.016,
  AED: 0.044,
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  THB: '฿',
  SGD: 'S$',
  AED: 'د.إ',
};

const CURRENCY_DECIMALS: Record<string, number> = {
  INR: 0,
  THB: 0,
  SGD: 2,
  AED: 2,
};

function roundByCurrency(value: number, currencyCode: string) {
  const decimals = CURRENCY_DECIMALS[currencyCode] ?? 2;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function getInrToLocalRate(currencyCode: string) {
  return INR_TO_LOCAL_RATES[currencyCode] ?? 1;
}

export function getCurrencySymbol(currencyCode: string) {
  return CURRENCY_SYMBOLS[currencyCode] ?? currencyCode;
}

export function convertInrToLocal(amountInr: number, currencyCode: string) {
  const safeAmount = Number.isFinite(amountInr) ? amountInr : 0;
  return roundByCurrency(safeAmount * getInrToLocalRate(currencyCode), currencyCode);
}

