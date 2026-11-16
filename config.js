// קריאה ובדיקה של משתני הסביבה.
// הקובץ לא קורא את process.env בזמן הטעינה - רק כש-loadConfig נקראת.

export class ConfigError extends Error {
  constructor(problems) {
    super('Invalid configuration:\n' + problems.map(p => '  - ' + p).join('\n'));
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

const MIN_SECRET_LENGTH = 32;

// "true" / "false" / מספר hops / רשימת כתובות או subnets (כמו ב-Express)
function parseTrustProxy(value) {
  if (value === undefined || value.trim() === '') return false;
  const v = value.trim().toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^\d+$/.test(v)) return Number(v);
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

export function loadConfig(env = process.env) {
  const problems = [];
  const warnings = [];
  const nodeEnv = env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  const mongoUri = env.MONGO_URI?.trim();
  if (!mongoUri) problems.push('MONGO_URI is required (e.g. mongodb://localhost:27017/tinyurl)');
  else if (!/^mongodb(\+srv)?:\/\//.test(mongoUri)) problems.push('MONGO_URI must start with mongodb:// or mongodb+srv://');

  const portRaw = env.PORT?.trim();
  const port = Number(portRaw);
  if (!portRaw) problems.push('PORT is required (e.g. 3000)');
  else if (!/^\d+$/.test(portRaw) || port < 1 || port > 65535) problems.push('PORT must be an integer between 1 and 65535');

  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret || !jwtSecret.trim()) problems.push('JWT_SECRET is required');
  else if (jwtSecret.length < MIN_SECRET_LENGTH) {
    const msg = `JWT_SECRET should be at least ${MIN_SECRET_LENGTH} characters long`;
    if (isProduction) problems.push(msg);
    else warnings.push(msg);
  }

  // רשימת origins מופרדת בפסיקים. בלי ערך: בפיתוח מותר הכול, ב-production זו שגיאה.
  const corsOrigins = (env.CORS_ORIGINS || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
  if (corsOrigins.length === 0) {
    if (isProduction) problems.push('CORS_ORIGINS is required in production (comma-separated list of allowed origins)');
    else warnings.push('CORS_ORIGINS is not set - allowing requests from any origin (development only)');
  }

  if (problems.length) throw new ConfigError(problems);

  return {
    nodeEnv,
    port,
    mongoUri,
    jwtSecret,
    corsOrigins: corsOrigins.length ? corsOrigins : '*',
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    warnings
  };
}
