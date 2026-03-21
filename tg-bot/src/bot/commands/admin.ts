import TelegramBot from 'node-telegram-bot-api';
import { RegistrationHandler } from '../handlers/registration.handler';
import { CourierService } from '../../services/courier.service';
import { SessionService } from '../../services/session.service';
import {
    enterAdminMode,
    exitAdminMode,
    isUserInAdminMode
} from '../admin/admin-mode';
import { sendCourierMainKeyboard } from '../keyboards/courier-main-keyboard';

const HIDE_REPLY_KEYBOARD: TelegramBot.ReplyKeyboardRemove = {
    remove_keyboard: true
};

async function restoreCourierFlowAfterExitAdmin(
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

    await sendCourierMainKeyboard(bot, chatId, telegramId, courierService, sessionService);
}

export function registerAdminModeCommands(
    bot: TelegramBot,
    courierService: CourierService,
    registrationHandler: RegistrationHandler,
    sessionService: SessionService
) {
    bot.onText(/^\/admin(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId) {
            return;
        }

        const wasInAdminMode = isUserInAdminMode(telegramId);
        enterAdminMode(telegramId);

        await bot.sendMessage(
            chatId,
            wasInAdminMode
                ? '🛡 Вы уже в админском режиме. Доступны: /admin_login, /admin_register, /exit_admin.'
                : '🛡 Включен админский режим. Текущий курьерский сценарий остановлен. Доступны: /admin_login, /admin_register, /exit_admin.',
            { reply_markup: HIDE_REPLY_KEYBOARD }
        );
    });

    bot.onText(/^\/exit_admin(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId) {
            return;
        }

        if (!isUserInAdminMode(telegramId)) {
            await bot.sendMessage(chatId, 'ℹ️ Админский режим уже выключен.');
            return;
        }

        exitAdminMode(telegramId);
        await bot.sendMessage(chatId, '✅ Админский режим выключен. Возвращаем вас в курьерский режим...');

        await restoreCourierFlowAfterExitAdmin(
            bot,
            chatId,
            telegramId,
            courierService,
            registrationHandler,
            sessionService
        );
    });

    bot.onText(/^\/admin_login(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId) {
            return;
        }

        if (!isUserInAdminMode(telegramId)) {
            await bot.sendMessage(chatId, 'ℹ️ Сначала войдите в админский режим командой /admin.');
            return;
        }

        await bot.sendMessage(chatId, '🚧 Вход администратора пока не реализован.');
    });

    bot.onText(/^\/admin_register(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId) {
            return;
        }

        if (!isUserInAdminMode(telegramId)) {
            await bot.sendMessage(chatId, 'ℹ️ Сначала войдите в админский режим командой /admin.');
            return;
        }

        await bot.sendMessage(chatId, '🚧 Регистрация администратора пока не реализована.');
    });
}
