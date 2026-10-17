# Character artwork goes here

Empty on purpose. With no sheets present every character renders from the procedural
rig in `src/rig/draw.ts` — a PLACEHOLDER, not finished anime artwork.

Drop commissioned art in as:

    public/characters/<character-id>/manifest.json
    public/characters/<character-id>/idle.png  walk.png  wave.png  ...

The ids are in `src/rig/characters.ts` (hana, yuki, mochi, kaito, biscuit, bolt,
aegis, nocturne, solaris). The app picks the files up on next launch with no code
change; any character still missing sheets keeps using the rig.

Full spec, including frame size, baseline and the required animation list: ../../ASSETS.md
