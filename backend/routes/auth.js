import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/index.js';

const router = express.Router();

const DEFAULT_CATEGORIES = ['Food', 'Rent', 'Transport', 'Entertainment', 'Salary', 'Other'];

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof password !== 'string') {
    return res.status(400).json({ error: 'A valid email and password are required' });
  }
  if (password.length < 6 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ error: 'Password must be at least 6 characters and at most 72 UTF-8 bytes' });
  }

  let client;
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    client = await pool.connect();
    await client.query('BEGIN');
    const result = await client.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, home_currency',
      [email, passwordHash]
    );
    const user = result.rows[0];

    // Seed default categories so the new user has something to select from immediately
    for (const name of DEFAULT_CATEGORIES) {
      await client.query(
        'INSERT INTO categories (user_id, name, is_default) VALUES ($1, $2, TRUE)',
        [user.id, name]
      );
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    await client.query('COMMIT');
    res.status(201).json({ token, user });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (rollbackError) { console.error(rollbackError); }
    }
    if (err.code === '23505') return res.status(409).json({ error: 'An account with that email already exists' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong creating your account' });
  } finally {
    client?.release();
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || !email || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, home_currency: user.home_currency } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong logging you in' });
  }
});

export default router;
