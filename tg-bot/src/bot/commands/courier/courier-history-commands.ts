import TelegramBot from 'node-telegram-bot-api';
import { SessionRepository } from '../../../repositories/session.repository';
import { isUserInAdminMode } from '../../admin/admin-mode';
import { stateManager } from '../../state-manager';
import { AdminState } from '../../../constants/states.constant';
import {
    formatCourierDisplayHtml,
    formatCourierHistoryRows
} from '../../../utils/admin-format.utils';
import { AdminSessionData, EditableCourierSessionItem } from '../admin.types';

type TryResolveSelectedEditCourier = (
    telegramId: number,
    chatId: number,
    commandLink: string
) => Promise<{
    tempData: AdminSessionData;
    courier: EditableCourierSessionItem;
} | null>;

type SendCourierActionsMessage = (
    chatId: number,
    courier: EditableCourierSessionItem,
    isSuperAdmin: boolean
) => Promise<void>;

/** Регистрирует команды просмотра истории курьеров. */
export function registerCourierHistoryCommands(
    bot: TelegramBot,
    sessionRepository: SessionRepository,
    tryResolveSelectedEditCourier: TryResolveSelectedEditCourier,
    sendCourierActionsMessage: SendCourierActionsMessage
): void {
    bot.onText(/^\/admin_courier_history(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId) {
            return;
        }

        if (!isUserInAdminMode(telegramId)) {
            await bot.sendMessage(
                chatId,
                '❌ Команда недоступна без выбора курьера через /admin_edit_couriers.'
            );
            return;
        }

        const resolved = await tryResolveSelectedEditCourier(
            telegramId,
            chatId,
            '/admin_edit_couriers'
        );
        if (!resolved) {
            return;
        }

        const history = await sessionRepository.getHistoryByCourier(
            resolved.courier.id,
            50
        );
        const courierDisplay = formatCourierDisplayHtml(
            resolved.courier.fullName,
            resolved.courier.nickname
        );

        if (!history.length) {
            stateManager.setUserState(
                telegramId,
                AdminState.ADMIN_EDIT_COURIER_ACTION_SELECTING
            );
            await bot.sendMessage(
                chatId,
                `История сессий курьера ${courierDisplay} пуста.`,
                { parse_mode: 'HTML' }
            );
            await sendCourierActionsMessage(chatId, resolved.courier, false);
            return;
        }

        stateManager.setUserState(
            telegramId,
            AdminState.ADMIN_COURIER_HISTORY_AWAITING_FULL
        );

        await bot.sendMessage(
            chatId,
            [
                `История сессий курьера ${courierDisplay}`,
                '',
                formatCourierHistoryRows(history),
                '',
                'Если хотите увидеть полную историю, напишите ДА, если хотите выйти, напишите /cancel'
            ].join('\n'),
            { parse_mode: 'HTML' }
        );
    });

    bot.onText(/^\/superadmin_courier_history(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId) {
            return;
        }

        if (!isUserInAdminMode(telegramId)) {
            await bot.sendMessage(
                chatId,
                '❌ Команда недоступна без выбора курьера через /superadmin_edit_couriers.'
            );
            return;
        }

        const tempData =
            stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        if ((tempData.adminPermissionsLevel ?? 0) < 2) {
            await bot.sendMessage(chatId, '🚫 Нет прав на эту команду.');
            return;
        }

        const resolved = await tryResolveSelectedEditCourier(
            telegramId,
            chatId,
            '/superadmin_edit_couriers'
        );
        if (!resolved) {
            return;
        }

        const history = await sessionRepository.getHistoryByCourier(
            resolved.courier.id,
            50
        );
        const courierDisplay = formatCourierDisplayHtml(
            resolved.courier.fullName,
            resolved.courier.nickname
        );

        if (!history.length) {
            stateManager.setUserState(
                telegramId,
                AdminState.SUPERADMIN_EDIT_COURIER_ACTION_SELECTING
            );
            await bot.sendMessage(
                chatId,
                `История сессий курьера ${courierDisplay} пуста.`,
                { parse_mode: 'HTML' }
            );
            await sendCourierActionsMessage(chatId, resolved.courier, true);
            return;
        }

        stateManager.setUserState(
            telegramId,
            AdminState.SUPERADMIN_COURIER_HISTORY_AWAITING_FULL
        );

        await bot.sendMessage(
            chatId,
            [
                `История сессий курьера ${courierDisplay}`,
                '',
                formatCourierHistoryRows(history),
                '',
                'Если хотите увидеть полную историю, напишите ДА, если хотите выйти, напишите /cancel'
            ].join('\n'),
            { parse_mode: 'HTML' }
        );
    });
}
