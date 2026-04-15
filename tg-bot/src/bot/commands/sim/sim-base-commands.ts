import TelegramBot from 'node-telegram-bot-api';
import { AdminService } from '../../../services/admin.service';
import { SessionService } from '../../../services/session.service';
import { isUserInAdminMode } from '../../admin/admin-mode';
import { stateManager } from '../../state-manager';
import { AdminState } from '../../../constants/states.constant';
import { isInAuthenticatedOrSubflow } from '../../../utils/admin-state.utils';
import { formatActiveSessionsByWarehouseRows } from '../../../utils/admin-format.utils';
import { AdminSessionData } from '../admin.types';

type SendAdminCommandsIfNeeded = (
    chatId: number,
    permLevel: number | undefined,
    state: string
) => Promise<void>;

/** Регистрирует базовые SIM-команды admin-flow. */
export function registerSimBaseCommands(
    bot: TelegramBot,
    adminService: AdminService,
    sessionService: SessionService,
    sendAdminCommandsIfNeeded: SendAdminCommandsIfNeeded
): void {
    bot.onText(/^\/admin_add_sim(?:@\w+)?$/, async (msg) => {
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
            stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        if (!tempData.adminId || !tempData.adminPermissionsLevel) {
            stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
            await bot.sendMessage(
                chatId,
                '⚠️ Не удалось определить администратора. Выполните /admin_login повторно.'
            );
            return;
        }

        const warehouseId = await adminService.getAdminWarehouseId(
            tempData.adminId
        );
        if (warehouseId === undefined) {
            stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
            await bot.sendMessage(
                chatId,
                '⚠️ Не удалось определить администратора. Выполните /admin_login повторно.'
            );
            return;
        }

        if (warehouseId === null) {
            await bot.sendMessage(
                chatId,
                '❌ Команда доступна только если выбран склад. Используйте /admin_set_warehouse.'
            );
            return;
        }

        stateManager.setUserState(
            telegramId,
            AdminState.ADD_SIM_AWAITING_NUMBER
        );
        stateManager.setUserTempData(telegramId, {
            addSimWarehouseId: warehouseId
        });

        await bot.sendMessage(chatId, 'Введите номер СИМ');
    });

    bot.onText(/^\/admin_active_sessions(?:@\w+)?$/, async (msg) => {
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
            stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        if (!tempData.adminId || !tempData.adminPermissionsLevel) {
            stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
            await bot.sendMessage(
                chatId,
                '⚠️ Не удалось определить администратора. Выполните /admin_login повторно.'
            );
            return;
        }

        const warehouseId = await adminService.getAdminWarehouseId(
            tempData.adminId
        );
        if (warehouseId === undefined) {
            stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
            await bot.sendMessage(
                chatId,
                '⚠️ Не удалось определить администратора. Выполните /admin_login повторно.'
            );
            return;
        }

        if (warehouseId === null) {
            await bot.sendMessage(
                chatId,
                '❌ Команда доступна только если выбран склад. Используйте /admin_set_warehouse.'
            );
            return;
        }

        const activeSessions =
            await sessionService.getActiveSessionsByWarehouse(warehouseId);

        if (!activeSessions.length) {
            await bot.sendMessage(
                chatId,
                'ℹ️ На выбранном складе сейчас нет активных сессий.'
            );
            if (currentState) {
                stateManager.setUserState(telegramId, currentState);
                await sendAdminCommandsIfNeeded(
                    chatId,
                    tempData.adminPermissionsLevel,
                    currentState
                );
            }
            return;
        }

        await bot.sendMessage(
            chatId,
            `Активные сессии выбранного склада:\n\n${formatActiveSessionsByWarehouseRows(activeSessions)}`,
            { parse_mode: 'HTML' }
        );

        if (currentState) {
            stateManager.setUserState(telegramId, currentState);
            await sendAdminCommandsIfNeeded(
                chatId,
                tempData.adminPermissionsLevel,
                currentState
            );
        }
    });
}
