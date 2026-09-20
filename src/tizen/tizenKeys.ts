/**
 * Samsung Tizen TV Remote Control Key Handler and KeyCode definitions.
 */

import { logInternalInfo, logInternalWarn } from "../internal/logging";

export const TIZEN_KEY_CODES = {
  // Navigation
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  ENTER: 13,
  RETURN: 10009, // Tizen TV hardware Back/Return key

  // Media Playback
  MEDIA_PLAY: 415,
  MEDIA_PAUSE: 19,
  MEDIA_PLAY_PAUSE: 10252,
  MEDIA_STOP: 413,
  MEDIA_FAST_FORWARD: 417,
  MEDIA_REWIND: 412,
  MEDIA_TRACK_PREVIOUS: 10232,
  MEDIA_TRACK_NEXT: 10233,

  // Volume & Channel
  VOLUME_UP: 447,
  VOLUME_DOWN: 448,
  VOLUME_MUTE: 449,
  CHANNEL_UP: 427,
  CHANNEL_DOWN: 428,

  // Color keys
  RED: 403,
  GREEN: 404,
  YELLOW: 405,
  BLUE: 406,

  // Numbers
  NUM_0: 48,
  NUM_1: 49,
  NUM_2: 50,
  NUM_3: 51,
  NUM_4: 52,
  NUM_5: 53,
  NUM_6: 54,
  NUM_7: 55,
  NUM_8: 56,
  NUM_9: 57,
} as const;

export type TizenKeyName =
  | "MediaPlay"
  | "MediaPause"
  | "MediaPlayPause"
  | "MediaStop"
  | "MediaFastForward"
  | "MediaRewind"
  | "MediaTrackPrevious"
  | "MediaTrackNext"
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "ColorF0Red"
  | "ColorF1Green"
  | "ColorF2Yellow"
  | "ColorF3Blue";

const KEYS_TO_REGISTER: TizenKeyName[] = [
  "MediaPlay",
  "MediaPause",
  "MediaPlayPause",
  "MediaStop",
  "MediaFastForward",
  "MediaRewind",
  "MediaTrackPrevious",
  "MediaTrackNext",
  "ColorF0Red",
  "ColorF1Green",
  "ColorF2Yellow",
  "ColorF3Blue",
];

type ReturnKeyCallback = () => boolean | void;
const returnKeyStack: ReturnKeyCallback[] = [];

/**
 * Register a callback to be called when the Tizen Return/Back button is pressed.
 * If the callback returns true, it handled the action and won't pop the default back action.
 * Returns an unregister cleanup function.
 */
export function registerReturnKeyHandler(callback: ReturnKeyCallback): () => void {
  returnKeyStack.push(callback);
  return () => {
    const index = returnKeyStack.indexOf(callback);
    if (index !== -1) {
      returnKeyStack.splice(index, 1);
    }
  };
}

/**
 * Exit the Tizen application cleanly.
 */
export function exitTizenApp(): void {
  try {
    const w = window as unknown as {
      tizen?: {
        application?: {
          getCurrentApplication: () => { exit: () => void };
        };
      };
    };
    if (w.tizen?.application?.getCurrentApplication) {
      w.tizen.application.getCurrentApplication().exit();
    }
  } catch (err) {
    logInternalWarn("Failed to exit Tizen application", { error: String(err) });
  }
}

/**
 * Initializes registration of TV hardware keys with Samsung Tizen TV OS.
 */
export function initTizenKeys(): void {
  if (typeof window === "undefined") return;

  const w = window as unknown as {
    tizen?: {
      tvinputdevice?: {
        registerKey: (keyName: string) => void;
      };
    };
  };

  if (w.tizen?.tvinputdevice?.registerKey) {
    for (const keyName of KEYS_TO_REGISTER) {
      try {
        w.tizen.tvinputdevice.registerKey(keyName);
      } catch (err) {
        logInternalWarn(`[Tizen] Could not register key ${keyName}`, { error: String(err) });
      }
    }
    logInternalInfo("[Tizen] Hardware TV keys registered successfully");
  }

  // Global Return / Back key listener
  window.addEventListener(
    "keydown",
    (event: KeyboardEvent) => {
      const keyCode = event.keyCode || event.which;
      if (keyCode === TIZEN_KEY_CODES.RETURN || event.key === "Escape" || event.key === "GoBack") {
        if (returnKeyStack.length > 0) {
          // Execute topmost handler
          const topHandler = returnKeyStack[returnKeyStack.length - 1];
          const handled = topHandler();
          if (handled !== false) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
        }

        // If nothing was in the stack or handled, check if browser history can go back
        if (window.history.length > 1) {
          window.history.back();
          event.preventDefault();
        } else {
          // Top-level back exits app
          exitTizenApp();
        }
      }
    },
    { capture: true },
  );
}
