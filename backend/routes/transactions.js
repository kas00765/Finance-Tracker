import express from 'express';
import { pool } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/transactions?category=&from=&to=
router.get('/', async (req, res) => {
  const { category, from, to } = req.query;
  const conditions = ['t.user_id = $1'];
  const params = [req.userId];

  if (category) {
    params.push(category);
    conditions.push(`category_id = $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`transaction_date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`transaction_date <= $${params.length}`);
  }

  try {
    const result = await pool.query(
      `SELECT t.*, c.name AS category_name
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY transaction_date DESC, t.id DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// POST /api/transactions
router.post('/', async (req, res) => {
  const { amount, type, categoryId, note, date, currency } = req.body;

  if (!amount || !type || !['income', 'expense'].includes(type)) {
    return res.status(400).json({ error: 'Amount and a valid type (income/expense) are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO transactions (user_id, category_id, amount, currency, type, note, transaction_date)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_DATE))
       RETURNING *`,
      [req.userId, categoryId || null, amount, currency || 'USD', type, note || null, date || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// PUT /api/transactions/:id
router.put('/:id', async (req, res) => {
  const { amount, type, categoryId, note, date, currency } = req.body;
  try {
    const result = await pool.query(
      `UPDATE transactions
       SET amount = COALESCE($1, amount),
           type = COALESCE($2, type),
           category_id = $3,
           note = $4,
           transaction_date = COALESCE($5, transaction_date),
           currency = COALESCE($8, currency)
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [amount, type, categoryId || null, note || null, date, req.params.id, req.userId, currency || null]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.userId,
    ]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// GET /api/transactions/summary  -> totals for dashboard charts
router.get('/meta/summary', async (req, res) => {
  try {
    const byCategory = await pool.query(
      `SELECT c.name AS category, SUM(t.amount) AS total
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = $1 AND t.type = 'expense'
       GROUP BY c.name
       ORDER BY total DESC`,
      [req.userId]
    );

    const byMonth = await pool.query(
      `SELECT to_char(transaction_date, 'YYYY-MM') AS month,
              SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
              SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense
       FROM transactions
       WHERE user_id = $1
       GROUP BY month
       ORDER BY month`,
      [req.userId]
    );

    res.json({ byCategory: byCategory.rows, byMonth: byMonth.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

export default router;
