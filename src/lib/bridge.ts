import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

/** Window sizes, in logical pixels, for each panel configuration. */
export const WINDOW_SIZES = {
  /** Parked: a few transparent pixels in the corner. See CompanionEngine.setDormant. */
  dormant: { width: 4, height: 4 },
  bare: { width: 260, height: 320 },
  controls: { width: 260, height: 460 },
  settings: { width: 260, height: 620 },
} as const;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Swallows errors so the UI still works when run in a plain browser (vite dev). */
async function tryInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    return await invoke<T>(cmd, args);
  } catch {
    return null;
  }
}

export async function idleSeconds(): Promise<number> {
  return (await tryInvoke<number>("idle_seconds")) ?? 0;
}

/** Hides the real native window. The menu-bar item is the way back. */
export async function hideCompanion(): Promise<void> {
  await tryInvoke("hide_companion");
}

export async function setCompanionSize(width: number, height: number): Promise<void> {
  await tryInvoke("set_companion_size", { width, height });
}

/** Moves the whole native window — this is how she walks across the desktop. */
export async function moveCompanion(x: number, y: number): Promise<void> {
  await tryInvoke("move_companion", { x, y });
}

/** Screen area minus menu bar and Dock, in logical top-left coordinates. */
export async function workArea(): Promise<Rect | null> {
  return await tryInvoke<Rect>("work_area");
}

/** Where the character is inside the window, so clicks miss the transparent margins. */
export async function setHitRect(
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<void> {
  await tryInvoke("set_hit_rect", { x, y, width, height });
}

/**
 * Let the window take keyboard focus. Needed while a panel is open so native <select>
 * popups can open; off the rest of the time so Hana never steals focus.
 */
export async function setWindowInteractive(interactive: boolean): Promise<void> {
  await tryInvoke("set_window_interactive", { interactive });
}

/** Force the window to keep accepting mouse events (used while dragging). */
export async function setInteractive(interactive: boolean): Promise<void> {
  await tryInvoke("set_interactive", { interactive });
}

/** Writes a line into the Tauri log; used to trace state transitions. */
export async function backendLog(msg: string): Promise<void> {
  await tryInvoke("hana_log", { msg });
}

export async function notify(title: string, body: string): Promise<void> {
  try {
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === "granted";
    if (granted) sendNotification({ title, body });
  } catch {
    /* notifications unavailable */
  }
}
