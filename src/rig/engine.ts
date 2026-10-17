/**
 * The companion engine: one requestAnimationFrame loop that owns the character's
 * behaviour, its pose springs, and the position of the native window.
 *
 * Deliberately a plain class, not a React component. React renders the canvas element
 * once and then never re-renders for animation — the engine mutates the canvas directly
 * and only calls back into React when a *label* changes (the state name, or the bubble
 * text). That is what keeps animations from restarting: nothing about the running
 * animation lives in React state.
 *
 * Walking is real: `moveCompanion` moves the whole NSWindow across the desktop, so she
 * travels over your other applications rather than sliding inside a fixed frame.
 */

import { PoseAnimator, neutralPose, type Pose } from "./pose";
import { RIG } from "./skeleton";
import { drawHana } from "./draw";
import { DEFAULT_CHARACTER, characterById, type CharacterLook } from "./characters";
import {
  drawSpriteFrame,
  frameIndex,
  loadSprites,
  pickAnim,
  type AnimName,
  type SpriteSet,
} from "./sprites";
import {
  CHEER_DURATION,
  DRINK_DURATION,
  cheer,
  dangle,
  drink,
  eyeRest,
  falling,
  focused,
  idle,
  remind,
  sleep,
  walk,
} from "./poses";
import { invoke } from "@tauri-apps/api/core";
import {
  backendLog,
  moveCompanion,
  setHitRect,
  setInteractive,
  workArea,
  type Rect,
} from "../lib/bridge";

export type CompanionState =
  | "idle"
  | "walking"
  | "water_reminder"
  | "eye_rest"
  | "drinking"
  | "happy"
  | "dragging"
  | "falling"
  | "sleeping"
  | "focused";

type Mode =
  | { k: "idle"; until: number }
  | { k: "walking"; to: number }
  | { k: "remind"; kind: "water" | "eyes" }
  | { k: "drink"; start: number }
  | { k: "cheer"; start: number }
  | { k: "drag" }
  | { k: "fall" }
  | { k: "sleep" }
  | { k: "focus" };

const invokeSave = (name: string, contents: string) => {
  void invoke("save_text", { name, contents }).catch(() => {});
};

/** Character height on screen, in CSS pixels. */
const CHAR_PX = 200;
/** Pixels from the bottom of the window to her feet (with ample room for shoes). */
const FOOT_MARGIN = 24;

interface Particle {
  text: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  gravity: number;
}

export interface EngineCallbacks {
  onState: (s: CompanionState) => void;
  onBubble: (text: string) => void;
  /** The user clicked her while no reminder was active. */
  onPoke: () => void;
}

export class CompanionEngine {
  private ctx: CanvasRenderingContext2D;
  private animator = new PoseAnimator();
  private mode: Mode = { k: "idle", until: 0 };
  private raf = 0;
  private running = false;

  private t = 0;
  private lastFrame = 0;
  private walkPhase = 0;
  private facingRight = true;

  /** Native window position, logical screen pixels. */
  private winX = 0;
  private winY = 0;
  private vy = 0;
  private area: Rect | null = null;

  /** Pointer position inside this window only (null when it is elsewhere). */
  private localCursor: { x: number; y: number } | null = null;
  /** Dormant = parked tiny and invisible; she is not on screen. */
  private dormant = true;
  /** True while a panel is open, so the whole window must accept clicks. */
  private panelOpen = false;
  private dragOffset = { x: 0, y: 0 };
  private dragPrevX = 0;
  private dragSwing = 0;
  private pointerDownAt: { x: number; y: number; t: number } | null = null;

  private particles: Particle[] = [];
  private nextEffect = 0;
  private nextRoam = 0;

  private look: CharacterLook = characterById(DEFAULT_CHARACTER);
  /** Commissioned artwork for the current character; null = use the procedural rig. */
  private sprites: SpriteSet | null = null;
  private quiet = false;
  private sleeping = false;
  private focusing = false;
  private bubble = "";
  private transientUntil = 0;
  private reportedState: CompanionState | null = null;

  private lastMoveSent = 0;
  private lastHitSent = 0;
  private lastCursorPoll = 0;
  private lastAreaPoll = 0;
  /** Dev-only: live frame dumps so the real rendered output can be inspected. */
  private shots = [4, 7, 10, 13, 16];

  constructor(
    private canvas: HTMLCanvasElement,
    private cb: EngineCallbacks,
    initialCharacter?: string,
  ) {
    if (initialCharacter) {
      this.look = characterById(initialCharacter);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onLocalMove);
    window.addEventListener("pointerleave", this.onLocalLeave);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
  }

  // ---------------------------------------------------------------- lifecycle

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.sprites = await loadSprites(this.look.id);
    void backendLog(
      this.sprites
        ? `sprites loaded for ${this.look.id}: ${Object.keys(this.sprites.anims).join(",")}`
        : `no sprites for ${this.look.id} — using procedural rig`,
    );
    await this.refreshArea();
    this.lastFrame = performance.now();
    this.mode = { k: "idle", until: this.t + 2 };
    this.nextRoam = this.t + 5;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointermove", this.onLocalMove);
    window.removeEventListener("pointerleave", this.onLocalLeave);
  }

  private async refreshArea(): Promise<void> {
    const area = await workArea();
    if (!area) return;
    this.area = area;
    if (this.winX === 0 && this.winY === 0) {
      // Start in the corner, never the centre of the screen.
      this.winX = area.x + area.width - (window.innerWidth || 260) - 24;
      this.winY = this.dockLine();
      void moveCompanion(this.winX, this.winY);
    }
  }

  /**
   * The window's y so that her feet rest on the Dock line. Derived rather than cached
   * because the window changes height whenever a panel opens, and the character always
   * lives at the *bottom* of the window.
   */
  private dockLine(height?: number): number {
    if (!this.area) return this.winY;
    return this.area.y + this.area.height - (height ?? window.innerHeight ?? 300);
  }

  /** Called after the window is resized so she stays standing on the Dock. */
  snapToDock(width?: number, height?: number): void {
    if (!this.area) return;
    // While parked, return to the corner so the few stray pixels are never mid-screen.
    if (this.dormant) {
      this.goHome(width, height);
      return;
    }
    this.winY = this.dockLine(height);
    this.winX = this.clampX(this.winX, width);
    this.sendMove(true);
  }

  // ----------------------------------------------------------------- commands

  /**
   * Park her out of the way, or bring her back.
   *
   * "Dormant" shrinks the window to a few transparent pixels in the corner of the
   * screen rather than calling the native hide. That is deliberate: macOS marks a
   * hidden window as occluded and WebKit then suspends the whole webview - which would
   * stop the reminder timers dead, so reminders would never fire again. A tiny
   * always-on-top window keeps the timers alive while being invisible to the user.
   */
  setDormant(d: boolean): void {
    if (d === this.dormant) return;
    this.dormant = d;
    if (d) {
      this.particles = [];
      this.say("", 0);
      this.mode = { k: "idle", until: this.t + 1 };
    } else {
      this.goHome();
      this.animator.kick("lift", 18);
    }
  }

  isDormant(): boolean {
    return this.dormant;
  }

  /** Whether a panel is open, which makes the whole window clickable. */
  setPanelOpen(open: boolean): void {
    this.panelOpen = open;
  }

  /**
   * Park position: the bottom-RIGHT corner of the work area, deliberately away from
   * the centre where people type.
   */
  private goHome(width?: number, height?: number): void {
    if (!this.area) return;
    const w = width ?? window.innerWidth ?? 260;
    this.winX = this.clampX(this.area.x + this.area.width - w - 24, w);
    this.winY = this.dockLine(height);
    this.facingRight = false;
    this.sendMove(true);
  }

  /** Switch character: new artwork, hair rig, palette and temperament. */
  setCharacter(id: string): void {
    if (id === this.look.id && this.sprites) return;
    this.look = characterById(id);
    void loadSprites(this.look.id).then((s) => {
      if (this.look.id === id) {
        this.sprites = s;
        void backendLog(s ? `sprites loaded for ${id}` : `no sprites for ${id}`);
      }
    });
    // A little hello so the change is visible immediately.
    this.animator.kick("lift", 26);
    this.animator.kick("hairSway", 5);
    this.spawn("✨", 0, 110, 70, 16, 1.1, 20);
  }

  setQuiet(q: boolean): void {
    this.quiet = q;
    if (q) {
      this.particles = [];
      this.say("", 0);
      if (this.mode.k !== "drag" && this.mode.k !== "fall") this.mode = { k: "focus" };
    } else if (this.mode.k === "focus" && !this.focusing) {
      this.mode = { k: "idle", until: this.t + 1 };
    }
  }

  setFocusSession(on: boolean): void {
    this.focusing = on;
    if (on && !this.quiet && this.isCalm()) this.mode = { k: "focus" };
    else if (!on && this.mode.k === "focus" && !this.quiet) {
      this.mode = { k: "idle", until: this.t + 1 };
    }
  }

  setSleeping(s: boolean): void {
    if (s === this.sleeping) return;
    this.sleeping = s;
    if (s) {
      if (this.isCalm()) this.mode = { k: "sleep" };
      this.say("", 0);
    } else if (this.mode.k === "sleep") {
      this.mode = { k: "idle", until: this.t + 1 };
      this.animator.kick("lift", 40);
      this.spawn("✦", 0, 120, 40, 10, 1.1, 20);
    }
  }

  /** A reminder fired: walk over to the cursor, then wave with a bubble. */
  triggerReminder(kind: "water" | "eyes", text: string): void {
    if (this.quiet) return;
    this.mode = { k: "remind", kind };
    this.bubble = text;
    this.transientUntil = Infinity;
    this.animator.kick("lift", 18);
  }

  /** Done: drink, then celebrate. */
  celebrateDone(message: string): void {
    this.mode = { k: "drink", start: this.t };
    this.say(message, 4.2);
  }

  /** Snooze: acknowledge, then go back to roaming. */
  acknowledgeSnooze(message: string): void {
    this.mode = { k: "idle", until: this.t + 2.5 };
    this.say(message, 2.4);
    this.animator.kick("headTilt", 2.2);
  }

  dismissBubble(): void {
    this.say("", 0);
    if (this.mode.k === "remind") this.mode = { k: "idle", until: this.t + 2 };
  }

  private isCalm(): boolean {
    return this.mode.k === "idle" || this.mode.k === "walking" || this.mode.k === "focus";
  }

  private say(text: string, seconds: number): void {
    this.bubble = text;
    this.transientUntil = text ? this.t + seconds : 0;
  }

  // ------------------------------------------------------------------ pointer

  private onPointerDown = (e: PointerEvent) => {
    this.pointerDownAt = { x: e.screenX, y: e.screenY, t: this.t };
    this.dragOffset = { x: e.screenX - this.winX, y: e.screenY - this.winY };
    this.dragPrevX = this.winX;
    // Keep receiving mouse events wherever the cursor travels during a drag.
    void setInteractive(true);
  };

  private onLocalMove = (e: PointerEvent) => {
    this.localCursor = { x: e.clientX, y: e.clientY };
  };

  private onLocalLeave = () => {
    this.localCursor = null;
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.pointerDownAt) return;
    const moved =
      Math.abs(e.screenX - this.pointerDownAt.x) + Math.abs(e.screenY - this.pointerDownAt.y);
    if (moved > 4) {
      if (this.mode.k !== "drag") {
        this.mode = { k: "drag" };
        this.say("Waaah!", 1.2);
      }
      this.winX = e.screenX - this.dragOffset.x;
      this.winY = e.screenY - this.dragOffset.y;
      this.sendMove(true);
    }
  };

  private onPointerUp = () => {
    const down = this.pointerDownAt;
    this.pointerDownAt = null;
    void setInteractive(false);
    if (!down) return;
    if (this.mode.k === "drag") {
      // Let go: she falls back down to the Dock line, and back on-screen if she was
      // dragged past the edge.
      this.winX = this.clampX(this.winX);
      this.sendMove(true);
      this.mode = { k: "fall" };
      this.vy = 0;
      return;
    }
    // A click, not a drag.
    this.cb.onPoke();
  };

  /** Click reaction when no reminder is pending. */
  pokeReaction(message: string): void {
    if (this.mode.k === "drag" || this.mode.k === "fall") return;
    this.mode = { k: "cheer", start: this.t };
    this.say(message, 2.6);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI + 0.25;
      this.spawn(
        ["✨", "♡", "⭐️", "✦"][i % 4],
        Math.cos(a) * 10,
        120,
        Math.sin(a) * 150,
        Math.cos(a) * 110,
        1.2,
        19,
      );
    }
  }

  // -------------------------------------------------------------------- frame

  private frame = (now: number) => {
    if (!this.running) return;
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.t += dt;

    void this.poll();
    const target = this.behave(dt);
    this.applyGaze(target);
    this.animator.update(target, dt);
    this.updateParticles(dt);
    this.render();
    this.publish();

    this.raf = requestAnimationFrame(this.frame);
  };

  /** Low-frequency native queries: cursor for gaze, work area for screen changes. */
  private async poll(): Promise<void> {
    if (this.t - this.lastAreaPoll > 5) {
      this.lastAreaPoll = this.t;
      await this.refreshArea();
    }
  }

  private charScreenX(): number {
    return this.winX + (window.innerWidth || 200) / 2;
  }

  private clampX(x: number, width?: number): number {
    if (!this.area) return x;
    const w = width ?? window.innerWidth ?? 260;
    return Math.min(this.area.x + this.area.width - w, Math.max(this.area.x, x));
  }

  /** Step the window toward a target x. Returns true on arrival. */
  private stepTo(targetX: number, speed: number, dt: number): boolean {
    const dir = targetX >= this.winX ? 1 : -1;
    this.facingRight = dir > 0;
    const delta = dir * speed * dt;
    this.winX += delta;
    this.walkPhase += (Math.abs(delta) / CHAR_PX) * 7.5;
    if ((dir > 0 && this.winX >= targetX) || (dir < 0 && this.winX <= targetX)) {
      this.winX = targetX;
      this.sendMove();
      return true;
    }
    this.sendMove();
    return false;
  }

  private sendMove(force = false): void {
    // ~30 Hz is plenty for window motion and keeps IPC traffic modest.
    if (!force && this.t - this.lastMoveSent < 0.033) return;
    this.lastMoveSent = this.t;
    void moveCompanion(Math.round(this.winX), Math.round(this.winY));
  }

  /** Pick the target pose for the current mode, and drive window motion. */
  private behave(dt: number): Pose {
    const speed = 72;

    switch (this.mode.k) {
      case "sleep":
        return sleep(this.t, this.look);

      case "focus":
        return focused(this.t, this.look);

      case "idle": {
        if (this.sleeping) {
          this.mode = { k: "sleep" };
          return sleep(this.t, this.look);
        }
        if (this.quiet || this.focusing) {
          this.mode = { k: "focus" };
          return focused(this.t, this.look);
        }
        // No roaming. Wandering across the desktop put her in the middle of whatever
        // the user was typing in, so she now stays at her home corner.
        return idle(this.t, this.look);
      }

      case "walking": {
        const arrived = this.stepTo(this.mode.to, speed, dt);
        if (arrived) this.mode = { k: "idle", until: this.t + 3 + Math.random() * 6 };
        return walk(this.walkPhase, this.t, this.look);
      }

      case "remind": {
        if (this.quiet) {
          this.mode = { k: "focus" };
          return focused(this.t, this.look);
        }
        // She waves from her home corner. She deliberately does NOT walk toward the
        // cursor any more - that marched her into the user's work area mid-sentence.
        if (this.mode.kind === "water") {
          this.emit(1.25, () => this.spawn("💧", 26, 95, 55, 24, 1.2, 18, -150));
          return remind(this.t, this.look);
        }
        this.emit(2.2, () => this.spawn("✧", 0, 130, 34, 12, 1.6, 16));
        return eyeRest(this.t, this.look);
      }

      case "drink": {
        const local = this.t - this.mode.start;
        if (local >= DRINK_DURATION) {
          this.mode = { k: "cheer", start: this.t };
          for (let i = 0; i < 9; i++) {
            const a = (i / 9) * Math.PI + 0.2;
            this.spawn(
              ["✨", "⭐️", "♡", "💧"][i % 4],
              0,
              120,
              Math.sin(a) * 210,
              Math.cos(a) * 170,
              1.3,
              21,
              -320,
            );
          }
          return cheer(0, this.t, this.look);
        }
        return drink(local, this.t, this.look);
      }

      case "cheer": {
        const local = this.t - this.mode.start;
        if (local >= CHEER_DURATION) {
          this.mode = { k: "idle", until: this.t + 2.5 };
          return idle(this.t, this.look);
        }
        return cheer(local, this.t, this.look);
      }

      case "drag": {
        const vx = (this.winX - this.dragPrevX) / Math.max(dt, 0.001);
        this.dragPrevX = this.winX;
        const want = Math.max(-0.7, Math.min(0.7, -vx / 900));
        this.dragSwing += (want - this.dragSwing) * Math.min(1, dt * 8);
        return dangle(this.t, this.dragSwing);
      }

      case "fall": {
        this.vy += 2200 * dt;
        this.winY += this.vy * dt;
        const floor = this.dockLine();
        this.winX = this.clampX(this.winX);
        if (this.winY >= floor) {
          this.winY = floor;
          this.vy = 0;
          this.animator.kick("squash", -5.5); // squishy landing
          this.animator.kick("hairSway", 7);
          this.mode = { k: "idle", until: this.t + 2 };
          this.spawn("💨", 0, 8, 22, 0, 0.7, 15);
        }
        this.sendMove(true);
        return falling(this.t);
      }
    }
  }

  /** Map the behaviour mode onto an animation sheet. */
  private animState(): { name: AnimName; elapsed: number; duration?: number } {
    switch (this.mode.k) {
      case "idle":
        return { name: "idle", elapsed: this.t };
      case "walking":
        // Driven by distance travelled, so the feet match the movement speed.
        return { name: "walk", elapsed: this.walkPhase / 7.5 };
      case "remind":
        return {
          name: this.mode.kind === "water" ? "wave" : "eye_rest",
          elapsed: this.t,
        };
      case "drink":
        return { name: "drink", elapsed: this.t - this.mode.start, duration: DRINK_DURATION };
      case "cheer":
        return { name: "cheer", elapsed: this.t - this.mode.start, duration: CHEER_DURATION };
      case "drag":
        return { name: "drag", elapsed: this.t };
      case "fall":
        return { name: "fall", elapsed: this.t };
      case "sleep":
        return { name: "sleep", elapsed: this.t };
      case "focus":
        return { name: "focus", elapsed: this.t };
    }
  }

  /**
   * Eyes follow the pointer only while it is over her own window. The global cursor is
   * never polled - she must not track what the user is doing in other applications.
   */
  private applyGaze(target: Pose): void {
    if (!this.localCursor || target.eyesOpen < 0.5) return;
    const cx = (window.innerWidth || 260) / 2;
    const eyeY = (window.innerHeight || 300) - FOOT_MARGIN - CHAR_PX * 0.82;
    const facing = this.facingRight ? 1 : -1;
    target.lookX = Math.max(-1, Math.min(1, (this.localCursor.x - cx) / 180)) * facing;
    target.lookY = Math.max(-1, Math.min(1, (eyeY - this.localCursor.y) / 180));
  }

  // ---------------------------------------------------------------- particles

  private emit(interval: number, make: () => void): void {
    if (this.t >= this.nextEffect) {
      this.nextEffect = this.t + interval;
      make();
    }
  }

  private spawn(
    text: string,
    x: number,
    y: number,
    vy: number,
    vx: number,
    life: number,
    size: number,
    gravity = 0,
  ): void {
    if (this.quiet) return;
    this.particles.push({ text, x, y, vx, vy, life, maxLife: life, size, gravity });
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    if (this.particles.length) {
      this.particles = this.particles.filter((p) => p.life > 0);
    }
  }

  // ------------------------------------------------------------------- render

  private render(): void {
    const canvas = this.canvas;
    const cssW = window.innerWidth || 200;
    const cssH = window.innerHeight || 260;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    }

    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    if (this.dormant) {
      if (this.t - this.lastHitSent > 0.5) {
        this.lastHitSent = this.t;
        void setHitRect(0, 0, 0, 0);
      }
      return;
    }

    const baseY = cssH - FOOT_MARGIN;
    const scale = CHAR_PX / RIG.height;

    ctx.save();
    ctx.translate(cssW / 2, baseY);
    if (this.sprites) {
      // Artwork path: blit the frame the state machine asks for.
      const { name, elapsed, duration } = this.animState();
      const anim = pickAnim(this.sprites, name);
      const frame = frameIndex(anim, elapsed, duration);
      drawSpriteFrame(ctx, this.sprites, anim, frame, CHAR_PX, this.facingRight);
    } else {
      // Fallback: the procedural rig, so the app is never blank before art lands.
      ctx.scale(scale, -scale); // y up, rig units
      drawHana(ctx, this.animator.pose, { facingRight: this.facingRight, look: this.look });
    }
    ctx.restore();

    // Particles, in rig-relative pixels above her feet.
    if (this.particles.length) {
      ctx.save();
      ctx.translate(cssW / 2, baseY);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const p of this.particles) {
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
        ctx.font = `${p.size}px -apple-system, sans-serif`;
        ctx.fillText(p.text, p.x * scale, -p.y * scale);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // Dev-only: dump the LIVE canvas (not an offline re-render) at a few moments, and
    // drive a reminder so the wave is captured in the running app.
    if (import.meta.env.VITE_HANA_SNAPSHOT && this.shots.length && this.t >= this.shots[0]) {
      const at = this.shots.shift()!;
      if (at === 7) this.triggerReminder("water", "Time for water 💧");
      if (at === 13) this.mode = { k: "walking", to: this.winX + 260 };
      const name = `live-${at}-${this.stateLabel()}`;
      const data = canvas.toDataURL("image/png");
      void backendLog(`snapshot ${name}`);
      invokeSave(name, data);
    }

    // Tell the native side where she actually is, so clicks on the transparent margins
    // fall through to the app underneath.
    if (this.t - this.lastHitSent > 0.25) {
      this.lastHitSent = this.t;
      if (this.dormant) {
        // Nothing to click while parked; let every click through to the app below.
        void setHitRect(0, 0, 0, 0);
      } else {
        // On screen: the whole window accepts clicks, so the header buttons and every
        // panel control are reachable. Partial rects previously left them dead.
        void setHitRect(0, 0, cssW, cssH);
      }
    }
  }

  /** The only channel back into React, and only on change. */
  private publish(): void {
    const label = this.stateLabel();
    if (label !== this.reportedState) {
      this.reportedState = label;
      this.cb.onState(label);
      // One line per transition in the Tauri log: the only way to observe the state
      // machine from outside the app.
      void backendLog(`state=${label} x=${Math.round(this.winX)}`);
    }
    if (this.transientUntil && this.t > this.transientUntil && this.bubble) {
      this.bubble = "";
    }
    this.cb.onBubble(this.quiet ? "" : this.bubble);
  }

  private stateLabel(): CompanionState {
    switch (this.mode.k) {
      case "idle":
        return "idle";
      case "walking":
        return "walking";
      case "remind":
        return this.mode.kind === "water" ? "water_reminder" : "eye_rest";
      case "drink":
        return "drinking";
      case "cheer":
        return "happy";
      case "drag":
        return "dragging";
      case "fall":
        return "falling";
      case "sleep":
        return "sleeping";
      case "focus":
        return "focused";
    }
  }
}

export { neutralPose };
