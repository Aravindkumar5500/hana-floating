#[cfg(target_os = "macos")]
mod macos;

use std::sync::Mutex;
use std::time::Duration;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, WebviewWindow};

/// Where the character actually is inside the window, in window-local logical pixels,
/// plus whether the frontend wants the window to stay clickable regardless (dragging).
#[derive(Default)]
struct Interaction {
    hit: Mutex<Option<(f64, f64, f64, f64)>>,
    force_interactive: Mutex<bool>,
    ignoring: Mutex<bool>,
}

/// Seconds since the last keyboard/mouse event, via IOKit's `HIDIdleTime`.
///
/// The byte-string literals must end in a real NUL. The original version used
/// `b"IOHIDSystem\\0"`, which is a backslash followed by a zero, so `IOServiceMatching`
/// received a malformed, unterminated C string, the lookup never matched, and this
/// always returned 0 - which is why idle-pause never triggered.
#[tauri::command]
fn idle_seconds() -> u64 {
    #[cfg(debug_assertions)]
    {
        use std::sync::atomic::{AtomicBool, Ordering};
        static LOGGED: AtomicBool = AtomicBool::new(false);
        if !LOGGED.swap(true, Ordering::Relaxed) {
            eprintln!("hana: frontend reached idle_seconds()");
        }
    }
    #[cfg(target_os = "macos")]
    {
        use std::ffi::c_void;
        #[link(name = "IOKit", kind = "framework")]
        extern "C" {
            fn IOServiceGetMatchingService(master_port: u32, matching: *const c_void) -> u32;
            fn IOServiceMatching(name: *const i8) -> *mut c_void;
            fn IORegistryEntryCreateCFProperty(
                entry: u32,
                key: *const c_void,
                allocator: *const c_void,
                options: u32,
            ) -> *const c_void;
            fn IOObjectRelease(object: u32) -> i32;
        }
        #[link(name = "CoreFoundation", kind = "framework")]
        extern "C" {
            fn CFStringCreateWithCString(
                alloc: *const c_void,
                c_str: *const i8,
                encoding: u32,
            ) -> *const c_void;
            fn CFNumberGetValue(
                number: *const c_void,
                number_type: i32,
                value_ptr: *mut i64,
            ) -> bool;
            fn CFRelease(cf: *const c_void);
        }
        const K_CF_STRING_ENCODING_UTF8: u32 = 0x0800_0100;
        const K_CF_NUMBER_S_INT64_TYPE: i32 = 4;

        unsafe {
            let matching = IOServiceMatching(c"IOHIDSystem".as_ptr());
            if matching.is_null() {
                return 0;
            }
            let service = IOServiceGetMatchingService(0, matching);
            if service == 0 {
                return 0;
            }
            let key = CFStringCreateWithCString(
                std::ptr::null(),
                c"HIDIdleTime".as_ptr(),
                K_CF_STRING_ENCODING_UTF8,
            );
            if key.is_null() {
                IOObjectRelease(service);
                return 0;
            }
            let value = IORegistryEntryCreateCFProperty(service, key, std::ptr::null(), 0);
            CFRelease(key);
            IOObjectRelease(service);
            if value.is_null() {
                return 0;
            }
            let mut nanos: i64 = 0;
            let ok = CFNumberGetValue(value, K_CF_NUMBER_S_INT64_TYPE, &mut nanos);
            CFRelease(value);
            if ok && nanos > 0 {
                (nanos as u64) / 1_000_000_000
            } else {
                0
            }
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        0
    }
}

/// Lets the webview report errors into the dev log. Debug diagnostics only.
#[tauri::command]
fn hana_log(msg: String) {
    eprintln!("hana[web]: {msg}");
}

/// Dev-only: dump text (a PNG data URL) next to the logs so the rig can be inspected
/// without depending on the window being visible on screen.
#[tauri::command]
fn save_text(name: String, contents: String) -> Result<String, String> {
    let dir = std::env::temp_dir().join("hana-frames");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let safe: String = name.chars().filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_').collect();
    let path = dir.join(format!("{safe}.txt"));
    std::fs::write(&path, contents).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// Re-apply the native floating configuration and order the window in without activating.
fn present(window: &WebviewWindow) {
    let _ = window.show();
    #[cfg(target_os = "macos")]
    {
        if let Err(e) = macos::configure_companion_window(window) {
            eprintln!("hana: could not configure companion window: {e}");
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = window.set_always_on_top(true);
    }
}

#[tauri::command]
fn hide_companion(window: WebviewWindow) {
    let _ = window.hide();
}

#[tauri::command]
fn show_companion(window: WebviewWindow) {
    present(&window);
}

#[tauri::command]
fn set_companion_size(window: WebviewWindow, width: f64, height: f64) {
    let _ = window.set_size(LogicalSize::new(width, height));
    keep_on_screen(&window);
}

/// Move the whole native window. This is how Hana walks across the desktop: the window
/// itself travels, rather than the character sliding inside a fixed frame.
#[tauri::command]
fn move_companion(window: WebviewWindow, x: f64, y: f64) {
    let _ = window.set_position(LogicalPosition::new(x, y));
}

/// The usable screen area (minus menu bar and Dock) in logical, top-left coordinates,
/// so the frontend can plan a walk that stays on-screen and stands on the Dock line.
#[tauri::command]
fn work_area() -> Result<serde_json::Value, String> {
    #[cfg(target_os = "macos")]
    {
        let r = macos::work_area()?;
        #[cfg(debug_assertions)]
        {
            use std::sync::atomic::{AtomicBool, Ordering};
            static LOGGED: AtomicBool = AtomicBool::new(false);
            if !LOGGED.swap(true, Ordering::Relaxed) {
                eprintln!("hana: frontend is alive — work_area() called, {r:?}");
            }
        }
        Ok(serde_json::json!({ "x": r.x, "y": r.y, "width": r.width, "height": r.height }))
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("work_area is implemented for macOS only".to_string())
    }
}

/// Allow or forbid the window taking keyboard focus.
///
/// Called with `true` while a Settings/controls panel is open so native `<select>`
/// popups work, and `false` the rest of the time so Hana never steals focus.
#[tauri::command]
fn set_window_interactive(window: WebviewWindow, interactive: bool) {
    #[cfg(target_os = "macos")]
    {
        if let Err(e) = macos::set_allow_key(&window, interactive) {
            eprintln!("hana: set_allow_key failed: {e}");
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (window, interactive);
    }
}

/// Current window position in logical coordinates.
#[tauri::command]
fn companion_position(window: WebviewWindow) -> Result<(f64, f64), String> {
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    let sf = window.scale_factor().map_err(|e| e.to_string())?;
    Ok((pos.x as f64 / sf, pos.y as f64 / sf))
}

/// Tell the native side where the character actually is inside the window, so clicks on
/// the transparent margins fall through to whatever app is underneath.
#[tauri::command]
fn set_hit_rect(app: AppHandle, x: f64, y: f64, width: f64, height: f64) {
    if let Some(state) = app.try_state::<Interaction>() {
        *state.hit.lock().unwrap() = Some((x, y, width, height));
    }
}

/// While dragging, the window must keep receiving mouse events wherever the cursor goes.
#[tauri::command]
fn set_interactive(app: AppHandle, interactive: bool) {
    if let Some(state) = app.try_state::<Interaction>() {
        *state.force_interactive.lock().unwrap() = interactive;
    }
}

fn keep_on_screen(window: &WebviewWindow) {
    let (Ok(Some(monitor)), Ok(pos), Ok(size)) = (
        window.current_monitor(),
        window.outer_position(),
        window.outer_size(),
    ) else {
        return;
    };
    let area = monitor.size();
    let origin = monitor.position();
    let max_x = origin.x + area.width as i32 - size.width as i32;
    let max_y = origin.y + area.height as i32 - size.height as i32;
    let x = pos.x.clamp(origin.x, max_x.max(origin.x));
    let y = pos.y.clamp(origin.y, max_y.max(origin.y));
    if x != pos.x || y != pos.y {
        let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
    }
}

/// Mouse pass-through, the equivalent of SipBuddy's per-tick `updateMousePassthrough`:
/// the window only accepts clicks while the cursor is actually over the character.
#[cfg(target_os = "macos")]
fn update_pass_through(app: &AppHandle) {
    let Some(state) = app.try_state::<Interaction>() else {
        return;
    };
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    if !window.is_visible().unwrap_or(false) {
        return;
    }

    // Keep the window at the status-bar level even if Tauri resets it later.
    if macos::reassert(&window) {
        #[cfg(debug_assertions)]
        eprintln!("hana: re-asserted window level / collectionBehavior");
    }

    // Click routing is now a single boolean, not cursor geometry.
    //
    // The frontend reports an empty hit rect while Hana is parked (a 4x4 transparent
    // window), and a non-empty one while she is on screen. Previously this recomputed
    // the cursor position against her body every 60ms, and any slip in that maths made
    // the whole window click-through - which is what left the Settings controls and the
    // header buttons dead. She is only ever on screen during a reminder or when the
    // user summons her, so accepting clicks for the whole window then is correct.
    let want_ignore = match *state.hit.lock().unwrap() {
        Some((_, _, w, h)) => w <= 0.0 || h <= 0.0,
        None => true,
    } && !*state.force_interactive.lock().unwrap();

    let mut ignoring = state.ignoring.lock().unwrap();
    if *ignoring != want_ignore {
        *ignoring = want_ignore;
        #[cfg(debug_assertions)]
        {
            let hit = *state.hit.lock().unwrap();
            eprintln!("hana: clicks {} (hit rect {hit:?})", if want_ignore { "PASS THROUGH" } else { "ACCEPTED" });
        }
        let _ = window.set_ignore_cursor_events(want_ignore);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(Interaction::default())
        .invoke_handler(tauri::generate_handler![
            idle_seconds,
            hana_log,
            save_text,
            hide_companion,
            show_companion,
            set_companion_size,
            move_companion,
            work_area,
            companion_position,
            set_window_interactive,
            set_hit_rect,
            set_interactive
        ])
        .setup(|app| {
            // Accessory: no Dock icon, no app-switcher entry, and the app never takes
            // over the menu bar.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let window = app
                .get_webview_window("main")
                .expect("main window is declared in tauri.conf.json");
            let _ = window.set_decorations(false);
            let _ = window.set_resizable(false);
            let _ = window.set_skip_taskbar(true);
            let _ = window.set_shadow(false);
            let _ = window.set_always_on_top(true);

            #[cfg(target_os = "macos")]
            match macos::promote_to_panel(&window) {
                Ok(true) => eprintln!("hana: window promoted to non-activating NSPanel"),
                Ok(false) => eprintln!("hana: WARNING NSPanel promotion did not take"),
                Err(e) => eprintln!("hana: NSPanel promotion failed: {e}"),
            }

            #[cfg(target_os = "macos")]
            match macos::make_non_activating(&window) {
                Ok(true) => eprintln!("hana: window refuses key status (no focus stealing)"),
                Ok(false) => eprintln!("hana: WARNING window can still become key"),
                Err(e) => eprintln!("hana: could not make window non-activating: {e}"),
            }

            present(&window);
            build_tray(app.handle())?;

            // Diagnostics: report what AppKit actually thinks of the window, a few times
            // after launch, so "configured correctly" can be told apart from "visible".
            #[cfg(all(target_os = "macos", debug_assertions))]
            {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    for i in 0..4 {
                        std::thread::sleep(Duration::from_secs(if i == 0 { 2 } else { 5 }));
                        let h = handle.clone();
                        let inner = handle.clone();
                        let _ = h.run_on_main_thread(move || {
                            if let Some(w) = inner.get_webview_window("main") {
                                match macos::describe(&w) {
                                    Ok(s) => eprintln!("hana: {s}"),
                                    Err(e) => eprintln!("hana: describe failed: {e}"),
                                }
                            }
                        });
                    }
                });
            }

            // Cursor polling for click pass-through. The AppKit reads happen on the main
            // thread; this thread only schedules them.
            #[cfg(target_os = "macos")]
            {
                let handle = app.handle().clone();
                std::thread::spawn(move || loop {
                    std::thread::sleep(Duration::from_millis(60));
                    let h = handle.clone();
                    let inner = handle.clone();
                    if h.run_on_main_thread(move || update_pass_through(&inner)).is_err() {
                        break; // app is shutting down
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Hana companion");
}

/// Menu-bar entry. This is the guaranteed way back after "Hide", so it is built at
/// startup and never torn down.
fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show Hana", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "Hide Hana", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Hana", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &hide, &settings, &quit])?;

    let mut builder = TrayIconBuilder::with_id("hana-tray")
        .tooltip("Hana companion")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            let Some(window) = app.get_webview_window("main") else {
                return;
            };
            match event.id().as_ref() {
                "show" => {
                    present(&window);
                    let _ = window.emit("hana://show", ());
                }
                "hide" => {
                    let _ = window.emit("hana://hide", ());
                }
                "settings" => {
                    present(&window);
                    let _ = window.emit("hana://show", ());
                    let _ = window.emit("hana://open-settings", ());
                }
                "quit" => app.exit(0),
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Some(window) = tray.app_handle().get_webview_window("main") {
                    // Left-click the menu-bar item to summon her; hiding is an explicit
                    // menu action so a stray click cannot lose her.
                    present(&window);
                    let _ = window.emit("hana://show", ());
                }
            }
        });

    // The menu-bar item is the only way back after "Hide", so it must never be invisible.
    match app.default_window_icon().cloned() {
        Some(icon) => {
            eprintln!("hana: tray using bundled app icon");
            builder = builder.icon(icon).icon_as_template(true);
        }
        None => {
            eprintln!("hana: no bundled icon found, tray falls back to a text title");
            builder = builder.title("♡");
        }
    }
    builder.build(app)?;
    Ok(())
}
