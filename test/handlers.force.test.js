const test = require('node:test');
const assert = require('node:assert/strict');

const { createForceHandler } = require('../src/handlers/force');
const { ERRORS } = require('../src/constants/text');

test('force handler validates mention format', async () => {
  const calls = [];
  const handler = createForceHandler({
    forceMessages: ['go'],
    errors: ERRORS,
    sendEphemeral: async (...args) => {
      calls.push(args);
      return {};
    },
  });
  await handler({ message: { text: 'force no_mention', entities: [] } });
  assert.equal(calls[0][1], ERRORS.FORCE_FORMAT);
});

test('force handler escapes html and returns parse_mode HTML', async () => {
  const calls = [];
  const handler = createForceHandler({
    forceMessages: ['<go>'],
    errors: ERRORS,
    sendEphemeral: async (...args) => {
      calls.push(args);
      return {};
    },
  });
  await handler({ message: { text: 'force @alex_1', entities: [{ type: 'mention', offset: 6, length: 7 }] } });
  assert.match(calls[0][1], /@alex_1/);
  assert.match(calls[0][1], /&lt;go&gt;/);
  assert.deepEqual(calls[0][2], { parse_mode: 'HTML' });
});
