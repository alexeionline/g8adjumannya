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

  function parseAdd(text) {
    if (!text) {
      return null;
    }

    const normalized = stripLeadingMention(text);
    const match = normalized.match(/\/?add(?:@\w+)?\s+(\d+)/i);
    if (!match) {
      return null;
    }

    const value = Number.parseInt(match[1], 10);
    if (!Number.isFinite(value) || value < 0) {
      return null;
    }

    return value;
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

  return {
    parseAdd,
    parseRecord,
    parseStatusDate,
    stripLeadingMention,
  };
}

module.exports = { createParsers };
