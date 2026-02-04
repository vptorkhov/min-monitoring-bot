export { handleStart } from './start';
export { handleHelp } from './help';
export { handleMyInfo } from './myinfo';
export { handleRegistrationMessage } from './registration';

// Экспортируем функции администратора
export {
    handleAdmin,
    handleAdminRegistrationMessage,
    handleCancel,
    isAdmin,
    adminStateManager  // ← ДОБАВИТЬ
} from './admin';

// Экспортируем функции для работы с устройствами
export {
    handleAddDevice,
    handleAddDeviceButton,
    handleAddDeviceMessage,
    handleListDevices,
    addDeviceStateManager  // ← ДОБАВИТЬ
} from './admin-devices';

export {
    handleViewCouriers,
    handleViewCouriersButton
} from './admin-couriers';

// Добавляем экспорт:
export {
    handleManageCouriers,
    handleManageCouriersButton,
    handleCourierManagementMessage,
    courierManagementStateManager
} from './admin-courier-management';

// Добавляем экспорт:
export {
    handleActiveSessions,
    handleActiveSessionsButton
} from './admin-sessions';

// Добавляем экспорт:
export {
    handleSessionHistory,
    handleSessionHistoryButton,
    handleSessionHistoryMessage,
    sessionHistoryStateManager
} from './admin-session-history';

// Добавляем экспорт:
export {
    handleTakeDevice,
    handleTakeDeviceButton,
    handleTakeDeviceMessage,
    takeDeviceStateManager
} from './user-take-device';