import express from 'express';
import { pool } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { CURRENCIES, ownsCategory, validAmount, validId, validMonth } from '../validation.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/budgets?month=YYYY-MM
router.get('/', async (req, res) => {
  const { month } = req.query;
  if (month !== undefined && !validMonth(month)) return res.status(400).json({ error: 'Month must be YYYY-MM' });
  try {
    const params = [req.userId];
    let query = `
      SELECT b.*, c.name AS category_name
      FROM budgets b
      JOIN categories c ON b.category_id = c.id AND c.user_id = b.user_id
      WHERE b.user_id = $1
    `;
    if (month) {
      params.push(month);
      query += ` AND b.month = $${params.length}`;
    }
    query += ' ORDER BY b.month DESC, c.name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
});

// POST /api/budgets — creates or updates the budget for a category+month (upsert)
router.post('/', async (req, res) => {
  const { categoryId, month, amount, currency } = req.body || {};
  if (!validId(categoryId) || !validMonth(month) || !validAmount(amount, true) ||
      (currency !== undefined && !CURRENCIES.has(currency))) {
    return res.status(400).json({ error: 'A valid category, YYYY-MM month, nonnegative amount with at most 2 decimal places, and supported currency are required' });
  }
  try {
    if (!await ownsCategory(pool, req.userId, categoryId)) {
      return res.status(400).json({ error: 'Category not found' });
    }
    const result = await pool.query(
      `INSERT INTO budgets (user_id, category_id, month, amount, currency)
       SELECT $1, $2, $3, $4, COALESCE($5, home_currency) FROM users WHERE id = $1
       ON CONFLICT (user_id, category_id, month)
       DO UPDATE SET amount = EXCLUDED.amount, currency = COALESCE($5, budgets.currency)
       RETURNING *`,
      [req.userId, categoryId, month, amount, currency ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save budget' });
  }
});

// DELETE /api/budgets/:id
router.delete('/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid budget ID' });
  try {
    await pool.query('DELETE FROM budgets WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.userId,
    ]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete budget' });
  }
});

export default router;
