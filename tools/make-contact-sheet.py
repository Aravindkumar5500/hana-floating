#!/usr/bin/env python3
"""
make-contact-sheet.py
Generates annotated visual contact sheets for character sprite sheets.
Displays individual frames with:
- Frame index numbering
- Center alignment guideline (x=256)
- Soles baseline guideline (y=486)
- Character height guideline (top y=56)
- Frame dimensions and metadata
"""

import json
import os
import sys
from PIL import Image, ImageDraw, ImageFont

def make_contact_sheet(character_id: str, anim_name: str = "walk", out_path: str = None):
    char_dir = os.path.join("public/characters", character_id)
    manifest_path = os.path.join(char_dir, "manifest.json")
    if not os.path.exists(manifest_path):
        print(f"ERROR: {manifest_path} not found")
        return
        
    with open(manifest_path) as f:
        manifest = json.load(f)
        
    if anim_name not in manifest["animations"]:
        print(f"ERROR: {anim_name} not in {character_id} animations")
        return
        
    anim_spec = manifest["animations"][anim_name]
    strip_path = os.path.join(char_dir, anim_spec["file"])
    strip = Image.open(strip_path).convert("RGBA")
    
    FW = manifest["frameWidth"]
    FH = manifest["frameHeight"]
    frames = anim_spec["frames"]
    baseline = manifest["baseline"]
    char_height = manifest["characterHeight"]
    top_line = baseline - char_height
    
    # Grid layout: max 4 frames per row
    cols = min(4, frames)
    rows = (frames + cols - 1) // cols
    
    cell_w = FW // 2
    cell_h = FH // 2
    header_h = 60
    padding = 10
    
    sheet_w = cols * (cell_w + padding) + padding
    sheet_h = rows * (cell_h + padding) + padding + header_h
    
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (30, 32, 40, 255))
    draw = ImageDraw.Draw(sheet)
    
    # Title header
    title = f"{manifest['name']} - '{anim_name}' ({frames} frames @ {anim_spec['fps']} fps) - Baseline: {baseline}px"
    draw.text((padding + 10, 20), title, fill=(240, 240, 250, 255))
    
    for i in range(frames):
        c = i % cols
        r = i // cols
        
        ox = padding + c * (cell_w + padding)
        oy = header_h + padding + r * (cell_h + padding)
        
        # Checkerboard background for transparency preview
        for cy in range(0, cell_h, 16):
            for cx in range(0, cell_w, 16):
                bg_color = (48, 50, 60) if ((cx // 16) + (cy // 16)) % 2 == 0 else (60, 62, 74)
                draw.rectangle([ox + cx, oy + cy, ox + min(cx + 16, cell_w), oy + min(cy + 16, cell_h)], fill=bg_color)
                
        # Crop frame from strip
        frame_crop = strip.crop((i * FW, 0, (i + 1) * FW, FH))
        resized_frame = frame_crop.resize((cell_w, cell_h), Image.Resampling.LANCZOS)
        sheet.paste(resized_frame, (ox, oy), resized_frame)
        
        # Frame border
        draw.rectangle([ox, oy, ox + cell_w, oy + cell_h], outline=(90, 95, 115), width=1)
        
        # Guideline: Soles baseline (scaled down by 2)
        base_y_scaled = oy + int(round(baseline * 0.5))
        draw.line([(ox, base_y_scaled), (ox + cell_w, base_y_scaled)], fill=(255, 80, 80, 180), width=1)
        
        # Guideline: Center line
        center_x_scaled = ox + int(round(FW * 0.25))
        draw.line([(center_x_scaled, oy), (center_x_scaled, oy + cell_h)], fill=(80, 180, 255, 140), width=1)
        
        # Frame label
        draw.text((ox + 8, oy + 8), f"Frame {i:02d}", fill=(255, 255, 255, 240))
        
    if out_path is None:
        out_path = f"contact_sheet_{character_id}_{anim_name}.png"
        
    sheet.save(out_path)
    print(f"Wrote visual contact sheet: {out_path} ({sheet_w}x{sheet_h})")

if __name__ == "__main__":
    make_contact_sheet("hana", "walk", "contact_sheet_hana_walk.png")
    make_contact_sheet("hana", "idle", "contact_sheet_hana_idle.png")
    make_contact_sheet("luffy", "walk", "contact_sheet_luffy_walk.png")
    make_contact_sheet("luffy", "idle", "contact_sheet_luffy_idle.png")
