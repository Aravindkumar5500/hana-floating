/**
 * Sprite-sheet renderer.
 *
 * This replaces the procedural rig as the primary way Hana is drawn. The behaviour layer
 * (state machine, walking, reminders, window movement) is untouched: it still decides
 * *what* she is doing, and this module decides which frame of which sheet to blit.
 *
 * Assets live in `public/characters/<id>/` and are plain files, so commissioned artwork
 * can be dropped in without touching code. See ASSETS.md for the commission spec.
 *
 * If a character has no sheets (or they fail to load) the engine falls back to the
 * procedural rig, so the app is never blank.
 */

import { backendLog } from "../lib/bridge";

/** Animation names the engine can ask for. `idle` is required; the rest fall back to it. */
export type AnimName =
  | "idle"
  | "walk"
  | "wave"
  | "eye_rest"
  | "drink"
  | "cheer"
  | "sleep"
  | "drag"
  | "fall"
  | "focus";

interface AnimSpec {
  file: string;
  frames: number;
  fps: number;
  loop: boolean;
}

interface Manifest {
  name: string;
  /** Size of one frame inside the horizontal strip. */
  frameWidth: number;
  frameHeight: number;
  /** Distance from the top of the frame to the ground line the feet rest on. */
  baseline: number;
  /** Height of the character within the frame, used to scale to the on-screen size. */
  characterHeight: number;
  animations: Partial<Record<AnimName, AnimSpec>>;
}

interface LoadedAnim extends AnimSpec {
  image: HTMLImageElement;
}

export interface SpriteSet {
  id: string;
  frameWidth: number;
  frameHeight: number;
  baseline: number;
  characterHeight: number;
  anims: Partial<Record<AnimName, LoadedAnim>>;
}

const cache = new Map<string, SpriteSet | null>();
const inFlight = new Map<string, Promise<SpriteSet | null>>();

const FALLBACK_MANIFESTS: Record<string, Manifest> = {
  luffy: {
    name: "Luffy",
    frameWidth: 512,
    frameHeight: 512,
    baseline: 486,
    characterHeight: 430,
    animations: {
      idle: { file: "idle.png", frames: 16, fps: 4.85, loop: true },
      walk: { file: "walk.png", frames: 8, fps: 12, loop: true },
      wave: { file: "wave.png", frames: 6, fps: 4, loop: true },
      cheer: { file: "cheer.png", frames: 6, fps: 4.44, loop: false },
      sleep: { file: "sleep.png", frames: 4, fps: 0.74, loop: true },
    },
  },
  zoro: {
    name: "Zoro",
    frameWidth: 512,
    frameHeight: 512,
    baseline: 486,
    characterHeight: 430,
    animations: {
      idle: { file: "idle.png", frames: 16, fps: 4.85, loop: true },
      walk: { file: "walk.png", frames: 8, fps: 12, loop: true },
      wave: { file: "wave.png", frames: 6, fps: 4, loop: true },
      cheer: { file: "cheer.png", frames: 6, fps: 4.44, loop: false },
      sleep: { file: "sleep.png", frames: 4, fps: 0.74, loop: true },
    },
  },
  sanji: {
    name: "Sanji",
    frameWidth: 512,
    frameHeight: 512,
    baseline: 486,
    characterHeight: 430,
    animations: {
      idle: { file: "idle.png", frames: 16, fps: 4.85, loop: true },
      walk: { file: "walk.png", frames: 8, fps: 12, loop: true },
      wave: { file: "wave.png", frames: 6, fps: 4, loop: true },
      cheer: { file: "cheer.png", frames: 6, fps: 4.44, loop: false },
      sleep: { file: "sleep.png", frames: 4, fps: 0.74, loop: true },
    },
  },
  nami: {
    name: "Nami",
    frameWidth: 512,
    frameHeight: 512,
    baseline: 486,
    characterHeight: 430,
    animations: {
      idle: { file: "idle.png", frames: 16, fps: 4.85, loop: true },
      walk: { file: "walk.png", frames: 8, fps: 12, loop: true },
      wave: { file: "wave.png", frames: 6, fps: 4, loop: true },
      cheer: { file: "cheer.png", frames: 6, fps: 4.44, loop: false },
      sleep: { file: "sleep.png", frames: 4, fps: 0.74, loop: true },
    },
  },
  chopper: {
    name: "Chopper",
    frameWidth: 512,
    frameHeight: 512,
    baseline: 486,
    characterHeight: 430,
    animations: {
      idle: { file: "idle.png", frames: 16, fps: 4.85, loop: true },
      walk: { file: "walk.png", frames: 8, fps: 12, loop: true },
      wave: { file: "wave.png", frames: 6, fps: 4, loop: true },
      cheer: { file: "cheer.png", frames: 6, fps: 4.44, loop: false },
      sleep: { file: "sleep.png", frames: 4, fps: 0.74, loop: true },
    },
  },
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image failed: ${src}`));
    img.src = src;
  });
}


/* ----------------------------------------------------------------- validation --- */

/**
 * Structural validation of a loaded sheet.
 *
 * A manifest is a claim, not a guarantee. This project shipped sheets that were
 * geometrically perfect by their manifest and still rendered the character UPSIDE DOWN
 * with the head floating clear of the torso, because nothing ever looked at the pixels.
 * A bad sheet is worse than no sheet: with no sheet the rig draws a correct character,
 * so anything failing here is REJECTED and the caller falls back to the rig.
 *
 * Checks run on the first frame of each animation - enough to catch a broken export,
 * cheap enough to run at load.
 */
interface FrameReport {
  ok: boolean;
  reason?: string;
}

function checkFrame(ctx: CanvasRenderingContext2D, m: Manifest, anim: string): FrameReport {
  const { frameWidth: W, frameHeight: H, baseline, characterHeight } = m;
  let data: ImageData;
  try {
    data = ctx.getImageData(0, 0, W, H);
  } catch {
    return { ok: true }; // tainted canvas: cannot inspect, do not block
  }
  const a = data.data;
  const solid = (x: number, y: number) => a[(y * W + x) * 4 + 3] > 8;

  let minX = W, maxX = -1, minY = H, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (solid(x, y)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxY < 0) return { ok: false, reason: `${anim}: frame is empty` };

  const h = maxY - minY + 1;
  const soles = maxY + 1;
  const centre = (minX + maxX) / 2;

  // Feet must sit on the declared ground line, or the character floats and slides.
  if (Math.abs(soles - baseline) > 12) {
    return { ok: false, reason: `${anim}: soles at y=${soles}, manifest baseline ${baseline}` };
  }
  if (Math.abs(h - characterHeight) > characterHeight * 0.25) {
    return { ok: false, reason: `${anim}: content ${h}px tall, manifest says ${characterHeight}` };
  }
  if (Math.abs(centre - W / 2) > W * 0.12) {
    return { ok: false, reason: `${anim}: centred on x=${centre.toFixed(0)}, expected ${W / 2}` };
  }

  // DETACHED HEAD: check for vertical disconnects between top of head and feet.
  // An intact character has pixels on every horizontal row from head to soles;
  // scanning minX to maxX properly supports wider stances without false positives.
  let runs = 0;
  let inRun = false;
  let gap = 0;
  for (let y = minY; y <= maxY; y++) {
    let any = false;
    for (let x = minX; x <= maxX; x++) {
      if (solid(x, y)) { any = true; break; }
    }
    if (any && !inRun) { runs++; inRun = true; }
    if (!any) { inRun = false; gap++; }
  }
  // A pixel or two of antialiasing gap is not a detached head.
  if (runs > 1 && gap > 3) {
    return { ok: false, reason: `${anim}: body is in ${runs} disconnected pieces (detached head?)` };
  }
  return { ok: true };
}

function validate(m: Manifest, anims: Partial<Record<AnimName, LoadedAnim>>): FrameReport {
  const canvas = document.createElement("canvas");
  canvas.width = m.frameWidth;
  canvas.height = m.frameHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { ok: true };

  for (const [name, anim] of Object.entries(anims) as Array<[AnimName, LoadedAnim]>) {
    // The strip must hold the number of frames the manifest promises, or frameIndex()
    // slices past the end and blits blank or half frames.
    const expected = m.frameWidth * anim.frames;
    if (anim.image.naturalWidth !== expected || anim.image.naturalHeight !== m.frameHeight) {
      return {
        ok: false,
        reason:
          `${name}: strip is ${anim.image.naturalWidth}x${anim.image.naturalHeight}, ` +
          `manifest implies ${expected}x${m.frameHeight}`,
      };
    }
    ctx.clearRect(0, 0, m.frameWidth, m.frameHeight);
    ctx.drawImage(anim.image, 0, 0, m.frameWidth, m.frameHeight, 0, 0, m.frameWidth, m.frameHeight);
    const r = checkFrame(ctx, m, name);
    if (!r.ok) return r;
  }
  return { ok: true };
}

/**
 * Load a character's sheets. Returns null when the character has no artwork yet, which
 * the caller treats as "use the procedural rig".
 */
export function loadSprites(id: string): Promise<SpriteSet | null> {
  const hit = cache.get(id);
  if (hit !== undefined) return Promise.resolve(hit);

  const pending = inFlight.get(id);
  if (pending) return pending;

  const loadPromise = (async (): Promise<SpriteSet | null> => {
    try {
      let m: Manifest | null = null;
      const basePathCandidates = [`/characters/${id}`, `characters/${id}`];
      let workingBase = basePathCandidates[0];

      for (const base of basePathCandidates) {
        try {
          const res = await fetch(`${base}/manifest.json`);
          if (res.ok) {
            m = (await res.json()) as Manifest;
            workingBase = base;
            break;
          }
        } catch {
          /* try next */
        }
      }

      if (!m && FALLBACK_MANIFESTS[id]) {
        m = FALLBACK_MANIFESTS[id];
      }

      let set: SpriteSet | null = null;
      if (m) {
        try {
          const anims: Partial<Record<AnimName, LoadedAnim>> = {};
          const entries = Object.entries(m.animations) as Array<[AnimName, AnimSpec]>;
          await Promise.all(
            entries.map(async ([name, spec]) => {
              for (const base of [workingBase, ...basePathCandidates]) {
                try {
                  const image = await loadImage(`${base}/${spec.file}`);
                  anims[name] = { ...spec, image };
                  break;
                } catch {
                  /* try next base candidate */
                }
              }
            }),
          );

          if (anims.idle) {
            const verdict = validate(m, anims);
            if (!verdict.ok) {
              const msg = `sprites: rejected "${id}" - ${verdict.reason}`;
              console.warn(msg);
              void backendLog(msg);
              cache.set(id, null);
              return null;
            }
            set = {
              id,
              frameWidth: m.frameWidth,
              frameHeight: m.frameHeight,
              baseline: m.baseline,
              characterHeight: m.characterHeight,
              anims,
            };
          }
        } catch {
          set = null;
        }
      }

      cache.set(id, set);
      return set;
    } finally {
      inFlight.delete(id);
    }
  })();

  inFlight.set(id, loadPromise);
  return loadPromise;
}

/** Resolve an animation, falling back to idle when a character lacks that sheet. */
export function pickAnim(set: SpriteSet, name: AnimName): LoadedAnim {
  return set.anims[name] ?? set.anims.idle!;
}

/**
 * Which frame to show.
 *
 * `elapsed` is seconds since the animation started. A one-shot animation whose length
 * the behaviour layer already fixes (drink, cheer) passes `duration` so the sheet is
 * stretched to exactly that long and the art stays in sync with the state machine.
 */
export function frameIndex(anim: LoadedAnim, elapsed: number, duration?: number): number {
  if (anim.frames <= 1) return 0;
  if (duration && duration > 0) {
    const t = Math.min(0.9999, Math.max(0, elapsed / duration));
    return Math.floor(t * anim.frames);
  }
  const i = Math.floor(elapsed * anim.fps);
  return anim.loop ? ((i % anim.frames) + anim.frames) % anim.frames : Math.min(i, anim.frames - 1);
}

/**
 * Blit one frame. The canvas transform must be in CSS pixels with y pointing DOWN and
 * the origin at the character's ground point (centre of the feet).
 */
export function drawSpriteFrame(
  ctx: CanvasRenderingContext2D,
  set: SpriteSet,
  anim: LoadedAnim,
  frame: number,
  charPx: number,
  facingRight: boolean,
): void {
  const scale = charPx / set.characterHeight;
  const w = set.frameWidth * scale;
  const h = set.frameHeight * scale;
  ctx.save();
  if (!facingRight) ctx.scale(-1, 1);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    anim.image,
    frame * set.frameWidth,
    0,
    set.frameWidth,
    set.frameHeight,
    -w / 2,
    -set.baseline * scale,
    w,
    h,
  );
  ctx.restore();
}
