import mongoose from 'mongoose';

// בודק ש-:id הוא ObjectId תקין לפני שמגיעים ל-controller
export const validateId = (req, res, next) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id))
    return res.status(400).json({ message: 'Invalid id' });
  next();
};

export const notFound = (req, res) => {
  res.status(404).json({ message: 'Route not found' });
};

// שגיאות שמשמעותן "אין חיבור למסד" (ולא באג בקוד)
const DB_UNAVAILABLE_ERRORS = new Set([
  'MongoServerSelectionError',
  'MongooseServerSelectionError',
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoNotConnectedError',
  'MongoTopologyClosedError'
]);
export const isDbUnavailableError = (err) => Boolean(err) && DB_UNAVAILABLE_ERRORS.has(err.name);

const dbUnavailable = (res) => res.status(503).json({ message: 'Database unavailable' });

// כשידוע שאין חיבור למסד - עונים 503 מיד, בלי לחכות ל-timeout של Mongoose.
// readyState 1 = connected. בזמן חיבור מחדש Mongoose נשאר ב-0 עד שהחיבור חוזר, ואז עובר ל-1,
// כך שה-middleware לא חוסם בקשות אחרי שהמסד חזר, ולא מתערב בחיבור מחדש עצמו.
export const requireDb = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) return dbUnavailable(res);
  next();
};

// תיאור קצר של שגיאה ללוג: שם + הודעה, בלי אובייקטים פנימיים של ה-driver.
// אם בכל זאת מופיעה כתובת mongodb עם שם משתמש וסיסמה - מסתירים אותם.
export function formatError(err) {
  if (!(err instanceof Error)) return String(err);
  const message = String(err.message).replace(/(mongodb(?:\+srv)?:\/\/)[^@/\s]*@/gi, '$1<credentials>@');
  return `${err.name}: ${message}`;
}

// מטפל מרכזי בשגיאות. Express 5 מעביר לכאן גם שגיאות מפונקציות async.
// הודעות פנימיות לא נשלחות ללקוח - רק נרשמות בלוג.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (err.type === 'entity.parse.failed')
    return res.status(400).json({ message: 'Invalid JSON body' });
  if (err.type === 'entity.too.large')
    return res.status(413).json({ message: 'Request body too large' });
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ message: 'Validation failed', errors });
  }
  if (err instanceof mongoose.Error.CastError)
    return res.status(400).json({ message: `Invalid value for ${err.path}` });
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({ message: `${field} already exists` });
  }
  if (err.status && err.status >= 400 && err.status < 500)
    return res.status(err.status).json({ message: err.expose ? err.message : 'Bad request' });

  // המסד נפל באמצע בקשה (לפני ש-Mongoose הספיק לעדכן את readyState)
  if (isDbUnavailableError(err)) {
    console.error(`[db] ${req.method} ${req.originalUrl}: ${formatError(err)}`);
    return dbUnavailable(res);
  }

  console.error(`[error] ${req.method} ${req.originalUrl}: ${formatError(err)}`);
  // ב-development גם ה-stack (בלי השורה הראשונה, שכבר כוללת את ההודעה)
  if (req.app.get('env') !== 'production' && err.stack)
    console.error(err.stack.split('\n').slice(1).join('\n'));
  res.status(500).json({ message: 'Internal server error' });
};
