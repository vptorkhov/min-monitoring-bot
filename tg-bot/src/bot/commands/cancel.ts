import TelegramBot from 'node-telegram-bot-api';
import { RegistrationHandler } from '../handlers/registration.handler';
import { CourierService } from '../../services/courier.service';
import { SessionService } from '../../services/session.service';
import {
    stateManager
} from '../state-manager';
import { sendCourierMainKeyboard } from '../keyboards/courier-main-keyboard';
import { blockIfAdminGuestCommandNotAllowed } from '../admin/admin-mode';
import { AdminState } from '../../constants/states.constant';

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

        const currentState = stateManager.getUserState(userId);
        const isAdminFlowState = currentState === AdminState.REGISTER_AWAITING_LOGIN
            || currentState === AdminState.REGISTER_AWAITING_PASSWORD
            || currentState === AdminState.LOGIN_AWAITING_LOGIN
            || currentState === AdminState.LOGIN_AWAITING_PASSWORD;

        if (isAdminFlowState) {
            stateManager.setUserState(userId, AdminState.GUEST_MODE);
            stateManager.resetUserTempData(userId);

            await bot.sendMessage(
                chatId,
                '❌ Действие отменено. Вы возвращены в предадминское состояние. Доступны: /admin_login, /admin_register, /admin_logout, /exit_admin.'
            );
            return;
        }

        const isAdminGuestOrAuthenticated = currentState === AdminState.GUEST_MODE
            || currentState === AdminState.AUTHENTICATED;
        if (isAdminGuestOrAuthenticated) {
            await bot.sendMessage(chatId, 'ℹ️ Нет активного действия для отмены.');
            return;
        }

        const isCreateWarehouseFlowState = currentState === AdminState.CREATE_WAREHOUSE_AWAITING_NAME
            || currentState === AdminState.CREATE_WAREHOUSE_AWAITING_ADDRESS;
        if (isCreateWarehouseFlowState) {
            const tempData = stateManager.getUserTempData<{ adminId?: number; adminPermissionsLevel?: number }>(userId);
            const adminId = tempData?.adminId;
            const adminPermissionsLevel = tempData?.adminPermissionsLevel;

            stateManager.setUserState(userId, AdminState.AUTHENTICATED);
            stateManager.resetUserTempData(userId);
            if (adminId && adminPermissionsLevel) {
                stateManager.setUserTempData(userId, { adminId, adminPermissionsLevel });
            }

            await bot.sendMessage(chatId, '❌ Создание склада отменено. Вы возвращены в авторизованный админский режим.');
            return;
        }

        if (await blockIfAdminGuestCommandNotAllowed(bot, chatId, userId, msg.text)) {
            return;
        }

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