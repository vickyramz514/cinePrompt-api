import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isOriginAllowed } from '../src/utils/corsOrigins.js';

describe('isOriginAllowed', () => {
  it('always allows apex and www even when CORS_ORIGIN omits them', () => {
    const prev = process.env.CORS_ORIGIN;
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    try {
      assert.equal(isOriginAllowed('https://datacaptain.in', { nodeEnv: 'development' }), true);
      assert.equal(isOriginAllowed('https://www.datacaptain.in', { nodeEnv: 'development' }), true);
    } finally {
      if (prev === undefined) delete process.env.CORS_ORIGIN;
      else process.env.CORS_ORIGIN = prev;
    }
  });

  it('rejects unrelated origins when CORS_ORIGIN is set', () => {
    const prev = process.env.CORS_ORIGIN;
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    try {
      assert.equal(isOriginAllowed('https://evil.example', { nodeEnv: 'development' }), false);
    } finally {
      if (prev === undefined) delete process.env.CORS_ORIGIN;
      else process.env.CORS_ORIGIN = prev;
    }
  });
});
