import TelegramBot from 'node-telegram-bot-api';
import { RegistrationHandler } from '../handlers/registration.handler';
import { CourierService } from '../../services/courier.service';
import { SessionService } from '../../services/session.service';
import { AdminService } from '../../services/admin.service';
import { WarehouseService } from '../../services/warehouse.service';
import { WarehouseRepository } from '../../repositories/warehouse.repository';
import { MobilityDeviceRepository } from '../../repositories/mobility-device.repository';
import { SessionRepository } from '../../repositories/session.repository';
import { CourierRepository } from '../../repositories/courier.repository';
import { stateManager } from '../state-manager';
import { AdminState } from '../../constants/states.constant';
import { getDatabase } from '../../config/database';
import { registerWarehouseCommands } from './warehouse/warehouse-commands';
import { registerAuthCommands } from './admin/auth-commands';
import { registerSimCommands } from './sim/sim-commands';
import { registerCourierCommands } from './courier/courier-commands';
import { registerApprovalCommands } from './admin/admin-approval-commands';
import { createAdminSharedMessageContext } from './admin/admin-shared-message-context';
import { createAdminCourierMessageContext } from './admin/admin-courier-message-context';
import { createAdminSimMessageContext } from './admin/admin-sim-message-context';
import { registerAdminMessageRouter } from './admin/admin-message-router';

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

/** Создает callbacks для auth-flow админа. */
function createAuthFlows(bot: TelegramBot): AuthFlows {
    const startAdminRegistrationFlow = async (
        chatId: number,
        telegramId: number
    ) => {
        stateManager.setUserState(
            telegramId,
            AdminState.REGISTER_AWAITING_LOGIN
        );
        stateManager.resetUserTempData(telegramId);
        await bot.sendMessage(chatId, 'Придумайте и введите логин');
    };

    const startAdminLoginFlow = async (chatId: number, telegramId: number) => {
        stateManager.setUserState(telegramId, AdminState.LOGIN_AWAITING_LOGIN);
        stateManager.resetUserTempData(telegramId);
        await bot.sendMessage(chatId, 'Введите логин');
    };

    return {
        startAdminLoginFlow,
        startAdminRegistrationFlow
    };
}

/** Регистрирует весь admin-mode: команды и message-handlers. */
export function registerAdminModeCommands(
    bot: TelegramBot,
    courierService: CourierService,
    registrationHandler: RegistrationHandler,
    sessionService: SessionService
): void {
    const deps: RuntimeDeps = {
        adminService: new AdminService(),
        courierService,
        courierRepository: new CourierRepository(getDatabase()),
        mobilityDeviceRepository: new MobilityDeviceRepository(),
        sessionRepository: new SessionRepository(),
        sessionService,
        warehouseService: new WarehouseService(new WarehouseRepository())
    };

    const authFlows = createAuthFlows(bot);
    const sharedContext = createAdminSharedMessageContext({
        adminService: deps.adminService,
        bot,
        courierService
    });
    const courierContext = createAdminCourierMessageContext({
        bot,
        courierRepository: deps.courierRepository,
        sessionRepository: deps.sessionRepository,
        warehouseService: deps.warehouseService
    });
    const simContext = createAdminSimMessageContext({
        bot,
        mobilityDeviceRepository: deps.mobilityDeviceRepository,
        sessionRepository: deps.sessionRepository
    });

    registerWarehouseCommands(bot, deps.adminService, deps.warehouseService);

    registerAuthCommands(
        bot,
        courierService,
        registrationHandler,
        sessionService,
        deps.adminService,
        authFlows.startAdminLoginFlow,
        authFlows.startAdminRegistrationFlow
    );

    registerSimCommands(
        bot,
        deps.adminService,
        sessionService,
        deps.sessionRepository,
        sharedContext.sendAdminCommandsIfNeeded,
        simContext.loadWarehouseSimDevices,
        simContext.sendSimSelectionMessage,
        simContext.tryResolveSelectedSimDevice,
        simContext.sendSimActionsMessage
    );

    registerCourierCommands(
        bot,
        deps.adminService,
        deps.sessionRepository,
        sharedContext.sendAdminCommandsIfNeeded,
        courierContext.loadEditableCouriersByWarehouse,
        courierContext.loadAllEditableCouriers,
        courierContext.sendEditableCouriersListMessage,
        courierContext.tryResolveSelectedEditCourier,
        courierContext.sendCourierActionsMessage
    );

    registerApprovalCommands(
        bot,
        sharedContext.loadPendingCourierApprovals,
        sharedContext.sendPendingCourierApprovalsListMessage
    );

    registerAdminMessageRouter(
        bot,
        deps,
        authFlows,
        sharedContext,
        courierContext,
        simContext
    );
}
