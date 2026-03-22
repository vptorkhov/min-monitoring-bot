import TelegramBot from 'node-telegram-bot-api';
import { RegistrationHandler } from '../handlers/registration.handler';
import { CourierService } from '../../services/courier.service';
import { SessionService } from '../../services/session.service';
import { AdminService } from '../../services/admin.service';
import { MobilityDeviceRepository } from '../../repositories/mobility-device.repository';
import {
    stateManager
} from '../state-manager';
import { sendCourierMainKeyboard } from '../keyboards/courier-main-keyboard';
import { blockIfAdminGuestCommandNotAllowed } from '../admin/admin-mode';
import { AdminState } from '../../constants/states.constant';

/**
 * Регистрация команды /cancel
 * 
 * Универсальная отмена текущего действия пользователя.
 * Работает для:
 * - регистрации
 * - выбора склада
 * - будущих процессов
 */
export function registerCancelCommand(
    bot: TelegramBot,
    registrationHandler: RegistrationHandler,
    courierService: CourierService,
    sessionService: SessionService
) {
    const adminService = new AdminService();
    const mobilityDeviceRepository = new MobilityDeviceRepository();

    const formatEditableAdminsList = (admins: { nickname: string }[]): string => {
        return admins
            .map((admin, index) => `${index + 1}. ${admin.nickname}`)
            .join('\n');
    };

    bot.onText(/^\/cancel(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from?.id;

        if (!userId) return;

        const currentState = stateManager.getUserState(userId);
        const isAdminFlowState = currentState === AdminState.REGISTER_AWAITING_LOGIN
            || currentState === AdminState.REGISTER_AWAITING_PASSWORD
            || currentState === AdminState.LOGIN_AWAITING_LOGIN
            || currentState === AdminState.LOGIN_AWAITING_PASSWORD;

        if (isAdminFlowState) {
            stateManager.setUserState(userId, AdminState.GUEST_MODE);
            stateManager.resetUserTempData(userId);

            await bot.sendMessage(
                chatId,
                '❌ Действие отменено. Вы возвращены в предадминское состояние. Доступны: /admin_login, /admin_register, /admin_logout, /exit_admin.'
            );
            return;
        }

        const isAdminGuestOrAuthenticated = currentState === AdminState.GUEST_MODE
            || currentState === AdminState.AUTHENTICATED
            || currentState === AdminState.AUTHENTICATED_WITH_WAREHOUSE;
        if (isAdminGuestOrAuthenticated) {
            await bot.sendMessage(chatId, 'ℹ️ Нет активного действия для отмены.');
            return;
        }

        const isSetWarehouseFlowState = currentState === AdminState.SET_WAREHOUSE_SELECTING;
        if (isSetWarehouseFlowState) {
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
            return;
        }

        const isCreateWarehouseFlowState = currentState === AdminState.CREATE_WAREHOUSE_AWAITING_NAME
            || currentState === AdminState.CREATE_WAREHOUSE_AWAITING_ADDRESS;
        if (isCreateWarehouseFlowState) {
            const tempData = stateManager.getUserTempData<{ adminId?: number; adminPermissionsLevel?: number }>(userId);
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
            return;
        }

        const isChangePasswordFlowState = currentState === AdminState.CHANGE_PASSWORD_AWAITING_NEW;
        if (isChangePasswordFlowState) {
            const tempData = stateManager.getUserTempData<{ adminId?: number; adminPermissionsLevel?: number }>(userId);
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
            return;
        }

        const isEditWarehouseEntryFlowState = currentState === AdminState.EDIT_WAREHOUSES_SELECTING
            || currentState === AdminState.EDIT_WAREHOUSE_ACTION_SELECTING;
        if (isEditWarehouseEntryFlowState) {
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
            return;
        }

        const isEditWarehouseSubflowState = currentState === AdminState.EDIT_WAREHOUSE_AWAITING_NAME
            || currentState === AdminState.EDIT_WAREHOUSE_AWAITING_ADDRESS
            || currentState === AdminState.EDIT_WAREHOUSE_AWAITING_STATUS
            || currentState === AdminState.EDIT_WAREHOUSE_AWAITING_DELETE_CONFIRM;
        if (isEditWarehouseSubflowState) {
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
            return;
        }

        const isEditAdminsEntryFlowState = currentState === AdminState.EDIT_ADMINS_SELECTING;
        if (isEditAdminsEntryFlowState) {
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
            return;
        }

        const isEditAdminActionFlowState = currentState === AdminState.EDIT_ADMIN_ACTION_SELECTING;
        if (isEditAdminActionFlowState) {
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
                return;
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
                `❌ Действие отменено. Вы возвращены к выбору администратора.\n\nВведите номер администратора:\n\n${formatEditableAdminsList(editableAdmins)}`
            );
            return;
        }

        const isEditAdminSubflowState = currentState === AdminState.EDIT_ADMIN_AWAITING_STATUS
            || currentState === AdminState.EDIT_ADMIN_AWAITING_DELETE_CONFIRM
            || currentState === AdminState.EDIT_ADMIN_AWAITING_PASSWORD;
        if (isEditAdminSubflowState) {
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
            return;
        }

        const isApplyRegistrationsSelectingState = currentState === AdminState.APPLY_REGISTRATIONS_SELECTING;
        if (isApplyRegistrationsSelectingState) {
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
            return;
        }

        const isApplyRegistrationConfirmState = currentState === AdminState.APPLY_REGISTRATION_AWAITING_CONFIRM;
        if (isApplyRegistrationConfirmState) {
            const tempData = stateManager.getUserTempData<{
                adminId?: number;
                adminPermissionsLevel?: number;
                applyRegistrationsReturnState?: string;
            }>(userId);

            const refreshedCouriers = (await courierService.getPendingApprovalCouriers()).map((courier) => ({
                id: courier.id,
                fullName: courier.full_name,
                nickname: courier.nickname
            }));

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
                return;
            }

            const listText = refreshedCouriers
                .map((courier, index) => {
                    const base = `${index + 1}. ${courier.fullName}`;
                    return courier.nickname ? `${base} ${courier.nickname}` : base;
                })
                .join('\n');

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
            return;
        }

        const isAddSimFlowState = currentState === AdminState.ADD_SIM_AWAITING_NUMBER;
        if (isAddSimFlowState) {
            const tempData = stateManager.getUserTempData<{
                adminId?: number;
                adminPermissionsLevel?: number;
            }>(userId);

            const adminId = tempData?.adminId;
            const adminPermissionsLevel = tempData?.adminPermissionsLevel;

            stateManager.setUserState(userId, AdminState.AUTHENTICATED_WITH_WAREHOUSE);
            stateManager.resetUserTempData(userId);
            if (adminId && adminPermissionsLevel) {
                stateManager.setUserTempData(userId, { adminId, adminPermissionsLevel });
            }

            await bot.sendMessage(chatId, '❌ Добавление СИМ отменено. Вы возвращены в авторизованный админ-режим.');
            return;
        }

        const isSimInteractionsSelectingState = currentState === AdminState.SIM_INTERACTIONS_SELECTING;
        if (isSimInteractionsSelectingState) {
            const tempData = stateManager.getUserTempData<{
                adminId?: number;
                adminPermissionsLevel?: number;
            }>(userId);

            const adminId = tempData?.adminId;
            const adminPermissionsLevel = tempData?.adminPermissionsLevel;

            stateManager.setUserState(userId, AdminState.AUTHENTICATED_WITH_WAREHOUSE);
            stateManager.resetUserTempData(userId);
            if (adminId && adminPermissionsLevel) {
                stateManager.setUserTempData(userId, { adminId, adminPermissionsLevel });
            }

            await bot.sendMessage(chatId, '❌ Взаимодействие с СИМ отменено. Вы возвращены в состояние выбранного склада.');
            return;
        }

        const isSimInteractionSubflowState = currentState === AdminState.SIM_INTERACTION_ACTION_SELECTING
            || currentState === AdminState.SIM_INTERACTION_AWAITING_ACTIVE_STATUS
            || currentState === AdminState.SIM_INTERACTION_AWAITING_CONDITION_STATUS
            || currentState === AdminState.SIM_INTERACTION_AWAITING_DELETE_CONFIRM;
        if (isSimInteractionSubflowState) {
            const tempData = stateManager.getUserTempData<{
                adminId?: number;
                adminPermissionsLevel?: number;
                simInteractionWarehouseId?: number;
            }>(userId);

            const warehouseId = tempData?.simInteractionWarehouseId;
            if (!warehouseId) {
                stateManager.setUserState(userId, AdminState.AUTHENTICATED_WITH_WAREHOUSE);
                stateManager.resetUserTempData(userId);
                if (tempData?.adminId && tempData?.adminPermissionsLevel) {
                    stateManager.setUserTempData(userId, {
                        adminId: tempData.adminId,
                        adminPermissionsLevel: tempData.adminPermissionsLevel
                    });
                }

                await bot.sendMessage(chatId, '❌ Действие отменено. Контекст выбора СИМ сброшен, вы возвращены в состояние выбранного склада.');
                return;
            }

            const refreshedDevices = (await mobilityDeviceRepository.getDevicesForWarehouseWithoutPersonal(warehouseId))
                .filter((device) => !!device.device_number)
                .map((device) => ({
                    id: device.id,
                    deviceNumber: (device.device_number || '').toUpperCase(),
                    isActive: device.is_active,
                    status: device.status
                }));

            if (!refreshedDevices.length) {
                stateManager.setUserState(userId, AdminState.AUTHENTICATED_WITH_WAREHOUSE);
                stateManager.resetUserTempData(userId);
                if (tempData?.adminId && tempData?.adminPermissionsLevel) {
                    stateManager.setUserTempData(userId, {
                        adminId: tempData.adminId,
                        adminPermissionsLevel: tempData.adminPermissionsLevel
                    });
                }

                await bot.sendMessage(chatId, '❌ Действие отменено. Список СИМ пуст, вы возвращены в состояние выбранного склада.');
                return;
            }

            stateManager.setUserState(userId, AdminState.SIM_INTERACTIONS_SELECTING);
            stateManager.resetUserTempData(userId);
            stateManager.setUserTempData(userId, {
                adminId: tempData?.adminId,
                adminPermissionsLevel: tempData?.adminPermissionsLevel,
                simInteractionWarehouseId: warehouseId,
                simInteractionDevices: refreshedDevices,
                selectedSimInteractionDeviceId: undefined
            });

            const simList = refreshedDevices
                .map((device, index) => `${index + 1}. ${device.deviceNumber}`)
                .join('\n');
            await bot.sendMessage(
                chatId,
                `❌ Действие отменено. Вы возвращены к списку СИМ.\n\nВведите номер СИМ:\n\n${simList}`
            );
            return;
        }

        if (await blockIfAdminGuestCommandNotAllowed(bot, chatId, userId, msg.text)) {
            return;
        }

        let wasInProcess = false;

        // 1️⃣ Проверяем регистрацию
        if (registrationHandler.isUserInRegistration(userId)) {
            await registrationHandler.cancelRegistration(chatId, userId);
            wasInProcess = true;
        }

        // 2️⃣ Проверяем общее состояние (например, выбор склада)
        const state = stateManager.getUserState(userId);
        if (state) {
            stateManager.resetUserState(userId);
            stateManager.resetUserTempData(userId);
            wasInProcess = true;
        }

        // 3️⃣ Если пользователь не находился ни в каком процессе
        if (!wasInProcess) {
            await bot.sendMessage(chatId, 'ℹ️ Нет активного действия для отмены.');
            return;
        }

        // 4️⃣ Универсальное сообщение
        await bot.sendMessage(chatId, '❌ Действие отменено.');

        // 5️⃣ Восстанавливаем основную клавиатуру по текущему состоянию курьера
        await sendCourierMainKeyboard(bot, chatId, userId, courierService, sessionService);
    });
}