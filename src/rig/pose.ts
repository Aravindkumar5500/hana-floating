/**
 * The articulated rig's pose model and spring animator.
 *
 * Architecture ported from SipBuddy's `HeroRig.swift` (`Pose` + `PoseAnimator`), applied
 * to an original anime-girl figure rather than its superhero proportions:
 *
 *   * A pose is a flat record of *continuous* joint values, so any two poses can be
 *     blended or sprung between. Nothing is a discrete frame.
 *   * Every joint is a damped spring with its own stiffness and damping. The behaviour
 *     layer only ever sets a *target* pose; the spring decides how the body gets there,
 *     which is what gives motion weight, overshoot and follow-through.
 *   * The integrator substeps at 120 Hz so a dropped frame cannot make a stiff spring
 *     explode.
 */

export interface Pose {
  /** Whole body off the ground (hops, jumps). */
  lift: number;
  /** <1 squashed, >1 stretched. */
  squash: number;
  /** Body rotation around the feet, radians. */
  lean: number;
  headTilt: number;
  /** Shoulder: 0 = hanging, + = raised outward. */
  armL: number;
  armR: number;
  /** + = forearm folds inward/up. */
  elbowL: number;
  elbowR: number;
  /** Hip: + = outward. */
  legL: number;
  legR: number;
  /** + = knee bent, foot lifts. */
  kneeL: number;
  kneeR: number;
  /** 0 standing … 1 sitting. */
  sit: number;
  eyesOpen: number;
  /** −1 … 1, + = toward the facing direction. */
  lookX: number;
  lookY: number;
  /** −1 frown … 1 big smile. */
  smile: number;
  mouthOpen: number;
  /** −1 determined … 1 raised. */
  brow: number;
  blush: number;
  /** Twin-tail / bang secondary motion, driven by body movement. */
  hairSway: number;
  skirtSway: number;
  /** Water glass in the right hand: 0 absent … 1 raised and tilted. */
  cupTilt: number;
  /** Not sprung: a continuously advancing phase for hair/cloth wobble. */
  hairPhase: number;
}

export function neutralPose(): Pose {
  return {
    lift: 0,
    squash: 1,
    lean: 0,
    headTilt: 0,
    armL: 0.09,
    armR: 0.11,
    elbowL: 0.14,
    elbowR: 0.14,
    legL: 0.05,
    legR: 0.05,
    kneeL: 0,
    kneeR: 0,
    sit: 0,
    eyesOpen: 1,
    lookX: 0.15,
    lookY: 0,
    smile: 0.4,
    mouthOpen: 0,
    brow: 0,
    blush: 0.25,
    hairSway: 0,
    skirtSway: 0,
    cupTilt: 0,
    hairPhase: 0,
  };
}

type SprungKey = Exclude<keyof Pose, "hairPhase">;

/** [joint, stiffness, damping ratio] — tuned per joint, as in the reference rig. */
export const SPRUNG: ReadonlyArray<readonly [SprungKey, number, number]> = [
  ["lift", 220, 0.75],
  ["squash", 320, 0.4],
  ["lean", 140, 0.6],
  ["headTilt", 120, 0.55],
  ["armL", 170, 0.62],
  ["armR", 170, 0.66],
  ["elbowL", 170, 0.66],
  ["elbowR", 170, 0.7],
  ["legL", 200, 0.75],
  ["legR", 200, 0.75],
  ["kneeL", 240, 0.8],
  ["kneeR", 240, 0.8],
  ["sit", 60, 0.9],
  ["eyesOpen", 1400, 1],
  ["lookX", 55, 0.9],
  ["lookY", 55, 0.9],
  ["smile", 90, 0.9],
  ["mouthOpen", 160, 0.8],
  ["brow", 90, 0.9],
  ["blush", 40, 0.9],
  // Hair and skirt are deliberately floppy: low stiffness, low damping, so they lag
  // behind the body and keep moving after it stops. This is the secondary motion.
  ["hairSway", 55, 0.32],
  ["skirtSway", 70, 0.38],
  ["cupTilt", 120, 0.7],
] as const;

/** Springs the displayed pose toward a target pose. */
export class PoseAnimator {
  readonly pose: Pose = neutralPose();
  private readonly velocity: Record<string, number> = {};

  constructor() {
    for (const [key] of SPRUNG) this.velocity[key] = 0;
  }

  update(target: Pose, dt: number): void {
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      for (const [key, k, zeta] of SPRUNG) {
        const x = this.pose[key];
        const v = this.velocity[key];
        const a = k * (target[key] - x) - 2 * zeta * Math.sqrt(k) * v;
        const nv = v + a * h;
        this.velocity[key] = nv;
        this.pose[key] = x + nv * h;
      }
    }
    // Phase advances directly; springing a sawtooth would fight itself.
    this.pose.hairPhase = target.hairPhase;
  }

  /** Inject a sudden velocity, e.g. the squash on landing. */
  kick(key: SprungKey, amount: number): void {
    this.velocity[key] += amount;
  }
}
