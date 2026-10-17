/**
 * Per-character MOTION profiles.
 *
 * The rig used to drive every character from one set of hard-coded constants - the same
 * 1.9 Hz breathing, the same sway frequency, the same stride - scaled only by a single
 * `energy` number. The result was fifteen recoloured copies of one performance.
 *
 * A profile here owns *timing, amplitude and style*; `characters.ts` still owns look
 * (palette, features) and `temperament` (smile/blush/blink period). Keeping them apart
 * means no character entry had to change, and a character with no profile falls back to
 * a neutral one rather than breaking.
 */

/**
 * Resting STANCE. Scale alone does not separate characters: four slim humanoids with
 * their arms down measured 0.92-0.94 silhouette overlap even at different heights,
 * because normalising for size leaves the same shape. A stance changes the outline.
 */
export type Stance =
  | "neutral"
  /** Hands on hips - confident, taking up space. */
  | "hipHands"
  /** Forearms folded across the chest - closed, heavy. */
  | "armsCrossed"
  /** One hand pocketed, the other loose - unhurried. */
  | "pocket"
  /** Weight on one leg, one hand on that hip - brisk, impatient. */
  | "hipCock"
  /** Arms held a little away from the body - open, welcoming. */
  | "open";

export type Gait =
  /** Two legs, arms swing in opposition. */
  | "biped"
  /** Four legs moving in diagonal pairs. */
  | "quadruped"
  /** Stepped, servo-like: holds a pose then snaps to the next. */
  | "mechanical";

export interface CharacterMotion {
  /** Idle breathing: cycles per second, and how deep the squash goes. */
  breathRate: number;
  breathDepth: number;
  /** Weight-shift lean while idling. */
  swayRate: number;
  swayAmp: number;
  /** Head tilt - the single biggest cue for "alert" vs "dreamy". */
  tiltRate: number;
  tiltAmp: number;
  /** Resting arm angle. Low = arms hanging, high = arms held ready. */
  armRest: number;
  /** A second blink close after the first; a real human tic, wrong for a robot. */
  doubleBlink: boolean;
  /** Walk cycle: speed, stride length, vertical bounce, arm counter-swing. */
  walkRate: number;
  strideAmp: number;
  bounce: number;
  armSwing: number;
  gait: Gait;
  stance: Stance;
  /** How much the character crouches at rest (ninja low guard). */
  crouch: number;
  /** Follow-through on hair, cape, tail. */
  secondaryAmp: number;
  secondaryRate: number;
  /** Size and speed of wave / cheer gestures. */
  gestureAmp: number;
  gestureRate: number;
  /**
   * Steps per second for mechanical motion. 0 = smooth. Quantising TIME (not the pose)
   * keeps the springs intact while making the result read as servo-driven.
   */
  quantise: number;
}

export const NEUTRAL_MOTION: CharacterMotion = {
  breathRate: 1.9, breathDepth: 0.038,
  swayRate: 0.73, swayAmp: 0.035,
  tiltRate: 0.61, tiltAmp: 0.085,
  armRest: 0.1, doubleBlink: true,
  walkRate: 1, strideAmp: 1, bounce: 1, armSwing: 1, gait: "biped", stance: "neutral",
  crouch: 0,
  secondaryAmp: 1, secondaryRate: 0.9,
  gestureAmp: 1, gestureRate: 1,
  quantise: 0,
};

const m = (over: Partial<CharacterMotion>): CharacterMotion => ({ ...NEUTRAL_MOTION, ...over });

const PROFILES: Record<string, CharacterMotion> = {
  // Cheerful, gentle, expressive - the reference performance.
  hana: m({}),

  // Calm and graceful: slower breath, almost no sway, small restrained gestures.
  yuki: m({
    breathRate: 1.42, breathDepth: 0.027,
    swayRate: 0.52, swayAmp: 0.019,
    tiltRate: 0.44, tiltAmp: 0.048,
    armRest: 0.07, walkRate: 0.82, strideAmp: 0.84, bounce: 0.5, armSwing: 0.62,
    secondaryAmp: 0.62, secondaryRate: 0.66,
    gestureAmp: 0.68, gestureRate: 0.76,
  }),

  // Playful and energetic: fast breath, big bounce, ponytail whips (high secondary).
  mochi: m({
    breathRate: 2.55, breathDepth: 0.058,
    swayRate: 1.15, swayAmp: 0.062,
    tiltRate: 1.0, tiltAmp: 0.135,
    armRest: 0.15, walkRate: 1.28, strideAmp: 1.1, bounce: 1.75, armSwing: 1.32,
    secondaryAmp: 1.95, secondaryRate: 1.5,
    gestureAmp: 1.38, gestureRate: 1.3,
  }),

  // Confident and adventurous: long purposeful stride, steady head.
  kaito: m({
    breathRate: 1.72, breathDepth: 0.041,
    swayRate: 0.6, swayAmp: 0.026,
    tiltRate: 0.5, tiltAmp: 0.05,
    walkRate: 1.1, strideAmp: 1.22, bounce: 0.88, armSwing: 1.18,
    secondaryAmp: 0.8, gestureAmp: 1.12, gestureRate: 1.1,
      stance: "hipHands",
  }),

  // Agile and stealthy: crouched, quick, arms held back, minimal bob.
  shinobi: m({
    breathRate: 1.6, breathDepth: 0.026,
    swayRate: 0.9, swayAmp: 0.018,
    tiltRate: 0.8, tiltAmp: 0.042,
    armRest: 0.26, walkRate: 1.5, strideAmp: 1.02, bounce: 0.45, armSwing: 0.5,
    crouch: 0.3,
    secondaryAmp: 1.15, secondaryRate: 1.35,
    gestureAmp: 1.45, gestureRate: 1.6,
  }),

  // An actual dog: panting breath, diagonal-pair gait, tail never stops.
  biscuit: m({
    breathRate: 2.75, breathDepth: 0.05,
    swayRate: 0.95, swayAmp: 0.03,
    tiltRate: 1.25, tiltAmp: 0.16,
    walkRate: 1.3, strideAmp: 1.0, bounce: 1.15, armSwing: 1,
    gait: "quadruped",
    secondaryAmp: 2.3, secondaryRate: 2.6,
    gestureAmp: 1.2, gestureRate: 1.45,
  }),

  // A machine: no breathing at all, stepped time, no hair/cloth follow-through.
  bolt: m({
    breathRate: 0, breathDepth: 0,
    swayRate: 0.4, swayAmp: 0.01,
    tiltRate: 0.5, tiltAmp: 0.028,
    doubleBlink: false,
    walkRate: 0.92, strideAmp: 0.92, bounce: 0.35, armSwing: 0.78,
    gait: "mechanical",
    secondaryAmp: 0, secondaryRate: 0,
    gestureAmp: 0.85, gestureRate: 0.9,
    quantise: 9,
  }),

  // Heroic and armoured: solid, planted, controlled.
  aegis: m({
    breathRate: 1.45, breathDepth: 0.03,
    swayRate: 0.42, swayAmp: 0.013,
    tiltRate: 0.38, tiltAmp: 0.028,
    armRest: 0.13, walkRate: 0.94, strideAmp: 1.06, bounce: 0.62, armSwing: 0.84,
    secondaryAmp: 0.45, gestureAmp: 0.92, gestureRate: 0.88,
      }),

  // Mysterious and reserved: the slowest breath, the stillest head, the biggest cape.
  nocturne: m({
    breathRate: 1.25, breathDepth: 0.021,
    swayRate: 0.36, swayAmp: 0.011,
    tiltRate: 0.3, tiltAmp: 0.022,
    armRest: 0.06, walkRate: 0.86, strideAmp: 0.96, bounce: 0.4, armSwing: 0.55,
    secondaryAmp: 1.5, secondaryRate: 0.5,
    gestureAmp: 0.58, gestureRate: 0.72,
  }),

  // Warm and optimistic: open, bright, energetic but smooth - never jerky.
  solaris: m({
    breathRate: 1.88, breathDepth: 0.046,
    swayRate: 0.68, swayAmp: 0.04,
    tiltRate: 0.58, tiltAmp: 0.092,
    armRest: 0.14, walkRate: 1.04, strideAmp: 1.12, bounce: 0.98, armSwing: 1.12,
    secondaryAmp: 1.35, secondaryRate: 0.8,
    gestureAmp: 1.28, gestureRate: 1.12,
      stance: "open",
  }),

  // --- sheet-backed characters: profiles still matter for the rig fallback ---

  // Boisterous and rubbery: the widest gestures of anyone.
  luffy: m({
    breathRate: 2.1, breathDepth: 0.055,
    swayRate: 0.95, swayAmp: 0.055, tiltRate: 0.85, tiltAmp: 0.12,
    walkRate: 1.22, strideAmp: 1.2, bounce: 1.5, armSwing: 1.35,
    secondaryAmp: 1.1, gestureAmp: 1.5, gestureRate: 1.25,
  }),
  // Heavy and stoic: wide stance, slow, almost no head movement.
  zoro: m({
    breathRate: 1.38, breathDepth: 0.034,
    swayRate: 0.4, swayAmp: 0.014, tiltRate: 0.32, tiltAmp: 0.024,
    armRest: 0.2, walkRate: 0.88, strideAmp: 1.14, bounce: 0.52, armSwing: 0.6,
    secondaryAmp: 0.5, gestureAmp: 0.8, gestureRate: 0.82,
      stance: "armsCrossed",
  }),
  // Smooth and suave: unhurried, with a flourish on gestures.
  sanji: m({
    breathRate: 1.66, breathDepth: 0.036,
    swayRate: 0.56, swayAmp: 0.032, tiltRate: 0.52, tiltAmp: 0.075,
    walkRate: 1.0, strideAmp: 1.08, bounce: 0.8, armSwing: 1.0,
    secondaryAmp: 0.9, gestureAmp: 1.18, gestureRate: 0.95,
      stance: "pocket",
  }),
  // Brisk and sharp.
  nami: m({
    breathRate: 1.95, breathDepth: 0.042,
    swayRate: 0.82, swayAmp: 0.044, tiltRate: 0.7, tiltAmp: 0.1,
    walkRate: 1.14, strideAmp: 1.0, bounce: 1.05, armSwing: 1.08,
    secondaryAmp: 1.45, secondaryRate: 1.2, gestureAmp: 1.15, gestureRate: 1.2,
      stance: "hipCock",
  }),
  // Small, skittish, fast little steps.
  chopper: m({
    breathRate: 2.65, breathDepth: 0.052,
    swayRate: 1.05, swayAmp: 0.05, tiltRate: 1.1, tiltAmp: 0.15,
    walkRate: 1.42, strideAmp: 0.82, bounce: 1.35, armSwing: 1.2,
    secondaryAmp: 1.3, secondaryRate: 1.7, gestureAmp: 1.1, gestureRate: 1.4,
  }),
};


/**
 * BUILD: per-character proportions.
 *
 * Motion alone is not enough - fifteen characters sharing one skeleton still read as one
 * body in fifteen palettes. These multipliers change the silhouette itself: head size,
 * limb thickness, height and width. Feet sit at y = 0 in rig space, so scaling about the
 * origin keeps everyone planted on the same baseline.
 */
export interface CharacterBuild {
  /** Head radius multiplier - the strongest single silhouette cue in a chibi rig. */
  head: number;
  /** Limb thickness: wiry vs armoured. */
  limb: number;
  /** Overall height and width: lanky vs stocky. */
  height: number;
  width: number;
}

export const NEUTRAL_BUILD: CharacterBuild = { head: 1, limb: 1, height: 1, width: 1 };

const b = (over: Partial<CharacterBuild>): CharacterBuild => ({ ...NEUTRAL_BUILD, ...over });

const BUILDS: Record<string, CharacterBuild> = {
  hana: b({}),
  // Taller and slimmer than Hana; reads as composed.
  yuki: b({ head: 0.96, limb: 0.94, height: 1.05, width: 0.95 }),
  // Small, round and bouncy - the biggest head of the girls.
  mochi: b({ head: 1.1, limb: 1.06, height: 0.92, width: 1.06 }),
  // Lanky teenage boy.
  kaito: b({ head: 0.93, limb: 1.0, height: 1.07, width: 0.99 }),
  // Compact and wiry.
  shinobi: b({ head: 0.95, limb: 0.9, height: 0.97, width: 0.94 }),
  biscuit: b({}),
  // Boxy chassis: thick limbs, broad frame, small head.
  bolt: b({ head: 0.98, limb: 1.15, height: 1.04, width: 1.08 }),
  // Heavy powered armour.
  aegis: b({ head: 0.9, limb: 1.22, height: 1.04, width: 1.13 }),
  // Tall, lean and imposing.
  nocturne: b({ head: 0.89, limb: 0.96, height: 1.11, width: 0.97 }),
  // Classic heroic athletic build.
  solaris: b({ head: 0.92, limb: 1.09, height: 1.07, width: 1.04 }),
  luffy: b({ head: 1.05, limb: 0.98, height: 0.98 }),
  // Broad and heavy.
  zoro: b({ head: 0.95, limb: 1.16, height: 1.03, width: 1.1 }),
  // Tall and slim.
  sanji: b({ head: 0.91, limb: 0.95, height: 1.09, width: 0.95 }),
  nami: b({ head: 0.98, limb: 0.9, height: 1.03, width: 0.93 }),
  // Tiny body, oversized head.
  chopper: b({ head: 1.26, limb: 1.02, height: 0.82 }),
};

export function buildFor(id: string): CharacterBuild {
  return BUILDS[id] ?? NEUTRAL_BUILD;
}

export function motionFor(id: string): CharacterMotion {
  return PROFILES[id] ?? NEUTRAL_MOTION;
}

/**
 * Mechanical characters move in discrete steps. Quantising the *clock* rather than the
 * pose keeps the spring solver continuous, so joints still settle - they just settle
 * toward a target that updates in ticks.
 */
export function motionClock(t: number, mo: CharacterMotion): number {
  return mo.quantise > 0 ? Math.floor(t * mo.quantise) / mo.quantise : t;
}
