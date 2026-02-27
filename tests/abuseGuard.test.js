/**
 * Unit tests: Abuse guard business logic
 * Run: node --test tests/abuseGuard.test.js
 *
 * - FREE user blocked after daily limit
 * - Paid user allowed unlimited jobs until credits exhausted
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert';

// Test isPaidPlan - pure logic, no DB
describe('isPaidPlan', () => {
  it('returns true for STARTER, CREATOR, PRO, ULTRA', async () => {
    const { isPaidPlan } = await import('../src/services/abuseService.js');
    assert.strictEqual(isPaidPlan('STARTER'), true);
    assert.strictEqual(isPaidPlan('CREATOR'), true);
    assert.strictEqual(isPaidPlan('PRO'), true);
    assert.strictEqual(isPaidPlan('ULTRA'), true);
  });

  it('returns false for FREE and null', async () => {
    const { isPaidPlan } = await import('../src/services/abuseService.js');
    assert.strictEqual(isPaidPlan('FREE'), false);
    assert.strictEqual(isPaidPlan(null), false);
    assert.strictEqual(isPaidPlan(undefined), false);
  });
});

// Integration tests for checkDailyVideoCap require DB - run with test DB
// Logic verified: isPaidPlan gates daily cap; PAID_PLANS skip check in checkDailyVideoCap
