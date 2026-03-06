// src/utils/telegram.utils.ts

import {
    KEYBOARD_BUTTON_TEXT,
    LEGACY_KEYBOARD_BUTTON_TEXT
} from '../bot/keyboards/registration.keyboard';

// Интерфейс для данных пользователя из Telegram
export interface TelegramUserData {
    telegramId: number;
    username?: string;
    firstName: string;
    lastName?: string;
}

// Извлечение данных пользователя из сообщения Telegram
export function extractUserDataFromMessage(msg: any): TelegramUserData {
    return {
        telegramId: msg.from.id,
        username: msg.from.username,
        firstName: msg.from.first_name,
        lastName: msg.from.last_name
    };
}

// Форматирование сообщения об ошибке
export function formatErrorMessage(error: string): string {
    return `❌ ${error}`;
}

// Форматирование успешного сообщения
export function formatSuccessMessage(message: string): string {
    return `✅ ${message}`;
}

/**
 * Преобразование текста кнопки клавиатуры в команду
 * Например: "❌ Отмена" → "/cancel"
 * @param buttonText - текст кнопки
 * @returns команда (с /) или оригинальный текст если это не кнопка
 */
export function convertKeyboardButtonToCommand(buttonText: string): string {
    switch (buttonText) {
        case KEYBOARD_BUTTON_TEXT.START:
            return '/start';
        case KEYBOARD_BUTTON_TEXT.CANCEL:
            return '/cancel';
        case KEYBOARD_BUTTON_TEXT.SELECT_WAREHOUSE:
        case LEGACY_KEYBOARD_BUTTON_TEXT.SELECT_WAREHOUSE:
            return '/set_warehouse';
        case KEYBOARD_BUTTON_TEXT.TAKE_SIM:
            return '/take_sim';
        case KEYBOARD_BUTTON_TEXT.CLEAR_WAREHOUSE:
            return '/clear_warehouse';
        case KEYBOARD_BUTTON_TEXT.RETURN_SIM:
            return '/return_sim';
        default:
            return buttonText;
    }
}