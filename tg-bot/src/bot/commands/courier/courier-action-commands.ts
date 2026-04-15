import TelegramBot from 'node-telegram-bot-api';
import { isUserInAdminMode } from '../../admin/admin-mode';
import { stateManager } from '../../state-manager';
import { AdminState } from '../../../constants/states.constant';
import { escapeHtml } from '../../../utils/admin-format.utils';
import { getActiveStatusText as getAdminStatusText } from '../../../utils/admin-status.utils';
import { AdminSessionData, EditableCourierSessionItem } from '../admin.types';

type TryResolveSelectedEditCourier = (
    telegramId: number,
    chatId: number,
    commandLink: string
) => Promise<{
    tempData: AdminSessionData;
    courier: EditableCourierSessionItem;
} | null>;

/** Регистрирует команды изменения статуса/ФИО курьера. */
export function registerCourierActionCommands(
    bot: TelegramBot,
    tryResolveSelectedEditCourier: TryResolveSelectedEditCourier
): void {
    bot.onText(/^\/admin_edit_courier_status(?:@\w+)?$/, async (msg) => {
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

        stateManager.setUserState(
            telegramId,
            AdminState.ADMIN_EDIT_COURIER_AWAITING_STATUS
        );
        await bot.sendMessage(
            chatId,
            `Курьер: <b>${escapeHtml(resolved.courier.fullName)}</b>\nТекущий статус: <b>${getAdminStatusText(resolved.courier.isActive)}</b>\n\nВыберите статус:\n1. Активный\n2. Отключен`,
            { parse_mode: 'HTML' }
        );
    });

    bot.onText(/^\/superadmin_edit_courier_status(?:@\w+)?$/, async (msg) => {
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

        stateManager.setUserState(
            telegramId,
            AdminState.SUPERADMIN_EDIT_COURIER_AWAITING_STATUS
        );
        await bot.sendMessage(
            chatId,
            `Курьер: <b>${escapeHtml(resolved.courier.fullName)}</b>\nТекущий статус: <b>${getAdminStatusText(resolved.courier.isActive)}</b>\n\nВыберите статус:\n1. Активный\n2. Отключен`,
            { parse_mode: 'HTML' }
        );
    });

    bot.onText(/^\/admin_edit_courier_name(?:@\w+)?$/, async (msg) => {
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

        stateManager.setUserState(
            telegramId,
            AdminState.ADMIN_EDIT_COURIER_AWAITING_NAME
        );
        await bot.sendMessage(
            chatId,
            `Курьер: <b>${escapeHtml(resolved.courier.fullName)}</b>\n\nВведите новое ФИО (минимум 2 символа).\n/cancel - вернуться к информации о выбранном курьере.`,
            { parse_mode: 'HTML' }
        );
    });

    bot.onText(/^\/superadmin_edit_courier_name(?:@\w+)?$/, async (msg) => {
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

        stateManager.setUserState(
            telegramId,
            AdminState.SUPERADMIN_EDIT_COURIER_AWAITING_NAME
        );
        await bot.sendMessage(
            chatId,
            `Курьер: <b>${escapeHtml(resolved.courier.fullName)}</b>\n\nВведите новое ФИО (минимум 2 символа).\n/cancel - вернуться к информации о выбранном курьере.`,
            { parse_mode: 'HTML' }
        );
    });
}
