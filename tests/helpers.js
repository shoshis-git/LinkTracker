import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

import { createApp } from '../app.js';

export const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

let memoryServer = null;

// מסד בדיקות מבודד:
// - ברירת מחדל: MongoDB בזיכרון (mongodb-memory-server), נמחק בסוף.
// - אפשר להגדיר TEST_MONGO_URI (למשל ב-CI). שם המסד חייב להכיל "test", כדי לא למחוק בטעות נתונים אמיתיים.
export async function connectTestDb() {
  let uri = process.env.TEST_MONGO_URI;
  if (uri) {
    const dbName = new URL(uri.replace(/^mongodb(\+srv)?:/, 'http:')).pathname.slice(1);
    if (!/test/i.test(dbName))
      throw new Error(`Refusing to run tests: TEST_MONGO_URI database name "${dbName}" must contain "test"`);
  } else {
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri('linktracker-test');
  }
  await mongoose.connect(uri);
  // מחכים לבניית האינדקסים (למשל email ייחודי) לפני שהבדיקות רצות
  await Promise.all(Object.values(mongoose.models).map(m => m.init()));
}

export async function clearTestDb() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map(c => c.deleteMany({})));
}

export async function disconnectTestDb() {
  if (process.env.TEST_MONGO_URI) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
  memoryServer = null;
}

export function makeApp(options = {}) {
  return createApp({ jwtSecret: TEST_JWT_SECRET, ...options });
}

let counter = 0;
export async function registerUser(app, overrides = {}) {
  counter++;
  const body = { name: `User ${counter}`, email: `user${counter}@example.com`, password: 'secret123', ...overrides };
  const res = await request(app).post('/users').send(body);
  if (res.status !== 201) throw new Error(`registerUser failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.token, user: res.body.user, password: body.password };
}

export async function createLink(app, token, body = {}) {
  const res = await request(app)
    .post('/links')
    .set('Authorization', `Bearer ${token}`)
    .send({ originalUrl: 'https://example.com/page', ...body });
  if (res.status !== 201) throw new Error(`createLink failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}
