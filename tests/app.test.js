import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';

import { connectTestDb, disconnectTestDb, makeApp } from './helpers.js';

describe('GET /health', () => {
  const app = makeApp();

  it('returns 503 when the database is not connected', async () => {
    assert.equal(mongoose.connection.readyState, 0);
    const res = await request(app).get('/health');
    assert.equal(res.status, 503);
    assert.deepEqual(res.body, { status: 'error', db: 'disconnected' });
  });

  describe('with a database', () => {
    before(connectTestDb);
    after(disconnectTestDb);

    it('returns 200 when the database is connected', async () => {
      const res = await request(app).get('/health');
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, { status: 'ok', db: 'connected' });
    });
  });
});

describe('general behaviour', () => {
  const app = makeApp();

  it('returns JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/no/such/route');
    assert.equal(res.status, 404);
    assert.equal(res.body.message, 'Route not found');
  });

  it('does not send the X-Powered-By header', async () => {
    const res = await request(app).get('/no/such/route');
    assert.equal(res.headers['x-powered-by'], undefined);
  });
});

describe('CORS', () => {
  it('allows any origin when no origins are configured (development)', async () => {
    const res = await request(makeApp()).get('/no/such/route').set('Origin', 'http://anything.example');
    assert.equal(res.headers['access-control-allow-origin'], '*');
  });

  it('allows only configured origins', async () => {
    const app = makeApp({ corsOrigins: ['http://localhost:5500'] });
    const allowed = await request(app).get('/no/such/route').set('Origin', 'http://localhost:5500');
    assert.equal(allowed.headers['access-control-allow-origin'], 'http://localhost:5500');

    const denied = await request(app).get('/no/such/route').set('Origin', 'http://evil.example');
    assert.equal(denied.headers['access-control-allow-origin'], undefined);
  });
});

describe('createApp', () => {
  it('throws without a jwtSecret', () => {
    assert.throws(() => makeApp({ jwtSecret: undefined }), /jwtSecret/);
  });
});
