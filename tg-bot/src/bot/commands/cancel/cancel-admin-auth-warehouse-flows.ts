import TelegramBot from 'node-telegram-bot-api';
import { AdminService } from '../../../services/admin.service';
import { stateManager } from '../../state-manager';
import { AdminState } from '../../../constants/states.constant';
import { getAdminCommandListMessage, isAuthenticatedAdminState } from '../../admin/admin-command-hints';
import {
    isAdminAuthFlowState,
    isAdminGuestOrAuthenticatedState,
    isChangePasswordFlowState,
    isCreateWarehouseFlowState,
    isEditAdminsEntryFlowState,
    isEditWarehouseEntryFlowState,
    isEditWarehouseSubflowState,
    isSetWarehouseFlowState
} from '../../../utils/cancel-admin-state.utils';

interface AuthWarehouseDeps {
    bot: TelegramBot;
    chatId: number;
    userId: number;
    currentState: string;
    adminService: AdminService;
}

async function sendAdminCommandsIfNeeded(
    bot: TelegramBot,
    chatId: number,
    adminPermissionsLevel: number | undefined,
    targetState: string | undefined
): Promise<void> {
    if (!adminPermissionsLevel || !isAuthenticatedAdminState(targetState)) {
        return;
    }

    await bot.sendMessage(
        chatId,
        getAdminCommandListMessage(
            adminPermissionsLevel,
            targetState === AdminState.AUTHENTICATED_WITH_WAREHOUSE
        )
    );
}

export async function handleCancelAuthWarehouseFlows(deps: AuthWarehouseDeps): Promise<boolean> {
    const { bot, chatId, userId, currentState, adminService } = deps;

    if (isAdminAuthFlowState(currentState)) {
        stateManager.setUserState(userId, AdminState.GUEST_MODE);
        stateManager.resetUserTempData(userId);
        await bot.sendMessage(
            chatId,
            '❌ Действие отменено. Вы возвращены в предадминское состояние. Доступны: /admin_login, /admin_register, /admin_logout, /exit_admin.'
        );
        return true;
    }

    if (isAdminGuestOrAuthenticatedState(currentState)) {
        await bot.sendMessage(chatId, 'ℹ️ Нет активного действия для отмены.');
        return true;
    }

    if (isSetWarehouseFlowState(currentState)) {
        const tempData = stateManager.getUserTempData<{
            adminId?: number;
            adminPermissionsLevel?: number;
            adminSetReturnState?: string;
        }>(userId);

        const adminId = tempData?.adminId;
        const adminPermissionsLevel = tempData?.adminPermissionsLevel;
        const returnState = tempData?.adminSetReturnState || AdminState.AUTHENTICATED;

        stateManager.setUserState(userId, returnState);
        stateManager.resetUserTempData(userId);
        if (adminId && adminPermissionsLevel) {
            stateManager.setUserTempData(userId, { adminId, adminPermissionsLevel });
        }

        await bot.sendMessage(chatId, '❌ Выбор склада отменен. Вы возвращены в предыдущее состояние.');
        await sendAdminCommandsIfNeeded(bot, chatId, adminPermissionsLevel, returnState);
        return true;
    }

    if (isCreateWarehouseFlowState(currentState)) {
        const tempData = stateManager.getUserTempData<{
            adminId?: number;
            adminPermissionsLevel?: number;
        }>(userId);

        const adminId = tempData?.adminId;
        const adminPermissionsLevel = tempData?.adminPermissionsLevel;
        const currentWarehouseId = adminId ? await adminService.getAdminWarehouseId(adminId) : null;

        stateManager.setUserState(
            userId,
            currentWarehouseId ? AdminState.AUTHENTICATED_WITH_WAREHOUSE : AdminState.AUTHENTICATED
        );
        stateManager.resetUserTempData(userId);
        if (adminId && adminPermissionsLevel) {
            stateManager.setUserTempData(userId, { adminId, adminPermissionsLevel });
        }

        await bot.sendMessage(chatId, '❌ Создание склада отменено. Вы возвращены в авторизованный админский режим.');
        await sendAdminCommandsIfNeeded(
            bot,
            chatId,
            adminPermissionsLevel,
            currentWarehouseId ? AdminState.AUTHENTICATED_WITH_WAREHOUSE : AdminState.AUTHENTICATED
        );
        return true;
    }

    if (isChangePasswordFlowState(currentState)) {
        const tempData = stateManager.getUserTempData<{
            adminId?: number;
            adminPermissionsLevel?: number;
        }>(userId);

        const adminId = tempData?.adminId;
        const adminPermissionsLevel = tempData?.adminPermissionsLevel;
        const currentWarehouseId = adminId ? await adminService.getAdminWarehouseId(adminId) : null;

        stateManager.setUserState(
            userId,
            currentWarehouseId ? AdminState.AUTHENTICATED_WITH_WAREHOUSE : AdminState.AUTHENTICATED
        );
        stateManager.resetUserTempData(userId);
        if (adminId && adminPermissionsLevel) {
            stateManager.setUserTempData(userId, { adminId, adminPermissionsLevel });
        }

        await bot.sendMessage(chatId, '❌ Смена пароля отменена. Вы возвращены в авторизованный админский режим.');
        await sendAdminCommandsIfNeeded(
            bot,
            chatId,
            adminPermissionsLevel,
            currentWarehouseId ? AdminState.AUTHENTICATED_WITH_WAREHOUSE : AdminState.AUTHENTICATED
        );
        return true;
    }

    if (isEditWarehouseEntryFlowState(currentState)) {
        const tempData = stateManager.getUserTempData<{
            adminId?: number;
            adminPermissionsLevel?: number;
            editReturnState?: string;
        }>(userId);

        const adminId = tempData?.adminId;
        const adminPermissionsLevel = tempData?.adminPermissionsLevel;
        const returnState = tempData?.editReturnState || AdminState.AUTHENTICATED;

        stateManager.setUserState(userId, returnState);
        stateManager.resetUserTempData(userId);
        if (adminId && adminPermissionsLevel) {
            stateManager.setUserTempData(userId, { adminId, adminPermissionsLevel });
        }

        await bot.sendMessage(chatId, '❌ Редактирование складов отменено. Вы возвращены в предыдущее состояние.');
        await sendAdminCommandsIfNeeded(bot, chatId, adminPermissionsLevel, returnState);
        return true;
    }

    if (isEditWarehouseSubflowState(currentState)) {
        const tempData = stateManager.getUserTempData<{
            adminId?: number;
            adminPermissionsLevel?: number;
            selectedWarehouseId?: number;
            editWarehouses?: unknown[];
            editReturnState?: string;
        }>(userId);

        stateManager.setUserState(userId, AdminState.EDIT_WAREHOUSE_ACTION_SELECTING);
        stateManager.resetUserTempData(userId);
        stateManager.setUserTempData(userId, {
            adminId: tempData?.adminId,
            adminPermissionsLevel: tempData?.adminPermissionsLevel,
            selectedWarehouseId: tempData?.selectedWarehouseId,
            editWarehouses: tempData?.editWarehouses,
            editReturnState: tempData?.editReturnState
        });

        await bot.sendMessage(chatId, '❌ Действие отменено. Вы возвращены к выбору операции по складу.');
        return true;
    }

    if (isEditAdminsEntryFlowState(currentState)) {
        const tempData = stateManager.getUserTempData<{
            adminId?: number;
            adminPermissionsLevel?: number;
            editReturnState?: string;
        }>(userId);

        const adminId = tempData?.adminId;
        const adminPermissionsLevel = tempData?.adminPermissionsLevel;
        const returnState = tempData?.editReturnState || AdminState.AUTHENTICATED;

        stateManager.setUserState(userId, returnState);
        stateManager.resetUserTempData(userId);
        if (adminId && adminPermissionsLevel) {
            stateManager.setUserTempData(userId, { adminId, adminPermissionsLevel });
        }

        await bot.sendMessage(chatId, '❌ Редактирование администраторов отменено. Вы возвращены в предыдущее состояние.');
        await sendAdminCommandsIfNeeded(bot, chatId, adminPermissionsLevel, returnState);
        return true;
    }

    return false;
}
