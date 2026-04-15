import TelegramBot from 'node-telegram-bot-api';
import { AdminService } from '../../../services/admin.service';
import { isUserInAdminMode } from '../../admin/admin-mode';
import { stateManager } from '../../state-manager';
import { AdminState } from '../../../constants/states.constant';
import { isInAuthenticatedOrSubflow } from '../../../utils/admin-state.utils';
import { AdminSessionData, EditableCourierSessionItem } from '../admin.types';

type SendAdminCommandsIfNeeded = (
    chatId: number,
    permLevel: number | undefined,
    state: string
) => Promise<void>;

/** Регистрирует команды выбора курьеров для admin/superadmin. */
export function registerCourierSelectionCommands(
    bot: TelegramBot,
    adminService: AdminService,
    sendAdminCommandsIfNeeded: SendAdminCommandsIfNeeded,
    loadEditableCouriersByWarehouse: (
        warehouseId: number
    ) => Promise<EditableCourierSessionItem[]>,
    loadAllEditableCouriers: () => Promise<EditableCourierSessionItem[]>,
    sendEditableCouriersListMessage: (
        chatId: number,
        couriers: EditableCourierSessionItem[]
    ) => Promise<void>
): void {
    bot.onText(/^\/admin_edit_couriers(?:@\w+)?$/, async (msg) => {
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

        const couriers = await loadEditableCouriersByWarehouse(warehouseId);
        if (!couriers.length) {
            await bot.sendMessage(
                chatId,
                '❌ Список курьеров выбранного склада пуст.'
            );
            await sendAdminCommandsIfNeeded(
                chatId,
                tempData.adminPermissionsLevel,
                currentState || AdminState.AUTHENTICATED
            );
            return;
        }

        stateManager.setUserState(
            telegramId,
            AdminState.ADMIN_EDIT_COURIERS_SELECTING
        );
        stateManager.setUserTempData(telegramId, {
            editCouriers: couriers,
            selectedEditCourierId: undefined,
            editCouriersReturnState: currentState || AdminState.AUTHENTICATED,
            editCouriersWarehouseId: warehouseId
        });

        await sendEditableCouriersListMessage(chatId, couriers);
    });

    bot.onText(/^\/superadmin_edit_couriers(?:@\w+)?$/, async (msg) => {
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
        const permissionsLevel = tempData.adminPermissionsLevel ?? 0;
        if (permissionsLevel < 2) {
            await bot.sendMessage(chatId, '🚫 Нет прав на эту команду.');
            return;
        }

        const couriers = await loadAllEditableCouriers();
        if (!couriers.length) {
            await bot.sendMessage(chatId, '❌ Список курьеров пуст.');
            await sendAdminCommandsIfNeeded(
                chatId,
                tempData.adminPermissionsLevel,
                currentState || AdminState.AUTHENTICATED
            );
            return;
        }

        stateManager.setUserState(
            telegramId,
            AdminState.SUPERADMIN_EDIT_COURIERS_SELECTING
        );
        stateManager.setUserTempData(telegramId, {
            editCouriers: couriers,
            selectedEditCourierId: undefined,
            editCouriersReturnState: currentState || AdminState.AUTHENTICATED,
            editCouriersWarehouseId: undefined
        });

        await sendEditableCouriersListMessage(chatId, couriers);
    });
}
