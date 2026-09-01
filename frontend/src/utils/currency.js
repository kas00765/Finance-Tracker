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
export async function fetchRates(homeCurrency) {
  const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${homeCurrency}`);
  if (!res.ok) throw new Error('Failed to fetch exchange rates');
  const data = await res.json();
  return { base: data.base, rates: data.rates };
}

// Converts an amount in `fromCurrency` into `toCurrency`, given a rates object
// shaped like { base: toCurrency, rates: { [otherCurrency]: rateFromBase } }.
export function convertAmount(amount, fromCurrency, toCurrency, ratesData) {
  if (!ratesData || fromCurrency === toCurrency) return amount;
  const rate = ratesData.rates[fromCurrency];
  if (!rate) return amount; // unsupported currency pair — show as-is rather than break
  return amount / rate;
}

export function formatMoney(amount, currency) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
