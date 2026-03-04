import TelegramBot from 'node-telegram-bot-api';
import { RegistrationHandler } from '../handlers/registration.handler';
import {
    getUserState,
    resetUserState,
    resetUserTempData
} from '../middlewares/user-state';

/**
 * Регистрация команды /cancel
 * 
 * Универсальная отмена текущего действия пользователя.
 * Работает для:
 * - регистрации
 * - выбора склада
 * - будущих процессов
 */
export function registerCancelCommand(
    bot: TelegramBot,
    registrationHandler: RegistrationHandler
) {
    bot.onText(/\/cancel/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from?.id;

        if (!userId) return;

        let wasInProcess = false;

        // 1️⃣ Проверяем регистрацию
        if (registrationHandler.isUserInRegistration(userId)) {
            await registrationHandler.cancelRegistration(chatId, userId);
            wasInProcess = true;
        }

        // 2️⃣ Проверяем общее состояние (например, выбор склада)
        const state = getUserState(userId);
        if (state) {
            resetUserState(userId);
            resetUserTempData(userId);
            wasInProcess = true;
        }

        // 3️⃣ Если пользователь не находился ни в каком процессе
        if (!wasInProcess) {
            await bot.sendMessage(chatId, 'ℹ️ Нет активного действия для отмены.');
            return;
        }

        // 4️⃣ Универсальное сообщение
        await bot.sendMessage(chatId, '❌ Действие отменено.');
    });
}