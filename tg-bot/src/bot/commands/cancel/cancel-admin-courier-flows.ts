import TelegramBot from 'node-telegram-bot-api';
import { CourierRepository } from '../../../repositories/courier.repository';
import { stateManager } from '../../state-manager';
import { AdminState } from '../../../constants/states.constant';
import {
    isEditCourierActionSelectingState,
    isEditCourierSubflowState,
    isEditCouriersSelectingState,
    isSuperadminEditCourierActionSelectingState,
    isSuperadminEditCourierSubflowState
} from '../../../utils/cancel-admin-state.utils';
import { formatEditableCouriersPlainList } from '../../../utils/admin-selection-format.utils';

interface CourierFlowsDeps {
    bot: TelegramBot;
    chatId: number;
    userId: number;
    currentState: string;
    courierRepository: CourierRepository;
    sendAdminCommandsIfNeeded: (
        chatId: number,
        adminPermissionsLevel: number | undefined,
        targetState: string | undefined
    ) => Promise<void>;
}

export async function handleCancelCourierFlows(deps: CourierFlowsDeps): Promise<boolean> {
    const {
        bot,
        chatId,
        userId,
        currentState,
        courierRepository,
        sendAdminCommandsIfNeeded
    } = deps;

    if (isEditCouriersSelectingState(currentState)) {
        const tempData = stateManager.getUserTempData<{
            adminId?: number;
            adminPermissionsLevel?: number;
            editCouriersReturnState?: string;
        }>(userId);

        const adminId = tempData?.adminId;
        const adminPermissionsLevel = tempData?.adminPermissionsLevel;
        const returnState = tempData?.editCouriersReturnState || AdminState.AUTHENTICATED;

        stateManager.setUserState(userId, returnState);
        stateManager.resetUserTempData(userId);
        if (adminId && adminPermissionsLevel) {
            stateManager.setUserTempData(userId, { adminId, adminPermissionsLevel });
        }

        await bot.sendMessage(chatId, '❌ Взаимодействие с курьерами отменено. Вы возвращены в предыдущее состояние.');
        await sendAdminCommandsIfNeeded(chatId, adminPermissionsLevel, returnState);
        return true;
    }

    if (isEditCourierActionSelectingState(currentState)) {
        const isSuperadmin = isSuperadminEditCourierActionSelectingState(currentState);
        const tempData = stateManager.getUserTempData<{
            adminId?: number;
            adminPermissionsLevel?: number;
            editCouriers?: { id: number; fullName: string }[];
            editCouriersReturnState?: string;
        }>(userId);

        const couriers = tempData?.editCouriers || [];
        if (!couriers.length) {
            const adminId = tempData?.adminId;
            const adminPermissionsLevel = tempData?.adminPermissionsLevel;
            const returnState = tempData?.editCouriersReturnState || AdminState.AUTHENTICATED;

            stateManager.setUserState(userId, returnState);
            stateManager.resetUserTempData(userId);
            if (adminId && adminPermissionsLevel) {
                stateManager.setUserTempData(userId, { adminId, adminPermissionsLevel });
            }

            await bot.sendMessage(chatId, '❌ Действие отменено. Список курьеров пуст. Вы возвращены в предыдущее состояние.');
            await sendAdminCommandsIfNeeded(chatId, adminPermissionsLevel, returnState);
            return true;
        }

        const selectingState = isSuperadmin
            ? AdminState.SUPERADMIN_EDIT_COURIERS_SELECTING
            : AdminState.ADMIN_EDIT_COURIERS_SELECTING;

        stateManager.setUserState(userId, selectingState);
        stateManager.resetUserTempData(userId);
        stateManager.setUserTempData(userId, {
            adminId: tempData?.adminId,
            adminPermissionsLevel: tempData?.adminPermissionsLevel,
            editCouriers: couriers,
            editCouriersReturnState: tempData?.editCouriersReturnState,
            selectedEditCourierId: undefined
        });

        const listText = formatEditableCouriersPlainList(couriers);
        await bot.sendMessage(
            chatId,
            `❌ Действие отменено. Вы возвращены к выбору курьера.\n\nВведите номер курьера:\n\n${listText}\n\n/cancel - вернуться в предыдущее состояние.`
        );
        return true;
    }

    if (isEditCourierSubflowState(currentState)) {
        const isSuperadmin = isSuperadminEditCourierSubflowState(currentState);

        const tempData = stateManager.getUserTempData<{
            selectedEditCourierId?: number;
        }>(userId);

        const selectedEditCourierId = tempData?.selectedEditCourierId;
        const nextState = isSuperadmin
            ? AdminState.SUPERADMIN_EDIT_COURIER_ACTION_SELECTING
            : AdminState.ADMIN_EDIT_COURIER_ACTION_SELECTING;

        stateManager.setUserState(userId, nextState);

        if (selectedEditCourierId) {
            const row = await courierRepository.findById(selectedEditCourierId);
            if (row) {
                const statusText = row.is_active ? 'Активный' : 'Отключен';
                const statusCmd = isSuperadmin
                    ? '/superadmin_edit_courier_status'
                    : '/admin_edit_courier_status';
                const nameCmd = isSuperadmin
                    ? '/superadmin_edit_courier_name'
                    : '/admin_edit_courier_name';
                const historyCmd = isSuperadmin
                    ? '/superadmin_courier_history'
                    : '/admin_courier_history';
                await bot.sendMessage(
                    chatId,
                    `❌ Действие отменено. Вы возвращены к информации о курьере.\n\nКурьер: <b>${row.full_name}</b>\nТелефон: <b>${row.phone_number}</b>\nСтатус: <b>${statusText}</b>\n\nДоступные команды:\n${statusCmd}\n${nameCmd}\n${historyCmd}\n\n/cancel - вернуться к списку курьеров.`,
                    { parse_mode: 'HTML' }
                );
                return true;
            }
        }

        await bot.sendMessage(chatId, '❌ Действие отменено. Вы возвращены к выбору операции по курьеру.');
        return true;
    }

    return false;
}
