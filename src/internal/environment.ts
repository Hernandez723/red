/**
 * Environment detection helper.
 * Determines whether the app is running in a desktop Tauri container or a standard web browser.
 */

// Native Tauri sets window.__TAURI_IPC__ or native flags in window.__TAURI_INTERNALS__
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    __TAURI_IPC__?: unknown;
    __TAURI_POST_MESSAGE__?: unknown;
    __TAURI_INTERNALS__?: { __IS_NATIVE_TAURI__?: boolean };
  };
  return Boolean(w.__TAURI_IPC__ || w.__TAURI_POST_MESSAGE__ || w.__TAURI_INTERNALS__?.__IS_NATIVE_TAURI__);
}

export function isWeb(): boolean {
  return !isTauri();
}

/**
 * Initializes safe polyfills and mocks for web runtime so unhandled Tauri IPC calls
 * fail gracefully with a safe resolution rather than throwing synchronous TypeErrors.
 */
export function initWebPolyfills(): void {
  if (typeof window === "undefined") return;

  const w = window as unknown as Record<string, unknown>;

  // Only polyfill if native Tauri internals do not exist
  if (!w.__TAURI_INTERNALS__) {
    w.__TAURI_INTERNALS__ = {
      __IS_NATIVE_TAURI__: false,
      invoke: async (_cmd?: string, _args?: unknown): Promise<unknown> => {
        // Return null for unhandled desktop commands in web mode
        return null;
      },
      metadata: {
        currentWindow: { label: "main" },
        currentWebview: { label: "main" },
      },
      plugins: {},
    };
  }
}
