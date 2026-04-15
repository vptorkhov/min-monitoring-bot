import TelegramBot from 'node-telegram-bot-api';
import { CourierRepository } from '../../../repositories/courier.repository';
import { SessionRepository } from '../../../repositories/session.repository';
import { WarehouseService } from '../../../services/warehouse.service';
import { stateManager } from '../../state-manager';
import { AdminSessionData, EditableCourierSessionItem } from '../admin.types';
import { escapeHtml } from '../../../utils/admin-format.utils';
import { getActiveStatusText as getAdminStatusText } from '../../../utils/admin-status.utils';
import { formatEditableCouriersList } from '../../../utils/admin-selection-format.utils';
import { formatMoscowTime } from '../../../utils/moscow-time.utils';

type CourierMessageContextDeps = {
    bot: TelegramBot;
    courierRepository: CourierRepository;
    sessionRepository: SessionRepository;
    warehouseService: WarehouseService;
};

/** Создает courier-часть admin message-context. */
export function createAdminCourierMessageContext({
    bot,
    courierRepository,
    sessionRepository,
    warehouseService
}: CourierMessageContextDeps) {
    const loadEditableCouriersByWarehouse = async (
        warehouseId: number
    ): Promise<EditableCourierSessionItem[]> => {
        const couriers =
            await courierRepository.findEditableByWarehouseId(warehouseId);

        return couriers.map((courier) => ({
            id: courier.id,
            fullName: courier.full_name,
            nickname: courier.nickname,
            phoneNumber: courier.phone_number,
            warehouseId: courier.warehouse_id,
            isActive: courier.is_active
        }));
    };

    const loadAllEditableCouriers = async (): Promise<
        EditableCourierSessionItem[]
    > => {
        const couriers = await courierRepository.findAllEditable();

        return couriers.map((courier) => ({
            id: courier.id,
            fullName: courier.full_name,
            nickname: courier.nickname,
            phoneNumber: courier.phone_number,
            warehouseId: courier.warehouse_id,
            isActive: courier.is_active
        }));
    };

    const sendEditableCouriersListMessage = async (
        chatId: number,
        couriers: EditableCourierSessionItem[]
    ) => {
        await bot.sendMessage(
            chatId,
            `Введите номер курьера:\n\n${formatEditableCouriersList(couriers)}`,
            { parse_mode: 'HTML' }
        );
    };

    const resolveWarehouseName = async (
        warehouseId: number | null
    ): Promise<string> => {
        if (!warehouseId) {
            return 'Не выбран';
        }

        const warehouse = await warehouseService.getWarehouseById(warehouseId);
        if (!warehouse) {
            return `ID ${warehouseId}`;
        }

        return warehouse.name;
    };

    const tryResolveSelectedEditCourier = async (
        telegramId: number,
        chatId: number,
        commandHint: string
    ): Promise<{
        tempData: AdminSessionData;
        courier: EditableCourierSessionItem;
    } | null> => {
        const tempData =
            stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        let selectedEditCourierId = tempData.selectedEditCourierId;

        if (
            !selectedEditCourierId &&
            (tempData.editCouriers?.length || 0) === 1
        ) {
            selectedEditCourierId = tempData.editCouriers?.[0]?.id;
            if (selectedEditCourierId) {
                stateManager.setUserTempData(telegramId, {
                    selectedEditCourierId
                });
            }
        }

        if (!selectedEditCourierId) {
            await bot.sendMessage(
                chatId,
                `❌ Команда недоступна без выбора курьера через ${commandHint}.`
            );
            return null;
        }

        const courierRow = await courierRepository.findById(
            selectedEditCourierId
        );
        if (!courierRow) {
            await bot.sendMessage(
                chatId,
                `❌ Курьер не найден. Запустите ${commandHint} заново.`
            );
            return null;
        }

        const selectedWarehouseId = tempData.editCouriersWarehouseId;
        if (
            selectedWarehouseId &&
            courierRow.warehouse_id !== selectedWarehouseId
        ) {
            await bot.sendMessage(
                chatId,
                `❌ Выбранный курьер не относится к текущему складу. Запустите ${commandHint} заново.`
            );
            return null;
        }

        return {
            tempData,
            courier: {
                id: courierRow.id,
                fullName: courierRow.full_name,
                nickname: courierRow.nickname,
                phoneNumber: courierRow.phone_number,
                warehouseId: courierRow.warehouse_id,
                isActive: courierRow.is_active
            }
        };
    };

    const sendCourierActionsMessage = async (
        chatId: number,
        courier: EditableCourierSessionItem,
        isSuperadmin: boolean
    ) => {
        const statusCmd = isSuperadmin
            ? '/superadmin_edit_courier_status'
            : '/admin_edit_courier_status';
        const nameCmd = isSuperadmin
            ? '/superadmin_edit_courier_name'
            : '/admin_edit_courier_name';
        const historyCmd = isSuperadmin
            ? '/superadmin_courier_history'
            : '/admin_courier_history';
        const warehouseName = await resolveWarehouseName(courier.warehouseId);
        const activeSession =
            await sessionRepository.findActiveByCourierWithDevice(courier.id);

        const activeSessionText = activeSession
            ? `Да, СИМ: <b>${escapeHtml((activeSession.device_number || '-').toUpperCase())}</b>, начало: <b>${formatMoscowTime(activeSession.start_date)}</b>`
            : 'Нет';
        const nicknameText = courier.nickname
            ? escapeHtml(courier.nickname)
            : '-';

        await bot.sendMessage(
            chatId,
            [
                `Курьер: <b>${escapeHtml(courier.fullName)}</b>`,
                `Телефон: <b>${escapeHtml(courier.phoneNumber)}</b>`,
                `Никнейм: <b>${nicknameText}</b>`,
                `Статус: <b>${getAdminStatusText(courier.isActive)}</b>`,
                `Склад: <b>${escapeHtml(warehouseName)}</b>`,
                `Активная сессия: ${activeSessionText}`,
                '',
                'Доступные команды:',
                statusCmd,
                nameCmd,
                historyCmd,
                '',
                '/cancel - вернуться к списку курьеров.'
            ].join('\n'),
            { parse_mode: 'HTML' }
        );
    };

    return {
        loadAllEditableCouriers,
        loadEditableCouriersByWarehouse,
        sendCourierActionsMessage,
        sendEditableCouriersListMessage,
        tryResolveSelectedEditCourier
    };
}
