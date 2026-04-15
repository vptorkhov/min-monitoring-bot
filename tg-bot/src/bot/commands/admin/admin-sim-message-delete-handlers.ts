import TelegramBot from 'node-telegram-bot-api';
import { stateManager } from '../../state-manager';
import { AdminState } from '../../../constants/states.constant';
import { AdminSessionData, SimInteractionSessionItem } from '../admin.types';

type SendAdminCommandsIfNeeded = (
    chatId: number,
    adminPermissionsLevel: number | undefined,
    state: string
) => Promise<void>;

type LoadWarehouseSimDevices = (
    warehouseId: number
) => Promise<SimInteractionSessionItem[]>;

type SendSimSelectionMessage = (
    chatId: number,
    devices: SimInteractionSessionItem[]
) => Promise<void>;

type TryResolveSelectedSimDevice = (
    telegramId: number,
    chatId: number
) => Promise<{
    tempData: AdminSessionData;
    device: SimInteractionSessionItem;
} | null>;

type SendSimActionsMessage = (
    chatId: number,
    device: SimInteractionSessionItem
) => Promise<void>;

type DeleteDeviceRepo = {
    hasActiveByDevice: (deviceId: number) => Promise<boolean>;
    deleteByIdWithSessions: (deviceId: number) => Promise<{
        blockedByActiveSession: boolean;
        deleted: boolean;
    }>;
};

/** Обрабатывает удаление SIM в admin-flow. */
export async function handleSimDeleteMessage(
    bot: TelegramBot,
    deleteDeviceRepo: DeleteDeviceRepo,
    telegramId: number,
    chatId: number,
    text: string,
    currentState: string | undefined,
    sendAdminCommandsIfNeeded: SendAdminCommandsIfNeeded,
    loadWarehouseSimDevices: LoadWarehouseSimDevices,
    sendSimSelectionMessage: SendSimSelectionMessage,
    tryResolveSelectedSimDevice: TryResolveSelectedSimDevice,
    sendSimActionsMessage: SendSimActionsMessage
): Promise<boolean> {
    if (currentState !== AdminState.SIM_INTERACTION_AWAITING_DELETE_CONFIRM) {
        return false;
    }

    if (text.trim() !== 'ДА') {
        await bot.sendMessage(chatId, '❌ Для удаления СИМ введите строго ДА.');
        return true;
    }

    const resolved = await tryResolveSelectedSimDevice(telegramId, chatId);
    if (!resolved) {
        return true;
    }

    const hasActiveSession = await deleteDeviceRepo.hasActiveByDevice(
        resolved.device.id
    );
    if (hasActiveSession) {
        stateManager.setUserState(telegramId, AdminState.SIM_INTERACTION_ACTION_SELECTING);
        await bot.sendMessage(
            chatId,
            '❌ Невозможно удалить СИМ, пока по нему есть активная сессия.'
        );
        await sendSimActionsMessage(chatId, resolved.device);
        return true;
    }

    const deleteResult = await deleteDeviceRepo.deleteByIdWithSessions(
        resolved.device.id
    );
    if (deleteResult.blockedByActiveSession) {
        stateManager.setUserState(telegramId, AdminState.SIM_INTERACTION_ACTION_SELECTING);
        await bot.sendMessage(
            chatId,
            '❌ Невозможно удалить СИМ: по нему есть активная сессия.'
        );
        await sendSimActionsMessage(chatId, resolved.device);
        return true;
    }

    if (!deleteResult.deleted) {
        await bot.sendMessage(chatId, '❌ Не удалось удалить СИМ. Попробуйте позже.');
        return true;
    }

    const tempData = stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    const warehouseId = tempData.simInteractionWarehouseId;

    if (!warehouseId) {
        stateManager.setUserState(telegramId, AdminState.AUTHENTICATED_WITH_WAREHOUSE);
        stateManager.resetUserTempData(telegramId);
        if (tempData.adminId && tempData.adminPermissionsLevel) {
            stateManager.setUserTempData(telegramId, {
                adminId: tempData.adminId,
                adminPermissionsLevel: tempData.adminPermissionsLevel
            });
        }

        await bot.sendMessage(chatId, '✅ СИМ удален. Контекст выбора СИМ сброшен.');
        await sendAdminCommandsIfNeeded(
            chatId,
            tempData.adminPermissionsLevel,
            AdminState.AUTHENTICATED_WITH_WAREHOUSE
        );
        return true;
    }

    const refreshedDevices = await loadWarehouseSimDevices(warehouseId);
    if (!refreshedDevices.length) {
        stateManager.setUserState(telegramId, AdminState.AUTHENTICATED_WITH_WAREHOUSE);
        stateManager.resetUserTempData(telegramId);
        if (tempData.adminId && tempData.adminPermissionsLevel) {
            stateManager.setUserTempData(telegramId, {
                adminId: tempData.adminId,
                adminPermissionsLevel: tempData.adminPermissionsLevel
            });
        }

        await bot.sendMessage(
            chatId,
            '✅ СИМ удален. Список СИМ пуст, вы возвращены в состояние выбранного склада.'
        );
        await sendAdminCommandsIfNeeded(
            chatId,
            tempData.adminPermissionsLevel,
            AdminState.AUTHENTICATED_WITH_WAREHOUSE
        );
        return true;
    }

    stateManager.setUserState(telegramId, AdminState.SIM_INTERACTIONS_SELECTING);
    stateManager.setUserTempData(telegramId, {
        simInteractionDevices: refreshedDevices,
        selectedSimInteractionDeviceId: undefined
    });

    await bot.sendMessage(chatId, '✅ СИМ успешно удален.');
    await sendSimSelectionMessage(chatId, refreshedDevices);
    return true;
}
