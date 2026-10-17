/**
 * Dev-only contact sheet. Renders the rig's key poses for every character into an
 * offscreen canvas and writes the PNG out through the backend, so the artwork can be
 * reviewed without relying on the floating window being visible on screen.
 */
import { invoke } from "@tauri-apps/api/core";
import { PoseAnimator } from "./pose";
import { RIG } from "./skeleton";
import { drawHana } from "./draw";
import { CHARACTERS } from "./characters";
import { cheer, drink, eyeRest, idle, remind, sleep, walk } from "./poses";

export async function renderContactSheet(): Promise<void> {
  // Cell WIDTH stays 200; HEIGHT is taller so an overhead pose (cheer) has room and is
  // not cut off by the row above. The character is unchanged - only the sheet's frame.
  const CELL = 200;
  const CELL_H = 270;
  const CHAR_PX = 150;
  const poses = [
    { name: "idle", f: (t: number, l: any) => idle(t, l), t: 0.6 },
    { name: "walk", f: (t: number, l: any) => walk(2.2, t, l), t: 1.1 },
    { name: "wave", f: (t: number, l: any) => remind(t, l), t: 0.9 },
    { name: "eyes", f: (t: number, l: any) => eyeRest(t, l), t: 0.5 },
    { name: "drink", f: (t: number, l: any) => drink(1.0, t, l), t: 1.0 },
    { name: "cheer", f: (t: number, l: any) => cheer(0.5, t, l), t: 0.7 },
    { name: "sleep", f: (t: number, l: any) => sleep(t, l), t: 0.4 },
  ];

  const canvas = document.createElement("canvas");
  canvas.width = CELL * poses.length;
  canvas.height = CELL_H * CHARACTERS.length;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#2b2733";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  CHARACTERS.forEach((look, row) => {
    poses.forEach((pose, col) => {
      // Settle the springs so the drawn pose is the rested one, not frame zero.
      const anim = new PoseAnimator();
      for (let i = 0; i < 240; i++) anim.update(pose.f(pose.t, look), 1 / 120);
      ctx.save();
      ctx.translate(col * CELL + CELL / 2, row * CELL_H + CELL_H - 14);
      ctx.scale(CHAR_PX / RIG.height, -CHAR_PX / RIG.height);
      drawHana(ctx, anim.pose, { facingRight: true, look });
      ctx.restore();
      ctx.fillStyle = "#ffffffaa";
      ctx.font = "10px -apple-system, sans-serif";
      ctx.fillText(`${look.name} (${look.kind}) / ${pose.name}`, col * CELL + 6, row * CELL_H + 14);
    });
  });

  try {
    await invoke("save_text", { name: "sheet", contents: canvas.toDataURL("image/png") });
  } catch {
    /* not running under Tauri */
  }
}
