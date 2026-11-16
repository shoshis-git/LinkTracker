import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { loadConfig, ConfigError } from '../config.js';

const valid = {
  MONGO_URI: 'mongodb://localhost:27017/tinyurl',
  PORT: '3000',
  JWT_SECRET: 'a'.repeat(32)
};

describe('loadConfig', () => {
  it('returns a parsed config for valid variables', () => {
    const config = loadConfig(valid);
    assert.equal(config.port, 3000);
    assert.equal(config.mongoUri, valid.MONGO_URI);
    assert.equal(config.jwtSecret, valid.JWT_SECRET);
    assert.equal(config.nodeEnv, 'development');
    assert.equal(config.corsOrigins, '*');
    assert.equal(config.trustProxy, false);
  });

  it('lists every missing required variable', () => {
    assert.throws(() => loadConfig({}), (err) => {
      assert.ok(err instanceof ConfigError);
      assert.equal(err.problems.length, 3);
      assert.match(err.message, /MONGO_URI/);
      assert.match(err.message, /PORT/);
      assert.match(err.message, /JWT_SECRET/);
      return true;
    });
  });

  it('rejects an invalid PORT', () => {
    for (const PORT of ['abc', '0', '70000', '30.5'])
      assert.throws(() => loadConfig({ ...valid, PORT }), /PORT must be an integer/);
  });

  it('rejects an invalid MONGO_URI', () => {
    assert.throws(() => loadConfig({ ...valid, MONGO_URI: 'localhost:27017' }), /MONGO_URI must start with/);
  });

  it('only warns about a short JWT_SECRET in development', () => {
    const config = loadConfig({ ...valid, JWT_SECRET: 'short' });
    assert.ok(config.warnings.some(w => w.includes('JWT_SECRET')));
  });

  it('requires a strong JWT_SECRET and CORS_ORIGINS in production', () => {
    assert.throws(() => loadConfig({ ...valid, NODE_ENV: 'production', JWT_SECRET: 'short' }), (err) => {
      assert.match(err.message, /JWT_SECRET should be at least 32/);
      assert.match(err.message, /CORS_ORIGINS is required in production/);
      return true;
    });
  });

  it('parses CORS_ORIGINS and TRUST_PROXY', () => {
    const config = loadConfig({
      ...valid,
      CORS_ORIGINS: 'http://localhost:5500, http://127.0.0.1:5500/',
      TRUST_PROXY: '1'
    });
    assert.deepEqual(config.corsOrigins, ['http://localhost:5500', 'http://127.0.0.1:5500']);
    assert.equal(config.trustProxy, 1);
    assert.equal(loadConfig({ ...valid, TRUST_PROXY: 'true' }).trustProxy, true);
    assert.deepEqual(loadConfig({ ...valid, TRUST_PROXY: 'loopback, 10.0.0.0/8' }).trustProxy, ['loopback', '10.0.0.0/8']);
  });

  it('does not include secret values in error messages', () => {
    const secret = 'super-secret-value';
    assert.throws(() => loadConfig({ ...valid, NODE_ENV: 'production', JWT_SECRET: secret }), (err) => {
      assert.ok(!err.message.includes(secret));
      return true;
    });
  });
});
