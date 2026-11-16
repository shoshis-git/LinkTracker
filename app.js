import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

import linkRouter from './Routes/LinkRouter.js';
import userRouter from './Routes/UserRouter.js';
import LinkController from './Controllers/LinkController.js';
import { validateId, notFound, errorHandler, requireDb } from './Middleware/errors.js';

const DB_STATES = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

// בונה את אפליקציית Express. לא מתחבר למסד ולא מאזין לפורט - זה התפקיד של index.js.
// כך אפשר לייבא את האפליקציה גם בבדיקות.
export function createApp({ jwtSecret, corsOrigins = '*', trustProxy = false, nodeEnv = 'development' }) {
  if (!jwtSecret) throw new Error('createApp: jwtSecret is required');

  const app = express();
  app.locals.jwtSecret = jwtSecret;
  app.set('env', nodeEnv);
  app.set('trust proxy', trustProxy);
  app.disable('x-powered-by');

  app.use(cors(corsOrigins === '*' ? {} : { origin: corsOrigins }));
  app.use(express.json({ limit: '100kb' }));

  // חייב להיות לפני '/:id', אחרת "health" ייחשב כמזהה של קישור
  app.get('/health', (req, res) => {
    const db = DB_STATES[mongoose.connection.readyState] || 'unknown';
    const ok = db === 'connected';
    res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'error', db });
  });

  // כל הנתיבים האלה צריכים את המסד: בלי חיבור עונים 503 מיד
  app.use('/links', requireDb, linkRouter);
  app.use('/users', requireDb, userRouter);
  app.get('/:id', validateId, requireDb, LinkController.redirect);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
