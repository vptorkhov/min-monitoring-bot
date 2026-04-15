import TelegramBot from 'node-telegram-bot-api';
import { AdminService } from '../../../services/admin.service';
import { SessionService } from '../../../services/session.service';
import { AdminSessionData, SimInteractionSessionItem } from '../admin.types';
import { registerSimBaseCommands } from './sim-base-commands';
import { registerSimContextCommands } from './sim-context-commands';

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

/** Регистрирует list/context команды SIM в admin-flow. */
export function registerSimListCommands(
    bot: TelegramBot,
    adminService: AdminService,
    sessionService: SessionService,
    sendAdminCommandsIfNeeded: SendAdminCommandsIfNeeded,
    loadWarehouseSimDevices: LoadWarehouseSimDevices,
    sendSimSelectionMessage: SendSimSelectionMessage
): void {
    registerSimBaseCommands(
        bot,
        adminService,
        sessionService,
        sendAdminCommandsIfNeeded
    );

    registerSimContextCommands(
        bot,
        adminService,
        sendAdminCommandsIfNeeded,
        loadWarehouseSimDevices,
        sendSimSelectionMessage
    );
}
