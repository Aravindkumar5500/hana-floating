/**
 * Character roster.
 *
 * A character is a **body plan** (which rig draws it), a set of structural features
 * (hair, outfit, cape, ears, tail…), a palette, and a temperament that feeds the pose
 * layer so they do not all move identically.
 *
 * Every character here is an ORIGINAL design drawn by this project's own code, so
 * nothing carries a third-party licence. The three hero archetypes are deliberately
 * generic (armoured / night / caped) rather than resembling any published comic
 * character — shipping look-alikes of trademarked characters in a distributed app is a
 * legal problem, not a stylistic one. See ASSETS.md.
 *
 * NOTE: all current artwork is PLACEHOLDER, generated from the procedural rig. It is a
 * working pipeline, not finished anime art.
 */

export type BodyPlan = "humanoid" | "dog" | "robot" | "reindeer";
export type HairStyle = "twintails" | "bob" | "ponytail" | "short" | "spiky" | "sanjiFringe" | "none";
export type Outfit = "pinafore" | "hoodie" | "dress" | "shorts" | "bodysuit" | "armor" | "vest" | "jeans" | "suit";
export type MaskKind = "none" | "domino" | "cowl" | "visor";

export interface CharacterFeatures {
  cape?: boolean;
  mask?: MaskKind;
  /** Chest emblem, for the hero archetypes. */
  emblem?: boolean;
  /** Antenna on top of the head, for the robot. */
  antenna?: boolean;
  /** Animal ears / tail, for the dog. */
  floppyEars?: boolean;
  tail?: boolean;
  /** Draw limbs as boxes rather than capsules. */
  boxy?: boolean;
  /** Ribbons at the hair roots. */
  ribbons?: boolean;
  /** Luffy's straw hat with red band */
  strawHat?: boolean;
  /** Stitched scar under left eye */
  eyeScar?: boolean;
  /** Luffy's giant toothy pirate grin */
  wideGrin?: boolean;
  /** Zōri straw sandals with red V-straps */
  sandals?: boolean;
  /** White rolled cuffs on denim shorts */
  cuffedShorts?: boolean;
  /** Zoro's three gold hoop earrings */
  tripleEarrings?: boolean;
  /** Zoro's green belly-band haramaki */
  haramaki?: boolean;
  /** Zoro's three katanas at hip */
  threeSwords?: boolean;
  /** Sanji's curled spiral eyebrow */
  spiralBrow?: boolean;
  /** Sanji's hands in pockets pose */
  handsInPockets?: boolean;
  /** Chopper's doctor hat with white X */
  doctorHat?: boolean;
  pinkHat?: boolean;
  /** Reindeer antlers */
  antlers?: boolean;
  /** Blue nose */
  blueNose?: boolean;
  /** Reindeer ears */
  reindeerEars?: boolean;
  /** Hooves instead of feet */
  hooves?: boolean;
}

export interface CharacterLook {
  id: string;
  name: string;
  /** Short label shown in the Settings picker. */
  kind: string;
  bodyPlan: BodyPlan;
  hairStyle: HairStyle;
  outfit: Outfit;
  features: CharacterFeatures;
  temperament: {
    smile: number;
    energy: number;
    blinkPeriod: number;
    blush: number;
  };
  palette: {
    hair: string;
    hairDark: string;
    hairLight: string;
    skin: string;
    skinShade: string;
    ink: string;
    dress: string;
    dressLight: string;
    collar: string;
    tights: string;
    shoe: string;
    shoeDark: string;
    eye: string;
    eyeGlow: string;
    blush: string;
    mouth: string;
    ribbon: string;
  };
}

type Palette = CharacterLook["palette"];

const base: Palette = {
  hair: "#59415f",
  hairDark: "#3d2c45",
  hairLight: "#7b5c82",
  skin: "#ffdccb",
  skinShade: "#f0bda9",
  ink: "#573a4a",
  dress: "#f2a9c2",
  dressLight: "#ffe5ee",
  collar: "#fff4f8",
  tights: "#fbe3ec",
  shoe: "#8b658e",
  shoeDark: "#3d2c45",
  eye: "#5b3d63",
  eyeGlow: "#a87fb0",
  blush: "#ef7e97",
  mouth: "#a45168",
  ribbon: "#ef8fb0",
};

const pal = (over: Partial<Palette>): Palette => ({ ...base, ...over });

export const CHARACTERS: CharacterLook[] = [
  {
    id: "hana",
    name: "Hana",
    kind: "Anime girl",
    bodyPlan: "humanoid",
    hairStyle: "twintails",
    outfit: "pinafore",
    features: { ribbons: true },
    temperament: { smile: 0.42, energy: 1, blinkPeriod: 4.3, blush: 0.28 },
    palette: base,
  },
  {
    id: "yuki",
    name: "Yuki",
    kind: "Anime girl",
    bodyPlan: "humanoid",
    hairStyle: "bob",
    outfit: "hoodie",
    features: {},
    temperament: { smile: 0.26, energy: 0.78, blinkPeriod: 5.6, blush: 0.2 },
    palette: pal({
      hair: "#aebfd8", hairDark: "#6f8099", hairLight: "#d8e4f3",
      skin: "#ffe2d4", skinShade: "#efc3b2", ink: "#4a4a5e",
      dress: "#8fb6d9", dressLight: "#d7e9f7", collar: "#f2f8ff",
      tights: "#e4eef8", shoe: "#5d6f8a", shoeDark: "#3a4659",
      eye: "#35506e", eyeGlow: "#6f9ac4", mouth: "#96566a", ribbon: "#cfe2f5",
    }),
  },
  {
    id: "mochi",
    name: "Mochi",
    kind: "Anime girl",
    bodyPlan: "humanoid",
    hairStyle: "ponytail",
    outfit: "dress",
    features: { ribbons: true },
    temperament: { smile: 0.62, energy: 1.25, blinkPeriod: 3.4, blush: 0.42 },
    palette: pal({
      hair: "#f0b9a0", hairDark: "#c98a71", hairLight: "#ffd9c6",
      skin: "#ffe3d2", skinShade: "#f2c3ae", ink: "#6b4a44",
      dress: "#fbd9a0", dressLight: "#fff2d8", collar: "#fffaf0",
      tights: "#fdeadb", shoe: "#c98a71", shoeDark: "#8e5f4c",
      eye: "#7a4a32", eyeGlow: "#c08a62", blush: "#f58a92",
      mouth: "#b2606a", ribbon: "#f6a9b4",
    }),
  },
  {
    id: "kaito",
    name: "Kaito",
    kind: "Anime boy",
    bodyPlan: "humanoid",
    hairStyle: "spiky",
    outfit: "shorts",
    features: {},
    temperament: { smile: 0.34, energy: 1.1, blinkPeriod: 4.8, blush: 0.14 },
    palette: pal({
      hair: "#3f4a63", hairDark: "#28304a", hairLight: "#5f6e8e",
      skin: "#ffdcc4", skinShade: "#eabb9f", ink: "#3c3a4a",
      dress: "#5a7fb5", dressLight: "#9ab8dd", collar: "#eef4ff",
      tights: "#43506b", shoe: "#2f3a52", shoeDark: "#1e2536",
      eye: "#2f4f6b", eyeGlow: "#6b95b8", blush: "#e8808a",
      mouth: "#9a5560", ribbon: "#5a7fb5",
    }),
  },
  {
    id: "shinobi",
    name: "Kiba",
    kind: "Ninja",
    bodyPlan: "humanoid",
    hairStyle: "spiky",
    outfit: "shorts",
    features: { mask: "domino" },
    temperament: { smile: 0.45, energy: 1.3, blinkPeriod: 3.6, blush: 0.16 },
    palette: pal({
      hair: "#e8c45a", hairDark: "#b9922f", hairLight: "#ffe9a3",
      skin: "#ffd9b8", skinShade: "#e5b795", ink: "#3f3326",
      dress: "#e87b35", dressLight: "#ffb473", collar: "#2f3a52",
      tights: "#2f3a52", shoe: "#3a2f28", shoeDark: "#241d18",
      eye: "#2f6fd0", eyeGlow: "#7aa6e8", blush: "#e8808a",
      mouth: "#9a5560", ribbon: "#2f3a52",
    }),
  },
  {
    id: "biscuit",
    name: "Biscuit",
    kind: "Dog",
    bodyPlan: "dog",
    hairStyle: "none",
    outfit: "dress",
    features: { floppyEars: true, tail: true },
    temperament: { smile: 0.7, energy: 1.35, blinkPeriod: 3.1, blush: 0.22 },
    palette: pal({
      hair: "#c98a56", hairDark: "#9a6538", hairLight: "#e5b183",
      skin: "#e8b584", skinShade: "#c99264", ink: "#5a3f2b",
      dress: "#d9534f", dressLight: "#f0a5a2", collar: "#d9534f",
      tights: "#e8b584", shoe: "#9a6538", shoeDark: "#6b4526",
      eye: "#3f2a1c", eyeGlow: "#8a6240", blush: "#e8808a",
      mouth: "#7a4530", ribbon: "#d9534f",
    }),
  },
  {
    id: "bolt",
    name: "Bolt",
    kind: "Robot",
    bodyPlan: "robot",
    hairStyle: "none",
    outfit: "armor",
    features: { antenna: true, mask: "visor", boxy: true },
    temperament: { smile: 0.2, energy: 0.9, blinkPeriod: 2.4, blush: 0 },
    palette: pal({
      hair: "#9aa7b4", hairDark: "#5e6b78", hairLight: "#c7d2dc",
      skin: "#b9c6d2", skinShade: "#95a3b1", ink: "#38424e",
      dress: "#7f8d9b", dressLight: "#b4c1cd", collar: "#d7e2ec",
      tights: "#8d9aa8", shoe: "#4e5a67", shoeDark: "#333c47",
      eye: "#4ad6e8", eyeGlow: "#9ff0fa", blush: "#4ad6e8",
      mouth: "#4ad6e8", ribbon: "#4ad6e8",
    }),
  },
  {
    id: "aegis",
    name: "Aegis",
    kind: "Hero · armoured",
    bodyPlan: "humanoid",
    hairStyle: "none",
    outfit: "armor",
    features: { mask: "visor", emblem: true, boxy: false },
    temperament: { smile: 0.3, energy: 1.05, blinkPeriod: 4.0, blush: 0 },
    palette: pal({
      hair: "#b03a2e", hairDark: "#7d2820", hairLight: "#d4705f",
      skin: "#c9a227", skinShade: "#a8851c", ink: "#4a2a20",
      dress: "#b03a2e", dressLight: "#d4705f", collar: "#e8c45a",
      tights: "#c9a227", shoe: "#7d2820", shoeDark: "#4a2a20",
      eye: "#9ff0fa", eyeGlow: "#d6fbff", blush: "#e8808a",
      mouth: "#7d2820", ribbon: "#e8c45a",
    }),
  },
  {
    id: "nocturne",
    name: "Nocturne",
    kind: "Hero · night",
    bodyPlan: "humanoid",
    hairStyle: "none",
    outfit: "bodysuit",
    features: { cape: true, mask: "cowl", emblem: true },
    temperament: { smile: 0.1, energy: 0.8, blinkPeriod: 5.2, blush: 0 },
    palette: pal({
      hair: "#2b2f3a", hairDark: "#1a1d25", hairLight: "#444a5c",
      skin: "#e8c3a8", skinShade: "#c9a186", ink: "#14171e",
      dress: "#2b2f3a", dressLight: "#444a5c", collar: "#3a4050",
      tights: "#2b2f3a", shoe: "#1a1d25", shoeDark: "#0f1116",
      eye: "#cfd6e4", eyeGlow: "#ffffff", blush: "#b06b74",
      mouth: "#6b4b52", ribbon: "#3a4050",
    }),
  },
  {
    id: "solaris",
    name: "Solaris",
    kind: "Hero · caped",
    bodyPlan: "humanoid",
    hairStyle: "short",
    outfit: "bodysuit",
    features: { cape: true, mask: "none", emblem: true },
    temperament: { smile: 0.55, energy: 1.15, blinkPeriod: 4.1, blush: 0.12 },
    palette: pal({
      hair: "#2f3340", hairDark: "#1d2029", hairLight: "#4d5365",
      skin: "#ffd9bd", skinShade: "#e5b795", ink: "#2a2f3d",
      dress: "#2f6fd0", dressLight: "#7aa6e8", collar: "#e8c45a",
      tights: "#2f6fd0", shoe: "#c0392b", shoeDark: "#7d2820",
      eye: "#2f6fd0", eyeGlow: "#7aa6e8", blush: "#e8808a",
      mouth: "#9a5560", ribbon: "#c0392b",
    }),
  },
  {
    id: "luffy",
    name: "Monkey D. Luffy",
    kind: "Straw Hat Pirate",
    bodyPlan: "humanoid",
    hairStyle: "spiky",
    outfit: "vest",
    features: {
      strawHat: true,
      eyeScar: true,
      wideGrin: true,
      cuffedShorts: true,
      sandals: true,
    },
    temperament: { smile: 0.95, energy: 1.5, blinkPeriod: 5.2, blush: 0.1 },
    palette: pal({
      hair: "#16161a",
      hairDark: "#09090c",
      hairLight: "#2c2c34",
      skin: "#ffdeb8",
      skinShade: "#e5b78c",
      ink: "#2a1e16",
      dress: "#d32424",      // Vibrant red vest
      dressLight: "#f04848",
      collar: "#f5d342",     // Straw hat gold / buttons
      tights: "#27599e",     // Blue denim shorts
      shoe: "#cba052",       // Straw zōri sandals
      shoeDark: "#8a6125",
      eye: "#151518",
      eyeGlow: "#454550",
      blush: "#f09490",
      mouth: "#c02830",
      ribbon: "#d32424",     // Hat red band
    }),
  },
  {
    id: "zoro",
    name: "Roronoa Zoro",
    kind: "Pirate Hunter",
    bodyPlan: "humanoid",
    hairStyle: "spiky",
    outfit: "shorts",
    features: {
      tripleEarrings: true,
      haramaki: true,
      threeSwords: true,
    },
    temperament: { smile: 0.15, energy: 1.1, blinkPeriod: 6.5, blush: 0.05 },
    palette: pal({
      hair: "#488f40",      // Moss green hair
      hairDark: "#265421",
      hairLight: "#6fc465",
      skin: "#ffddbc",
      skinShade: "#e6b68e",
      ink: "#1e261a",
      dress: "#1d3d2a",      // Dark green coat
      dressLight: "#2e5c40",
      collar: "#52a340",     // Green haramaki sash
      tights: "#172b1d",     // Dark trousers
      shoe: "#1a1a20",       // Black boots
      shoeDark: "#0c0c10",
      eye: "#253b23",
      eyeGlow: "#4f7a4b",
      blush: "#d48078",
      mouth: "#883a40",
      ribbon: "#f5d342",     // Gold earrings
    }),
  },
  {
    id: "sanji",
    name: "Sanji",
    kind: "Cook · Pirate",
    bodyPlan: "humanoid",
    hairStyle: "sanjiFringe",
    outfit: "suit",
    features: {
      spiralBrow: true,
      handsInPockets: true,
    },
    temperament: { smile: 0.5, energy: 1.15, blinkPeriod: 4.8, blush: 0.15 },
    palette: pal({
      hair: "#fed843",      // Bright blond hair
      hairDark: "#d1a31b",
      hairLight: "#fff08f",
      skin: "#ffe4cf",
      skinShade: "#e8bfa6",
      ink: "#231e1a",
      dress: "#1b212c",      // Black/dark navy suit jacket
      dressLight: "#2c3547",
      collar: "#7bb3e8",     // Light blue dress shirt
      tights: "#191e28",     // Black trousers
      shoe: "#11141a",       // Polished black dress shoes
      shoeDark: "#080a0d",
      eye: "#252b36",
      eyeGlow: "#4d5b73",
      blush: "#f58595",
      mouth: "#883a40",
      ribbon: "#f5d342",     // Gold suit buttons
    }),
  },
  {
    id: "nami",
    name: "Nami",
    kind: "Cat Burglar",
    bodyPlan: "humanoid",
    hairStyle: "short",
    outfit: "jeans",
    features: {},
    temperament: { smile: 0.58, energy: 1.2, blinkPeriod: 4.2, blush: 0.25 },
    palette: pal({
      hair: "#f57820",      // Tangerine orange hair
      hairDark: "#c4540a",
      hairLight: "#ffa257",
      skin: "#ffe2cc",
      skinShade: "#eec0a2",
      ink: "#3c261e",
      dress: "#169e7e",      // Green bikini top
      dressLight: "#ffffff",
      collar: "#f5d342",     // Gold Log Pose bracelet
      tights: "#245594",     // Denim jeans
      shoe: "#c77234",       // High sandals
      shoeDark: "#854417",
      eye: "#6b4320",
      eyeGlow: "#a86f3e",
      blush: "#f58595",
      mouth: "#b54457",
      ribbon: "#f57820",
    }),
  },
  {
    id: "chopper",
    name: "Tony Tony Chopper",
    kind: "Doctor · Reindeer",
    bodyPlan: "reindeer",
    hairStyle: "none",
    outfit: "shorts",
    features: {
      doctorHat: true,
      pinkHat: true,
      antlers: true,
      blueNose: true,
      reindeerEars: true,
      hooves: true,
    },
    temperament: { smile: 0.7, energy: 1.35, blinkPeriod: 3.6, blush: 0.35 },
    palette: pal({
      hair: "#8a5229",      // Brown reindeer fur
      hairDark: "#5c3111",
      hairLight: "#b37446",
      skin: "#e8bd9b",
      skinShade: "#cb9a75",
      ink: "#382012",
      dress: "#9e2a44",      // Maroon trousers
      dressLight: "#c73356",
      collar: "#eb5d88",     // Signature pink doctor hat
      tights: "#734320",     // Fur legs
      shoe: "#23150c",       // Black hooves
      shoeDark: "#120a05",
      eye: "#23120b",
      eyeGlow: "#4a321f",
      blush: "#f58794",
      mouth: "#9c3844",
      ribbon: "#ffffff",     // White cross
    }),
  },
];

// Pinned by id, not by array position: entries inserted at the top of CHARACTERS
// silently changed the default character for new installs.
export const DEFAULT_CHARACTER =
  CHARACTERS.find((c) => c.id === "hana")?.id ?? CHARACTERS[0].id;

export function characterById(id: string): CharacterLook {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}
