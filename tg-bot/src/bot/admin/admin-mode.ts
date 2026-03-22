import TelegramBot from 'node-telegram-bot-api';
import { extractCommand } from '../../constants/commands.constant';
import { AdminState } from '../../constants/states.constant';
import { convertKeyboardButtonToCommand } from '../../utils/telegram.utils';
import { stateManager } from '../state-manager';

const ADMIN_GUEST_ALLOWED_COMMANDS = new Set<string>([
    '/admin',
    '/exit_admin',
    '/admin_logout',
    '/admin_login',
    '/admin_register',
    '/cancel'
]);

const ADMIN_MODE_STATES = new Set<string>([
    AdminState.GUEST_MODE,
    AdminState.REGISTER_AWAITING_LOGIN,
    AdminState.REGISTER_AWAITING_PASSWORD,
    AdminState.LOGIN_AWAITING_LOGIN,
    AdminState.LOGIN_AWAITING_PASSWORD,
    AdminState.AUTHENTICATED,
    AdminState.AUTHENTICATED_WITH_WAREHOUSE,
    AdminState.CHANGE_PASSWORD_AWAITING_NEW,
    AdminState.SET_WAREHOUSE_SELECTING,
    AdminState.CREATE_WAREHOUSE_AWAITING_NAME,
    AdminState.CREATE_WAREHOUSE_AWAITING_ADDRESS,
    AdminState.EDIT_WAREHOUSES_SELECTING,
    AdminState.EDIT_WAREHOUSE_ACTION_SELECTING,
    AdminState.EDIT_WAREHOUSE_AWAITING_NAME,
    AdminState.EDIT_WAREHOUSE_AWAITING_ADDRESS,
    AdminState.EDIT_WAREHOUSE_AWAITING_STATUS,
    AdminState.EDIT_WAREHOUSE_AWAITING_DELETE_CONFIRM,
    AdminState.EDIT_ADMINS_SELECTING,
    AdminState.EDIT_ADMIN_ACTION_SELECTING,
    AdminState.EDIT_ADMIN_AWAITING_STATUS,
    AdminState.EDIT_ADMIN_AWAITING_DELETE_CONFIRM,
    AdminState.EDIT_ADMIN_AWAITING_PASSWORD,
    AdminState.ADD_SIM_AWAITING_NUMBER,
    AdminState.SIM_INTERACTIONS_SELECTING,
    AdminState.SIM_INTERACTION_ACTION_SELECTING,
    AdminState.SIM_INTERACTION_AWAITING_ACTIVE_STATUS,
    AdminState.SIM_INTERACTION_AWAITING_CONDITION_STATUS,
    AdminState.SIM_INTERACTION_AWAITING_DELETE_CONFIRM
]);

function normalizeInputToCommand(text?: string): string | null {
    if (!text) {
        return null;
    }

    const normalizedText = convertKeyboardButtonToCommand(text.trim());
    return extractCommand(normalizedText);
}

export function isUserInAdminMode(telegramId: number): boolean {
    const state = stateManager.getUserState(telegramId);
    return !!state && ADMIN_MODE_STATES.has(state);
}

export function enterAdminMode(telegramId: number): void {
    // Полностью очищаем пользовательский процесс перед входом в админ-режим.
    stateManager.clearUser(telegramId);
    stateManager.setUserState(telegramId, AdminState.GUEST_MODE);
}

export function exitAdminMode(telegramId: number): void {
    stateManager.clearUser(telegramId);
}

export async function blockIfAdminGuestCommandNotAllowed(
    bot: TelegramBot,
    chatId: number,
    telegramId: number,
    text?: string
): Promise<boolean> {
    if (!isUserInAdminMode(telegramId)) {
        return false;
    }

    const command = normalizeInputToCommand(text);
    if (command && ADMIN_GUEST_ALLOWED_COMMANDS.has(command)) {
        return false;
    }

    await bot.sendMessage(
        chatId,
        '🔒 Сейчас включен админский режим (без входа). Доступны только команды: /admin_login, /admin_register, /admin_logout, /exit_admin.'
    );

    return true;
}
