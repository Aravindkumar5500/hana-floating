# Artwork brief — Luffy `idle` + `walk`

Self-contained commission brief. An artist needs **this file and the reference image
only**; nothing here depends on reading the code. Technical spec follows `ASSETS.md`
§2–§4 — where this file repeats a number, this file is the one to follow for Luffy.

**Status: NOT DELIVERED.** Luffy currently renders from the procedural rig in
`src/rig/draw.ts`. That is flat vector placeholder art, not the look below.

---

## 1. Deliverable

| | |
|---|---|
| Character | `luffy` |
| Animations | `idle` (16 frames) and `walk` (8 frames) — **24 frames total** |
| Frame size | **512 × 512 px**, one PNG per frame |
| Format | PNG-24, **straight (non-premultiplied) alpha**, fully transparent background |
| Colour | sRGB |
| Facing | **Right only.** The app mirrors for leftward movement, so no text, no asymmetric badges, no scar on only one side that would flip |

Deliver loose numbered frames (`frame-01.png` … `frame-16.png`). **Do not** composite the
strip or write the manifest — `tools/import-art.swift` does both, and doing it by hand is
how the last set ended up broken.

---

## 2. Alignment — the single most important requirement

Every frame, in both animations, must use the same anchor:

```
   x = 0                    x = 256                   x = 511
     +-------------------------|-------------------------+   y = 0
     |                         |                         |
     |                    (character ~430 px             |
     |                     tall, centred on              |
     |                     x = 256)                      |
     |                         |                         |
  ---+-------------------------+-------------------------+-- y = 486  <- SOLES
     |                         |                         |
     +-------------------------|-------------------------+   y = 511
```

- **Soles on y = 486** in every frame. The supporting foot touches this line; during a
  stride the lifted foot may rise above it, but the planted one does not move off it.
- **Centred on x = 256** — the body's mass centre, not the bounding box of a swung limb.
- **Height ≈ 430 px** crown-of-hat to soles. Natural bob of a few px is expected and fine.

If the baseline or centre drifts between frames the character jitters and slides across
the desktop. This is the failure that matters most.

---

## 3. Art direction

Match the supplied reference illustration. Specifically:

- **Line art** — clean, closed outlines with **line-weight variation**: heavier on the
  silhouette and under overhangs, lighter on interior detail. Not a uniform stroke.
- **Cel shading** — two tones plus a highlight, hard-edged. One consistent light
  direction across all 24 frames (upper-left reads best against a desktop).
- **Face** — expressive and readable at small size: large dark eyes with a catch-light,
  defined brows, open confident grin showing teeth, the small **stitched scar under the
  left eye** (viewer's right when facing right).
- **Hair** — black, in distinct clumped spikes with a blue-black highlight band. Not a
  single silhouette blob.
- **Clothing** — red open vest with three gold buttons and **visible fabric folds** at the
  hem and where it creases; blue denim shorts with stitching and the white cuffed hem;
  straw hat with a **woven texture** and a red band.
- **Anatomy** — lean teenage build, visible but not exaggerated muscle definition, correct
  joint placement, hands with separated fingers.
- **Sandals** — soles visible, straps on the foot.

### Hat constraint (this broke before)

The straw hat must sit **on the crown and stay attached to the head through every frame**,
tilting with the head. Its brim must **not** cross the eyes or cast the face into
shadow — at 210 px on screen the face is already small. Brim width should read as a hat,
roughly 1.2× head width, not a disc as wide as the shoulders.

### Head attachment (this also broke before)

The head must connect to the torso through a visible neck. The loader **rejects** any
frame where the body splits into disconnected pieces down the centre line.

---

## 4. Frame-by-frame

### `idle` — 16 frames, loops seamlessly

A relaxed standing loop. Frame 16 must flow back into frame 1 with no jump.

| Frames | Content |
|---|---|
| 1–4 | Breathe in: chest rises slightly, shoulders lift ~3 px, hat rises with the head |
| 5–8 | Hold and settle: weight shifts a little to one leg, vest hem drifts |
| 9–10 | **One blink** — closed on 9, reopening on 10 |
| 11–16 | Breathe out and return to the frame-1 pose |

Keep the motion small. The whole loop should move the silhouette by only a few pixels;
this plays constantly in the corner of someone's screen.

### `walk` — 8 frames, seamless alternating stride

**One full stride: each leg leads once.** The previous version repeated a single step,
which read as a limp.

| Frame | Pose |
|---|---|
| 1 | Contact — **right** foot forward, left behind, feet furthest apart |
| 2 | Down — weight onto the right leg, body lowest |
| 3 | Passing — legs together, body highest, left leg swinging through |
| 4 | Up — pushing off the right foot |
| 5 | Contact — **left** foot forward (mirror of frame 1) |
| 6 | Down — weight onto the left leg |
| 7 | Passing — legs together, body highest |
| 8 | Up — pushing off the left foot; flows back into frame 1 |

Checks that will be run on delivery:
- Feet must be **furthest apart at frames 1 and 5**, closest at 3 and 7 — two peaks per
  cycle. One peak means the legs are not alternating.
- Arms counter-swing against the legs (right arm forward as left leg leads).
- Body rises on the passing frames (3, 7) and dips on the contact frames.

---

## 5. Timing

| Animation | Frames | FPS | Loop | Animated duration |
|---|---|---|---|---|
| `idle` | 16 | **12** | yes | 1.333 s |
| `walk` | 8 | **12** | yes | 0.667 s |

`fps` must equal `frames ÷ duration` — animate the idle **over 1.333 s**, or playback
runs at a different speed than it was drawn at.

> **Flagged discrepancy:** `ASSETS.md` §3 specifies `idle` at **4.85 fps** (a 3.3 s loop),
> and the current `luffy/manifest.json` uses 4.85. This brief uses **12 fps** as most
> recently instructed, giving a 1.33 s idle — noticeably faster breathing. Both are
> valid; it is one number in the manifest and can be changed after delivery without
> redrawing. Confirm which you want before the artist starts, since it changes how the
> in-betweens are spaced.

---

## 6. Delivery and import

Put the loose frames here (any scratch location works; this is not inside the app):

```
incoming/luffy/idle/frame-01.png … frame-16.png
incoming/luffy/walk/frame-01.png … frame-08.png
```

Then, from the repository root:

```sh
# optional dry run - reports geometry problems without writing anything
swift tools/import-art.swift incoming/luffy luffy --dry-run

# real import: trims, scales to 430 px, centres on x=256, sets soles to y=486,
# composites each strip and writes the manifest
swift tools/import-art.swift incoming/luffy luffy
```

The importer writes:

```
public/characters/luffy/idle.png        8192 x 512   (16 x 512)
public/characters/luffy/walk.png        4096 x 512   ( 8 x 512)
public/characters/luffy/manifest.json
```

It prints `no problems found` when the set conforms.

**Partial delivery is safe.** The importer merges into any manifest already on disk, so
importing only `idle` and `walk` leaves the existing `wave`, `cheer` and `sleep` entries
and their PNGs intact — it prints `merging into existing manifest (...)` when it does.
(Before this was fixed, a partial import rewrote the manifest from scratch and silently
dropped every animation it was not given.)

---

## 7. What the app rejects

`src/rig/sprites.ts` validates every set at load and **refuses the whole character** if
any check fails, falling back to the procedural rig. A correct placeholder beats a broken
sheet. Rejections are logged with the reason, e.g.:

```
sprites: rejected "luffy" - cheer: soles at y=456, manifest baseline 486
```

| Check | Tolerance |
|---|---|
| Strip width equals `frameWidth × frames` | exact |
| Frame not empty | — |
| Soles vs declared baseline | ±12 px |
| Content height vs `characterHeight` | ±25% |
| Horizontal centre vs frame centre | ±12% of width |
| Body is one connected run down the centre band | gap > 3 px fails |

Do not relax these to make a set load — that is what allowed upside-down, detached-head
frames to ship.

---

## 8. Acceptance checklist

Artwork is accepted only when every line passes:

- [ ] 16 `idle` frames and 8 `walk` frames, 512 × 512 PNG-24
- [ ] Straight alpha; background fully transparent (not white, not a checkerboard)
- [ ] Soles on y = 486 in every frame (±2 px)
- [ ] Centred on x = 256 (±4 px)
- [ ] Height ≈ 430 px, consistent across frames
- [ ] Facing right; nothing that breaks when mirrored
- [ ] Head connected to torso through a neck in every frame
- [ ] Hat on the crown in every frame, not occluding the eyes
- [ ] `idle` loops 16 → 1 with no jump; exactly one blink
- [ ] `walk` has two contact poses; feet widest at frames 1 and 5
- [ ] Arms counter-swing against the legs
- [ ] Consistent light direction and line weight across all 24 frames
- [ ] `swift tools/import-art.swift incoming/luffy luffy` prints `no problems found`
- [ ] App logs `sprites loaded for luffy` (not `rejected`, not `no sprites`)
- [ ] Frame contact sheet reviewed by eye before acceptance

---

## 9. Rights

Commissioned artwork must come with rights for commercial redistribution inside a desktop
application. See `ASSETS.md` §5 on using recognisable published characters in a
distributed build — that risk is the owner's to accept, and is a separate decision from
the technical spec above.
