import { useCallback, useEffect, useRef, useState } from "react";
import { backendLog, idleSeconds, notify } from "./bridge";
import { CHARACTERS, DEFAULT_CHARACTER } from "../rig/characters";

/**
 * The single owner of every timer in the app. It knows nothing about animation — the
 * engine owns that — it only decides *when* something is due and tells the caller.
 *
 * Two rules keep this free of the bugs the original version had:
 *
 *  1. **One interval, created once.** The `useEffect` below has an empty dependency
 *     array, so the 1 Hz tick is never torn down and rebuilt. The original listed
 *     `active, focusRunning, quiet, waterEvery, eyeEvery, paused`, so almost any state
 *     change destroyed and recreated the interval and silently restarted the countdown.
 *  2. **Timestamps, not countdowns.** Each reminder stores *when it is next due* (epoch
 *     ms). Nothing is decremented, so a delayed tick cannot drift and "reset the
 *     interval" is just a new timestamp.
 *
 * All mutable state lives in refs that the tick reads, so there are no stale closures.
 */

export type ReminderKind = "water" | "eyes";

export interface Settings {
  waterMin: number;
  eyeMin: number;
  focusMin: number;
  quiet: boolean;
  /** Which character the rig draws; see src/rig/characters.ts. */
  character: string;
}

/** Dev harness only: short intervals so a full reminder cycle can be observed. */
const FAST = Boolean(import.meta.env.VITE_HANA_SELFTEST);

export const DEFAULT_SETTINGS: Settings = {
  waterMin: FAST ? 1 : 30,
  eyeMin: FAST ? 2 : 20,
  focusMin: 50,
  quiet: false,
  character: DEFAULT_CHARACTER,
};

/** Seconds of no input before the Mac counts as idle. */
const IDLE_THRESHOLD_S = 60;
/** "Remind me later" snooze. */
const SNOOZE_MS = 5 * 60 * 1000;

export const MESSAGES: Record<ReminderKind, { bubble: string; title: string; body: string }> = {
  water: {
    bubble: "Time for water 💧",
    title: "Water break 💧",
    body: "Time to drink some water.",
  },
  eyes: {
    bubble: "Look ~6 m away, 20 s 👀",
    title: "Eye rest 👀",
    body: "Look about 6 metres (20 feet) away for 20 seconds.",
  },
};

const minutesToMs = (m: number) => m * 60 * 1000;

/** Where settings are kept between launches (WKWebView persists this to disk). */
const STORE_KEY = "hana.settings.v1";

/**
 * Settings survive a restart, so the chosen character and intervals are not lost.
 * Reads are defensive: a corrupt or partial value falls back to the defaults rather
 * than leaving the app unusable, and private-mode storage failures are ignored.
 */
function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const saved = JSON.parse(raw) as Partial<Settings>;
    const minWater = FAST ? 1 : 10;
    const minEye = FAST ? 1 : 5;
    return {
      waterMin:
        typeof saved.waterMin === "number" && saved.waterMin >= minWater
          ? saved.waterMin
          : DEFAULT_SETTINGS.waterMin,
      eyeMin:
        typeof saved.eyeMin === "number" && saved.eyeMin >= minEye
          ? saved.eyeMin
          : DEFAULT_SETTINGS.eyeMin,
      focusMin:
        typeof saved.focusMin === "number" && saved.focusMin >= 10
          ? saved.focusMin
          : DEFAULT_SETTINGS.focusMin,
      quiet: typeof saved.quiet === "boolean" ? saved.quiet : DEFAULT_SETTINGS.quiet,
      // Only a character that still exists counts as a valid saved selection; an id
      // from a removed character falls back to the default rather than leaving the
      // picker blank.
      character:
        typeof saved.character === "string" &&
        CHARACTERS.some((c) => c.id === saved.character)
          ? saved.character
          : DEFAULT_SETTINGS.character,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable; settings simply will not persist */
  }
}

export interface CompanionHooks {
  /** A reminder came due. */
  onFire?: (kind: ReminderKind, bubble: string) => void;
  /** The Mac went idle / came back. */
  onIdleChange?: (idle: boolean) => void;
  /** A manually started focus session began or ended. */
  onFocusChange?: (running: boolean) => void;
  /** A focus session reached its end. */
  onFocusComplete?: () => void;
}

export function useCompanion(hooks: CompanionHooks = {}) {
  // Lazy initialiser: read from storage once, not on every render.
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [active, setActive] = useState<ReminderKind | null>(null);
  const [paused, setPaused] = useState(false);
  const [waterLeft, setWaterLeft] = useState(() => loadSettings().waterMin * 60);
  const [eyeLeft, setEyeLeft] = useState(() => loadSettings().eyeMin * 60);
  const [focusLeft, setFocusLeft] = useState(0);
  const [focusRunning, setFocusRunning] = useState(false);

  // --- refs the tick reads (never stale) -----------------------------------
  const settingsRef = useRef(settings);
  const hooksRef = useRef(hooks);
  hooksRef.current = hooks;

  const dueRef = useRef<Record<ReminderKind, number>>({
    water: Date.now() + minutesToMs(settings.waterMin),
    eyes: Date.now() + minutesToMs(settings.eyeMin),
  });
  const activeRef = useRef<ReminderKind | null>(null);
  const pausedRef = useRef(false);
  const focusRef = useRef<{ running: boolean; endsAt: number }>({ running: false, endsAt: 0 });

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const resetDue = useCallback((kind: ReminderKind, from = Date.now()) => {
    const mins = kind === "water" ? settingsRef.current.waterMin : settingsRef.current.eyeMin;
    dueRef.current[kind] = from + minutesToMs(mins);
  }, []);

  const fire = useCallback((kind: ReminderKind) => {
    if (FAST) void backendLog(`DIAG fire() kind=${kind}`);
    activeRef.current = kind;
    setActive(kind);
    hooksRef.current.onFire?.(kind, MESSAGES[kind].bubble);
    if (!settingsRef.current.quiet) {
      void notify(MESSAGES[kind].title, MESSAGES[kind].body);
    }
  }, []);

  /** Done: dismiss and reset this reminder's interval. */
  const done = useCallback(() => {
    if (FAST) void backendLog("DIAG done()");
    const kind = activeRef.current;
    if (!kind) return null;
    activeRef.current = null;
    setActive(null);
    resetDue(kind);
    return kind;
  }, [resetDue]);

  /** Remind me later: dismiss and make it due again in exactly five minutes. */
  const remindLater = useCallback(() => {
    if (FAST) void backendLog("DIAG remindLater()");
    const kind = activeRef.current;
    if (!kind) return null;
    activeRef.current = null;
    setActive(null);
    dueRef.current[kind] = Date.now() + SNOOZE_MS;
    return kind;
  }, []);

  const startFocus = useCallback(() => {
    const ms = minutesToMs(settingsRef.current.focusMin);
    focusRef.current = { running: true, endsAt: Date.now() + ms };
    setFocusRunning(true);
    setFocusLeft(Math.round(ms / 1000));
    hooksRef.current.onFocusChange?.(true);
  }, []);

  const stopFocus = useCallback(() => {
    focusRef.current = { running: false, endsAt: 0 };
    setFocusRunning(false);
    setFocusLeft(0);
    hooksRef.current.onFocusChange?.(false);
  }, []);

  // --- the one and only interval -------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      // The self-test harness must not be stopped by idle pause: nobody is touching the
      // keyboard while it runs.
      const idle = FAST ? 0 : await idleSeconds();
      if (cancelled) return;

      const now = Date.now();
      const cfg = settingsRef.current;
      const wasPaused = pausedRef.current;
      const isIdle = idle >= IDLE_THRESHOLD_S;

      if (isIdle !== wasPaused) {
        pausedRef.current = isIdle;
        setPaused(isIdle);
        hooksRef.current.onIdleChange?.(isIdle);
      }

      // While idle - or in quiet mode - push the due timestamps along so nothing goes
      // overdue and fires in a burst the moment the user comes back.
      if (pausedRef.current || cfg.quiet) {
        dueRef.current.water += 1000;
        dueRef.current.eyes += 1000;
      }

      setWaterLeft(Math.max(0, Math.round((dueRef.current.water - now) / 1000)));
      setEyeLeft(Math.max(0, Math.round((dueRef.current.eyes - now) / 1000)));

      if (focusRef.current.running) {
        const left = Math.max(0, Math.round((focusRef.current.endsAt - now) / 1000));
        setFocusLeft(left);
        if (left === 0) {
          // Completion never restarts the session.
          focusRef.current = { running: false, endsAt: 0 };
          setFocusRunning(false);
          hooksRef.current.onFocusChange?.(false);
          hooksRef.current.onFocusComplete?.();
          if (!cfg.quiet) {
            void notify("Focus complete", "You finished your focus session.");
          }
        }
      }

      // One reminder at a time; never while paused or in quiet mode.
      if (FAST) {
        void backendLog(
          `DIAG tick active=${activeRef.current ?? "null"} paused=${pausedRef.current} ` +
            `waterDueIn=${Math.round((dueRef.current.water - now) / 1000)}`,
        );
      }
      if (!activeRef.current && !pausedRef.current && !cfg.quiet) {
        if (now >= dueRef.current.water) fire("water");
        else if (now >= dueRef.current.eyes) fire("eyes");
      }
    };

    const id = window.setInterval(() => void tick(), 1000);
    void tick();

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // Intentionally empty: this interval is created once for the app's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fire, resetDue]);

  /** Changing an interval in Settings re-bases that reminder from now. */
  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      settingsRef.current = next;
      saveSettings(next);
      const now = Date.now();
      if (patch.waterMin !== undefined && patch.waterMin !== prev.waterMin) {
        dueRef.current.water = now + minutesToMs(patch.waterMin);
      }
      if (patch.eyeMin !== undefined && patch.eyeMin !== prev.eyeMin) {
        dueRef.current.eyes = now + minutesToMs(patch.eyeMin);
      }
      return next;
    });
  }, []);

  return {
    settings,
    updateSettings,
    active,
    paused,
    waterLeft,
    eyeLeft,
    focusLeft,
    focusRunning,
    done,
    remindLater,
    startFocus,
    stopFocus,
  };
}

export const formatClock = (seconds: number) => {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
};
