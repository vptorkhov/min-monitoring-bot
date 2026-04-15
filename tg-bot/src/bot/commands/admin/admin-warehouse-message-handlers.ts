import TelegramBot from 'node-telegram-bot-api';
import { AdminService } from '../../../services/admin.service';
import { WarehouseService } from '../../../services/warehouse.service';
import { AdminSessionData } from '../admin.types';
import { Warehouse } from '../../../repositories/types/warehouse.type';
import { handleWarehouseEntryMessage } from './admin-warehouse-message-entry-handlers';
import { handleWarehouseEditMessage } from './admin-warehouse-message-edit-handlers';

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

/** Обрабатывает message-state сценарии управления складами в admin-flow. */
export async function handleWarehouseAdminMessage(
    bot: TelegramBot,
    adminService: AdminService,
    warehouseService: WarehouseService,
    telegramId: number,
    chatId: number,
    text: string,
    currentState: string | undefined,
    sendAdminCommandsIfNeeded: SendAdminCommandsIfNeeded,
    restoreToAuthenticatedWithAdminContext: RestoreToAuthenticatedWithAdminContext,
    sendWarehouseActionsMessage: SendWarehouseActionsMessage
): Promise<boolean> {
    if (
        await handleWarehouseEntryMessage(
            bot,
            adminService,
            warehouseService,
            telegramId,
            chatId,
            text,
            currentState,
            sendAdminCommandsIfNeeded
        )
    ) {
        return true;
    }

    return handleWarehouseEditMessage(
        bot,
        warehouseService,
        telegramId,
        chatId,
        text,
        currentState,
        sendAdminCommandsIfNeeded,
        restoreToAuthenticatedWithAdminContext,
        sendWarehouseActionsMessage
    );
}
