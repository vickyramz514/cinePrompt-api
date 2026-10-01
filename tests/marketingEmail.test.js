import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarketingEmail, withUtm, personalize } from '../src/services/email/marketingTemplate.js';
import { createUnsubscribeToken, verifyUnsubscribeToken, buildUnsubscribeUrl } from '../src/utils/unsubscribeToken.js';
import { audienceWhere } from '../src/services/marketingEmailService.js';

const content = {
  subject: '{{name}}, upgrade today',
  preheader: 'More requests',
  headline: 'Hello <script>alert(1)</script>',
  body: 'Hi {{name}},\n\nSecond paragraph.',
  ctaLabel: 'View plans',
  ctaUrl: 'https://www.datacaptain.in/pricing',
  showPlans: true,
};
const plans = [{ name: 'Starter', priceCents: 50000, billingCycle: 'monthly', features: ['1,000 requests/day'] }];

test('renders personalized, escaped email with plans and unsubscribe link', () => {
  const { subject, html, text } = renderMarketingEmail({
    user: { name: 'Vignesh R' },
    content,
    plans,
    unsubscribeUrl: 'https://api.example.com/unsub?u=1&t=x',
    campaignTag: 'dc-test',
  });
  assert.equal(subject, 'Vignesh, upgrade today');
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('₹500/mo'));
  assert.ok(html.includes('utm_campaign=dc-test'));
  assert.ok(html.includes('https://api.example.com/unsub?u=1&amp;t=x'));
  assert.ok(text.includes('Unsubscribe: https://api.example.com/unsub?u=1&t=x'));
  assert.ok(text.includes('Hi Vignesh,'));
});

test('hides plans when showPlans is false', () => {
  const { html } = renderMarketingEmail({
    user: { name: 'A' },
    content: { ...content, showPlans: false },
    plans,
    unsubscribeUrl: 'https://x.test/u',
  });
  assert.ok(!html.includes('₹500/mo'));
});

test('personalize falls back to "there"', () => {
  assert.equal(personalize('Hi {{ name }}', { name: '' }), 'Hi there');
});

test('withUtm keeps existing params and ignores invalid urls', () => {
  assert.ok(withUtm('https://a.test/p?utm_source=x', 't').includes('utm_source=x'));
  assert.equal(withUtm('not a url', 't'), 'not a url');
});

test('unsubscribe tokens verify only for the matching user', () => {
  const token = createUnsubscribeToken('user-1');
  assert.equal(verifyUnsubscribeToken('user-1', token), true);
  assert.equal(verifyUnsubscribeToken('user-2', token), false);
  assert.equal(verifyUnsubscribeToken('user-1', 'bad'), false);
  assert.equal(verifyUnsubscribeToken(undefined, token), false);
  assert.ok(buildUnsubscribeUrl('user-1').includes('/v1/email/unsubscribe?u=user-1&t='));
});

test('audiences always exclude opted-out and blocked users', () => {
  for (const audience of ['free', 'lapsed', 'all']) {
    const where = audienceWhere(audience);
    assert.equal(where.marketingOptOut, false);
    assert.equal(where.isActive, true);
  }
  assert.equal(audienceWhere('free').plan, 'FREE');
  assert.deepEqual(audienceWhere('lapsed').userSubscriptions.none, { status: 'ACTIVE' });
  assert.throws(() => audienceWhere('nope'));
});
