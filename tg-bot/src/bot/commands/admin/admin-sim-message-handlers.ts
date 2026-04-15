import TelegramBot from 'node-telegram-bot-api';
import { AdminService } from '../../../services/admin.service';
import { SessionRepository } from '../../../repositories/session.repository';
import { MobilityDeviceRepository } from '../../../repositories/mobility-device.repository';
import { AdminSessionData, SimInteractionSessionItem } from '../admin.types';
import { handleSimEntryMessage } from './admin-sim-message-entry-handlers';
import { handleSimStatusMessage } from './admin-sim-message-status-handlers';
import { handleSimDeleteMessage } from './admin-sim-message-delete-handlers';

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

/** Обрабатывает message-state сценарии управления SIM в admin-flow. */
export async function handleSimAdminMessage(
    bot: TelegramBot,
    adminService: AdminService,
    mobilityDeviceRepository: MobilityDeviceRepository,
    sessionRepository: SessionRepository,
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
    if (
        await handleSimEntryMessage(
            bot,
            adminService,
            mobilityDeviceRepository,
            telegramId,
            chatId,
            text,
            currentState,
            sendAdminCommandsIfNeeded,
            sendSimActionsMessage
        )
    ) {
        return true;
    }

    if (
        await handleSimStatusMessage(
            bot,
            mobilityDeviceRepository,
            sessionRepository,
            telegramId,
            chatId,
            text,
            currentState,
            tryResolveSelectedSimDevice,
            sendSimActionsMessage
        )
    ) {
        return true;
    }

    return handleSimDeleteMessage(
        bot,
        {
            deleteByIdWithSessions: (deviceId: number) =>
                mobilityDeviceRepository.deleteByIdWithSessions(deviceId),
            hasActiveByDevice: (deviceId: number) =>
                sessionRepository.hasActiveByDevice(deviceId)
        },
        telegramId,
        chatId,
        text,
        currentState,
        sendAdminCommandsIfNeeded,
        loadWarehouseSimDevices,
        sendSimSelectionMessage,
        tryResolveSelectedSimDevice,
        sendSimActionsMessage
    );
}
