const ENABLED_STATUS_INPUTS = [
  "1",
  "1.",
  "активный",
  "1 активный",
  "1. активный",
] as const;

const DISABLED_STATUS_INPUTS = [
  "2",
  "2.",
  "отключен",
  "2 отключен",
  "2. отключен",
] as const;

const SIM_CONDITION_OK_INPUTS = ["1", "1.", "исправен", "1 исправен", "1. исправен"] as const;
const SIM_CONDITION_WARNING_INPUTS = [
  "2",
  "2.",
  "поврежден",
  "2 поврежден",
  "2. поврежден",
] as const;
const SIM_CONDITION_BROKEN_INPUTS = ["3", "3.", "сломан", "3 сломан", "3. сломан"] as const;

const SIM_STATUS_OK = "ok";
const SIM_STATUS_WARNING = "warning";
const SIM_STATUS_BROKEN = "broken";

export type SimConditionStatus =
  | typeof SIM_STATUS_OK
  | typeof SIM_STATUS_WARNING
  | typeof SIM_STATUS_BROKEN;

function normalizeStatusInput(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Возвращает текстовый статус активности сущности. */
export function getActiveStatusText(isActive: boolean): string {
  return isActive ? "Активный" : "Отключен";
}

/** Парсит ввод пользователя для бинарного статуса активности. */
export function parseActiveStatusInput(input: string): boolean | null {
  const normalized = normalizeStatusInput(input);

  if (ENABLED_STATUS_INPUTS.includes(normalized as (typeof ENABLED_STATUS_INPUTS)[number])) {
    return true;
  }

  if (DISABLED_STATUS_INPUTS.includes(normalized as (typeof DISABLED_STATUS_INPUTS)[number])) {
    return false;
  }

  return null;
}

/** Возвращает человекочитаемый статус состояния СИМ. */
export function getSimConditionStatusText(status: string): string {
  if (status === SIM_STATUS_OK) {
    return "Исправен";
  }

  if (status === SIM_STATUS_WARNING) {
    return "Поврежден";
  }

  if (status === SIM_STATUS_BROKEN) {
    return "Сломан";
  }

  return status;
}

/** Парсит ввод пользователя для статуса технического состояния СИМ. */
export function parseSimConditionStatusInput(input: string): SimConditionStatus | null {
  const normalized = normalizeStatusInput(input);

  if (
    SIM_CONDITION_OK_INPUTS.includes(normalized as (typeof SIM_CONDITION_OK_INPUTS)[number])
  ) {
    return SIM_STATUS_OK;
  }

  if (
    SIM_CONDITION_WARNING_INPUTS.includes(
      normalized as (typeof SIM_CONDITION_WARNING_INPUTS)[number],
    )
  ) {
    return SIM_STATUS_WARNING;
  }

  if (
    SIM_CONDITION_BROKEN_INPUTS.includes(
      normalized as (typeof SIM_CONDITION_BROKEN_INPUTS)[number],
    )
  ) {
    return SIM_STATUS_BROKEN;
  }

  return null;
}