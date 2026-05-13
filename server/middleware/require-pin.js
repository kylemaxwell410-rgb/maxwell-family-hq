export const PIN = process.env.ADMIN_PIN || '1234';

export function requirePin(req, res, next) {
  const sent = req.headers['x-admin-pin'] || req.body?.pin;
  if (sent !== PIN) return res.status(401).json({ error: 'Invalid PIN' });
  next();
}
