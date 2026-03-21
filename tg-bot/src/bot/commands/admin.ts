import TelegramBot from 'node-telegram-bot-api';
import { RegistrationHandler } from '../handlers/registration.handler';
import { CourierService } from '../../services/courier.service';
import { SessionService } from '../../services/session.service';
import { AdminService } from '../../services/admin.service';
import { WarehouseService } from '../../services/warehouse.service';
import { WarehouseRepository } from '../../repositories/warehouse.repository';
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
    const warehouseService = new WarehouseService(new WarehouseRepository());

    const startAdminRegistrationFlow = async (chatId: number, telegramId: number) => {
        stateManager.setUserState(telegramId, AdminState.REGISTER_AWAITING_LOGIN);
        stateManager.resetUserTempData(telegramId);

        await bot.sendMessage(chatId, 'Придумайте и введите логин');
    };

    const startAdminLoginFlow = async (chatId: number, telegramId: number) => {
        stateManager.setUserState(telegramId, AdminState.LOGIN_AWAITING_LOGIN);
        stateManager.resetUserTempData(telegramId);

        await bot.sendMessage(chatId, 'Введите логин');
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
                ? '🛡 Вы уже в админском режиме. Доступны: /admin_login, /admin_register, /admin_logout, /exit_admin.'
                : '🛡 Включен админский режим. Текущий курьерский сценарий остановлен. Доступны: /admin_login, /admin_register, /admin_logout, /exit_admin.',
            { reply_markup: HIDE_REPLY_KEYBOARD }
        );
    });

    bot.onText(/^\/admin_logout(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId) {
            return;
        }

        if (!isUserInAdminMode(telegramId)) {
            await bot.sendMessage(chatId, 'ℹ️ Сначала войдите в админский режим командой /admin.');
            return;
        }

        const currentState = stateManager.getUserState(telegramId);
        const tempData = stateManager.getUserTempData<{ adminId?: number }>(telegramId);
        const adminId = tempData?.adminId;
        const wasAuthenticated = currentState === AdminState.AUTHENTICATED
            || currentState === AdminState.CREATE_WAREHOUSE_AWAITING_NAME
            || currentState === AdminState.CREATE_WAREHOUSE_AWAITING_ADDRESS;

        if (wasAuthenticated && adminId) {
            await adminService.setLoginStatus(adminId, false);
        }

        stateManager.setUserState(telegramId, AdminState.GUEST_MODE);
        stateManager.resetUserTempData(telegramId);

        await bot.sendMessage(
            chatId,
            wasAuthenticated
                ? '✅ Вы вышли из авторизованного админ-режима и возвращены в предадминское состояние. Доступны: /admin_login, /admin_register, /admin_logout, /exit_admin.'
                : 'ℹ️ Вы уже находитесь в предадминском состоянии. Доступны: /admin_login, /admin_register, /admin_logout, /exit_admin.'
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

        await startAdminLoginFlow(chatId, telegramId);
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

    bot.onText(/^\/superadmin_create_warehouse(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId) {
            return;
        }

        if (!isUserInAdminMode(telegramId)) {
            return;
        }

        const currentState = stateManager.getUserState(telegramId);
        const isInAuthenticatedOrSubflow = currentState === AdminState.AUTHENTICATED
            || currentState === AdminState.CREATE_WAREHOUSE_AWAITING_NAME
            || currentState === AdminState.CREATE_WAREHOUSE_AWAITING_ADDRESS;

        if (!isInAuthenticatedOrSubflow) {
            await bot.sendMessage(
                chatId,
                '🔒 Эта команда доступна только авторизованному администратору. Используйте /admin_login.'
            );
            return;
        }

        const tempData = stateManager.getUserTempData<{ adminPermissionsLevel?: number }>(telegramId);
        const permissionsLevel = tempData?.adminPermissionsLevel ?? 0;

        if (permissionsLevel < 2) {
            await bot.sendMessage(chatId, '🚫 Нет прав на эту команду.');
            return;
        }

        stateManager.setUserState(telegramId, AdminState.CREATE_WAREHOUSE_AWAITING_NAME);
        await bot.sendMessage(chatId, 'Введите название склада');
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
            currentState !== AdminState.REGISTER_AWAITING_PASSWORD &&
            currentState !== AdminState.LOGIN_AWAITING_LOGIN &&
            currentState !== AdminState.LOGIN_AWAITING_PASSWORD &&
            currentState !== AdminState.CREATE_WAREHOUSE_AWAITING_NAME &&
            currentState !== AdminState.CREATE_WAREHOUSE_AWAITING_ADDRESS
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

        if (currentState === AdminState.LOGIN_AWAITING_LOGIN) {
            const loginInput = text.trim();
            const loginValidation = adminService.validateLogin(loginInput);
            if (!loginValidation.isValid) {
                await bot.sendMessage(chatId, `${loginValidation.error}\nПопробуйте снова.\n\nВведите логин`);
                return;
            }

            const adminCandidate = await adminService.getLoginCandidate(loginInput);
            if (!adminCandidate) {
                await bot.sendMessage(
                    chatId,
                    'Пользователь с таким логином не найден.\n\nВведите логин'
                );
                return;
            }

            stateManager.setUserTempData(telegramId, {
                adminLoginId: adminCandidate.id,
                adminLoginNickname: adminCandidate.nickname,
                adminLoginPasswordHash: adminCandidate.passwordHash,
                adminLoginPermissionsLevel: adminCandidate.permissionsLevel,
                adminLoginIsActive: adminCandidate.isActive
            });
            stateManager.setUserState(telegramId, AdminState.LOGIN_AWAITING_PASSWORD);
            await bot.sendMessage(chatId, 'Введите пароль');
            return;
        }

        if (currentState === AdminState.LOGIN_AWAITING_PASSWORD) {
            const tempData = stateManager.getUserTempData<{
                adminLoginId?: number;
                adminLoginNickname?: string;
                adminLoginPasswordHash?: string;
                adminLoginPermissionsLevel?: number;
                adminLoginIsActive?: boolean;
            }>(telegramId);

            const adminLoginId = tempData?.adminLoginId;
            const adminLoginPasswordHash = tempData?.adminLoginPasswordHash;
            const adminLoginPermissionsLevel = tempData?.adminLoginPermissionsLevel;
            const adminLoginIsActive = tempData?.adminLoginIsActive;

            if (!adminLoginId || !adminLoginPasswordHash || !adminLoginPermissionsLevel) {
                await startAdminLoginFlow(chatId, telegramId);
                return;
            }

            if (!adminLoginIsActive) {
                await bot.sendMessage(
                    chatId,
                    '⏳ Ваш админ-аккаунт еще не активирован суперадминистратором.\n\nВведите логин'
                );
                stateManager.setUserState(telegramId, AdminState.LOGIN_AWAITING_LOGIN);
                stateManager.resetUserTempData(telegramId);
                return;
            }

            const isPasswordValid = adminService.verifyPassword(text, adminLoginPasswordHash);
            if (!isPasswordValid) {
                await bot.sendMessage(chatId, 'Неверный пароль\n\nВведите пароль');
                return;
            }

            await adminService.setLoginStatus(adminLoginId, true);
            stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
            stateManager.setUserTempData(telegramId, {
                adminId: adminLoginId,
                adminPermissionsLevel: adminLoginPermissionsLevel
            });

            await bot.sendMessage(
                chatId,
                adminLoginPermissionsLevel >= 2
                    ? '✅ Вы успешно вошли как суперадмин.'
                    : '✅ Вы успешно вошли как админ.'
            );

            return;
        }

        if (currentState === AdminState.CREATE_WAREHOUSE_AWAITING_NAME) {
            const nameInput = text.trim();
            if (nameInput.length < 2) {
                await bot.sendMessage(chatId, '❌ Название должно содержать минимум 2 символа.\n\nВведите название склада');
                return;
            }

            stateManager.setUserTempDataField(telegramId, 'createWarehouseName', nameInput);
            stateManager.setUserState(telegramId, AdminState.CREATE_WAREHOUSE_AWAITING_ADDRESS);
            await bot.sendMessage(chatId, 'Введите адрес склада');
            return;
        }

        if (currentState === AdminState.CREATE_WAREHOUSE_AWAITING_ADDRESS) {
            const addressInput = text.trim();
            if (addressInput.length < 2) {
                await bot.sendMessage(chatId, '❌ Адрес должен содержать минимум 2 символа.\n\nВведите адрес склада');
                return;
            }

            const tempData = stateManager.getUserTempData<{
                adminId?: number;
                adminPermissionsLevel?: number;
                createWarehouseName?: string;
            }>(telegramId);
            const warehouseName = tempData?.createWarehouseName;
            const adminId = tempData?.adminId;
            const adminPermissionsLevel = tempData?.adminPermissionsLevel;

            if (!warehouseName) {
                stateManager.setUserState(telegramId, AdminState.CREATE_WAREHOUSE_AWAITING_NAME);
                await bot.sendMessage(chatId, '⚠️ Что-то пошло не так. Введите название склада');
                return;
            }

            const warehouse = await warehouseService.createWarehouse(warehouseName, addressInput);

            stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
            stateManager.resetUserTempData(telegramId);
            if (adminId && adminPermissionsLevel) {
                stateManager.setUserTempData(telegramId, { adminId, adminPermissionsLevel });
            }

            await bot.sendMessage(
                chatId,
                `✅ Успешно создан склад *${warehouse.name}* по адресу *${warehouse.address}*`,
                { parse_mode: 'Markdown' }
            );
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
            '✅ Заявка администратора создана. Ожидайте одобрения суперадминистратором.\n\n🛡 Вы по-прежнему в админском режиме. Доступны: /admin_login, /admin_register, /admin_logout, /exit_admin.'
        );
    });
}
