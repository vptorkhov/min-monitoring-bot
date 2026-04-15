import TelegramBot from 'node-telegram-bot-api';
import { AdminService } from '../../../services/admin.service';
import { WarehouseService } from '../../../services/warehouse.service';
import { AdminState } from '../../../constants/states.constant';
import { stateManager } from '../../state-manager';
import { isUserInAdminMode } from '../../admin/admin-mode';
import { isInAuthenticatedOrSubflow } from '../../../utils/admin-state.utils';
import { getAuthenticatedAdminWelcomeMessage } from '../admin/admin-flow.utils';
import { formatWarehouseListForAdminSelection } from '../../../utils/admin-selection-format.utils';
import { AdminSessionData } from '../admin.types';
import { sendAdminCommandsIfNeeded } from './warehouse-command-helpers';

/** Регистрирует команды выбора/очистки склада для admin-flow. */
export function registerWarehouseContextCommands(
    bot: TelegramBot,
    adminService: AdminService,
    warehouseService: WarehouseService
): void {
    bot.onText(/^\/admin_set_warehouse(?:@\w+)?$/, async (msg) => {
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

        const tempData = stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        if (!tempData.adminId || !tempData.adminPermissionsLevel) {
            stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
            await bot.sendMessage(
                chatId,
                '⚠️ Не удалось определить администратора. Выполните /admin_login повторно.'
            );
            return;
        }

        const warehouses = await warehouseService.getActiveWarehouses();
        if (!warehouses.length) {
            await bot.sendMessage(chatId, '❌ Список активных складов пуст.');
            await sendAdminCommandsIfNeeded(
                bot,
                chatId,
                tempData.adminPermissionsLevel,
                currentState || AdminState.AUTHENTICATED
            );
            return;
        }

        const returnState =
            currentState === AdminState.SET_WAREHOUSE_SELECTING
                ? tempData.adminSetReturnState || AdminState.AUTHENTICATED
                : currentState || AdminState.AUTHENTICATED;

        stateManager.setUserState(telegramId, AdminState.SET_WAREHOUSE_SELECTING);
        stateManager.setUserTempData(telegramId, {
            adminSetWarehouses: warehouses,
            adminSetReturnState: returnState
        });

        await bot.sendMessage(
            chatId,
            `Выберите номер склада:\n\n${formatWarehouseListForAdminSelection(warehouses)}`,
            { parse_mode: 'HTML' }
        );
    });

    bot.onText(/^\/admin_clear_warehouse(?:@\w+)?$/, async (msg) => {
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

        const tempData = stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        if (!tempData.adminId || !tempData.adminPermissionsLevel) {
            stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
            await bot.sendMessage(
                chatId,
                '⚠️ Не удалось определить администратора. Выполните /admin_login повторно.'
            );
            return;
        }

        const currentWarehouseId = await adminService.getAdminWarehouseId(tempData.adminId);
        if (currentWarehouseId === undefined) {
            stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
            await bot.sendMessage(
                chatId,
                '⚠️ Не удалось определить администратора. Выполните /admin_login повторно.'
            );
            return;
        }

        if (currentWarehouseId === null) {
            await bot.sendMessage(
                chatId,
                '❌ Команда доступна только если склад уже выбран. Используйте /admin_set_warehouse.'
            );
            return;
        }

        const clearResult = await adminService.clearAdminWarehouse(tempData.adminId);
        if (!clearResult.success) {
            await bot.sendMessage(
                chatId,
                `❌ ${clearResult.reason || 'Не удалось отвязаться от склада.'}`
            );
            return;
        }

        stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
        stateManager.resetUserTempData(telegramId);
        stateManager.setUserTempData(telegramId, {
            adminId: tempData.adminId,
            adminPermissionsLevel: tempData.adminPermissionsLevel
        });

        await bot.sendMessage(chatId, '✅ Вы успешно отвязались от склада.');
        await bot.sendMessage(
            chatId,
            getAuthenticatedAdminWelcomeMessage(tempData.adminPermissionsLevel, false)
        );
    });
}
