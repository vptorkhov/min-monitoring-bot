import TelegramBot from 'node-telegram-bot-api';
import { AdminService } from '../../../services/admin.service';
import { WarehouseService } from '../../../services/warehouse.service';
import { escapeHtml } from '../../../utils/admin-format.utils';
import { stateManager } from '../../state-manager';
import { AdminState } from '../../../constants/states.constant';
import { AdminSessionData } from '../admin.types';
import { getAuthenticatedAdminWelcomeMessage } from './admin-flow.utils';

type SendAdminCommandsIfNeeded = (
    chatId: number,
    adminPermissionsLevel: number | undefined,
    state: string
) => Promise<void>;

/** Обрабатывает entry-state сценарии склада в admin-flow. */
export async function handleWarehouseEntryMessage(
    bot: TelegramBot,
    adminService: AdminService,
    warehouseService: WarehouseService,
    telegramId: number,
    chatId: number,
    text: string,
    currentState: string | undefined,
    sendAdminCommandsIfNeeded: SendAdminCommandsIfNeeded
): Promise<boolean> {
    if (currentState === AdminState.SET_WAREHOUSE_SELECTING) {
        const tempData =
            stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
        const warehouses = tempData.adminSetWarehouses;
        const adminId = tempData.adminId;
        const adminPermissionsLevel = tempData.adminPermissionsLevel;

        if (!adminId || !adminPermissionsLevel) {
            stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
            stateManager.resetUserTempData(telegramId);
            await bot.sendMessage(
                chatId,
                '⚠️ Не удалось определить администратора. Выполните /admin_login повторно.'
            );
            return true;
        }

        if (!warehouses?.length) {
            const fallbackState =
                tempData.adminSetReturnState || AdminState.AUTHENTICATED;
            stateManager.setUserState(telegramId, fallbackState);
            stateManager.resetUserTempData(telegramId);
            stateManager.setUserTempData(telegramId, {
                adminId,
                adminPermissionsLevel
            });
            await bot.sendMessage(
                chatId,
                '❌ Что-то пошло не так. Запустите /admin_set_warehouse заново.'
            );
            return true;
        }

        if (!/^\d+$/.test(text.trim())) {
            await bot.sendMessage(
                chatId,
                '❌ Введите корректный номер склада из списка.'
            );
            return true;
        }

        const index = parseInt(text.trim(), 10) - 1;
        if (index < 0 || index >= warehouses.length) {
            await bot.sendMessage(
                chatId,
                '❌ Склад с таким номером не найден. Введите номер из списка.'
            );
            return true;
        }

        const selectedWarehouse = warehouses[index];
        const setWarehouseResult = await adminService.setAdminWarehouse(
            adminId,
            selectedWarehouse.id
        );
        if (!setWarehouseResult.success) {
            await bot.sendMessage(
                chatId,
                `❌ ${setWarehouseResult.reason || 'Не удалось выбрать склад.'}`
            );
            return true;
        }

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
            `✅ Вы успешно выбрали склад: <b>${escapeHtml(selectedWarehouse.name)}</b>.`,
            { parse_mode: 'HTML' }
        );
        await bot.sendMessage(
            chatId,
            getAuthenticatedAdminWelcomeMessage(adminPermissionsLevel, true)
        );
        return true;
    }

    if (currentState === AdminState.CREATE_WAREHOUSE_AWAITING_NAME) {
        const nameInput = text.trim();
        if (nameInput.length < 2) {
            await bot.sendMessage(
                chatId,
                '❌ Название должно содержать минимум 2 символа.\n\nВведите название склада'
            );
            return true;
        }

        stateManager.setUserTempDataField(
            telegramId,
            'createWarehouseName',
            nameInput
        );
        stateManager.setUserState(
            telegramId,
            AdminState.CREATE_WAREHOUSE_AWAITING_ADDRESS
        );
        await bot.sendMessage(chatId, 'Введите адрес склада');
        return true;
    }

    if (currentState !== AdminState.CREATE_WAREHOUSE_AWAITING_ADDRESS) {
        return false;
    }

    const addressInput = text.trim();
    if (addressInput.length < 2) {
        await bot.sendMessage(
            chatId,
            '❌ Адрес должен содержать минимум 2 символа.\n\nВведите адрес склада'
        );
        return true;
    }

    const tempData = stateManager.getUserTempData<{
        adminId?: number;
        adminPermissionsLevel?: number;
        createWarehouseName?: string;
    }>(telegramId);
    const warehouseName = tempData?.createWarehouseName;
    const adminId = tempData?.adminId;
    const adminPermissionsLevel = tempData?.adminPermissionsLevel;

    if (!warehouseName) {
        stateManager.setUserState(
            telegramId,
            AdminState.CREATE_WAREHOUSE_AWAITING_NAME
        );
        await bot.sendMessage(
            chatId,
            '⚠️ Что-то пошло не так. Введите название склада'
        );
        return true;
    }

    const warehouse = await warehouseService.createWarehouse(
        warehouseName,
        addressInput
    );

    const currentWarehouseId = adminId
        ? await adminService.getAdminWarehouseId(adminId)
        : null;
    const authenticatedState = currentWarehouseId
        ? AdminState.AUTHENTICATED_WITH_WAREHOUSE
        : AdminState.AUTHENTICATED;

    stateManager.setUserState(telegramId, authenticatedState);
    stateManager.resetUserTempData(telegramId);
    if (adminId && adminPermissionsLevel) {
        stateManager.setUserTempData(telegramId, {
            adminId,
            adminPermissionsLevel
        });
    }

    await bot.sendMessage(
        chatId,
        `✅ Успешно создан склад *${warehouse.name}* по адресу *${warehouse.address}*`,
        { parse_mode: 'Markdown' }
    );
    await sendAdminCommandsIfNeeded(
        chatId,
        adminPermissionsLevel,
        authenticatedState
    );
    return true;
}
