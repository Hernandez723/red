/**
 * React hook that binds Samsung Tizen TV remote media controls to active audio playback.
 */

import { useEffect } from "react";
import { playerController } from "../player/playerStore";
import { TIZEN_KEY_CODES } from "./tizenKeys";

export function useTizenRemote(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleMediaKeys = (event: KeyboardEvent) => {
      const keyCode = event.keyCode || event.which;

      switch (keyCode) {
        case TIZEN_KEY_CODES.MEDIA_PLAY_PAUSE:
          playerController.togglePlayPause();
          event.preventDefault();
          break;

        case TIZEN_KEY_CODES.MEDIA_PLAY:
          playerController.play();
          event.preventDefault();
          break;

        case TIZEN_KEY_CODES.MEDIA_PAUSE:
          playerController.pause();
          event.preventDefault();
          break;

        case TIZEN_KEY_CODES.MEDIA_STOP:
          playerController.pause();
          event.preventDefault();
          break;

        case TIZEN_KEY_CODES.MEDIA_TRACK_NEXT:
          playerController.skipToNext();
          event.preventDefault();
          break;

        case TIZEN_KEY_CODES.MEDIA_TRACK_PREVIOUS:
          playerController.skipToPrevious();
          event.preventDefault();
          break;

        case TIZEN_KEY_CODES.MEDIA_FAST_FORWARD: {
          const currentPos = playerController.getCurrentTime();
          playerController.seekTo(currentPos + 10);
          event.preventDefault();
          break;
        }

        case TIZEN_KEY_CODES.MEDIA_REWIND: {
          const currentPos = playerController.getCurrentTime();
          playerController.seekTo(Math.max(0, currentPos - 10));
          event.preventDefault();
          break;
        }

        default:
          break;
      }
    };

    window.addEventListener("keydown", handleMediaKeys, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleMediaKeys, { capture: true });
    };
  }, []);
}
