import Papa from 'papaparse';

export const MAX_IMPORT_ROWS = 500;
export const MAX_FILE_BYTES = 1024 * 1024;

export function parseImportFile(text) {
  if (text.includes('\0'))
    throw new Error('Choose a UTF-8 CSV or TSV file, not an Excel workbook.');
  const result = Papa.parse(text, {
    skipEmptyLines: 'greedy',
    delimitersToGuess: [',', ';', '\t'],
  });
  if (result.errors.length)
    throw new Error(`Could not read this file: ${result.errors[0].message}`);
  const [headers, ...rows] = result.data;
  if (!headers || headers.length < 2 || headers.length > 100)
    throw new Error('The first row must contain between 2 and 100 column headings.');
  if (!rows.length || rows.length > MAX_IMPORT_ROWS)
    throw new Error(
      `Choose a file with 1–${MAX_IMPORT_ROWS} transaction records, plus a header row.`,
    );
  return { headers: headers.map((header) => header.trim()), rows };
}

export function guessMapping(headers) {
  const aliases = {
    date: ['date', 'transactiondate', 'posteddate', 'postingdate'],
    amount: ['amount', 'value', 'total'],
    type: ['type', 'transactiontype'],
    currency: ['currency', 'ccy'],
    category: ['category', 'categoryname'],
    note: ['note', 'description', 'memo', 'narrative'],
  };
  return Object.fromEntries(
    Object.entries(aliases).map(([field, names]) => {
      const index = headers.findIndex((header) =>
        names.includes(header.toLowerCase().replace(/[^a-z]/g, '')),
      );
      return [field, index === -1 ? (field === 'type' ? '__signed' : '') : String(index)];
    }),
  );
}

function parseDate(value, format) {
  let date = value.trim();
  if (format !== 'iso') {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(date);
    if (!match) throw new Error(`Date must use ${format === 'dmy' ? 'DD/MM/YYYY' : 'MM/DD/YYYY'}.`);
    const [, first, second, year] = match;
    const month = format === 'dmy' ? second : first;
    const day = format === 'dmy' ? first : second;
    date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Date must use YYYY-MM-DD.');
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date)
    throw new Error('This calendar date does not exist.');
  return date;
}

function parseAmount(value, format) {
  const raw = value.trim();
  const pattern =
    format === 'comma'
      ? /^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/
      : /^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/;
  if (!pattern.test(raw))
    throw new Error(
      'Amount does not match the selected number format. Use at most two decimal places and no currency symbols.',
    );
  const valueNumber = Number(
    format === 'comma' ? raw.replaceAll('.', '').replace(',', '.') : raw.replaceAll(',', ''),
  );
  if (!Number.isFinite(valueNumber) || valueNumber === 0 || Math.abs(valueNumber) >= 1e10)
    throw new Error('Amount must be nonzero and below 10 billion.');
  return valueNumber;
}

export function mapImportRows(
  file,
  mapping,
  { dateFormat = 'iso', amountFormat = 'dot', defaultCurrency = 'USD' } = {},
) {
  for (const field of ['date', 'amount'])
    if (mapping[field] === '') throw new Error(`Choose a ${field} column.`);
  const columns = Object.values(mapping).filter((value) => value !== '' && !value.startsWith('__'));
  if (new Set(columns).size !== columns.length)
    throw new Error('Choose a different source column for each field.');
  return file.rows.map((values, index) => {
    try {
      if (values.length !== file.headers.length)
        throw new Error(
          `Expected ${file.headers.length} columns but found ${values.length}. Check this record's commas and quotes.`,
        );
      const value = (field) =>
        mapping[field] === '' ? '' : (values[Number(mapping[field])] ?? '');
      const amount = parseAmount(value('amount'), amountFormat);
      let type =
        mapping.type === '__signed'
          ? amount < 0
            ? 'expense'
            : 'income'
          : mapping.type.startsWith('__')
            ? mapping.type.slice(2)
            : value('type').trim().toLowerCase();
      if (type === 'debit' || type === 'withdrawal') type = 'expense';
      if (type === 'credit' || type === 'deposit') type = 'income';
      if (!['income', 'expense'].includes(type))
        throw new Error(
          'Type must be income/credit or expense/debit. Choose a different type mapping if needed.',
        );
      if (amount < 0 && type === 'income')
        throw new Error('A negative amount conflicts with income. Check the type mapping.');
      return {
        record: index + 1,
        source: {
          date: parseDate(value('date'), dateFormat),
          amount: Math.abs(amount).toFixed(2),
          type,
          currency: (value('currency').trim() || defaultCurrency).toUpperCase(),
          category: value('category').trim(),
          note: value('note'),
        },
      };
    } catch (error) {
      return { record: index + 1, status: 'invalid', error: error.message };
    }
  });
}
