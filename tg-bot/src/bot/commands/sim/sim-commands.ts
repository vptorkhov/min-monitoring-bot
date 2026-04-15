import TelegramBot from 'node-telegram-bot-api';
import { AdminService } from '../../../services/admin.service';
import { SessionService } from '../../../services/session.service';
import { SessionRepository } from '../../../repositories/session.repository';
import { AdminSessionData, SimInteractionSessionItem } from '../admin.types';
import { registerSimListCommands } from './sim-list-commands';
import { registerSimInteractionCommands } from './sim-interaction-commands';

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

/** Регистрирует все команды управления SIM для admin-mode. */
export function registerSimCommands(
    bot: TelegramBot,
    adminService: AdminService,
    sessionService: SessionService,
    sessionRepository: SessionRepository,
    sendAdminCommandsIfNeeded: SendAdminCommandsIfNeeded,
    loadWarehouseSimDevices: LoadWarehouseSimDevices,
    sendSimSelectionMessage: SendSimSelectionMessage,
    tryResolveSelectedSimDevice: TryResolveSelectedSimDevice,
    sendSimActionsMessage: SendSimActionsMessage
): void {
    registerSimListCommands(
        bot,
        adminService,
        sessionService,
        sendAdminCommandsIfNeeded,
        loadWarehouseSimDevices,
        sendSimSelectionMessage
    );

    registerSimInteractionCommands(
        bot,
        sessionRepository,
        tryResolveSelectedSimDevice,
        sendSimActionsMessage
    );
}
