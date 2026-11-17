import { useMemo } from 'react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { fetchRates, hasRatesFor, convertAmount, invalidateRates } from '../utils/currency.js';
import { useResource } from './useResource.js';

export function useFinanceData(params = {}, budgetMonth) {
  const { homeCurrency } = useAuth();
  const finance = useResource(JSON.stringify([params, budgetMonth]), async () => {
    const [transactions, categories, budgets] = await Promise.all([
      api.getTransactions(params),
      api.getCategories(),
      budgetMonth ? api.getBudgets(budgetMonth) : Promise.resolve([]),
    ]);
    return { transactions, categories, budgets };
  });
  const rates = useResource(homeCurrency, () => fetchRates(homeCurrency));
  const data = useMemo(() => {
    if (!finance.data) return null;
    const { transactions, categories, budgets } = finance.data;
    const canConvert = hasRatesFor(
      [...transactions.map((t) => t.currency), ...budgets.map((b) => b.currency)],
      homeCurrency,
      rates.data,
    );
    return {
      transactions: transactions.map((t) => ({
        ...t,
        transaction_date: t.transaction_date.slice(0, 10),
        convertedAmount: canConvert
          ? convertAmount(Number(t.amount), t.currency, homeCurrency, rates.data)
          : null,
      })),
      categories,
      budgets,
      canConvert,
      rates: rates.data,
      ratesLoading: rates.loading,
    };
  }, [finance.data, rates.data, rates.loading, homeCurrency]);
  return {
    ...finance,
    data,
    homeCurrency,
    retryRates: () => {
      invalidateRates(homeCurrency);
      rates.reload();
    },
  };
}
