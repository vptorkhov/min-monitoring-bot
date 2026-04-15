import TelegramBot from 'node-telegram-bot-api';
import { AdminService } from '../../../services/admin.service';
import { stateManager } from '../../state-manager';
import { AdminState } from '../../../constants/states.constant';
import { getAuthenticatedAdminWelcomeMessage } from './admin-flow.utils';
import { AdminSessionData } from '../admin.types';

export async function handleAuthAdminMessage(
    bot: TelegramBot,
    adminService: AdminService,
    startAdminLoginFlow: (chatId: number, telegramId: number) => Promise<void>,
    startAdminRegistrationFlow: (
        chatId: number,
        telegramId: number
    ) => Promise<void>,
    telegramId: number,
    chatId: number,
    text: string,
    currentState: string | undefined
): Promise<boolean> {
    if (currentState === AdminState.REGISTER_AWAITING_LOGIN) {
        const loginInput = text.trim();
        const loginValidation = adminService.validateLogin(loginInput);
        if (!loginValidation.isValid) {
            await bot.sendMessage(
                chatId,
                `${loginValidation.error}\nПопробуйте снова.\n\nПридумайте и введите логин`
            );
            return true;
        }

        const isTaken = await adminService.isLoginTakenInsensitive(loginInput);
        if (isTaken) {
            await bot.sendMessage(
                chatId,
                'Логин уже занят (без учета регистра). Выберите другой.\n\nПридумайте и введите логин'
            );
            return true;
        }

        stateManager.setUserTempDataField(
            telegramId,
            'adminRegisterLogin',
            loginInput
        );
        stateManager.setUserState(
            telegramId,
            AdminState.REGISTER_AWAITING_PASSWORD
        );
        await bot.sendMessage(
            chatId,
            'Придумайте и введите пароль. Требования - не менее 6 символов.'
        );
        return true;
    }

    if (currentState === AdminState.LOGIN_AWAITING_LOGIN) {
        const loginInput = text.trim();
        const loginValidation = adminService.validateLogin(loginInput);
        if (!loginValidation.isValid) {
            await bot.sendMessage(
                chatId,
                `${loginValidation.error}\nПопробуйте снова.\n\nВведите логин`
            );
            return true;
        }

        const adminCandidate = await adminService.getLoginCandidate(loginInput);
        if (!adminCandidate) {
            await bot.sendMessage(
                chatId,
                'Пользователь с таким логином не найден.\n\nВведите логин'
            );
            return true;
        }

        stateManager.setUserTempData(telegramId, {
            adminLoginId: adminCandidate.id,
            adminLoginNickname: adminCandidate.nickname,
            adminLoginPasswordHash: adminCandidate.passwordHash,
            adminLoginPermissionsLevel: adminCandidate.permissionsLevel,
            adminLoginIsActive: adminCandidate.isActive,
            adminLoginWarehouseId: adminCandidate.warehouseId
        });
        stateManager.setUserState(
            telegramId,
            AdminState.LOGIN_AWAITING_PASSWORD
        );
        await bot.sendMessage(chatId, 'Введите пароль');
        return true;
    }

    if (currentState === AdminState.LOGIN_AWAITING_PASSWORD) {
        const tempData = stateManager.getUserTempData<{
            adminLoginId?: number;
            adminLoginNickname?: string;
            adminLoginPasswordHash?: string;
            adminLoginPermissionsLevel?: number;
            adminLoginIsActive?: boolean;
            adminLoginWarehouseId?: number | null;
        }>(telegramId);

        const adminLoginId = tempData?.adminLoginId;
        const adminLoginPasswordHash = tempData?.adminLoginPasswordHash;
        const adminLoginPermissionsLevel = tempData?.adminLoginPermissionsLevel;
        const adminLoginIsActive = tempData?.adminLoginIsActive;
        const adminLoginWarehouseId = tempData?.adminLoginWarehouseId;

        if (
            !adminLoginId ||
            !adminLoginPasswordHash ||
            !adminLoginPermissionsLevel
        ) {
            await startAdminLoginFlow(chatId, telegramId);
            return true;
        }

        if (!adminLoginIsActive) {
            await bot.sendMessage(
                chatId,
                '⏳ Ваш админ-аккаунт еще не активирован суперадминистратором.\n\nВведите логин'
            );
            stateManager.setUserState(
                telegramId,
                AdminState.LOGIN_AWAITING_LOGIN
            );
            stateManager.resetUserTempData(telegramId);
            return true;
        }

        const isPasswordValid = adminService.verifyPassword(
            text,
            adminLoginPasswordHash
        );
        if (!isPasswordValid) {
            await bot.sendMessage(chatId, 'Неверный пароль\n\nВведите пароль');
            return true;
        }

        await adminService.setLoginStatus(adminLoginId, true);
        stateManager.setUserState(
            telegramId,
            adminLoginWarehouseId
                ? AdminState.AUTHENTICATED_WITH_WAREHOUSE
                : AdminState.AUTHENTICATED
        );
        stateManager.setUserTempData(telegramId, {
            adminId: adminLoginId,
            adminPermissionsLevel: adminLoginPermissionsLevel
        });

        await bot.sendMessage(
            chatId,
            getAuthenticatedAdminWelcomeMessage(
                adminLoginPermissionsLevel,
                !!adminLoginWarehouseId
            )
        );

        return true;
    }

    if (currentState === AdminState.REGISTER_AWAITING_PASSWORD) {
        const passwordInput = text.trim();
        const passwordValidation = adminService.validatePassword(passwordInput);
        if (!passwordValidation.isValid) {
            await bot.sendMessage(
                chatId,
                'Пароль не соответствует требованиям.\nПридумайте и введите пароль. Требования - не менее 6 символов.'
            );
            return true;
        }

        const tempData = stateManager.getUserTempData<{
            adminRegisterLogin?: string;
        }>(telegramId);
        const adminRegisterLogin = tempData?.adminRegisterLogin;

        if (!adminRegisterLogin) {
            await startAdminRegistrationFlow(chatId, telegramId);
            return true;
        }

        const registrationResult = await adminService.registerPendingAdmin(
            adminRegisterLogin,
            passwordInput
        );
        if (!registrationResult.success) {
            if (registrationResult.duplicateInsensitive) {
                await bot.sendMessage(
                    chatId,
                    'Логин уже занят (без учета регистра). Выберите другой.\n\nПридумайте и введите логин'
                );
                stateManager.setUserState(
                    telegramId,
                    AdminState.REGISTER_AWAITING_LOGIN
                );
                stateManager.resetUserTempData(telegramId);
                return true;
            }

            await bot.sendMessage(
                chatId,
                '❌ Не удалось зарегистрировать администратора. Попробуйте позже.'
            );
            return true;
        }

        stateManager.setUserState(telegramId, AdminState.GUEST_MODE);
        stateManager.resetUserTempData(telegramId);

        await bot.sendMessage(
            chatId,
            '✅ Заявка администратора создана. Ожидайте одобрения суперадминистратором.\n\n🛡 Вы по-прежнему в админском режиме. Доступны: /admin_login, /admin_register, /admin_logout, /exit_admin.'
        );
        return true;
    }

    if (currentState === AdminState.CHANGE_PASSWORD_AWAITING_NEW) {
        const passwordInput = text.trim();
        const passwordValidation = adminService.validatePassword(passwordInput);
        if (!passwordValidation.isValid) {
            await bot.sendMessage(
                chatId,
                '❌ Пароль должен содержать минимум 6 символов.\n\nВведите новый пароль, не менее 6 символов'
            );
            return true;
        }

        const tempData =
            stateManager.getUserTempData<AdminSessionData>(telegramId);
        const adminId = tempData?.adminId;
        const adminPermissionsLevel = tempData?.adminPermissionsLevel;
        if (!adminId || !adminPermissionsLevel) {
            stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
            stateManager.resetUserTempData(telegramId);
            await bot.sendMessage(
                chatId,
                '⚠️ Не удалось определить администратора. Выполните /admin_login повторно.'
            );
            return true;
        }

        const result = await adminService.changePassword(
            adminId,
            passwordInput
        );
        if (!result.success) {
            await bot.sendMessage(
                chatId,
                `❌ ${result.reason || 'Не удалось сменить пароль.'}\n\nВведите новый пароль, не менее 6 символов`
            );
            return true;
        }

        const currentWarehouseId =
            await adminService.getAdminWarehouseId(adminId);
        const authenticatedState = currentWarehouseId
            ? AdminState.AUTHENTICATED_WITH_WAREHOUSE
            : AdminState.AUTHENTICATED;

        stateManager.setUserState(telegramId, authenticatedState);
        stateManager.resetUserTempData(telegramId);
        stateManager.setUserTempData(telegramId, {
            adminId,
            adminPermissionsLevel
        });

        await bot.sendMessage(
            chatId,
            '✅ Пароль успешно изменен. Вы остаетесь в авторизованном админ-режиме.'
        );
        return true;
    }

    return false;
}
