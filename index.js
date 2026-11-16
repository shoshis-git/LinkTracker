import dotenv from 'dotenv';
import mongoose from 'mongoose';

import { loadConfig, ConfigError } from './config.js';
import { createApp } from './app.js';
import { formatError } from './Middleware/errors.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

// serverSelectionTimeoutMS: כמה זמן מחכים לשרת זמין - בהתחברות הראשונה ובכל פעולה (ברירת המחדל 30 שניות).
// heartbeatFrequencyMS: כל כמה זמן ה-driver בודק את השרת - כך נפילה מתגלה מהר יותר (ברירת המחדל 10 שניות).
// החיבור מחדש האוטומטי של ה-driver נשאר פעיל.
const MONGO_OPTIONS = { serverSelectionTimeoutMS: 5_000, heartbeatFrequencyMS: 5_000 };

async function start() {
  // משתנים שכבר מוגדרים בסביבה (למשל ב-Docker) גוברים על .env
  dotenv.config({ quiet: true });

  const config = loadConfig();
  config.warnings.forEach(w => console.warn(`[config] warning: ${w}`));

  let shuttingDown = false;
  try {
    await mongoose.connect(config.mongoUri, MONGO_OPTIONS);
  } catch (err) {
    // בלי ה-URI עצמו - הוא יכול להכיל סיסמה
    throw new Error(`Could not connect to MongoDB: ${formatError(err)}`);
  }
  console.log('Connected to MongoDB');
  mongoose.connection.on('disconnected', () => {
    if (!shuttingDown) console.warn('[db] MongoDB disconnected - requests will get 503 until it reconnects');
  });
  mongoose.connection.on('reconnected', () => console.log('[db] MongoDB reconnected'));
  mongoose.connection.on('error', (err) => console.error(`[db] ${formatError(err)}`));

  const app = createApp(config);
  const server = await new Promise((resolve, reject) => {
    const s = app.listen(config.port, () => resolve(s));
    s.once('error', reject);
  });
  console.log(`Server on port ${config.port} (${config.nodeEnv})`);

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down...`);
    const timer = setTimeout(() => {
      console.error('Shutdown timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    timer.unref();
    try {
      // מפסיק לקבל חיבורים חדשים ומחכה שהבקשות הפתוחות יסתיימו
      await new Promise((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
      await mongoose.disconnect();
      console.log('Shutdown complete');
      process.exit(0);
    } catch (err) {
      console.error(`Error during shutdown: ${formatError(err)}`);
      process.exit(1);
    }
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch(async (err) => {
  if (err instanceof ConfigError) console.error(`[startup] ${err.message}`);
  else console.error(`[startup] Failed to start: ${err.message}`); // ההודעה כבר עברה formatError
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
