import TelegramBot from 'node-telegram-bot-api';
import { CourierRepository } from '../../../repositories/courier.repository';
import { parseActiveStatusInput as parseAdminStatusInput } from '../../../utils/admin-status.utils';
import { escapeHtml } from '../../../utils/admin-format.utils';
import { stateManager } from '../../state-manager';
import { AdminState } from '../../../constants/states.constant';
import { AdminSessionData, EditableCourierSessionItem } from '../admin.types';

type SendAdminCommandsIfNeeded = (
    chatId: number,
    adminPermissionsLevel: number | undefined,
    state: string
) => Promise<void>;

type RestoreToAuthenticatedWithAdminContext = (
    telegramId: number,
    tempData: AdminSessionData,
    targetState?: string
) => string;

type TryResolveSelectedEditCourier = (
    telegramId: number,
    chatId: number,
    commandHint: string
) => Promise<{
    tempData: AdminSessionData;
    courier: EditableCourierSessionItem;
} | null>;

type SendCourierActionsMessage = (
    chatId: number,
    courier: EditableCourierSessionItem,
    isSuperadmin: boolean
) => Promise<void>;

/** Обрабатывает состояния выбора/редактирования курьера в admin-flow. */
export async function handleCourierSelectionAndEditMessage(
    bot: TelegramBot,
    courierRepository: CourierRepository,
    telegramId: number,
    chatId: number,
    text: string,
    currentState: string | undefined,
    sendAdminCommandsIfNeeded: SendAdminCommandsIfNeeded,
    restoreToAuthenticatedWithAdminContext: RestoreToAuthenticatedWithAdminContext,
    tryResolveSelectedEditCourier: TryResolveSelectedEditCourier,
    sendCourierActionsMessage: SendCourierActionsMessage
): Promise<boolean> {
    if (
        currentState === AdminState.ADMIN_EDIT_COURIERS_SELECTING ||
        currentState === AdminState.SUPERADMIN_EDIT_COURIERS_SELECTING
    ) {
        const isSuperadmin =
            currentState === AdminState.SUPERADMIN_EDIT_COURIERS_SELECTING;
        const tempData =
            stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        const couriers = tempData.editCouriers;

        if (!couriers?.length) {
            const restoredState = restoreToAuthenticatedWithAdminContext(
                telegramId,
                tempData,
                tempData.editCouriersReturnState
            );
            await bot.sendMessage(
                chatId,
                `❌ Что-то пошло не так. Запустите ${isSuperadmin ? '/superadmin_edit_couriers' : '/admin_edit_couriers'} заново.`
            );
            await sendAdminCommandsIfNeeded(
                chatId,
                tempData.adminPermissionsLevel,
                restoredState
            );
            return true;
        }

        if (!/^\d+$/.test(text.trim())) {
            await bot.sendMessage(
                chatId,
                '❌ Введите корректный номер курьера из списка.'
            );
            return true;
        }

        const index = parseInt(text.trim(), 10) - 1;
        if (index < 0 || index >= couriers.length) {
            await bot.sendMessage(
                chatId,
                '❌ Курьер с таким номером не найден. Введите номер из списка.'
            );
            return true;
        }

        const selectedCourier = couriers[index];
        const nextState = isSuperadmin
            ? AdminState.SUPERADMIN_EDIT_COURIER_ACTION_SELECTING
            : AdminState.ADMIN_EDIT_COURIER_ACTION_SELECTING;

        stateManager.setUserState(telegramId, nextState);
        stateManager.setUserTempData(telegramId, {
            selectedEditCourierId: selectedCourier.id
        });

        await sendCourierActionsMessage(chatId, selectedCourier, isSuperadmin);
        return true;
    }

    if (
        currentState === AdminState.ADMIN_EDIT_COURIER_ACTION_SELECTING ||
        currentState === AdminState.SUPERADMIN_EDIT_COURIER_ACTION_SELECTING
    ) {
        const isSuperadmin =
            currentState ===
            AdminState.SUPERADMIN_EDIT_COURIER_ACTION_SELECTING;
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
            `ℹ️ Выберите действие командой: ${statusCmd}, ${nameCmd} или ${historyCmd}.\n\n/cancel - вернуться к списку курьеров.`
        );
        return true;
    }

    if (
        currentState === AdminState.ADMIN_EDIT_COURIER_AWAITING_STATUS ||
        currentState === AdminState.SUPERADMIN_EDIT_COURIER_AWAITING_STATUS
    ) {
        const isSuperadmin =
            currentState === AdminState.SUPERADMIN_EDIT_COURIER_AWAITING_STATUS;
        const status = parseAdminStatusInput(text);
        if (status === null) {
            await bot.sendMessage(
                chatId,
                '❌ Некорректный выбор статуса. Введите 1 (Активный) или 2 (Отключен).'
            );
            return true;
        }

        const commandHint = isSuperadmin
            ? '/superadmin_edit_couriers'
            : '/admin_edit_couriers';
        const resolved = await tryResolveSelectedEditCourier(
            telegramId,
            chatId,
            commandHint
        );
        if (!resolved) {
            return true;
        }

        const updated = await courierRepository.updateActiveStatus(
            resolved.courier.id,
            status
        );
        if (!updated) {
            await bot.sendMessage(
                chatId,
                '❌ Не удалось изменить статус курьера.'
            );
            return true;
        }

        const refreshedRow = await courierRepository.findById(
            resolved.courier.id
        );
        if (!refreshedRow) {
            await bot.sendMessage(
                chatId,
                `❌ Курьер не найден. Запустите ${commandHint} заново.`
            );
            return true;
        }

        const refreshedCourier: EditableCourierSessionItem = {
            id: refreshedRow.id,
            fullName: refreshedRow.full_name,
            nickname: refreshedRow.nickname,
            phoneNumber: refreshedRow.phone_number,
            warehouseId: refreshedRow.warehouse_id,
            isActive: refreshedRow.is_active
        };

        const tempData =
            stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        const updatedList = (tempData.editCouriers || []).map((c) =>
            c.id === refreshedCourier.id ? refreshedCourier : c
        );

        const nextState = isSuperadmin
            ? AdminState.SUPERADMIN_EDIT_COURIER_ACTION_SELECTING
            : AdminState.ADMIN_EDIT_COURIER_ACTION_SELECTING;

        stateManager.setUserState(telegramId, nextState);
        stateManager.setUserTempData(telegramId, {
            editCouriers: updatedList
        });

        await bot.sendMessage(
            chatId,
            `✅ Статус курьера изменен на <b>${refreshedCourier.isActive ? 'Активный' : 'Отключен'}</b>.`,
            { parse_mode: 'HTML' }
        );
        await sendCourierActionsMessage(chatId, refreshedCourier, isSuperadmin);
        return true;
    }

    if (
        currentState === AdminState.ADMIN_EDIT_COURIER_AWAITING_NAME ||
        currentState === AdminState.SUPERADMIN_EDIT_COURIER_AWAITING_NAME
    ) {
        const isSuperadmin =
            currentState === AdminState.SUPERADMIN_EDIT_COURIER_AWAITING_NAME;
        const newFullName = text.trim();
        if (newFullName.length < 2) {
            await bot.sendMessage(
                chatId,
                '❌ ФИО должно содержать минимум 2 символа.'
            );
            return true;
        }

        const commandHint = isSuperadmin
            ? '/superadmin_edit_couriers'
            : '/admin_edit_couriers';
        const resolved = await tryResolveSelectedEditCourier(
            telegramId,
            chatId,
            commandHint
        );
        if (!resolved) {
            return true;
        }

        const updated = await courierRepository.updateFullName(
            resolved.courier.id,
            newFullName
        );
        if (!updated) {
            await bot.sendMessage(
                chatId,
                '❌ Не удалось изменить ФИО курьера.'
            );
            return true;
        }

        const refreshedRow = await courierRepository.findById(
            resolved.courier.id
        );
        if (!refreshedRow) {
            await bot.sendMessage(
                chatId,
                `❌ Курьер не найден. Запустите ${commandHint} заново.`
            );
            return true;
        }

        const refreshedCourier: EditableCourierSessionItem = {
            id: refreshedRow.id,
            fullName: refreshedRow.full_name,
            nickname: refreshedRow.nickname,
            phoneNumber: refreshedRow.phone_number,
            warehouseId: refreshedRow.warehouse_id,
            isActive: refreshedRow.is_active
        };

        const tempData =
            stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        const updatedList = (tempData.editCouriers || []).map((c) =>
            c.id === refreshedCourier.id ? refreshedCourier : c
        );

        const nextState = isSuperadmin
            ? AdminState.SUPERADMIN_EDIT_COURIER_ACTION_SELECTING
            : AdminState.ADMIN_EDIT_COURIER_ACTION_SELECTING;

        stateManager.setUserState(telegramId, nextState);
        stateManager.setUserTempData(telegramId, {
            editCouriers: updatedList
        });

        await bot.sendMessage(
            chatId,
            `✅ ФИО курьера изменено на <b>${escapeHtml(refreshedCourier.fullName)}</b>.`,
            { parse_mode: 'HTML' }
        );
        await sendCourierActionsMessage(chatId, refreshedCourier, isSuperadmin);
        return true;
    }

    return false;
}
