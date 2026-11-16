import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import User from '../Models/User.js';
import { connectTestDb, clearTestDb, disconnectTestDb, makeApp, registerUser, createLink, TEST_JWT_SECRET } from './helpers.js';

const app = makeApp();
const auth = (token) => ({ Authorization: `Bearer ${token}` });

before(connectTestDb);
after(disconnectTestDb);
beforeEach(clearTestDb);

describe('POST /users (registration)', () => {
  it('creates a user, returns a token and never returns the password', async () => {
    const res = await request(app).post('/users')
      .send({ name: 'Dana', email: 'dana@example.com', password: 'secret123' });
    assert.equal(res.status, 201);
    assert.ok(res.body.token);
    assert.equal(res.body.user.email, 'dana@example.com');
    assert.equal(res.body.user.password, undefined);

    const payload = jwt.verify(res.body.token, TEST_JWT_SECRET);
    assert.equal(payload.userId, res.body.user._id);
  });

  it('stores the password as a bcrypt hash', async () => {
    await request(app).post('/users').send({ name: 'Dana', email: 'dana@example.com', password: 'secret123' });
    const stored = await User.findOne({ email: 'dana@example.com' }).lean();
    assert.notEqual(stored.password, 'secret123');
    assert.match(stored.password, /^\$2[aby]\$/);
  });

  it('rejects a duplicate email with 409', async () => {
    await registerUser(app, { email: 'same@example.com' });
    const res = await request(app).post('/users')
      .send({ name: 'Other', email: 'same@example.com', password: 'secret123' });
    assert.equal(res.status, 409);
  });

  it('rejects missing or invalid fields with 400', async () => {
    const cases = [
      {},
      { name: 'A', email: 'not-an-email', password: 'secret123' },
      { name: 'A', email: 'a@example.com', password: '123' },
      { name: '', email: 'a@example.com', password: 'secret123' },
      { name: 'A', email: { $ne: null }, password: 'secret123' }
    ];
    for (const body of cases) {
      const res = await request(app).post('/users').send(body);
      assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(body)}`);
      assert.ok(Array.isArray(res.body.errors));
    }
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app).post('/users').set('Content-Type', 'application/json').send('{"name":');
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Invalid JSON body');
  });
});

describe('POST /users/login', () => {
  it('logs in with valid credentials', async () => {
    const { user, password } = await registerUser(app);
    const res = await request(app).post('/users/login').send({ email: user.email, password });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user._id, user._id);
    assert.equal(res.body.user.password, undefined);
  });

  it('returns 401 for a wrong password', async () => {
    const { user } = await registerUser(app);
    const res = await request(app).post('/users/login').send({ email: user.email, password: 'wrong-password' });
    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Invalid email or password');
  });

  it('returns 401 for an unknown email', async () => {
    const res = await request(app).post('/users/login').send({ email: 'nobody@example.com', password: 'secret123' });
    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Invalid email or password');
  });

  it('rejects non-string credentials (NoSQL operator injection) with 400', async () => {
    await registerUser(app);
    const res = await request(app).post('/users/login').send({ email: { $ne: null }, password: { $ne: null } });
    assert.equal(res.status, 400);
  });
});

describe('protected /users routes', () => {
  it('returns 401 without a token', async () => {
    const { user } = await registerUser(app);
    const res = await request(app).get(`/users/${user._id}`);
    assert.equal(res.status, 401);
  });

  it('returns 401 with an invalid token', async () => {
    const { user } = await registerUser(app);
    const res = await request(app).get(`/users/${user._id}`).set(auth('not-a-real-token'));
    assert.equal(res.status, 401);
  });

  it('returns 401 with a token signed by another secret', async () => {
    const { user } = await registerUser(app);
    const forged = jwt.sign({ userId: user._id }, 'some-other-secret-that-is-long-enough');
    const res = await request(app).get(`/users/${user._id}`).set(auth(forged));
    assert.equal(res.status, 401);
  });

  it('returns 401 "Token expired" for an expired token', async () => {
    const { user } = await registerUser(app);
    const expired = jwt.sign({ userId: user._id, exp: Math.floor(Date.now() / 1000) - 60 }, TEST_JWT_SECRET);
    const res = await request(app).get(`/users/${user._id}`).set(auth(expired));
    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Token expired');
  });

  it('returns the logged-in user without the password', async () => {
    const { user, token } = await registerUser(app);
    const res = await request(app).get(`/users/${user._id}`).set(auth(token));
    assert.equal(res.status, 200);
    assert.equal(res.body.email, user.email);
    assert.equal(res.body.password, undefined);
  });

  it('returns 403 when accessing another user', async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);
    const res = await request(app).get(`/users/${b.user._id}`).set(auth(a.token));
    assert.equal(res.status, 403);
  });

  it('returns 400 for an invalid id', async () => {
    const { token } = await registerUser(app);
    const res = await request(app).get('/users/not-an-id').set(auth(token));
    assert.equal(res.status, 400);
  });

  it('updates the user and re-hashes a new password', async () => {
    const { user, token } = await registerUser(app);
    const res = await request(app).put(`/users/${user._id}`).set(auth(token)).send({ name: 'New Name', password: 'newpass123' });
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'New Name');
    assert.equal(res.body.password, undefined);

    const login = await request(app).post('/users/login').send({ email: user.email, password: 'newpass123' });
    assert.equal(login.status, 200);
  });

  it('rejects an invalid update with 400', async () => {
    const { user, token } = await registerUser(app);
    const res = await request(app).put(`/users/${user._id}`).set(auth(token)).send({ email: 'bad' });
    assert.equal(res.status, 400);
  });

  it('deletes the user together with their links', async () => {
    const { user, token } = await registerUser(app);
    const link = await createLink(app, token);
    const res = await request(app).delete(`/users/${user._id}`).set(auth(token));
    assert.equal(res.status, 200);
    assert.equal(await User.countDocuments(), 0);
    assert.equal(await mongoose.model('Link').exists({ _id: link._id }), null);
  });
});
