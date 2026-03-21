// src/constants/commands.constant.ts

/**
 * Список всех команд бота
 * Используется для идентификации команд в middleware и обработчиках
 */
export const BOT_COMMANDS = [
    '/start',
    '/cancel',
    '/help',
    '/set_warehouse',
    '/clear_warehouse',  // отвязаться от всех складов
    '/take_sim',      // взять средство индивидуальной мобильности
    '/return_sim',     // сдать СИМ
    '/admin',
    '/exit_admin',
    '/admin_logout',
    '/admin_login',
    '/admin_register',
    '/superadmin_create_warehouse',
    '/superadmin_edit_warehouses',
    '/superadmin_edit_warehouse_name',
    '/superadmin_edit_warehouse_address',
    '/superadmin_edit_warehouse_status',
    '/superadmin_edit_warehouse_delete'
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