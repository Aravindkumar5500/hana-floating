import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Companion } from "./components/Companion";
import { ControlsPanel } from "./components/ControlsPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { WINDOW_SIZES, backendLog, setCompanionSize, setWindowInteractive } from "./lib/bridge";
import { useCompanion } from "./lib/useCompanion";
import type { CompanionEngine, CompanionState } from "./rig/engine";

export default function App() {
  const engineRef = useRef<CompanionEngine | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bubble, setBubble] = useState("");
  /** She is parked and invisible unless a reminder fires or the user asks for her. */
  const [visible, setVisible] = useState(false);
  /** Opened from the menu bar: stay up until the user dismisses her. */
  const [pinned, setPinned] = useState(false);
  const [state, setState] = useState<CompanionState>("idle");

  // The timer owner. Every hook here just forwards to the animation engine, so the
  // reminder logic and the animation stay completely decoupled.
  const c = useCompanion({
    onFire: (kind, text) => engineRef.current?.triggerReminder(kind, text),
    onIdleChange: (idle) => engineRef.current?.setSleeping(idle),
    onFocusChange: (running) => engineRef.current?.setFocusSession(running),
    onFocusComplete: () => engineRef.current?.celebrateDone("Focus complete 🎉"),
  });

  const openSettings = useCallback(() => {
    setPinned(true);
    setVisible(true);
    setSettingsOpen(true);
    setControlsOpen(false);
  }, []);

  // The menu-bar "Settings…" item.
  useEffect(() => {
    const unlisten = listen("hana://open-settings", () => openSettings());
    return () => {
      void unlisten.then((f) => f());
    };
  }, [openSettings]);

  // Resize the native window as panels open and close, then put her feet back on the
  // Dock line (the character always lives at the bottom of the window, so panels appear
  // above her and the window grows upward).
  useEffect(() => {
    const size = !visible
      ? WINDOW_SIZES.dormant
      : settingsOpen
        ? WINDOW_SIZES.settings
        : controlsOpen
          ? WINDOW_SIZES.controls
          : WINDOW_SIZES.bare;
    const panelOpen = visible && (controlsOpen || settingsOpen);
    engineRef.current?.setDormant(!visible);
    engineRef.current?.setPanelOpen(panelOpen);
    // Only take keyboard focus while a panel is open, so native <select> popups work
    // without Hana stealing focus during normal use.
    void setWindowInteractive(panelOpen);
    void setCompanionSize(size.width, size.height).then(() => {
      // Pass the intended size: window.innerWidth has not caught up yet.
      engineRef.current?.snapToDock(size.width, size.height);
    });
  }, [controlsOpen, settingsOpen, visible]);

  // Quiet mode suppresses movement and bubbles in the engine itself.
  useEffect(() => {
    engineRef.current?.setQuiet(c.settings.quiet);
  }, [c.settings.quiet]);

  // Character selection drives the rig's artwork, hair chain and temperament.
  useEffect(() => {
    engineRef.current?.setCharacter(c.settings.character);
  }, [c.settings.character]);

  // A reminder brings up the controls so Done / Later are one click away.
  useEffect(() => {
    if (c.active && !c.settings.quiet) {
      setVisible(true);
      setControlsOpen(true);
      setSettingsOpen(false);
    }
  }, [c.active, c.settings.quiet]);

  /** Park her again once the reaction animation has played. */
  const dismiss = useCallback(() => {
    setControlsOpen(false);
    setSettingsOpen(false);
    if (pinned) return;
    window.setTimeout(() => setVisible(false), 2600);
  }, [pinned]);

  // Menu-bar actions.
  useEffect(() => {
    const subs = [
      listen("hana://show", () => {
        setPinned(true);
        setVisible(true);
      }),
      listen("hana://hide", () => {
        setPinned(false);
        setControlsOpen(false);
        setSettingsOpen(false);
        setVisible(false);
      }),
    ];
    return () => {
      subs.forEach((s) => void s.then((f) => f()));
    };
  }, []);

  const handleDone = useCallback(() => {
    const kind = c.done();
    if (!kind) return;
    engineRef.current?.celebrateDone(kind === "water" ? "Yay, thank you! ✨" : "Eyes feel better ✨");
    dismiss();
  }, [c.done, dismiss]);

  const handleLater = useCallback(() => {
    if (!c.remindLater()) return;
    engineRef.current?.acknowledgeSnooze("Okay, 5 more minutes 😴");
    dismiss();
  }, [c.remindLater, dismiss]);

  /** Clicking her: Done if she is reminding, otherwise a happy reaction. */
  const handlePoke = useCallback(() => {
    if (c.active) {
      handleDone();
      return;
    }
    engineRef.current?.pokeReaction("Hi! ♡");
    setControlsOpen((v) => !v);
    setSettingsOpen(false);
  }, [c.active, handleDone]);

  const toggleControls = useCallback(() => {
    setControlsOpen((v) => !v);
    setSettingsOpen(false);
  }, []);

  // Dev harness: drive one full reminder cycle (fire -> Done) and one snooze, logging
  // each step, so the reminder path can be verified in the running app.
  const selftestRun = useRef(0);
  const actionsRef = useRef({ handleDone, handleLater });
  actionsRef.current = { handleDone, handleLater };
  useEffect(() => {
    if (!import.meta.env.VITE_HANA_SELFTEST || !c.active) return;
    const which = selftestRun.current++;
    void backendLog(`selftest: reminder fired kind=${c.active} run=${which}`);
    if (!import.meta.env.VITE_HANA_AUTOPRESS) return;
    const id = window.setTimeout(() => {
      if (which === 0) {
        void backendLog("selftest: pressing Done");
        actionsRef.current.handleDone();
      } else {
        void backendLog("selftest: pressing Remind me later");
        actionsRef.current.handleLater();
      }
    }, 5000);
    return () => window.clearTimeout(id);
  }, [c.active]);

  // Dev-only persistence round-trip: log what was restored, then switch character once
  // so a restart can prove the choice survived.
  useEffect(() => {
    if (!import.meta.env.VITE_HANA_PERSIST_TEST) return;
    void backendLog(`PERSIST loaded character=${c.settings.character} water=${c.settings.waterMin}`);
    if (c.settings.character !== "bolt") {
      const id = window.setTimeout(() => {
        void backendLog("PERSIST writing character=bolt");
        c.updateSettings({ character: "bolt" });
      }, 3000);
      return () => window.clearTimeout(id);
    }
    void backendLog("PERSIST restored character=bolt from previous run");
  }, [c.settings.character, c.settings.waterMin, c.updateSettings]);

  const onReady = useCallback((engine: CompanionEngine) => {
    engineRef.current = engine;
  }, []);

  return (
    <main className="overlay">
      <Companion
        initialCharacter={c.settings.character}
        onReady={onReady}
        onState={setState}
        onBubble={setBubble}
        onPoke={handlePoke}
      />

      {visible && (
      <div
        className={`drag-handle ${controlsOpen || settingsOpen ? "panel-active" : ""}`}
        title="Hana"
      >
        <span>
          Hana <i>♡</i>
        </span>
        <button className="mini" onClick={openSettings} title="Settings">
          ⚙
        </button>
        <button
          className="mini"
          onClick={toggleControls}
          title={controlsOpen ? "Close panel" : "Controls"}
        >
          {controlsOpen ? "✕" : "⌄"}
        </button>
        <button
          className="mini"
          onClick={() => {
            setPinned(false);
            setControlsOpen(false);
            setSettingsOpen(false);
            setVisible(false);
          }}
          title="Hide Hana (restore from the menu bar)"
        >
          ⏻
        </button>
      </div>
      )}

      {visible && bubble && <div className="bubble">{bubble}</div>}
      {visible && c.paused && <div className="tiny-status">☾ idle pause</div>}

      {visible && controlsOpen && !settingsOpen && (
        <ControlsPanel
          active={c.active}
          waterLeft={c.waterLeft}
          eyeLeft={c.eyeLeft}
          focusLeft={c.focusLeft}
          focusRunning={c.focusRunning}
          focusMin={c.settings.focusMin}
          onDone={handleDone}
          onLater={handleLater}
          onStartFocus={c.startFocus}
          onStopFocus={c.stopFocus}
          onOpenSettings={openSettings}
          onHideWindow={() => {
            setPinned(false);
            setControlsOpen(false);
            setSettingsOpen(false);
            setVisible(false);
          }}
          onCloseControls={() => setControlsOpen(false)}
        />
      )}

      {visible && settingsOpen && (
        <SettingsPanel
          settings={c.settings}
          onChange={c.updateSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <span className="sr-state" aria-live="polite">
        {state}
      </span>
    </main>
  );
}
