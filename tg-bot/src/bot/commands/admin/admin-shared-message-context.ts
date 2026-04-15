import TelegramBot from 'node-telegram-bot-api';
import { AdminService } from '../../../services/admin.service';
import { CourierService } from '../../../services/courier.service';
import { Warehouse } from '../../../repositories/types/warehouse.type';
import {
    getAdminCommandListMessage,
    isAuthenticatedAdminState
} from '../../admin/admin-command-hints';
import { stateManager } from '../../state-manager';
import { AdminState } from '../../../constants/states.constant';
import {
    getActiveStatusText as getAdminStatusText,
    getActiveStatusText as getWarehouseStatusText
} from '../../../utils/admin-status.utils';
import { escapeHtml } from '../../../utils/admin-format.utils';
import {
    formatEditableAdminsList,
    formatPendingCourierApprovalsList
} from '../../../utils/admin-selection-format.utils';
import {
    AdminSessionData,
    EditableAdminSessionItem,
    PendingCourierApprovalSessionItem
} from '../admin.types';

type SharedMessageContextDeps = {
    bot: TelegramBot;
    adminService: AdminService;
    courierService: CourierService;
};

/** Создает общий admin message-context для warehouse/admin/approval сценариев. */
export function createAdminSharedMessageContext({
    bot,
    adminService,
    courierService
}: SharedMessageContextDeps) {
    const restoreToAuthenticatedWithAdminContext = (
        telegramId: number,
        tempData: AdminSessionData,
        targetState?: string
    ): string => {
        const resolvedState =
            targetState || tempData.editReturnState || AdminState.AUTHENTICATED;

        stateManager.setUserState(telegramId, resolvedState);
        stateManager.resetUserTempData(telegramId);

        if (tempData.adminId && tempData.adminPermissionsLevel) {
            stateManager.setUserTempData(telegramId, {
                adminId: tempData.adminId,
                adminPermissionsLevel: tempData.adminPermissionsLevel
            });
        }

        return resolvedState;
    };

    const sendAdminCommandsIfNeeded = async (
        chatId: number,
        adminPermissionsLevel: number | undefined,
        state: string
    ) => {
        if (!adminPermissionsLevel || !isAuthenticatedAdminState(state)) {
            return;
        }

        await bot.sendMessage(
            chatId,
            getAdminCommandListMessage(
                adminPermissionsLevel,
                state === AdminState.AUTHENTICATED_WITH_WAREHOUSE
            )
        );
    };

    const sendWarehouseActionsMessage = async (
        chatId: number,
        warehouse: Warehouse
    ) => {
        const safeName = escapeHtml(warehouse.name);
        const safeAddress = escapeHtml(warehouse.address || '-');
        const status = getWarehouseStatusText(warehouse.is_active);
        const commandsList = [
            '/superadmin_edit_warehouse_name',
            '/superadmin_edit_warehouse_address',
            '/superadmin_edit_warehouse_status',
            '/superadmin_edit_warehouse_delete'
        ].join('\n');

        await bot.sendMessage(
            chatId,
            [
                `Выбран склад:`,
                `<b>${safeName}</b> - <b>${safeAddress}</b>`,
                `Статус: <b>${status}</b>`,
                '',
                'Доступные действия:',
                commandsList
            ].join('\n'),
            { parse_mode: 'HTML' }
        );
    };

    const sendEditableAdminsListMessage = async (
        chatId: number,
        admins: EditableAdminSessionItem[]
    ) => {
        const listText = formatEditableAdminsList(admins);
        await bot.sendMessage(
            chatId,
            `Введите номер администратора:\n\n${listText}`,
            { parse_mode: 'HTML' }
        );
    };

    const loadPendingCourierApprovals = async (): Promise<
        PendingCourierApprovalSessionItem[]
    > => {
        const couriers = await courierService.getPendingApprovalCouriers();

        return couriers.map((courier) => ({
            id: courier.id,
            fullName: courier.full_name,
            nickname: courier.nickname
        }));
    };

    const sendPendingCourierApprovalsListMessage = async (
        chatId: number,
        couriers: PendingCourierApprovalSessionItem[]
    ) => {
        const listText = formatPendingCourierApprovalsList(couriers);

        await bot.sendMessage(
            chatId,
            `Выберите номер курьера:\n\n${listText}`,
            { parse_mode: 'HTML' }
        );
    };

    const sendAdminActionsMessage = async (
        chatId: number,
        admin: EditableAdminSessionItem
    ) => {
        const commandsList = [
            '/superadmin_edit_admin_status',
            '/superadmin_edit_admin_delete',
            '/superadmin_edit_admin_password'
        ].join('\n');

        await bot.sendMessage(
            chatId,
            [
                'Выбран администратор:',
                `<b>${escapeHtml(admin.nickname)}</b>`,
                `Статус: <b>${getAdminStatusText(admin.isActive)}</b>`,
                '',
                'Доступные действия:',
                commandsList
            ].join('\n'),
            { parse_mode: 'HTML' }
        );
    };

    const tryResolveSelectedAdmin = async (
        telegramId: number,
        chatId: number
    ): Promise<{
        tempData: AdminSessionData;
        admin: EditableAdminSessionItem;
    } | null> => {
        const tempData =
            stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        const selectedEditAdminId = tempData.selectedEditAdminId;

        if (!selectedEditAdminId) {
            await bot.sendMessage(
                chatId,
                '❌ Команда недоступна без выбора администратора через /superadmin_edit_admins.'
            );
            return null;
        }

        const admin = await adminService.getAdminById(selectedEditAdminId);
        if (!admin || admin.permissionsLevel >= 2) {
            await bot.sendMessage(
                chatId,
                '❌ Выбранный администратор не найден. Запустите /superadmin_edit_admins заново.'
            );
            return null;
        }

        return {
            tempData,
            admin: {
                id: admin.id,
                nickname: admin.nickname,
                isActive: admin.isActive
            }
        };
    };

    const loadEditableAdmins = async (): Promise<EditableAdminSessionItem[]> => {
        const admins = await adminService.getEditableAdmins();

        return admins
            .filter((admin) => admin.permissionsLevel < 2)
            .map((admin) => ({
                id: admin.id,
                nickname: admin.nickname,
                isActive: admin.isActive
            }));
    };

    return {
        loadEditableAdmins,
        loadPendingCourierApprovals,
        restoreToAuthenticatedWithAdminContext,
        sendAdminActionsMessage,
        sendAdminCommandsIfNeeded,
        sendEditableAdminsListMessage,
        sendPendingCourierApprovalsListMessage,
        sendWarehouseActionsMessage,
        tryResolveSelectedAdmin
    };
}
