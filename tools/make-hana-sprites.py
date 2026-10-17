#!/usr/bin/env python3
"""
make-hana-sprites.py
Generates high-fidelity animated sprite sequences for flagship character Hana (hana_extracted.png).
Outputs to tmp_art/hana/<anim>/frame-XX.png, ready for tools/import-art.swift.

Animations generated:
- idle: 16 frames (breathing cycle, twin-tail sway, natural anime blink on frames 8-9)
- walk: 8 distinct stride frames (contact, recoil, passing, high point for both steps)
- wave: 6 frames (raised waving arm, friendly side-to-side hand greeting)
- cheer: 6 frames (celebratory upward spring, joyful bounce, victory pose)
- sleep: 4 frames (peacefully closed eyes, head rested, slow deep breathing)
"""

import math
import os
import shutil
import sys
from PIL import Image, ImageDraw, ImageFilter

MASTER_PATH = "hana_extracted.png"
OUT_BASE = "tmp_art/hana"

if not os.path.exists(MASTER_PATH):
    print(f"ERROR: {MASTER_PATH} not found!")
    sys.exit(1)

raw_master = Image.open(MASTER_PATH).convert("RGBA")
bbox = raw_master.getbbox()
master = raw_master.crop(bbox)
MW, MH = master.size
print(f"Master Hana dimensions: {MW} x {MH}")

# Extract key anatomical segments from master for natural articulation
# Master coordinate system: (0, 0) top-left, (MW-1, MH-1) bottom-right.
# 1. Head & Twin-tails:
head_mask = Image.new("L", (MW, MH), 0)
h_draw = ImageDraw.Draw(head_mask)
# Head polygon covering hair, twin-tails, face, down to blouse collar (y ~ 280)
h_draw.polygon([
    (0, 0), (MW, 0), (MW, 280), (260, 310), (180, 310), (100, 310), (0, 280)
], fill=255)
head_part = Image.composite(master, Image.new("RGBA", (MW, MH), (0, 0, 0, 0)), head_mask)

# 2. Right Arm (viewer right side): shoulder down to hand
rarm_mask = Image.new("L", (MW, MH), 0)
ra_draw = ImageDraw.Draw(rarm_mask)
ra_draw.polygon([
    (210, 260), (330, 260), (330, 520), (220, 520)
], fill=255)
rarm_part = Image.composite(master, Image.new("RGBA", (MW, MH), (0, 0, 0, 0)), rarm_mask)

# 3. Left Arm (viewer left side): shoulder down to hand
larm_mask = Image.new("L", (MW, MH), 0)
la_draw = ImageDraw.Draw(larm_mask)
la_draw.polygon([
    (20, 260), (120, 260), (120, 520), (20, 520)
], fill=255)
larm_part = Image.composite(master, Image.new("RGBA", (MW, MH), (0, 0, 0, 0)), larm_mask)

# 4. Pinafore Skirt:
skirt_mask = Image.new("L", (MW, MH), 0)
sk_draw = ImageDraw.Draw(skirt_mask)
sk_draw.polygon([(40, 360), (300, 360), (320, 600), (30, 600)], fill=255)
skirt_part = Image.composite(master, Image.new("RGBA", (MW, MH), (0, 0, 0, 0)), skirt_mask)

# 5. Left Leg (viewer left) with thigh-high and Mary Jane shoe:
lleg_mask = Image.new("L", (MW, MH), 0)
ll_draw = ImageDraw.Draw(lleg_mask)
ll_draw.polygon([(20, 580), (175, 580), (175, MH), (20, MH)], fill=255)
lleg_part = Image.composite(master, Image.new("RGBA", (MW, MH), (0, 0, 0, 0)), lleg_mask)

# 6. Right Leg (viewer right) with thigh-high and Mary Jane shoe:
rleg_mask = Image.new("L", (MW, MH), 0)
rl_draw = ImageDraw.Draw(rleg_mask)
rl_draw.polygon([(175, 580), (330, 580), (330, MH), (175, MH)], fill=255)
rleg_part = Image.composite(master, Image.new("RGBA", (MW, MH), (0, 0, 0, 0)), rleg_mask)

# 7. Twin-tail tips for secondary motion sway:
tail_l_mask = Image.new("L", (MW, MH), 0)
tl_draw = ImageDraw.Draw(tail_l_mask)
tl_draw.polygon([(0, 160), (90, 160), (90, 360), (0, 360)], fill=255)
tail_l_part = Image.composite(master, Image.new("RGBA", (MW, MH), (0, 0, 0, 0)), tail_l_mask)

tail_r_mask = Image.new("L", (MW, MH), 0)
tr_draw = ImageDraw.Draw(tail_r_mask)
tr_draw.polygon([(250, 160), (MW, 160), (MW, 360), (250, 360)], fill=255)
tail_r_part = Image.composite(master, Image.new("RGBA", (MW, MH), (0, 0, 0, 0)), tail_r_mask)


def apply_closed_eyes(img: Image.Image, progress: float = 1.0) -> Image.Image:
    """
    Applies closed or half-closed anime eyelids to Hana's face.
    """
    res = img.copy()
    if progress <= 0.05:
        return res

    # In master coordinates, Hana's eyes:
    # Left eye (viewer left): x ~ [115, 148], y ~ [146, 178]
    # Right eye (viewer right): x ~ [180, 215], y ~ [144, 176]
    skin_tone = (252, 218, 196, 255)
    line_tone = (75, 45, 65, 255)

    mask = Image.new("L", (MW, MH), 0)
    m_draw = ImageDraw.Draw(mask)
    m_draw.ellipse([115, 146, 148, 178], fill=int(255 * progress))
    m_draw.ellipse([180, 144, 215, 176], fill=int(255 * progress))
    mask = mask.filter(ImageFilter.GaussianBlur(0.8))

    patch = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
    p_draw = ImageDraw.Draw(patch)
    p_draw.ellipse([114, 145, 149, 179], fill=skin_tone)
    p_draw.ellipse([179, 143, 216, 177], fill=skin_tone)

    res = Image.composite(patch, res, mask)

    # Draw closed curved anime eyelid eyelashes
    d = ImageDraw.Draw(res)
    arc_y_l = 160 + int(3 * progress)
    arc_y_r = 158 + int(3 * progress)

    # Cute curved eyelash arcs
    d.line([(116, arc_y_l - 2), (124, arc_y_l + 3), (138, arc_y_l + 3), (147, arc_y_l - 2)], fill=line_tone, width=2)
    d.line([(181, arc_y_r - 2), (191, arc_y_r + 3), (205, arc_y_r + 3), (214, arc_y_r - 2)], fill=line_tone, width=2)

    return res


def ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)


# -----------------------------------------------------------------------------
# 1. IDLE ANIMATION (16 frames, loop=true, fps=4.85)
# -----------------------------------------------------------------------------
def generate_idle():
    print("Generating Hana idle animation (16 frames)...")
    anim_dir = os.path.join(OUT_BASE, "idle")
    ensure_dir(anim_dir)

    for i in range(16):
        t = 2.0 * math.pi * (i / 16.0)
        # Gentle breathing curve: chest rises and lowers smoothly
        dy_chest = -2.8 * math.sin(t)
        # Twin-tail soft sway with phase lag
        dx_tail = 2.0 * math.sin(t + 0.5)

        frame = master.copy()

        # Displace upper body (head, blouse, pinafore chest) smoothly
        upper_mask = Image.new("L", (MW, MH), 0)
        u_draw = ImageDraw.Draw(upper_mask)
        for y in range(MH):
            if y < 240:
                alpha = 255
            elif y < 450:
                alpha = int(255 * (1.0 - (y - 240) / 210.0))
            else:
                alpha = 0
            u_draw.line([(0, y), (MW, y)], fill=alpha)

        shifted_upper = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
        shifted_upper.paste(master, (0, int(round(dy_chest))))
        frame = Image.composite(shifted_upper, frame, upper_mask)

        # Subtle twin-tail tip sway
        if abs(dx_tail) > 0.2:
            tail_l_shifted = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
            tail_l_shifted.paste(tail_l_part, (int(round(-dx_tail * 0.7)), int(round(dy_chest * 0.4))))
            frame = Image.alpha_composite(frame, tail_l_shifted)

            tail_r_shifted = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
            tail_r_shifted.paste(tail_r_part, (int(round(dx_tail * 0.7)), int(round(dy_chest * 0.4))))
            frame = Image.alpha_composite(frame, tail_r_shifted)

        # Natural anime eye blink on frames 8 and 9
        if i == 8:
            frame = apply_closed_eyes(frame, progress=0.6)
        elif i == 9:
            frame = apply_closed_eyes(frame, progress=1.0)
        elif i == 10:
            frame = apply_closed_eyes(frame, progress=0.5)

        # Ensure soles touch the exact baseline row MH-1 and crown touches top row 0
        frame.paste(master.crop((0, 0, MW, 4)), (0, 0), master.crop((0, 0, MW, 4)))
        frame.paste(master.crop((0, MH - 4, MW, MH)), (0, MH - 4), master.crop((0, MH - 4, MW, MH)))

        frame_path = os.path.join(anim_dir, f"frame-{i+1:02d}.png")
        frame.save(frame_path)
    print("  -> Hana idle complete.")


# -----------------------------------------------------------------------------
# 2. WALK ANIMATION (8 frames, loop=true, fps=12)
# -----------------------------------------------------------------------------
def generate_walk():
    print("Generating Hana walk animation (8 distinct stride frames)...")
    anim_dir = os.path.join(OUT_BASE, "walk")
    ensure_dir(anim_dir)

    for i in range(8):
        t = 2.0 * math.pi * (i / 8.0)
        # Rhythmic vertical bounce (two steps per 8 frames)
        dy_bounce = -4.5 * abs(math.sin(t))
        # Body lean / sway
        dx_sway = 2.0 * math.sin(t)
        # Arm swing angle: alternating swing
        arm_angle = 14.0 * math.sin(t)

        # Stride phase for legs
        stride_phase = math.sin(t)
        dy_lleg = -4.2 * max(0.0, stride_phase)
        dy_rleg = -4.2 * max(0.0, -stride_phase)

        canvas = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))

        # 1. Legs with stride displacement
        lleg_shifted = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
        lleg_shifted.paste(lleg_part, (int(round(-dx_sway * 0.4)), int(round(dy_lleg))))

        rleg_shifted = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
        rleg_shifted.paste(rleg_part, (int(round(dx_sway * 0.4)), int(round(dy_rleg))))

        canvas = Image.alpha_composite(canvas, lleg_shifted)
        canvas = Image.alpha_composite(canvas, rleg_shifted)

        # 2. Torso, skirt, and head with bounce and sway
        body_mask = Image.new("L", (MW, MH), 0)
        b_draw = ImageDraw.Draw(body_mask)
        b_draw.rectangle([0, 0, MW, 600], fill=255)
        body_part = Image.composite(master, Image.new("RGBA", (MW, MH), (0, 0, 0, 0)), body_mask)

        body_shifted = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
        body_shifted.paste(body_part, (int(round(dx_sway)), int(round(dy_bounce))))
        canvas = Image.alpha_composite(canvas, body_shifted)

        # 3. Arms swinging around shoulder pivots
        # Left shoulder pivot: (70, 280), Right shoulder pivot: (270, 280)
        rotated_larm = larm_part.rotate(-arm_angle, resample=Image.Resampling.BICUBIC, center=(70, 280))
        larm_shifted = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
        larm_shifted.paste(rotated_larm, (int(round(dx_sway)), int(round(dy_bounce))))
        canvas = Image.alpha_composite(canvas, larm_shifted)

        rotated_rarm = rarm_part.rotate(arm_angle, resample=Image.Resampling.BICUBIC, center=(270, 280))
        rarm_shifted = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
        rarm_shifted.paste(rotated_rarm, (int(round(dx_sway)), int(round(dy_bounce))))
        canvas = Image.alpha_composite(canvas, rarm_shifted)

        # Ensure ground contact baseline alignment
        canvas.paste(master.crop((0, 0, MW, 4)), (0, 0), master.crop((0, 0, MW, 4)))
        canvas.paste(master.crop((0, MH - 4, MW, MH)), (0, MH - 4), master.crop((0, MH - 4, MW, MH)))

        frame_path = os.path.join(anim_dir, f"frame-{i+1:02d}.png")
        canvas.save(frame_path)
    print("  -> Hana walk complete.")


# -----------------------------------------------------------------------------
# 3. WAVE ANIMATION (6 frames, loop=true, fps=4)
# -----------------------------------------------------------------------------
def generate_wave():
    print("Generating Hana wave animation (6 frames)...")
    anim_dir = os.path.join(OUT_BASE, "wave")
    ensure_dir(anim_dir)

    wave_angles = [-20.0, -42.0, -16.0, -42.0, -16.0, -20.0]

    for i in range(6):
        angle = wave_angles[i]
        canvas = master.copy()

        # Clear default right arm
        clear_mask = Image.new("L", (MW, MH), 0)
        c_draw = ImageDraw.Draw(clear_mask)
        c_draw.polygon([(220, 270), (330, 270), (330, 520), (220, 520)], fill=255)
        canvas.paste(Image.new("RGBA", (MW, MH), (0, 0, 0, 0)), (0, 0), clear_mask)

        # Repaste skirt edge underneath arm
        canvas = Image.alpha_composite(canvas, skirt_part)

        # Rotate right arm upward into wave pose around shoulder pivot (270, 280)
        waving_arm = rarm_part.rotate(angle, resample=Image.Resampling.BICUBIC, center=(270, 280))
        canvas = Image.alpha_composite(canvas, waving_arm)

        canvas.paste(master.crop((0, 0, MW, 4)), (0, 0), master.crop((0, 0, MW, 4)))
        canvas.paste(master.crop((0, MH - 4, MW, MH)), (0, MH - 4), master.crop((0, MH - 4, MW, MH)))

        frame_path = os.path.join(anim_dir, f"frame-{i+1:02d}.png")
        canvas.save(frame_path)
    print("  -> Hana wave complete.")


# -----------------------------------------------------------------------------
# 4. CHEER ANIMATION (6 frames, loop=false, fps=4.44)
# -----------------------------------------------------------------------------
def generate_cheer():
    print("Generating Hana cheer animation (6 frames)...")
    anim_dir = os.path.join(OUT_BASE, "cheer")
    ensure_dir(anim_dir)

    cheer_dy = [3.0, -6.0, -11.0, -9.0, -4.0, 0.0]
    arm_angles = [-10.0, -50.0, -75.0, -70.0, -35.0, 0.0]

    for i in range(6):
        dy = cheer_dy[i]
        angle = arm_angles[i]

        canvas = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
        shifted_body = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
        shifted_body.paste(master, (0, int(round(dy))))

        if abs(angle) > 5.0:
            clear_mask = Image.new("L", (MW, MH), 0)
            c_draw = ImageDraw.Draw(clear_mask)
            c_draw.polygon([(20, 270), (120, 270), (120, 520), (20, 520)], fill=255)
            c_draw.polygon([(220, 270), (330, 270), (330, 520), (220, 520)], fill=255)
            shifted_body.paste(Image.new("RGBA", (MW, MH), (0, 0, 0, 0)), (0, 0), clear_mask)

            # Rotate both arms up into cheer pose
            pumped_larm = larm_part.rotate(-angle, resample=Image.Resampling.BICUBIC, center=(70, 280))
            pumped_rarm = rarm_part.rotate(angle, resample=Image.Resampling.BICUBIC, center=(270, 280))

            shifted_larm = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
            shifted_larm.paste(pumped_larm, (0, int(round(dy))))

            shifted_rarm = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
            shifted_rarm.paste(pumped_rarm, (0, int(round(dy))))

            canvas = Image.alpha_composite(canvas, shifted_body)
            canvas = Image.alpha_composite(canvas, shifted_larm)
            canvas = Image.alpha_composite(canvas, shifted_rarm)
        else:
            canvas = Image.alpha_composite(canvas, shifted_body)

        canvas.paste(master.crop((0, 0, MW, 4)), (0, 0), master.crop((0, 0, MW, 4)))
        canvas.paste(master.crop((0, MH - 4, MW, MH)), (0, MH - 4), master.crop((0, MH - 4, MW, MH)))

        frame_path = os.path.join(anim_dir, f"frame-{i+1:02d}.png")
        canvas.save(frame_path)
    print("  -> Hana cheer complete.")


# -----------------------------------------------------------------------------
# 5. SLEEP ANIMATION (4 frames, loop=true, fps=0.74)
# -----------------------------------------------------------------------------
def generate_sleep():
    print("Generating Hana sleep animation (4 frames)...")
    anim_dir = os.path.join(OUT_BASE, "sleep")
    ensure_dir(anim_dir)

    for i in range(4):
        t = 2.0 * math.pi * (i / 4.0)
        dy_breathe = -3.5 * math.sin(t)

        frame = apply_closed_eyes(master, progress=1.0)

        # Gentle head tilt
        head_tilted = head_part.rotate(2.0, resample=Image.Resampling.BICUBIC, center=(170, 260))

        upper_mask = Image.new("L", (MW, MH), 0)
        u_draw = ImageDraw.Draw(upper_mask)
        for y in range(MH):
            if y < 240:
                alpha = 255
            elif y < 450:
                alpha = int(255 * (1.0 - (y - 240) / 210.0))
            else:
                alpha = 0
            u_draw.line([(0, y), (MW, y)], fill=alpha)

        breathe_shift = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
        breathe_shift.paste(frame, (0, int(round(dy_breathe))))
        frame = Image.composite(breathe_shift, frame, upper_mask)

        frame = apply_closed_eyes(frame, progress=1.0)

        canvas = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
        canvas.paste(frame, (0, 0))
        canvas.paste(master.crop((0, 0, MW, 4)), (0, 0), master.crop((0, 0, MW, 4)))
        canvas.paste(master.crop((0, MH - 4, MW, MH)), (0, MH - 4), master.crop((0, MH - 4, MW, MH)))

        frame_path = os.path.join(anim_dir, f"frame-{i+1:02d}.png")
        canvas.save(frame_path)
    print("  -> Hana sleep complete.")


def main():
    print(f"Generating authentic Hana animations into {OUT_BASE}...")
    generate_idle()
    generate_walk()
    generate_wave()
    generate_cheer()
    generate_sleep()
    print("All Hana animation frames successfully generated!")


if __name__ == "__main__":
    main()

