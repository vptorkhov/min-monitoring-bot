// src/constants/states.constant.ts

// Состояния регистрации курьера (для управления диалогом с ботом)
export const RegistrationState = {
    IDLE: 'idle',                    // не в процессе регистрации
    AWAITING_NAME: 'awaiting_name',  // ожидаем ввод полного имени
    AWAITING_PHONE: 'awaiting_phone' // ожидаем ввод номера телефона
} as const;

// Тип для состояний регистрации (для TypeScript)
export type RegistrationStateType = typeof RegistrationState[keyof typeof RegistrationState];

// Добавляем состояние выбора склада
export const WarehouseState = {
    SELECTING_WAREHOUSE: 'selecting_warehouse'
} as const;

// Тип для состояния склада
export type WarehouseStateType = typeof WarehouseState[keyof typeof WarehouseState];

// Состояния для процессов взятия/сдачи СИМ
export const DeviceSessionState = {
    TAKE_DEVICE_SELECT: 'take_device_select',           // ожидаем ввод номера из списка для взятия
    RETURN_ASK_DAMAGE: 'return_ask_damage',             // спрашиваем, есть ли повреждения при сдаче
    RETURN_DAMAGE_TYPE: 'return_damage_type',           // выбираем тип повреждения
    RETURN_DESCRIPTION: 'return_description'            // просим описать повреждения
} as const;

// Тип для состояний сессии устройства
export type DeviceSessionStateType = typeof DeviceSessionState[keyof typeof DeviceSessionState];

// Состояния админ-режима
export const AdminState = {
    GUEST_MODE: 'admin_guest_mode',
    REGISTER_AWAITING_LOGIN: 'admin_register_awaiting_login',
    REGISTER_AWAITING_PASSWORD: 'admin_register_awaiting_password',
    LOGIN_AWAITING_LOGIN: 'admin_login_awaiting_login',
    LOGIN_AWAITING_PASSWORD: 'admin_login_awaiting_password',
    AUTHENTICATED: 'admin_authenticated',
    AUTHENTICATED_WITH_WAREHOUSE: 'admin_authenticated_with_warehouse',
    CHANGE_PASSWORD_AWAITING_NEW: 'admin_change_password_awaiting_new',
    SET_WAREHOUSE_SELECTING: 'admin_set_warehouse_selecting',
    CREATE_WAREHOUSE_AWAITING_NAME: 'admin_create_warehouse_awaiting_name',
    CREATE_WAREHOUSE_AWAITING_ADDRESS: 'admin_create_warehouse_awaiting_address',
    EDIT_WAREHOUSES_SELECTING: 'admin_edit_warehouses_selecting',
    EDIT_WAREHOUSE_ACTION_SELECTING: 'admin_edit_warehouse_action_selecting',
    EDIT_WAREHOUSE_AWAITING_NAME: 'admin_edit_warehouse_awaiting_name',
    EDIT_WAREHOUSE_AWAITING_ADDRESS: 'admin_edit_warehouse_awaiting_address',
    EDIT_WAREHOUSE_AWAITING_STATUS: 'admin_edit_warehouse_awaiting_status',
    EDIT_WAREHOUSE_AWAITING_DELETE_CONFIRM: 'admin_edit_warehouse_awaiting_delete_confirm',
    EDIT_ADMINS_SELECTING: 'admin_edit_admins_selecting',
    EDIT_ADMIN_ACTION_SELECTING: 'admin_edit_admin_action_selecting',
    EDIT_ADMIN_AWAITING_STATUS: 'admin_edit_admin_awaiting_status',
    EDIT_ADMIN_AWAITING_DELETE_CONFIRM: 'admin_edit_admin_awaiting_delete_confirm',
    EDIT_ADMIN_AWAITING_PASSWORD: 'admin_edit_admin_awaiting_password',
    APPLY_REGISTRATIONS_SELECTING: 'admin_apply_registrations_selecting',
    APPLY_REGISTRATION_AWAITING_CONFIRM: 'admin_apply_registration_awaiting_confirm',
    ADD_SIM_AWAITING_NUMBER: 'admin_add_sim_awaiting_number',
    SIM_INTERACTIONS_SELECTING: 'admin_sim_interactions_selecting',
    SIM_INTERACTION_ACTION_SELECTING: 'admin_sim_interaction_action_selecting',
    SIM_INTERACTION_AWAITING_ACTIVE_STATUS: 'admin_sim_interaction_awaiting_active_status',
    SIM_INTERACTION_AWAITING_CONDITION_STATUS: 'admin_sim_interaction_awaiting_condition_status',
    SIM_INTERACTION_AWAITING_DELETE_CONFIRM: 'admin_sim_interaction_awaiting_delete_confirm',
    ADMIN_EDIT_COURIERS_SELECTING: 'admin_edit_couriers_selecting',
    SUPERADMIN_EDIT_COURIERS_SELECTING: 'superadmin_edit_couriers_selecting',
    ADMIN_EDIT_COURIER_ACTION_SELECTING: 'admin_edit_courier_action_selecting',
    SUPERADMIN_EDIT_COURIER_ACTION_SELECTING: 'superadmin_edit_courier_action_selecting',
    ADMIN_EDIT_COURIER_AWAITING_STATUS: 'admin_edit_courier_awaiting_status',
    SUPERADMIN_EDIT_COURIER_AWAITING_STATUS: 'superadmin_edit_courier_awaiting_status',
    ADMIN_COURIER_HISTORY_AWAITING_FULL: 'admin_courier_history_awaiting_full',
    SUPERADMIN_COURIER_HISTORY_AWAITING_FULL: 'superadmin_courier_history_awaiting_full'
} as const;

// Тип для состояний админ-режима
export type AdminStateType = typeof AdminState[keyof typeof AdminState];