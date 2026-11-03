import jwt from 'jsonwebtoken';

 
const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ message: 'Missing token' });

  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (e) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export default auth;
