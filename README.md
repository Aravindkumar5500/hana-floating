# Hana — Floating macOS Desktop Companion

This version is designed as a **small transparent always-on-top pet overlay**, not a full dashboard. It should sit over apps such as VS Code, Finder, or a browser, so the user can keep working while Hana stays visible in a screen corner.

## Included
- Small transparent, frameless, always-on-top macOS window.
- Original anime-inspired character with blinking, bobbing, expressions and walk-in reminder animation.
- Water reminder (30 min default), eye-rest reminder (20 min), focus session (50 min), Done and 5-minute snooze.
- Compact controls appear when clicking Hana; settings panel can be opened from the gear button.
- Tauri 2 + React + TypeScript + Rust, notification plugin integration and macOS idle-time query.

## Current limitations
- Starter scaffold; not built/tested on your Mac yet.
- Character is CSS animated, not a true Live2D model/rig.
- Window positioning is initialized by macOS/Tauri; drag using the top pet area. Position persistence and a tray menu are not implemented yet.
- Native notifications and idle detection need testing on your macOS version.
- Signed/notarized DMG needs Apple Developer ID credentials.

## Run
```bash
npm install
npm run tauri dev
```

## Build unsigned DMG
```bash
npm run tauri build
```

No microphone, voice, screen capture, screen content reading, or cloud AI is included.
