import TelegramBot from 'node-telegram-bot-api';
import { RegistrationHandler } from '../handlers/registration.handler';
import { CourierService } from '../../services/courier.service';
import { SessionService } from '../../services/session.service';
import {
    stateManager
} from '../state-manager';
import { sendCourierMainKeyboard } from '../keyboards/courier-main-keyboard';

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
    registrationHandler: RegistrationHandler,
    courierService: CourierService,
    sessionService: SessionService
) {
    bot.onText(/^\/cancel(?:@\w+)?$/, async (msg) => {
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
        const state = stateManager.getUserState(userId);
        if (state) {
            stateManager.resetUserState(userId);
            stateManager.resetUserTempData(userId);
            wasInProcess = true;
        }

        // 3️⃣ Если пользователь не находился ни в каком процессе
        if (!wasInProcess) {
            await bot.sendMessage(chatId, 'ℹ️ Нет активного действия для отмены.');
            return;
        }

        // 4️⃣ Универсальное сообщение
        await bot.sendMessage(chatId, '❌ Действие отменено.');

        // 5️⃣ Восстанавливаем основную клавиатуру по текущему состоянию курьера
        await sendCourierMainKeyboard(bot, chatId, userId, courierService, sessionService);
    });
}