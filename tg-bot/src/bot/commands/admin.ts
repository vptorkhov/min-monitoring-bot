import TelegramBot from 'node-telegram-bot-api';
import { RegistrationHandler } from '../handlers/registration.handler';
import { CourierService } from '../../services/courier.service';
import { SessionService } from '../../services/session.service';
import { AdminService } from '../../services/admin.service';
import {
    enterAdminMode,
    exitAdminMode,
    isUserInAdminMode
} from '../admin/admin-mode';
import { sendCourierMainKeyboard } from '../keyboards/courier-main-keyboard';
import { stateManager } from '../state-manager';
import { isCommand } from '../../constants/commands.constant';
import { AdminState } from '../../constants/states.constant';

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
    const adminService = new AdminService();

    const startAdminRegistrationFlow = async (chatId: number, telegramId: number) => {
        stateManager.setUserState(telegramId, AdminState.REGISTER_AWAITING_LOGIN);
        stateManager.resetUserTempData(telegramId);

        await bot.sendMessage(chatId, 'Придумайте и введите логин');
    };

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

        await startAdminRegistrationFlow(chatId, telegramId);
    });

    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;
        if (!telegramId) {
            return;
        }

        const currentState = stateManager.getUserState(telegramId);
        if (
            currentState !== AdminState.REGISTER_AWAITING_LOGIN &&
            currentState !== AdminState.REGISTER_AWAITING_PASSWORD
        ) {
            return;
        }

        const text = msg.text || '';
        if (!text) {
            return;
        }

        // Команды в ходе регистрации не перехватываем, их обрабатывают command-handlers.
        if (isCommand(text)) {
            return;
        }

        if (currentState === AdminState.REGISTER_AWAITING_LOGIN) {
            const loginInput = text.trim();
            const loginValidation = adminService.validateLogin(loginInput);
            if (!loginValidation.isValid) {
                await bot.sendMessage(
                    chatId,
                    `${loginValidation.error}\nПопробуйте снова.\n\nПридумайте и введите логин`
                );
                return;
            }

            const isTaken = await adminService.isLoginTakenInsensitive(loginInput);
            if (isTaken) {
                await bot.sendMessage(
                    chatId,
                    'Логин уже занят (без учета регистра). Выберите другой.\n\nПридумайте и введите логин'
                );
                return;
            }

            stateManager.setUserTempDataField(telegramId, 'adminRegisterLogin', loginInput);
            stateManager.setUserState(telegramId, AdminState.REGISTER_AWAITING_PASSWORD);
            await bot.sendMessage(chatId, 'Придумайте и введите пароль. Требования - не менее 6 символов.');
            return;
        }

        const passwordValidation = adminService.validatePassword(text);
        if (!passwordValidation.isValid) {
            await bot.sendMessage(
                chatId,
                'Пароль не соответствует требованиям.\nПридумайте и введите пароль. Требования - не менее 6 символов.'
            );
            return;
        }

        const tempData = stateManager.getUserTempData<{ adminRegisterLogin?: string }>(telegramId);
        const adminRegisterLogin = tempData?.adminRegisterLogin;

        if (!adminRegisterLogin) {
            await startAdminRegistrationFlow(chatId, telegramId);
            return;
        }

        const registrationResult = await adminService.registerPendingAdmin(adminRegisterLogin, text);
        if (!registrationResult.success) {
            if (registrationResult.duplicateInsensitive) {
                await bot.sendMessage(
                    chatId,
                    'Логин уже занят (без учета регистра). Выберите другой.\n\nПридумайте и введите логин'
                );
                stateManager.setUserState(telegramId, AdminState.REGISTER_AWAITING_LOGIN);
                stateManager.resetUserTempData(telegramId);
                return;
            }

            await bot.sendMessage(chatId, '❌ Не удалось зарегистрировать администратора. Попробуйте позже.');
            return;
        }

        stateManager.setUserState(telegramId, AdminState.GUEST_MODE);
        stateManager.resetUserTempData(telegramId);

        await bot.sendMessage(
            chatId,
            '✅ Заявка администратора создана. Ожидайте одобрения суперадминистратором.\n\n🛡 Вы по-прежнему в админском режиме. Доступны: /admin_login, /admin_register, /exit_admin.'
        );
    });
}
