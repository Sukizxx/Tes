import type { ModelId } from "../types";
import { DEFAULT_MODEL } from "../providers/models";

export interface Settings {
  defaultModel: ModelId;
  /** Heavy 3D / motion effects toggle (also respects prefers-reduced-motion). */
  animations: boolean;
  /** Show the opening orb on load. */
  showOpening: boolean;
  /** Theme — monochrome dark is the product identity; reserved for future. */
  theme: "dark";
}

const KEY = "neiroai.settings.v1";

export const DEFAULT_SETTINGS: Settings = {
  defaultModel: DEFAULT_MODEL,
  animations: true,
  showOpening: true,
  theme: "dark",
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function loadSettings(): Settings {
  if (!isBrowser()) return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Whether heavy motion should run (setting AND OS preference). */
export function motionEnabled(s: Settings): boolean {
  if (!s.animations) return false;
  if (isBrowser() && window.matchMedia) {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return true;
}
