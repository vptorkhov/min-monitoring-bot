const MOSCOW_LOCALE = "ru-RU";
const MOSCOW_TIMEZONE = "Europe/Moscow";
const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Форматирует дату во время по Москве (HH:mm). */
export function formatMoscowTime(date: Date | null): string {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat(MOSCOW_LOCALE, {
    timeZone: MOSCOW_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(date));
}

/** Форматирует дату и время по Москве (dd.MM.yyyy HH:mm). */
export function formatMoscowDateTime(date: Date | null): string {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat(MOSCOW_LOCALE, {
    timeZone: MOSCOW_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(date));
}

/** Парсит дату формата dd.MM.yyyy и возвращает UTC-границы московского дня. */
export function parseMoscowDateRangeInput(
  input: string,
): { displayDate: string; startUtc: Date; endUtc: Date } | null {
  const match = input.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return null;
  }

  const checkDate = new Date(Date.UTC(year, month - 1, day));
  if (
    checkDate.getUTCFullYear() !== year ||
    checkDate.getUTCMonth() !== month - 1 ||
    checkDate.getUTCDate() !== day
  ) {
    return null;
  }

  const startUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - MOSCOW_OFFSET_MS;
  const endUtcMs = startUtcMs + DAY_MS;

  return {
    displayDate: `${match[1]}.${match[2]}.${match[3]}`,
    startUtc: new Date(startUtcMs),
    endUtc: new Date(endUtcMs),
  };
}