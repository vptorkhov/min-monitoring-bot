import TelegramBot from 'node-telegram-bot-api';
import { AdminState } from '../../../constants/states.constant';
import { Warehouse } from '../../../repositories/types/warehouse.type';
import { WarehouseService } from '../../../services/warehouse.service';
import { stateManager } from '../../state-manager';
import {
    getAdminCommandListMessage,
    isAuthenticatedAdminState
} from '../../admin/admin-command-hints';
import { AdminSessionData } from '../admin.types';

/** Отправляет список admin-команд, если состояние допускает показ. */
export async function sendAdminCommandsIfNeeded(
    bot: TelegramBot,
    chatId: number,
    adminPermissionsLevel: number | undefined,
    state: string
): Promise<void> {
    if (!adminPermissionsLevel || !isAuthenticatedAdminState(state)) {
        return;
    }

    await bot.sendMessage(
        chatId,
        getAdminCommandListMessage(
            adminPermissionsLevel,
            state === AdminState.AUTHENTICATED_WITH_WAREHOUSE
        )
    );
}

/** Возвращает выбранный склад из состояния редактирования superadmin. */
export async function tryResolveSelectedWarehouse(
    telegramId: number,
    chatId: number,
    bot: TelegramBot,
    warehouseService: WarehouseService
): Promise<{ tempData: AdminSessionData; warehouse: Warehouse } | null> {
    const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    const selectedWarehouseId = tempData.selectedWarehouseId;

    if (!selectedWarehouseId) {
        await bot.sendMessage(
            chatId,
            '❌ Команда недоступна без выбора склада через /superadmin_edit_warehouses.'
        );
        return null;
    }

    const warehouse = await warehouseService.getWarehouseById(selectedWarehouseId);
    if (!warehouse) {
        await bot.sendMessage(
            chatId,
            '❌ Выбранный склад не найден. Запустите /superadmin_edit_warehouses заново.'
        );
        return null;
    }

    return { tempData, warehouse };
}
