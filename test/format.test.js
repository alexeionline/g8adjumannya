const test = require('node:test');
const assert = require('node:assert/strict');

const {
  formatAddHeader,
  formatDisplayName,
  formatIndexEmoji,
  formatProgressBar,
} = require('../src/utils/format');

test('formatDisplayName prefers username, then names, then fallback', () => {
  assert.equal(formatDisplayName({ user_id: 1, username: 'alex' }), 'alex');
  assert.equal(formatDisplayName({ user_id: 2, first_name: 'A', last_name: 'B' }), 'A B');
  assert.equal(formatDisplayName({ user_id: 3 }), 'User 3');
});

test('formatIndexEmoji returns emoji for top-10 and numeric fallback after', () => {
  assert.equal(formatIndexEmoji(0), '1️⃣');
  assert.equal(formatIndexEmoji(9), '🔟');
  assert.equal(formatIndexEmoji(10), '11.');
});

test('formatProgressBar fills 1 block per 20 reps up to 5 blocks', () => {
  assert.equal(formatProgressBar(0), '⚪⚪⚪⚪⚪');
  assert.equal(formatProgressBar(20), '🟢⚪⚪⚪⚪');
  assert.equal(formatProgressBar(100), '🟢🟢🟢🟢🟢');
  assert.equal(formatProgressBar(180), '🟢🟢🟢🟢🟢');
});

test('formatAddHeader injects username into phrase', () => {
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    const text = formatAddHeader('alex');
    assert.equal(typeof text, 'string');
    assert.ok(text.includes('alex'));
  } finally {
    Math.random = originalRandom;
  }
});
