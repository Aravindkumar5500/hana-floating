/**
 * Target poses for each behaviour. Pure functions of time, exactly as in SipBuddy's
 * `PoseLibrary` - nothing here holds state, so a behaviour can be entered, left and
 * re-entered without any reset bookkeeping.
 *
 * Every function takes the whole `CharacterLook` rather than just a temperament, so it
 * can read that character's MOTION profile (see `motion.ts`) and its body plan. That is
 * what stops all fifteen characters performing the same animation in different colours:
 * timing, amplitude, gait and gesture size are per character, and quadrupeds, robots and
 * humanoids branch to genuinely different poses rather than sharing one biped routine.
 */

import { neutralPose, type Pose } from "./pose";
import { RIG, reachRight } from "./skeleton";
import type { CharacterLook } from "./characters";
import { NEUTRAL_MOTION, motionClock, motionFor, type CharacterMotion } from "./motion";

export type Temperament = CharacterLook["temperament"];

const DEFAULT_TM: Temperament = { smile: 0.42, energy: 1, blinkPeriod: 4.3, blush: 0.28 };

/** Everything a pose needs to know about who is performing it. */
interface Perf {
  tm: Temperament;
  mo: CharacterMotion;
  quad: boolean;
  robot: boolean;
}

function perf(look?: CharacterLook): Perf {
  if (!look) return { tm: DEFAULT_TM, mo: NEUTRAL_MOTION, quad: false, robot: false };
  const mo = motionFor(look.id);
  return {
    tm: look.temperament,
    mo,
    quad: mo.gait === "quadruped" || look.bodyPlan === "dog",
    robot: mo.gait === "mechanical" || look.bodyPlan === "robot",
  };
}

const smoothstep = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

/**
 * Blink schedule. Two blinks close together every third cycle reads as much more alive
 * than a metronome, and a double blink is a real human tic - which is exactly why a
 * robot must not have one.
 */
export function blinking(t: number, period = 4.3, double = true): boolean {
  const cycle = t % period;
  const n = Math.floor(t / period);
  if (cycle < 0.13) return true;
  return double && cycle > 2.1 && cycle < 2.23 && n % 3 === 0;
}

export function idle(t: number, look?: CharacterLook): Pose {
  const { tm, mo, quad, robot } = perf(look);
  const p = neutralPose();
  const e = tm.energy;
  const c = motionClock(t, mo);

  // A machine does not breathe: breathRate 0 collapses the term to nothing rather than
  // needing a special case here.
  const breath = mo.breathRate > 0 ? Math.sin(c * mo.breathRate) : 0;
  p.squash = 1 + mo.breathDepth * e * breath;
  p.lean = mo.swayAmp * e * Math.sin(c * mo.swayRate);
  p.headTilt = mo.tiltAmp * e * Math.sin(c * mo.tiltRate);

  p.armL = mo.armRest - 0.01 + 0.07 * e * breath;
  p.armR = mo.armRest + 0.01 + 0.07 * e * breath;
  p.elbowL = 0.14 + 0.1 * e * breath;
  p.elbowR = 0.14 + 0.1 * e * breath;

  // A robot's "blink" is the visor pulsing, not an eyelid - keep it narrow and regular.
  p.eyesOpen = blinking(c, tm.blinkPeriod, mo.doubleBlink) ? (robot ? 0.35 : 0) : 1;

  p.hairSway = 0.11 * e * mo.secondaryAmp * Math.sin(c * mo.secondaryRate);
  p.skirtSway = 0.09 * e * mo.secondaryAmp * Math.sin(c * mo.secondaryRate * 0.89 + 0.5);
  p.hairPhase = c * 1.5 * (mo.secondaryRate / 0.9 || 1);
  p.smile = tm.smile;
  p.blush = tm.blush;

  // Resting stance: this is what actually separates one standing humanoid from
  // another. Applied before crouch/quadruped so those still win where they apply.
  switch (mo.stance) {
    case "hipHands":
      p.armL = 0.95;
      p.armR = 1.0;
      p.elbowL = 1.95;
      p.elbowR = 1.95;
      p.legL = 0.09;
      p.legR = 0.09;
      break;
    case "armsCrossed":
      // Tighter fold and a much wider base than hands-on-hips, so the outline reads
      // as a broad A rather than the same elbows-out triangle.
      p.armL = 1.02 + 0.03 * e * breath;
      p.armR = 1.1 + 0.03 * e * breath;
      p.elbowL = 2.5;
      p.elbowR = 2.45;
      p.legL = 0.24;
      p.legR = 0.24;
      break;
    case "open":
      p.armL = 0.42;
      p.armR = 0.46;
      p.elbowL = 0.28;
      p.elbowR = 0.3;
      p.legL = 0.07;
      p.legR = 0.07;
      break;
    case "pocket":
      p.armL = 0.04;
      p.elbowL = 0.62;
      p.armR = 0.14 + 0.05 * e * breath;
      p.elbowR = 0.22;
      p.lean += 0.05;
      break;
    case "hipCock":
      p.armR = 0.92;
      p.elbowR = 1.9;
      p.armL = 0.08;
      p.elbowL = 0.16;
      p.lean += 0.07;
      p.legR = 0.12;
      break;
    default:
      break;
  }

  // A ninja rests in a low guard; a dog stands square on four legs.
  if (mo.crouch > 0) {
    p.sit = mo.crouch * 0.42;
    p.kneeL = mo.crouch * 0.7;
    p.kneeR = mo.crouch * 0.7;
  }
  if (quad) {
    // Tail wag is the dog's whole personality and runs faster than anything else.
    p.hairSway = 0.5 * mo.secondaryAmp * Math.sin(c * mo.secondaryRate);
    p.headTilt = mo.tiltAmp * Math.sin(c * mo.tiltRate * 0.7);
  }
  return p;
}

export function walk(phase: number, t: number, look?: CharacterLook): Pose {
  const { mo, quad, robot } = perf(look);
  const p = idle(t, look);
  const c = motionClock(t, mo);
  const s = Math.sin(phase * mo.walkRate);
  const A = mo.strideAmp;

  if (quad) {
    // Four legs in DIAGONAL PAIRS: front-left with back-right. Arms are the front legs.
    p.armL = 0.1 + 0.55 * A * s;
    p.legR = 0.05 + 0.5 * A * s;
    p.armR = 0.1 - 0.55 * A * s;
    p.legL = 0.05 - 0.5 * A * s;
    p.elbowL = 0.25 + 0.3 * Math.max(0, s);
    p.elbowR = 0.25 + 0.3 * Math.max(0, -s);
    p.kneeL = Math.max(0, -s) * 0.55;
    p.kneeR = Math.max(0, s) * 0.55;
    p.lift = Math.abs(s) * 2.2 * mo.bounce;
    p.lean = 0.02;
    p.headTilt = 0.05 + 0.04 * s;
    p.hairSway = 0.6 * mo.secondaryAmp * Math.sin(c * mo.secondaryRate * 1.6);
    p.hairPhase = c * 6;
    return p;
  }

  p.kneeL = Math.max(0, s) * 0.85 * A;
  p.kneeR = Math.max(0, -s) * 0.85 * A;
  p.legL = 0.05 + 0.1 * A * s;
  p.legR = 0.05 - 0.1 * A * s;
  p.lean = 0.055 + (robot ? -0.03 : 0);
  p.lift = Math.abs(s) * 3.5 * mo.bounce;
  // Arms counter-swing against the legs, scaled by how much this character swings.
  p.armL = 0.16 - 0.26 * mo.armSwing * s;
  p.elbowL = 0.4 + 0.22 * Math.max(0, s);
  p.armR = 0.18 + 0.16 * mo.armSwing * s;
  p.elbowR = 0.4 - 0.18 * Math.min(0, s);
  p.headTilt = -0.035 * s;
  p.hairSway = (-0.45 - 0.2 * s) * mo.secondaryAmp;
  p.skirtSway = (-0.3 - 0.25 * s) * mo.secondaryAmp;
  p.hairPhase = c * 5.5;
  p.smile = 0.5;
  if (mo.crouch > 0) {
    // Stealth walk stays low and keeps the arms trailing.
    p.sit = mo.crouch * 0.5;
    p.lean = 0.12;
    p.armL = 0.1 - 0.12 * s;
    p.armR = 0.12 + 0.1 * s;
  }
  return p;
}

/** Waving while a reminder is on screen: one arm up, hand oscillating, small hops. */
export function remind(t: number, look?: CharacterLook): Pose {
  const { mo, quad, robot } = perf(look);
  const p = idle(t, look);
  const c = motionClock(t, mo);
  const G = mo.gestureAmp;
  const cyc = c % (1.5 / mo.gestureRate);
  const hop = 0.42 / mo.gestureRate;

  if (quad) {
    // A dog does not wave: it sits up and paws the air, with the tail going hard.
    p.sit = 0.55;
    p.armR = 1.5 + 0.35 * Math.sin(c * 9 * mo.gestureRate);
    p.elbowR = 0.7 + 0.3 * Math.sin(c * 9 * mo.gestureRate);
    p.armL = 0.9;
    p.elbowL = 0.5;
    p.headTilt = 0.22;
    p.mouthOpen = 0.55;
    p.smile = 0.9;
    p.hairSway = 0.9 * Math.sin(c * mo.secondaryRate * 2.4);
    p.hairPhase = c * 9;
    return p;
  }

  p.lift = cyc < hop ? Math.sin((cyc / hop) * Math.PI) * 22 * mo.bounce : 0;
  p.kneeL = cyc < hop ? 0.45 : 0;
  p.kneeR = cyc < hop ? 0.45 : 0;
  // Near arm waves (it is drawn in front of the body, so it is actually visible).
  const wag = Math.sin(c * 9.5 * mo.gestureRate);
  p.armR = (robot ? 1.7 : 1.95) + 0.14 * G * wag;
  p.elbowR = 0.5 + (robot ? 0.12 : 0.34) * G * wag;
  p.armL = 0.12;
  p.elbowL = 0.2;
  p.brow = 0.55;
  p.smile = robot ? 0.2 : 0.6;
  p.mouthOpen = robot ? 0 : 0.35;
  p.blush = robot ? 0 : 0.5;
  // Hair only reacts to the hops, not to the wave, so the wave reads as a hand.
  p.hairSway = 0.07 * mo.secondaryAmp * Math.sin(c * 4.2);
  p.skirtSway = 0.06 * mo.secondaryAmp * Math.sin(c * 4.0);
  p.hairPhase = c * 3;
  return p;
}

/** Eye-rest reminder: both hands near the face, eyes softly shut, a distinct look. */
export function eyeRest(t: number, look?: CharacterLook): Pose {
  const { mo, quad } = perf(look);
  const p = idle(t, look);
  const c = motionClock(t, mo);
  const pulse = Math.sin(c * 2.2);

  if (quad) {
    // A dog rests by lying down and dropping its head onto its paws.
    p.sit = 0.9;
    p.armL = 0.25;
    p.armR = 0.3;
    p.elbowL = 0.2;
    p.elbowR = 0.2;
    p.eyesOpen = 0.06;
    p.headTilt = -0.25;
    p.smile = 0.3;
    p.hairSway = 0.18 * Math.sin(c * 1.1);
    return p;
  }

  // Hands come right up to the eyes, which is what the pose is supposed to read as.
  p.armL = 1.72 + 0.08 * pulse;
  p.armR = 1.68 - 0.08 * pulse;
  p.elbowL = 1.95;
  p.elbowR = 1.9;
  p.eyesOpen = 0.08 + 0.05 * (pulse * 0.5 + 0.5);
  p.brow = 0.3;
  p.smile = 0.2;
  p.headTilt = 0.12 + 0.03 * pulse;
  p.armL = 1.92 + 0.06 * pulse;
  p.armR = 1.88 - 0.06 * pulse;
  p.elbowL = 2.15;
  p.elbowR = 2.1;
  p.eyesOpen = 0.0;
  p.brow = -0.15;
  p.smile = 0.25;
  p.headTilt = 0.08 + 0.03 * pulse;
  p.blush = 0.35;
  p.lookY = -0.3;
  p.hairPhase = c * 1.2;
  return p;
}

export const DRINK_DURATION = 2.3;

/** Raise the glass with IK, tilt the head back, gulp, then a satisfied "aah". */
export function drink(local: number, t: number, look?: CharacterLook): Pose {
  const { quad } = perf(look);
  const p = idle(t, look);
  const raise = smoothstep(local / 0.45);
  const lower = smoothstep((local - 1.75) / 0.4);
  const up = raise * (1 - lower);

  if (quad) {
    // Lapping from a bowl: head goes down, not a cup up.
    p.sit = 0.35 + 0.1 * up;
    p.headTilt = -0.75 * up;
    p.lookY = -0.6 * up;
    p.mouthOpen = up * (0.5 + 0.3 * Math.sin(local * 18));
    p.eyesOpen = up > 0.6 ? 0.25 : 1;
    p.smile = 0.5;
    p.hairSway = 0.7 * Math.sin(t * 5);
    return p;
  }

  const toMouth = reachRight({ x: RIG.mouth.x + 5, y: RIG.mouth.y - 10 });
  p.armR = 0.16 + (toMouth.shoulder - 0.16) * up;
  p.elbowR = 0.22 + (toMouth.elbow - 0.22) * up;
  p.cupTilt = up * 0.95;
  p.headTilt = -0.22 * up;
  p.eyesOpen = up > 0.6 ? 0 : 1;
  p.smile = up > 0.6 ? 0.2 : 0.5;
  p.blush = 0.3 + 0.3 * up;
  if (local > 0.5 && local < 1.75) p.squash = 1 + 0.013 * Math.sin(local * 13);
  if (local > 1.75) {
    p.mouthOpen = 0.4;
    p.smile = 0.95;
    p.eyesOpen = 0;
  }
  return p;
}

export const CHEER_DURATION = 1.35;

/** Anticipation crouch -> jump with both arms up -> landed victory pose. */
export function cheer(local: number, t: number, look?: CharacterLook): Pose {
  const { mo, quad, robot } = perf(look);
  const p = idle(t, look);
  const c = motionClock(t, mo);
  const G = mo.gestureAmp;
  p.smile = robot ? 0.3 : 0.95;
  p.eyesOpen = robot ? 0.5 : 0.15;
  p.mouthOpen = robot ? 0 : 0.5;
  p.blush = robot ? 0 : 0.7;
  p.hairPhase = c * 6.5;

  if (quad) {
    // Play bow, then a four-legged bounce. Never a biped jump with raised arms.
    if (local < 0.3) {
      p.sit = 0.75;            // front down, rear up
      p.armL = 0.9;
      p.armR = 0.95;
      p.elbowL = 1.3;
      p.elbowR = 1.3;
      p.headTilt = -0.3;
    } else {
      const j = (local - 0.3) / 0.7;
      p.lift = Math.sin(j * Math.PI) * 34 * mo.bounce;
      p.armL = 0.75;
      p.armR = 0.8;
      p.elbowL = 0.9;
      p.elbowR = 0.9;
      p.legL = 0.3;
      p.legR = 0.35;
      p.headTilt = 0.3;
    }
    p.mouthOpen = 0.6;
    p.hairSway = 1.1 * Math.sin(c * 14);
    return p;
  }

  if (local < 0.24) {
    p.squash = 0.93;
    p.kneeL = 0.5;
    p.kneeR = 0.5;
    p.armL = 0.5;
    p.armR = 0.55;
    p.elbowL = 0.8;
    p.elbowR = 0.85;
    p.hairSway = 0.3 * mo.secondaryAmp;
    p.skirtSway = 0.25 * mo.secondaryAmp;
  } else if (local < 0.82) {
    const j = (local - 0.24) / 0.58;
    // Robots do not leave the ground; they raise both arms squarely instead.
    p.lift = (robot ? 0 : Math.sin(j * Math.PI) * 48) * mo.bounce;
    // Controlled lift so character stays within the window bounds without clipping at the top.
    p.lift = (robot ? 0 : Math.sin(j * Math.PI) * 26) * mo.bounce;
    p.squash = 1.035;
    p.armL = (2.45 + 0.1 * Math.sin(c * 15)) * (robot ? 0.86 : 1) * (0.84 + 0.16 * G);
    p.armR = (2.45 + 0.1 * Math.sin(c * 15 + 1)) * (robot ? 0.86 : 1) * (0.84 + 0.16 * G);
    p.elbowL = robot ? 0.04 : 0.15;
    p.elbowR = robot ? 0.04 : 0.15;
    p.kneeL = robot ? 0 : 0.65;
    p.kneeR = robot ? 0 : 0.3;
    p.hairSway = (-0.5 + 1.1 * j) * mo.secondaryAmp;
    p.skirtSway = (-0.4 + 0.9 * j) * mo.secondaryAmp;
  } else {
    p.armL = 2.3;
    p.armR = 2.3;
    p.elbowL = 0.3;
    p.elbowR = 0.3;
    p.hairSway = 0.15 * mo.secondaryAmp;
  }
  return p;
}

/** Quiet focus mode: calm, settled, eyes down. Deliberately almost motionless. */
export function focused(t: number, look?: CharacterLook): Pose {
  const { mo, quad } = perf(look);
  const p = idle(t, look);
  const c = motionClock(t, mo);
  p.smile = 0.2;
  p.brow = -0.25;
  p.lookY = -0.35;
  p.lookX = 0.05;
  p.armL = 0.1;
  p.armR = 0.12;
  p.elbowL = 0.15;
  p.elbowR = 0.15;
  p.headTilt = 0.06 + 0.02 * Math.sin(c * 0.5);
  p.blush = 0.18;
  if (quad) {
    p.sit = 0.8;
    p.headTilt = 0.1;
    p.hairSway = 0.2 * Math.sin(c * 1.4);
  }
  return p;
}

/** Sleeping: settles down, head drooping. Still breathing - never frozen. */
export function sleep(t: number, look?: CharacterLook): Pose {
  const { mo, quad, robot } = perf(look);
  const p = neutralPose();
  const c = motionClock(t, mo);
  const rate = mo.breathRate > 0 ? mo.breathRate * 0.6 : 0.5;

  if (quad) {
    // Curled up nose-to-tail, not sitting upright like a person.
    p.sit = 1;
    p.eyesOpen = 0;
    p.headTilt = -0.55 + 0.04 * Math.sin(c * rate);
    p.squash = 1 + 0.022 * Math.sin(c * rate);
    p.armL = 0.15;
    p.armR = 0.18;
    p.elbowL = 1.5;
    p.elbowR = 1.5;
    p.legL = 0.9;
    p.legR = 0.95;
    p.kneeL = 1.4;
    p.kneeR = 1.4;
    p.smile = 0.3;
    p.hairSway = 0.25 * Math.sin(c * 0.5);
    p.hairPhase = c * 0.5;
    return p;
  }

  p.sit = 1;
  p.eyesOpen = 0;
  p.smile = robot ? 0 : 0.18;
  p.headTilt = 0.3 + 0.045 * Math.sin(c * rate);
  // A powered-down robot is perfectly still apart from a slow status pulse.
  p.squash = robot ? 1 : 1 + 0.015 * Math.sin(c * rate);
  p.armL = 0.3;
  p.armR = 0.34;
  p.elbowL = 0.95;
  p.elbowR = 1.0;
  p.legL = 0.3;
  p.legR = 0.34;
  p.blush = robot ? 0 : 0.3;
  p.hairSway = 0.07 * mo.secondaryAmp * Math.sin(c * 0.7);
  p.hairPhase = c * 0.7;
  return p;
}

/** Held by the scruff and dragged: limbs dangle and swing with the motion. */
export function dangle(t: number, swing: number, look?: CharacterLook): Pose {
  const { mo } = perf(look);
  const { mo, quad } = perf(look);
  const p = neutralPose();

  if (quad) {
    // Quadruped scruff dangle: all four paws hang down naturally together.
    p.sit = 0.55;
    p.armL = 0.35 + 0.08 * Math.sin(t * 8);
    p.armR = 0.38 - 0.08 * Math.sin(t * 8);
    p.elbowL = 0.45;
    p.elbowR = 0.45;
    p.legL = 0.42 + 0.1 * Math.sin(t * 8 + 1);
    p.legR = 0.45 - 0.1 * Math.sin(t * 8 + 1);
    p.kneeL = 0.35;
    p.kneeR = 0.35;
    p.headTilt = -0.15;
    p.eyesOpen = 1.1;
    p.mouthOpen = 0.45;
    p.hairSway = (-swing * 1.2) * mo.secondaryAmp;
    return p;
  }

  p.armL = 2.25 + 0.3 * Math.sin(t * 12);
  p.armR = 2.25 + 0.3 * Math.sin(t * 12 + 2);
  p.elbowL = 0.4 + 0.3 * Math.sin(t * 8.5);
  p.elbowR = 0.4 + 0.3 * Math.sin(t * 8.5 + 1);
  p.legL = 0.09 + 0.13 * Math.sin(t * 7.5) + swing;
  p.legR = 0.09 - 0.13 * Math.sin(t * 7.5) - swing;
  p.kneeL = 0.3 + 0.3 * Math.sin(t * 7.5);
  p.kneeR = 0.3 - 0.3 * Math.sin(t * 7.5);
  p.lean = -swing * 0.6;
  p.eyesOpen = 1.15;
  p.brow = 1;
  p.smile = -0.15;
  p.mouthOpen = 0.6;
  p.blush = 0.55;
  p.hairSway = (-swing * 1.6 + 0.3 * Math.sin(t * 9)) * mo.secondaryAmp;
  p.skirtSway = (-swing * 1.3 + 0.25 * Math.sin(t * 8)) * mo.secondaryAmp;
  p.hairPhase = t * 8;
  return p;
}

export function falling(t: number, look?: CharacterLook): Pose {
  const p = dangle(t, 0, look);
  p.legL = 0.06;
  p.legR = 0.06;
  p.kneeL = 0.2;
  p.kneeR = 0.2;
  return p;
}
