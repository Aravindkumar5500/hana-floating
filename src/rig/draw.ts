/**
 * Canvas renderer.
 *
 * Coordinate system: rig units, feet at y = 0, **y pointing UP**. The caller installs
 * the flip. Every path below therefore uses `+y` for "higher on the character":
 * crown = head.y + r, chin = head.y - r. (An earlier version had the face paths
 * inverted, which drew the head upside down and smeared the back hair across the body.)
 *
 * Draw order, back to front:
 *   back hair → far leg → near leg → skirt → torso → far arm → head → front hair → near arm
 */

import type { Pose } from "./pose";
import { RIG, solveLimb, type Vec2 } from "./skeleton";
import type { CharacterLook } from "./characters";
import { buildFor } from "./motion";

type Palette = CharacterLook["palette"];

/**
 * Darken a colour for the far side of the body.
 *
 * Depth must come from shading ONE colour, never from swapping to a different palette
 * entry. The far leg used to be painted `skinShade` while the near leg was painted
 * `tights`, so characters wearing trousers ended up with one bare leg and one clothed
 * leg - the "mismatched leg colours" bug.
 */
function shade(hex: string, amount = 0.8): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.round(((n >> 16) & 255) * amount);
  const g = Math.round(((n >> 8) & 255) * amount);
  const b = Math.round((n & 255) * amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function fillPath(ctx: CanvasRenderingContext2D, fill: string, stroke?: string, w = 2.2) {
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke && w > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = w;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }
}

/** A tapered capsule, used for every limb segment. */
function capsule(
  ctx: CanvasRenderingContext2D,
  a: Vec2,
  b: Vec2,
  wa: number,
  wb: number,
  fill: string,
  ink: string,
  boxy = false,
) {
  if (boxy) {
    // Robot limbs: a rectangle along the bone, with a joint block at each end.
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.rect(-wa * 0.4, -wa, len + wa * 0.8, wa * 2);
    ctx.closePath();
    fillPath(ctx, fill, ink, 1.8);
    ctx.restore();
    for (const [pt, w] of [[a, wa], [b, wb]] as const) {
      ctx.beginPath();
      ctx.rect(pt.x - w * 0.75, pt.y - w * 0.75, w * 1.5, w * 1.5);
      fillPath(ctx, fill, ink, 1.6);
    }
    return;
  }
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 0.001;
  const nx = -dy / len;
  const ny = dx / len;
  const ang = Math.atan2(ny, nx);
  ctx.beginPath();
  ctx.moveTo(a.x + nx * wa, a.y + ny * wa);
  ctx.lineTo(b.x + nx * wb, b.y + ny * wb);
  ctx.arc(b.x, b.y, wb, ang, ang + Math.PI, true);
  ctx.lineTo(a.x - nx * wa, a.y - ny * wa);
  ctx.arc(a.x, a.y, wa, ang + Math.PI, ang, true);
  ctx.closePath();
  fillPath(ctx, fill, ink, 1.8);
}

/**
 * Draws a two-bone organic limb (origin -> joint -> tip) as a single seamless contour.
 * Prevents horizontal stroke cut lines across the elbow or knee.
 */
function drawLimb(
  ctx: CanvasRenderingContext2D,
  a: Vec2,
  joint: Vec2,
  tip: Vec2,
  wa: number,
  wj: number,
  wt: number,
  fill: string,
  ink: string,
  boxy = false,
) {
  if (boxy) {
    capsule(ctx, a, joint, wa, wj, fill, ink, true);
    capsule(ctx, joint, tip, wj, wt, fill, ink, true);
    return;
  }
  const d1x = joint.x - a.x;
  const d1y = joint.y - a.y;
  const len1 = Math.hypot(d1x, d1y) || 0.001;
  const n1x = -d1y / len1;
  const n1y = d1x / len1;

  const d2x = tip.x - joint.x;
  const d2y = tip.y - joint.y;
  const len2 = Math.hypot(d2x, d2y) || 0.001;
  const n2x = -d2y / len2;
  const n2y = d2x / len2;

  const angA = Math.atan2(n1y, n1x);
  const angTip = Math.atan2(n2y, n2x);

  ctx.beginPath();
  // Rounded cap at origin (a)
  ctx.arc(a.x, a.y, wa, angA + Math.PI, angA, true);
  // Outer line to joint
  ctx.lineTo(joint.x + n1x * wj, joint.y + n1y * wj);
  // Smooth joint transition to bone 2
  ctx.quadraticCurveTo(
    joint.x + ((n1x + n2x) / 2) * (wj * 1.05),
    joint.y + ((n1y + n2y) / 2) * (wj * 1.05),
    joint.x + n2x * wj,
    joint.y + n2y * wj,
  );
  // Outer line to tip
  ctx.lineTo(tip.x + n2x * wt, tip.y + n2y * wt);
  // Rounded cap at tip
  ctx.arc(tip.x, tip.y, wt, angTip, angTip + Math.PI, true);
  // Inner line back to joint
  ctx.lineTo(joint.x - n2x * wj, joint.y - n2y * wj);
  // Smooth inner joint transition
  ctx.quadraticCurveTo(
    joint.x - ((n1x + n2x) / 2) * (wj * 1.05),
    joint.y - ((n1y + n2y) / 2) * (wj * 1.05),
    joint.x - n1x * wj,
    joint.y - n1y * wj,
  );
  // Inner line back to origin
  ctx.lineTo(a.x - n1x * wa, a.y - n1y * wa);
  ctx.closePath();
  fillPath(ctx, fill, ink, 1.8);
}

function ellipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rot = 0,
) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2);
}

/* ------------------------------------------------------------------ hair --- */

/** A swaying hair strand built from a short chain of tapering capsules. */
function strand(
  ctx: CanvasRenderingContext2D,
  root: Vec2,
  dir: number,
  p: Pose,
  pal: Palette,
  segs: Array<{ len: number; ang: number; w: number }>,
) {
  let at = root;
  let acc = 0;
  let i = 0;
  for (const s of segs) {
    i++;
    // Each segment lags a little more than the one above it: secondary motion.
    acc += s.ang * dir + p.hairSway * 0.22 * i + 0.03 * Math.sin(p.hairPhase * 1.6 + i * 0.7) * i;
    const next = { x: at.x + s.len * Math.sin(acc), y: at.y - s.len * Math.cos(acc) };
    capsule(ctx, at, next, s.w, s.w * 0.62, pal.hair, pal.hairDark);
    at = next;
  }
}

function backHair(ctx: CanvasRenderingContext2D, head: Vec2, r: number, p: Pose, pal: Palette) {
  // A rounded mass behind the head, hanging to just below the chin. Control points go
  // UP from the head centre (+y), which is what the broken version got backwards.
  ctx.beginPath();
  ctx.moveTo(head.x - r * 1.04, head.y + r * 0.1);
  ctx.bezierCurveTo(
    head.x - r * 1.2, head.y + r * 1.15,
    head.x + r * 1.2, head.y + r * 1.15,
    head.x + r * 1.04, head.y + r * 0.1,
  );
  ctx.bezierCurveTo(
    head.x + r * 1.1, head.y - r * 0.95 + p.hairSway * 4,
    head.x - r * 1.1, head.y - r * 0.95 - p.hairSway * 4,
    head.x - r * 1.04, head.y + r * 0.1,
  );
  ctx.closePath();
  fillPath(ctx, pal.hairDark, pal.hairDark, 1.6);
}

function hairCap(ctx: CanvasRenderingContext2D, head: Vec2, r: number, p: Pose, pal: Palette) {
  // Cap over the crown, with a fringe whose underside zig-zags across the forehead.
  ctx.beginPath();
  ctx.moveTo(head.x - r * 1.03, head.y + r * 0.05);
  ctx.bezierCurveTo(
    head.x - r * 1.06, head.y + r * 0.85,
    head.x - r * 0.5, head.y + r * 1.2,
    head.x, head.y + r * 1.18,
  );
  ctx.bezierCurveTo(
    head.x + r * 0.5, head.y + r * 1.2,
    head.x + r * 1.06, head.y + r * 0.85,
    head.x + r * 1.03, head.y + r * 0.05,
  );
  // Fringe underside (right to left), dipping onto the forehead.
  ctx.lineTo(head.x + r * 0.72, head.y + r * 0.2);
  ctx.lineTo(head.x + r * 0.4, head.y + r * 0.46);
  ctx.lineTo(head.x + r * 0.12, head.y + r * 0.18);
  ctx.lineTo(head.x - r * 0.2, head.y + r * 0.48);
  ctx.lineTo(head.x - r * 0.52, head.y + r * 0.22);
  ctx.lineTo(head.x - r * 0.76, head.y + r * 0.44);
  ctx.closePath();
  fillPath(ctx, pal.hair, pal.hairDark, 2.0);

  // Glossy highlight band across the crown.
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.moveTo(head.x - r * 0.56, head.y + r * 0.78);
  ctx.quadraticCurveTo(head.x, head.y + r * 0.98, head.x + r * 0.56, head.y + r * 0.76);
  ctx.strokeStyle = pal.hairLight;
  ctx.lineWidth = 4.2;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
}

function drawReindeer(ctx: CanvasRenderingContext2D, p: Pose, look: CharacterLook) {
  const pal = look.palette;
  const sit = p.sit;
  const r = 26; // Cute oversized chibi head
  const headC: Vec2 = { x: 0, y: 104 - sit * 16 };
  const hip: Vec2 = { x: 0, y: 52 - sit * 22 };
  const shoulder: Vec2 = { x: 0, y: 80 - sit * 18 };

  // Cute reindeer tail
  const wag = p.hairSway * 1.5 + 0.2 * Math.sin(p.hairPhase * 3);
  ctx.save();
  ctx.translate(-14, hip.y + 6);
  ctx.rotate(wag - 0.4);
  ellipse(ctx, -5, 0, 7, 5);
  fillPath(ctx, pal.hair, pal.ink, 1.6);
  ellipse(ctx, -9, 0, 3.5, 3);
  fillPath(ctx, "#ffffff", pal.ink, 1.2);
  ctx.restore();

  // Far leg (fur + hoof)
  const legL = solveLimb({ x: hip.x - 7, y: hip.y }, -p.legL + sit * 0.8, 22, -p.kneeL - sit * 1.0, 20);
  drawLimb(ctx, { x: hip.x - 7, y: hip.y }, legL.joint, legL.tip, 6.8, 5.8, 4.6, pal.hairDark, pal.ink);
  ellipse(ctx, legL.tip.x, legL.tip.y, 5.6, 4.2);
  fillPath(ctx, pal.shoe, pal.ink, 1.8);

  // Near leg (fur + hoof)
  const legR = solveLimb({ x: hip.x + 7, y: hip.y }, p.legR + sit * 0.8, 22, -p.kneeR - sit * 1.0, 20);
  drawLimb(ctx, { x: hip.x + 7, y: hip.y }, legR.joint, legR.tip, 7.2, 6.2, 5.0, pal.hair, pal.ink);
  ellipse(ctx, legR.tip.x, legR.tip.y, 6.0, 4.5);
  fillPath(ctx, pal.shoe, pal.ink, 1.8);

  // Maroon shorts (pants)
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.rect(hip.x + side * 7 - 6, hip.y - 4, 12, 14);
    fillPath(ctx, pal.dress, pal.ink, 2);
  }
  // Shorts waistband
  ctx.beginPath();
  ctx.rect(hip.x - 12, hip.y + 5, 24, 7);
  fillPath(ctx, pal.dressLight, pal.ink, 1.8);

  // Far arm (fur + hoof)
  const armL = solveLimb({ x: shoulder.x - 9, y: shoulder.y }, -p.armL, 16, -p.elbowL, 16);
  drawLimb(ctx, { x: shoulder.x - 9, y: shoulder.y }, armL.joint, armL.tip, 6.0, 5.2, 4.2, pal.hairDark, pal.ink);
  ellipse(ctx, armL.tip.x, armL.tip.y, 5.0, 4.0);
  fillPath(ctx, pal.shoe, pal.ink, 1.6);

  // Torso (fluffy fur body)
  ctx.beginPath();
  ctx.moveTo(hip.x - 12, hip.y + 8);
  ctx.quadraticCurveTo(hip.x - 14, shoulder.y - 4, shoulder.x - 11, shoulder.y + 2);
  ctx.quadraticCurveTo(shoulder.x, shoulder.y + 6, shoulder.x + 11, shoulder.y + 2);
  ctx.quadraticCurveTo(hip.x + 14, shoulder.y - 4, hip.x + 12, hip.y + 8);
  ctx.closePath();
  fillPath(ctx, pal.hair, pal.ink, 2.2);

  // Near arm (fur + hoof)
  const armR = solveLimb({ x: shoulder.x + 9, y: shoulder.y }, p.armR, 16, p.elbowR, 16);
  drawLimb(ctx, { x: shoulder.x + 9, y: shoulder.y }, armR.joint, armR.tip, 6.4, 5.6, 4.5, pal.hair, pal.ink);
  ellipse(ctx, armR.tip.x, armR.tip.y, 5.4, 4.2);
  fillPath(ctx, pal.shoe, pal.ink, 1.6);

  // Head (Brain Point chibi reindeer)
  ctx.save();
  ctx.translate(headC.x, headC.y);
  ctx.rotate(p.headTilt * 0.8);
  ctx.translate(-headC.x, -headC.y);

  // Furry reindeer head shape
  ellipse(ctx, headC.x, headC.y, r * 1.05, r * 0.95);
  fillPath(ctx, pal.hair, pal.ink, 2.4);

  // Reindeer ears (side)
  for (const side of [-1, 1] as const) {
    const ex = headC.x + side * r * 0.88;
    const ey = headC.y - r * 0.12;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(ex, ey, 9, 5.5, side * 0.35, 0, Math.PI * 2);
    fillPath(ctx, pal.hair, pal.ink, 1.8);
    ctx.beginPath();
    ctx.ellipse(ex, ey, 5.5, 3.2, side * 0.35, 0, Math.PI * 2);
    fillPath(ctx, pal.skin, pal.ink, 1.0);
    ctx.restore();
  }

  // Tan/cream muzzle around mouth and nose
  ctx.beginPath();
  ctx.ellipse(headC.x, headC.y - r * 0.42, r * 0.58, r * 0.38, 0, 0, Math.PI * 2);
  fillPath(ctx, pal.skin, pal.ink, 1.8);

  // Large round expressive deer eyes
  const open = Math.max(0, Math.min(1.2, p.eyesOpen));
  const eh = r * 0.34 * open;
  for (const side of [-1, 1] as const) {
    const ex = headC.x + side * r * 0.48;
    const ey = headC.y - r * 0.08;
    if (eh < r * 0.04) {
      ctx.beginPath();
      ctx.moveTo(ex - 6, ey);
      ctx.quadraticCurveTo(ex, ey + 4, ex + 6, ey);
      ctx.strokeStyle = pal.eye;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      continue;
    }
    ellipse(ctx, ex, ey, r * 0.24, eh);
    fillPath(ctx, pal.eye, pal.ink, 1.4);
    // Big highlight sparkles
    ellipse(ctx, ex - 2, ey + eh * 0.35, r * 0.09, eh * 0.3);
    fillPath(ctx, "#ffffff");
    ellipse(ctx, ex + 2.5, ey - eh * 0.25, r * 0.045, eh * 0.15);
    fillPath(ctx, "#ffffff");
  }

  // Signature cobalt blue nose
  ellipse(ctx, headC.x, headC.y - r * 0.38, 5.2, 4.0);
  fillPath(ctx, "#247dc9", pal.ink, 1.4);
  ellipse(ctx, headC.x - 1.2, headC.y - r * 0.36, 1.8, 1.2);
  fillPath(ctx, "#ffffffcc");

  // Cute mouth
  ctx.beginPath();
  ctx.moveTo(headC.x - 6, headC.y - r * 0.58);
  ctx.quadraticCurveTo(headC.x, headC.y - r * 0.72 - p.smile * 3, headC.x + 6, headC.y - r * 0.58);
  ctx.strokeStyle = pal.mouth;
  ctx.lineWidth = 2.0;
  ctx.lineCap = "round";
  ctx.stroke();

  // Pink Doctor Hat with white X
  drawDoctorHat(ctx, headC, r, pal);

  // Antlers curving up from behind hat brim
  drawAntlers(ctx, headC, r);

  ctx.restore();
}

function hairStyle(
  ctx: CanvasRenderingContext2D,
  head: Vec2,
  r: number,
  p: Pose,
  look: CharacterLook,
  layer: "back" | "front",
) {
  const pal = look.palette;
  switch (look.hairStyle) {
    case "twintails": {
      // Two tails, one behind the head and one in front, so she reads in 3/4 view.
      const side = layer === "back" ? -1 : 1;
      const root = { x: head.x + side * r * 0.9, y: head.y + r * 0.18 };
      strand(ctx, root, side, p, pal, [
        { len: 21, ang: 0.34, w: 9.5 },
        { len: 19, ang: 0.1, w: 7 },
        { len: 15, ang: 0.08, w: 4.2 },
      ]);
      if (layer === "front") {
        // Draw ribbons on BOTH tails on the front layer so both clips are visible and symmetrical!
        for (const s of [-1, 1] as const) {
          const rib = { x: head.x + s * r * 0.88, y: head.y + r * 0.18 };
          ellipse(ctx, rib.x, rib.y, 7, 5.2, s * 0.35);
          fillPath(ctx, pal.ribbon, pal.ink, 1.5);
          ellipse(ctx, rib.x, rib.y + 1, 3.5, 2.2, s * 0.35);
          fillPath(ctx, "#ffffff66");
        }
      }
      break;
    }
    case "bob": {
      if (layer !== "back") {
        // Two short side locks framing the cheeks.
        for (const side of [-1, 1] as const) {
          strand(ctx, { x: head.x + side * r * 0.95, y: head.y + r * 0.1 }, side, p, pal, [
            { len: 20, ang: 0.16, w: 8 },
            { len: 13, ang: 0.07, w: 5 },
          ]);
        }
      }
      break;
    }
    case "short": {
      if (layer === "front") {
        for (const side of [-1, 1] as const) {
          strand(ctx, { x: head.x + side * r * 0.9, y: head.y + r * 0.18 }, side, p, pal, [
            { len: 12, ang: 0.2, w: 7 },
          ]);
        }
      }
      break;
    }
    case "spiky": {
      if (layer === "front") {
        // A few upward tufts over the crown.
        for (const k of [-1, -0.35, 0.35, 1] as const) {
          const rootPt = { x: head.x + k * r * 0.72, y: head.y + r * 0.72 };
          const tip = {
            x: rootPt.x + k * r * 0.42,
            y: rootPt.y + r * (0.42 - Math.abs(k) * 0.12),
          };
          ctx.beginPath();
          ctx.moveTo(rootPt.x - r * 0.2, rootPt.y);
          ctx.lineTo(tip.x, tip.y);
          ctx.lineTo(rootPt.x + r * 0.2, rootPt.y - r * 0.06);
          ctx.closePath();
          fillPath(ctx, pal.hair, pal.hairDark, 1.8);
        }
      }
      break;
    }
    case "sanjiFringe": {
      if (layer === "front") {
        ctx.save();
        ctx.fillStyle = pal.hair;
        ctx.strokeStyle = pal.hairDark;
        ctx.lineWidth = 1.8;
        // Large swooping fringe covering one eye
        ctx.beginPath();
        ctx.moveTo(head.x + r * 0.45, head.y + r * 0.85);
        ctx.bezierCurveTo(
          head.x - r * 0.1, head.y + r * 0.55,
          head.x - r * 0.85, head.y + r * 0.15,
          head.x - r * 0.65, head.y - r * 0.4,
        );
        ctx.quadraticCurveTo(head.x - r * 0.28, head.y - r * 0.12, head.x - r * 0.05, head.y + r * 0.3);
        ctx.quadraticCurveTo(head.x + r * 0.12, head.y + r * 0.6, head.x + r * 0.45, head.y + r * 0.85);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Secondary swooping strand
        ctx.beginPath();
        ctx.moveTo(head.x + r * 0.2, head.y + r * 0.8);
        ctx.bezierCurveTo(
          head.x - r * 0.3, head.y + r * 0.35,
          head.x - r * 0.6, head.y - r * 0.1,
          head.x - r * 0.45, head.y - r * 0.48,
        );
        ctx.quadraticCurveTo(head.x - r * 0.15, head.y - r * 0.15, head.x + r * 0.05, head.y + r * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case "none":
      break;
    case "ponytail": {
      const root = { x: head.x - r * 0.72, y: head.y + r * 0.62 };
      if (layer === "back") {
        // Tied HIGH and built from five tapering segments. Three wide, barely-tapering
        // ones read as a plank bolted to her head rather than hair; more segments also
        // give the spring chain somewhere to put Mochi's large secondary motion.
        strand(ctx, root, -1, p, pal, [
          { len: 17, ang: 0.62, w: 8 },
          { len: 16, ang: 0.26, w: 6.4 },
          { len: 15, ang: 0.2, w: 4.8 },
          { len: 13, ang: 0.18, w: 3.4 },
          { len: 10, ang: 0.16, w: 2.2 },
        ]);
      } else {
        // Draw the ribbon clasp in the front layer so the hair cap does not occlude it.
        ellipse(ctx, root.x, root.y, 7.8, 5.8, -0.45);
        fillPath(ctx, pal.ribbon, pal.ink, 1.6);
        ellipse(ctx, root.x - 1, root.y + 1, 3.8, 2.4, -0.45);
        fillPath(ctx, "#ffffff66");
      }
      break;
    }
  }
}

/* ------------------------------------------------------------------ face --- */

function drawFace(
  ctx: CanvasRenderingContext2D,
  head: Vec2,
  p: Pose,
  look: CharacterLook,
  facing: number,
) {
  const r = RIG.headR;
  const pal = look.palette;

  // Ears.
  for (const side of [-1, 1] as const) {
    ellipse(ctx, head.x + side * r * 0.93, head.y - r * 0.02, 5, 8);
    fillPath(ctx, pal.skin, pal.ink, 1.7);
  }

  // Face: a soft egg, widest at the cheeks, narrowing to a small rounded chin BELOW
  // the centre (head.y - r) with the crown ABOVE it (head.y + r).
  ctx.beginPath();
  ctx.moveTo(head.x, head.y - r * 1.0); // chin
  ctx.bezierCurveTo(
    head.x + r * 0.62, head.y - r * 0.92,
    head.x + r * 1.0, head.y - r * 0.2,
    head.x + r * 0.98, head.y + r * 0.26,
  );
  ctx.bezierCurveTo(
    head.x + r * 0.94, head.y + r * 0.98,
    head.x - r * 0.94, head.y + r * 0.98,
    head.x - r * 0.98, head.y + r * 0.26,
  );
  ctx.bezierCurveTo(
    head.x - r * 1.0, head.y - r * 0.2,
    head.x - r * 0.62, head.y - r * 0.92,
    head.x, head.y - r * 1.0,
  );
  ctx.closePath();
  fillPath(ctx, pal.skin, pal.ink, 2.2);

  // Eyes sit low on the face — a big part of why chibi faces read as cute.
  const eyeY = head.y - r * 0.2;
  const open = Math.max(0, Math.min(1.2, p.eyesOpen));
  const lx = p.lookX * facing;
  const eyeDX = r * 0.46;
  const eyeW = r * 0.26;
  const eyeH = r * 0.33 * open;

  for (const side of [-1, 1] as const) {
    const ex = head.x + side * eyeDX;
    if (eyeH < r * 0.035) {
      // Closed: a happy upward arc, not a flat line.
      ctx.beginPath();
      ctx.moveTo(ex - eyeW, eyeY - 1);
      ctx.quadraticCurveTo(ex, eyeY + r * 0.1, ex + eyeW, eyeY - 1);
      ctx.strokeStyle = pal.eye;
      ctx.lineWidth = 2.3;
      ctx.lineCap = "round";
      ctx.stroke();
      continue;
    }
    // Sclera.
    ellipse(ctx, ex, eyeY, eyeW, eyeH);
    fillPath(ctx, "#fffdfe", pal.ink, 1.4);
    // Iris.
    const ix = ex + lx * eyeW * 0.3;
    const iy = eyeY + p.lookY * eyeH * 0.26;
    ellipse(ctx, ix, iy, eyeW * 0.74, eyeH * 0.86);
    fillPath(ctx, pal.eye);
    // Lower glow + two highlights: makes the eye look wet instead of flat.
    ellipse(ctx, ix, iy - eyeH * 0.32, eyeW * 0.5, eyeH * 0.32);
    fillPath(ctx, pal.eyeGlow);
    ellipse(ctx, ix - eyeW * 0.3, iy + eyeH * 0.34, eyeW * 0.26, eyeH * 0.24);
    fillPath(ctx, "#ffffff");
    ellipse(ctx, ix + eyeW * 0.34, iy - eyeH * 0.3, eyeW * 0.14, eyeH * 0.13);
    fillPath(ctx, "#ffffff");
    // Upper lash line, above the eye.
    ctx.beginPath();
    ctx.moveTo(ex - eyeW * 1.1, eyeY + eyeH * 0.55);
    ctx.quadraticCurveTo(ex, eyeY + eyeH * 1.45, ex + eyeW * 1.1, eyeY + eyeH * 0.55);
    ctx.strokeStyle = pal.eye;
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  // Brows, above the eyes.
  for (const side of [-1, 1] as const) {
    const bx = head.x + side * eyeDX;
    const by = eyeY + r * 0.42 + p.brow * r * 0.07;
    ctx.beginPath();
    ctx.moveTo(bx - eyeW * 0.9, by - p.brow * 1.3 * side);
    ctx.quadraticCurveTo(bx, by + r * 0.05, bx + eyeW * 0.9, by + p.brow * 1.3 * side);
    ctx.strokeStyle = pal.hairDark;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();

    // Sanji's spiral curl on the eyebrow tip
    if (look.features.spiralBrow && side === 1) {
      ctx.beginPath();
      const sx = bx + eyeW * 0.9;
      const sy = by + p.brow * 1.3 * side;
      ctx.arc(sx + 2.4, sy + 1.2, 2.2, Math.PI, Math.PI * 3);
      ctx.stroke();
    }
  }

  // Blush, below and outside the eyes.
  if (p.blush > 0.02) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.8, p.blush * 0.8);
    for (const side of [-1, 1] as const) {
      ellipse(ctx, head.x + side * r * 0.66, eyeY - r * 0.3, r * 0.19, r * 0.1);
      fillPath(ctx, pal.blush);
    }
    ctx.restore();
  }

  // Luffy's eye scar under left eye (character's left, viewer's right)
  if (look.features.eyeScar) {
    const sx = head.x + eyeDX;
    const sy = eyeY - eyeH * 0.95;
    ctx.save();
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sx - eyeW * 0.55, sy + 1.2);
    ctx.quadraticCurveTo(sx, sy - 2.5, sx + eyeW * 0.55, sy + 1.2);
    ctx.stroke();
    for (const off of [-eyeW * 0.25, eyeW * 0.25]) {
      ctx.beginPath();
      ctx.moveTo(sx + off, sy - 3.2);
      ctx.lineTo(sx + off, sy + 3.2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Zoro's triple gold hoop earrings
  if (look.features.tripleEarrings) {
    const ex = head.x - r * 0.95;
    const ey = head.y - r * 0.08;
    ctx.save();
    ctx.strokeStyle = "#f1c40f";
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(ex - 2 + i * 2.4, ey);
      ctx.lineTo(ex - 2 + i * 2.4, ey - 7.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Chopper's blue nose
  if (look.features.blueNose) {
    ellipse(ctx, head.x, head.y - r * 0.46, 5, 3.8);
    fillPath(ctx, "#2980b9", pal.ink, 1.4);
    ellipse(ctx, head.x - 1.2, head.y - r * 0.44, 1.5, 1);
    fillPath(ctx, "#ffffffaa");
  }

  // Mouth, low on the face.
  if (look.features.wideGrin) {
    // Luffy's iconic wide toothy crescent grin
    const my = head.y - r * 0.62;
    const mw = r * 0.52;
    const mh = r * 0.22;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(head.x - mw, my + mh * 0.3);
    ctx.quadraticCurveTo(head.x, my + mh * 0.85, head.x + mw, my + mh * 0.3);
    ctx.quadraticCurveTo(head.x, my - mh * 1.2, head.x - mw, my + mh * 0.3);
    ctx.closePath();
    fillPath(ctx, "#ffffff", pal.ink, 2.2);

    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.2;
    for (const tx of [-mw * 0.52, -mw * 0.18, mw * 0.18, mw * 0.52]) {
      ctx.beginPath();
      ctx.moveTo(head.x + tx, my + mh * 0.45);
      ctx.lineTo(head.x + tx * 0.8, my - mh * 0.65);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(head.x - mw * 0.82, my - mh * 0.05);
    ctx.quadraticCurveTo(head.x, my - mh * 0.05, head.x + mw * 0.82, my - mh * 0.05);
    ctx.stroke();
    ctx.restore();
  } else {
    const my = head.y - r * 0.62;
    const mw = r * 0.1 + p.mouthOpen * r * 0.1;
    if (p.mouthOpen > 0.12) {
      ellipse(ctx, head.x, my, mw, r * 0.05 + p.mouthOpen * r * 0.11);
      fillPath(ctx, pal.mouth, pal.ink, 1.3);
    } else {
      const curve = p.smile * r * 0.12;
      ctx.beginPath();
      ctx.moveTo(head.x - mw, my + curve * 0.35);
      ctx.quadraticCurveTo(head.x, my - curve, head.x + mw, my + curve * 0.35);
      ctx.strokeStyle = pal.mouth;
      ctx.lineWidth = 1.9;
      ctx.lineCap = "round";
      ctx.stroke();
    }
  }

  // --- mask / visor, over the face -----------------------------------------
  const mask = look.features.mask ?? "none";
  if (mask === "visor") {
    ctx.beginPath();
    ctx.moveTo(head.x - r * 0.92, eyeY + r * 0.3);
    ctx.lineTo(head.x + r * 0.92, eyeY + r * 0.3);
    ctx.lineTo(head.x + r * 0.78, eyeY - r * 0.34);
    ctx.lineTo(head.x - r * 0.78, eyeY - r * 0.34);
    ctx.closePath();
    fillPath(ctx, pal.hairDark, pal.ink, 2);
    ctx.beginPath();
    ctx.moveTo(head.x - r * 0.6, eyeY);
    ctx.lineTo(head.x + r * 0.6, eyeY);
    ctx.strokeStyle = pal.eye;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.stroke();
  } else if (look.id === "shinobi") {
    // Kiba: Authentic Ninja Forehead Protector (Hitai-ate) and red fang cheek marks.
    // Navy fabric headband tied across the forehead above the eyes.
    ctx.beginPath();
    ctx.moveTo(head.x - r * 0.96, head.y + r * 0.42);
    ctx.lineTo(head.x + r * 0.96, head.y + r * 0.42);
    ctx.lineTo(head.x + r * 0.92, head.y + r * 0.82);
    ctx.lineTo(head.x - r * 0.92, head.y + r * 0.82);
    ctx.closePath();
    fillPath(ctx, pal.collar, pal.ink, 2);

    // Silver metal protector plate in the center
    const plateW = r * 0.95;
    const plateH = r * 0.32;
    const plateY = head.y + r * 0.46;
    ctx.beginPath();
    ctx.roundRect(head.x - plateW / 2, plateY, plateW, plateH, 3);
    fillPath(ctx, "#d8dde6", pal.ink, 1.6);

    // Engraved leaf symbol & corner rivets
    ctx.fillStyle = "#8a93a5";
    for (const [rx, ry] of [
      [head.x - plateW / 2 + 3, plateY + 3],
      [head.x + plateW / 2 - 3, plateY + 3],
      [head.x - plateW / 2 + 3, plateY + plateH - 3],
      [head.x + plateW / 2 - 3, plateY + plateH - 3],
    ]) {
      ctx.beginPath();
      ctx.arc(rx, ry, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Engraved ninja spiral insignia
    ctx.beginPath();
    ctx.arc(head.x, plateY + plateH / 2, 3, 0, Math.PI * 1.6);
    ctx.strokeStyle = "#60687a";
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // Red fang facial markings on both cheeks
    for (const side of [-1, 1] as const) {
      const markX = head.x + side * r * 0.62;
      const markY = head.y - r * 0.22;
      ctx.beginPath();
      ctx.moveTo(markX - 2.5, markY);
      ctx.lineTo(markX + 2.5, markY);
      ctx.lineTo(markX, markY - 9);
      ctx.closePath();
      fillPath(ctx, "#c42a2a", pal.ink, 1);
    }
  } else if (mask === "domino" || mask === "cowl") {
    if (mask === "cowl") {
      // Cowl covers the entire skull down to the brow and cheeks.
      // Use hairDark for rich charcoal/slate contrast against pale skin.
      ctx.beginPath();
      ctx.ellipse(head.x, head.y, r * 1.03, r * 1.09, 0, Math.PI, 0, false);
      ctx.lineTo(head.x + r * 1.02, eyeY + r * 0.12);
      ctx.lineTo(head.x - r * 1.02, eyeY + r * 0.12);
      ctx.closePath();
      fillPath(ctx, pal.hairDark, pal.ink, 2);

      // Pointed bat cowl ears
      for (const side of [-1, 1] as const) {
        ctx.beginPath();
        ctx.moveTo(head.x + side * r * 0.44, head.y + r * 0.9);
        ctx.lineTo(head.x + side * r * 0.64, head.y + r * 1.54);
        ctx.lineTo(head.x + side * r * 0.78, head.y + r * 0.82);
        ctx.closePath();
        fillPath(ctx, pal.hairDark, pal.ink, 1.8);
      }
    }

    ctx.beginPath();
    ctx.moveTo(head.x - r * 0.95, eyeY + r * 0.45);
    ctx.quadraticCurveTo(head.x, eyeY + r * 0.68, head.x + r * 0.95, eyeY + r * 0.45);
    ctx.lineTo(head.x + r * 0.9, eyeY - r * 0.32);
    ctx.quadraticCurveTo(head.x, eyeY - r * 0.12, head.x - r * 0.9, eyeY - r * 0.32);
    ctx.closePath();
    fillPath(ctx, mask === "cowl" ? pal.hairDark : pal.dress, pal.ink, 2);

    if (mask === "cowl") {
      // High-contrast angled cowl white eye lenses
      for (const side of [-1, 1] as const) {
        const lx = head.x + side * eyeDX;
        ctx.beginPath();
        ctx.moveTo(lx - side * eyeW * 0.6, eyeY - 2.5);
        ctx.lineTo(lx + side * eyeW * 0.65, eyeY + 4);
        ctx.lineTo(lx - side * eyeW * 0.35, eyeY + 5.5);
        ctx.closePath();
        fillPath(ctx, "#ffffff", pal.ink, 1.4);
      }
    } else {
      for (const side of [-1, 1] as const) {
        ellipse(ctx, head.x + side * eyeDX, eyeY, eyeW * 0.95, Math.max(2, eyeH * 0.8));
        fillPath(ctx, "#f4f6ff");
      }
    }
  }

  if (look.features.antenna) {
    ctx.beginPath();
    ctx.moveTo(head.x, head.y + r * 1.05);
    ctx.lineTo(head.x + r * 0.12, head.y + r * 1.5);
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.stroke();
    ellipse(ctx, head.x + r * 0.13, head.y + r * 1.56, 4.5, 4.5);
    fillPath(ctx, pal.eye, pal.ink, 1.6);
  }
}

function drawStrawHatBack(ctx: CanvasRenderingContext2D, head: Vec2, r: number, pal: Palette) {
  // Straw hat brim behind head
  // A brim seen from the front is a WIDE, SHALLOW ellipse. It used to be r*1.58 x
  // r*1.38 - almost circular - which read as a giant disc, swamped the silhouette and
  // pushed the hat to head.y + 1.83r, far above every other character's hair.
  const hatY = head.y + r * 0.6;
  const brimRx = r * 1.24;
  const brimRy = r * 0.4;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(head.x, hatY, brimRx, brimRy, 0, 0, Math.PI * 2);
  fillPath(ctx, "#f2cf58", pal.ink, 2.4);

  // Woven straw texture concentric rings
  ctx.strokeStyle = "#cca633";
  ctx.lineWidth = 1.3;
  for (const factor of [0.72, 0.88, 1.05, 1.22, 1.38]) {
    ctx.beginPath();
    ctx.ellipse(head.x, hatY, brimRx * factor * 0.7, brimRy * factor * 0.7, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Radial straw hatch lines
  ctx.lineWidth = 1.1;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 10) {
    ctx.beginPath();
    ctx.moveTo(head.x + Math.cos(a) * brimRx * 0.58, hatY + Math.sin(a) * brimRy * 0.58);
    ctx.lineTo(head.x + Math.cos(a) * brimRx * 0.96, hatY + Math.sin(a) * brimRy * 0.96);
    ctx.stroke();
  }
  // Subtle inner brim shadow
  ctx.globalAlpha = 0.22;
  ctx.beginPath();
  ctx.ellipse(head.x, hatY, brimRx * 0.8, brimRy * 0.8, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#876611";
  ctx.fill();
  ctx.restore();
}





function drawStrawHatFront(ctx: CanvasRenderingContext2D, head: Vec2, r: number, pal: Palette) {
  const hatY = head.y + r * 0.6;
  ctx.save();
  // Crown dome. Top lands at head.y + 1.12r, just proud of the crown (head.y + r) and
  // in line with the other characters' hair, so it does not clip at the frame top.
  ctx.beginPath();
  ctx.ellipse(head.x, hatY + r * 0.05, r * 0.78, r * 0.47, 0, Math.PI, 0, false);
  ctx.closePath();
  fillPath(ctx, "#f0cb54", pal.ink, 2.2);

  // Red band around the crown
  ctx.beginPath();
  ctx.ellipse(head.x, hatY + r * 0.07, r * 0.8, r * 0.18, 0, 0, Math.PI);
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#cc2222";
  ctx.lineCap = "round";
  ctx.stroke();

  ctx.restore();
}





function drawDoctorHat(ctx: CanvasRenderingContext2D, head: Vec2, r: number, pal: Palette) {
  // Chopper's doctor hat
  const hatY = head.y + r * 0.72;
  ellipse(ctx, head.x, hatY, r * 1.25, r * 0.35);
  fillPath(ctx, pal.collar, pal.ink, 2);
  ctx.beginPath();
  ctx.rect(head.x - r * 0.75, hatY, r * 1.5, r * 1.05);
  fillPath(ctx, pal.collar, pal.ink, 2);
  ellipse(ctx, head.x, hatY + r * 1.05, r * 0.75, r * 0.28);
  fillPath(ctx, pal.collar, pal.ink, 2);

  ctx.save();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4.8;
  ctx.lineCap = "round";
  const cy = hatY + r * 0.52;
  ctx.beginPath();
  ctx.moveTo(head.x - 10, cy - 10);
  ctx.lineTo(head.x + 10, cy + 10);
  ctx.moveTo(head.x + 10, cy - 10);
  ctx.lineTo(head.x - 10, cy + 10);
  ctx.stroke();
  ctx.restore();
}





function drawAntlers(ctx: CanvasRenderingContext2D, head: Vec2, r: number) {
  ctx.save();
  ctx.strokeStyle = "#4a2d18";
  ctx.lineWidth = 3.6;
  ctx.lineCap = "round";
  for (const side of [-1, 1] as const) {
    const ax = head.x + side * r * 0.8;
    const ay = head.y + r * 0.85;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(ax + side * 15, ay + 20, ax + side * 24, ay + 30);
    ctx.moveTo(ax + side * 12, ay + 15);
    ctx.lineTo(ax + side * 19, ay + 17);
    ctx.stroke();
  }
  ctx.restore();
}





/* ----------------------------------------------------------------- glass --- */

function drawGlass(ctx: CanvasRenderingContext2D, at: Vec2, tilt: number, pal: Palette) {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(-tilt * 1.5);
  ctx.beginPath();
  ctx.moveTo(-5, 6);
  ctx.lineTo(5, 6);
  ctx.lineTo(3.8, -7);
  ctx.lineTo(-3.8, -7);
  ctx.closePath();
  fillPath(ctx, "#d7eefb", "#7fb9d6", 1.5);
  ctx.beginPath();
  ctx.moveTo(-4.2, -1.5);
  ctx.lineTo(4.2, -1.5);
  ctx.strokeStyle = "#8fcfe8";
  ctx.lineWidth = 2.6;
  ctx.stroke();
  ctx.restore();
  void pal;
}

/* ------------------------------------------------------------------ body --- */

/* ----------------------------------------------------------------- luffy --- */

function drawLuffy(ctx: CanvasRenderingContext2D, p: Pose, look: CharacterLook) {
  const pal = look.palette;
  const sit = p.sit;
  const drop = sit * 26;
  const r = RIG.headR; // 27
  const hip: Vec2 = { x: RIG.hip.x, y: RIG.hip.y - drop };
  const shoulder: Vec2 = { x: RIG.shoulder.x, y: RIG.shoulder.y - drop };
  const head: Vec2 = { x: RIG.head.x, y: RIG.head.y - drop };

  const skin = pal.skin;
  const skinShade = pal.skinShade;
  const ink = pal.ink;
  const redVest = "#d32424";
  const blueDenim = "#27599e";
  const strawYellow = "#f5d342";
  const strawDark = "#caa028";
  const white = "#ffffff";

  // --- 1. FAR LEG (solves knee and foot) ---
  const hl = { x: hip.x - 7, y: hip.y };
  const legL = solveLimb(hl, -p.legL + sit * 0.9, RIG.thigh, -p.kneeL - sit * 1.2, RIG.shin);
  // Bare skin leg under shorts
  drawLimb(ctx, hl, legL.joint, legL.tip, 8.5, 7.5, 5.8, skinShade, ink);
  // Blue denim shorts on upper thigh
  capsule(ctx, hl, legL.joint, 9.5, 8.5, blueDenim, ink);
  // White rolled cuff at knee
  ellipse(ctx, legL.joint.x, legL.joint.y, 8.5, 3.8);
  fillPath(ctx, white, ink, 1.6);
  // Bare foot with straw sandal
  ellipse(ctx, legL.tip.x, legL.tip.y - 1, 7.8, 4.2);
  fillPath(ctx, skinShade, ink, 1.4);
  // Straw sandal sole
  ellipse(ctx, legL.tip.x, legL.tip.y - 2.5, 8.2, 2.8);
  fillPath(ctx, strawYellow, ink, 1.4);
  // Red V-strap
  ctx.save();
  ctx.strokeStyle = redVest;
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(legL.tip.x - 4, legL.tip.y - 2);
  ctx.lineTo(legL.tip.x, legL.tip.y + 1.5);
  ctx.lineTo(legL.tip.x + 4, legL.tip.y - 2);
  ctx.stroke();
  ctx.restore();

  // --- 2. NEAR LEG ---
  const hr = { x: hip.x + 7, y: hip.y };
  const legR = solveLimb(hr, p.legR + sit * 0.9, RIG.thigh, -p.kneeR - sit * 1.2, RIG.shin);
  drawLimb(ctx, hr, legR.joint, legR.tip, 9.0, 7.8, 6.0, skin, ink);
  capsule(ctx, hr, legR.joint, 10.0, 9.0, blueDenim, ink);
  ellipse(ctx, legR.joint.x, legR.joint.y, 9.0, 4.0);
  fillPath(ctx, white, ink, 1.6);
  ellipse(ctx, legR.tip.x, legR.tip.y - 1, 8.0, 4.4);
  fillPath(ctx, skin, ink, 1.4);
  ellipse(ctx, legR.tip.x, legR.tip.y - 2.5, 8.5, 3.0);
  fillPath(ctx, strawYellow, ink, 1.4);
  ctx.save();
  ctx.strokeStyle = redVest;
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(legR.tip.x - 4, legR.tip.y - 2);
  ctx.lineTo(legR.tip.x, legR.tip.y + 1.5);
  ctx.lineTo(legR.tip.x + 4, legR.tip.y - 2);
  ctx.stroke();
  ctx.restore();

  // Shorts pelvic block
  ctx.beginPath();
  ctx.moveTo(hip.x - 14, hip.y + 10);
  ctx.lineTo(hip.x + 14, hip.y + 10);
  ctx.lineTo(hip.x + 12, hip.y - 12);
  ctx.lineTo(hip.x - 12, hip.y - 12);
  ctx.closePath();
  fillPath(ctx, blueDenim, ink, 2.2);

  // Yellow rope sash tied at waist
  ctx.beginPath();
  ctx.rect(hip.x - 14.5, hip.y + 4, 29, 6.5);
  fillPath(ctx, strawYellow, ink, 1.8);
  // Sash knot hanging on side
  ctx.beginPath();
  ctx.rect(hip.x + 9, hip.y - 8, 5, 12);
  fillPath(ctx, strawYellow, ink, 1.5);

  // --- 3. TORSO (Bare chest with open red vest) ---
  // Neck
  capsule(
    ctx,
    { x: shoulder.x, y: shoulder.y + 2 },
    { x: head.x, y: head.y - r * 0.82 },
    5.5,
    6.0,
    skinShade,
    ink,
  );

  // Bare chest body contour
  ctx.beginPath();
  ctx.moveTo(hip.x - 13, hip.y + 10);
  ctx.quadraticCurveTo(hip.x - 14, shoulder.y - 6, shoulder.x - 13, shoulder.y + 2);
  ctx.quadraticCurveTo(shoulder.x, shoulder.y + 7, shoulder.x + 13, shoulder.y + 2);
  ctx.quadraticCurveTo(hip.x + 14, shoulder.y - 6, hip.x + 13, hip.y + 10);
  ctx.closePath();
  fillPath(ctx, skin, ink, 2.1);

  // Collarbone lines on bare chest
  ctx.save();
  ctx.strokeStyle = skinShade;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(shoulder.x - 8, shoulder.y - 2);
  ctx.quadraticCurveTo(shoulder.x, shoulder.y - 5, shoulder.x + 8, shoulder.y - 2);
  ctx.stroke();
  ctx.restore();

  // Red vest left panel
  ctx.beginPath();
  ctx.moveTo(shoulder.x - 13, shoulder.y + 2);
  ctx.lineTo(shoulder.x - 5, shoulder.y + 2);
  ctx.lineTo(shoulder.x - 4, shoulder.y - 6);
  ctx.lineTo(hip.x - 4, hip.y + 10);
  ctx.lineTo(hip.x - 13, hip.y + 10);
  ctx.quadraticCurveTo(hip.x - 14, shoulder.y - 6, shoulder.x - 13, shoulder.y + 2);
  ctx.closePath();
  fillPath(ctx, redVest, ink, 2.0);

  // Red vest right panel
  ctx.beginPath();
  ctx.moveTo(shoulder.x + 13, shoulder.y + 2);
  ctx.lineTo(shoulder.x + 5, shoulder.y + 2);
  ctx.lineTo(shoulder.x + 4, shoulder.y - 6);
  ctx.lineTo(hip.x + 4, hip.y + 10);
  ctx.lineTo(hip.x + 13, hip.y + 10);
  ctx.quadraticCurveTo(hip.x + 14, shoulder.y - 6, shoulder.x + 13, shoulder.y + 2);
  ctx.closePath();
  fillPath(ctx, redVest, ink, 2.0);

  // Small gold buttons on right vest panel
  for (const by of [shoulder.y - 2, shoulder.y - 10, hip.y + 12]) {
    ellipse(ctx, hip.x - 3, by, 1.8, 1.8);
    fillPath(ctx, strawYellow, ink, 1.0);
  }

  // Straw hat cord around neck with wooden bead
  ctx.save();
  ctx.strokeStyle = "#4a3518";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(shoulder.x - 9, shoulder.y + 2);
  ctx.quadraticCurveTo(shoulder.x, shoulder.y - 12, shoulder.x + 9, shoulder.y + 2);
  ctx.stroke();
  ellipse(ctx, shoulder.x, shoulder.y - 12, 2.4, 2.4);
  fillPath(ctx, redVest, ink, 0.8);
  ctx.restore();

  // --- 4. FAR ARM ---
  const sl = { x: shoulder.x - 11, y: shoulder.y - 1 };
  const armL = solveLimb(sl, -p.armL, RIG.upperArm, -p.elbowL, RIG.foreArm);
  drawLimb(ctx, sl, armL.joint, armL.tip, 6.5, 5.5, 4.2, skinShade, ink);
  ellipse(ctx, armL.tip.x, armL.tip.y, 4.5, 4.5);
  fillPath(ctx, skinShade, ink, 1.5);

  // --- 5. HEAD & HAT ---
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(p.headTilt);
  ctx.translate(-head.x, -head.y);

  // Straw hat back brim (wide, handsome ellipse sitting behind the head)
  const hatY = head.y + r * 0.45;
  ctx.beginPath();
  ctx.ellipse(head.x, hatY, r * 1.38, r * 0.52, 0, 0, Math.PI * 2);
  fillPath(ctx, strawYellow, ink, 2.4);
  // Concentric woven straw ring
  ctx.save();
  ctx.strokeStyle = strawDark;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(head.x, hatY, r * 1.15, r * 0.42, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(head.x, hatY, r * 0.85, r * 0.32, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Back spiky hair tufts behind ears
  for (const [hx, hy, hrx, hry] of [
    [head.x - r * 0.92, head.y + r * 0.1, 7, 10],
    [head.x + r * 0.92, head.y + r * 0.1, 7, 10],
    [head.x - r * 0.82, head.y + r * 0.35, 8, 12],
    [head.x + r * 0.82, head.y + r * 0.35, 8, 12],
  ]) {
    ellipse(ctx, hx, hy, hrx, hry);
    fillPath(ctx, "#141418");
  }

  // Face egg contour
  ctx.beginPath();
  ctx.moveTo(head.x, head.y - r * 0.98); // rounded chin
  ctx.bezierCurveTo(
    head.x + r * 0.62, head.y - r * 0.90,
    head.x + r * 0.98, head.y - r * 0.18,
    head.x + r * 0.96, head.y + r * 0.28,
  );
  ctx.bezierCurveTo(
    head.x + r * 0.92, head.y + r * 0.96,
    head.x - r * 0.92, head.y + r * 0.96,
    head.x - r * 0.96, head.y + r * 0.28,
  );
  ctx.bezierCurveTo(
    head.x - r * 0.98, head.y - r * 0.18,
    head.x - r * 0.62, head.y - r * 0.90,
    head.x, head.y - r * 0.98,
  );
  ctx.closePath();
  fillPath(ctx, skin, ink, 2.2);

  // Ears
  for (const side of [-1, 1] as const) {
    ellipse(ctx, head.x + side * r * 0.92, head.y - r * 0.04, 4.8, 7.5);
    fillPath(ctx, skin, ink, 1.8);
  }

  // Soft cheek blush
  ctx.save();
  ctx.globalAlpha = 0.35;
  ellipse(ctx, head.x - r * 0.58, head.y - r * 0.32, r * 0.18, r * 0.09);
  fillPath(ctx, "#f09490");
  ellipse(ctx, head.x + r * 0.58, head.y - r * 0.32, r * 0.18, r * 0.09);
  fillPath(ctx, "#f09490");
  ctx.restore();

  // --- EYES (Authentic shonen anime eyes) ---
  const eyeY = head.y - r * 0.18;
  const eyeDX = r * 0.44;
  const eyeW = r * 0.23;
  const eyeH = r * 0.27 * Math.max(0, Math.min(1.2, p.eyesOpen));

  for (const side of [-1, 1] as const) {
    const ex = head.x + side * eyeDX;
    if (eyeH < r * 0.04) {
      // Blinking / Happy eye curve
      ctx.beginPath();
      ctx.moveTo(ex - eyeW, eyeY);
      ctx.quadraticCurveTo(ex, eyeY + r * 0.12, ex + eyeW, eyeY);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.stroke();
      continue;
    }
    // Sclera
    ellipse(ctx, ex, eyeY, eyeW, eyeH);
    fillPath(ctx, "#ffffff", ink, 1.6);
    // Dark anime iris & pupil
    const ix = ex + p.lookX * eyeW * 0.25;
    const iy = eyeY + p.lookY * eyeH * 0.22;
    ellipse(ctx, ix, iy, eyeW * 0.72, eyeH * 0.82);
    fillPath(ctx, "#16161a");
    // Single bright, energetic white specular sparkle (signature shonen shine)
    ellipse(ctx, ix - eyeW * 0.25, iy + eyeH * 0.3, eyeW * 0.28, eyeH * 0.26);
    fillPath(ctx, "#ffffff");
    // Clean upper eyelid line
    ctx.beginPath();
    ctx.moveTo(ex - eyeW * 1.15, eyeY + eyeH * 0.7);
    ctx.quadraticCurveTo(ex, eyeY + eyeH * 1.3, ex + eyeW * 1.15, eyeY + eyeH * 0.7);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  // Eyebrows (Bold confident black eyebrows)
  for (const side of [-1, 1] as const) {
    const bx = head.x + side * eyeDX;
    const by = eyeY + r * 0.38 + p.brow * r * 0.08;
    ctx.beginPath();
    ctx.moveTo(bx - eyeW * 0.95, by - p.brow * 1.4 * side);
    ctx.quadraticCurveTo(bx, by + r * 0.06, bx + eyeW * 0.95, by + p.brow * 1.4 * side);
    ctx.strokeStyle = "#16161a";
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  // Stitched eye scar under left eye (viewer's right)
  const sx = head.x + eyeDX;
  const sy = eyeY - eyeH * 1.05;
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(sx - 6, sy + 0.5);
  ctx.quadraticCurveTo(sx, sy - 2.0, sx + 6, sy + 0.5);
  ctx.stroke();
  for (const off of [-2.6, 2.6]) {
    ctx.beginPath();
    ctx.moveTo(sx + off, sy - 2.8);
    ctx.lineTo(sx + off, sy + 2.8);
    ctx.stroke();
  }
  ctx.restore();

  // Nose: cute subtle nose notch
  ctx.beginPath();
  ctx.moveTo(head.x, eyeY - r * 0.15);
  ctx.lineTo(head.x + 1.8, eyeY - r * 0.32);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // --- MOUTH: Iconic Wide Cheerful Crescent Grin ---
  const my = head.y - r * 0.60;
  const mw = r * 0.48;
  const mh = r * 0.20;
  ctx.save();
  // Open smiling mouth contour
  ctx.beginPath();
  ctx.moveTo(head.x - mw, my + 1);
  ctx.quadraticCurveTo(head.x, my + mh * 0.35, head.x + mw, my + 1);
  ctx.quadraticCurveTo(head.x, my - mh * 1.35, head.x - mw, my + 1);
  ctx.closePath();
  fillPath(ctx, "#ffffff", ink, 2.2);

  // Subtle clean tooth dividers
  ctx.strokeStyle = "#e0d0c4";
  ctx.lineWidth = 1.1;
  for (const tx of [-mw * 0.5, -mw * 0.18, mw * 0.18, mw * 0.5]) {
    ctx.beginPath();
    ctx.moveTo(head.x + tx, my + mh * 0.15);
    ctx.lineTo(head.x + tx * 0.85, my - mh * 0.8);
    ctx.stroke();
  }
  // Soft horizontal tooth line
  ctx.beginPath();
  ctx.moveTo(head.x - mw * 0.8, my - mh * 0.25);
  ctx.quadraticCurveTo(head.x, my - mh * 0.2, head.x + mw * 0.8, my - mh * 0.25);
  ctx.stroke();

  // Smile corner dimple ticks
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(head.x - mw - 2, my + 3);
  ctx.lineTo(head.x - mw + 1, my - 1);
  ctx.moveTo(head.x + mw + 2, my + 3);
  ctx.lineTo(head.x + mw - 1, my - 1);
  ctx.stroke();
  ctx.restore();

  // --- STRAW HAT CROWN (domes UPWARD proudly on top of head) ---
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(head.x - r * 0.76, hatY);
  ctx.bezierCurveTo(
    head.x - r * 0.78, hatY + r * 0.78,
    head.x + r * 0.78, hatY + r * 0.78,
    head.x + r * 0.76, hatY
  );
  ctx.closePath();
  fillPath(ctx, strawYellow, ink, 2.2);

  // Red ribbon band around crown base
  ctx.beginPath();
  ctx.moveTo(head.x - r * 0.76, hatY + 1);
  ctx.quadraticCurveTo(head.x, hatY + r * 0.12, head.x + r * 0.76, hatY + 1);
  ctx.lineWidth = 6.0;
  ctx.strokeStyle = redVest;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();

  // --- FRONT BLACK SPIKY HAIR BANGS (hang naturally from under the hat brim) ---
  ctx.save();
  ctx.fillStyle = "#16161a";
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.8;
  for (const [bx, by, bw, bh] of [
    [-r * 0.65, hatY - r * 0.08, 12, 16],
    [-r * 0.35, hatY - r * 0.14, 14, 20],
    [-r * 0.05, hatY - r * 0.16, 15, 22],
    [ r * 0.28, hatY - r * 0.14, 14, 20],
    [ r * 0.60, hatY - r * 0.08, 12, 16],
  ]) {
    ctx.beginPath();
    ctx.moveTo(head.x + bx - bw * 0.6, by);
    ctx.lineTo(head.x + bx, by - bh);
    ctx.lineTo(head.x + bx + bw * 0.6, by);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  ctx.restore(); // restore head tilt

  // --- 6. NEAR ARM ---
  const sr = { x: shoulder.x + 11, y: shoulder.y - 1 };
  const armR = solveLimb(sr, p.armR, RIG.upperArm, p.elbowR, RIG.foreArm);
  drawLimb(ctx, sr, armR.joint, armR.tip, 7.0, 5.8, 4.4, skin, ink);
  ellipse(ctx, armR.tip.x, armR.tip.y, 4.8, 4.8);
  fillPath(ctx, skin, ink, 1.6);
}

/* ------------------------------------------------------------------- dog --- */

/**
 * Quadruped rig. Reuses the same `Pose`: the arm joints drive the FRONT legs and the
 * leg joints drive the BACK legs, so walking, sitting, cheering and sleeping all work
 * from the existing pose library without a second animation set.
 */
function drawDog(ctx: CanvasRenderingContext2D, p: Pose, look: CharacterLook) {
  const pal = look.palette;
  const sit = p.sit;
  // Body sits lower and longer than the humanoid.
  const backY = 78 - sit * 16;
  const chestX = 26;
  const rumpX = -28;
  const headC: Vec2 = { x: chestX + 20, y: backY + 34 - sit * 4 };
  const hr = 25;

  // Tail, behind everything, wagging with the hair spring.
  const wag = p.hairSway * 1.6 + 0.25 * Math.sin(p.hairPhase * 3);
  let at: Vec2 = { x: rumpX - 2, y: backY + 6 };
  let acc = -1.1 + wag;
  for (const seg of [{ len: 15, w: 6 }, { len: 13, w: 4.4 }, { len: 10, w: 2.8 }]) {
    acc += 0.22 + wag * 0.5;
    const next = { x: at.x + seg.len * Math.sin(acc), y: at.y - seg.len * Math.cos(acc) };
    capsule(ctx, at, next, seg.w, seg.w * 0.7, pal.hair, pal.hairDark);
    at = next;
  }

  // Far legs (darker).
  for (const leg of [
    { x: chestX, hipA: -p.armL, knee: p.elbowL },
    { x: rumpX, hipA: -p.legL, knee: p.kneeL },
  ]) {
    const origin = { x: leg.x - 7, y: backY };
    const r1 = solveLimb(origin, leg.hipA + sit * 0.9, 34, -leg.knee - sit * 1.2, 32);
    const farFur = shade(pal.hair);
    drawLimb(ctx, origin, r1.joint, r1.tip, 7, 6, 4.6, farFur, pal.ink);
    ellipse(ctx, r1.tip.x + 2, r1.tip.y - 1, 6, 4);
    fillPath(ctx, farFur, pal.ink, 1.6);
  }

  // Body: a long rounded barrel from rump to chest.
  ctx.beginPath();
  ctx.moveTo(rumpX - 10, backY + 2);
  ctx.quadraticCurveTo(rumpX - 14, backY + 20, rumpX + 6, backY + 22);
  ctx.lineTo(chestX - 2, backY + 22);
  ctx.quadraticCurveTo(chestX + 16, backY + 20, chestX + 14, backY + 2);
  ctx.quadraticCurveTo(chestX + 10, backY - 12, chestX - 6, backY - 11);
  ctx.lineTo(rumpX + 6, backY - 11);
  ctx.quadraticCurveTo(rumpX - 8, backY - 10, rumpX - 10, backY + 2);
  ctx.closePath();
  fillPath(ctx, pal.hair, pal.ink, 2.2);

  // Belly patch.
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.ellipse(0, backY - 4, 22, 9, 0, 0, Math.PI * 2);
  fillPath(ctx, pal.hairLight);
  ctx.restore();

  // Near legs.
  for (const leg of [
    { x: chestX, hipA: p.armR, knee: p.elbowR },
    { x: rumpX, hipA: p.legR, knee: p.kneeR },
  ]) {
    const origin = { x: leg.x + 5, y: backY };
    const r1 = solveLimb(origin, leg.hipA + sit * 0.9, 34, -leg.knee - sit * 1.2, 32);
    drawLimb(ctx, origin, r1.joint, r1.tip, 7.5, 6.4, 5, pal.hair, pal.ink);
    ellipse(ctx, r1.tip.x + 2, r1.tip.y - 1, 6.4, 4.2);
    fillPath(ctx, pal.hairLight, pal.ink, 1.6);
  }

  // Collar.
  ctx.beginPath();
  ctx.ellipse(chestX + 6, backY + 14, 9, 4.5, -0.3, 0, Math.PI * 2);
  fillPath(ctx, pal.dress, pal.ink, 1.8);

  // Head.
  ctx.save();
  ctx.translate(headC.x, headC.y);
  ctx.rotate(p.headTilt * 0.7);
  ctx.translate(-headC.x, -headC.y);

  ellipse(ctx, headC.x, headC.y, hr, hr * 0.92);
  fillPath(ctx, pal.hair, pal.ink, 2.2);

  // Muzzle.
  ctx.beginPath();
  ctx.ellipse(headC.x + hr * 0.72, headC.y - hr * 0.3, hr * 0.5, hr * 0.36, 0, 0, Math.PI * 2);
  fillPath(ctx, pal.hairLight, pal.ink, 2);
  ellipse(ctx, headC.x + hr * 1.12, headC.y - hr * 0.26, 4.4, 3.4);
  fillPath(ctx, pal.ink);
  // Mouth.
  ctx.beginPath();
  ctx.moveTo(headC.x + hr * 0.95, headC.y - hr * 0.5);
  ctx.quadraticCurveTo(headC.x + hr * 0.7, headC.y - hr * 0.72 - p.smile * 4, headC.x + hr * 0.45, headC.y - hr * 0.5);
  ctx.strokeStyle = pal.mouth;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.stroke();

  // Floppy ears.
  if (look.features.floppyEars) {
    for (const side of [-1, 1] as const) {
      const ex = headC.x - hr * 0.35 + side * hr * 0.1;
      ctx.beginPath();
      ctx.moveTo(ex, headC.y + hr * 0.75);
      ctx.quadraticCurveTo(ex - hr * 0.7, headC.y + hr * 0.2, ex - hr * 0.5, headC.y - hr * 0.75);
      ctx.quadraticCurveTo(ex + hr * 0.1, headC.y - hr * 0.5, ex + hr * 0.2, headC.y + hr * 0.6);
      ctx.closePath();
      fillPath(ctx, side < 0 ? pal.hairDark : pal.hair, pal.ink, 1.9);
    }
  }

  // Eyes.
  const open = Math.max(0, Math.min(1.2, p.eyesOpen));
  const eh = hr * 0.3 * open;
  for (const side of [-1, 1] as const) {
    const ex = headC.x + hr * 0.18 + side * hr * 0.3;
    if (eh < hr * 0.04) {
      ctx.beginPath();
      ctx.moveTo(ex - 5, headC.y + hr * 0.14);
      ctx.quadraticCurveTo(ex, headC.y + hr * 0.3, ex + 5, headC.y + hr * 0.14);
      ctx.strokeStyle = pal.eye;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      continue;
    }
    ellipse(ctx, ex, headC.y + hr * 0.14, hr * 0.2, eh);
    fillPath(ctx, pal.eye, pal.ink, 1.3);
    ellipse(ctx, ex - hr * 0.06, headC.y + hr * 0.2, hr * 0.07, eh * 0.4);
    fillPath(ctx, "#ffffff");
  }
  ctx.restore();
}





export interface DrawOptions {
  facingRight: boolean;
  look: CharacterLook;
}

export function drawHana(
  ctx: CanvasRenderingContext2D,
  p: Pose,
  { facingRight, look }: DrawOptions,
) {
  const facing = facingRight ? 1 : -1;
  if (look.bodyPlan === "dog") {
    ctx.save();
    const sh = Math.max(0.45, 1 - p.lift / 150);
    ctx.globalAlpha = 0.2 * sh;
    ellipse(ctx, 0, 2, 38 * sh, 6 * sh);
    fillPath(ctx, "#000000");
    ctx.restore();
    ctx.save();
    ctx.scale(facing, 1);
    ctx.translate(0, p.lift);
    ctx.rotate(p.lean);
    ctx.scale(1, p.squash);
    drawDog(ctx, p, look);
    ctx.restore();
    return;
  }

  if (look.bodyPlan === "reindeer") {
    ctx.save();
    const sh = Math.max(0.45, 1 - p.lift / 150);
    ctx.globalAlpha = 0.2 * sh;
    ellipse(ctx, 0, 2, 34 * sh, 5.8 * sh);
    fillPath(ctx, "#000000");
    ctx.restore();
    ctx.save();
    ctx.scale(facing, 1);
    ctx.translate(0, p.lift);
    ctx.rotate(p.lean);
    ctx.scale(1, p.squash);
    drawReindeer(ctx, p, look);
    ctx.restore();
    return;
  }

  if (look.id === "luffy") {
    ctx.save();
    const sh = Math.max(0.45, 1 - p.lift / 150);
    ctx.globalAlpha = 0.2 * sh;
    ellipse(ctx, 0, 2, 34 * sh, 5.8 * sh);
    fillPath(ctx, "#000000");
    ctx.restore();
    ctx.save();
    ctx.scale(facing, 1);
    ctx.translate(0, p.lift);
    ctx.rotate(p.lean);
    ctx.scale(1, p.squash);
    drawLuffy(ctx, p, look);
    ctx.restore();
    return;
  }

  const pal = look.palette;
  const drop = p.sit * 26;
  // Per-character proportions: without these, every humanoid is the same body in a
  // different palette. Feet are at y = 0 so scaling about the origin keeps the baseline.
  const bd = buildFor(look.id);
  const r = RIG.headR * bd.head;
  const boxy = Boolean(look.features.boxy);

  // Contact shadow: stays on the ground and shrinks as she lifts off.
  ctx.save();
  const sh = Math.max(0.45, 1 - p.lift / 150);
  ctx.globalAlpha = 0.2 * sh;
  ellipse(ctx, 0, 2, 30 * sh, 5.5 * sh);
  fillPath(ctx, "#000000");
  ctx.restore();

  ctx.save();
  ctx.scale(facing, 1);
  ctx.translate(0, p.lift);
  ctx.rotate(p.lean);
  ctx.scale(1, p.squash);
  ctx.scale(bd.width, bd.height);

  const hip: Vec2 = { x: RIG.hip.x, y: RIG.hip.y - drop };
  const shoulder: Vec2 = { x: RIG.shoulder.x, y: RIG.shoulder.y - drop };
  const head: Vec2 = { x: RIG.head.x, y: RIG.head.y - drop };

  if (look.features.cape) {
    const sway = p.skirtSway * 10 - p.lean * 14;
    ctx.beginPath();
    ctx.moveTo(shoulder.x - 15, shoulder.y + 4);
    ctx.quadraticCurveTo(shoulder.x - 30 + sway, hip.y - 10, hip.x - 22 + sway * 1.6, 6);
    ctx.quadraticCurveTo(hip.x, 14, hip.x + 22 + sway * 1.6, 6);
    ctx.quadraticCurveTo(shoulder.x + 30 + sway, hip.y - 10, shoulder.x + 15, shoulder.y + 4);
    ctx.closePath();
    fillPath(ctx, pal.shoe, pal.shoeDark, 2.2);
  }

  if (look.hairStyle !== "none") backHair(ctx, head, r, p, pal);
  hairStyle(ctx, head, r, p, look, "back");

  // --- legs (far leg first) ---
  for (const leg of [
    { dx: -6, hipA: -p.legL, knee: p.kneeL, far: true },
    { dx: 6, hipA: p.legR, knee: p.kneeR, far: false },
  ]) {
    const origin = { x: hip.x + leg.dx, y: hip.y };
    const hipAngle = leg.hipA + p.sit * 1.1;
    const { joint, tip, tipAngle } = solveLimb(
      origin,
      hipAngle,
      RIG.thigh,
      -leg.knee - p.sit * 1.25,
      RIG.shin,
    );
    // Characters in shorts have BARE legs below the hem. `tights` holds their shorts
    // denim, not legwear, so painting the whole limb with it drew full-length trousers
    // with the rolled cuff stranded halfway down. Far side uses the palette's own
    // shadow tone, never shade(skin) - that is the muddy-brown arm bug.
    const bare = look.features.cuffedShorts || look.outfit === "vest";
    const col = leg.far
      ? bare
        ? pal.skinShade
        : shade(pal.tights)
      : bare
        ? pal.skin
        : pal.tights;
    drawLimb(ctx, origin, joint, tip, 8.5, 7, 5, col, pal.ink, boxy);

    if (look.features.sandals) {
      // Zōri straw sandals with red rope straps (Luffy)
      ctx.save();
      ctx.translate(tip.x, tip.y);
      ctx.rotate(tipAngle);
      ctx.beginPath();
      ctx.moveTo(-6, 2.5);
      ctx.lineTo(8.5, 2.5);
      ctx.lineTo(8.5, -2.5);
      ctx.lineTo(-6, -2.5);
      ctx.closePath();
      fillPath(ctx, "#d8b265", pal.ink, 1.8);
      // Red thong V-strap
      ctx.beginPath();
      ctx.moveTo(3, 2.5);
      ctx.lineTo(6.5, 6.5);
      ctx.moveTo(3, 2.5);
      ctx.lineTo(0.5, 6.5);
      ctx.strokeStyle = "#d32424";
      ctx.lineWidth = 2.0;
      ctx.stroke();
      ctx.restore();
    } else {
      // Shoe, aligned to the shin.
      ctx.save();
      ctx.translate(tip.x, tip.y);
      ctx.rotate(tipAngle);
      ctx.beginPath();
      ctx.moveTo(-5.5, 2);
      ctx.quadraticCurveTo(-7, -5.5, 0.5, -6);
      ctx.quadraticCurveTo(8.5, -6.5, 7.5, 1.5);
      ctx.quadraticCurveTo(3.5, 3.5, -5.5, 2);
      ctx.closePath();
      fillPath(ctx, leg.far ? shade(pal.shoe) : pal.shoe, pal.shoeDark, 1.8);
      ctx.restore();
    }
  }

  // --- lower garment -------------------------------------------------------
  const skirted = look.outfit === "pinafore" || look.outfit === "dress" || look.outfit === "hoodie";
  const flare = 1 + Math.abs(p.skirtSway) * 0.45;
  ctx.beginPath();
  ctx.moveTo(hip.x - 14, hip.y + 12);
  ctx.quadraticCurveTo(
    hip.x - 25 * flare + p.skirtSway * 6, hip.y - 6,
    hip.x - 23 * flare + p.skirtSway * 10, hip.y - 17,
  );
  ctx.quadraticCurveTo(hip.x, hip.y - 23, hip.x + 23 * flare + p.skirtSway * 10, hip.y - 17);
  ctx.quadraticCurveTo(
    hip.x + 25 * flare + p.skirtSway * 6, hip.y - 6,
    hip.x + 14, hip.y + 12,
  );
  ctx.closePath();
  if (skirted) fillPath(ctx, pal.dress, pal.ink, 2.1);
  else ctx.beginPath(); // discard the skirt path for trousers/bodysuit

  if (look.outfit === "shorts") {
    for (const side of [-1, 1] as const) {
      ctx.beginPath();
      ctx.rect(hip.x + side * 13 - 9, hip.y - 14, 18, 26);
      fillPath(ctx, pal.dress, pal.ink, 2);
    }
  }

  if (look.features.cuffedShorts || look.outfit === "vest") {
    // Denim shorts with rolled white cuffs (Luffy)
    for (const side of [-1, 1] as const) {
      ctx.beginPath();
      ctx.rect(hip.x + side * 13 - 10, hip.y - 13, 20, 25);
      fillPath(ctx, pal.tights, pal.ink, 2);
      ctx.beginPath();
      ctx.rect(hip.x + side * 13 - 11, hip.y - 15, 22, 5.5);
      fillPath(ctx, "#ffffff", pal.ink, 1.6);
    }
  }

  if (look.outfit === "jeans") {
    // Denim jeans (Nami)
    for (const side of [-1, 1] as const) {
      ctx.beginPath();
      ctx.rect(hip.x + side * 13 - 9, hip.y - 15, 18, 27);
      fillPath(ctx, pal.tights, pal.ink, 2);
    }
  }

  if (look.features.haramaki) {
    // Zoro's green belly-band haramaki
    ctx.beginPath();
    ctx.rect(hip.x - 14.5, hip.y - 3, 29, 15);
    fillPath(ctx, pal.collar, pal.ink, 2.0);
    ctx.strokeStyle = shade(pal.collar, 0.85);
    ctx.lineWidth = 1.2;
    for (const px of [-7, 0, 7]) {
      ctx.beginPath();
      ctx.moveTo(hip.x + px, hip.y - 3);
      ctx.lineTo(hip.x + px, hip.y + 12);
      ctx.stroke();
    }
  }

  if (look.features.threeSwords) {
    // Zoro's three katana scabbards tucked into his right hip sash
    ctx.save();
    ctx.translate(hip.x - 12, hip.y + 8);
    ctx.rotate(0.38);
    const scabbards = [
      { body: "#fdfefe", tsuba: "#f5d342", tsuka: "#fdfefe" }, // Wado Ichimonji
      { body: "#9e1b1b", tsuba: "#caa033", tsuka: "#181818" }, // Sandai Kitetsu
      { body: "#202025", tsuba: "#9b722b", tsuka: "#181818" }, // Shusui
    ];
    for (let i = 0; i < 3; i++) {
      const sx = i * 4.2 - 4.2;
      const s = scabbards[i];
      // Scabbard blade
      ctx.beginPath();
      ctx.rect(sx - 1.8, -26, 3.6, 30);
      fillPath(ctx, s.body, pal.ink, 1.2);
      // Gold oval tsuba (guard)
      ellipse(ctx, sx, 4.5, 3.8, 1.8);
      fillPath(ctx, s.tsuba, pal.ink, 1.0);
      // Tsuka (hilt)
      ctx.beginPath();
      ctx.rect(sx - 1.5, 5, 3, 10);
      fillPath(ctx, s.tsuka, pal.ink, 1.0);
    }
    ctx.restore();
  }

  // --- torso ---
  // Neck, drawn before the torso so the torso overlaps its base.
  capsule(
    ctx,
    { x: shoulder.x, y: shoulder.y + 2 },
    { x: head.x, y: head.y - r * 0.82 },
    6,
    6.5,
    shade(pal.skin, 0.9),
    pal.ink,
  );

  if (look.outfit === "vest") {
    // Luffy's red sleeveless open vest over bare chest
    ctx.beginPath();
    ctx.moveTo(hip.x - 14, hip.y + 11);
    ctx.quadraticCurveTo(hip.x - 15, shoulder.y - 6, shoulder.x - 14, shoulder.y + 2);
    ctx.quadraticCurveTo(shoulder.x, shoulder.y + 8, shoulder.x + 14, shoulder.y + 2);
    ctx.quadraticCurveTo(hip.x + 15, shoulder.y - 6, hip.x + 14, hip.y + 11);
    ctx.closePath();
    fillPath(ctx, pal.skin, pal.ink, 2.1);

    // Left vest panel
    ctx.beginPath();
    ctx.moveTo(shoulder.x - 14, shoulder.y + 2);
    ctx.lineTo(shoulder.x - 5, shoulder.y + 2);
    ctx.lineTo(shoulder.x - 3, shoulder.y - 8);
    ctx.lineTo(hip.x - 3, hip.y + 11);
    ctx.lineTo(hip.x - 14, hip.y + 11);
    ctx.quadraticCurveTo(hip.x - 15, shoulder.y - 6, shoulder.x - 14, shoulder.y + 2);
    ctx.closePath();
    fillPath(ctx, pal.dress, pal.ink, 2);

    // Right vest panel
    ctx.beginPath();
    ctx.moveTo(shoulder.x + 14, shoulder.y + 2);
    ctx.lineTo(shoulder.x + 5, shoulder.y + 2);
    ctx.lineTo(shoulder.x + 3, shoulder.y - 8);
    ctx.lineTo(hip.x + 3, hip.y + 11);
    ctx.lineTo(hip.x + 14, hip.y + 11);
    ctx.quadraticCurveTo(hip.x + 15, shoulder.y - 6, shoulder.x + 14, shoulder.y + 2);
    ctx.closePath();
    fillPath(ctx, pal.dress, pal.ink, 2);

    // Gold buttons
    for (const by of [shoulder.y - 3, shoulder.y - 11, hip.y + 14]) {
      ellipse(ctx, hip.x - 2, by, 1.8, 1.8);
      fillPath(ctx, "#f5d342", pal.ink, 1.2);
    }
  } else if (look.outfit === "suit") {
    // Sanji's tailored double-breasted suit with blue shirt and dark tie
    ctx.beginPath();
    ctx.moveTo(hip.x - 14, hip.y + 11);
    ctx.quadraticCurveTo(hip.x - 15, shoulder.y - 6, shoulder.x - 14, shoulder.y + 2);
    ctx.quadraticCurveTo(shoulder.x, shoulder.y + 8, shoulder.x + 14, shoulder.y + 2);
    ctx.quadraticCurveTo(hip.x + 15, shoulder.y - 6, hip.x + 14, hip.y + 11);
    ctx.closePath();
    fillPath(ctx, pal.dress, pal.ink, 2.1);

    // Inner shirt (light blue collar)
    ctx.beginPath();
    ctx.moveTo(shoulder.x - 7, shoulder.y + 2);
    ctx.lineTo(shoulder.x, shoulder.y - 7);
    ctx.lineTo(shoulder.x + 7, shoulder.y + 2);
    ctx.closePath();
    fillPath(ctx, pal.collar, pal.ink, 1.2);

    // Black necktie
    ctx.beginPath();
    ctx.moveTo(shoulder.x - 2, shoulder.y);
    ctx.lineTo(shoulder.x + 2, shoulder.y);
    ctx.lineTo(shoulder.x + 3.2, shoulder.y - 12);
    ctx.lineTo(shoulder.x, shoulder.y - 14);
    ctx.lineTo(shoulder.x - 3.2, shoulder.y - 12);
    ctx.closePath();
    fillPath(ctx, pal.ink, pal.ink, 1.0);

    // Suit lapel edges & gold buttons
    for (const [bx, by] of [
      [shoulder.x - 5, shoulder.y - 10],
      [shoulder.x + 5, shoulder.y - 10],
      [shoulder.x - 5, hip.y + 14],
      [shoulder.x + 5, hip.y + 14],
    ]) {
      ellipse(ctx, bx, by, 1.6, 1.6);
      fillPath(ctx, "#f5d342", pal.ink, 1.0);
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(hip.x - 14, hip.y + 11);
    ctx.quadraticCurveTo(hip.x - 15, shoulder.y - 6, shoulder.x - 14, shoulder.y + 2);
    ctx.quadraticCurveTo(shoulder.x, shoulder.y + 8, shoulder.x + 14, shoulder.y + 2);
    ctx.quadraticCurveTo(hip.x + 15, shoulder.y - 6, hip.x + 14, hip.y + 11);
    ctx.closePath();
    fillPath(ctx, pal.dress, pal.ink, 2.1);
  }

  if (look.features.strawHat) {
    // Straw hat string hanging around neck with red bead
    ctx.save();
    ctx.strokeStyle = "#4a3518";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(shoulder.x - 10, shoulder.y + 2);
    ctx.quadraticCurveTo(shoulder.x, shoulder.y - 10, shoulder.x + 10, shoulder.y + 2);
    ctx.stroke();
    ellipse(ctx, shoulder.x, shoulder.y - 10, 2.8, 2.8);
    fillPath(ctx, "#cc2424", pal.ink, 1.0);
    ctx.restore();
  }

  if (look.outfit === "pinafore") {
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(hip.x - 6, hip.y + 12);
    ctx.quadraticCurveTo(hip.x - 7, shoulder.y - 8, shoulder.x - 6, shoulder.y - 3);
    ctx.quadraticCurveTo(shoulder.x, shoulder.y + 1, shoulder.x + 6, shoulder.y - 3);
    ctx.quadraticCurveTo(hip.x + 7, shoulder.y - 8, hip.x + 6, hip.y + 12);
    ctx.closePath();
    fillPath(ctx, pal.dressLight);
    ctx.restore();
  } else if (look.outfit === "hoodie") {
    // Hood bunched behind the neck.
    ellipse(ctx, shoulder.x, shoulder.y + 2, 15, 8);
    fillPath(ctx, pal.dressLight, pal.ink, 1.8);
  }

  if (look.features.emblem) {
    const cy = (shoulder.y + hip.y) / 2 + 6;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI * 2) / 5;
      const pt = { x: shoulder.x + Math.cos(a) * 9, y: cy + Math.sin(a) * 9 };
      i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();
    fillPath(ctx, pal.collar, pal.ink, 1.5);
  }

  // Collar.
  ctx.beginPath();
  ctx.moveTo(shoulder.x - 8, shoulder.y + 2);
  ctx.lineTo(shoulder.x, shoulder.y - 6);
  ctx.lineTo(shoulder.x + 8, shoulder.y + 2);
  ctx.closePath();
  fillPath(ctx, pal.collar, pal.ink, 1.4);

  // --- far arm ---
  const sl = { x: shoulder.x - 11, y: shoulder.y - 1 };
  const armL = solveLimb(sl, -p.armL, RIG.upperArm, -p.elbowL, RIG.foreArm);
  if (look.outfit !== "vest") {
    ellipse(ctx, sl.x, sl.y, 7, 7);
    fillPath(ctx, pal.dress, pal.ink, 1.8);
  }
  // The palette's own shadow tone, not a flat multiply: shade(skin) at 0.8 turns
  // #ffdccb into muddy brown #ccb0a2, which reads as a different material.
  const farSkin = pal.skinShade;
  drawLimb(ctx, sl, armL.joint, armL.tip, 6.5, 5.5, 4.2, farSkin, pal.ink, boxy);
  ellipse(ctx, armL.tip.x, armL.tip.y, 4.4, 4.4);
  fillPath(ctx, farSkin, pal.ink, 1.6);

  // --- head (tilts as one unit) ---
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(p.headTilt);
  ctx.translate(-head.x, -head.y);

  if (look.features.strawHat) {
    drawStrawHatBack(ctx, head, r, pal);
  }

  drawFace(ctx, head, p, look, facing);
  if (look.hairStyle !== "none") hairCap(ctx, head, r, p, pal);
  hairStyle(ctx, head, r, p, look, "front");

  if (look.features.strawHat) {
    drawStrawHatFront(ctx, head, r, pal);
  }
  if (look.features.doctorHat) {
    drawDoctorHat(ctx, head, r, pal);
  }
  if (look.features.antlers) {
    drawAntlers(ctx, head, r);
  }

  ctx.restore();

  // --- near arm (and the glass) ---
  const sr = { x: shoulder.x + 11, y: shoulder.y - 1 };
  const armR = solveLimb(sr, p.armR, RIG.upperArm, p.elbowR, RIG.foreArm);
  if (look.outfit !== "vest") {
    ellipse(ctx, sr.x, sr.y, 7.4, 7.4);
    fillPath(ctx, pal.dress, pal.ink, 1.8);
  }
  drawLimb(ctx, sr, armR.joint, armR.tip, 7, 5.8, 4.4, pal.skin, pal.ink, boxy);
  ellipse(ctx, armR.tip.x, armR.tip.y, 4.6, 4.6);
  fillPath(ctx, pal.skin, pal.ink, 1.6);

  if (p.cupTilt > 0.02) drawGlass(ctx, armR.tip, p.cupTilt, pal);

  ctx.restore();
}




