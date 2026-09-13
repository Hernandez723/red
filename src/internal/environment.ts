/**
 * Environment detection helper.
 * Determines whether the app is running in a desktop Tauri container or a standard web browser.
 */

export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ ||
    (window as unknown as { __TAURI__?: unknown }).__TAURI__,
  );
}

export function isWeb(): boolean {
  return !isTauri();
}
