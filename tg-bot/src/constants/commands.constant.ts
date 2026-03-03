// src/constants/commands.constant.ts

/**
 * Список всех команд бота
 * Используется для идентификации команд в middleware и обработчиках
 */
export const BOT_COMMANDS = [
    '/start',
    '/cancel',
    '/help',
    // здесь будут добавляться остальные команды
] as const;

// Тип для команд (для TypeScript)
export type BotCommand = typeof BOT_COMMANDS[number];

/**
 * Проверка, является ли текст командой
 * @param text - текст сообщения
 * @returns true если текст начинается с '/' и это известная команда
 */
export function isCommand(text: string): boolean {
    if (!text || !text.startsWith('/')) return false;

    // Извлекаем команду (до первого пробела или конца строки)
    const command = text.split(' ')[0].toLowerCase();

    return BOT_COMMANDS.includes(command as BotCommand);
}

/**
 * Извлечение команды из текста
 * @param text - текст сообщения
 * @returns команда или null, если это не команда
 */
export function extractCommand(text: string): string | null {
    if (!text || !text.startsWith('/')) return null;

    // Извлекаем команду (до первого пробела или конца строки)
    return text.split(' ')[0].toLowerCase();
}