// src/bot/middlewares/user-state.ts

// Состояния пользователей
const userStates: Record<number, string> = {};

// Временные данные пользователей (например, список складов)
const userTempData: Record<number, any> = {};

export function getUserState(telegramId: number): string | undefined {
    return userStates[telegramId];
}

export function setUserState(telegramId: number, state: string): void {
    userStates[telegramId] = state;
}

export function resetUserState(telegramId: number): void {
    delete userStates[telegramId];
}

// Работа с временными данными
export function getUserTempData<T>(telegramId: number): T | undefined {
    return userTempData[telegramId] as T | undefined;
}

export function setUserTempData(telegramId: number, data: any): void {
    userTempData[telegramId] = data;
}

export function resetUserTempData(telegramId: number): void {
    delete userTempData[telegramId];
}