/**
 * Spatial Navigation engine for Samsung Tizen TV (D-Pad navigation).
 * Enables seamless 4-direction (Up, Down, Left, Right) remote navigation across UI elements.
 */

import { TIZEN_KEY_CODES } from "./tizenKeys";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]:not([aria-disabled="true"])',
  '[role="tab"]',
  '[role="menuitem"]',
  ".focusable",
].join(", ");

type Direction = "up" | "down" | "left" | "right";

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

function getRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return {
    left: r.left,
    top: r.top,
    right: r.right,
    bottom: r.bottom,
    width: r.width,
    height: r.height,
    centerX: r.left + r.width / 2,
    centerY: r.top + r.height / 2,
  };
}

function isElementVisible(el: HTMLElement): boolean {
  if (el.offsetParent === null && el.offsetWidth === 0 && el.offsetHeight === 0) {
    return false;
  }
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getAllFocusableElements(): HTMLElement[] {
  const elements = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return elements.filter((el) => {
    if (el.getAttribute("data-sn-ignore") === "true") return false;
    return isElementVisible(el);
  });
}

/**
 * Calculates distance penalty between current rect and target rect in given direction.
 */
function calculateDistance(cur: Rect, target: Rect, dir: Direction): number | null {
  let primaryDist = 0;
  let secondaryDist = 0;

  switch (dir) {
    case "left":
      if (target.centerX >= cur.centerX - 2) return null;
      primaryDist = cur.left - target.right;
      secondaryDist = Math.abs(cur.centerY - target.centerY);
      break;
    case "right":
      if (target.centerX <= cur.centerX + 2) return null;
      primaryDist = target.left - cur.right;
      secondaryDist = Math.abs(cur.centerY - target.centerY);
      break;
    case "up":
      if (target.centerY >= cur.centerY - 2) return null;
      primaryDist = cur.top - target.bottom;
      secondaryDist = Math.abs(cur.centerX - target.centerX);
      break;
    case "down":
      if (target.centerY <= cur.centerY + 2) return null;
      primaryDist = target.top - cur.bottom;
      secondaryDist = Math.abs(cur.centerX - target.centerX);
      break;
  }

  // Weight primary direction vs secondary perpendicular offset
  return Math.max(0, primaryDist) * 1.0 + secondaryDist * 2.2;
}

/**
 * Moves focus to the best candidate in the given direction.
 */
export function navigateSpatial(direction: Direction): boolean {
  const focusables = getAllFocusableElements();
  if (focusables.length === 0) return false;

  let current = document.activeElement as HTMLElement | null;
  if (!current || current === document.body || !focusables.includes(current)) {
    // If nothing currently focused, focus the first visible or priority element
    const priority = focusables.find((el) => el.getAttribute("data-sn-priority") === "true") || focusables[0];
    if (priority) {
      focusElement(priority);
      return true;
    }
    return false;
  }

  const currentRect = getRect(current);
  let bestCandidate: HTMLElement | null = null;
  let minDistance = Infinity;

  for (const candidate of focusables) {
    if (candidate === current) continue;
    const targetRect = getRect(candidate);
    const dist = calculateDistance(currentRect, targetRect, direction);
    if (dist !== null && dist < minDistance) {
      minDistance = dist;
      bestCandidate = candidate;
    }
  }

  if (bestCandidate) {
    focusElement(bestCandidate);
    return true;
  }

  return false;
}

/**
 * Focuses an element, sets visual class, and scrolls it safely into view.
 */
export function focusElement(el: HTMLElement): void {
  // Remove focus class from previous elements
  document.querySelectorAll(".tizen-focused").forEach((node) => {
    node.classList.remove("tizen-focused");
  });

  el.focus();
  el.classList.add("tizen-focused");

  try {
    el.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  } catch {
    // Ignore scroll errors in older TV web engines
  }
}

/**
 * Initializes Spatial Navigation global keyboard listener for D-Pad on Samsung Tizen TV.
 */
export function initSpatialNavigation(): () => void {
  if (typeof window === "undefined") return () => {};

  const handleKeyDown = (event: KeyboardEvent) => {
    const keyCode = event.keyCode || event.which;

    let dir: Direction | null = null;
    switch (keyCode) {
      case TIZEN_KEY_CODES.LEFT:
      case 37:
        dir = "left";
        break;
      case TIZEN_KEY_CODES.UP:
      case 38:
        dir = "up";
        break;
      case TIZEN_KEY_CODES.RIGHT:
      case 39:
        dir = "right";
        break;
      case TIZEN_KEY_CODES.DOWN:
      case 40:
        dir = "down";
        break;
      case TIZEN_KEY_CODES.ENTER:
      case 13: {
        const active = document.activeElement as HTMLElement | null;
        if (active && active !== document.body) {
          // If input is focused, let it handle Enter normally
          if (active.tagName === "INPUT" || active.tagName === "TEXTAREA") {
            return;
          }
          active.click();
          event.preventDefault();
        }
        return;
      }
    }

    if (dir) {
      const handled = navigateSpatial(dir);
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
  };

  window.addEventListener("keydown", handleKeyDown, { capture: true });

  return () => {
    window.removeEventListener("keydown", handleKeyDown, { capture: true });
  };
}
