import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseImportFile, guessMapping, mapImportRows } from '../src/utils/csvImport.js';
import { transactionsToCsv } from '../src/utils/csv.js';

const mapped = (csv, options) => {
  const file = parseImportFile(csv);
  return mapImportRows(file, guessMapping(file.headers), options);
};

test('CSV import preserves quoted delimiters, Unicode, multiline notes, and export values', () => {
  const csv = transactionsToCsv([
    {
      transaction_date: '2026-11-01',
      type: 'expense',
      amount: '12.50',
      currency: 'USD',
      category_name: 'Food',
      note: 'Café, "tea"\nLunch',
    },
  ]);
  assert.deepEqual(mapped(csv)[0].source, {
    date: '2026-11-01',
    type: 'expense',
    amount: '12.50',
    currency: 'USD',
    category: 'Food',
    note: 'Café, "tea"\nLunch',
  });
  assert.equal(mapped("Date,Amount,Note\n2026-11-01,-2,'=SUM(A1)")[0].source.note, "'=SUM(A1)");
});

test('bank files map signed amounts, dates, currency defaults, semicolons, and tabs', () => {
  const result = mapped('Posted Date;Value;Description\n23/11/2026;-1.234,56;Lunch', {
    dateFormat: 'dmy',
    amountFormat: 'comma',
    defaultCurrency: 'EUR',
  });
  assert.equal(result[0].source.amount, '1234.56');
  assert.equal(result[0].source.type, 'expense');
  assert.equal(result[0].source.date, '2026-11-23');
  assert.equal(result[0].source.currency, 'EUR');
  assert.equal(mapped('Date\tAmount\n2026-11-01\t20')[0].source.type, 'income');
  assert.equal(
    mapped('Date,Amount\n11/23/2026,"1,234.56"', { dateFormat: 'mdy' })[0].source.amount,
    '1234.56',
  );
});

test('invalid dates, precision, amounts, conflicting types, and uneven records are rejected', () => {
  for (const row of [
    '2025-02-29,12',
    '0000-01-01,12',
    '2026-11-01,0',
    '2026-11-01,1.234',
    '2026-11-01,£12',
    '2026-11-01,10000000000',
    '2026-11-01,12,extra',
  ]) {
    assert.equal(mapped(`Date,Amount\n${row}`)[0].status, 'invalid', row);
  }
  assert.equal(mapped('Date,Amount,Type\n2026-11-01,-12,income')[0].status, 'invalid');
  assert.equal(mapped('Date,Amount,Type\n2024-02-29,-12,debit')[0].source.type, 'expense');
});

test('empty, malformed, binary and oversized record counts are rejected', () => {
  for (const text of [
    '',
    'Date,Amount\n',
    'Date,Amount\n"unterminated,2',
    'Date,Amount\n\0,2',
    'Date,Amount\n' + Array(501).fill('2026-11-01,2').join('\n'),
  ]) {
    assert.throws(() => parseImportFile(text));
  }
  assert.equal(
    parseImportFile('Date,Amount\n' + Array(500).fill('2026-11-01,2').join('\n')).rows.length,
    500,
  );
});

test('mapping requires distinct date and amount columns and supports fixed expense type', () => {
  const file = parseImportFile('Date,Amount\n2026-11-01,12');
  const mapping = guessMapping(file.headers);
  assert.throws(() => mapImportRows(file, { ...mapping, amount: '' }), /amount column/);
  assert.throws(() => mapImportRows(file, { ...mapping, amount: '0' }), /different source/);
  assert.equal(mapImportRows(file, { ...mapping, type: '__expense' })[0].source.type, 'expense');
});
