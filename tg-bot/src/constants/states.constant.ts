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