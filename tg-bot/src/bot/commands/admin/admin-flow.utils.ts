import TelegramBot from 'node-telegram-bot-api';
import { RegistrationHandler } from '../../handlers/registration.handler';
import { CourierService } from '../../../services/courier.service';
import { SessionService } from '../../../services/session.service';
import { getAdminCommandListMessage } from '../../admin/admin-command-hints';
import { sendCourierMainKeyboard } from '../../keyboards/courier-main-keyboard';

/** Возвращает приветственный текст авторизованного администратора. */
export function getAuthenticatedAdminWelcomeMessage(
    adminPermissionsLevel: number,
    isWarehouseSelected: boolean
): string {
    return getAdminCommandListMessage(
        adminPermissionsLevel,
        isWarehouseSelected
    );
}

/** Возвращает пользователя из admin-mode в соответствующий courier-flow. */
export async function restoreCourierFlowAfterExitAdmin(
    bot: TelegramBot,
    chatId: number,
    telegramId: number,
    courierService: CourierService,
    registrationHandler: RegistrationHandler,
    sessionService: SessionService
): Promise<void> {
    const check = await courierService.checkCourierExists(telegramId);

    if (!check.exists) {
        await registrationHandler.startRegistration(chatId, telegramId);
        return;
    }

    if (!check.isActive) {
        await bot.sendMessage(
            chatId,
            '⏳ Ваш курьерский аккаунт ещё не активирован администратором. Доступные команды: /start и /admin.'
        );
        return;
    }

    await sendCourierMainKeyboard(
        bot,
        chatId,
        telegramId,
        courierService,
        sessionService
    );
}
