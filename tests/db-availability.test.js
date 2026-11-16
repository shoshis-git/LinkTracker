import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import User from '../Models/User.js';
import { formatError } from '../Middleware/errors.js';
import { makeApp, registerUser, createLink } from './helpers.js';

// הקובץ הזה מנהל מסד משלו (ולא דרך helpers), כי הוא עוצר ומפעיל אותו מחדש באותו פורט
const app = makeApp();
let mem;

async function waitFor(condition, timeoutMs, label) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for ${label}`);
    await new Promise(r => setTimeout(r, 100));
  }
  return Date.now() - start;
}

// בודק שהבקשה נענתה ב-503 מהר, בלי לחכות ל-timeout של Mongoose
async function expectFast503(req) {
  const start = Date.now();
  const res = await req;
  const ms = Date.now() - start;
  assert.equal(res.status, 503);
  assert.deepEqual(res.body, { message: 'Database unavailable' });
  assert.ok(ms < 1000, `expected a fast 503, took ${ms}ms`);
}

describe('database disconnection and recovery', () => {
  let token, link;

  before(async () => {
    mem = await MongoMemoryServer.create();
    // heartbeat קצר כדי שהחזרה של המסד תתגלה מהר בבדיקה
    await mongoose.connect(mem.getUri('linktracker-test'), { heartbeatFrequencyMS: 500, serverSelectionTimeoutMS: 3000 });
    await Promise.all(Object.values(mongoose.models).map(m => m.init()));
  });

  after(async () => {
    await mongoose.disconnect();
    await mem.stop();
  });

  it('works normally while connected', async () => {
    ({ token } = await registerUser(app));
    link = await createLink(app, token, { originalUrl: 'https://example.com/recover' });
    assert.equal((await request(app).get('/health')).status, 200);
    assert.equal((await request(app).get('/links/summary')).status, 200);
  });

  it('returns a fast 503 on every database route after MongoDB goes down', async () => {
    await mem.stop({ doCleanup: false });
    await waitFor(() => mongoose.connection.readyState !== 1, 10_000, 'disconnect');

    const health = await request(app).get('/health');
    assert.equal(health.status, 503);
    assert.deepEqual(health.body, { status: 'error', db: 'disconnected' });

    await expectFast503(request(app).get('/links/summary'));
    await expectFast503(request(app).get('/links').set('Authorization', `Bearer ${token}`));
    await expectFast503(request(app).post('/users/login').send({ email: 'a@example.com', password: 'secret123' }));
    await expectFast503(request(app).post('/users').send({ name: 'A', email: 'a@example.com', password: 'secret123' }));
    await expectFast503(request(app).get(`/${link._id}`));
  });

  it('still validates input and routes that do not need the database', async () => {
    assert.equal((await request(app).get('/not-an-id')).status, 400);
    assert.equal((await request(app).get('/no/such/route')).status, 404);
  });

  it('recovers automatically when MongoDB comes back, with the data intact', async () => {
    await mem.start(true); // אותו פורט ואותה תיקיית נתונים
    await waitFor(() => mongoose.connection.readyState === 1, 20_000, 'reconnect');

    const health = await request(app).get('/health');
    assert.equal(health.status, 200);
    assert.deepEqual(health.body, { status: 'ok', db: 'connected' });

    const redirect = await request(app).get(`/${link._id}`);
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.location, 'https://example.com/recover');

    const links = await request(app).get('/links').set('Authorization', `Bearer ${token}`);
    assert.equal(links.status, 200);
    assert.equal(links.body.length, 1);
    assert.equal(links.body[0].clicks.length, 1);
  });

  it('returns 503 (not 500) when the database fails in the middle of a request', async () => {
    // readyState עדיין 1, אבל השאילתה נכשלת - כמו נפילה שה-driver עוד לא זיהה
    const failure = Object.assign(new Error('Server selection timed out'), { name: 'MongoServerSelectionError' });
    const countMock = mock.method(User, 'countDocuments', async () => { throw failure; });
    const errorLog = mock.method(console, 'error', () => {});
    try {
      const res = await request(app).get('/links/summary');
      assert.equal(res.status, 503);
      assert.deepEqual(res.body, { message: 'Database unavailable' });
      assert.equal(errorLog.mock.callCount(), 1);
      assert.equal(errorLog.mock.calls[0].arguments.length, 1, 'should log a single string, not an error object');
      assert.match(errorLog.mock.calls[0].arguments[0], /MongoServerSelectionError: Server selection timed out/);
    } finally {
      countMock.mock.restore();
      errorLog.mock.restore();
    }
  });
});

describe('formatError', () => {
  it('returns only the error name and message', () => {
    const err = new TypeError('boom');
    err.topology = { huge: 'object' };
    assert.equal(formatError(err), 'TypeError: boom');
  });

  it('hides credentials in MongoDB connection strings', () => {
    const err = new Error('failed to connect to mongodb+srv://admin:p4ss@cluster0.example.net/db');
    const text = formatError(err);
    assert.ok(!text.includes('admin') && !text.includes('p4ss'), text);
    assert.match(text, /mongodb\+srv:\/\/<credentials>@cluster0\.example\.net/);
  });

  it('handles non-Error values', () => {
    assert.equal(formatError('plain'), 'plain');
  });
});
