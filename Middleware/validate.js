// בדיקות קלט לגוף הבקשה. כל פונקציה מחזירה רשימת שגיאות (ריקה = תקין).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PARAM_NAME_RE = /^[A-Za-z0-9_-]{1,50}$/;
export const MIN_PASSWORD_LENGTH = 6;

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

function isHttpUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// partial = true בעדכון: שדות שלא נשלחו לא נבדקים
export function validateUser(body, { partial = false } = {}) {
  const errors = [];
  const { name, email, password } = body;
  if (!partial || name !== undefined)
    if (!isNonEmptyString(name) || name.length > 100) errors.push('name must be a non-empty string (max 100 characters)');
  if (!partial || email !== undefined)
    if (typeof email !== 'string' || !EMAIL_RE.test(email) || email.length > 254) errors.push('email must be a valid email address');
  if (!partial || password !== undefined)
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH || password.length > 72)
      errors.push(`password must be a string of ${MIN_PASSWORD_LENGTH}-72 characters`);
  return errors;
}

export function validateLogin(body) {
  const errors = [];
  if (typeof body.email !== 'string' || !body.email) errors.push('email is required');
  if (typeof body.password !== 'string' || !body.password) errors.push('password is required');
  return errors;
}

export function validateLink(body, { partial = false } = {}) {
  const errors = [];
  const { originalUrl, targetParamName, targetValues } = body;
  if (!partial || originalUrl !== undefined)
    if (!isHttpUrl(originalUrl) || originalUrl.length > 2048) errors.push('originalUrl must be a valid http(s) URL');
  if (targetParamName !== undefined && targetParamName !== '')
    if (typeof targetParamName !== 'string' || !PARAM_NAME_RE.test(targetParamName))
      errors.push('targetParamName must contain only letters, digits, "_" or "-" (max 50 characters)');
  if (targetValues !== undefined) {
    if (!Array.isArray(targetValues) || targetValues.length > 50)
      errors.push('targetValues must be an array (max 50 items)');
    else if (!targetValues.every(t => t && isNonEmptyString(t.name) && isNonEmptyString(t.value)
      && t.name.length <= 100 && t.value.length <= 100))
      errors.push('each targetValues item must have non-empty string "name" and "value" (max 100 characters)');
  }
  return errors;
}

// עוטף פונקציית בדיקה ל-middleware
export const validateBody = (validator, options) => (req, res, next) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))
    return res.status(400).json({ message: 'Request body must be a JSON object' });
  const errors = validator(req.body, options);
  if (errors.length) return res.status(400).json({ message: 'Validation failed', errors });
  next();
};
