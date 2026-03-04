// src/utils/telegram.utils.ts

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