import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./environment";
import { logInternalWarn } from "./logging";

const SETTING_PREFIX = "zuno_setting:";

function getInvokeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;

    try {
      return JSON.stringify(error);
    } catch {
      return Object.prototype.toString.call(error);
    }
  }
  return String(error);
}

export async function getAppSetting<T>(key: string): Promise<T | null> {
  if (!isTauri()) {
    try {
      const raw = localStorage.getItem(SETTING_PREFIX + key);
      return raw !== null ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  try {
    return await invoke<T | null>("app_setting_get", { key });
  } catch (error) {
    logInternalWarn("appSetting.get failed", {
      key,
      error: getInvokeErrorMessage(error),
    });
    return null;
  }
}

export async function setAppSetting<T>(key: string, value: T): Promise<void> {
  if (!isTauri()) {
    try {
      localStorage.setItem(SETTING_PREFIX + key, JSON.stringify(value));
    } catch (error) {
      logInternalWarn("appSetting.set localStorage failed", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  try {
    await invoke("app_setting_set", { key, value });
  } catch (error) {
    logInternalWarn("appSetting.set failed", {
      key,
      error: getInvokeErrorMessage(error),
    });
  }
}

export async function removeAppSetting(key: string): Promise<void> {
  if (!isTauri()) {
    try {
      localStorage.removeItem(SETTING_PREFIX + key);
    } catch {}
    return;
  }

  try {
    await invoke("app_setting_remove", { key });
  } catch (error) {
    logInternalWarn("appSetting.remove failed", {
      key,
      error: getInvokeErrorMessage(error),
    });
  }
}

export async function clearAppSettings(): Promise<void> {
  if (!isTauri()) {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(SETTING_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (error) {
      logInternalWarn("appSettings.clear localStorage failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  try {
    await invoke("app_settings_clear");
  } catch (error) {
    logInternalWarn("appSettings.clear failed", {
      error: getInvokeErrorMessage(error),
    });
    throw error;
  }
}

