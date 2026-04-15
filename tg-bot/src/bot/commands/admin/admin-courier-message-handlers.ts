import TelegramBot from 'node-telegram-bot-api';
import { CourierRepository } from '../../../repositories/courier.repository';
import { SessionRepository } from '../../../repositories/session.repository';
import { AdminSessionData, EditableCourierSessionItem } from '../admin.types';
import { handleCourierSelectionAndEditMessage } from './admin-courier-message-selection-handlers';
import { handleCourierHistoryMessage } from './admin-courier-message-history-handlers';

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

/** Обрабатывает message-state сценарии редактирования курьера в admin-flow. */
export async function handleCourierAdminMessage(
    bot: TelegramBot,
    courierRepository: CourierRepository,
    sessionRepository: SessionRepository,
    telegramId: number,
    chatId: number,
    text: string,
    currentState: string | undefined,
    sendAdminCommandsIfNeeded: SendAdminCommandsIfNeeded,
    restoreToAuthenticatedWithAdminContext: RestoreToAuthenticatedWithAdminContext,
    tryResolveSelectedEditCourier: TryResolveSelectedEditCourier,
    sendCourierActionsMessage: SendCourierActionsMessage
): Promise<boolean> {
    if (
        await handleCourierSelectionAndEditMessage(
            bot,
            courierRepository,
            telegramId,
            chatId,
            text,
            currentState,
            sendAdminCommandsIfNeeded,
            restoreToAuthenticatedWithAdminContext,
            tryResolveSelectedEditCourier,
            sendCourierActionsMessage
        )
    ) {
        return true;
    }

    return handleCourierHistoryMessage(
        bot,
        sessionRepository,
        telegramId,
        chatId,
        text,
        currentState,
        tryResolveSelectedEditCourier,
        sendCourierActionsMessage
    );
}
