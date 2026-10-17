/**
 * Hana's skeleton.
 *
 * Chibi proportions: the head is roughly 40% of total height, which is what makes a
 * desktop pet read as *cute* rather than as a small adult. The previous values used
 * realistic 1/5 proportions borrowed from the reference rig's superhero figure, and the
 * result looked lanky and awkward at 150px tall.
 *
 * Coordinates: feet on y = 0, y pointing UP, facing right. Every path in draw.ts must
 * respect that — "+y is up" — which is where the earlier rendering went wrong.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export const RIG = {
  height: 200,
  /** Head centre and radius. Crown is head.y + headR, chin is head.y - headR. */
  head: { x: 0, y: 150 } as Vec2,
  headR: 40,
  /** Mouth sits low on the face, anime style. */
  mouth: { x: 3, y: 134 } as Vec2,
  shoulder: { x: 0, y: 102 } as Vec2,
  upperArm: 25,
  foreArm: 23,
  hip: { x: 0, y: 68 } as Vec2,
  thigh: 35,
  shin: 33,
  limbW: 8,
} as const;

/**
 * Two-bone IK: the shoulder and elbow angles that put the right hand at `target`.
 *
 * Arm convention matches the pose model: 0 = hanging straight down, + = rotated
 * outward; elbow + = forearm folds inward/up.
 */
export function reachRight(target: Vec2, drop = 0): { shoulder: number; elbow: number } {
  const s = { x: RIG.shoulder.x, y: RIG.shoulder.y - drop };
  const vx = target.x - s.x;
  const vy = target.y - s.y;
  const reach = RIG.upperArm + RIG.foreArm - 0.5;
  const d = Math.min(reach, Math.max(8, Math.hypot(vx, vy)));
  const phi = Math.atan2(vx, -vy);
  const clamp1 = (v: number) => Math.min(1, Math.max(-1, v));
  const alpha = Math.acos(
    clamp1(
      (RIG.upperArm * RIG.upperArm + d * d - RIG.foreArm * RIG.foreArm) / (2 * RIG.upperArm * d),
    ),
  );
  const inner = Math.acos(
    clamp1(
      (RIG.upperArm * RIG.upperArm + RIG.foreArm * RIG.foreArm - d * d) /
        (2 * RIG.upperArm * RIG.foreArm),
    ),
  );
  return { shoulder: phi + alpha, elbow: Math.PI - inner };
}

/** Forward kinematics for a two-bone limb. Returns the joint and the end effector. */
export function solveLimb(
  origin: Vec2,
  rootAngle: number,
  rootLen: number,
  jointAngle: number,
  tipLen: number,
): { joint: Vec2; tip: Vec2; tipAngle: number } {
  const joint = {
    x: origin.x + rootLen * Math.sin(rootAngle),
    y: origin.y - rootLen * Math.cos(rootAngle),
  };
  const tipAngle = rootAngle - jointAngle;
  const tip = {
    x: joint.x + tipLen * Math.sin(tipAngle),
    y: joint.y - tipLen * Math.cos(tipAngle),
  };
  return { joint, tip, tipAngle };
}
