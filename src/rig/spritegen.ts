/**
 * Dev tool: generate PLACEHOLDER sprite sheets from the procedural rig.
 *
 * These are not the final artwork — they exist so the sprite pipeline (manifest →
 * strips → loader → engine) is real and testable today. Commissioned art drops into the
 * same files and the app picks it up with no code change. See ASSETS.md.
 *
 * Run with:  VITE_HANA_SPRITEGEN=1 npm run tauri build -- --debug --bundles app
 * then launch the app once; strips are written to $TMPDIR/hana-frames/.
 */

import { invoke } from "@tauri-apps/api/core";
import { PoseAnimator, type Pose } from "./pose";
import { RIG } from "./skeleton";
import { drawHana } from "./draw";
import { CHARACTERS, type CharacterLook } from "./characters";
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

/** Frame geometry — must match the numbers in ASSETS.md and the generated manifest. */
export const FRAME = {
  width: 512,
  height: 512,
  /** Ground line: where the soles sit inside the frame. */
  baseline: 486,
  /** Character height inside the frame, used by the engine to scale to screen size. */
  characterHeight: 430,
} as const;

interface AnimDef {
  name: string;
  frames: number;
  loop: boolean;
  /** Target pose at simulation time `t` (seconds from the animation's start). */
  pose: (t: number, look: CharacterLook) => Pose;
  /** Fixed length; defaults to frames/fps. */
  duration?: number;
}

const ANIMS: AnimDef[] = [
  { name: "idle", frames: 16, loop: true, pose: (t, l) => idle(t, l), duration: 3.3 },
  {
    name: "walk",
    frames: 8,
    loop: true,
    // One full stride across the strip, so looping is seamless.
    pose: (t, l) => walk((t / 0.667) * Math.PI * 2, t, l),
    duration: 0.667,
  },
  { name: "wave", frames: 6, loop: true, pose: (t, l) => remind(t, l), duration: 1.5 },
  { name: "eye_rest", frames: 4, loop: true, pose: (t, l) => eyeRest(t, l), duration: 2.8 },
  {
    name: "drink",
    frames: 8,
    loop: false,
    pose: (t, l) => drink(t, t, l),
    duration: DRINK_DURATION,
  },
  {
    name: "cheer",
    frames: 6,
    loop: false,
    pose: (t, l) => cheer(t, t, l),
    duration: CHEER_DURATION,
  },
  { name: "sleep", frames: 4, loop: true, pose: (t, l) => sleep(t, l), duration: 5.4 },
  { name: "drag", frames: 4, loop: true, pose: (t, l) => dangle(t, 0, l), duration: 0.8 },
  { name: "fall", frames: 2, loop: true, pose: (t, l) => falling(t, l), duration: 0.5 },
  { name: "focus", frames: 4, loop: true, pose: (t, tm) => focused(t, tm), duration: 4 },
];

/** Render one animation as a horizontal strip and return it as a PNG data URL. */
function renderStrip(look: CharacterLook, def: AnimDef): string {
  const duration = def.duration ?? def.frames / 12;
  const canvas = document.createElement("canvas");
  canvas.width = FRAME.width * def.frames;
  canvas.height = FRAME.height;
  const ctx = canvas.getContext("2d")!;

  const anim = new PoseAnimator();
  const step = 1 / 120;
  // Pre-roll so the springs are settled before the first frame is captured.
  for (let i = 0; i < 240; i++) anim.update(def.pose(0, look), step);

  const scale = FRAME.characterHeight / RIG.height;
  let captured = 0;
  let t = 0;
  while (captured < def.frames) {
    const target = (captured / def.frames) * duration;
    // Advance the simulation up to this frame's time, keeping the spring lag.
    while (t < target - 1e-6) {
      t = Math.min(target, t + step);
      anim.update(def.pose(t, look), step);
    }
    ctx.save();
    ctx.translate(captured * FRAME.width + FRAME.width / 2, FRAME.baseline);
    ctx.scale(scale, -scale);
    drawHana(ctx, anim.pose, { facingRight: true, look });
    ctx.restore();
    captured++;
  }
  return canvas.toDataURL("image/png");
}

export async function generateSpriteSheets(): Promise<void> {
  for (const look of CHARACTERS) {
    const manifest = {
      name: look.name,
      frameWidth: FRAME.width,
      frameHeight: FRAME.height,
      baseline: FRAME.baseline,
      characterHeight: FRAME.characterHeight,
      animations: {} as Record<string, unknown>,
    };

    for (const def of ANIMS) {
      const data = renderStrip(look, def);
      const duration = def.duration ?? def.frames / 12;
      manifest.animations[def.name] = {
        file: `${def.name}.png`,
        frames: def.frames,
        // Derived, never hand-picked: playing at this rate reproduces exactly the
        // motion the frames were sampled from.
        fps: Number((def.frames / duration).toFixed(3)),
        loop: def.loop,
      };
      await invoke("save_text", { name: `sprite-${look.id}-${def.name}`, contents: data }).catch(
        () => {},
      );
    }

    await invoke("save_text", {
      name: `manifest-${look.id}`,
      contents: JSON.stringify(manifest, null, 2),
    }).catch(() => {});
  }
  await invoke("hana_log", { msg: "spritegen: done" }).catch(() => {});
}
