import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import Link from '../Models/link.js';
import { connectTestDb, clearTestDb, disconnectTestDb, makeApp, registerUser, createLink } from './helpers.js';

const app = makeApp();
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const MISSING_ID = '0123456789abcdef01234567';

before(connectTestDb);
after(disconnectTestDb);
beforeEach(clearTestDb);

describe('protected /links routes', () => {
  it('returns 401 without a token', async () => {
    for (const [method, path] of [['get', '/links'], ['post', '/links'], ['get', `/links/${MISSING_ID}`],
      ['put', `/links/${MISSING_ID}`], ['delete', `/links/${MISSING_ID}`], ['get', `/links/${MISSING_ID}/stats`]]) {
      const res = await request(app)[method](path);
      assert.equal(res.status, 401, `${method.toUpperCase()} ${path}`);
    }
  });

  it('returns 401 with a malformed Authorization header', async () => {
    const res = await request(app).get('/links').set('Authorization', 'Token abc');
    assert.equal(res.status, 401);
  });
});

describe('link CRUD', () => {
  it('creates a link with default targetParamName "t"', async () => {
    const { token } = await registerUser(app);
    const res = await request(app).post('/links').set(auth(token)).send({
      originalUrl: 'https://shop.example.com/sale',
      targetValues: [{ name: 'Facebook', value: 'fb' }]
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.originalUrl, 'https://shop.example.com/sale');
    assert.equal(res.body.targetParamName, 't');
    assert.equal(res.body.targetValues.length, 1);
    assert.deepEqual(res.body.clicks, []);
  });

  it('lists only the links of the logged-in user', async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);
    await createLink(app, a.token, { originalUrl: 'https://a.example.com' });
    await createLink(app, b.token, { originalUrl: 'https://b.example.com' });

    const res = await request(app).get('/links').set(auth(a.token));
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].originalUrl, 'https://a.example.com');
  });

  it('gets a single link by id', async () => {
    const { token } = await registerUser(app);
    const link = await createLink(app, token);
    const res = await request(app).get(`/links/${link._id}`).set(auth(token));
    assert.equal(res.status, 200);
    assert.equal(res.body._id, link._id);
  });

  it('updates a link', async () => {
    const { token } = await registerUser(app);
    const link = await createLink(app, token);
    const res = await request(app).put(`/links/${link._id}`).set(auth(token)).send({
      originalUrl: 'https://example.com/new',
      targetParamName: 'src',
      targetValues: [{ name: 'Mail', value: 'mail' }]
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.originalUrl, 'https://example.com/new');
    assert.equal(res.body.targetParamName, 'src');
    assert.equal(res.body.targetValues[0].value, 'mail');
  });

  it('deletes a link and removes it from the user', async () => {
    const { token } = await registerUser(app);
    const link = await createLink(app, token);
    const res = await request(app).delete(`/links/${link._id}`).set(auth(token));
    assert.equal(res.status, 200);
    assert.equal(await Link.exists({ _id: link._id }), null);

    const list = await request(app).get('/links').set(auth(token));
    assert.deepEqual(list.body, []);
  });

  it("returns 404 for another user's link (get, update, delete, stats)", async () => {
    const owner = await registerUser(app);
    const other = await registerUser(app);
    const link = await createLink(app, owner.token);

    assert.equal((await request(app).get(`/links/${link._id}`).set(auth(other.token))).status, 404);
    assert.equal((await request(app).put(`/links/${link._id}`).set(auth(other.token)).send({ originalUrl: 'https://evil.example.com' })).status, 404);
    assert.equal((await request(app).delete(`/links/${link._id}`).set(auth(other.token))).status, 404);
    assert.equal((await request(app).get(`/links/${link._id}/stats`).set(auth(other.token))).status, 404);

    const stored = await Link.findById(link._id);
    assert.equal(stored.originalUrl, 'https://example.com/page');
  });

  it('returns 404 for a missing link', async () => {
    const { token } = await registerUser(app);
    const res = await request(app).get(`/links/${MISSING_ID}`).set(auth(token));
    assert.equal(res.status, 404);
  });

  it('returns 400 for an invalid id', async () => {
    const { token } = await registerUser(app);
    for (const [method, path] of [['get', '/links/123'], ['put', '/links/123'], ['delete', '/links/123'], ['get', '/links/123/stats']]) {
      const res = await request(app)[method](path).set(auth(token)).send({});
      assert.equal(res.status, 400, `${method.toUpperCase()} ${path}`);
    }
  });

  it('rejects invalid link input with 400', async () => {
    const { token } = await registerUser(app);
    const cases = [
      {},
      { originalUrl: 'not a url' },
      { originalUrl: 'javascript:alert(1)' },
      { originalUrl: 'https://example.com', targetParamName: 'bad name!' },
      { originalUrl: 'https://example.com', targetValues: 'fb' },
      { originalUrl: 'https://example.com', targetValues: [{ name: 'Facebook' }] }
    ];
    for (const body of cases) {
      const res = await request(app).post('/links').set(auth(token)).send(body);
      assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(body)}`);
    }
  });

  it('rejects an invalid update with 400', async () => {
    const { token } = await registerUser(app);
    const link = await createLink(app, token);
    const res = await request(app).put(`/links/${link._id}`).set(auth(token)).send({ originalUrl: 'ftp://example.com' });
    assert.equal(res.status, 400);
  });
});

describe('redirect and click statistics', () => {
  it('redirects with 302 and records the click', async () => {
    const { token } = await registerUser(app);
    const link = await createLink(app, token, { originalUrl: 'https://example.com/landing' });

    const res = await request(app).get(`/${link._id}`);
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, 'https://example.com/landing');

    const stored = await Link.findById(link._id);
    assert.equal(stored.clicks.length, 1);
    assert.ok(stored.clicks[0].insertedAt instanceof Date);
    assert.ok(stored.clicks[0].ipAddress);
  });

  it('returns 404 for an unknown short link and 400 for an invalid id', async () => {
    assert.equal((await request(app).get(`/${MISSING_ID}`)).status, 404);
    assert.equal((await request(app).get('/favicon.ico')).status, 400);
  });

  it('groups clicks by target in /links/:id/stats', async () => {
    const { token } = await registerUser(app);
    const link = await createLink(app, token, {
      targetValues: [{ name: 'Facebook', value: 'fb' }, { name: 'Mail', value: 'mail' }]
    });

    await request(app).get(`/${link._id}?t=fb`);
    await request(app).get(`/${link._id}?t=fb`);
    await request(app).get(`/${link._id}?t=mail`);
    await request(app).get(`/${link._id}`);
    await request(app).get(`/${link._id}?t=other`);
    await request(app).get(`/${link._id}?t=fb&t=mail`); // מערך - נספר לפי הערך הראשון

    const res = await request(app).get(`/links/${link._id}/stats`).set(auth(token));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { total: 6, byTarget: { Facebook: 3, Mail: 1, unknown: 2 } });
  });

  it('uses a custom targetParamName', async () => {
    const { token } = await registerUser(app);
    const link = await createLink(app, token, { targetParamName: 'src', targetValues: [{ name: 'Forum', value: 'f1' }] });
    await request(app).get(`/${link._id}?src=f1`);
    const res = await request(app).get(`/links/${link._id}/stats`).set(auth(token));
    assert.deepEqual(res.body.byTarget, { Forum: 1 });
  });

  it('public /links/summary returns only aggregate counts', async () => {
    const { token } = await registerUser(app);
    const link = await createLink(app, token);
    await request(app).get(`/${link._id}`);
    await request(app).get(`/${link._id}`);

    const res = await request(app).get('/links/summary');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { users: 1, links: 1, clicks: 2 });
  });
});
