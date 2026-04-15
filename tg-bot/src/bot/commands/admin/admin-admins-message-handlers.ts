import TelegramBot from 'node-telegram-bot-api';
import { AdminService } from '../../../services/admin.service';
import { stateManager } from '../../state-manager';
import { AdminState } from '../../../constants/states.constant';
import {
    getActiveStatusText as getAdminStatusText,
    parseActiveStatusInput as parseAdminStatusInput
} from '../../../utils/admin-status.utils';
import { AdminSessionData, EditableAdminSessionItem } from '../admin.types';

type TryResolveSelectedAdmin = (
    telegramId: number,
    chatId: number
) => Promise<{
    tempData: AdminSessionData;
    admin: EditableAdminSessionItem;
} | null>;

type LoadEditableAdmins = () => Promise<EditableAdminSessionItem[]>;

type SendAdminActionsMessage = (
    chatId: number,
    admin: EditableAdminSessionItem
) => Promise<void>;

type SendEditableAdminsListMessage = (
    chatId: number,
    admins: EditableAdminSessionItem[]
) => Promise<void>;

export async function handleAdminEditorsMessage(
    bot: TelegramBot,
    adminService: AdminService,
    telegramId: number,
    chatId: number,
    text: string,
    currentState: string | undefined,
    tryResolveSelectedAdmin: TryResolveSelectedAdmin,
    loadEditableAdmins: LoadEditableAdmins,
    sendAdminActionsMessage: SendAdminActionsMessage,
    sendEditableAdminsListMessage: SendEditableAdminsListMessage
): Promise<boolean> {
    if (currentState === AdminState.EDIT_ADMINS_SELECTING) {
        const tempData =
            stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        const admins = tempData.editAdmins;

        if (!admins?.length) {
            stateManager.setUserState(
                telegramId,
                tempData.editReturnState || AdminState.AUTHENTICATED
            );
            stateManager.resetUserTempData(telegramId);
            if (tempData.adminId && tempData.adminPermissionsLevel) {
                stateManager.setUserTempData(telegramId, {
                    adminId: tempData.adminId,
                    adminPermissionsLevel: tempData.adminPermissionsLevel
                });
            }
            await bot.sendMessage(
                chatId,
                '❌ Что-то пошло не так. Запустите /superadmin_edit_admins заново.'
            );
            return true;
        }

        if (!/^\d+$/.test(text.trim())) {
            await bot.sendMessage(
                chatId,
                '❌ Введите корректный номер администратора из списка.'
            );
            return true;
        }

        const index = parseInt(text.trim(), 10) - 1;
        if (index < 0 || index >= admins.length) {
            await bot.sendMessage(
                chatId,
                '❌ Администратор с таким номером не найден. Введите номер из списка.'
            );
            return true;
        }

        const selectedAdmin = admins[index];
        stateManager.setUserState(
            telegramId,
            AdminState.EDIT_ADMIN_ACTION_SELECTING
        );
        stateManager.setUserTempData(telegramId, {
            selectedEditAdminId: selectedAdmin.id
        });

        await sendAdminActionsMessage(chatId, selectedAdmin);
        return true;
    }

    if (currentState === AdminState.EDIT_ADMIN_ACTION_SELECTING) {
        await bot.sendMessage(
            chatId,
            'ℹ️ Выберите действие командой: /superadmin_edit_admin_status, /superadmin_edit_admin_delete или /superadmin_edit_admin_password.'
        );
        return true;
    }

    if (currentState === AdminState.EDIT_ADMIN_AWAITING_STATUS) {
        const status = parseAdminStatusInput(text);
        if (status === null) {
            await bot.sendMessage(
                chatId,
                '❌ Некорректный выбор статуса. Введите 1 (Активный) или 2 (Отключен).'
            );
            return true;
        }

        const resolved = await tryResolveSelectedAdmin(telegramId, chatId);
        if (!resolved) {
            return true;
        }

        const changeResult = await adminService.changeAdminActiveStatus(
            resolved.admin.id,
            status
        );
        if (!changeResult.success) {
            await bot.sendMessage(
                chatId,
                `❌ ${changeResult.reason || 'Не удалось изменить статус администратора.'}`
            );
            return true;
        }

        const updatedAdmin = await adminService.getAdminById(resolved.admin.id);
        if (!updatedAdmin || updatedAdmin.permissionsLevel >= 2) {
            await bot.sendMessage(
                chatId,
                '❌ Администратор не найден. Запустите /superadmin_edit_admins заново.'
            );
            return true;
        }

        const updatedAdminForSession: EditableAdminSessionItem = {
            id: updatedAdmin.id,
            nickname: updatedAdmin.nickname,
            isActive: updatedAdmin.isActive
        };

        const tempData =
            stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        const updatedList = (tempData.editAdmins || []).map((admin) =>
            admin.id === updatedAdminForSession.id
                ? updatedAdminForSession
                : admin
        );

        stateManager.setUserState(
            telegramId,
            AdminState.EDIT_ADMIN_ACTION_SELECTING
        );
        stateManager.setUserTempData(telegramId, {
            editAdmins: updatedList
        });

        await bot.sendMessage(
            chatId,
            `✅ Статус администратора изменен на <b>${getAdminStatusText(updatedAdminForSession.isActive)}</b>`,
            { parse_mode: 'HTML' }
        );
        await sendAdminActionsMessage(chatId, updatedAdminForSession);
        return true;
    }

    if (currentState === AdminState.EDIT_ADMIN_AWAITING_DELETE_CONFIRM) {
        if (text.trim() !== 'ДА') {
            await bot.sendMessage(
                chatId,
                '❌ Для удаления администратора введите строго ДА.'
            );
            return true;
        }

        const resolved = await tryResolveSelectedAdmin(telegramId, chatId);
        if (!resolved) {
            return true;
        }

        const deleteResult = await adminService.deleteAdmin(resolved.admin.id);
        if (!deleteResult.success) {
            await bot.sendMessage(
                chatId,
                `❌ ${deleteResult.reason || 'Не удалось удалить администратора.'}`
            );
            return true;
        }

        const tempData =
            stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        const editableAdmins = await loadEditableAdmins();
        if (!editableAdmins.length) {
            const fallbackState =
                tempData.editReturnState || AdminState.AUTHENTICATED;
            stateManager.setUserState(telegramId, fallbackState);
            stateManager.resetUserTempData(telegramId);
            if (tempData.adminId && tempData.adminPermissionsLevel) {
                stateManager.setUserTempData(telegramId, {
                    adminId: tempData.adminId,
                    adminPermissionsLevel: tempData.adminPermissionsLevel
                });
            }

            await bot.sendMessage(
                chatId,
                '✅ Администратор успешно удален. Больше администраторов нет. Вы возвращены в предыдущее состояние.'
            );
            return true;
        }

        stateManager.setUserState(telegramId, AdminState.EDIT_ADMINS_SELECTING);
        stateManager.setUserTempData(telegramId, {
            editAdmins: editableAdmins,
            selectedEditAdminId: undefined
        });

        await bot.sendMessage(chatId, '✅ Администратор успешно удален.');
        await sendEditableAdminsListMessage(chatId, editableAdmins);
        return true;
    }

    if (currentState === AdminState.EDIT_ADMIN_AWAITING_PASSWORD) {
        const passwordInput = text.trim();
        const passwordValidation = adminService.validatePassword(passwordInput);
        if (!passwordValidation.isValid) {
            await bot.sendMessage(
                chatId,
                '❌ Пароль должен содержать минимум 6 символов.\n\nВведите новый пароль, не менее 6 символов'
            );
            return true;
        }

        const resolved = await tryResolveSelectedAdmin(telegramId, chatId);
        if (!resolved) {
            return true;
        }

        const result = await adminService.changePassword(
            resolved.admin.id,
            passwordInput
        );
        if (!result.success) {
            await bot.sendMessage(
                chatId,
                `❌ ${result.reason || 'Не удалось сменить пароль.'}\n\nВведите новый пароль, не менее 6 символов`
            );
            return true;
        }

        stateManager.setUserState(
            telegramId,
            AdminState.EDIT_ADMIN_ACTION_SELECTING
        );
        await bot.sendMessage(
            chatId,
            '✅ Пароль администратора успешно изменен.'
        );
        await sendAdminActionsMessage(chatId, resolved.admin);
        return true;
    }

    return false;
}
