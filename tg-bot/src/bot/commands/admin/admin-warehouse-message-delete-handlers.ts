import TelegramBot from 'node-telegram-bot-api';
import { WarehouseService } from '../../../services/warehouse.service';
import { stateManager } from '../../state-manager';
import { AdminState } from '../../../constants/states.constant';
import { AdminSessionData } from '../admin.types';

/** Обрабатывает удаление склада в admin-flow. */
export async function handleWarehouseDeleteMessage(
    bot: TelegramBot,
    warehouseService: WarehouseService,
    telegramId: number,
    chatId: number,
    text: string,
    currentState: string | undefined
): Promise<boolean> {
    if (currentState !== AdminState.EDIT_WAREHOUSE_AWAITING_DELETE_CONFIRM) {
        return false;
    }

    const tempData = stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    const selectedWarehouseId = tempData.selectedWarehouseId;
    const fallbackState = tempData.editReturnState || AdminState.AUTHENTICATED;

    if (text.trim() !== 'ДА') {
        await bot.sendMessage(chatId, '❌ Для удаления склада введите строго ДА.');
        return true;
    }

    if (!selectedWarehouseId) {
        stateManager.setUserState(telegramId, fallbackState);
        await bot.sendMessage(
            chatId,
            '❌ Команда недоступна без выбора склада через /superadmin_edit_warehouses.'
        );
        return true;
    }

    const deleteResult = await warehouseService.deleteWarehouse(selectedWarehouseId);
    if (!deleteResult.success) {
        await bot.sendMessage(
            chatId,
            `❌ ${deleteResult.reason || 'Не удалось удалить склад.'}`
        );
        return true;
    }

    stateManager.setUserState(telegramId, fallbackState);
    stateManager.resetUserTempData(telegramId);
    if (tempData.adminId && tempData.adminPermissionsLevel) {
        stateManager.setUserTempData(telegramId, {
            adminId: tempData.adminId,
            adminPermissionsLevel: tempData.adminPermissionsLevel
        });
    }

    await bot.sendMessage(chatId, '✅ Склад успешно удален.');
    return true;
}
