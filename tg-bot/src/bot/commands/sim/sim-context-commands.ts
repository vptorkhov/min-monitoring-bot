import TelegramBot from 'node-telegram-bot-api';
import { AdminService } from '../../../services/admin.service';
import { isUserInAdminMode } from '../../admin/admin-mode';
import { stateManager } from '../../state-manager';
import { AdminState } from '../../../constants/states.constant';
import { isInAuthenticatedOrSubflow } from '../../../utils/admin-state.utils';
import { AdminSessionData, SimInteractionSessionItem } from '../admin.types';

type SendAdminCommandsIfNeeded = (
    chatId: number,
    permLevel: number | undefined,
    state: string
) => Promise<void>;

type LoadWarehouseSimDevices = (
    warehouseId: number
) => Promise<SimInteractionSessionItem[]>;

type SendSimSelectionMessage = (
    chatId: number,
    devices: SimInteractionSessionItem[]
) => Promise<void>;

/** Регистрирует context-команды SIM для выбора даты и списка SIM. */
export function registerSimContextCommands(
    bot: TelegramBot,
    adminService: AdminService,
    sendAdminCommandsIfNeeded: SendAdminCommandsIfNeeded,
    loadWarehouseSimDevices: LoadWarehouseSimDevices,
    sendSimSelectionMessage: SendSimSelectionMessage
): void {
    bot.onText(/^\/admin_sessions_history(?:@\w+)?$/, async (msg) => {
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
            AdminState.ADMIN_SESSIONS_HISTORY_AWAITING_DATE
        );
        stateManager.setUserTempData(telegramId, {
            sessionsHistoryReturnState:
                currentState || AdminState.AUTHENTICATED,
            sessionsHistoryWarehouseId: warehouseId
        });

        await bot.sendMessage(
            chatId,
            'Введите дату в формате ДД.ММ.ГГГГ для просмотра истории сессий'
        );
    });

    bot.onText(/^\/admin_sim_interactions(?:@\w+)?$/, async (msg) => {
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

        const devices = await loadWarehouseSimDevices(warehouseId);
        if (!devices.length) {
            stateManager.setUserState(
                telegramId,
                AdminState.AUTHENTICATED_WITH_WAREHOUSE
            );
            stateManager.resetUserTempData(telegramId);
            stateManager.setUserTempData(telegramId, {
                adminId: tempData.adminId,
                adminPermissionsLevel: tempData.adminPermissionsLevel
            });

            await bot.sendMessage(
                chatId,
                '❌ Список СИМ пуст. Вы возвращены в состояние выбранного склада.'
            );
            await sendAdminCommandsIfNeeded(
                chatId,
                tempData.adminPermissionsLevel,
                AdminState.AUTHENTICATED_WITH_WAREHOUSE
            );
            return;
        }

        stateManager.setUserState(
            telegramId,
            AdminState.SIM_INTERACTIONS_SELECTING
        );
        stateManager.setUserTempData(telegramId, {
            simInteractionWarehouseId: warehouseId,
            simInteractionDevices: devices,
            selectedSimInteractionDeviceId: undefined
        });

        await sendSimSelectionMessage(chatId, devices);
    });
}
