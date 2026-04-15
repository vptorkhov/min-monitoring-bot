import TelegramBot from 'node-telegram-bot-api';
import { MobilityDeviceRepository } from '../../../repositories/mobility-device.repository';
import { stateManager } from '../../state-manager';
import { AdminState } from '../../../constants/states.constant';
import {
    getAdminCommandListMessage,
    isAuthenticatedAdminState
} from '../../admin/admin-command-hints';
import {
    isAddSimFlowState,
    isSessionsHistoryDateState,
    isSimInteractionsSelectingState,
    isSimInteractionSubflowState
} from '../../../utils/cancel-admin-state.utils';
import { formatSimSelectionPlainList } from '../../../utils/admin-selection-format.utils';

interface SimFlowsDeps {
    bot: TelegramBot;
    chatId: number;
    userId: number;
    currentState: string;
    mobilityDeviceRepository: MobilityDeviceRepository;
}

async function sendAdminCommandsIfNeeded(
    bot: TelegramBot,
    chatId: number,
    adminPermissionsLevel: number | undefined,
    targetState: string | undefined
): Promise<void> {
    if (!adminPermissionsLevel || !isAuthenticatedAdminState(targetState)) {
        return;
    }

    await bot.sendMessage(
        chatId,
        getAdminCommandListMessage(
            adminPermissionsLevel,
            targetState === AdminState.AUTHENTICATED_WITH_WAREHOUSE
        )
    );
}

export async function handleCancelSimFlows(deps: SimFlowsDeps): Promise<boolean> {
    const { bot, chatId, userId, currentState, mobilityDeviceRepository } = deps;

    if (isAddSimFlowState(currentState)) {
        const tempData = stateManager.getUserTempData<{
            adminId?: number;
            adminPermissionsLevel?: number;
        }>(userId);

        const adminId = tempData?.adminId;
        const adminPermissionsLevel = tempData?.adminPermissionsLevel;

        stateManager.setUserState(userId, AdminState.AUTHENTICATED_WITH_WAREHOUSE);
        stateManager.resetUserTempData(userId);
        if (adminId && adminPermissionsLevel) {
            stateManager.setUserTempData(userId, { adminId, adminPermissionsLevel });
        }

        await bot.sendMessage(chatId, '❌ Добавление СИМ отменено. Вы возвращены в авторизованный админ-режим.');
        await sendAdminCommandsIfNeeded(
            bot,
            chatId,
            adminPermissionsLevel,
            AdminState.AUTHENTICATED_WITH_WAREHOUSE
        );
        return true;
    }

    if (isSessionsHistoryDateState(currentState)) {
        const tempData = stateManager.getUserTempData<{
            adminId?: number;
            adminPermissionsLevel?: number;
            sessionsHistoryReturnState?: string;
        }>(userId);

        const adminId = tempData?.adminId;
        const adminPermissionsLevel = tempData?.adminPermissionsLevel;
        const returnState = tempData?.sessionsHistoryReturnState || AdminState.AUTHENTICATED;

        stateManager.setUserState(userId, returnState);
        stateManager.resetUserTempData(userId);
        if (adminId && adminPermissionsLevel) {
            stateManager.setUserTempData(userId, { adminId, adminPermissionsLevel });
        }

        await bot.sendMessage(chatId, '❌ Просмотр истории сессий отменен. Вы возвращены в предыдущее состояние.');
        await sendAdminCommandsIfNeeded(bot, chatId, adminPermissionsLevel, returnState);
        return true;
    }

    if (isSimInteractionsSelectingState(currentState)) {
        const tempData = stateManager.getUserTempData<{
            adminId?: number;
            adminPermissionsLevel?: number;
        }>(userId);

        const adminId = tempData?.adminId;
        const adminPermissionsLevel = tempData?.adminPermissionsLevel;

        stateManager.setUserState(userId, AdminState.AUTHENTICATED_WITH_WAREHOUSE);
        stateManager.resetUserTempData(userId);
        if (adminId && adminPermissionsLevel) {
            stateManager.setUserTempData(userId, { adminId, adminPermissionsLevel });
        }

        await bot.sendMessage(chatId, '❌ Взаимодействие с СИМ отменено. Вы возвращены в состояние выбранного склада.');
        await sendAdminCommandsIfNeeded(
            bot,
            chatId,
            adminPermissionsLevel,
            AdminState.AUTHENTICATED_WITH_WAREHOUSE
        );
        return true;
    }

    if (isSimInteractionSubflowState(currentState)) {
        const tempData = stateManager.getUserTempData<{
            adminId?: number;
            adminPermissionsLevel?: number;
            simInteractionWarehouseId?: number;
        }>(userId);

        const warehouseId = tempData?.simInteractionWarehouseId;
        if (!warehouseId) {
            stateManager.setUserState(userId, AdminState.AUTHENTICATED_WITH_WAREHOUSE);
            stateManager.resetUserTempData(userId);
            if (tempData?.adminId && tempData?.adminPermissionsLevel) {
                stateManager.setUserTempData(userId, {
                    adminId: tempData.adminId,
                    adminPermissionsLevel: tempData.adminPermissionsLevel
                });
            }

            await bot.sendMessage(chatId, '❌ Действие отменено. Контекст выбора СИМ сброшен, вы возвращены в состояние выбранного склада.');
            await sendAdminCommandsIfNeeded(
                bot,
                chatId,
                tempData?.adminPermissionsLevel,
                AdminState.AUTHENTICATED_WITH_WAREHOUSE
            );
            return true;
        }

        const refreshedDevices = (
            await mobilityDeviceRepository.getDevicesForWarehouseWithoutPersonal(warehouseId)
        )
            .filter((device) => !!device.device_number)
            .map((device) => ({
                id: device.id,
                deviceNumber: (device.device_number || '').toUpperCase(),
                isActive: device.is_active,
                status: device.status
            }));

        if (!refreshedDevices.length) {
            stateManager.setUserState(userId, AdminState.AUTHENTICATED_WITH_WAREHOUSE);
            stateManager.resetUserTempData(userId);
            if (tempData?.adminId && tempData?.adminPermissionsLevel) {
                stateManager.setUserTempData(userId, {
                    adminId: tempData.adminId,
                    adminPermissionsLevel: tempData.adminPermissionsLevel
                });
            }

            await bot.sendMessage(chatId, '❌ Действие отменено. Список СИМ пуст, вы возвращены в состояние выбранного склада.');
            await sendAdminCommandsIfNeeded(
                bot,
                chatId,
                tempData?.adminPermissionsLevel,
                AdminState.AUTHENTICATED_WITH_WAREHOUSE
            );
            return true;
        }

        stateManager.setUserState(userId, AdminState.SIM_INTERACTIONS_SELECTING);
        stateManager.resetUserTempData(userId);
        stateManager.setUserTempData(userId, {
            adminId: tempData?.adminId,
            adminPermissionsLevel: tempData?.adminPermissionsLevel,
            simInteractionWarehouseId: warehouseId,
            simInteractionDevices: refreshedDevices,
            selectedSimInteractionDeviceId: undefined
        });

        const simList = formatSimSelectionPlainList(refreshedDevices);
        await bot.sendMessage(
            chatId,
            `❌ Действие отменено. Вы возвращены к списку СИМ.\n\nВведите номер СИМ:\n\n${simList}`
        );
        return true;
    }

    return false;
}
