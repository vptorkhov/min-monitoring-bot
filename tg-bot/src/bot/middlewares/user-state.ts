// src/bot/middlewares/user-state.ts

import { stateManager } from '../state-manager';

/**
 * ⚠️ DEPRECATED: Этот файл оставлен для обратной совместимости
 * 
 * Все функции теперь просто врапперы вокруг stateManager
 * Используйте stateManager напрямую в новом коде!
 */

export function getUserState(telegramId: number): string | undefined {
    return stateManager.getUserState(telegramId);
}

export function setUserState(telegramId: number, state: string): void {
    stateManager.setUserState(telegramId, state);
}

export function resetUserState(telegramId: number): void {
    stateManager.resetUserState(telegramId);
}

export function getUserTempData<T extends Record<string, any> = Record<string, any>>(telegramId: number): T | undefined {
    return stateManager.getUserTempData<T>(telegramId);
}

export function setUserTempData(telegramId: number, data: any): void {
    stateManager.setUserTempData(telegramId, data);
}

export function resetUserTempData(telegramId: number): void {
    stateManager.resetUserTempData(telegramId);
}