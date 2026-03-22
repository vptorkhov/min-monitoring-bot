import TelegramBot from "node-telegram-bot-api";
import { RegistrationHandler } from "../handlers/registration.handler";
import { CourierService } from "../../services/courier.service";
import { SessionService } from "../../services/session.service";
import { AdminService } from "../../services/admin.service";
import { WarehouseService } from "../../services/warehouse.service";
import { WarehouseRepository } from "../../repositories/warehouse.repository";
import { MobilityDeviceRepository } from "../../repositories/mobility-device.repository";
import {
  enterAdminMode,
  exitAdminMode,
  isUserInAdminMode,
} from "../admin/admin-mode";
import { sendCourierMainKeyboard } from "../keyboards/courier-main-keyboard";
import { stateManager } from "../state-manager";
import { isCommand } from "../../constants/commands.constant";
import { AdminState } from "../../constants/states.constant";
import { Warehouse } from "../../repositories/types/warehouse.type";
import { validateSimNumber } from "../../validators/sim-number.validator";

const HIDE_REPLY_KEYBOARD: TelegramBot.ReplyKeyboardRemove = {
  remove_keyboard: true,
};

type AdminSessionData = {
  adminId?: number;
  adminPermissionsLevel?: number;
  createWarehouseName?: string;
  adminSetWarehouses?: Warehouse[];
  adminSetReturnState?: string;
  editWarehouses?: Warehouse[];
  selectedWarehouseId?: number;
  editAdmins?: EditableAdminSessionItem[];
  selectedEditAdminId?: number;
  editReturnState?: string;
  addSimWarehouseId?: number;
};

type EditableAdminSessionItem = {
  id: number;
  nickname: string;
  isActive: boolean;
};

function escapeMarkdown(text: string): string {
  return text.replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getWarehouseStatusText(isActive: boolean): string {
  return isActive ? "Активный" : "Отключен";
}

function parseWarehouseStatusInput(input: string): boolean | null {
  const normalized = input.trim().toLowerCase().replace(/\s+/g, " ");

  if (
    normalized === "1" ||
    normalized === "1." ||
    normalized === "активный" ||
    normalized === "1 активный" ||
    normalized === "1. активный"
  ) {
    return true;
  }

  if (
    normalized === "2" ||
    normalized === "2." ||
    normalized === "отключен" ||
    normalized === "2 отключен" ||
    normalized === "2. отключен"
  ) {
    return false;
  }

  return null;
}

function getAdminStatusText(isActive: boolean): string {
  return isActive ? "Активный" : "Отключен";
}

function parseAdminStatusInput(input: string): boolean | null {
  const normalized = input.trim().toLowerCase().replace(/\s+/g, " ");

  if (
    normalized === "1" ||
    normalized === "1." ||
    normalized === "активный" ||
    normalized === "1 активный" ||
    normalized === "1. активный"
  ) {
    return true;
  }

  if (
    normalized === "2" ||
    normalized === "2." ||
    normalized === "отключен" ||
    normalized === "2 отключен" ||
    normalized === "2. отключен"
  ) {
    return false;
  }

  return null;
}

function getAuthenticatedAdminWelcomeMessage(
  adminPermissionsLevel: number,
  isWarehouseSelected: boolean,
): string {
  const warehouseCommands = isWarehouseSelected
    ? [
        "",
        "Команды выбранного склада:",
        "/admin_set_warehouse",
        "/admin_clear_warehouse",
        "/admin_add_sim",
      ]
    : ["", "Команда выбора склада:", "/admin_set_warehouse"];

  if (adminPermissionsLevel >= 2) {
    return [
      "✅ Вы успешно вошли как суперадмин.",
      "",
      "Доступные команды:",
      "/admin_change_password",
      "/superadmin_create_warehouse",
      "/superadmin_edit_warehouses",
      "/superadmin_edit_admins",
      ...warehouseCommands,
      "",
      "Общие команды админ-режима:",
      "/admin_logout",
      "/exit_admin",
      "/cancel",
    ].join("\n");
  }

  return [
    "✅ Вы успешно вошли как админ.",
    "",
    "Доступные команды:",
    "/admin_change_password",
    ...warehouseCommands,
    "",
    "Общие команды админ-режима:",
    "/admin_logout",
    "/exit_admin",
    "/cancel",
  ].join("\n");
}

async function restoreCourierFlowAfterExitAdmin(
  bot: TelegramBot,
  chatId: number,
  telegramId: number,
  courierService: CourierService,
  registrationHandler: RegistrationHandler,
  sessionService: SessionService,
): Promise<void> {
  const check = await courierService.checkCourierExists(telegramId);

  if (!check.exists) {
    await registrationHandler.startRegistration(chatId, telegramId);
    return;
  }

  if (!check.isActive) {
    await bot.sendMessage(
      chatId,
      "⏳ Ваш курьерский аккаунт ещё не активирован администратором. Доступные команды: /start и /admin.",
    );
    return;
  }

  await sendCourierMainKeyboard(
    bot,
    chatId,
    telegramId,
    courierService,
    sessionService,
  );
}

export function registerAdminModeCommands(
  bot: TelegramBot,
  courierService: CourierService,
  registrationHandler: RegistrationHandler,
  sessionService: SessionService,
) {
  const adminService = new AdminService();
  const warehouseService = new WarehouseService(new WarehouseRepository());
  const mobilityDeviceRepository = new MobilityDeviceRepository();

  const isInAuthenticatedOrSubflow = (currentState?: string) => {
    return (
      currentState === AdminState.AUTHENTICATED ||
      currentState === AdminState.AUTHENTICATED_WITH_WAREHOUSE ||
      currentState === AdminState.CHANGE_PASSWORD_AWAITING_NEW ||
      currentState === AdminState.SET_WAREHOUSE_SELECTING ||
      currentState === AdminState.CREATE_WAREHOUSE_AWAITING_NAME ||
      currentState === AdminState.CREATE_WAREHOUSE_AWAITING_ADDRESS ||
      currentState === AdminState.EDIT_WAREHOUSES_SELECTING ||
      currentState === AdminState.EDIT_WAREHOUSE_ACTION_SELECTING ||
      currentState === AdminState.EDIT_WAREHOUSE_AWAITING_NAME ||
      currentState === AdminState.EDIT_WAREHOUSE_AWAITING_ADDRESS ||
      currentState === AdminState.EDIT_WAREHOUSE_AWAITING_STATUS ||
      currentState === AdminState.EDIT_WAREHOUSE_AWAITING_DELETE_CONFIRM ||
      currentState === AdminState.EDIT_ADMINS_SELECTING ||
      currentState === AdminState.EDIT_ADMIN_ACTION_SELECTING ||
      currentState === AdminState.EDIT_ADMIN_AWAITING_STATUS ||
      currentState === AdminState.EDIT_ADMIN_AWAITING_DELETE_CONFIRM ||
      currentState === AdminState.EDIT_ADMIN_AWAITING_PASSWORD ||
      currentState === AdminState.ADD_SIM_AWAITING_NUMBER
    );
  };

  const restoreToAuthenticatedWithAdminContext = (
    telegramId: number,
    tempData: AdminSessionData,
    targetState?: string,
  ) => {
    stateManager.setUserState(
      telegramId,
      targetState || tempData.editReturnState || AdminState.AUTHENTICATED,
    );
    stateManager.resetUserTempData(telegramId);

    if (tempData.adminId && tempData.adminPermissionsLevel) {
      stateManager.setUserTempData(telegramId, {
        adminId: tempData.adminId,
        adminPermissionsLevel: tempData.adminPermissionsLevel,
      });
    }
  };

  const sendWarehouseActionsMessage = async (
    chatId: number,
    warehouse: Warehouse,
  ) => {
    const safeName = escapeHtml(warehouse.name);
    const safeAddress = escapeHtml(warehouse.address || "-");
    const status = getWarehouseStatusText(warehouse.is_active);
    const commandsList = [
      "/superadmin_edit_warehouse_name",
      "/superadmin_edit_warehouse_address",
      "/superadmin_edit_warehouse_status",
      "/superadmin_edit_warehouse_delete",
    ].join("\n");

    await bot.sendMessage(
      chatId,
      `Выбран склад:\n<b>${safeName}</b> - <b>${safeAddress}</b>\nСтатус: <b>${status}</b>\n\nДоступные действия:\n${commandsList}`,
      { parse_mode: "HTML" },
    );
  };

  const formatWarehouseListForAdminSelection = (warehouses: Warehouse[]): string => {
    return warehouses
      .map(
        (warehouse, index) =>
          `${index + 1}. <b>${escapeHtml(warehouse.name)}</b> <b>${escapeHtml(warehouse.address || "-")}</b>`,
      )
      .join("\n");
  };

  const formatEditableAdminsList = (admins: EditableAdminSessionItem[]): string => {
    return admins
      .map((admin, index) => `${index + 1}. <b>${escapeHtml(admin.nickname)}</b>`)
      .join("\n");
  };

  const sendEditableAdminsListMessage = async (
    chatId: number,
    admins: EditableAdminSessionItem[],
  ) => {
    const listText = formatEditableAdminsList(admins);
    await bot.sendMessage(
      chatId,
      `Введите номер администратора:\n\n${listText}`,
      { parse_mode: "HTML" },
    );
  };

  const sendAdminActionsMessage = async (
    chatId: number,
    admin: EditableAdminSessionItem,
  ) => {
    const commandsList = [
      "/superadmin_edit_admin_status",
      "/superadmin_edit_admin_delete",
      "/superadmin_edit_admin_password",
    ].join("\n");

    await bot.sendMessage(
      chatId,
      `Выбран администратор:\n<b>${escapeHtml(admin.nickname)}</b>\nСтатус: <b>${getAdminStatusText(admin.isActive)}</b>\n\nДоступные действия:\n${commandsList}`,
      { parse_mode: "HTML" },
    );
  };

  const tryResolveSelectedAdmin = async (
    telegramId: number,
    chatId: number,
  ): Promise<{ tempData: AdminSessionData; admin: EditableAdminSessionItem } | null> => {
    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    const selectedEditAdminId = tempData.selectedEditAdminId;

    if (!selectedEditAdminId) {
      await bot.sendMessage(
        chatId,
        "❌ Команда недоступна без выбора администратора через /superadmin_edit_admins.",
      );
      return null;
    }

    const admin = await adminService.getAdminById(selectedEditAdminId);
    if (!admin || admin.permissionsLevel >= 2) {
      await bot.sendMessage(
        chatId,
        "❌ Выбранный администратор не найден. Запустите /superadmin_edit_admins заново.",
      );
      return null;
    }

    return {
      tempData,
      admin: {
        id: admin.id,
        nickname: admin.nickname,
        isActive: admin.isActive,
      },
    };
  };

  const loadEditableAdmins = async (): Promise<EditableAdminSessionItem[]> => {
    const admins = await adminService.getEditableAdmins();

    return admins
      .filter((admin) => admin.permissionsLevel < 2)
      .map((admin) => ({
        id: admin.id,
        nickname: admin.nickname,
        isActive: admin.isActive,
      }));
  };

  const tryResolveSelectedWarehouse = async (
    telegramId: number,
    chatId: number,
  ): Promise<{ tempData: AdminSessionData; warehouse: Warehouse } | null> => {
    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    const selectedWarehouseId = tempData.selectedWarehouseId;

    if (!selectedWarehouseId) {
      await bot.sendMessage(
        chatId,
        "❌ Команда недоступна без выбора склада через /superadmin_edit_warehouses.",
      );
      return null;
    }

    const warehouse =
      await warehouseService.getWarehouseById(selectedWarehouseId);
    if (!warehouse) {
      await bot.sendMessage(
        chatId,
        "❌ Выбранный склад не найден. Запустите /superadmin_edit_warehouses заново.",
      );
      return null;
    }

    return { tempData, warehouse };
  };

  const startAdminRegistrationFlow = async (
    chatId: number,
    telegramId: number,
  ) => {
    stateManager.setUserState(telegramId, AdminState.REGISTER_AWAITING_LOGIN);
    stateManager.resetUserTempData(telegramId);

    await bot.sendMessage(chatId, "Придумайте и введите логин");
  };

  const startAdminLoginFlow = async (chatId: number, telegramId: number) => {
    stateManager.setUserState(telegramId, AdminState.LOGIN_AWAITING_LOGIN);
    stateManager.resetUserTempData(telegramId);

    await bot.sendMessage(chatId, "Введите логин");
  };

  bot.onText(/^\/admin(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    const wasInAdminMode = isUserInAdminMode(telegramId);
    enterAdminMode(telegramId);

    await bot.sendMessage(
      chatId,
      wasInAdminMode
        ? "🛡 Вы уже в админском режиме. Доступны: /admin_login, /admin_register, /admin_logout, /exit_admin."
        : "🛡 Включен админский режим. Текущий курьерский сценарий остановлен. Доступны: /admin_login, /admin_register, /admin_logout, /exit_admin.",
      { reply_markup: HIDE_REPLY_KEYBOARD },
    );
  });

  bot.onText(/^\/admin_logout(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "ℹ️ Сначала войдите в админский режим командой /admin.",
      );
      return;
    }

    const currentState = stateManager.getUserState(telegramId);
    const tempData = stateManager.getUserTempData<{ adminId?: number }>(
      telegramId,
    );
    const adminId = tempData?.adminId;
    const wasAuthenticated =
      currentState === AdminState.AUTHENTICATED ||
      currentState === AdminState.AUTHENTICATED_WITH_WAREHOUSE ||
      currentState === AdminState.CHANGE_PASSWORD_AWAITING_NEW ||
      currentState === AdminState.SET_WAREHOUSE_SELECTING ||
      currentState === AdminState.CREATE_WAREHOUSE_AWAITING_NAME ||
      currentState === AdminState.CREATE_WAREHOUSE_AWAITING_ADDRESS ||
      currentState === AdminState.EDIT_WAREHOUSES_SELECTING ||
      currentState === AdminState.EDIT_WAREHOUSE_ACTION_SELECTING ||
      currentState === AdminState.EDIT_WAREHOUSE_AWAITING_NAME ||
      currentState === AdminState.EDIT_WAREHOUSE_AWAITING_ADDRESS ||
      currentState === AdminState.EDIT_WAREHOUSE_AWAITING_STATUS ||
      currentState === AdminState.EDIT_WAREHOUSE_AWAITING_DELETE_CONFIRM ||
      currentState === AdminState.EDIT_ADMINS_SELECTING ||
      currentState === AdminState.EDIT_ADMIN_ACTION_SELECTING ||
      currentState === AdminState.EDIT_ADMIN_AWAITING_STATUS ||
      currentState === AdminState.EDIT_ADMIN_AWAITING_DELETE_CONFIRM ||
      currentState === AdminState.EDIT_ADMIN_AWAITING_PASSWORD ||
      currentState === AdminState.ADD_SIM_AWAITING_NUMBER;

    if (wasAuthenticated && adminId) {
      await adminService.setLoginStatus(adminId, false);
    }

    stateManager.setUserState(telegramId, AdminState.GUEST_MODE);
    stateManager.resetUserTempData(telegramId);

    await bot.sendMessage(
      chatId,
      wasAuthenticated
        ? "✅ Вы вышли из авторизованного админ-режима и возвращены в предадминское состояние. Доступны: /admin_login, /admin_register, /admin_logout, /exit_admin."
        : "ℹ️ Вы уже находитесь в предадминском состоянии. Доступны: /admin_login, /admin_register, /admin_logout, /exit_admin.",
    );
  });

  bot.onText(/^\/exit_admin(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(chatId, "ℹ️ Админский режим уже выключен.");
      return;
    }

    exitAdminMode(telegramId);
    await bot.sendMessage(
      chatId,
      "✅ Админский режим выключен. Возвращаем вас в курьерский режим...",
    );

    await restoreCourierFlowAfterExitAdmin(
      bot,
      chatId,
      telegramId,
      courierService,
      registrationHandler,
      sessionService,
    );
  });

  bot.onText(/^\/admin_login(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "ℹ️ Сначала войдите в админский режим командой /admin.",
      );
      return;
    }

    await startAdminLoginFlow(chatId, telegramId);
  });

  bot.onText(/^\/admin_register(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "ℹ️ Сначала войдите в админский режим командой /admin.",
      );
      return;
    }

    await startAdminRegistrationFlow(chatId, telegramId);
  });

  bot.onText(/^\/admin_change_password(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "ℹ️ Сначала войдите в админский режим командой /admin.",
      );
      return;
    }

    const currentState = stateManager.getUserState(telegramId);
    if (!isInAuthenticatedOrSubflow(currentState)) {
      await bot.sendMessage(
        chatId,
        "🔒 Эта команда доступна только авторизованному администратору. Используйте /admin_login.",
      );
      return;
    }

    const tempData = stateManager.getUserTempData<AdminSessionData>(telegramId);
    if (!tempData?.adminId) {
      stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
      await bot.sendMessage(
        chatId,
        "⚠️ Не удалось определить администратора. Выполните /admin_login повторно.",
      );
      return;
    }

    stateManager.setUserState(telegramId, AdminState.CHANGE_PASSWORD_AWAITING_NEW);
    await bot.sendMessage(chatId, "Введите новый пароль, не менее 6 символов");
  });

  bot.onText(/^\/admin_set_warehouse(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "ℹ️ Сначала войдите в админский режим командой /admin.",
      );
      return;
    }

    const currentState = stateManager.getUserState(telegramId);
    if (!isInAuthenticatedOrSubflow(currentState)) {
      await bot.sendMessage(
        chatId,
        "🔒 Эта команда доступна только авторизованному администратору. Используйте /admin_login.",
      );
      return;
    }

    const tempData = stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    if (!tempData.adminId || !tempData.adminPermissionsLevel) {
      stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
      await bot.sendMessage(
        chatId,
        "⚠️ Не удалось определить администратора. Выполните /admin_login повторно.",
      );
      return;
    }

    const warehouses = await warehouseService.getActiveWarehouses();
    if (!warehouses.length) {
      await bot.sendMessage(chatId, "❌ Список активных складов пуст.");
      return;
    }

    const returnState =
      currentState === AdminState.SET_WAREHOUSE_SELECTING
        ? (tempData.adminSetReturnState || AdminState.AUTHENTICATED)
        : (currentState || AdminState.AUTHENTICATED);

    stateManager.setUserState(telegramId, AdminState.SET_WAREHOUSE_SELECTING);
    stateManager.setUserTempData(telegramId, {
      adminSetWarehouses: warehouses,
      adminSetReturnState: returnState,
    });

    await bot.sendMessage(
      chatId,
      `Выберите номер склада:\n\n${formatWarehouseListForAdminSelection(warehouses)}`,
      { parse_mode: "HTML" },
    );
  });

  bot.onText(/^\/admin_clear_warehouse(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "ℹ️ Сначала войдите в админский режим командой /admin.",
      );
      return;
    }

    const currentState = stateManager.getUserState(telegramId);
    if (!isInAuthenticatedOrSubflow(currentState)) {
      await bot.sendMessage(
        chatId,
        "🔒 Эта команда доступна только авторизованному администратору. Используйте /admin_login.",
      );
      return;
    }

    const tempData = stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    if (!tempData.adminId || !tempData.adminPermissionsLevel) {
      stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
      await bot.sendMessage(
        chatId,
        "⚠️ Не удалось определить администратора. Выполните /admin_login повторно.",
      );
      return;
    }

    const currentWarehouseId = await adminService.getAdminWarehouseId(tempData.adminId);
    if (currentWarehouseId === undefined) {
      stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
      await bot.sendMessage(
        chatId,
        "⚠️ Не удалось определить администратора. Выполните /admin_login повторно.",
      );
      return;
    }

    if (currentWarehouseId === null) {
      await bot.sendMessage(
        chatId,
        "❌ Команда доступна только если склад уже выбран. Используйте /admin_set_warehouse.",
      );
      return;
    }

    const clearResult = await adminService.clearAdminWarehouse(tempData.adminId);
    if (!clearResult.success) {
      await bot.sendMessage(
        chatId,
        `❌ ${clearResult.reason || "Не удалось отвязаться от склада."}`,
      );
      return;
    }

    stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
    stateManager.resetUserTempData(telegramId);
    stateManager.setUserTempData(telegramId, {
      adminId: tempData.adminId,
      adminPermissionsLevel: tempData.adminPermissionsLevel,
    });

    await bot.sendMessage(chatId, "✅ Вы успешно отвязались от склада.");
    await bot.sendMessage(
      chatId,
      getAuthenticatedAdminWelcomeMessage(tempData.adminPermissionsLevel, false),
    );
  });

  bot.onText(/^\/superadmin_create_warehouse(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      return;
    }

    const currentState = stateManager.getUserState(telegramId);

    if (!isInAuthenticatedOrSubflow(currentState)) {
      await bot.sendMessage(
        chatId,
        "🔒 Эта команда доступна только авторизованному администратору. Используйте /admin_login.",
      );
      return;
    }

    const tempData = stateManager.getUserTempData<{
      adminPermissionsLevel?: number;
    }>(telegramId);
    const permissionsLevel = tempData?.adminPermissionsLevel ?? 0;

    if (permissionsLevel < 2) {
      await bot.sendMessage(chatId, "🚫 Нет прав на эту команду.");
      return;
    }

    stateManager.setUserState(
      telegramId,
      AdminState.CREATE_WAREHOUSE_AWAITING_NAME,
    );
    await bot.sendMessage(chatId, "Введите название склада");
  });

  bot.onText(/^\/superadmin_edit_warehouses(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      return;
    }

    const currentState = stateManager.getUserState(telegramId);
    if (!isInAuthenticatedOrSubflow(currentState)) {
      await bot.sendMessage(
        chatId,
        "🔒 Эта команда доступна только авторизованному администратору. Используйте /admin_login.",
      );
      return;
    }

    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    const permissionsLevel = tempData.adminPermissionsLevel ?? 0;

    if (permissionsLevel < 2) {
      await bot.sendMessage(chatId, "🚫 Нет прав на эту команду.");
      return;
    }

    const warehouses = await warehouseService.getAllWarehouses();
    if (!warehouses.length) {
      await bot.sendMessage(chatId, "❌ Список складов пуст.");
      return;
    }

    const listText = warehouses
      .map(
        (w, index) =>
          `${index + 1}. <b>${escapeHtml(w.name)}</b> - <b>${escapeHtml(w.address || "-")}</b>`,
      )
      .join("\n");

    stateManager.setUserState(telegramId, AdminState.EDIT_WAREHOUSES_SELECTING);
    stateManager.setUserTempData(telegramId, {
      editWarehouses: warehouses,
      selectedWarehouseId: undefined,
      editReturnState: currentState || AdminState.AUTHENTICATED,
    });

    await bot.sendMessage(
      chatId,
      `Введите номер склада, который хотите изменить:\n\n${listText}`,
      { parse_mode: "HTML" },
    );
  });

  bot.onText(/^\/superadmin_edit_admins(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      return;
    }

    const currentState = stateManager.getUserState(telegramId);
    if (!isInAuthenticatedOrSubflow(currentState)) {
      await bot.sendMessage(
        chatId,
        "🔒 Эта команда доступна только авторизованному администратору. Используйте /admin_login.",
      );
      return;
    }

    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    const permissionsLevel = tempData.adminPermissionsLevel ?? 0;
    if (permissionsLevel < 2) {
      await bot.sendMessage(chatId, "🚫 Нет прав на эту команду.");
      return;
    }

    const editableAdmins = await loadEditableAdmins();
    if (!editableAdmins.length) {
      await bot.sendMessage(chatId, "❌ Список администраторов пуст.");
      return;
    }

    stateManager.setUserState(telegramId, AdminState.EDIT_ADMINS_SELECTING);
    stateManager.setUserTempData(telegramId, {
      editAdmins: editableAdmins,
      selectedEditAdminId: undefined,
      editReturnState: currentState || AdminState.AUTHENTICATED,
    });

    await sendEditableAdminsListMessage(chatId, editableAdmins);
  });

  bot.onText(/^\/superadmin_edit_admin_status(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "❌ Команда недоступна без выбора администратора через /superadmin_edit_admins.",
      );
      return;
    }

    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    if ((tempData.adminPermissionsLevel ?? 0) < 2) {
      await bot.sendMessage(chatId, "🚫 Нет прав на эту команду.");
      return;
    }

    const resolved = await tryResolveSelectedAdmin(telegramId, chatId);
    if (!resolved) {
      return;
    }

    stateManager.setUserState(telegramId, AdminState.EDIT_ADMIN_AWAITING_STATUS);
    await bot.sendMessage(
      chatId,
      `Текущий статус администратора: ${getAdminStatusText(resolved.admin.isActive)}\n\nВыберите, какой статус должен быть у администратора:\n1. Активный\n2. Отключен`,
    );
  });

  bot.onText(/^\/superadmin_edit_admin_delete(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "❌ Команда недоступна без выбора администратора через /superadmin_edit_admins.",
      );
      return;
    }

    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    if ((tempData.adminPermissionsLevel ?? 0) < 2) {
      await bot.sendMessage(chatId, "🚫 Нет прав на эту команду.");
      return;
    }

    const resolved = await tryResolveSelectedAdmin(telegramId, chatId);
    if (!resolved) {
      return;
    }

    stateManager.setUserState(
      telegramId,
      AdminState.EDIT_ADMIN_AWAITING_DELETE_CONFIRM,
    );
    await bot.sendMessage(
      chatId,
      "Вы уверены, что хотите удалить админа? Введите ДА",
    );
  });

  bot.onText(/^\/superadmin_edit_admin_password(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "❌ Команда недоступна без выбора администратора через /superadmin_edit_admins.",
      );
      return;
    }

    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    if ((tempData.adminPermissionsLevel ?? 0) < 2) {
      await bot.sendMessage(chatId, "🚫 Нет прав на эту команду.");
      return;
    }

    const resolved = await tryResolveSelectedAdmin(telegramId, chatId);
    if (!resolved) {
      return;
    }

    stateManager.setUserState(
      telegramId,
      AdminState.EDIT_ADMIN_AWAITING_PASSWORD,
    );
    await bot.sendMessage(chatId, "Введите новый пароль, не менее 6 символов");
  });

  bot.onText(/^\/superadmin_edit_warehouse_name(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "❌ Команда недоступна без выбора склада через /superadmin_edit_warehouses.",
      );
      return;
    }

    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    if ((tempData.adminPermissionsLevel ?? 0) < 2) {
      await bot.sendMessage(chatId, "🚫 Нет прав на эту команду.");
      return;
    }

    const resolved = await tryResolveSelectedWarehouse(telegramId, chatId);
    if (!resolved) {
      return;
    }

    stateManager.setUserState(
      telegramId,
      AdminState.EDIT_WAREHOUSE_AWAITING_NAME,
    );
    await bot.sendMessage(chatId, "Введите новое название склада");
  });

  bot.onText(/^\/superadmin_edit_warehouse_address(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "❌ Команда недоступна без выбора склада через /superadmin_edit_warehouses.",
      );
      return;
    }

    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    if ((tempData.adminPermissionsLevel ?? 0) < 2) {
      await bot.sendMessage(chatId, "🚫 Нет прав на эту команду.");
      return;
    }

    const resolved = await tryResolveSelectedWarehouse(telegramId, chatId);
    if (!resolved) {
      return;
    }

    stateManager.setUserState(
      telegramId,
      AdminState.EDIT_WAREHOUSE_AWAITING_ADDRESS,
    );
    await bot.sendMessage(chatId, "Введите новый адрес склада");
  });

  bot.onText(/^\/superadmin_edit_warehouse_status(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "❌ Команда недоступна без выбора склада через /superadmin_edit_warehouses.",
      );
      return;
    }

    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    if ((tempData.adminPermissionsLevel ?? 0) < 2) {
      await bot.sendMessage(chatId, "🚫 Нет прав на эту команду.");
      return;
    }

    const resolved = await tryResolveSelectedWarehouse(telegramId, chatId);
    if (!resolved) {
      return;
    }

    stateManager.setUserState(
      telegramId,
      AdminState.EDIT_WAREHOUSE_AWAITING_STATUS,
    );
    await bot.sendMessage(
      chatId,
      `Текущий статус склада: ${getWarehouseStatusText(resolved.warehouse.is_active)}\n\nВыберите, какой статус должен быть у склада:\n1. Активный\n2. Отключен`,
    );
  });

  bot.onText(/^\/superadmin_edit_warehouse_delete(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "❌ Команда недоступна без выбора склада через /superadmin_edit_warehouses.",
      );
      return;
    }

    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    if ((tempData.adminPermissionsLevel ?? 0) < 2) {
      await bot.sendMessage(chatId, "🚫 Нет прав на эту команду.");
      return;
    }

    const resolved = await tryResolveSelectedWarehouse(telegramId, chatId);
    if (!resolved) {
      return;
    }

    stateManager.setUserState(
      telegramId,
      AdminState.EDIT_WAREHOUSE_AWAITING_DELETE_CONFIRM,
    );
    await bot.sendMessage(
      chatId,
      "Вы уверены, что хотите удалить склад? Введите ДА",
    );
  });

  bot.onText(/^\/admin_add_sim(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "ℹ️ Сначала войдите в админский режим командой /admin.",
      );
      return;
    }

    const currentState = stateManager.getUserState(telegramId);
    if (!isInAuthenticatedOrSubflow(currentState)) {
      await bot.sendMessage(
        chatId,
        "🔒 Эта команда доступна только авторизованному администратору. Используйте /admin_login.",
      );
      return;
    }

    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    if (!tempData.adminId || !tempData.adminPermissionsLevel) {
      stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
      await bot.sendMessage(
        chatId,
        "⚠️ Не удалось определить администратора. Выполните /admin_login повторно.",
      );
      return;
    }

    const warehouseId = await adminService.getAdminWarehouseId(tempData.adminId);
    if (warehouseId === undefined) {
      stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
      await bot.sendMessage(
        chatId,
        "⚠️ Не удалось определить администратора. Выполните /admin_login повторно.",
      );
      return;
    }

    if (warehouseId === null) {
      await bot.sendMessage(
        chatId,
        "❌ Команда доступна только если выбран склад. Используйте /admin_set_warehouse.",
      );
      return;
    }

    stateManager.setUserState(telegramId, AdminState.ADD_SIM_AWAITING_NUMBER);
    stateManager.setUserTempData(telegramId, {
      addSimWarehouseId: warehouseId,
    });

    await bot.sendMessage(chatId, "Введите номер СИМ");
  });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;
    if (!telegramId) {
      return;
    }

    const currentState = stateManager.getUserState(telegramId);
    if (
      currentState !== AdminState.REGISTER_AWAITING_LOGIN &&
      currentState !== AdminState.REGISTER_AWAITING_PASSWORD &&
      currentState !== AdminState.LOGIN_AWAITING_LOGIN &&
      currentState !== AdminState.LOGIN_AWAITING_PASSWORD &&
      currentState !== AdminState.CHANGE_PASSWORD_AWAITING_NEW &&
      currentState !== AdminState.SET_WAREHOUSE_SELECTING &&
      currentState !== AdminState.CREATE_WAREHOUSE_AWAITING_NAME &&
      currentState !== AdminState.CREATE_WAREHOUSE_AWAITING_ADDRESS &&
      currentState !== AdminState.EDIT_WAREHOUSES_SELECTING &&
      currentState !== AdminState.EDIT_WAREHOUSE_ACTION_SELECTING &&
      currentState !== AdminState.EDIT_WAREHOUSE_AWAITING_NAME &&
      currentState !== AdminState.EDIT_WAREHOUSE_AWAITING_ADDRESS &&
      currentState !== AdminState.EDIT_WAREHOUSE_AWAITING_STATUS &&
      currentState !== AdminState.EDIT_WAREHOUSE_AWAITING_DELETE_CONFIRM &&
      currentState !== AdminState.EDIT_ADMINS_SELECTING &&
      currentState !== AdminState.EDIT_ADMIN_ACTION_SELECTING &&
      currentState !== AdminState.EDIT_ADMIN_AWAITING_STATUS &&
      currentState !== AdminState.EDIT_ADMIN_AWAITING_DELETE_CONFIRM &&
      currentState !== AdminState.EDIT_ADMIN_AWAITING_PASSWORD &&
      currentState !== AdminState.ADD_SIM_AWAITING_NUMBER
    ) {
      return;
    }

    const text = msg.text || "";
    if (!text) {
      return;
    }

    // Команды в ходе регистрации не перехватываем, их обрабатывают command-handlers.
    if (isCommand(text)) {
      return;
    }

    if (currentState === AdminState.REGISTER_AWAITING_LOGIN) {
      const loginInput = text.trim();
      const loginValidation = adminService.validateLogin(loginInput);
      if (!loginValidation.isValid) {
        await bot.sendMessage(
          chatId,
          `${loginValidation.error}\nПопробуйте снова.\n\nПридумайте и введите логин`,
        );
        return;
      }

      const isTaken = await adminService.isLoginTakenInsensitive(loginInput);
      if (isTaken) {
        await bot.sendMessage(
          chatId,
          "Логин уже занят (без учета регистра). Выберите другой.\n\nПридумайте и введите логин",
        );
        return;
      }

      stateManager.setUserTempDataField(
        telegramId,
        "adminRegisterLogin",
        loginInput,
      );
      stateManager.setUserState(
        telegramId,
        AdminState.REGISTER_AWAITING_PASSWORD,
      );
      await bot.sendMessage(
        chatId,
        "Придумайте и введите пароль. Требования - не менее 6 символов.",
      );
      return;
    }

    if (currentState === AdminState.LOGIN_AWAITING_LOGIN) {
      const loginInput = text.trim();
      const loginValidation = adminService.validateLogin(loginInput);
      if (!loginValidation.isValid) {
        await bot.sendMessage(
          chatId,
          `${loginValidation.error}\nПопробуйте снова.\n\nВведите логин`,
        );
        return;
      }

      const adminCandidate = await adminService.getLoginCandidate(loginInput);
      if (!adminCandidate) {
        await bot.sendMessage(
          chatId,
          "Пользователь с таким логином не найден.\n\nВведите логин",
        );
        return;
      }

      stateManager.setUserTempData(telegramId, {
        adminLoginId: adminCandidate.id,
        adminLoginNickname: adminCandidate.nickname,
        adminLoginPasswordHash: adminCandidate.passwordHash,
        adminLoginPermissionsLevel: adminCandidate.permissionsLevel,
        adminLoginIsActive: adminCandidate.isActive,
        adminLoginWarehouseId: adminCandidate.warehouseId,
      });
      stateManager.setUserState(telegramId, AdminState.LOGIN_AWAITING_PASSWORD);
      await bot.sendMessage(chatId, "Введите пароль");
      return;
    }

    if (currentState === AdminState.LOGIN_AWAITING_PASSWORD) {
      const tempData = stateManager.getUserTempData<{
        adminLoginId?: number;
        adminLoginNickname?: string;
        adminLoginPasswordHash?: string;
        adminLoginPermissionsLevel?: number;
        adminLoginIsActive?: boolean;
        adminLoginWarehouseId?: number | null;
      }>(telegramId);

      const adminLoginId = tempData?.adminLoginId;
      const adminLoginPasswordHash = tempData?.adminLoginPasswordHash;
      const adminLoginPermissionsLevel = tempData?.adminLoginPermissionsLevel;
      const adminLoginIsActive = tempData?.adminLoginIsActive;
      const adminLoginWarehouseId = tempData?.adminLoginWarehouseId;

      if (
        !adminLoginId ||
        !adminLoginPasswordHash ||
        !adminLoginPermissionsLevel
      ) {
        await startAdminLoginFlow(chatId, telegramId);
        return;
      }

      if (!adminLoginIsActive) {
        await bot.sendMessage(
          chatId,
          "⏳ Ваш админ-аккаунт еще не активирован суперадминистратором.\n\nВведите логин",
        );
        stateManager.setUserState(telegramId, AdminState.LOGIN_AWAITING_LOGIN);
        stateManager.resetUserTempData(telegramId);
        return;
      }

      const isPasswordValid = adminService.verifyPassword(
        text,
        adminLoginPasswordHash,
      );
      if (!isPasswordValid) {
        await bot.sendMessage(chatId, "Неверный пароль\n\nВведите пароль");
        return;
      }

      await adminService.setLoginStatus(adminLoginId, true);
      stateManager.setUserState(
        telegramId,
        adminLoginWarehouseId
          ? AdminState.AUTHENTICATED_WITH_WAREHOUSE
          : AdminState.AUTHENTICATED,
      );
      stateManager.setUserTempData(telegramId, {
        adminId: adminLoginId,
        adminPermissionsLevel: adminLoginPermissionsLevel,
      });

      await bot.sendMessage(
        chatId,
        getAuthenticatedAdminWelcomeMessage(
          adminLoginPermissionsLevel,
          !!adminLoginWarehouseId,
        ),
      );

      return;
    }

    if (currentState === AdminState.CHANGE_PASSWORD_AWAITING_NEW) {
      const passwordInput = text.trim();
      const passwordValidation = adminService.validatePassword(passwordInput);
      if (!passwordValidation.isValid) {
        await bot.sendMessage(
          chatId,
          "❌ Пароль должен содержать минимум 6 символов.\n\nВведите новый пароль, не менее 6 символов",
        );
        return;
      }

      const tempData = stateManager.getUserTempData<AdminSessionData>(telegramId);
      const adminId = tempData?.adminId;
      const adminPermissionsLevel = tempData?.adminPermissionsLevel;
      if (!adminId || !adminPermissionsLevel) {
        stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
        stateManager.resetUserTempData(telegramId);
        await bot.sendMessage(
          chatId,
          "⚠️ Не удалось определить администратора. Выполните /admin_login повторно.",
        );
        return;
      }

      const result = await adminService.changePassword(adminId, passwordInput);
      if (!result.success) {
        await bot.sendMessage(
          chatId,
          `❌ ${result.reason || "Не удалось сменить пароль."}\n\nВведите новый пароль, не менее 6 символов`,
        );
        return;
      }

      const currentWarehouseId = await adminService.getAdminWarehouseId(adminId);
      const authenticatedState = currentWarehouseId
        ? AdminState.AUTHENTICATED_WITH_WAREHOUSE
        : AdminState.AUTHENTICATED;

      stateManager.setUserState(telegramId, authenticatedState);
      stateManager.resetUserTempData(telegramId);
      stateManager.setUserTempData(telegramId, {
        adminId,
        adminPermissionsLevel,
      });

      await bot.sendMessage(
        chatId,
        "✅ Пароль успешно изменен. Вы остаетесь в авторизованном админ-режиме.",
      );
      return;
    }

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
          "⚠️ Не удалось определить администратора. Выполните /admin_login повторно.",
        );
        return;
      }

      if (!warehouses?.length) {
        const fallbackState =
          tempData.adminSetReturnState || AdminState.AUTHENTICATED;
        stateManager.setUserState(telegramId, fallbackState);
        stateManager.resetUserTempData(telegramId);
        stateManager.setUserTempData(telegramId, {
          adminId,
          adminPermissionsLevel,
        });
        await bot.sendMessage(
          chatId,
          "❌ Что-то пошло не так. Запустите /admin_set_warehouse заново.",
        );
        return;
      }

      if (!/^\d+$/.test(text.trim())) {
        await bot.sendMessage(
          chatId,
          "❌ Введите корректный номер склада из списка.",
        );
        return;
      }

      const index = parseInt(text.trim(), 10) - 1;
      if (index < 0 || index >= warehouses.length) {
        await bot.sendMessage(
          chatId,
          "❌ Склад с таким номером не найден. Введите номер из списка.",
        );
        return;
      }

      const selectedWarehouse = warehouses[index];
      const setWarehouseResult = await adminService.setAdminWarehouse(
        adminId,
        selectedWarehouse.id,
      );
      if (!setWarehouseResult.success) {
        await bot.sendMessage(
          chatId,
          `❌ ${setWarehouseResult.reason || "Не удалось выбрать склад."}`,
        );
        return;
      }

      stateManager.setUserState(telegramId, AdminState.AUTHENTICATED_WITH_WAREHOUSE);
      stateManager.resetUserTempData(telegramId);
      stateManager.setUserTempData(telegramId, {
        adminId,
        adminPermissionsLevel,
      });

      await bot.sendMessage(
        chatId,
        `✅ Вы успешно выбрали склад: <b>${escapeHtml(selectedWarehouse.name)}</b>.`,
        { parse_mode: "HTML" },
      );
      await bot.sendMessage(
        chatId,
        getAuthenticatedAdminWelcomeMessage(adminPermissionsLevel, true),
      );
      return;
    }

    if (currentState === AdminState.CREATE_WAREHOUSE_AWAITING_NAME) {
      const nameInput = text.trim();
      if (nameInput.length < 2) {
        await bot.sendMessage(
          chatId,
          "❌ Название должно содержать минимум 2 символа.\n\nВведите название склада",
        );
        return;
      }

      stateManager.setUserTempDataField(
        telegramId,
        "createWarehouseName",
        nameInput,
      );
      stateManager.setUserState(
        telegramId,
        AdminState.CREATE_WAREHOUSE_AWAITING_ADDRESS,
      );
      await bot.sendMessage(chatId, "Введите адрес склада");
      return;
    }

    if (currentState === AdminState.CREATE_WAREHOUSE_AWAITING_ADDRESS) {
      const addressInput = text.trim();
      if (addressInput.length < 2) {
        await bot.sendMessage(
          chatId,
          "❌ Адрес должен содержать минимум 2 символа.\n\nВведите адрес склада",
        );
        return;
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
          AdminState.CREATE_WAREHOUSE_AWAITING_NAME,
        );
        await bot.sendMessage(
          chatId,
          "⚠️ Что-то пошло не так. Введите название склада",
        );
        return;
      }

      const warehouse = await warehouseService.createWarehouse(
        warehouseName,
        addressInput,
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
          adminPermissionsLevel,
        });
      }

      await bot.sendMessage(
        chatId,
        `✅ Успешно создан склад *${warehouse.name}* по адресу *${warehouse.address}*`,
        { parse_mode: "Markdown" },
      );
      return;
    }

    if (currentState === AdminState.EDIT_ADMINS_SELECTING) {
      const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
      const admins = tempData.editAdmins;

      if (!admins?.length) {
        restoreToAuthenticatedWithAdminContext(telegramId, tempData);
        await bot.sendMessage(
          chatId,
          "❌ Что-то пошло не так. Запустите /superadmin_edit_admins заново.",
        );
        return;
      }

      if (!/^\d+$/.test(text.trim())) {
        await bot.sendMessage(
          chatId,
          "❌ Введите корректный номер администратора из списка.",
        );
        return;
      }

      const index = parseInt(text.trim(), 10) - 1;
      if (index < 0 || index >= admins.length) {
        await bot.sendMessage(
          chatId,
          "❌ Администратор с таким номером не найден. Введите номер из списка.",
        );
        return;
      }

      const selectedAdmin = admins[index];
      stateManager.setUserState(
        telegramId,
        AdminState.EDIT_ADMIN_ACTION_SELECTING,
      );
      stateManager.setUserTempData(telegramId, {
        selectedEditAdminId: selectedAdmin.id,
      });

      await sendAdminActionsMessage(chatId, selectedAdmin);
      return;
    }

    if (currentState === AdminState.EDIT_ADMIN_ACTION_SELECTING) {
      await bot.sendMessage(
        chatId,
        "ℹ️ Выберите действие командой: /superadmin_edit_admin_status, /superadmin_edit_admin_delete или /superadmin_edit_admin_password.",
      );
      return;
    }

    if (currentState === AdminState.EDIT_WAREHOUSES_SELECTING) {
      const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
      const warehouses = tempData.editWarehouses;

      if (!warehouses?.length) {
        restoreToAuthenticatedWithAdminContext(telegramId, tempData);
        await bot.sendMessage(
          chatId,
          "❌ Что-то пошло не так. Запустите /superadmin_edit_warehouses заново.",
        );
        return;
      }

      if (!/^\d+$/.test(text.trim())) {
        await bot.sendMessage(
          chatId,
          "❌ Введите корректный номер склада из списка.",
        );
        return;
      }

      const index = parseInt(text.trim(), 10) - 1;
      if (index < 0 || index >= warehouses.length) {
        await bot.sendMessage(
          chatId,
          "❌ Склад с таким номером не найден. Введите номер из списка.",
        );
        return;
      }

      const selectedWarehouse = warehouses[index];
      stateManager.setUserState(
        telegramId,
        AdminState.EDIT_WAREHOUSE_ACTION_SELECTING,
      );
      stateManager.setUserTempData(telegramId, {
        selectedWarehouseId: selectedWarehouse.id,
      });

      await sendWarehouseActionsMessage(chatId, selectedWarehouse);
      return;
    }

    if (currentState === AdminState.EDIT_WAREHOUSE_ACTION_SELECTING) {
      await bot.sendMessage(
        chatId,
        "ℹ️ Выберите действие командой: /superadmin_edit_warehouse_name, /superadmin_edit_warehouse_address, /superadmin_edit_warehouse_status или /superadmin_edit_warehouse_delete.",
      );
      return;
    }

    if (currentState === AdminState.EDIT_WAREHOUSE_AWAITING_NAME) {
      const nameInput = text.trim();
      if (nameInput.length < 2) {
        await bot.sendMessage(
          chatId,
          "❌ Название должно содержать минимум 2 символа.\n\nВведите новое название склада",
        );
        return;
      }

      const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
      const selectedWarehouseId = tempData.selectedWarehouseId;
      if (!selectedWarehouseId) {
        const fallbackState =
          tempData.editReturnState || AdminState.AUTHENTICATED;
        stateManager.setUserState(telegramId, fallbackState);
        await bot.sendMessage(
          chatId,
          "❌ Команда недоступна без выбора склада через /superadmin_edit_warehouses.",
        );
        return;
      }

      const updated = await warehouseService.updateWarehouseName(
        selectedWarehouseId,
        nameInput,
      );
      if (!updated) {
        const fallbackState =
          tempData.editReturnState || AdminState.AUTHENTICATED;
        stateManager.setUserState(telegramId, fallbackState);
        await bot.sendMessage(
          chatId,
          "❌ Склад не найден. Запустите /superadmin_edit_warehouses заново.",
        );
        return;
      }

      stateManager.setUserState(
        telegramId,
        AdminState.EDIT_WAREHOUSE_ACTION_SELECTING,
      );
      await bot.sendMessage(
        chatId,
        `✅ Название склада изменено на <b>${escapeHtml(updated.name)}</b>`,
        {
          parse_mode: "HTML",
        },
      );
      await sendWarehouseActionsMessage(chatId, updated);
      return;
    }

    if (currentState === AdminState.EDIT_WAREHOUSE_AWAITING_ADDRESS) {
      const addressInput = text.trim();
      if (addressInput.length < 2) {
        await bot.sendMessage(
          chatId,
          "❌ Адрес должен содержать минимум 2 символа.\n\nВведите новый адрес склада",
        );
        return;
      }

      const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
      const selectedWarehouseId = tempData.selectedWarehouseId;
      if (!selectedWarehouseId) {
        const fallbackState =
          tempData.editReturnState || AdminState.AUTHENTICATED;
        stateManager.setUserState(telegramId, fallbackState);
        await bot.sendMessage(
          chatId,
          "❌ Команда недоступна без выбора склада через /superadmin_edit_warehouses.",
        );
        return;
      }

      const updated = await warehouseService.updateWarehouseAddress(
        selectedWarehouseId,
        addressInput,
      );
      if (!updated) {
        const fallbackState =
          tempData.editReturnState || AdminState.AUTHENTICATED;
        stateManager.setUserState(telegramId, fallbackState);
        await bot.sendMessage(
          chatId,
          "❌ Склад не найден. Запустите /superadmin_edit_warehouses заново.",
        );
        return;
      }

      stateManager.setUserState(
        telegramId,
        AdminState.EDIT_WAREHOUSE_ACTION_SELECTING,
      );
      await bot.sendMessage(
        chatId,
        `✅ Адрес склада изменен на <b>${escapeHtml(updated.address || "-")}</b>`,
        {
          parse_mode: "HTML",
        },
      );
      await sendWarehouseActionsMessage(chatId, updated);
      return;
    }

    if (currentState === AdminState.EDIT_WAREHOUSE_AWAITING_STATUS) {
      const status = parseWarehouseStatusInput(text);
      if (status === null) {
        await bot.sendMessage(
          chatId,
          "❌ Некорректный выбор статуса. Введите 1 (Активный) или 2 (Отключен).",
        );
        return;
      }

      const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
      const selectedWarehouseId = tempData.selectedWarehouseId;
      if (!selectedWarehouseId) {
        const fallbackState =
          tempData.editReturnState || AdminState.AUTHENTICATED;
        stateManager.setUserState(telegramId, fallbackState);
        await bot.sendMessage(
          chatId,
          "❌ Команда недоступна без выбора склада через /superadmin_edit_warehouses.",
        );
        return;
      }

      if (!status) {
        const hasActiveSessions =
          await warehouseService.hasActiveSessionsByWarehouseId(
            selectedWarehouseId,
          );
        if (hasActiveSessions) {
          await bot.sendMessage(
            chatId,
            "❌ Нельзя отключить склад: по нему есть активные сессии. Завершите сессии и повторите попытку.",
          );
          return;
        }
      }

      const updated = await warehouseService.updateWarehouseStatus(
        selectedWarehouseId,
        status,
      );
      if (!updated) {
        const fallbackState =
          tempData.editReturnState || AdminState.AUTHENTICATED;
        stateManager.setUserState(telegramId, fallbackState);
        await bot.sendMessage(
          chatId,
          "❌ Склад не найден. Запустите /superadmin_edit_warehouses заново.",
        );
        return;
      }

      stateManager.setUserState(
        telegramId,
        AdminState.EDIT_WAREHOUSE_ACTION_SELECTING,
      );
      await bot.sendMessage(
        chatId,
        `✅ Статус склада изменен на <b>${getWarehouseStatusText(updated.is_active)}</b>`,
        {
          parse_mode: "HTML",
        },
      );
      await sendWarehouseActionsMessage(chatId, updated);
      return;
    }

    if (currentState === AdminState.EDIT_WAREHOUSE_AWAITING_DELETE_CONFIRM) {
      const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
      const selectedWarehouseId = tempData.selectedWarehouseId;
      const fallbackState =
        tempData.editReturnState || AdminState.AUTHENTICATED;

      if (text.trim() !== "ДА") {
        await bot.sendMessage(
          chatId,
          "❌ Для удаления склада введите строго ДА.",
        );
        return;
      }

      if (!selectedWarehouseId) {
        stateManager.setUserState(telegramId, fallbackState);
        await bot.sendMessage(
          chatId,
          "❌ Команда недоступна без выбора склада через /superadmin_edit_warehouses.",
        );
        return;
      }

      const deleteResult =
        await warehouseService.deleteWarehouse(selectedWarehouseId);
      if (!deleteResult.success) {
        await bot.sendMessage(
          chatId,
          `❌ ${deleteResult.reason || "Не удалось удалить склад."}`,
        );
        return;
      }

      stateManager.setUserState(telegramId, fallbackState);
      stateManager.resetUserTempData(telegramId);
      if (tempData.adminId && tempData.adminPermissionsLevel) {
        stateManager.setUserTempData(telegramId, {
          adminId: tempData.adminId,
          adminPermissionsLevel: tempData.adminPermissionsLevel,
        });
      }

      await bot.sendMessage(chatId, "✅ Склад успешно удален.");
      return;
    }

    if (currentState === AdminState.EDIT_ADMIN_AWAITING_STATUS) {
      const status = parseAdminStatusInput(text);
      if (status === null) {
        await bot.sendMessage(
          chatId,
          "❌ Некорректный выбор статуса. Введите 1 (Активный) или 2 (Отключен).",
        );
        return;
      }

      const resolved = await tryResolveSelectedAdmin(telegramId, chatId);
      if (!resolved) {
        return;
      }

      const changeResult = await adminService.changeAdminActiveStatus(
        resolved.admin.id,
        status,
      );
      if (!changeResult.success) {
        await bot.sendMessage(
          chatId,
          `❌ ${changeResult.reason || "Не удалось изменить статус администратора."}`,
        );
        return;
      }

      const updatedAdmin = await adminService.getAdminById(resolved.admin.id);
      if (!updatedAdmin || updatedAdmin.permissionsLevel >= 2) {
        await bot.sendMessage(
          chatId,
          "❌ Администратор не найден. Запустите /superadmin_edit_admins заново.",
        );
        return;
      }

      const updatedAdminForSession: EditableAdminSessionItem = {
        id: updatedAdmin.id,
        nickname: updatedAdmin.nickname,
        isActive: updatedAdmin.isActive,
      };

      const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
      const updatedList = (tempData.editAdmins || []).map((admin) =>
        admin.id === updatedAdminForSession.id ? updatedAdminForSession : admin,
      );

      stateManager.setUserState(
        telegramId,
        AdminState.EDIT_ADMIN_ACTION_SELECTING,
      );
      stateManager.setUserTempData(telegramId, {
        editAdmins: updatedList,
      });

      await bot.sendMessage(
        chatId,
        `✅ Статус администратора изменен на <b>${getAdminStatusText(updatedAdminForSession.isActive)}</b>`,
        { parse_mode: "HTML" },
      );
      await sendAdminActionsMessage(chatId, updatedAdminForSession);
      return;
    }

    if (currentState === AdminState.EDIT_ADMIN_AWAITING_DELETE_CONFIRM) {
      if (text.trim() !== "ДА") {
        await bot.sendMessage(
          chatId,
          "❌ Для удаления администратора введите строго ДА.",
        );
        return;
      }

      const resolved = await tryResolveSelectedAdmin(telegramId, chatId);
      if (!resolved) {
        return;
      }

      const deleteResult = await adminService.deleteAdmin(resolved.admin.id);
      if (!deleteResult.success) {
        await bot.sendMessage(
          chatId,
          `❌ ${deleteResult.reason || "Не удалось удалить администратора."}`,
        );
        return;
      }

      const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
      const editableAdmins = await loadEditableAdmins();
      if (!editableAdmins.length) {
        const fallbackState =
          tempData.editReturnState || AdminState.AUTHENTICATED;
        stateManager.setUserState(telegramId, fallbackState);
        stateManager.resetUserTempData(telegramId);
        if (tempData.adminId && tempData.adminPermissionsLevel) {
          stateManager.setUserTempData(telegramId, {
            adminId: tempData.adminId,
            adminPermissionsLevel: tempData.adminPermissionsLevel,
          });
        }

        await bot.sendMessage(
          chatId,
          "✅ Администратор успешно удален. Больше администраторов нет. Вы возвращены в предыдущее состояние.",
        );
        return;
      }

      stateManager.setUserState(telegramId, AdminState.EDIT_ADMINS_SELECTING);
      stateManager.setUserTempData(telegramId, {
        editAdmins: editableAdmins,
        selectedEditAdminId: undefined,
      });

      await bot.sendMessage(chatId, "✅ Администратор успешно удален.");
      await sendEditableAdminsListMessage(chatId, editableAdmins);
      return;
    }

    if (currentState === AdminState.EDIT_ADMIN_AWAITING_PASSWORD) {
      const passwordInput = text.trim();
      const passwordValidation = adminService.validatePassword(passwordInput);
      if (!passwordValidation.isValid) {
        await bot.sendMessage(
          chatId,
          "❌ Пароль должен содержать минимум 6 символов.\n\nВведите новый пароль, не менее 6 символов",
        );
        return;
      }

      const resolved = await tryResolveSelectedAdmin(telegramId, chatId);
      if (!resolved) {
        return;
      }

      const result = await adminService.changePassword(
        resolved.admin.id,
        passwordInput,
      );
      if (!result.success) {
        await bot.sendMessage(
          chatId,
          `❌ ${result.reason || "Не удалось сменить пароль."}\n\nВведите новый пароль, не менее 6 символов`,
        );
        return;
      }

      stateManager.setUserState(
        telegramId,
        AdminState.EDIT_ADMIN_ACTION_SELECTING,
      );
      await bot.sendMessage(chatId, "✅ Пароль администратора успешно изменен.");
      await sendAdminActionsMessage(chatId, resolved.admin);
      return;
    }

    if (currentState === AdminState.ADD_SIM_AWAITING_NUMBER) {
      const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
      const adminId = tempData.adminId;
      const adminPermissionsLevel = tempData.adminPermissionsLevel;
      const addSimWarehouseId = tempData.addSimWarehouseId;

      if (!adminId || !adminPermissionsLevel || !addSimWarehouseId) {
        stateManager.setUserState(
          telegramId,
          AdminState.AUTHENTICATED_WITH_WAREHOUSE,
        );
        stateManager.resetUserTempData(telegramId);
        if (adminId && adminPermissionsLevel) {
          stateManager.setUserTempData(telegramId, {
            adminId,
            adminPermissionsLevel,
          });
        }
        await bot.sendMessage(
          chatId,
          "⚠️ Не удалось определить контекст. Выполните /admin_add_sim повторно.",
        );
        return;
      }

      const deviceNumber = text.trim().toUpperCase();
      if (!validateSimNumber(deviceNumber)) {
        await bot.sendMessage(
          chatId,
          "❌ Некорректный номер СИМ. Формат: 3 буквы (латинские или кириллица) и 3 цифры в произвольном порядке (например, АА000А).\n\nВведите номер СИМ",
        );
        return;
      }

      const existing =
        await mobilityDeviceRepository.findByDeviceNumber(deviceNumber);
      if (existing) {
        await bot.sendMessage(
          chatId,
          "❌ СИМ с таким номером уже существует. Введите другой номер СИМ",
        );
        return;
      }

      await mobilityDeviceRepository.createDevice(deviceNumber, addSimWarehouseId);

      stateManager.setUserState(
        telegramId,
        AdminState.AUTHENTICATED_WITH_WAREHOUSE,
      );
      stateManager.resetUserTempData(telegramId);
      stateManager.setUserTempData(telegramId, {
        adminId,
        adminPermissionsLevel,
      });

      await bot.sendMessage(
        chatId,
        `✅ СИМ <b>${escapeHtml(deviceNumber)}</b> успешно добавлен.`,
        { parse_mode: "HTML" },
      );
      await bot.sendMessage(
        chatId,
        getAuthenticatedAdminWelcomeMessage(adminPermissionsLevel, true),
      );
      return;
    }

    const passwordValidation = adminService.validatePassword(text);
    if (!passwordValidation.isValid) {
      await bot.sendMessage(
        chatId,
        "Пароль не соответствует требованиям.\nПридумайте и введите пароль. Требования - не менее 6 символов.",
      );
      return;
    }

    const tempData = stateManager.getUserTempData<{
      adminRegisterLogin?: string;
    }>(telegramId);
    const adminRegisterLogin = tempData?.adminRegisterLogin;

    if (!adminRegisterLogin) {
      await startAdminRegistrationFlow(chatId, telegramId);
      return;
    }

    const registrationResult = await adminService.registerPendingAdmin(
      adminRegisterLogin,
      text,
    );
    if (!registrationResult.success) {
      if (registrationResult.duplicateInsensitive) {
        await bot.sendMessage(
          chatId,
          "Логин уже занят (без учета регистра). Выберите другой.\n\nПридумайте и введите логин",
        );
        stateManager.setUserState(
          telegramId,
          AdminState.REGISTER_AWAITING_LOGIN,
        );
        stateManager.resetUserTempData(telegramId);
        return;
      }

      await bot.sendMessage(
        chatId,
        "❌ Не удалось зарегистрировать администратора. Попробуйте позже.",
      );
      return;
    }

    stateManager.setUserState(telegramId, AdminState.GUEST_MODE);
    stateManager.resetUserTempData(telegramId);

    await bot.sendMessage(
      chatId,
      "✅ Заявка администратора создана. Ожидайте одобрения суперадминистратором.\n\n🛡 Вы по-прежнему в админском режиме. Доступны: /admin_login, /admin_register, /admin_logout, /exit_admin.",
    );
  });
}
