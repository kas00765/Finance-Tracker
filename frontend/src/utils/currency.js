// Multi-currency support using the free, keyless Frankfurter exchange-rate API.
// https://frankfurter.dev

export const SUPPORTED_CURRENCIES = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'SGD', name: 'Singapore Dollar' },
];

// Fetches how much 1 unit of `homeCurrency` is worth in every other supported currency.
// e.g. for homeCurrency = 'USD', rates.EUR = 0.92 means 1 USD = 0.92 EUR.
const cache = new Map();
export function invalidateRates(currency) {
  cache.delete(currency);
}
export async function fetchRates(homeCurrency) {
  const existing = cache.get(homeCurrency);
  if (existing && existing.expires > Date.now()) return existing.promise;
  const promise = (async () => {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${homeCurrency}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error('Failed to fetch exchange rates');
    const data = await res.json();
    if (data.base !== homeCurrency || !data.rates) throw new Error('Invalid exchange rates');
    return { base: data.base, rates: data.rates, date: data.date };
  })();
  cache.set(homeCurrency, { promise, expires: Date.now() + 5 * 60 * 1000 });
  try {
    return await promise;
  } catch (error) {
    if (cache.get(homeCurrency)?.promise === promise) cache.delete(homeCurrency);
    throw error;
  }
}

// Converts an amount in `fromCurrency` into `toCurrency`, given a rates object
// shaped like { base: toCurrency, rates: { [otherCurrency]: rateFromBase } }.
export function hasRatesFor(currencies, toCurrency, ratesData) {
  return currencies.every(
    (currency) =>
      currency === toCurrency ||
      (ratesData?.base === toCurrency &&
        Number.isFinite(ratesData.rates?.[currency]) &&
        ratesData.rates[currency] > 0),
  );
}

export function convertAmount(amount, fromCurrency, toCurrency, ratesData) {
  if (fromCurrency === toCurrency) return amount;
  if (!hasRatesFor([fromCurrency], toCurrency, ratesData))
    throw new Error(`Missing exchange rate for ${fromCurrency}`);
  return amount / ratesData.rates[fromCurrency];
}

export function formatMoney(amount, currency) {
  if (!Number.isFinite(amount)) return '—';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
