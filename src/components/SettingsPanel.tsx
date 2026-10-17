import type { Settings } from "../lib/useCompanion";
import { CHARACTERS } from "../rig/characters";

interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
}

export function SettingsPanel({ settings, onChange, onClose }: Props) {
  return (
    <div className="settings">
      <div className="settings-head">
        <b>Hana settings</b>
        <button className="mini" onClick={onClose} title="Close settings">
          ×
        </button>
      </div>

      <label>
        Character
        <select
          value={settings.character}
          onChange={(e) => onChange({ character: e.target.value })}
        >
          {CHARACTERS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.kind}
            </option>
          ))}
        </select>
      </label>

      <label>
        Water
        <select
          value={settings.waterMin}
          onChange={(e) => onChange({ waterMin: Number(e.target.value) })}
        >
          {[20, 30, 45, 60].map((n) => (
            <option key={n} value={n}>
              {n} min
            </option>
          ))}
        </select>
      </label>

      <label>
        Eye rest
        <select
          value={settings.eyeMin}
          onChange={(e) => onChange({ eyeMin: Number(e.target.value) })}
        >
          {[15, 20, 30, 40].map((n) => (
            <option key={n} value={n}>
              {n} min
            </option>
          ))}
        </select>
      </label>

      <label>
        Focus
        <select
          value={settings.focusMin}
          onChange={(e) => onChange({ focusMin: Number(e.target.value) })}
        >
          {[25, 40, 50, 60].map((n) => (
            <option key={n} value={n}>
              {n} min
            </option>
          ))}
        </select>
      </label>

      <label className="toggle">
        <span>Quiet focus mode</span>
        <input
          type="checkbox"
          checked={settings.quiet}
          onChange={(e) => onChange({ quiet: e.target.checked })}
        />
      </label>

      <p>No microphone, voice, or screen capture.</p>
    </div>
  );
}
