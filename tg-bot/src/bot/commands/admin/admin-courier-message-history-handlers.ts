import TelegramBot from 'node-telegram-bot-api';
import { SessionRepository } from '../../../repositories/session.repository';
import {
    formatCourierDisplayHtml,
    formatCourierHistoryRows
} from '../../../utils/admin-format.utils';
import { stateManager } from '../../state-manager';
import { AdminState } from '../../../constants/states.constant';
import { AdminSessionData, EditableCourierSessionItem } from '../admin.types';

type TryResolveSelectedEditCourier = (
    telegramId: number,
    chatId: number,
    commandHint: string
) => Promise<{
    tempData: AdminSessionData;
    courier: EditableCourierSessionItem;
} | null>;

type SendCourierActionsMessage = (
    chatId: number,
    courier: EditableCourierSessionItem,
    isSuperadmin: boolean
) => Promise<void>;

/** Обрабатывает состояния истории курьера в admin-flow. */
export async function handleCourierHistoryMessage(
    bot: TelegramBot,
    sessionRepository: SessionRepository,
    telegramId: number,
    chatId: number,
    text: string,
    currentState: string | undefined,
    tryResolveSelectedEditCourier: TryResolveSelectedEditCourier,
    sendCourierActionsMessage: SendCourierActionsMessage
): Promise<boolean> {
    if (
        currentState !== AdminState.ADMIN_COURIER_HISTORY_AWAITING_FULL &&
        currentState !== AdminState.SUPERADMIN_COURIER_HISTORY_AWAITING_FULL
    ) {
        return false;
    }

    const isSuperadmin =
        currentState === AdminState.SUPERADMIN_COURIER_HISTORY_AWAITING_FULL;
    const normalized = text.trim();

    if (normalized.toLowerCase() === 'нет') {
        const commandHint = isSuperadmin
            ? '/superadmin_edit_couriers'
            : '/admin_edit_couriers';
        const resolved = await tryResolveSelectedEditCourier(
            telegramId,
            chatId,
            commandHint
        );
        const nextState = isSuperadmin
            ? AdminState.SUPERADMIN_EDIT_COURIER_ACTION_SELECTING
            : AdminState.ADMIN_EDIT_COURIER_ACTION_SELECTING;
        stateManager.setUserState(telegramId, nextState);
        if (resolved) {
            await sendCourierActionsMessage(
                chatId,
                resolved.courier,
                isSuperadmin
            );
        }
        return true;
    }

    if (normalized !== 'ДА') {
        await bot.sendMessage(
            chatId,
            '❌ Некорректный ввод. Напишите ДА для полной истории или /cancel для возврата.'
        );
        return true;
    }

    const commandHint = isSuperadmin
        ? '/superadmin_edit_couriers'
        : '/admin_edit_couriers';
    const resolved = await tryResolveSelectedEditCourier(
        telegramId,
        chatId,
        commandHint
    );
    if (!resolved) {
        return true;
    }

    const courierDisplay = formatCourierDisplayHtml(
        resolved.courier.fullName,
        resolved.courier.nickname
    );

    const fullHistory = await sessionRepository.getHistoryByCourier(
        resolved.courier.id
    );
    const nextState = isSuperadmin
        ? AdminState.SUPERADMIN_EDIT_COURIER_ACTION_SELECTING
        : AdminState.ADMIN_EDIT_COURIER_ACTION_SELECTING;
    stateManager.setUserState(telegramId, nextState);

    if (!fullHistory.length) {
        await bot.sendMessage(
            chatId,
            `История сессий курьера ${courierDisplay} пуста.`,
            { parse_mode: 'HTML' }
        );
    } else {
        const historyText = formatCourierHistoryRows(fullHistory);
        await bot.sendMessage(
            chatId,
            `Полная история сессий курьера ${courierDisplay}:\n\n${historyText}`,
            { parse_mode: 'HTML' }
        );
    }

    await sendCourierActionsMessage(chatId, resolved.courier, isSuperadmin);
    return true;
}
