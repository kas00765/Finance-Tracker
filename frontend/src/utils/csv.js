function cell(value, text = false) {
  let content = String(value ?? '');
  // Prevent spreadsheet apps from interpreting user-entered text as formulas.
  if (text && /^[\s]*[=+@-]/.test(content)) content = `'${content}`;
  return `"${content.replaceAll('"', '""')}"`;
}

export function transactionsToCsv(transactions) {
  const rows = ['Date,Type,Category,Note,Amount,Currency'];
  for (const t of transactions)
    rows.push(
      [
        cell(t.transaction_date.slice(0, 10)),
        cell(t.type),
        cell(t.category_name || 'Uncategorized', true),
        cell(t.note, true),
        cell(t.amount),
        cell(t.currency),
      ].join(','),
    );
  return '\uFEFF' + rows.join('\r\n') + '\r\n';
}

export function downloadTransactions(transactions, filename = 'finance-guard-transactions.csv') {
  const url = URL.createObjectURL(
    new Blob([transactionsToCsv(transactions)], { type: 'text/csv;charset=utf-8;' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
