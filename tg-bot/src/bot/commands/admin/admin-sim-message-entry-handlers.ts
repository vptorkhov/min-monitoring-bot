import TelegramBot from 'node-telegram-bot-api';
import { AdminService } from '../../../services/admin.service';
import { MobilityDeviceRepository } from '../../../repositories/mobility-device.repository';
import { validateSimNumber } from '../../../validators/sim-number.validator';
import { escapeHtml } from '../../../utils/admin-format.utils';
import { stateManager } from '../../state-manager';
import { AdminState } from '../../../constants/states.constant';
import { AdminSessionData, SimInteractionSessionItem } from '../admin.types';
import { getAuthenticatedAdminWelcomeMessage } from './admin-flow.utils';

type SendAdminCommandsIfNeeded = (
    chatId: number,
    adminPermissionsLevel: number | undefined,
    state: string
) => Promise<void>;

type SendSimActionsMessage = (
    chatId: number,
    device: SimInteractionSessionItem
) => Promise<void>;

/** Обрабатывает entry-state сценарии SIM в admin-flow. */
export async function handleSimEntryMessage(
    bot: TelegramBot,
    adminService: AdminService,
    mobilityDeviceRepository: MobilityDeviceRepository,
    telegramId: number,
    chatId: number,
    text: string,
    currentState: string | undefined,
    sendAdminCommandsIfNeeded: SendAdminCommandsIfNeeded,
    sendSimActionsMessage: SendSimActionsMessage
): Promise<boolean> {
    if (currentState === AdminState.ADD_SIM_AWAITING_NUMBER) {
        const tempData =
            stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        const adminId = tempData.adminId;
        const adminPermissionsLevel = tempData.adminPermissionsLevel;
        const addSimWarehouseId = tempData.addSimWarehouseId;

        if (!adminId || !adminPermissionsLevel || !addSimWarehouseId) {
            stateManager.setUserState(
                telegramId,
                AdminState.AUTHENTICATED_WITH_WAREHOUSE
            );
            stateManager.resetUserTempData(telegramId);
            if (adminId && adminPermissionsLevel) {
                stateManager.setUserTempData(telegramId, {
                    adminId,
                    adminPermissionsLevel
                });
            }
            await bot.sendMessage(
                chatId,
                '⚠️ Не удалось определить контекст. Выполните /admin_add_sim повторно.'
            );
            return true;
        }

        const deviceNumber = text.trim().toUpperCase();
        if (!validateSimNumber(deviceNumber)) {
            await bot.sendMessage(
                chatId,
                '❌ Некорректный номер СИМ. Формат: 3 буквы (латинские или кириллица) и 3 цифры в произвольном порядке (например, АА000А).\n\nВведите номер СИМ'
            );
            return true;
        }

        const existing =
            await mobilityDeviceRepository.findByDeviceNumber(deviceNumber);
        if (existing) {
            await bot.sendMessage(
                chatId,
                '❌ СИМ с таким номером уже существует. Введите другой номер СИМ'
            );
            return true;
        }

        await mobilityDeviceRepository.createDevice(
            deviceNumber,
            addSimWarehouseId
        );

        stateManager.setUserState(
            telegramId,
            AdminState.AUTHENTICATED_WITH_WAREHOUSE
        );
        stateManager.resetUserTempData(telegramId);
        stateManager.setUserTempData(telegramId, {
            adminId,
            adminPermissionsLevel
        });

        await bot.sendMessage(
            chatId,
            `✅ СИМ <b>${escapeHtml(deviceNumber)}</b> успешно добавлен.`,
            { parse_mode: 'HTML' }
        );
        await bot.sendMessage(
            chatId,
            getAuthenticatedAdminWelcomeMessage(adminPermissionsLevel, true)
        );
        return true;
    }

    if (currentState === AdminState.SIM_INTERACTIONS_SELECTING) {
        const tempData =
            stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        const devices = tempData.simInteractionDevices;

        if (!devices?.length) {
            stateManager.setUserState(
                telegramId,
                AdminState.AUTHENTICATED_WITH_WAREHOUSE
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
                '❌ Что-то пошло не так. Запустите /admin_sim_interactions заново.'
            );
            await sendAdminCommandsIfNeeded(
                chatId,
                tempData.adminPermissionsLevel,
                AdminState.AUTHENTICATED_WITH_WAREHOUSE
            );
            return true;
        }

        const input = text.trim();
        let selectedDevice: SimInteractionSessionItem | undefined;

        if (/^\d+$/.test(input)) {
            const index = parseInt(input, 10) - 1;
            if (index >= 0 && index < devices.length) {
                selectedDevice = devices[index];
            }
        } else {
            const normalizedNumber = input.toUpperCase();
            selectedDevice = devices.find(
                (device) =>
                    device.deviceNumber.toUpperCase() === normalizedNumber
            );
        }

        if (!selectedDevice) {
            await bot.sendMessage(
                chatId,
                '❌ СИМ не найден. Введите порядковый номер из списка или номер СИМ.'
            );
            return true;
        }

        stateManager.setUserState(
            telegramId,
            AdminState.SIM_INTERACTION_ACTION_SELECTING
        );
        stateManager.setUserTempData(telegramId, {
            selectedSimInteractionDeviceId: selectedDevice.id
        });

        await sendSimActionsMessage(chatId, selectedDevice);
        return true;
    }

    if (currentState === AdminState.SIM_INTERACTION_ACTION_SELECTING) {
        await bot.sendMessage(
            chatId,
            'ℹ️ Выберите действие командой: /admin_sim_change_active, /admin_sim_change_status, /admin_sim_story или /admin_sim_delete.\n\n/cancel - вернуться к списку СИМ.'
        );
        return true;
    }

    return false;
}
