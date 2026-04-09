const DEFAULT_LOCALE = "en-IN";

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function parseDateTime(value) {
  if (!value) {
    return null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const parsed = new Date(text);
  return isValidDate(parsed) ? parsed : null;
}

function parseDateOnly(value) {
  if (!value) {
    return null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return isValidDate(parsed) ? parsed : null;
}

function parseTimeOnly(value) {
  if (!value) {
    return null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const match = text.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return null;
  }

  const parsed = new Date();
  parsed.setHours(Number(match[1]), Number(match[2]), Number(match[3] || 0), 0);
  return isValidDate(parsed) ? parsed : null;
}

function formatWithLocale(date, options) {
  if (!isValidDate(date)) {
    return "-";
  }

  return new Intl.DateTimeFormat(DEFAULT_LOCALE, options).format(date);
}

export function formatDateTime(value) {
  const parsed = parseDateTime(value) || parseDateOnly(value) || parseTimeOnly(value);
  return formatWithLocale(parsed, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function formatDate(value) {
  const parsed = parseDateOnly(value) || parseDateTime(value);
  return formatWithLocale(parsed, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export function formatTime(value) {
  const parsed = parseTimeOnly(value) || parseDateTime(value);
  return formatWithLocale(parsed, {
    hour: "numeric",
    minute: "2-digit"
  });
}
