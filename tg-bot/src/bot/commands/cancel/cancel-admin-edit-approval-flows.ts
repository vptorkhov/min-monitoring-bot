import TelegramBot from 'node-telegram-bot-api';
import { AdminService } from '../../../services/admin.service';
import { CourierService } from '../../../services/courier.service';
import { stateManager } from '../../state-manager';
import { AdminState } from '../../../constants/states.constant';
import {
    getAdminCommandListMessage,
    isAuthenticatedAdminState
} from '../../admin/admin-command-hints';
import {
    isApplyRegistrationConfirmState,
    isApplyRegistrationsSelectingState,
    isEditAdminActionFlowState,
    isEditAdminSubflowState
} from '../../../utils/cancel-admin-state.utils';
import {
    formatEditableAdminsPlainList,
    formatPendingCourierApprovalsPlainList
} from '../../../utils/admin-selection-format.utils';

interface EditApprovalDeps {
    bot: TelegramBot;
    chatId: number;
    userId: number;
    currentState: string;
    adminService: AdminService;
    courierService: CourierService;
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

export async function handleCancelEditApprovalFlows(deps: EditApprovalDeps): Promise<boolean> {
    const { bot, chatId, userId, currentState, adminService, courierService } = deps;

    if (isEditAdminActionFlowState(currentState)) {
        const tempData = stateManager.getUserTempData<{
            adminId?: number;
            adminPermissionsLevel?: number;
            editReturnState?: string;
        }>(userId);

        const editableAdmins = (await adminService.getEditableAdmins())
            .filter((admin) => admin.permissionsLevel < 2);

        if (!editableAdmins.length) {
            const adminId = tempData?.adminId;
            const adminPermissionsLevel = tempData?.adminPermissionsLevel;
            const returnState = tempData?.editReturnState || AdminState.AUTHENTICATED;

            stateManager.setUserState(userId, returnState);
            stateManager.resetUserTempData(userId);
            if (adminId && adminPermissionsLevel) {
                stateManager.setUserTempData(userId, { adminId, adminPermissionsLevel });
            }

            await bot.sendMessage(chatId, '❌ Действие отменено. Список администраторов пуст. Вы возвращены в предыдущее состояние.');
            await sendAdminCommandsIfNeeded(bot, chatId, adminPermissionsLevel, returnState);
            return true;
        }

        stateManager.setUserState(userId, AdminState.EDIT_ADMINS_SELECTING);
        stateManager.resetUserTempData(userId);
        stateManager.setUserTempData(userId, {
            adminId: tempData?.adminId,
            adminPermissionsLevel: tempData?.adminPermissionsLevel,
            editReturnState: tempData?.editReturnState,
            editAdmins: editableAdmins.map((admin) => ({
                id: admin.id,
                nickname: admin.nickname,
                isActive: admin.isActive
            })),
            selectedEditAdminId: undefined
        });

        await bot.sendMessage(
            chatId,
            `❌ Действие отменено. Вы возвращены к выбору администратора.\n\nВведите номер администратора:\n\n${formatEditableAdminsPlainList(editableAdmins)}`
        );
        return true;
    }

    if (isEditAdminSubflowState(currentState)) {
        const tempData = stateManager.getUserTempData<{
            adminId?: number;
            adminPermissionsLevel?: number;
            selectedEditAdminId?: number;
            editAdmins?: unknown[];
            editReturnState?: string;
        }>(userId);

        stateManager.setUserState(userId, AdminState.EDIT_ADMIN_ACTION_SELECTING);
        stateManager.resetUserTempData(userId);
        stateManager.setUserTempData(userId, {
            adminId: tempData?.adminId,
            adminPermissionsLevel: tempData?.adminPermissionsLevel,
            selectedEditAdminId: tempData?.selectedEditAdminId,
            editAdmins: tempData?.editAdmins,
            editReturnState: tempData?.editReturnState
        });

        await bot.sendMessage(chatId, '❌ Действие отменено. Вы возвращены к выбору операции по администратору.');
        return true;
    }

    if (isApplyRegistrationsSelectingState(currentState)) {
        const tempData = stateManager.getUserTempData<{
            adminId?: number;
            adminPermissionsLevel?: number;
            applyRegistrationsReturnState?: string;
        }>(userId);

        const adminId = tempData?.adminId;
        const adminPermissionsLevel = tempData?.adminPermissionsLevel;
        const returnState = tempData?.applyRegistrationsReturnState || AdminState.AUTHENTICATED;

        stateManager.setUserState(userId, returnState);
        stateManager.resetUserTempData(userId);
        if (adminId && adminPermissionsLevel) {
            stateManager.setUserTempData(userId, { adminId, adminPermissionsLevel });
        }

        await bot.sendMessage(chatId, '❌ Принятие регистраций отменено. Вы возвращены в предыдущее состояние.');
        await sendAdminCommandsIfNeeded(bot, chatId, adminPermissionsLevel, returnState);
        return true;
    }

    if (isApplyRegistrationConfirmState(currentState)) {
        const tempData = stateManager.getUserTempData<{
            adminId?: number;
            adminPermissionsLevel?: number;
            applyRegistrationsReturnState?: string;
        }>(userId);

        const refreshedCouriers = (await courierService.getPendingApprovalCouriers()).map(
            (courier) => ({
                id: courier.id,
                fullName: courier.full_name,
                nickname: courier.nickname
            })
        );

        if (!refreshedCouriers.length) {
            const adminId = tempData?.adminId;
            const adminPermissionsLevel = tempData?.adminPermissionsLevel;
            const returnState = tempData?.applyRegistrationsReturnState || AdminState.AUTHENTICATED;

            stateManager.setUserState(userId, returnState);
            stateManager.resetUserTempData(userId);
            if (adminId && adminPermissionsLevel) {
                stateManager.setUserTempData(userId, { adminId, adminPermissionsLevel });
            }

            await bot.sendMessage(chatId, '❌ Действие отменено. Список неактивных курьеров пуст, вы возвращены в предыдущее состояние.');
            await sendAdminCommandsIfNeeded(bot, chatId, adminPermissionsLevel, returnState);
            return true;
        }

        const listText = formatPendingCourierApprovalsPlainList(refreshedCouriers);

        stateManager.setUserState(userId, AdminState.APPLY_REGISTRATIONS_SELECTING);
        stateManager.resetUserTempData(userId);
        stateManager.setUserTempData(userId, {
            adminId: tempData?.adminId,
            adminPermissionsLevel: tempData?.adminPermissionsLevel,
            applyRegistrationsReturnState: tempData?.applyRegistrationsReturnState,
            applyRegistrations: refreshedCouriers,
            selectedApplyCourierId: undefined
        });

        await bot.sendMessage(
            chatId,
            `❌ Действие отменено. Вы возвращены к списку неактивных курьеров.\n\nВыберите номер курьера:\n\n${listText}`
        );
        return true;
    }

    return false;
}
