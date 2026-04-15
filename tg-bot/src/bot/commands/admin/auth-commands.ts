import TelegramBot from 'node-telegram-bot-api';
import { stateManager } from '../../state-manager';
import { AdminState } from '../../../constants/states.constant';
import {
    enterAdminMode,
    exitAdminMode,
    isUserInAdminMode
} from '../../admin/admin-mode';
import { restoreCourierFlowAfterExitAdmin } from './admin-flow.utils';
import { RegistrationHandler } from '../../handlers/registration.handler';
import { CourierService } from '../../../services/courier.service';
import { SessionService } from '../../../services/session.service';
import { AdminService } from '../../../services/admin.service';
import { isInAuthenticatedOrSubflow } from '../../../utils/admin-state.utils';
import { AdminSessionData } from '../admin.types';

const HIDE_REPLY_KEYBOARD: TelegramBot.ReplyKeyboardRemove = {
    remove_keyboard: true
};

/**
 * Register authentication and admin mode commands:
 * /admin, /admin_logout, /exit_admin, /admin_login,
 * /admin_register, /admin_change_password
 */
export function registerAuthCommands(
    bot: TelegramBot,
    courierService: CourierService,
    registrationHandler: RegistrationHandler,
    sessionService: SessionService,
    adminService: AdminService,
    startAdminLoginFlow: (chatId: number, telegramId: number) => Promise<void>,
    startAdminRegistrationFlow: (
        chatId: number,
        telegramId: number
    ) => Promise<void>
): void {
    // /admin - Enter admin mode
    bot.onText(/^\/admin(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId) {
            return;
        }

        const wasInAdminMode = isUserInAdminMode(telegramId);
        enterAdminMode(telegramId);

        await bot.sendMessage(
            chatId,
            wasInAdminMode
                ? '🛡 Вы уже в админском режиме. Доступны: /admin_login, /admin_register, /admin_logout, /exit_admin.'
                : '🛡 Включен админский режим. Текущий курьерский сценарий остановлен. Доступны: /admin_login, /admin_register, /admin_logout, /exit_admin.',
            { reply_markup: HIDE_REPLY_KEYBOARD }
        );
    });

    // /admin_logout - Logout from authenticated mode
    bot.onText(/^\/admin_logout(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId) {
            return;
        }

        if (!isUserInAdminMode(telegramId)) {
            await bot.sendMessage(
                chatId,
                'ℹ️ Сначала войдите в админский режим командой /admin.'
            );
            return;
        }

        const currentState = stateManager.getUserState(telegramId);
        const tempData = stateManager.getUserTempData<{ adminId?: number }>(
            telegramId
        );
        const adminId = tempData?.adminId;
        const wasAuthenticated =
            currentState === AdminState.AUTHENTICATED ||
            currentState === AdminState.AUTHENTICATED_WITH_WAREHOUSE ||
            currentState === AdminState.CHANGE_PASSWORD_AWAITING_NEW ||
            currentState === AdminState.SET_WAREHOUSE_SELECTING ||
            currentState === AdminState.CREATE_WAREHOUSE_AWAITING_NAME ||
            currentState === AdminState.CREATE_WAREHOUSE_AWAITING_ADDRESS ||
            currentState === AdminState.EDIT_WAREHOUSES_SELECTING ||
            currentState === AdminState.EDIT_WAREHOUSE_ACTION_SELECTING ||
            currentState === AdminState.EDIT_WAREHOUSE_AWAITING_NAME ||
            currentState === AdminState.EDIT_WAREHOUSE_AWAITING_ADDRESS ||
            currentState === AdminState.EDIT_WAREHOUSE_AWAITING_STATUS ||
            currentState ===
                AdminState.EDIT_WAREHOUSE_AWAITING_DELETE_CONFIRM ||
            currentState === AdminState.EDIT_ADMINS_SELECTING ||
            currentState === AdminState.EDIT_ADMIN_ACTION_SELECTING ||
            currentState === AdminState.EDIT_ADMIN_AWAITING_STATUS ||
            currentState === AdminState.EDIT_ADMIN_AWAITING_DELETE_CONFIRM ||
            currentState === AdminState.EDIT_ADMIN_AWAITING_PASSWORD ||
            currentState === AdminState.APPLY_REGISTRATIONS_SELECTING ||
            currentState === AdminState.APPLY_REGISTRATION_AWAITING_CONFIRM ||
            currentState === AdminState.ADMIN_SESSIONS_HISTORY_AWAITING_DATE ||
            currentState === AdminState.ADD_SIM_AWAITING_NUMBER ||
            currentState === AdminState.SIM_INTERACTIONS_SELECTING ||
            currentState === AdminState.SIM_INTERACTION_ACTION_SELECTING ||
            currentState ===
                AdminState.SIM_INTERACTION_AWAITING_ACTIVE_STATUS ||
            currentState ===
                AdminState.SIM_INTERACTION_AWAITING_CONDITION_STATUS ||
            currentState ===
                AdminState.SIM_INTERACTION_AWAITING_DELETE_CONFIRM ||
            currentState === AdminState.ADMIN_EDIT_COURIERS_SELECTING ||
            currentState === AdminState.SUPERADMIN_EDIT_COURIERS_SELECTING ||
            currentState === AdminState.ADMIN_EDIT_COURIER_ACTION_SELECTING ||
            currentState ===
                AdminState.SUPERADMIN_EDIT_COURIER_ACTION_SELECTING ||
            currentState === AdminState.ADMIN_EDIT_COURIER_AWAITING_STATUS ||
            currentState ===
                AdminState.SUPERADMIN_EDIT_COURIER_AWAITING_STATUS ||
            currentState === AdminState.ADMIN_COURIER_HISTORY_AWAITING_FULL ||
            currentState ===
                AdminState.SUPERADMIN_COURIER_HISTORY_AWAITING_FULL;

        if (wasAuthenticated && adminId) {
            await adminService.setLoginStatus(adminId, false);
        }

        stateManager.setUserState(telegramId, AdminState.GUEST_MODE);
        stateManager.resetUserTempData(telegramId);

        await bot.sendMessage(
            chatId,
            wasAuthenticated
                ? '✅ Вы вышли из авторизованного админ-режима и возвращены в предадминское состояние. Доступны: /admin_login, /admin_register, /admin_logout, /exit_admin.'
                : 'ℹ️ Вы уже находитесь в предадминском состоянии. Доступны: /admin_login, /admin_register, /admin_logout, /exit_admin.'
        );
    });

    // /exit_admin - Exit admin mode completely
    bot.onText(/^\/exit_admin(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId) {
            return;
        }

        if (!isUserInAdminMode(telegramId)) {
            await bot.sendMessage(chatId, 'ℹ️ Админский режим уже выключен.');
            return;
        }

        exitAdminMode(telegramId);
        await bot.sendMessage(
            chatId,
            '✅ Админский режим выключен. Возвращаем вас в курьерский режим...'
        );

        await restoreCourierFlowAfterExitAdmin(
            bot,
            chatId,
            telegramId,
            courierService,
            registrationHandler,
            sessionService
        );
    });

    // /admin_login - Start login flow
    bot.onText(/^\/admin_login(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId) {
            return;
        }

        if (!isUserInAdminMode(telegramId)) {
            await bot.sendMessage(
                chatId,
                'ℹ️ Сначала войдите в админский режим командой /admin.'
            );
            return;
        }

        await startAdminLoginFlow(chatId, telegramId);
    });

    // /admin_register - Start registration flow
    bot.onText(/^\/admin_register(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId) {
            return;
        }

        if (!isUserInAdminMode(telegramId)) {
            await bot.sendMessage(
                chatId,
                'ℹ️ Сначала войдите в админский режим командой /admin.'
            );
            return;
        }

        await startAdminRegistrationFlow(chatId, telegramId);
    });

    // /admin_change_password - Change admin password
    bot.onText(/^\/admin_change_password(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId) {
            return;
        }

        if (!isUserInAdminMode(telegramId)) {
            await bot.sendMessage(
                chatId,
                'ℹ️ Сначала войдите в админский режим командой /admin.'
            );
            return;
        }

        const currentState = stateManager.getUserState(telegramId);
        if (!isInAuthenticatedOrSubflow(currentState)) {
            await bot.sendMessage(
                chatId,
                '🔒 Эта команда доступна только авторизованному администратору. Используйте /admin_login.'
            );
            return;
        }

        const tempData =
            stateManager.getUserTempData<AdminSessionData>(telegramId);
        if (!tempData?.adminId) {
            stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
            await bot.sendMessage(
                chatId,
                '⚠️ Не удалось определить администратора. Выполните /admin_login повторно.'
            );
            return;
        }

        stateManager.setUserState(
            telegramId,
            AdminState.CHANGE_PASSWORD_AWAITING_NEW
        );
        await bot.sendMessage(
            chatId,
            'Введите новый пароль, не менее 6 символов'
        );
    });
}
