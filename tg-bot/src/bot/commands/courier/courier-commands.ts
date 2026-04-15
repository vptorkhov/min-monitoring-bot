import TelegramBot from 'node-telegram-bot-api';
import { AdminService } from '../../../services/admin.service';
import { SessionRepository } from '../../../repositories/session.repository';
import { AdminSessionData, EditableCourierSessionItem } from '../admin.types';
import { registerCourierSelectionCommands } from './courier-selection-commands';
import { registerCourierActionCommands } from './courier-action-commands';
import { registerCourierHistoryCommands } from './courier-history-commands';

/** Регистрирует все команды управления курьерами в admin-mode. */
export function registerCourierCommands(
    bot: TelegramBot,
    adminService: AdminService,
    sessionRepository: SessionRepository,
    sendAdminCommandsIfNeeded: (
        chatId: number,
        permLevel: number | undefined,
        state: string
    ) => Promise<void>,
    loadEditableCouriersByWarehouse: (
        warehouseId: number
    ) => Promise<EditableCourierSessionItem[]>,
    loadAllEditableCouriers: () => Promise<EditableCourierSessionItem[]>,
    sendEditableCouriersListMessage: (
        chatId: number,
        couriers: EditableCourierSessionItem[]
    ) => Promise<void>,
    tryResolveSelectedEditCourier: (
        telegramId: number,
        chatId: number,
        commandLink: string
    ) => Promise<{
        tempData: AdminSessionData;
        courier: EditableCourierSessionItem;
    } | null>,
    sendCourierActionsMessage: (
        chatId: number,
        courier: EditableCourierSessionItem,
        isSuperAdmin: boolean
    ) => Promise<void>
): void {
    registerCourierSelectionCommands(
        bot,
        adminService,
        sendAdminCommandsIfNeeded,
        loadEditableCouriersByWarehouse,
        loadAllEditableCouriers,
        sendEditableCouriersListMessage
    );

    registerCourierActionCommands(bot, tryResolveSelectedEditCourier);

    registerCourierHistoryCommands(
        bot,
        sessionRepository,
        tryResolveSelectedEditCourier,
        sendCourierActionsMessage
    );
}
