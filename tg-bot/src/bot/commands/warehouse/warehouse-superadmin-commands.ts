import TelegramBot from 'node-telegram-bot-api';
import { WarehouseService } from '../../../services/warehouse.service';
import { AdminState } from '../../../constants/states.constant';
import { stateManager } from '../../state-manager';
import { isUserInAdminMode } from '../../admin/admin-mode';
import { isInAuthenticatedOrSubflow } from '../../../utils/admin-state.utils';
import { getActiveStatusText as getWarehouseStatusText } from '../../../utils/admin-status.utils';
import { escapeHtml } from '../../../utils/admin-format.utils';
import { AdminSessionData } from '../admin.types';
import {
    sendAdminCommandsIfNeeded,
    tryResolveSelectedWarehouse
} from './warehouse-command-helpers';

/** Регистрирует superadmin-команды управления складами. */
export function registerWarehouseSuperadminCommands(
    bot: TelegramBot,
    warehouseService: WarehouseService
): void {
    bot.onText(/^\/superadmin_create_warehouse(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId || !isUserInAdminMode(telegramId)) {
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

        const tempData = stateManager.getUserTempData<{ adminPermissionsLevel?: number }>(telegramId);
        const permissionsLevel = tempData?.adminPermissionsLevel ?? 0;

        if (permissionsLevel < 2) {
            await bot.sendMessage(chatId, '🚫 Нет прав на эту команду.');
            return;
        }

        stateManager.setUserState(telegramId, AdminState.CREATE_WAREHOUSE_AWAITING_NAME);
        await bot.sendMessage(chatId, 'Введите название склада');
    });

    bot.onText(/^\/superadmin_edit_warehouses(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId || !isUserInAdminMode(telegramId)) {
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
        const permissionsLevel = tempData.adminPermissionsLevel ?? 0;

        if (permissionsLevel < 2) {
            await bot.sendMessage(chatId, '🚫 Нет прав на эту команду.');
            return;
        }

        const warehouses = await warehouseService.getAllWarehouses();
        if (!warehouses.length) {
            await bot.sendMessage(chatId, '❌ Список складов пуст.');
            await sendAdminCommandsIfNeeded(
                bot,
                chatId,
                tempData.adminPermissionsLevel,
                currentState || AdminState.AUTHENTICATED
            );
            return;
        }

        const listText = warehouses
            .map(
                (w, index) =>
                    `${index + 1}. <b>${escapeHtml(w.name)}</b> - <b>${escapeHtml(w.address || '-')}</b>`
            )
            .join('\n');

        stateManager.setUserState(telegramId, AdminState.EDIT_WAREHOUSES_SELECTING);
        stateManager.setUserTempData(telegramId, {
            editWarehouses: warehouses,
            selectedWarehouseId: undefined,
            editReturnState: currentState || AdminState.AUTHENTICATED
        });

        await bot.sendMessage(
            chatId,
            `Введите номер склада, который хотите изменить:\n\n${listText}`,
            { parse_mode: 'HTML' }
        );
    });

    bot.onText(/^\/superadmin_edit_warehouse_name(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId) {
            return;
        }

        if (!isUserInAdminMode(telegramId)) {
            await bot.sendMessage(
                chatId,
                '❌ Команда недоступна без выбора склада через /superadmin_edit_warehouses.'
            );
            return;
        }

        const tempData = stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        if ((tempData.adminPermissionsLevel ?? 0) < 2) {
            await bot.sendMessage(chatId, '🚫 Нет прав на эту команду.');
            return;
        }

        const resolved = await tryResolveSelectedWarehouse(
            telegramId,
            chatId,
            bot,
            warehouseService
        );
        if (!resolved) {
            return;
        }

        stateManager.setUserState(telegramId, AdminState.EDIT_WAREHOUSE_AWAITING_NAME);
        await bot.sendMessage(chatId, 'Введите новое название склада');
    });

    bot.onText(/^\/superadmin_edit_warehouse_address(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId) {
            return;
        }

        if (!isUserInAdminMode(telegramId)) {
            await bot.sendMessage(
                chatId,
                '❌ Команда недоступна без выбора склада через /superadmin_edit_warehouses.'
            );
            return;
        }

        const tempData = stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        if ((tempData.adminPermissionsLevel ?? 0) < 2) {
            await bot.sendMessage(chatId, '🚫 Нет прав на эту команду.');
            return;
        }

        const resolved = await tryResolveSelectedWarehouse(
            telegramId,
            chatId,
            bot,
            warehouseService
        );
        if (!resolved) {
            return;
        }

        stateManager.setUserState(telegramId, AdminState.EDIT_WAREHOUSE_AWAITING_ADDRESS);
        await bot.sendMessage(chatId, 'Введите новый адрес склада');
    });

    bot.onText(/^\/superadmin_edit_warehouse_status(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId) {
            return;
        }

        if (!isUserInAdminMode(telegramId)) {
            await bot.sendMessage(
                chatId,
                '❌ Команда недоступна без выбора склада через /superadmin_edit_warehouses.'
            );
            return;
        }

        const tempData = stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        if ((tempData.adminPermissionsLevel ?? 0) < 2) {
            await bot.sendMessage(chatId, '🚫 Нет прав на эту команду.');
            return;
        }

        const resolved = await tryResolveSelectedWarehouse(
            telegramId,
            chatId,
            bot,
            warehouseService
        );
        if (!resolved) {
            return;
        }

        stateManager.setUserState(telegramId, AdminState.EDIT_WAREHOUSE_AWAITING_STATUS);
        await bot.sendMessage(
            chatId,
            `Текущий статус склада: ${getWarehouseStatusText(resolved.warehouse.is_active)}\n\nВыберите, какой статус должен быть у склада:\n1. Активный\n2. Отключен`
        );
    });

    bot.onText(/^\/superadmin_edit_warehouse_delete(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId) {
            return;
        }

        if (!isUserInAdminMode(telegramId)) {
            await bot.sendMessage(
                chatId,
                '❌ Команда недоступна без выбора склада через /superadmin_edit_warehouses.'
            );
            return;
        }

        const tempData = stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        if ((tempData.adminPermissionsLevel ?? 0) < 2) {
            await bot.sendMessage(chatId, '🚫 Нет прав на эту команду.');
            return;
        }

        const resolved = await tryResolveSelectedWarehouse(
            telegramId,
            chatId,
            bot,
            warehouseService
        );
        if (!resolved) {
            return;
        }

        stateManager.setUserState(telegramId, AdminState.EDIT_WAREHOUSE_AWAITING_DELETE_CONFIRM);
        await bot.sendMessage(chatId, 'Вы уверены, что хотите удалить склад? Введите ДА');
    });
}
