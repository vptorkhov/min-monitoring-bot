import TelegramBot from 'node-telegram-bot-api';
import { WarehouseService } from '../../../services/warehouse.service';
import {
    getActiveStatusText as getWarehouseStatusText,
    parseActiveStatusInput as parseWarehouseStatusInput
} from '../../../utils/admin-status.utils';
import { escapeHtml } from '../../../utils/admin-format.utils';
import { stateManager } from '../../state-manager';
import { AdminState } from '../../../constants/states.constant';
import { AdminSessionData } from '../admin.types';
import { Warehouse } from '../../../repositories/types/warehouse.type';
import { handleWarehouseDeleteMessage } from './admin-warehouse-message-delete-handlers';

type SendAdminCommandsIfNeeded = (
    chatId: number,
    adminPermissionsLevel: number | undefined,
    state: string
) => Promise<void>;

type RestoreToAuthenticatedWithAdminContext = (
    telegramId: number,
    tempData: AdminSessionData,
    targetState?: string
) => string;

type SendWarehouseActionsMessage = (
    chatId: number,
    warehouse: Warehouse
) => Promise<void>;

/** Обрабатывает состояния редактирования склада в admin-flow. */
export async function handleWarehouseEditMessage(
    bot: TelegramBot,
    warehouseService: WarehouseService,
    telegramId: number,
    chatId: number,
    text: string,
    currentState: string | undefined,
    sendAdminCommandsIfNeeded: SendAdminCommandsIfNeeded,
    restoreToAuthenticatedWithAdminContext: RestoreToAuthenticatedWithAdminContext,
    sendWarehouseActionsMessage: SendWarehouseActionsMessage
): Promise<boolean> {
    if (currentState === AdminState.EDIT_WAREHOUSES_SELECTING) {
        const tempData =
            stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        const warehouses = tempData.editWarehouses;

        if (!warehouses?.length) {
            const restoredState = restoreToAuthenticatedWithAdminContext(
                telegramId,
                tempData
            );
            await bot.sendMessage(
                chatId,
                '❌ Что-то пошло не так. Запустите /superadmin_edit_warehouses заново.'
            );
            await sendAdminCommandsIfNeeded(
                chatId,
                tempData.adminPermissionsLevel,
                restoredState
            );
            return true;
        }

        if (!/^\d+$/.test(text.trim())) {
            await bot.sendMessage(
                chatId,
                '❌ Введите корректный номер склада из списка.'
            );
            return true;
        }

        const index = parseInt(text.trim(), 10) - 1;
        if (index < 0 || index >= warehouses.length) {
            await bot.sendMessage(
                chatId,
                '❌ Склад с таким номером не найден. Введите номер из списка.'
            );
            return true;
        }

        const selectedWarehouse = warehouses[index];
        stateManager.setUserState(
            telegramId,
            AdminState.EDIT_WAREHOUSE_ACTION_SELECTING
        );
        stateManager.setUserTempData(telegramId, {
            selectedWarehouseId: selectedWarehouse.id
        });

        await sendWarehouseActionsMessage(chatId, selectedWarehouse);
        return true;
    }

    if (currentState === AdminState.EDIT_WAREHOUSE_ACTION_SELECTING) {
        await bot.sendMessage(
            chatId,
            'ℹ️ Выберите действие командой: /superadmin_edit_warehouse_name, /superadmin_edit_warehouse_address, /superadmin_edit_warehouse_status или /superadmin_edit_warehouse_delete.'
        );
        return true;
    }

    if (currentState === AdminState.EDIT_WAREHOUSE_AWAITING_NAME) {
        const nameInput = text.trim();
        if (nameInput.length < 2) {
            await bot.sendMessage(
                chatId,
                '❌ Название должно содержать минимум 2 символа.\n\nВведите новое название склада'
            );
            return true;
        }

        const tempData =
            stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        const selectedWarehouseId = tempData.selectedWarehouseId;
        if (!selectedWarehouseId) {
            const fallbackState =
                tempData.editReturnState || AdminState.AUTHENTICATED;
            stateManager.setUserState(telegramId, fallbackState);
            await bot.sendMessage(
                chatId,
                '❌ Команда недоступна без выбора склада через /superadmin_edit_warehouses.'
            );
            return true;
        }

        const updated = await warehouseService.updateWarehouseName(
            selectedWarehouseId,
            nameInput
        );
        if (!updated) {
            const fallbackState =
                tempData.editReturnState || AdminState.AUTHENTICATED;
            stateManager.setUserState(telegramId, fallbackState);
            await bot.sendMessage(
                chatId,
                '❌ Склад не найден. Запустите /superadmin_edit_warehouses заново.'
            );
            return true;
        }

        stateManager.setUserState(
            telegramId,
            AdminState.EDIT_WAREHOUSE_ACTION_SELECTING
        );
        await bot.sendMessage(
            chatId,
            `✅ Название склада изменено на <b>${escapeHtml(updated.name)}</b>`,
            { parse_mode: 'HTML' }
        );
        await sendWarehouseActionsMessage(chatId, updated);
        return true;
    }

    if (currentState === AdminState.EDIT_WAREHOUSE_AWAITING_ADDRESS) {
        const addressInput = text.trim();
        if (addressInput.length < 2) {
            await bot.sendMessage(
                chatId,
                '❌ Адрес должен содержать минимум 2 символа.\n\nВведите новый адрес склада'
            );
            return true;
        }

        const tempData =
            stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        const selectedWarehouseId = tempData.selectedWarehouseId;
        if (!selectedWarehouseId) {
            const fallbackState =
                tempData.editReturnState || AdminState.AUTHENTICATED;
            stateManager.setUserState(telegramId, fallbackState);
            await bot.sendMessage(
                chatId,
                '❌ Команда недоступна без выбора склада через /superadmin_edit_warehouses.'
            );
            return true;
        }

        const updated = await warehouseService.updateWarehouseAddress(
            selectedWarehouseId,
            addressInput
        );
        if (!updated) {
            const fallbackState =
                tempData.editReturnState || AdminState.AUTHENTICATED;
            stateManager.setUserState(telegramId, fallbackState);
            await bot.sendMessage(
                chatId,
                '❌ Склад не найден. Запустите /superadmin_edit_warehouses заново.'
            );
            return true;
        }

        stateManager.setUserState(
            telegramId,
            AdminState.EDIT_WAREHOUSE_ACTION_SELECTING
        );
        await bot.sendMessage(
            chatId,
            `✅ Адрес склада изменен на <b>${escapeHtml(updated.address || '-')}</b>`,
            { parse_mode: 'HTML' }
        );
        await sendWarehouseActionsMessage(chatId, updated);
        return true;
    }

    if (currentState === AdminState.EDIT_WAREHOUSE_AWAITING_STATUS) {
        const status = parseWarehouseStatusInput(text);
        if (status === null) {
            await bot.sendMessage(
                chatId,
                '❌ Некорректный выбор статуса. Введите 1 (Активный) или 2 (Отключен).'
            );
            return true;
        }

        const tempData =
            stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        const selectedWarehouseId = tempData.selectedWarehouseId;
        if (!selectedWarehouseId) {
            const fallbackState =
                tempData.editReturnState || AdminState.AUTHENTICATED;
            stateManager.setUserState(telegramId, fallbackState);
            await bot.sendMessage(
                chatId,
                '❌ Команда недоступна без выбора склада через /superadmin_edit_warehouses.'
            );
            return true;
        }

        if (!status) {
            const hasActiveSessions =
                await warehouseService.hasActiveSessionsByWarehouseId(
                    selectedWarehouseId
                );
            if (hasActiveSessions) {
                await bot.sendMessage(
                    chatId,
                    '❌ Нельзя отключить склад: по нему есть активные сессии. Завершите сессии и повторите попытку.'
                );
                return true;
            }
        }

        const updated = await warehouseService.updateWarehouseStatus(
            selectedWarehouseId,
            status
        );
        if (!updated) {
            const fallbackState =
                tempData.editReturnState || AdminState.AUTHENTICATED;
            stateManager.setUserState(telegramId, fallbackState);
            await bot.sendMessage(
                chatId,
                '❌ Склад не найден. Запустите /superadmin_edit_warehouses заново.'
            );
            return true;
        }

        stateManager.setUserState(
            telegramId,
            AdminState.EDIT_WAREHOUSE_ACTION_SELECTING
        );
        await bot.sendMessage(
            chatId,
            `✅ Статус склада изменен на <b>${getWarehouseStatusText(updated.is_active)}</b>`,
            { parse_mode: 'HTML' }
        );
        await sendWarehouseActionsMessage(chatId, updated);
        return true;
    }

    return handleWarehouseDeleteMessage(
        bot,
        warehouseService,
        telegramId,
        chatId,
        text,
        currentState
    );
}
