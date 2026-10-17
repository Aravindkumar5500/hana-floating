//! Small, isolated macOS-native integration.
//!
//! Tauri 2 exposes `set_always_on_top`, but it has no public API for the AppKit
//! properties that decide whether a floating companion survives app switching, Spaces
//! and full-screen apps, nor for refusing keyboard focus:
//!
//!   * `NSWindow.level`               - above ordinary windows, at the status-bar level.
//!   * `NSWindow.collectionBehavior`  - join every Space, stay put, tolerate full-screen apps.
//!   * `NSWindow.hidesOnDeactivate`   - must be NO, or the window vanishes when another
//!                                      app activates.
//!   * `canBecomeKeyWindow`           - tao returns YES for borderless windows, which is
//!                                      why clicking Hana pulled keyboard focus out of
//!                                      VS Code. See `make_non_activating`.
//!
//! Everything here talks to the `NSWindow` Tauri already created. No window is replaced.

use std::sync::atomic::{AtomicBool, Ordering};

use objc2::encode::{Encode, Encoding};
use objc2::runtime::{AnyClass, AnyObject, Bool, Imp, Sel};
use objc2::{class, msg_send, sel};
use objc2_core_foundation::CGRect;

/// Window level.
///
/// `NSStatusWindowLevel`: above ordinary app windows, below menus and the screen saver.
///
/// Raising this to `NSScreenSaverWindowLevel` (1000) was tested and did NOT make the
/// window join another app's full-screen Space (`isOnActiveSpace` stayed false), so the
/// higher level bought nothing and risked covering menus. Keep 25.
const NS_STATUS_WINDOW_LEVEL: isize = 25;

// NSWindowCollectionBehavior flags.
const CAN_JOIN_ALL_SPACES: usize = 1 << 0;
/// Follow the user: the window is moved onto whichever Space becomes active. Mutually
/// exclusive with CAN_JOIN_ALL_SPACES.
const MOVE_TO_ACTIVE_SPACE: usize = 1 << 1;
const STATIONARY: usize = 1 << 4;
const IGNORES_CYCLE: usize = 1 << 6;
const FULL_SCREEN_AUXILIARY: usize = 1 << 8;

/// Collection behaviour for the companion window.
///
/// `canJoinAllSpaces` keeps the window on every Space, but macOS will NOT place such a
/// window into *another app's* full-screen Space: it stays on the desktop Space, is
/// reported fully occluded, and WebKit then suspends the whole webview - which freezes
/// the animation AND stops the reminder timers. `moveToActiveSpace` instead follows the
/// user onto whichever Space they switch to, including full-screen ones, which keeps the
/// webview awake. Set HANA_ALL_SPACES=1 to go back to the old behaviour.
fn companion_behavior() -> usize {
    let base = STATIONARY | IGNORES_CYCLE | FULL_SCREEN_AUXILIARY;
    if std::env::var("HANA_MOVE_TO_ACTIVE_SPACE").is_ok() {
        base | MOVE_TO_ACTIVE_SPACE
    } else {
        base | CAN_JOIN_ALL_SPACES
    }
}

fn ns_window(window: &tauri::WebviewWindow) -> Result<*mut AnyObject, String> {
    let ptr = window
        .ns_window()
        .map_err(|e| format!("ns_window() failed: {e}"))? as *mut AnyObject;
    if ptr.is_null() {
        return Err("ns_window() returned a null pointer".to_string());
    }
    Ok(ptr)
}

/// Whether the window is currently allowed to become key.
///
/// Normally false, so clicking Hana never pulls focus out of the app you are typing in.
/// It is switched on only while a panel is open, because native `<select>` popups and
/// checkboxes need a key window to work at all - with it permanently false the Settings
/// dropdowns were inert.
pub static ALLOW_KEY: AtomicBool = AtomicBool::new(false);

/// `-[NSWindow canBecomeKeyWindow]` / `canBecomeMainWindow` replacement.
extern "C-unwind" fn can_become_key(_this: *mut AnyObject, _cmd: Sel) -> Bool {
    Bool::new(ALLOW_KEY.load(Ordering::Relaxed))
}

/// Let the window take focus (panel open) or give it up again (panel closed).
pub fn set_allow_key(window: &tauri::WebviewWindow, allow: bool) -> Result<(), String> {
    ALLOW_KEY.store(allow, Ordering::Relaxed);
    let ptr = ns_window(window)?;
    unsafe {
        if allow {
            // Activate so the popup menus of <select> elements can actually open.
            let app: *mut AnyObject = msg_send![class!(NSApplication), sharedApplication];
            let _: () = msg_send![app, activateIgnoringOtherApps: Bool::new(true)];
            let _: () = msg_send![ptr, makeKeyAndOrderFront: std::ptr::null_mut::<AnyObject>()];
        } else {
            let is_key: Bool = msg_send![ptr, isKeyWindow];
            if is_key.as_bool() {
                let _: () = msg_send![ptr, resignKeyWindow];
            }
        }
    }
    Ok(())
}

/// `NSWindowStyleMaskNonactivatingPanel` — only meaningful on an `NSPanel`.
const NONACTIVATING_PANEL: usize = 1 << 7;

/// Promote Tauri's `NSWindow` to an `NSPanel` and mark it non-activating.
///
/// A plain `NSWindow` will not be placed into another application's full-screen Space,
/// no matter its level or collection behaviour (level 25, level 1000 and
/// `moveToActiveSpace` were all tested and all left the window occluded on the desktop
/// Space, which makes WebKit suspend the whole webview and freezes both the animation
/// and the reminder timers). A non-activating `NSPanel` is the supported way to float
/// over full-screen Spaces.
///
/// `NSPanel` adds no instance variables over `NSWindow`, so re-pointing the isa is safe
/// here; it is the same technique the `tauri-nspanel` crate uses, without the dependency.
pub fn promote_to_panel(window: &tauri::WebviewWindow) -> Result<bool, String> {
    let ptr = ns_window(window)?;
    unsafe {
        let panel_cls: *const AnyClass = class!(NSPanel);
        objc2::ffi::object_setClass(
            ptr as *mut objc2::runtime::AnyObject,
            panel_cls as *mut AnyClass,
        );
        let mask: usize = msg_send![ptr, styleMask];
        let _: () = msg_send![ptr, setStyleMask: mask | NONACTIVATING_PANEL];
        // Panels hide when the owning app deactivates unless told otherwise.
        let _: () = msg_send![ptr, setFloatingPanel: Bool::new(true)];
        let _: () = msg_send![ptr, setHidesOnDeactivate: Bool::new(false)];
        let now: usize = msg_send![ptr, styleMask];
        Ok(now & NONACTIVATING_PANEL != 0)
    }
}

/// Make the window behave like a non-activating panel.
///
/// A borderless `NSWindow` would refuse key status by default, but tao overrides
/// `canBecomeKeyWindow` to return YES so that `decorations: false` apps can still take
/// text input. Hana never needs keyboard input, so we replace that override on tao's
/// window class with one that returns NO. The window still receives mouse clicks; it
/// just never becomes the key window, so the frontmost app keeps its keyboard focus.
///
/// This is the closest equivalent to AppKit's `NSWindowStyleMaskNonactivatingPanel`
/// without replacing Tauri's `NSWindow` with an `NSPanel`.
pub fn make_non_activating(window: &tauri::WebviewWindow) -> Result<bool, String> {
    let ptr = ns_window(window)?;

    // SAFETY: `ptr` is a live NSWindow. We replace two zero-argument BOOL getters on its
    // class with a function of the matching C signature. The app has exactly one window
    // of this class, so no other window's behaviour changes.
    unsafe {
        let cls = (*ptr).class() as *const AnyClass as *mut AnyClass;
        let imp: Imp = std::mem::transmute(
            can_become_key as extern "C-unwind" fn(*mut AnyObject, Sel) -> Bool,
        );
        // "c@:" = returns char (BOOL), takes self and _cmd.
        let types = c"c@:".as_ptr();
        objc2::ffi::class_replaceMethod(cls, sel!(canBecomeKeyWindow), imp, types);
        objc2::ffi::class_replaceMethod(cls, sel!(canBecomeMainWindow), imp, types);

        // If the window is already key, hand focus back immediately.
        let is_key: Bool = msg_send![ptr, isKeyWindow];
        if is_key.as_bool() {
            let _: () = msg_send![ptr, resignKeyWindow];
        }

        let can: Bool = msg_send![ptr, canBecomeKeyWindow];
        Ok(!can.as_bool())
    }
}

/// Apply the floating-companion window configuration.
/// Safe to call repeatedly; re-applied after a hide/show cycle.
pub fn configure_companion_window(window: &tauri::WebviewWindow) -> Result<(), String> {
    let ptr = ns_window(window)?;
    let behavior = companion_behavior();

    // SAFETY: `ptr` is the live NSWindow owned by Tauri; every selector below is a
    // documented NSWindow setter with the argument type used here.
    unsafe {
        let _: () = msg_send![ptr, setLevel: NS_STATUS_WINDOW_LEVEL];
        let _: () = msg_send![ptr, setCollectionBehavior: behavior];
        let _: () = msg_send![ptr, setHidesOnDeactivate: Bool::new(false)];
        let _: () = msg_send![ptr, setOpaque: Bool::new(false)];
        let _: () = msg_send![ptr, setHasShadow: Bool::new(false)];
        let clear_color: *mut AnyObject = msg_send![class!(NSColor), clearColor];
        let _: () = msg_send![ptr, setBackgroundColor: clear_color];
        // Show without activating the app, so keyboard focus stays where the user left it.
        let _: () = msg_send![ptr, orderFrontRegardless];

        #[cfg(debug_assertions)]
        {
            let level: isize = msg_send![ptr, level];
            let got: usize = msg_send![ptr, collectionBehavior];
            let hides: Bool = msg_send![ptr, hidesOnDeactivate];
            let can_key: Bool = msg_send![ptr, canBecomeKeyWindow];
            eprintln!(
                "hana: NSWindow level={level} collectionBehavior={got:#x} \
                 hidesOnDeactivate={} canBecomeKeyWindow={}",
                hides.as_bool(),
                can_key.as_bool()
            );
        }
    }

    Ok(())
}

/// Re-assert level and collection behaviour if something has reset them.
///
/// Setting these once in `setup` is not enough: Tauri/tao applies its own
/// `alwaysOnTop` level after our setup hook runs, which drops the window from
/// NSStatusWindowLevel (25) back to its floating level (5). This is called from the
/// same periodic pass that drives click pass-through, and only touches the window when
/// a value has actually drifted.
pub fn reassert(window: &tauri::WebviewWindow) -> bool {
    let Ok(ptr) = ns_window(window) else {
        return false;
    };
    let behavior = companion_behavior();
    unsafe {
        let mut changed = false;
        let level: isize = msg_send![ptr, level];
        if level != NS_STATUS_WINDOW_LEVEL {
            let _: () = msg_send![ptr, setLevel: NS_STATUS_WINDOW_LEVEL];
            changed = true;
        }
        let got: usize = msg_send![ptr, collectionBehavior];
        if got != behavior {
            let _: () = msg_send![ptr, setCollectionBehavior: behavior];
            changed = true;
        }
        let hides: Bool = msg_send![ptr, hidesOnDeactivate];
        if hides.as_bool() {
            let _: () = msg_send![ptr, setHidesOnDeactivate: Bool::new(false)];
            changed = true;
        }
        changed
    }
}

/// Diagnostics: what AppKit thinks of the window right now.
pub fn describe(window: &tauri::WebviewWindow) -> Result<String, String> {
    let ptr = ns_window(window)?;
    unsafe {
        let visible: Bool = msg_send![ptr, isVisible];
        let occl: usize = msg_send![ptr, occlusionState];
        let alpha: f64 = msg_send![ptr, alphaValue];
        let frame: CGRect = msg_send![ptr, frame];
        let level: isize = msg_send![ptr, level];
        let miniaturized: Bool = msg_send![ptr, isMiniaturized];
        let on_active_space: Bool = msg_send![ptr, isOnActiveSpace];
        Ok(format!(
            "isVisible={} occlusionState={occl:#x} (visible bit set: {}) alpha={alpha} \
             level={level} miniaturized={} onActiveSpace={} frame=({},{} {}x{})",
            visible.as_bool(),
            occl & (1 << 1) != 0,
            miniaturized.as_bool(),
            on_active_space.as_bool(),
            frame.origin.x, frame.origin.y, frame.size.width, frame.size.height
        ))
    }
}

/// A rectangle in Tauri's logical, top-left-origin coordinate space.
#[derive(Debug, Clone, Copy, serde::Serialize)]
pub struct LogicalRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// `NSScreen.visibleFrame` (the screen minus the menu bar and Dock), converted from
/// AppKit's bottom-left origin to Tauri's top-left origin so the frontend can use it
/// directly with `set_position`. Handles multi-monitor primary-screen conversion correctly.
pub fn work_area() -> Result<LogicalRect, String> {
    // SAFETY: NSScreen.mainScreen may be nil (no display); we check before use.
    unsafe {
        let screen: *mut AnyObject = msg_send![class!(NSScreen), mainScreen];
        if screen.is_null() {
            return Err("NSScreen.mainScreen is nil".to_string());
        }
        let screens: *mut AnyObject = msg_send![class!(NSScreen), screens];
        let count: usize = msg_send![screens, count];
        let primary_height = if count > 0 {
            let primary: *mut AnyObject = msg_send![screens, objectAtIndex: 0];
            let p_frame: CGRect = msg_send![primary, frame];
            p_frame.size.height
        } else {
            let full: CGRect = msg_send![screen, frame];
            full.size.height
        };
        let visible: CGRect = msg_send![screen, visibleFrame];
        Ok(LogicalRect {
            x: visible.origin.x,
            y: primary_height - (visible.origin.y + visible.size.height),
            width: visible.size.width,
            height: visible.size.height,
        })
    }
}

/// Global cursor position in Tauri's logical, top-left-origin coordinates.
#[allow(dead_code)]
pub fn cursor_position() -> Result<(f64, f64), String> {
    #[repr(C)]
    #[derive(Clone, Copy)]
    struct NSPoint {
        x: f64,
        y: f64,
    }
    unsafe impl Encode for NSPoint {
        const ENCODING: Encoding =
            Encoding::Struct("CGPoint", &[Encoding::Double, Encoding::Double]);
    }

    // SAFETY: +[NSEvent mouseLocation] is a class method returning an NSPoint.
    unsafe {
        let screen: *mut AnyObject = msg_send![class!(NSScreen), mainScreen];
        if screen.is_null() {
            return Err("NSScreen.mainScreen is nil".to_string());
        }
        let full: CGRect = msg_send![screen, frame];
        let p: NSPoint = msg_send![class!(NSEvent), mouseLocation];
        Ok((p.x, full.size.height - p.y))
    }
}
