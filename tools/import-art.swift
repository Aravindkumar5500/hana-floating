#!/usr/bin/env swift
//
// Artwork importer: conforms delivered PNG frames to the sprite-sheet spec in ASSETS.md.
//
// Artists rarely deliver frames already aligned. This trims each frame to its visible
// content, scales it so the character is exactly `characterHeight` tall, centres it on
// x = 256 and puts the soles on baseline y = 486 — the alignment the renderer depends on
// and the thing that, done by hand, causes sliding feet and jitter.
//
//   swift tools/import-art.swift <incoming-dir> <character-id> [--dry-run]
//
// Expects:  <incoming-dir>/<animation>/frame-01.png, frame-02.png, ...
// Writes:   public/characters/<character-id>/<animation>.png  (horizontal strip)
//           public/characters/<character-id>/manifest.json
//
import AppKit
import Foundation

let FRAME = 512
let BASELINE = 486
let CHARACTER_HEIGHT = 430.0

/// Frames-per-second for each animation, matching ASSETS.md.
let FPS: [String: Double] = [
    "idle": 4.85, "walk": 12, "wave": 4, "eye_rest": 1.43, "drink": 3.48,
    "cheer": 4.44, "sleep": 0.74, "drag": 5, "fall": 4, "focus": 1,
]
let LOOPS: Set<String> = ["idle", "walk", "wave", "eye_rest", "sleep", "drag", "fall", "focus"]

func bitmap(_ path: String) -> NSBitmapImageRep? {
    guard let d = FileManager.default.contents(atPath: path) else { return nil }
    return NSBitmapImageRep(data: d)
}

/// Bounding box of pixels with meaningful alpha.
func contentBox(_ rep: NSBitmapImageRep) -> (x: Int, y: Int, w: Int, h: Int)? {
    var minX = rep.pixelsWide, minY = rep.pixelsHigh, maxX = -1, maxY = -1
    for y in 0..<rep.pixelsHigh {
        for x in 0..<rep.pixelsWide {
            guard let c = rep.colorAt(x: x, y: y) else { continue }
            if c.alphaComponent > 0.06 {
                if x < minX { minX = x }; if x > maxX { maxX = x }
                if y < minY { minY = y }; if y > maxY { maxY = y }
            }
        }
    }
    if maxX < 0 { return nil }
    return (minX, minY, maxX - minX + 1, maxY - minY + 1)
}

let args = CommandLine.arguments
guard args.count >= 3 else {
    print("usage: swift tools/import-art.swift <incoming-dir> <character-id> [--dry-run]")
    exit(2)
}
let incoming = args[1], characterId = args[2]
let dryRun = args.contains("--dry-run")
let outDir = "public/characters/\(characterId)"

let fm = FileManager.default
guard let anims = try? fm.contentsOfDirectory(atPath: incoming) else {
    print("ERROR: cannot read \(incoming)"); exit(1)
}

// MERGE with any manifest already on disk, rather than starting empty. Artwork arrives
// in stages (idle + walk first, the rest later); writing the manifest from scratch on a
// partial import silently dropped the animations that were NOT being replaced, leaving
// their PNGs orphaned on disk and the character falling back to idle for all of them.
var manifestAnims: [String: Any] = {
    let path = "\(outDir)/manifest.json"
    guard let data = FileManager.default.contents(atPath: path),
          let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let existing = obj["animations"] as? [String: Any] else { return [:] }
    print("  merging into existing manifest (\(existing.keys.sorted().joined(separator: ",")))")
    return existing
}()
var problems: [String] = []

for anim in anims.sorted() where !anim.hasPrefix(".") {
    let animDir = "\(incoming)/\(anim)"
    var isDir: ObjCBool = false
    guard fm.fileExists(atPath: animDir, isDirectory: &isDir), isDir.boolValue else { continue }
    guard let files = try? fm.contentsOfDirectory(atPath: animDir) else { continue }
    let frames = files.filter { $0.lowercased().hasSuffix(".png") }.sorted()
    guard !frames.isEmpty else { continue }

    // Compose with an explicit CGContext at exact pixel dimensions. NSImage.lockFocus()
    // renders at the display's backing scale (2x on Retina), which silently produced
    // double-sized, misaligned strips.
    let stripW = FRAME * frames.count
    guard let ctx = CGContext(data: nil, width: stripW, height: FRAME,
                              bitsPerComponent: 8, bytesPerRow: 0,
                              space: CGColorSpaceCreateDeviceRGB(),
                              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
        problems.append("\(anim): could not allocate strip"); continue
    }
    ctx.clear(CGRect(x: 0, y: 0, width: stripW, height: FRAME))
    ctx.interpolationQuality = .high

    for (i, file) in frames.enumerated() {
        guard let rep = bitmap("\(animDir)/\(file)"), let cg = rep.cgImage else {
            problems.append("\(anim)/\(file): unreadable"); continue
        }
        if !rep.hasAlpha { problems.append("\(anim)/\(file): no alpha channel — background will be opaque") }
        guard let box = contentBox(rep) else {
            problems.append("\(anim)/\(file): fully transparent"); continue
        }
        // Crop to the visible content, then scale so the character is exactly
        // CHARACTER_HEIGHT tall and its soles sit on the baseline.
        guard let cropped = cg.cropping(to: CGRect(x: box.x, y: box.y, width: box.w, height: box.h)) else {
            problems.append("\(anim)/\(file): crop failed"); continue
        }
        let scale = CHARACTER_HEIGHT / Double(box.h)
        let drawW = Double(box.w) * scale
        let originX = Double(i * FRAME) + Double(FRAME) / 2 - drawW / 2
        // CGContext origin is bottom-left; baseline is measured from the top of the frame.
        let originY = Double(FRAME - BASELINE)
        ctx.draw(cropped, in: CGRect(x: originX, y: originY, width: drawW, height: CHARACTER_HEIGHT))
    }

    let fps = FPS[anim] ?? Double(frames.count) / 1.0
    manifestAnims[anim] = [
        "file": "\(anim).png", "frames": frames.count,
        "fps": fps, "loop": LOOPS.contains(anim),
    ]
    print("  \(anim): \(frames.count) frames -> \(FRAME * frames.count)x\(FRAME)")

    if !dryRun, let out = ctx.makeImage() {
        try? fm.createDirectory(atPath: outDir, withIntermediateDirectories: true)
        let rep = NSBitmapImageRep(cgImage: out)
        if let png = rep.representation(using: .png, properties: [:]) {
            try? png.write(to: URL(fileURLWithPath: "\(outDir)/\(anim).png"))
        }
    }
}

guard manifestAnims["idle"] != nil else {
    print("ERROR: an 'idle' animation is required (the renderer falls back to it)."); exit(1)
}

let manifest: [String: Any] = [
    "name": characterId.prefix(1).uppercased() + characterId.dropFirst(),
    "frameWidth": FRAME, "frameHeight": FRAME,
    "baseline": BASELINE, "characterHeight": Int(CHARACTER_HEIGHT),
    "animations": manifestAnims,
]
if !dryRun,
   let data = try? JSONSerialization.data(withJSONObject: manifest, options: [.prettyPrinted, .sortedKeys]) {
    try? data.write(to: URL(fileURLWithPath: "\(outDir)/manifest.json"))
}

print(problems.isEmpty ? "  no problems found" : "  PROBLEMS:")
problems.forEach { print("    - \($0)") }
print(dryRun ? "  (dry run — nothing written)" : "  wrote \(outDir)/")
