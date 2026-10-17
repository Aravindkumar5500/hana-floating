import type { ReminderKind } from "../lib/useCompanion";
import { formatClock } from "../lib/useCompanion";

interface Props {
  active: ReminderKind | null;
  waterLeft: number;
  eyeLeft: number;
  focusLeft: number;
  focusRunning: boolean;
  focusMin: number;
  onDone: () => void;
  onLater: () => void;
  onStartFocus: () => void;
  onStopFocus: () => void;
  onOpenSettings: () => void;
  onHideWindow: () => void;
  onCloseControls: () => void;
}

/** Compact controls. Settings, hide-the-window and close-the-panel are three separate actions. */
export function ControlsPanel({
  active,
  waterLeft,
  eyeLeft,
  focusLeft,
  focusRunning,
  focusMin,
  onDone,
  onLater,
  onStartFocus,
  onStopFocus,
  onOpenSettings,
  onHideWindow,
  onCloseControls,
}: Props) {
  if (active) {
    return (
      <section className="quick-controls">
        <div className="reminder-actions">
          <button onClick={onDone}>✓ Done</button>
          <button className="secondary" onClick={onLater}>
            Later · 5m
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="quick-controls">
      <div className="timers">
        <span>💧 {formatClock(waterLeft)}</span>
        <span>✧ {formatClock(eyeLeft)}</span>
      </div>
      <div className="focus-line">
        <span>Focus {focusRunning ? formatClock(focusLeft) : `${focusMin}:00`}</span>
        {focusRunning ? (
          <button className="secondary" onClick={onStopFocus}>
            End
          </button>
        ) : (
          <button onClick={onStartFocus}>Start</button>
        )}
      </div>
      <div className="quick-foot">
        <button className="secondary" onClick={onOpenSettings} title="Open settings">
          ⚙ Settings
        </button>
        <button className="secondary" onClick={onCloseControls} title="Close this panel">
          ✕ Close
        </button>
        <button className="secondary" onClick={onHideWindow} title="Hide Hana (restore from the menu bar)">
          ⏻ Hide
        </button>
      </div>
    </section>
  );
}
