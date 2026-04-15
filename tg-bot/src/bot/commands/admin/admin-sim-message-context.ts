import TelegramBot from 'node-telegram-bot-api';
import { MobilityDeviceRepository } from '../../../repositories/mobility-device.repository';
import { SessionRepository } from '../../../repositories/session.repository';
import { stateManager } from '../../state-manager';
import { AdminSessionData, SimInteractionSessionItem } from '../admin.types';
import { escapeHtml } from '../../../utils/admin-format.utils';
import {
    getActiveStatusText as getSimActiveStatusText,
    getSimConditionStatusText
} from '../../../utils/admin-status.utils';
import { formatSimSelectionList } from '../../../utils/admin-selection-format.utils';

type SimMessageContextDeps = {
    bot: TelegramBot;
    mobilityDeviceRepository: MobilityDeviceRepository;
    sessionRepository: SessionRepository;
};

/** Создает sim-часть admin message-context. */
export function createAdminSimMessageContext({
    bot,
    mobilityDeviceRepository,
    sessionRepository
}: SimMessageContextDeps) {
    const loadWarehouseSimDevices = async (
        warehouseId: number
    ): Promise<SimInteractionSessionItem[]> => {
        const devices =
            await mobilityDeviceRepository.getDevicesForWarehouseWithoutPersonal(
                warehouseId
            );

        return devices
            .filter((device) => !!device.device_number)
            .map((device) => ({
                id: device.id,
                deviceNumber: (device.device_number || '').toUpperCase(),
                isActive: device.is_active,
                status: device.status
            }));
    };

    const sendSimSelectionMessage = async (
        chatId: number,
        devices: SimInteractionSessionItem[]
    ) => {
        await bot.sendMessage(
            chatId,
            `Введите номер СИМ:\n\n${formatSimSelectionList(devices)}\n\n/cancel - вернуться в состояние выбранного склада.`,
            { parse_mode: 'HTML' }
        );
    };

    const tryResolveSelectedSimDevice = async (
        telegramId: number,
        chatId: number
    ): Promise<{
        tempData: AdminSessionData;
        device: SimInteractionSessionItem;
    } | null> => {
        const tempData =
            stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        const selectedSimInteractionDeviceId =
            tempData.selectedSimInteractionDeviceId;

        if (!selectedSimInteractionDeviceId) {
            await bot.sendMessage(
                chatId,
                '❌ Команда недоступна без выбора СИМ через /admin_sim_interactions.'
            );
            return null;
        }

        const device = await mobilityDeviceRepository.findById(
            selectedSimInteractionDeviceId
        );
        if (!device || device.is_personal || !device.device_number) {
            await bot.sendMessage(
                chatId,
                '❌ Выбранный СИМ не найден. Запустите /admin_sim_interactions заново.'
            );
            return null;
        }

        const warehouseId = tempData.simInteractionWarehouseId;
        if (!warehouseId || device.warehouse_id !== warehouseId) {
            await bot.sendMessage(
                chatId,
                '❌ Выбранный СИМ не относится к текущему складу. Запустите /admin_sim_interactions заново.'
            );
            return null;
        }

        return {
            tempData,
            device: {
                id: device.id,
                deviceNumber: device.device_number.toUpperCase(),
                isActive: device.is_active,
                status: device.status
            }
        };
    };

    const sendSimActionsMessage = async (
        chatId: number,
        device: SimInteractionSessionItem
    ) => {
        const activeSession = await sessionRepository.findActiveByDevice(
            device.id
        );
        const malfunctionComment =
            device.status === 'warning' || device.status === 'broken'
                ? await sessionRepository.getLastMalfunctionCommentByDevice(
                      device.id
                  )
                : null;

        const activeSessionText = activeSession
            ? `Да, <b>${escapeHtml(activeSession.courier_full_name)}</b>`
            : 'Нет';
        const malfunctionText = malfunctionComment
            ? `<b>${escapeHtml(malfunctionComment)}</b>`
            : '-';
        const commandsList = [
            '/admin_sim_change_active',
            '/admin_sim_change_status',
            '/admin_sim_story',
            '/admin_sim_delete'
        ].join('\n');

        await bot.sendMessage(
            chatId,
            [
                `Выбран СИМ: <b>${escapeHtml(device.deviceNumber)}</b>`,
                `Статус активности: <b>${getSimActiveStatusText(device.isActive)}</b>`,
                `Статус исправности: <b>${getSimConditionStatusText(device.status)}</b>`,
                `Последнее сообщение о неисправности: ${malfunctionText}`,
                `Активная сессия: ${activeSessionText}`,
                '',
                'Доступные команды:',
                commandsList,
                '',
                '/cancel - вернуться к списку СИМ.'
            ].join('\n'),
            { parse_mode: 'HTML' }
        );
    };

    return {
        loadWarehouseSimDevices,
        sendSimActionsMessage,
        sendSimSelectionMessage,
        tryResolveSelectedSimDevice
    };
}
