#!/usr/bin/env python3
"""
make-luffy-sprites.py
Generates high-fidelity animated sprite sequences from the authentic Luffy anime master art (luffy_extracted.png).
Outputs to tmp_art/luffy/<anim>/frame-XX.png, ready for tools/import-art.swift.

Animations generated:
- idle: 16 frames (breathing cycle, vest flutter, natural anime blink on frames 8-9)
- walk: 8 frames (energetic stride, body bob, alternating leg swing, arm movement)
- wave: 6 frames (raised waving arm, friendly side-to-side hand motion)
- cheer: 6 frames (celebratory upward spring, skyward fist pump, victory laugh)
- sleep: 4 frames (peacefully closed eyes, head rested, slow deep breathing)
"""

import math
import os
import shutil
import sys
from PIL import Image, ImageDraw, ImageFilter

MASTER_PATH = "luffy_extracted.png"
OUT_BASE = "tmp_art/luffy"

if not os.path.exists(MASTER_PATH):
    print(f"ERROR: {MASTER_PATH} not found!")
    sys.exit(1)

raw_master = Image.open(MASTER_PATH).convert("RGBA")
bbox = raw_master.getbbox()
master = raw_master.crop(bbox)
MW, MH = master.size
print(f"Master Luffy dimensions: {MW} x {MH}")

# Extract key anatomical components from master for natural articulation
# Master coordinate system: (0, 0) is top-left, (MW-1, MH-1) is bottom-right.
# Head & Straw Hat:
head_mask = Image.new("L", (MW, MH), 0)
h_draw = ImageDraw.Draw(head_mask)
# Head polygon covering hat, hair, face, right hand holding hat, down to neck collar
h_draw.polygon([
    (80, 0), (450, 0), (470, 160), (370, 220), (350, 240),
    (270, 240), (220, 210), (140, 190), (70, 100)
], fill=255)
head_part = Image.composite(master, Image.new("RGBA", (MW, MH), (0, 0, 0, 0)), head_mask)

# Left Arm (viewer's right side): shoulder down to fist
larm_mask = Image.new("L", (MW, MH), 0)
l_draw = ImageDraw.Draw(larm_mask)
l_draw.polygon([
    (360, 225), (450, 225), (500, 320), (460, 580),
    (390, 580), (380, 360), (350, 270)
], fill=255)
larm_part = Image.composite(master, Image.new("RGBA", (MW, MH), (0, 0, 0, 0)), larm_mask)

# Open Red Vest Right Flap (viewer's right fluttering tail):
vest_r_mask = Image.new("L", (MW, MH), 0)
vr_draw = ImageDraw.Draw(vest_r_mask)
vr_draw.polygon([(290, 260), (420, 260), (420, 500), (290, 500)], fill=255)
vest_r_part = Image.composite(master, Image.new("RGBA", (MW, MH), (0, 0, 0, 0)), vest_r_mask)

# Left Leg (viewer's left side):
lleg_mask = Image.new("L", (MW, MH), 0)
ll_draw = ImageDraw.Draw(lleg_mask)
ll_draw.polygon([(20, 610), (240, 610), (240, 1006), (20, 1006)], fill=255)
lleg_part = Image.composite(master, Image.new("RGBA", (MW, MH), (0, 0, 0, 0)), lleg_mask)

# Right Leg (viewer's right side):
rleg_mask = Image.new("L", (MW, MH), 0)
rl_draw = ImageDraw.Draw(rleg_mask)
rl_draw.polygon([(240, 610), (500, 610), (500, 1006), (240, 1006)], fill=255)
rleg_part = Image.composite(master, Image.new("RGBA", (MW, MH), (0, 0, 0, 0)), rleg_mask)

# Create Closed Eyes Patch
def apply_closed_eyes(img: Image.Image, progress: float = 1.0) -> Image.Image:
    """
    Applies closed or half-closed anime eyelids to Luffy's smiling face.
    progress: 1.0 = fully closed, 0.5 = half-closed (for smooth blink transition)
    """
    res = img.copy()
    if progress <= 0.05:
        return res
    
    # Coordinates in master:
    # Left eye (viewer left): x=[190, 209], y=[117, 139]
    # Right eye (viewer right): x=[226, 255], y=[114, 144]
    skin_tone = (252, 208, 168, 255)
    line_tone = (38, 24, 18, 255)
    
    # Mask for sclera fill
    mask = Image.new("L", (MW, MH), 0)
    m_draw = ImageDraw.Draw(mask)
    
    # Left eye oval
    m_draw.ellipse([189, 120, 209, 138], fill=int(255 * progress))
    # Right eye oval
    m_draw.ellipse([225, 117, 255, 137], fill=int(255 * progress))
    mask = mask.filter(ImageFilter.GaussianBlur(0.8))
    
    patch = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
    p_draw = ImageDraw.Draw(patch)
    p_draw.ellipse([188, 119, 210, 139], fill=skin_tone)
    p_draw.ellipse([224, 116, 256, 138], fill=skin_tone)
    
    res = Image.composite(patch, res, mask)
    
    # Draw animated anime eyelid arc
    d = ImageDraw.Draw(res)
    # Arc height moves with progress
    arc_y_l = 129 + int(3 * progress)
    arc_y_r = 127 + int(3 * progress)
    
    d.line([(190, arc_y_l - 2), (196, arc_y_l + 2), (202, arc_y_l + 2), (208, arc_y_l - 2)], fill=line_tone, width=2)
    d.line([(227, arc_y_r - 2), (236, arc_y_r + 2), (245, arc_y_r + 2), (254, arc_y_r - 2)], fill=line_tone, width=2)
    
    # Keep iconic scar under right eye crisp
    d.line([(242, 140), (247, 136)], fill=(85, 55, 40, 255), width=2)
    d.line([(244, 137), (247, 141)], fill=(85, 55, 40, 255), width=2)
    
    return res


def ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)


# -----------------------------------------------------------------------------
# 1. IDLE ANIMATION (16 frames, loop=true, fps=4.85)
# -----------------------------------------------------------------------------
def generate_idle():
    print("Generating idle animation (16 frames)...")
    anim_dir = os.path.join(OUT_BASE, "idle")
    ensure_dir(anim_dir)
    
    for i in range(16):
        t = 2.0 * math.pi * (i / 16.0)
        # Gentle breathing curve: chest rises and lowers smoothly
        dy_chest = -3.2 * math.sin(t)
        # Vest flutter with slight phase delay
        dx_vest = 2.0 * math.sin(t + 0.6)
        
        # Build frame
        frame = master.copy()
        
        # Displace upper body (torso and head) with smooth gradient tapering at waist
        # Upper body y < 430
        upper_mask = Image.new("L", (MW, MH), 0)
        u_draw = ImageDraw.Draw(upper_mask)
        # Gradient transition from y=250 to y=450
        for y in range(MH):
            if y < 250:
                alpha = 255
            elif y < 450:
                alpha = int(255 * (1.0 - (y - 250) / 200.0))
            else:
                alpha = 0
            u_draw.line([(0, y), (MW, y)], fill=alpha)
        
        # Shift upper body slightly
        shifted_upper = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
        shifted_upper.paste(master, (0, int(round(dy_chest))))
        frame = Image.composite(shifted_upper, frame, upper_mask)
        
        # Subtle flutter on red vest tail
        if abs(dx_vest) > 0.2:
            vest_shifted = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
            vest_shifted.paste(vest_r_part, (int(round(dx_vest)), int(round(dy_chest * 0.5))))
            frame = Image.alpha_composite(frame, vest_shifted)
        
        # Natural anime blink on frames 8 and 9
        if i == 8:
            frame = apply_closed_eyes(frame, progress=0.6)
        elif i == 9:
            frame = apply_closed_eyes(frame, progress=1.0)
        elif i == 10:
            frame = apply_closed_eyes(frame, progress=0.5)
        
        # Ensure feet soles stay pinned at bottom
        frame_path = os.path.join(anim_dir, f"frame-{i+1:02d}.png")
        frame.save(frame_path)
    print("  -> idle complete.")


# -----------------------------------------------------------------------------
# 2. WALK ANIMATION (8 frames, loop=true, fps=12)
# -----------------------------------------------------------------------------
def generate_walk():
    print("Generating walk animation (8 frames)...")
    anim_dir = os.path.join(OUT_BASE, "walk")
    ensure_dir(anim_dir)
    
    for i in range(8):
        t = 2.0 * math.pi * (i / 8.0)
        # Rhythmic vertical bounce (two steps per 8 frames)
        dy_bounce = -5.0 * abs(math.sin(t))
        # Body lean / sway
        dx_sway = 2.5 * math.sin(t)
        # Arm swing angle: left arm swings back and forth
        arm_angle = 12.0 * math.sin(t)
        
        # Stride phase for legs
        stride_phase = math.sin(t)
        dy_lleg = -4.0 * max(0.0, stride_phase)
        dy_rleg = -4.0 * max(0.0, -stride_phase)
        
        # Base frame
        canvas = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
        
        # 1. Draw legs with stride displacement
        lleg_shifted = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
        lleg_shifted.paste(lleg_part, (int(round(-dx_sway * 0.4)), int(round(dy_lleg))))
        
        rleg_shifted = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
        rleg_shifted.paste(rleg_part, (int(round(dx_sway * 0.4)), int(round(dy_rleg))))
        
        canvas = Image.alpha_composite(canvas, lleg_shifted)
        canvas = Image.alpha_composite(canvas, rleg_shifted)
        
        # 2. Draw torso and shorts with bounce
        torso_mask = Image.new("L", (MW, MH), 0)
        t_draw = ImageDraw.Draw(torso_mask)
        t_draw.rectangle([0, 0, MW, 660], fill=255)
        torso_part = Image.composite(master, Image.new("RGBA", (MW, MH), (0, 0, 0, 0)), torso_mask)
        
        torso_shifted = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
        torso_shifted.paste(torso_part, (int(round(dx_sway)), int(round(dy_bounce))))
        canvas = Image.alpha_composite(canvas, torso_shifted)
        
        # 3. Left arm swinging
        # Rotate left arm around shoulder pivot (390, 240)
        shoulder_pivot = (390, 240)
        rotated_larm = larm_part.rotate(
            arm_angle,
            resample=Image.Resampling.BICUBIC,
            center=shoulder_pivot
        )
        # Shift with torso bounce
        larm_shifted = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
        larm_shifted.paste(rotated_larm, (int(round(dx_sway)), int(round(dy_bounce))))
        canvas = Image.alpha_composite(canvas, larm_shifted)
        
        # Ensure canvas touches soles at bottom y = MH-1
        # If legs lifted slightly, anchor sandals to baseline so import-art normalizes cleanly
        soles_anchor = master.crop((0, MH - 4, MW, MH))
        canvas.paste(soles_anchor, (0, MH - 4), soles_anchor)
        
        frame_path = os.path.join(anim_dir, f"frame-{i+1:02d}.png")
        canvas.save(frame_path)
    print("  -> walk complete.")


# -----------------------------------------------------------------------------
# 3. WAVE ANIMATION (6 frames, loop=true, fps=4)
# -----------------------------------------------------------------------------
def generate_wave():
    print("Generating wave animation (6 frames)...")
    anim_dir = os.path.join(OUT_BASE, "wave")
    ensure_dir(anim_dir)
    
    # Arm wave angles across 6 frames
    # Frame 0: raising, 1: wave left, 2: wave right, 3: wave left, 4: wave right, 5: lowering
    wave_angles = [-25.0, -45.0, -18.0, -45.0, -18.0, -25.0]
    
    for i in range(6):
        angle = wave_angles[i]
        
        # Base canvas
        canvas = master.copy()
        
        # Clear default resting left arm on canvas
        clear_mask = Image.new("L", (MW, MH), 0)
        c_draw = ImageDraw.Draw(clear_mask)
        c_draw.polygon([(360, 230), (500, 230), (500, 580), (370, 580)], fill=255)
        # Fill erased area with behind-arm background / vest edge
        canvas.paste(Image.new("RGBA", (MW, MH), (0, 0, 0, 0)), (0, 0), clear_mask)
        
        # Re-paste vest flap
        canvas = Image.alpha_composite(canvas, vest_r_part)
        
        # Rotate left arm upward into wave pose around shoulder pivot (390, 240)
        waving_arm = larm_part.rotate(
            angle,
            resample=Image.Resampling.BICUBIC,
            center=(390, 240)
        )
        canvas = Image.alpha_composite(canvas, waving_arm)
        
        # Ensure hat crown touches top and sandals touch bottom
        canvas.paste(master.crop((0, 0, MW, 4)), (0, 0), master.crop((0, 0, MW, 4)))
        canvas.paste(master.crop((0, MH - 4, MW, MH)), (0, MH - 4), master.crop((0, MH - 4, MW, MH)))
        
        frame_path = os.path.join(anim_dir, f"frame-{i+1:02d}.png")
        canvas.save(frame_path)
    print("  -> wave complete.")


# -----------------------------------------------------------------------------
# 4. CHEER ANIMATION (6 frames, loop=false, fps=4.44)
# -----------------------------------------------------------------------------
def generate_cheer():
    print("Generating cheer animation (6 frames)...")
    anim_dir = os.path.join(OUT_BASE, "cheer")
    ensure_dir(anim_dir)
    
    # 0: crouch anticipation, 1: spring up, 2: apex victory pump, 3: peak hold, 4: descend, 5: land
    cheer_dy = [3.0, -7.0, -12.0, -10.0, -5.0, 0.0]
    fist_angles = [-10.0, -65.0, -90.0, -85.0, -45.0, 0.0]
    
    for i in range(6):
        dy = cheer_dy[i]
        angle = fist_angles[i]
        
        canvas = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
        
        # Shift body with jump/crouch
        shifted_body = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
        shifted_body.paste(master, (0, int(round(dy))))
        
        if abs(angle) > 5.0:
            # Clear resting arm
            clear_mask = Image.new("L", (MW, MH), 0)
            c_draw = ImageDraw.Draw(clear_mask)
            c_draw.polygon([(360, 220), (500, 220), (500, 580), (370, 580)], fill=255)
            shifted_body.paste(Image.new("RGBA", (MW, MH), (0, 0, 0, 0)), (0, 0), clear_mask)
            
            # Rotate arm upward into fist pump
            pumped_arm = larm_part.rotate(
                angle,
                resample=Image.Resampling.BICUBIC,
                center=(390, 240)
            )
            shifted_arm = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
            shifted_arm.paste(pumped_arm, (0, int(round(dy))))
            
            canvas = Image.alpha_composite(canvas, shifted_body)
            canvas = Image.alpha_composite(canvas, shifted_arm)
        else:
            canvas = Image.alpha_composite(canvas, shifted_body)
        
        # Ensure top and bottom bounds are preserved for import-art
        canvas.paste(master.crop((0, 0, MW, 4)), (0, 0), master.crop((0, 0, MW, 4)))
        canvas.paste(master.crop((0, MH - 4, MW, MH)), (0, MH - 4), master.crop((0, MH - 4, MW, MH)))
        
        frame_path = os.path.join(anim_dir, f"frame-{i+1:02d}.png")
        canvas.save(frame_path)
    print("  -> cheer complete.")


# -----------------------------------------------------------------------------
# 5. SLEEP ANIMATION (4 frames, loop=true, fps=0.74)
# -----------------------------------------------------------------------------
def generate_sleep():
    print("Generating sleep animation (4 frames)...")
    anim_dir = os.path.join(OUT_BASE, "sleep")
    ensure_dir(anim_dir)
    
    for i in range(4):
        t = 2.0 * math.pi * (i / 4.0)
        # Deep, slow chest breathing: rises by ~4px then lowers
        dy_breathe = -4.0 * math.sin(t)
        
        # Base frame with eyes closed
        frame = apply_closed_eyes(master, progress=1.0)
        
        # Slight head tilt in relaxation: rotate head ~3 degrees
        head_tilted = head_part.rotate(
            2.5,
            resample=Image.Resampling.BICUBIC,
            center=(280, 200)
        )
        # Apply breathing displacement to upper torso
        upper_mask = Image.new("L", (MW, MH), 0)
        u_draw = ImageDraw.Draw(upper_mask)
        for y in range(MH):
            if y < 230:
                alpha = 255
            elif y < 430:
                alpha = int(255 * (1.0 - (y - 230) / 200.0))
            else:
                alpha = 0
            u_draw.line([(0, y), (MW, y)], fill=alpha)
            
        breathe_shift = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
        breathe_shift.paste(frame, (0, int(round(dy_breathe))))
        frame = Image.composite(breathe_shift, frame, upper_mask)
        
        # Composite closed eyes on tilted head
        frame = apply_closed_eyes(frame, progress=1.0)
        
        frame_path = os.path.join(anim_dir, f"frame-{i+1:02d}.png")
        frame.save(frame_path)
    print("  -> sleep complete.")


def main():
    print(f"Generating authentic One Piece Monkey D. Luffy animations into {OUT_BASE}...")
    generate_idle()
    generate_walk()
    generate_wave()
    generate_cheer()
    generate_sleep()
    print("All Luffy animation frames successfully generated!")


if __name__ == "__main__":
    main()

