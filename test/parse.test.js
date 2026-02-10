const test = require('node:test');
const assert = require('node:assert/strict');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');

const { createParsers } = require('../src/utils/parse');
const { ERRORS } = require('../src/constants/text');

dayjs.extend(customParseFormat);

test('parseAddNumbers parses multiple positive integers', () => {
  const { parseAddNumbers } = createParsers(dayjs, ERRORS);
  const parsed = parseAddNumbers('5 10 15');
  assert.deepEqual(parsed, { sum: 30, max: 15, values: [5, 10, 15] });
});

test('parseAddNumbers returns null on invalid tokens', () => {
  const { parseAddNumbers } = createParsers(dayjs, ERRORS);
  assert.equal(parseAddNumbers('10 foo'), null);
  assert.equal(parseAddNumbers(''), null);
  assert.equal(parseAddNumbers(null), null);
});

test('parseAdd supports mention prefix and /add command', () => {
  const { parseAdd } = createParsers(dayjs, ERRORS);
  const parsed = parseAdd('@botname /add 7 8');
  assert.deepEqual(parsed, { sum: 15, max: 8, values: [7, 8] });
});

test('parseStatusDate returns today when date omitted', () => {
  const { parseStatusDate } = createParsers(dayjs, ERRORS);
  const parsed = parseStatusDate('/status');
  assert.ok(parsed.date);
  assert.match(parsed.label, /^\d{2}\.\d{2}\.\d{4}$/);
});

test('parseStatusDate validates DD.MM.YYYY format', () => {
  const { parseStatusDate } = createParsers(dayjs, ERRORS);
  const ok = parseStatusDate('status 10.02.2026');
  assert.equal(ok.date, '2026-02-10');
  assert.equal(ok.label, '10.02.2026');
  const bad = parseStatusDate('status 31.02.2026');
  assert.deepEqual(bad, { error: ERRORS.INVALID_DATE });
});

test('parseRecord matches bare record command', () => {
  const { parseRecord } = createParsers(dayjs, ERRORS);
  assert.equal(parseRecord('/record'), true);
  assert.equal(parseRecord('record'), true);
  assert.equal(parseRecord('/record now'), false);
});
