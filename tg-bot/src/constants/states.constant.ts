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
    CHANGE_PASSWORD_AWAITING_NEW: 'admin_change_password_awaiting_new',
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
    EDIT_ADMIN_AWAITING_PASSWORD: 'admin_edit_admin_awaiting_password'
} as const;

// Тип для состояний админ-режима
export type AdminStateType = typeof AdminState[keyof typeof AdminState];