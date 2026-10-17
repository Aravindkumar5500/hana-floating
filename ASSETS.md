# Hana — character artwork specification

## Status: artwork is NOT done

Every character currently on screen is drawn by the procedural rig in `src/rig/draw.ts`.
That is a **placeholder**, not polished anime artwork, and it will not become polished by
further tweaking — flat vector shapes with per-limb outlines cannot produce line weight,
cel shading, hair clumping or real facial expression.

This file is the commission spec. Drop the delivered files in and the app uses them with
**no code change**; any character without sheets keeps falling back to the rig.

---

## 1. Roster

Ten characters, ids fixed by `src/rig/characters.ts`:

| id | Name | Kind | Design brief |
|---|---|---|---|
| `hana` | Hana | Anime girl | Purple twin-tails with ribbons, pink pinafore over white blouse, lilac shoes. Warm, cheerful. The flagship character |
| `yuki` | Yuki | Anime girl | Silver-blue bob, blue hoodie, calm and reserved. Slower, softer motion |
| `mochi` | Mochi | Anime girl | Peach side-ponytail, yellow sundress, bubbly and energetic |
| `kaito` | Kaito | Anime boy | Dark navy spiky hair, blue shirt, navy shorts. Confident, upbeat |
| `shinobi` | Kiba | Ninja | **Original ninja design.** Blond spiky hair, orange-and-navy outfit, forehead protector, scarf. See §5 |
| `biscuit` | Biscuit | Dog | Tan shiba-style quadruped, floppy ears, red collar, wagging tail |
| `bolt` | Bolt | Robot | Boxy chrome limbs, cyan visor, head antenna. Mechanical, not cute-organic |
| `aegis` | Aegis | Hero · armoured | **Original.** Red-and-gold powered armour, glowing visor, chest emblem. See §5 |
| `nocturne` | Nocturne | Hero · night | **Original.** Dark grey cowl with pointed ears, long cape, white eye lenses. See §5 |
| `solaris` | Solaris | Hero · caped | **Original.** Blue bodysuit, red cape and boots, chest emblem |

## 2. Frame format

| Property | Value |
|---|---|
| Frame size | **512 × 512 px** |
| Layout | One **horizontal strip** per animation, frame 0 leftmost, no gaps |
| Strip width | `512 × frameCount` |
| Format | PNG-24, straight (non-premultiplied) **alpha**, fully transparent background |
| Character height | **≈430 px** inside the frame |
| Baseline | **y = 486** — soles on this line in *every* frame |
| Horizontal anchor | centred on **x = 256** |
| Facing | **right only** — the app mirrors for leftward movement, so no text or asymmetric marks |

The baseline and centre must be identical in every frame of every animation, or she
jitters and slides. This is the single most important requirement.

Colour: sRGB, consistent light direction across all animations.

## 3. Animations per character

| Name | Frames | FPS | Loop | Content |
|---|---|---|---|---|
| `idle` | 16 | 4.85 | yes | Breathing, slight sway, **one blink**. Seamless loop |
| `walk` | 8 | 12 | yes | One **full stride**, legs clearly alternating. Seamless loop |
| `wave` | 6 | 4 | yes | Waving to get attention. Hand clearly in front of the body, not hidden behind it |
| `eye_rest` | 4 | 1.43 | yes | Eyes closed / hands near eyes |
| `drink` | 8 | 3.48 | **no** | Raise glass, drink, lower. Plays once over 2.3 s |
| `cheer` | 6 | 4.44 | **no** | Celebration. Plays once over 1.35 s |
| `sleep` | 4 | 0.74 | yes | Sitting, dozing |
| `drag` | 4 | 5 | yes | Dangling, surprised |
| `fall` | 2 | 4 | yes | Falling |
| `focus` | 4 | 1 | yes | Calm, settled |

`fps` must equal `frames ÷ duration` — if it doesn't, playback runs at a different speed
than the motion was drawn at.

Minimum viable delivery: **`idle` + `walk` + `wave`**. Everything else falls back to
`idle` automatically.

Quadruped note: for `biscuit`, `walk` must alternate **diagonal pairs** (front-left with
back-right), and `cheer`/`drag`/`fall` should be redrawn as dog-appropriate poses rather
than a biped jump.

## 4. Files

```
public/characters/<id>/manifest.json
public/characters/<id>/idle.png  walk.png  wave.png  eye_rest.png  drink.png
public/characters/<id>/cheer.png sleep.png drag.png  fall.png      focus.png
```

```json
{
  "name": "Hana",
  "frameWidth": 512,
  "frameHeight": 512,
  "baseline": 486,
  "characterHeight": 430,
  "animations": {
    "idle": { "file": "idle.png", "frames": 16, "fps": 4.85, "loop": true },
    "walk": { "file": "walk.png", "frames": 8,  "fps": 12,   "loop": true }
  }
}
```

List only animations that actually exist.

**Volume:** 10 characters × 10 animations = 100 strips (≈600 frames). Commissioning only
`idle`/`walk`/`wave` first is 30 strips and gets the app looking real.

## 5. Characters I did not build, and why

You asked for **Iron Man** and **Naruto**. I have not created them, and I would not
commission look-alikes either.

Iron Man is Marvel/Disney; Naruto is Masashi Kishimoto / Shueisha / Pierrot. Both the
characters and their designs are protected. Shipping recognisable versions inside a
distributed application is a trademark and copyright exposure — not a style choice. This
is the same reason the reference project (SipBuddy) states "the heroes are original
characters, not affiliated with any comic publisher or film studio."

Filling the same archetypes with original designs instead:

- **Aegis** — the armoured-hero slot. Red/gold powered armour, glowing visor.
- **Kiba** — the ninja slot. Blond spiky hair, orange-and-navy outfit, forehead protector.
- **Nocturne** / **Solaris** — the night-vigilante and caped-flyer archetypes.

If this stays strictly on your own machine and is never distributed, that risk is yours
to take, and you can commission whatever art you like and drop it into the folders above —
the pipeline does not care what the artwork depicts. I just won't bake impersonations
into the repository.

## 6. Alternatives considered

- **Live2D Cubism / Spine** — better deformation than sprite frames, but each adds a
  runtime and a commercial licence (Live2D above a revenue threshold, Spine per seat).
- **Sprite sheets** — chosen: no runtime, no licence, and the existing state machine
  drives them unchanged.

Commissioned artwork must come with rights for commercial redistribution inside a desktop
application.

## 7. Regenerating the placeholder preview

```sh
VITE_HANA_SNAPSHOT=1 npm run tauri build -- --debug --bundles app
open "src-tauri/target/debug/bundle/macos/Hana Anime Companion.app"
# writes a contact sheet to $TMPDIR/hana-frames/sheet.txt as a PNG data URL
```

Defined in `src/rig/snapshot.ts`; `src/rig/spritegen.ts` can emit rig-drawn strips in the
format above, useful for testing the pipeline — but those are placeholders, not artwork.

---

## 8. Phase 5 — pirate-adventure roster (specified, NOT built)

Six additional characters, to be **added alongside** the ten in §1. None of the existing
ids, names or saved selections change; see §8.4.

**Status: no artwork exists for any of these, and no code has been written.** They are
not in `src/rig/characters.ts` and do not appear in the Settings picker. Registering them
before frames exist would only add six more procedural-rig placeholders, which is the
opposite of the goal.

### 8.1 Why these designs

The brief was "One Piece character options". These are **original characters built from
broad pirate-adventure crew roles** — captain, swordsman, navigator, cook, lookout,
doctor — which are generic archetypes, not protected designs.

Specific published character designs are deliberately avoided: no straw boater hat, no
three-sword stance, no long-nosed sniper, no reindeer doctor, no scarred navy admirals.
Those are recognisable individual characters owned by Eiichiro Oda / Shueisha / Toei, and
shipping look-alikes in a distributed application is a trademark and copyright exposure —
the same reasoning as §5. If the app stays strictly on one machine and is never
distributed, that risk is the owner's to take, and the pipeline does not care what the
artwork depicts.

### 8.2 Roster

| id | Name | Kind | Design brief |
|---|---|---|---|
| `kestrel` | Kestrel | Pirate · captain | Crimson longcoat with gold frogging, black tricorn with a white feather, high boots. Broad confident stance, chin up. Dark hair, red sash |
| `marlowe` | Marlowe | Pirate · swordsman | Twin sabres, one drawn low. Dark green sash and open haori, bare chest, cropped black hair. Stoic, heavy-lidded eyes, low guard |
| `vela` | Vela | Pirate · navigator | Teal knee-length coat, brass spyglass at the hip, auburn hair tied back, slim silhouette. Alert, quick, one hand often shading her eyes |
| `galley` | Galley | Pirate · cook | Heavy build, white apron over a blue-and-white striped shirt, rolled sleeves, wooden ladle. Warm, loud, wide stance |
| `pip` | Pip | Pirate · lookout | Smallest of the six. Goggles pushed up on the forehead, slingshot, patched brown trousers, oversized boots. Jumpy, fast, light on his feet |
| `nautilus` | Nautilus | Pirate · doctor | White coat over a waistcoat, round spectacles, leather satchel. Calm, precise, slightly stooped |

Each must read as a **distinct silhouette at 210 px tall** — that is the on-screen size
(`CHAR_PX` in `src/rig/engine.ts`). Test every design shrunk to that height in greyscale:
if two are hard to tell apart, the silhouette is not doing enough work. Coat length, hat
shape, build and held props are the distinguishing features; facial detail is nearly
invisible at this size.

### 8.3 Frames and animations

**Identical to §2 and §3** — 512 × 512 frames, horizontal strips, baseline y = 486,
centred on x = 256, character ≈ 430 px tall, straight alpha, facing right only.

Delivery order:

1. **`idle` + `walk`** for all six — this is the minimum that makes them usable; every
   other animation falls back to `idle` automatically.
2. **`wave`** — the reminder attention pose. Hand clearly in front of the body.
3. The remaining animations from the §3 table, as budget allows.

That is 12 strips for step 1, 18 through step 2, 60 for the full set.

Per-character animation notes:

- `marlowe` — `wave` should not look like a sword draw; keep the blades sheathed.
- `galley` — the ladle is a held prop and must stay in hand across every frame of a loop.
- `pip` — higher energy; his `walk` can have more vertical bounce than the others.
- `nautilus` — slowest `walk`, shortest stride, consistent with the stooped posture.
- `kestrel` — the coat tail needs to settle, not snap, between strides.

### 8.4 Registration (do this only once frames exist)

Append to `CHARACTERS` in `src/rig/characters.ts`. **Append — do not reorder or renumber.**

This is safe and needs no migration:

- `src/components/SettingsPanel.tsx` maps over `CHARACTERS`, so new entries appear in the
  picker automatically.
- Saved selections store the raw id string, and `characterById()` falls back to
  `CHARACTERS[0]` for an unknown id, so existing saved preferences keep working.
- `DEFAULT_CHARACTER` is `CHARACTERS[0].id` — whatever sits first in the array. Inserting
  at the top silently changes the default character for new installs; append instead.

Each entry still needs a `palette`, `features` and `temperament` block, because the
procedural rig is the fallback whenever a sheet fails to load.

### 8.5 Files and validation

```
public/characters/kestrel/   manifest.json  idle.png  walk.png  ...
public/characters/marlowe/   …  vela/  galley/  pip/  nautilus/
```

Run every delivered frame through the importer, which trims to the content bounding box,
scales the character to 430 px, centres it on x = 256 and sets the soles on y = 486:

```sh
swift tools/import-art.swift <source-frames-dir> public/characters/<id>
```

Then confirm, per §2, that the baseline and centre are identical in every frame of every
animation. If they drift, the character jitters and slides as she walks. This is the
single most important check.
