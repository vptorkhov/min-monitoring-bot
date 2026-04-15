import TelegramBot from 'node-telegram-bot-api';
import { RegistrationHandler } from '../../handlers/registration.handler';
import { CourierService } from '../../../services/courier.service';
import { SessionService } from '../../../services/session.service';
import { AdminService } from '../../../services/admin.service';
import { CourierRepository } from '../../../repositories/courier.repository';
import { getDatabase } from '../../../config/database';
import { stateManager } from '../../state-manager';
import { sendCourierMainKeyboard } from '../../keyboards/courier-main-keyboard';
import { blockIfAdminGuestCommandNotAllowed } from '../../admin/admin-mode';
import {
    getAdminCommandListMessage,
    isAuthenticatedAdminState
} from '../../admin/admin-command-hints';
import { GENERIC_ERROR_MESSAGE } from '../../../constants/messages.constant';
import { MobilityDeviceRepository } from '../../../repositories/mobility-device.repository';
import { AdminState } from '../../../constants/states.constant';
import { handleCancelAuthWarehouseFlows } from './cancel-admin-auth-warehouse-flows';
import { handleCancelEditApprovalFlows } from './cancel-admin-edit-approval-flows';
import { handleCancelSimFlows } from './cancel-admin-edit-approval-sim-flows';
import { handleCancelCourierFlows } from './cancel-admin-courier-flows';

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

/** Регистрирует универсальную команду /cancel для курьерских и admin-потоков. */
export function registerCancelCommand(
    bot: TelegramBot,
    registrationHandler: RegistrationHandler,
    courierService: CourierService,
    sessionService: SessionService
): void {
    const adminService = new AdminService();
    const mobilityDeviceRepository = new MobilityDeviceRepository();
    const courierRepository = new CourierRepository(getDatabase());

    bot.onText(/^\/cancel(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from?.id;
        if (!userId) {
            return;
        }

        try {
            const currentState = stateManager.getUserState(userId) || '';

            const handledAuthWarehouse = await handleCancelAuthWarehouseFlows({
                bot,
                chatId,
                userId,
                currentState,
                adminService
            });
            if (handledAuthWarehouse) {
                return;
            }

            const handledEditApproval = await handleCancelEditApprovalFlows({
                bot,
                chatId,
                userId,
                currentState,
                adminService,
                courierService
            });
            if (handledEditApproval) {
                return;
            }

            const handledSimFlow = await handleCancelSimFlows({
                bot,
                chatId,
                userId,
                currentState,
                mobilityDeviceRepository
            });
            if (handledSimFlow) {
                return;
            }

            const handledCourierFlow = await handleCancelCourierFlows({
                bot,
                chatId,
                userId,
                currentState,
                courierRepository,
                sendAdminCommandsIfNeeded: async (targetChatId, level, targetState) =>
                    sendAdminCommandsIfNeeded(bot, targetChatId, level, targetState)
            });
            if (handledCourierFlow) {
                return;
            }

            if (await blockIfAdminGuestCommandNotAllowed(bot, chatId, userId, msg.text)) {
                return;
            }

            let wasInProcess = false;

            if (registrationHandler.isUserInRegistration(userId)) {
                await registrationHandler.cancelRegistration(chatId, userId);
                wasInProcess = true;
            }

            const state = stateManager.getUserState(userId);
            if (state) {
                stateManager.resetUserState(userId);
                stateManager.resetUserTempData(userId);
                wasInProcess = true;
            }

            if (!wasInProcess) {
                await bot.sendMessage(chatId, 'ℹ️ Нет активного действия для отмены.');
                return;
            }

            await bot.sendMessage(chatId, '❌ Действие отменено.');
            await sendCourierMainKeyboard(bot, chatId, userId, courierService, sessionService);
        } catch (error) {
            console.error('Ошибка в /cancel обработчике:', error);
            await bot.sendMessage(chatId, GENERIC_ERROR_MESSAGE);
        }
    });
}
