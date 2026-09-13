import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./environment";
import { clearArtworkCache } from "./artworkCache";
import { logInternalWarn } from "./logging";

export const DEFAULT_CACHE_SIZE_GB = 4;

export interface CacheStats {
  maxBytes: number;
  usedBytes: number;
  entryCount: number;
}

interface CacheWriteResult {
  changed: boolean;
}

// In-memory cache map for web mode
const webMemoryCache = new Map<string, string>();
let webMaxBytes = DEFAULT_CACHE_SIZE_GB * 1024 * 1024 * 1024;

export async function getCachedJson<T>(key: string): Promise<T | null> {
  if (!isTauri()) {
    const value = webMemoryCache.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  try {
    const value = await invoke<string | null>("cache_get", { key });
    return value === null ? null : JSON.parse(value) as T;
  } catch (error) {
    logInternalWarn("cache.get failed", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function setCachedJson<T>(key: string, value: T): Promise<boolean> {
  if (!isTauri()) {
    try {
      const str = JSON.stringify(value);
      const changed = webMemoryCache.get(key) !== str;
      webMemoryCache.set(key, str);
      return changed;
    } catch {
      return false;
    }
  }

  try {
    const result = await invoke<CacheWriteResult>("cache_set", {
      key,
      value: JSON.stringify(value),
    });
    return result.changed;
  } catch (error) {
    logInternalWarn("cache.set failed", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export function getCacheStats(): Promise<CacheStats> {
  if (!isTauri()) {
    let usedBytes = 0;
    for (const [, val] of webMemoryCache.entries()) {
      usedBytes += val.length * 2;
    }
    return Promise.resolve({
      maxBytes: webMaxBytes,
      usedBytes,
      entryCount: webMemoryCache.size,
    });
  }
  return invoke<CacheStats>("cache_stats");
}

export function setCacheMaxBytes(maxBytes: number): Promise<CacheStats> {
  if (!isTauri()) {
    webMaxBytes = maxBytes;
    return getCacheStats();
  }
  return invoke<CacheStats>("cache_set_max_bytes", { maxBytes });
}

export function clearCache(): Promise<CacheStats> {
  clearArtworkCache();
  if (!isTauri()) {
    webMemoryCache.clear();
    return getCacheStats();
  }
  return invoke<CacheStats>("cache_clear");
}

