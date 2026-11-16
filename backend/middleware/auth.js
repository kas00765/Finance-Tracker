import jwt from 'jsonwebtoken';

// Protects routes: expects "Authorization: Bearer <token>" header.
// On success, attaches req.userId for downstream handlers to use.
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!Number.isInteger(payload.userId) || payload.userId <= 0) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
