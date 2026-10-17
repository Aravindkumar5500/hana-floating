import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// Deliberately not wrapped in <React.StrictMode>. Strict mode double-invokes effects in
// development, which would mount the companion's 1 Hz interval twice and fire every
// reminder twice. The timer engine is timestamp-derived and would survive it, but there
// is nothing to gain from the double mount in a desktop shell.
createRoot(document.getElementById("root")!).render(<App />);

// Opt-in dev tool: writes a contact sheet of every character/pose to
// $TMPDIR/hana-frames/sheet.txt (a PNG data URL) so the artwork can be reviewed without
// the floating window needing to be visible. Enable with:
//   VITE_HANA_SNAPSHOT=1 npm run tauri build -- --debug --bundles app
if (import.meta.env.VITE_HANA_SPRITEGEN) {
  import("./rig/spritegen").then((m) => m.generateSpriteSheets()).catch(() => {});
}
if (import.meta.env.VITE_HANA_SNAPSHOT) {
  import("./rig/snapshot").then((m) => m.renderContactSheet()).catch(() => {});
}
