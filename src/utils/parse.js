function createParsers(dayjs, errors) {
  if (!errors) {
    throw new Error('errors are required');
  }

  function stripLeadingMention(text) {
    if (!text) {
      return text;
    }

    const trimmed = text.trim();
    const match = trimmed.match(/^@\w+\s+/);
    if (!match) {
      return trimmed;
    }

    return trimmed.slice(match[0].length);
  }

  function parseAddNumbers(str) {
    if (!str || typeof str !== 'string') {
      return null;
    }
    const parts = str.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return null;
    }
    const values = [];
    for (const p of parts) {
      if (!/^\d+$/.test(p)) {
        return null;
      }
      const n = Number.parseInt(p, 10);
      values.push(n);
    }
    const sum = values.reduce((a, b) => a + b, 0);
    const max = Math.max(...values);
    return { sum, max, values };
  }

  function parseAdd(text) {
    if (!text) {
      return null;
    }

    const normalized = stripLeadingMention(text);
    const match = normalized.match(/\/?add(?:@\w+)?\s+(.+)/i);
    if (!match) {
      return null;
    }

    return parseAddNumbers(match[1].trim());
  }

  function parseStatusDate(text) {
    if (!text) {
      return null;
    }

    const normalized = stripLeadingMention(text);
    const match = normalized.match(/\/?status(?:@\w+)?(?:\s+(\d{2}\.\d{2}\.\d{4}))?/i);
    if (!match) {
      return null;
    }

    if (!match[1]) {
      return { date: dayjs().format('YYYY-MM-DD'), label: dayjs().format('DD.MM.YYYY') };
    }

    const parsed = dayjs(match[1], 'DD.MM.YYYY', true);
    if (!parsed.isValid()) {
      return { error: errors.INVALID_DATE };
    }

    return { date: parsed.format('YYYY-MM-DD'), label: match[1] };
  }

  function parseRecord(text) {
    if (!text) {
      return false;
    }

    const normalized = stripLeadingMention(text);
    return /\/?record(?:@\w+)?\s*$/i.test(normalized);
  }

  function parseCorrect(text) {
    if (!text) {
      return null;
    }

    const normalized = stripLeadingMention(text);
    const match = normalized.match(/\/?correct(?:@\w+)?\s+([+-]?\d+)/i);
    if (!match) {
      return null;
    }

    const raw = match[1];
    const value = Number.parseInt(raw, 10);
    if (!Number.isFinite(value)) {
      return null;
    }

    if (raw.startsWith('+')) {
      return { mode: 'add', value };
    }
    if (raw.startsWith('-')) {
      return { mode: 'subtract', value: -value };
    }
    return { mode: 'set', value: value >= 0 ? value : 0 };
  }

  return {
    parseAdd,
    parseAddNumbers,
    parseCorrect,
    parseRecord,
    parseStatusDate,
    stripLeadingMention,
  };
}

module.exports = { createParsers };
