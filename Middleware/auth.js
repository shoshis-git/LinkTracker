import jwt from 'jsonwebtoken';

// הסוד נלקח מ-app.locals (מוגדר ב-createApp) ולא נקרא מ-process.env בזמן טעינת הקובץ
const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ message: 'Missing token' });

  try {
    const payload = jwt.verify(header.slice(7), req.app.locals.jwtSecret, { algorithms: ['HS256'] });
    if (!payload || typeof payload.userId !== 'string')
      return res.status(401).json({ message: 'Invalid token' });
    req.userId = payload.userId;
    next();
  } catch (e) {
    const message = e instanceof jwt.TokenExpiredError ? 'Token expired' : 'Invalid token';
    res.status(401).json({ message });
  }
};

export default auth;
