import TelegramBot from 'node-telegram-bot-api';
import { RegistrationHandler } from '../handlers/registration.handler';
import { CourierService } from '../../services/courier.service';
import { SessionService } from '../../services/session.service';
import { AdminService } from '../../services/admin.service';
import { MobilityDeviceRepository } from '../../repositories/mobility-device.repository';
import { CourierRepository } from '../../repositories/courier.repository';
import { getDatabase } from '../../config/database';
import {
    stateManager
} from '../state-manager';
import { sendCourierMainKeyboard } from '../keyboards/courier-main-keyboard';
import { blockIfAdminGuestCommandNotAllowed } from '../admin/admin-mode';
import { AdminState } from '../../constants/states.constant';
import { getAdminCommandListMessage, isAuthenticatedAdminState } from '../admin/admin-command-hints';

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
    const courierRepository = new CourierRepository(getDatabase());

    const formatEditableAdminsList = (admins: { nickname: string }[]): string => {
        return admins
            .map((admin, index) => `${index + 1}. ${admin.nickname}`)
            .join('\n');
    };

    const sendAdminCommandsIfNeeded = async (
        chatId: number,
        adminPermissionsLevel: number | undefined,
        targetState: string | undefined
    ) => {
        if (!adminPermissionsLevel || !isAuthenticatedAdminState(targetState)) {
            return;
        }

        const isWarehouseSelected = targetState === AdminState.AUTHENTICATED_WITH_WAREHOUSE;
        await bot.sendMessage(
            chatId,
            getAdminCommandListMessage(adminPermissionsLevel, isWarehouseSelected)
        );
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
            await sendAdminCommandsIfNeeded(chatId, adminPermissionsLevel, returnState);
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
            await sendAdminCommandsIfNeeded(
                chatId,
                adminPermissionsLevel,
                currentWarehouseId ? AdminState.AUTHENTICATED_WITH_WAREHOUSE : AdminState.AUTHENTICATED
            );
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
            await sendAdminCommandsIfNeeded(
                chatId,
                adminPermissionsLevel,
                currentWarehouseId ? AdminState.AUTHENTICATED_WITH_WAREHOUSE : AdminState.AUTHENTICATED
            );
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
            await sendAdminCommandsIfNeeded(chatId, adminPermissionsLevel, returnState);
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
            await sendAdminCommandsIfNeeded(chatId, adminPermissionsLevel, returnState);
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
                await sendAdminCommandsIfNeeded(chatId, adminPermissionsLevel, returnState);
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
            await sendAdminCommandsIfNeeded(chatId, adminPermissionsLevel, returnState);
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
                await sendAdminCommandsIfNeeded(chatId, adminPermissionsLevel, returnState);
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
            await sendAdminCommandsIfNeeded(chatId, adminPermissionsLevel, AdminState.AUTHENTICATED_WITH_WAREHOUSE);
            return;
        }

        const isSessionsHistoryDateState = currentState === AdminState.ADMIN_SESSIONS_HISTORY_AWAITING_DATE;
        if (isSessionsHistoryDateState) {
            const tempData = stateManager.getUserTempData<{
                adminId?: number;
                adminPermissionsLevel?: number;
                sessionsHistoryReturnState?: string;
            }>(userId);

            const adminId = tempData?.adminId;
            const adminPermissionsLevel = tempData?.adminPermissionsLevel;
            const returnState = tempData?.sessionsHistoryReturnState || AdminState.AUTHENTICATED;

            stateManager.setUserState(userId, returnState);
            stateManager.resetUserTempData(userId);
            if (adminId && adminPermissionsLevel) {
                stateManager.setUserTempData(userId, { adminId, adminPermissionsLevel });
            }

            await bot.sendMessage(chatId, '❌ Просмотр истории сессий отменен. Вы возвращены в предыдущее состояние.');
            await sendAdminCommandsIfNeeded(chatId, adminPermissionsLevel, returnState);
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
            await sendAdminCommandsIfNeeded(chatId, adminPermissionsLevel, AdminState.AUTHENTICATED_WITH_WAREHOUSE);
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
                await sendAdminCommandsIfNeeded(
                    chatId,
                    tempData?.adminPermissionsLevel,
                    AdminState.AUTHENTICATED_WITH_WAREHOUSE
                );
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
                await sendAdminCommandsIfNeeded(
                    chatId,
                    tempData?.adminPermissionsLevel,
                    AdminState.AUTHENTICATED_WITH_WAREHOUSE
                );
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

        const isEditCouriersSelectingState = currentState === AdminState.ADMIN_EDIT_COURIERS_SELECTING
            || currentState === AdminState.SUPERADMIN_EDIT_COURIERS_SELECTING;
        if (isEditCouriersSelectingState) {
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
            return;
        }

        const isEditCourierActionSelectingState = currentState === AdminState.ADMIN_EDIT_COURIER_ACTION_SELECTING
            || currentState === AdminState.SUPERADMIN_EDIT_COURIER_ACTION_SELECTING;
        if (isEditCourierActionSelectingState) {
            const isSuperadmin = currentState === AdminState.SUPERADMIN_EDIT_COURIER_ACTION_SELECTING;
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
                return;
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

            const listText = couriers
                .map((c, index) => `${index + 1}. ${c.fullName}`)
                .join('\n');
            await bot.sendMessage(
                chatId,
                `❌ Действие отменено. Вы возвращены к выбору курьера.\n\nВведите номер курьера:\n\n${listText}\n\n/cancel - вернуться в предыдущее состояние.`
            );
            return;
        }

        const isEditCourierSubflowState = currentState === AdminState.ADMIN_EDIT_COURIER_AWAITING_STATUS
            || currentState === AdminState.SUPERADMIN_EDIT_COURIER_AWAITING_STATUS
            || currentState === AdminState.ADMIN_COURIER_HISTORY_AWAITING_FULL
            || currentState === AdminState.SUPERADMIN_COURIER_HISTORY_AWAITING_FULL;
        if (isEditCourierSubflowState) {
            const isSuperadmin = currentState === AdminState.SUPERADMIN_EDIT_COURIER_AWAITING_STATUS
                || currentState === AdminState.SUPERADMIN_COURIER_HISTORY_AWAITING_FULL;

            const tempData = stateManager.getUserTempData<{
                adminId?: number;
                adminPermissionsLevel?: number;
                selectedEditCourierId?: number;
                editCouriers?: unknown[];
                editCouriersReturnState?: string;
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
                    const statusCmd = isSuperadmin ? '/superadmin_edit_courier_status' : '/admin_edit_courier_status';
                    const historyCmd = isSuperadmin ? '/superadmin_courier_history' : '/admin_courier_history';
                    await bot.sendMessage(
                        chatId,
                        `❌ Действие отменено. Вы возвращены к информации о курьере.\n\nКурьер: <b>${row.full_name}</b>\nТелефон: <b>${row.phone_number}</b>\nСтатус: <b>${statusText}</b>\n\nДоступные команды:\n${statusCmd}\n${historyCmd}\n\n/cancel - вернуться к списку курьеров.`,
                        { parse_mode: 'HTML' }
                    );
                    return;
                }
            }

            await bot.sendMessage(chatId, '❌ Действие отменено. Вы возвращены к выбору операции по курьеру.');
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