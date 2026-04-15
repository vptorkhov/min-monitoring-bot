import TelegramBot from 'node-telegram-bot-api';
import { CourierService } from '../../../services/courier.service';
import { isUserInAdminMode } from '../../admin/admin-mode';
import { stateManager } from '../../state-manager';
import { AdminState } from '../../../constants/states.constant';
import { isInAuthenticatedOrSubflow } from '../../../utils/admin-state.utils';
import { escapeHtml } from '../../../utils/admin-format.utils';
import {
    AdminSessionData,
    PendingCourierApprovalSessionItem
} from '../admin.types';
import { tryResolveSelectedApplyCourier } from './admin-approval-resolvers';

type LoadPendingCourierApprovals = () => Promise<
    PendingCourierApprovalSessionItem[]
>;

type SendPendingCourierApprovalsListMessage = (
    chatId: number,
    couriers: PendingCourierApprovalSessionItem[]
) => Promise<void>;

type RestoreToAuthenticatedWithAdminContext = (
    telegramId: number,
    tempData: AdminSessionData,
    targetState?: string
) => string;

type SendAdminCommandsIfNeeded = (
    chatId: number,
    adminPermissionsLevel: number | undefined,
    state: string
) => Promise<void>;

export function registerApprovalCommands(
    bot: TelegramBot,
    loadPendingCourierApprovals: LoadPendingCourierApprovals,
    sendPendingCourierApprovalsListMessage: SendPendingCourierApprovalsListMessage
): void {
    bot.onText(/^\/admin_apply_registrations(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId) {
            return;
        }

        if (!isUserInAdminMode(telegramId)) {
            await bot.sendMessage(
                chatId,
                'ℹ️ Сначала войдите в админский режим командой /admin.'
            );
            return;
        }

        const currentState = stateManager.getUserState(telegramId);
        if (!isInAuthenticatedOrSubflow(currentState)) {
            await bot.sendMessage(
                chatId,
                '🔒 Эта команда доступна только авторизованному администратору. Используйте /admin_login.'
            );
            return;
        }

        const tempData =
            stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        if (!tempData.adminId || !tempData.adminPermissionsLevel) {
            stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
            await bot.sendMessage(
                chatId,
                '⚠️ Не удалось определить администратора. Выполните /admin_login повторно.'
            );
            return;
        }

        if (tempData.adminPermissionsLevel < 1) {
            await bot.sendMessage(chatId, '🚫 Нет прав на эту команду.');
            return;
        }

        const pendingCouriers = await loadPendingCourierApprovals();
        if (!pendingCouriers.length) {
            await bot.sendMessage(
                chatId,
                'ℹ️ Нет неактивных курьеров без записей о сессиях.'
            );
            return;
        }

        stateManager.setUserState(
            telegramId,
            AdminState.APPLY_REGISTRATIONS_SELECTING
        );
        stateManager.setUserTempData(telegramId, {
            applyRegistrations: pendingCouriers,
            selectedApplyCourierId: undefined,
            applyRegistrationsReturnState:
                currentState || AdminState.AUTHENTICATED
        });

        await sendPendingCourierApprovalsListMessage(chatId, pendingCouriers);
    });
}

export async function handleApplyRegistrationsMessage(
    bot: TelegramBot,
    courierService: CourierService,
    telegramId: number,
    chatId: number,
    text: string,
    currentState: string | undefined,
    loadPendingCourierApprovals: LoadPendingCourierApprovals,
    sendPendingCourierApprovalsListMessage: SendPendingCourierApprovalsListMessage,
    restoreToAuthenticatedWithAdminContext: RestoreToAuthenticatedWithAdminContext,
    sendAdminCommandsIfNeeded: SendAdminCommandsIfNeeded
): Promise<boolean> {
    if (currentState === AdminState.APPLY_REGISTRATIONS_SELECTING) {
        const tempData =
            stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        const pendingCouriers = tempData.applyRegistrations;

        if (!pendingCouriers?.length) {
            const refreshed = await loadPendingCourierApprovals();
            if (!refreshed.length) {
                const restoredState = restoreToAuthenticatedWithAdminContext(
                    telegramId,
                    tempData,
                    tempData.applyRegistrationsReturnState
                );
                await bot.sendMessage(
                    chatId,
                    'ℹ️ Нет неактивных курьеров без записей о сессиях.'
                );
                await sendAdminCommandsIfNeeded(
                    chatId,
                    tempData.adminPermissionsLevel,
                    restoredState
                );
                return true;
            }

            stateManager.setUserTempData(telegramId, {
                applyRegistrations: refreshed
            });
            await sendPendingCourierApprovalsListMessage(chatId, refreshed);
            return true;
        }

        if (!/^\d+$/.test(text.trim())) {
            await bot.sendMessage(
                chatId,
                '❌ Введите корректный номер курьера из списка.'
            );
            return true;
        }

        const index = parseInt(text.trim(), 10) - 1;
        if (index < 0 || index >= pendingCouriers.length) {
            await bot.sendMessage(
                chatId,
                '❌ Курьер с таким номером не найден. Введите номер из списка.'
            );
            return true;
        }

        const selectedCourier = pendingCouriers[index];
        stateManager.setUserState(
            telegramId,
            AdminState.APPLY_REGISTRATION_AWAITING_CONFIRM
        );
        stateManager.setUserTempData(telegramId, {
            selectedApplyCourierId: selectedCourier.id
        });

        await bot.sendMessage(
            chatId,
            'Вы принимаете регистрацию пользователя? Введите "Да" или "Нет"'
        );
        return true;
    }

    if (currentState === AdminState.APPLY_REGISTRATION_AWAITING_CONFIRM) {
        const normalized = text.trim().toLowerCase();
        if (normalized !== 'да' && normalized !== 'нет') {
            await bot.sendMessage(
                chatId,
                '❌ Некорректный ответ. Введите "Да" или "Нет".'
            );
            return true;
        }

        const resolved = await tryResolveSelectedApplyCourier(
            bot,
            telegramId,
            chatId,
            loadPendingCourierApprovals
        );
        if (!resolved) {
            return true;
        }

        if (normalized === 'да') {
            const activateResult = await courierService.activateCourier(
                resolved.courier.id
            );
            if (!activateResult.success) {
                await bot.sendMessage(
                    chatId,
                    `❌ ${activateResult.reason || 'Не удалось активировать курьера.'}`
                );
                return true;
            }

            await bot.sendMessage(
                chatId,
                `✅ Регистрация курьера <b>${escapeHtml(resolved.courier.fullName)}</b> принята.`,
                { parse_mode: 'HTML' }
            );
        } else {
            const cancelResult = await courierService.cancelPendingRegistration(
                resolved.courier.id
            );
            if (!cancelResult.success) {
                await bot.sendMessage(
                    chatId,
                    `❌ ${cancelResult.reason || 'Не удалось отменить регистрацию курьера.'}`
                );
                return true;
            }

            await bot.sendMessage(
                chatId,
                `✅ Регистрация курьера <b>${escapeHtml(resolved.courier.fullName)}</b> отменена. Курьер удален из базы данных.`,
                { parse_mode: 'HTML' }
            );
        }

        const refreshed = await loadPendingCourierApprovals();
        if (!refreshed.length) {
            const restoredState = restoreToAuthenticatedWithAdminContext(
                telegramId,
                resolved.tempData,
                resolved.tempData.applyRegistrationsReturnState
            );
            await bot.sendMessage(
                chatId,
                'ℹ️ Нет неактивных курьеров без записей о сессиях. Вы возвращены в предыдущее состояние.'
            );
            await sendAdminCommandsIfNeeded(
                chatId,
                resolved.tempData.adminPermissionsLevel,
                restoredState
            );
            return true;
        }

        stateManager.setUserState(
            telegramId,
            AdminState.APPLY_REGISTRATIONS_SELECTING
        );
        stateManager.setUserTempData(telegramId, {
            applyRegistrations: refreshed,
            selectedApplyCourierId: undefined
        });
        await sendPendingCourierApprovalsListMessage(chatId, refreshed);
        return true;
    }

    return false;
}
