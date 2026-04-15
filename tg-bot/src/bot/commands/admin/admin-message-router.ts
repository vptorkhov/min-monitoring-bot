import TelegramBot from 'node-telegram-bot-api';
import { AdminService } from '../../../services/admin.service';
import { CourierService } from '../../../services/courier.service';
import { SessionService } from '../../../services/session.service';
import { WarehouseService } from '../../../services/warehouse.service';
import { MobilityDeviceRepository } from '../../../repositories/mobility-device.repository';
import { SessionRepository } from '../../../repositories/session.repository';
import { CourierRepository } from '../../../repositories/courier.repository';
import { stateManager } from '../../state-manager';
import { isCommand } from '../../../constants/commands.constant';
import { isAdminMessageHandledState } from '../../../utils/admin-message-state.utils';
import { AdminSessionData, EditableAdminSessionItem, EditableCourierSessionItem, PendingCourierApprovalSessionItem, SimInteractionSessionItem } from '../admin.types';
import { handleApplyRegistrationsMessage } from './admin-approval-commands';
import { handleAuthAdminMessage } from './admin-auth-message-handlers';
import { handleSimAdminMessage } from './admin-sim-message-handlers';
import { handleAdminSessionsHistoryMessage } from './admin-sessions-message-handlers';
import { handleWarehouseAdminMessage } from './admin-warehouse-message-handlers';
import { handleAdminEditorsMessage } from './admin-admins-message-handlers';
import { handleCourierAdminMessage } from './admin-courier-message-handlers';

type AuthFlows = {
    startAdminLoginFlow: (chatId: number, telegramId: number) => Promise<void>;
    startAdminRegistrationFlow: (
        chatId: number,
        telegramId: number
    ) => Promise<void>;
};

type RuntimeDeps = {
    adminService: AdminService;
    courierService: CourierService;
    sessionService: SessionService;
    warehouseService: WarehouseService;
    mobilityDeviceRepository: MobilityDeviceRepository;
    sessionRepository: SessionRepository;
    courierRepository: CourierRepository;
};

type SharedContext = {
    loadEditableAdmins: () => Promise<EditableAdminSessionItem[]>;
    loadPendingCourierApprovals: () => Promise<PendingCourierApprovalSessionItem[]>;
    restoreToAuthenticatedWithAdminContext: (
        telegramId: number,
        tempData: AdminSessionData,
        targetState?: string
    ) => string;
    sendAdminActionsMessage: (
        chatId: number,
        admin: EditableAdminSessionItem
    ) => Promise<void>;
    sendAdminCommandsIfNeeded: (
        chatId: number,
        adminPermissionsLevel: number | undefined,
        state: string
    ) => Promise<void>;
    sendEditableAdminsListMessage: (
        chatId: number,
        admins: EditableAdminSessionItem[]
    ) => Promise<void>;
    sendPendingCourierApprovalsListMessage: (
        chatId: number,
        couriers: PendingCourierApprovalSessionItem[]
    ) => Promise<void>;
    sendWarehouseActionsMessage: (chatId: number, warehouse: any) => Promise<void>;
    tryResolveSelectedAdmin: (
        telegramId: number,
        chatId: number
    ) => Promise<{
        tempData: AdminSessionData;
        admin: EditableAdminSessionItem;
    } | null>;
};

type CourierContext = {
    sendCourierActionsMessage: (
        chatId: number,
        courier: EditableCourierSessionItem,
        isSuperadmin: boolean
    ) => Promise<void>;
    tryResolveSelectedEditCourier: (
        telegramId: number,
        chatId: number,
        commandHint: string
    ) => Promise<{
        tempData: AdminSessionData;
        courier: EditableCourierSessionItem;
    } | null>;
};

type SimContext = {
    loadWarehouseSimDevices: (
        warehouseId: number
    ) => Promise<SimInteractionSessionItem[]>;
    sendSimActionsMessage: (
        chatId: number,
        device: SimInteractionSessionItem
    ) => Promise<void>;
    sendSimSelectionMessage: (
        chatId: number,
        devices: SimInteractionSessionItem[]
    ) => Promise<void>;
    tryResolveSelectedSimDevice: (
        telegramId: number,
        chatId: number
    ) => Promise<{
        tempData: AdminSessionData;
        device: SimInteractionSessionItem;
    } | null>;
};

/** Регистрирует admin message-router и делегирует обработку по доменам. */
export function registerAdminMessageRouter(
    bot: TelegramBot,
    deps: RuntimeDeps,
    authFlows: AuthFlows,
    sharedContext: SharedContext,
    courierContext: CourierContext,
    simContext: SimContext
): void {
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;
        if (!telegramId) {
            return;
        }

        const currentState = stateManager.getUserState(telegramId);
        if (!currentState || !isAdminMessageHandledState(currentState)) {
            return;
        }

        const text = msg.text || '';
        if (!text || isCommand(text)) {
            return;
        }

        const handlers = [
            () =>
                handleAuthAdminMessage(
                    bot,
                    deps.adminService,
                    authFlows.startAdminLoginFlow,
                    authFlows.startAdminRegistrationFlow,
                    telegramId,
                    chatId,
                    text,
                    currentState
                ),
            () =>
                handleWarehouseAdminMessage(
                    bot,
                    deps.adminService,
                    deps.warehouseService,
                    telegramId,
                    chatId,
                    text,
                    currentState,
                    sharedContext.sendAdminCommandsIfNeeded,
                    sharedContext.restoreToAuthenticatedWithAdminContext,
                    sharedContext.sendWarehouseActionsMessage
                ),
            () =>
                handleAdminEditorsMessage(
                    bot,
                    deps.adminService,
                    telegramId,
                    chatId,
                    text,
                    currentState,
                    sharedContext.tryResolveSelectedAdmin,
                    sharedContext.loadEditableAdmins,
                    sharedContext.sendAdminActionsMessage,
                    sharedContext.sendEditableAdminsListMessage
                ),
            () =>
                handleApplyRegistrationsMessage(
                    bot,
                    deps.courierService,
                    telegramId,
                    chatId,
                    text,
                    currentState,
                    sharedContext.loadPendingCourierApprovals,
                    sharedContext.sendPendingCourierApprovalsListMessage,
                    sharedContext.restoreToAuthenticatedWithAdminContext,
                    sharedContext.sendAdminCommandsIfNeeded
                ),
            () =>
                handleAdminSessionsHistoryMessage(
                    bot,
                    deps.adminService,
                    deps.sessionService,
                    telegramId,
                    chatId,
                    text,
                    currentState,
                    sharedContext.sendAdminCommandsIfNeeded
                ),
            () =>
                handleSimAdminMessage(
                    bot,
                    deps.adminService,
                    deps.mobilityDeviceRepository,
                    deps.sessionRepository,
                    telegramId,
                    chatId,
                    text,
                    currentState,
                    sharedContext.sendAdminCommandsIfNeeded,
                    simContext.loadWarehouseSimDevices,
                    simContext.sendSimSelectionMessage,
                    simContext.tryResolveSelectedSimDevice,
                    simContext.sendSimActionsMessage
                ),
            () =>
                handleCourierAdminMessage(
                    bot,
                    deps.courierRepository,
                    deps.sessionRepository,
                    telegramId,
                    chatId,
                    text,
                    currentState,
                    sharedContext.sendAdminCommandsIfNeeded,
                    sharedContext.restoreToAuthenticatedWithAdminContext,
                    courierContext.tryResolveSelectedEditCourier,
                    courierContext.sendCourierActionsMessage
                )
        ];

        for (const handler of handlers) {
            if (await handler()) {
                return;
            }
        }
    });
}
