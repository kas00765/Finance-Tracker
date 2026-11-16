import express from 'express';
import { pool } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { CURRENCIES } from '../validation.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/user/settings
router.get('/me', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, home_currency FROM users WHERE id = $1', [req.userId]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Session user no longer exists' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/user/settings
router.put('/me', async (req, res) => {
  const { homeCurrency } = req.body || {};
  if (!CURRENCIES.has(homeCurrency)) {
    return res.status(400).json({ error: 'A supported currency code is required' });
  }
  try {
    const result = await pool.query(
      'UPDATE users SET home_currency = $1 WHERE id = $2 RETURNING home_currency',
      [homeCurrency.toUpperCase(), req.userId]
    );
    if (!result.rows.length) return res.status(401).json({ error: 'Session user no longer exists' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
