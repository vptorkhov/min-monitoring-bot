import TelegramBot from 'node-telegram-bot-api';
import { SessionRepository } from '../../../repositories/session.repository';
import { MobilityDeviceRepository } from '../../../repositories/mobility-device.repository';
import {
    getActiveStatusText as getSimActiveStatusText,
    getSimConditionStatusText,
    parseActiveStatusInput as parseSimActiveStatusInput,
    parseSimConditionStatusInput
} from '../../../utils/admin-status.utils';
import { stateManager } from '../../state-manager';
import { AdminState } from '../../../constants/states.constant';
import { AdminSessionData, SimInteractionSessionItem } from '../admin.types';

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

/** Обрабатывает состояния смены статусов SIM в admin-flow. */
export async function handleSimStatusMessage(
    bot: TelegramBot,
    mobilityDeviceRepository: MobilityDeviceRepository,
    sessionRepository: SessionRepository,
    telegramId: number,
    chatId: number,
    text: string,
    currentState: string | undefined,
    tryResolveSelectedSimDevice: TryResolveSelectedSimDevice,
    sendSimActionsMessage: SendSimActionsMessage
): Promise<boolean> {
    if (currentState === AdminState.SIM_INTERACTION_AWAITING_ACTIVE_STATUS) {
        const nextStatus = parseSimActiveStatusInput(text);
        if (nextStatus === null) {
            await bot.sendMessage(
                chatId,
                '❌ Некорректный выбор статуса. Введите 1 (Активный) или 2 (Отключен).'
            );
            return true;
        }

        const resolved = await tryResolveSelectedSimDevice(telegramId, chatId);
        if (!resolved) {
            return true;
        }

        const hasActiveSession = await sessionRepository.hasActiveByDevice(
            resolved.device.id
        );
        if (hasActiveSession) {
            stateManager.setUserState(
                telegramId,
                AdminState.SIM_INTERACTION_ACTION_SELECTING
            );
            await bot.sendMessage(
                chatId,
                '❌ Невозможно изменить статус активности: по СИМ есть активная сессия.'
            );
            await sendSimActionsMessage(chatId, resolved.device);
            return true;
        }

        const updated = await mobilityDeviceRepository.updateActiveById(
            resolved.device.id,
            nextStatus
        );
        if (!updated) {
            await bot.sendMessage(
                chatId,
                '❌ Не удалось изменить статус активности СИМ.'
            );
            return true;
        }

        const refreshed = await mobilityDeviceRepository.findById(
            resolved.device.id
        );
        if (!refreshed || !refreshed.device_number) {
            await bot.sendMessage(
                chatId,
                '❌ СИМ не найден. Запустите /admin_sim_interactions заново.'
            );
            return true;
        }

        const refreshedDevice: SimInteractionSessionItem = {
            id: refreshed.id,
            deviceNumber: refreshed.device_number.toUpperCase(),
            isActive: refreshed.is_active,
            status: refreshed.status
        };
        const tempData =
            stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        const updatedList = (tempData.simInteractionDevices || []).map(
            (device) =>
                device.id === refreshedDevice.id ? refreshedDevice : device
        );

        stateManager.setUserState(
            telegramId,
            AdminState.SIM_INTERACTION_ACTION_SELECTING
        );
        stateManager.setUserTempData(telegramId, {
            simInteractionDevices: updatedList
        });

        await bot.sendMessage(
            chatId,
            `✅ Статус активности СИМ изменен на <b>${getSimActiveStatusText(refreshedDevice.isActive)}</b>.`,
            { parse_mode: 'HTML' }
        );
        await sendSimActionsMessage(chatId, refreshedDevice);
        return true;
    }

    if (currentState !== AdminState.SIM_INTERACTION_AWAITING_CONDITION_STATUS) {
        return false;
    }

    const nextStatus = parseSimConditionStatusInput(text);
    if (nextStatus === null) {
        await bot.sendMessage(
            chatId,
            '❌ Некорректный выбор статуса. Введите 1 (Исправен), 2 (Поврежден) или 3 (Сломан).'
        );
        return true;
    }

    const resolved = await tryResolveSelectedSimDevice(telegramId, chatId);
    if (!resolved) {
        return true;
    }

    const hasActiveSession = await sessionRepository.hasActiveByDevice(
        resolved.device.id
    );
    if (hasActiveSession) {
        stateManager.setUserState(
            telegramId,
            AdminState.SIM_INTERACTION_ACTION_SELECTING
        );
        await bot.sendMessage(
            chatId,
            '❌ Невозможно изменить статус исправности: по СИМ есть активная сессия.'
        );
        await sendSimActionsMessage(chatId, resolved.device);
        return true;
    }

    const updated = await mobilityDeviceRepository.updateConditionStatusById(
        resolved.device.id,
        nextStatus
    );
    if (!updated) {
        await bot.sendMessage(
            chatId,
            '❌ Не удалось изменить статус исправности СИМ.'
        );
        return true;
    }

    if (nextStatus === 'broken') {
        const deactivated = await mobilityDeviceRepository.updateActiveById(
            resolved.device.id,
            false
        );
        if (!deactivated) {
            await bot.sendMessage(
                chatId,
                '❌ Не удалось отключить СИМ после установки статуса Сломан.'
            );
            return true;
        }
    }

    const refreshed = await mobilityDeviceRepository.findById(
        resolved.device.id
    );
    if (!refreshed || !refreshed.device_number) {
        await bot.sendMessage(
            chatId,
            '❌ СИМ не найден. Запустите /admin_sim_interactions заново.'
        );
        return true;
    }

    const refreshedDevice: SimInteractionSessionItem = {
        id: refreshed.id,
        deviceNumber: refreshed.device_number.toUpperCase(),
        isActive: refreshed.is_active,
        status: refreshed.status
    };
    const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    const updatedList = (tempData.simInteractionDevices || []).map((device) =>
        device.id === refreshedDevice.id ? refreshedDevice : device
    );

    stateManager.setUserState(telegramId, AdminState.SIM_INTERACTION_ACTION_SELECTING);
    stateManager.setUserTempData(telegramId, {
        simInteractionDevices: updatedList
    });

    await bot.sendMessage(
        chatId,
        `✅ Статус исправности СИМ изменен на <b>${getSimConditionStatusText(refreshedDevice.status)}</b>.`,
        { parse_mode: 'HTML' }
    );
    await sendSimActionsMessage(chatId, refreshedDevice);
    return true;
}
