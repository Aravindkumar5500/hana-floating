/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set to 1 to dump a rig contact sheet at startup; see src/rig/snapshot.ts. */
  readonly VITE_HANA_SNAPSHOT?: string;
  /** Set to 1 to regenerate placeholder sprite sheets; see src/rig/spritegen.ts. */
  readonly VITE_HANA_SPRITEGEN?: string;
  /** Set to 1 for the dev reminder self-test (short intervals, scripted Done/snooze). */
  readonly VITE_HANA_SELFTEST?: string;
  /** Set to 1 to let the self-test harness press Done/Snooze automatically. */
  readonly VITE_HANA_AUTOPRESS?: string;
  /** Set to 1 for the settings-persistence round-trip test. */
  readonly VITE_HANA_PERSIST_TEST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
