#!/usr/bin/env swift
//
// generate-op-artwork.swift
// Generates authentic transparent PNG artwork for 5 One Piece characters:
// 1. Monkey D. Luffy (luffy)
// 2. Roronoa Zoro (zoro)
// 3. Sanji (sanji)
// 4. Nami (nami)
// 5. Tony Tony Chopper (chopper)
//
// Outputs to tmp_art/<character-id>/<animation>/frame-XX.png,
// then imports through tools/import-art.swift to create sprite strips and manifests.
//

import AppKit
import Foundation

let W = 512
let H = 512

func hexColor(_ hex: String, alpha: CGFloat = 1.0) -> CGColor {
    var c = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if c.hasPrefix("#") { c.removeFirst() }
    var rgb: UInt64 = 0
    Scanner(string: c).scanHexInt64(&rgb)
    let r = CGFloat((rgb >> 16) & 0xFF) / 255.0
    let g = CGFloat((rgb >> 8) & 0xFF) / 255.0
    let b = CGFloat(rgb & 0xFF) / 255.0
    return CGColor(srgbRed: r, green: g, blue: b, alpha: alpha)
}

func fillEllipse(_ ctx: CGContext, center: CGPoint, rx: CGFloat, ry: CGFloat, fill: CGColor, stroke: CGColor? = nil, lineWidth: CGFloat = 1.5) {
    ctx.saveGState()
    ctx.addEllipse(in: CGRect(x: center.x - rx, y: center.y - ry, width: rx * 2, height: ry * 2))
    ctx.setFillColor(fill)
    ctx.fillPath()
    if let stroke = stroke {
        ctx.addEllipse(in: CGRect(x: center.x - rx, y: center.y - ry, width: rx * 2, height: ry * 2))
        ctx.setStrokeColor(stroke)
        ctx.setLineWidth(lineWidth)
        ctx.strokePath()
    }
    ctx.restoreGState()
}

func fillRoundedRect(_ ctx: CGContext, rect: CGRect, rx: CGFloat, ry: CGFloat, fill: CGColor, stroke: CGColor? = nil, lineWidth: CGFloat = 1.5) {
    ctx.saveGState()
    let path = CGPath(roundedRect: rect, cornerWidth: rx, cornerHeight: ry, transform: nil)
    ctx.addPath(path)
    ctx.setFillColor(fill)
    ctx.fillPath()
    if let stroke = stroke {
        ctx.addPath(path)
        ctx.setStrokeColor(stroke)
        ctx.setLineWidth(lineWidth)
        ctx.strokePath()
    }
    ctx.restoreGState()
}

func drawLimbCapsule(_ ctx: CGContext, from: CGPoint, to: CGPoint, r1: CGFloat, r2: CGFloat, fill: CGColor, stroke: CGColor? = nil, lineWidth: CGFloat = 1.5) {
    ctx.saveGState()
    let dx = to.x - from.x
    let dy = to.y - from.y
    let dist = hypot(dx, dy)
    let angle = atan2(dy, dx)
    
    ctx.translateBy(x: from.x, y: from.y)
    ctx.rotate(by: angle)
    
    ctx.beginPath()
    ctx.addArc(center: CGPoint(x: 0, y: 0), radius: r1, startAngle: .pi / 2, endAngle: -.pi / 2, clockwise: false)
    ctx.addArc(center: CGPoint(x: dist, y: 0), radius: r2, startAngle: -.pi / 2, endAngle: .pi / 2, clockwise: false)
    ctx.closePath()
    
    ctx.setFillColor(fill)
    ctx.fillPath()
    if let stroke = stroke {
        ctx.beginPath()
        ctx.addArc(center: CGPoint(x: 0, y: 0), radius: r1, startAngle: .pi / 2, endAngle: -.pi / 2, clockwise: false)
        ctx.addArc(center: CGPoint(x: dist, y: 0), radius: r2, startAngle: -.pi / 2, endAngle: .pi / 2, clockwise: false)
        ctx.closePath()
        ctx.setStrokeColor(stroke)
        ctx.setLineWidth(lineWidth)
        ctx.strokePath()
    }
    ctx.restoreGState()
}

// -----------------------------------------------------------------------------
// LUFFY RENDERER
// -----------------------------------------------------------------------------
func drawLuffyFrame(ctx: CGContext, anim: String, frame: Int, totalFrames: Int) {
    let t = CGFloat(frame) / CGFloat(totalFrames)
    let bounce = (anim == "walk") ? abs(sin(t * .pi * 2)) * 14.0 : sin(t * .pi * 2) * 3.5
    let breath = sin(t * .pi * 2) * 2.0
    let waveArm = (anim == "wave") ? sin(t * .pi * 4) * 0.35 : 0.0
    let cheerArm = (anim == "cheer") ? 1.0 : 0.0
    let isSleep = (anim == "sleep")
    let isBlink = (anim == "idle" && (frame == 8 || frame == 9)) || isSleep
    
    let baseCenter = CGPoint(x: 256, y: 310 - bounce)
    // Head sits 84 above the hips, not 100: with headR 58 the chin lands at
    // baseCenter.y - 26, which overlaps the chest top (baseCenter.y + 15 - ry 45 =
    // -30). At -100 the chin was at -42 and the head floated 12px clear of the torso.
    let headCenter = CGPoint(x: baseCenter.x, y: baseCenter.y - 84 + (isSleep ? 15 : 0))
    let headR: CGFloat = 58
    
    let skin = hexColor("#fed4b0")
    let skinShade = hexColor("#e5b08c")
    let ink = hexColor("#231a14")
    let redVest = hexColor("#d32424")
    let redVestShade = hexColor("#a81717")
    let blueDenim = hexColor("#27599e")
    let strawYellow = hexColor("#f5d342")
    let strawDark = hexColor("#caa028")
    let white = hexColor("#ffffff")
    
    // Back hair clumps
    for i in 0..<7 {
        let angle = CGFloat(i) * 0.28 - 0.84
        let hx = headCenter.x + sin(angle) * (headR + 10)
        let hy = headCenter.y - cos(angle) * (headR + 8)
        fillEllipse(ctx, center: CGPoint(x: hx, y: hy), rx: 14, ry: 20, fill: ink)
    }
    
    // Straw Hat (Back brim)
    ctx.saveGState()
    let hatCenter = CGPoint(x: headCenter.x, y: headCenter.y - (isSleep ? 25 : 18))
    fillEllipse(ctx, center: hatCenter, rx: 105, ry: 38, fill: strawYellow, stroke: ink, lineWidth: 3.5)
    // Straw hatch texture
    ctx.setStrokeColor(strawDark)
    ctx.setLineWidth(1.4)
    for k in 0..<12 {
        let a = CGFloat(k) * .pi / 6.0
        ctx.beginPath()
        ctx.move(to: CGPoint(x: hatCenter.x + cos(a) * 50, y: hatCenter.y + sin(a) * 18))
        ctx.addLine(to: CGPoint(x: hatCenter.x + cos(a) * 98, y: hatCenter.y + sin(a) * 34))
        ctx.strokePath()
    }
    ctx.restoreGState()
    
    // Legs & Sandals
    // A side-view walk separates the feet along the WALKING axis. Holding the standing
    // stance width (+-24) through the cycle made the swing cancel it at one extreme:
    // the feet converged at phase 0.25 instead of alternating, so the strip read as one
    // repeated step rather than a stride. The stance is collapsed during the walk below.
    let legWalkL = (anim == "walk") ? sin(t * .pi * 2) * 22 : 0
    let legWalkR = (anim == "walk") ? -sin(t * .pi * 2) * 22 : 0
    let footY: CGFloat = 465
    
    // Left leg
    let hipL = CGPoint(x: baseCenter.x - 22, y: baseCenter.y + 60)
    let footL = CGPoint(x: baseCenter.x - (anim == "walk" ? 4 : 24) + legWalkL, y: footY)
    drawLimbCapsule(ctx, from: hipL, to: footL, r1: 14, r2: 10, fill: skin, stroke: ink, lineWidth: 2.5)
    // Left cuffed shorts
    drawLimbCapsule(ctx, from: hipL, to: CGPoint(x: (hipL.x + footL.x)/2, y: (hipL.y + footL.y)/2), r1: 17, r2: 15, fill: blueDenim, stroke: ink, lineWidth: 2.5)
    fillEllipse(ctx, center: CGPoint(x: (hipL.x + footL.x)/2, y: (hipL.y + footL.y)/2), rx: 16, ry: 7, fill: white, stroke: ink, lineWidth: 2.0)
    // Left sandal
    fillEllipse(ctx, center: CGPoint(x: footL.x, y: footL.y + 4), rx: 16, ry: 6, fill: strawYellow, stroke: ink, lineWidth: 2.0)
    fillEllipse(ctx, center: CGPoint(x: footL.x, y: footL.y + 2), rx: 6, ry: 4, fill: redVest)
    
    // Right leg
    let hipR = CGPoint(x: baseCenter.x + 22, y: baseCenter.y + 60)
    let footR = CGPoint(x: baseCenter.x + (anim == "walk" ? 4 : 24) + legWalkR, y: footY)
    drawLimbCapsule(ctx, from: hipR, to: footR, r1: 14, r2: 10, fill: skin, stroke: ink, lineWidth: 2.5)
    // Right cuffed shorts
    drawLimbCapsule(ctx, from: hipR, to: CGPoint(x: (hipR.x + footR.x)/2, y: (hipR.y + footR.y)/2), r1: 17, r2: 15, fill: blueDenim, stroke: ink, lineWidth: 2.5)
    fillEllipse(ctx, center: CGPoint(x: (hipR.x + footR.x)/2, y: (hipR.y + footR.y)/2), rx: 16, ry: 7, fill: white, stroke: ink, lineWidth: 2.0)
    // Right sandal
    fillEllipse(ctx, center: CGPoint(x: footR.x, y: footR.y + 4), rx: 16, ry: 6, fill: strawYellow, stroke: ink, lineWidth: 2.0)
    fillEllipse(ctx, center: CGPoint(x: footR.x, y: footR.y + 2), rx: 6, ry: 4, fill: redVest)
    
    // Torso (Open Red Vest with bare chest)
    let chestCenter = CGPoint(x: baseCenter.x, y: baseCenter.y + 15 + breath)
    fillEllipse(ctx, center: chestCenter, rx: 32, ry: 45, fill: skin, stroke: ink, lineWidth: 2.5)
    // Red vest panels
    ctx.saveGState()
    ctx.beginPath()
    ctx.move(to: CGPoint(x: chestCenter.x - 30, y: chestCenter.y - 35))
    ctx.addQuadCurve(to: CGPoint(x: chestCenter.x - 32, y: chestCenter.y + 42), control: CGPoint(x: chestCenter.x - 38, y: chestCenter.y))
    ctx.addLine(to: CGPoint(x: chestCenter.x - 12, y: chestCenter.y + 42))
    ctx.addQuadCurve(to: CGPoint(x: chestCenter.x - 10, y: chestCenter.y - 35), control: CGPoint(x: chestCenter.x - 16, y: chestCenter.y))
    ctx.closePath()
    ctx.setFillColor(redVest)
    ctx.fillPath()
    ctx.setStrokeColor(ink)
    ctx.setLineWidth(2.5)
    ctx.strokePath()
    
    ctx.beginPath()
    ctx.move(to: CGPoint(x: chestCenter.x + 30, y: chestCenter.y - 35))
    ctx.addQuadCurve(to: CGPoint(x: chestCenter.x + 32, y: chestCenter.y + 42), control: CGPoint(x: chestCenter.x + 38, y: chestCenter.y))
    ctx.addLine(to: CGPoint(x: chestCenter.x + 12, y: chestCenter.y + 42))
    ctx.addQuadCurve(to: CGPoint(x: chestCenter.x + 10, y: chestCenter.y - 35), control: CGPoint(x: chestCenter.x + 16, y: chestCenter.y))
    ctx.closePath()
    ctx.setFillColor(redVest)
    ctx.fillPath()
    ctx.setStrokeColor(ink)
    ctx.setLineWidth(2.5)
    ctx.strokePath()
    ctx.restoreGState()
    
    // Yellow waist sash
    fillRoundedRect(ctx, rect: CGRect(x: chestCenter.x - 28, y: chestCenter.y + 36, width: 56, height: 12), rx: 5, ry: 5, fill: strawYellow, stroke: ink, lineWidth: 2.0)
    
    // Arms
    let armSwing = (anim == "walk") ? sin(t * .pi * 2) * 25 : 0
    let handL = (cheerArm > 0) ? CGPoint(x: chestCenter.x - 45, y: chestCenter.y - 80) : CGPoint(x: chestCenter.x - 35 - armSwing, y: chestCenter.y + 30)
    let handR = (cheerArm > 0) ? CGPoint(x: chestCenter.x + 45, y: chestCenter.y - 80) :
                (anim == "wave") ? CGPoint(x: chestCenter.x + 45 + waveArm * 30, y: chestCenter.y - 65 + waveArm * 10) :
                CGPoint(x: chestCenter.x + 35 + armSwing, y: chestCenter.y + 30)
    
    drawLimbCapsule(ctx, from: CGPoint(x: chestCenter.x - 26, y: chestCenter.y - 20), to: handL, r1: 10, r2: 8, fill: skin, stroke: ink, lineWidth: 2.2)
    fillEllipse(ctx, center: handL, rx: 9, ry: 9, fill: skin, stroke: ink, lineWidth: 2.0)
    
    drawLimbCapsule(ctx, from: CGPoint(x: chestCenter.x + 26, y: chestCenter.y - 20), to: handR, r1: 10, r2: 8, fill: skin, stroke: ink, lineWidth: 2.2)
    fillEllipse(ctx, center: handR, rx: 9, ry: 9, fill: skin, stroke: ink, lineWidth: 2.0)
    
    // Head shape
    fillEllipse(ctx, center: headCenter, rx: headR * 0.95, ry: headR * 0.9, fill: skin, stroke: ink, lineWidth: 3.0)
    
    // Soft blush
    fillEllipse(ctx, center: CGPoint(x: headCenter.x - 32, y: headCenter.y + 12), rx: 11, ry: 6, fill: hexColor("#ff9999", alpha: 0.5))
    fillEllipse(ctx, center: CGPoint(x: headCenter.x + 32, y: headCenter.y + 12), rx: 11, ry: 6, fill: hexColor("#ff9999", alpha: 0.5))
    
    // Eyes
    if isBlink {
        // Curved happy eye lines
        ctx.saveGState()
        ctx.setStrokeColor(ink)
        ctx.setLineWidth(3.0)
        ctx.setLineCap(.round)
        ctx.beginPath()
        ctx.move(to: CGPoint(x: headCenter.x - 34, y: headCenter.y - 2))
        ctx.addQuadCurve(to: CGPoint(x: headCenter.x - 14, y: headCenter.y - 2), control: CGPoint(x: headCenter.x - 24, y: headCenter.y - 12))
        ctx.move(to: CGPoint(x: headCenter.x + 14, y: headCenter.y - 2))
        ctx.addQuadCurve(to: CGPoint(x: headCenter.x + 34, y: headCenter.y - 2), control: CGPoint(x: headCenter.x + 24, y: headCenter.y - 12))
        ctx.strokePath()
        ctx.restoreGState()
    } else {
        // Shonen anime eyes
        fillEllipse(ctx, center: CGPoint(x: headCenter.x - 24, y: headCenter.y - 4), rx: 12, ry: 15, fill: white, stroke: ink, lineWidth: 2.2)
        fillEllipse(ctx, center: CGPoint(x: headCenter.x - 23, y: headCenter.y - 4), rx: 8, ry: 11, fill: ink)
        fillEllipse(ctx, center: CGPoint(x: headCenter.x - 26, y: headCenter.y - 8), rx: 4.5, ry: 4.5, fill: white)
        
        fillEllipse(ctx, center: CGPoint(x: headCenter.x + 24, y: headCenter.y - 4), rx: 12, ry: 15, fill: white, stroke: ink, lineWidth: 2.2)
        fillEllipse(ctx, center: CGPoint(x: headCenter.x + 25, y: headCenter.y - 4), rx: 8, ry: 11, fill: ink)
        fillEllipse(ctx, center: CGPoint(x: headCenter.x + 22, y: headCenter.y - 8), rx: 4.5, ry: 4.5, fill: white)
    }
    
    // Eyebrows: confident bold shonen brows
    ctx.saveGState()
    ctx.setStrokeColor(ink)
    ctx.setLineWidth(3.0)
    ctx.setLineCap(.round)
    ctx.beginPath()
    ctx.move(to: CGPoint(x: headCenter.x - 36, y: headCenter.y - 18))
    ctx.addQuadCurve(to: CGPoint(x: headCenter.x - 12, y: headCenter.y - 16), control: CGPoint(x: headCenter.x - 24, y: headCenter.y - 23))
    ctx.move(to: CGPoint(x: headCenter.x + 12, y: headCenter.y - 16))
    ctx.addQuadCurve(to: CGPoint(x: headCenter.x + 36, y: headCenter.y - 18), control: CGPoint(x: headCenter.x + 24, y: headCenter.y - 23))
    ctx.strokePath()
    ctx.restoreGState()

    // Luffy's stitched eye scar under left eye (viewer's right)
    ctx.saveGState()
    ctx.setStrokeColor(ink)
    ctx.setLineWidth(1.8)
    ctx.setLineCap(.round)
    ctx.beginPath()
    ctx.move(to: CGPoint(x: headCenter.x + 17, y: headCenter.y + 15))
    ctx.addQuadCurve(to: CGPoint(x: headCenter.x + 31, y: headCenter.y + 15), control: CGPoint(x: headCenter.x + 24, y: headCenter.y + 17))
    ctx.move(to: CGPoint(x: headCenter.x + 20, y: headCenter.y + 12))
    ctx.addLine(to: CGPoint(x: headCenter.x + 20, y: headCenter.y + 18))
    ctx.move(to: CGPoint(x: headCenter.x + 27, y: headCenter.y + 12))
    ctx.addLine(to: CGPoint(x: headCenter.x + 27, y: headCenter.y + 18))
    ctx.strokePath()
    ctx.restoreGState()
    
    // Wide toothy pirate grin (Joyful, curved, authentic)
    ctx.saveGState()
    let mouthY = headCenter.y + 24
    ctx.beginPath()
    ctx.move(to: CGPoint(x: headCenter.x - 28, y: mouthY))
    ctx.addQuadCurve(to: CGPoint(x: headCenter.x + 28, y: mouthY), control: CGPoint(x: headCenter.x, y: mouthY - 3))
    ctx.addQuadCurve(to: CGPoint(x: headCenter.x - 28, y: mouthY), control: CGPoint(x: headCenter.x, y: mouthY + 24))
    ctx.closePath()
    ctx.setFillColor(white)
    ctx.fillPath()
    ctx.setStrokeColor(ink)
    ctx.setLineWidth(2.4)
    ctx.strokePath()
    // Soft tooth lines
    ctx.setStrokeColor(hexColor("#d5c4b8"))
    ctx.setLineWidth(1.2)
    for off in [-16, -5, 5, 16] {
        ctx.beginPath()
        ctx.move(to: CGPoint(x: headCenter.x + CGFloat(off), y: mouthY + 1))
        ctx.addLine(to: CGPoint(x: headCenter.x + CGFloat(off) * 0.85, y: mouthY + 12))
        ctx.strokePath()
    }
    // Smile corner dimples
    ctx.setStrokeColor(ink)
    ctx.setLineWidth(2.0)
    ctx.beginPath()
    ctx.move(to: CGPoint(x: headCenter.x - 30, y: mouthY + 3))
    ctx.addLine(to: CGPoint(x: headCenter.x - 27, y: mouthY - 2))
    ctx.move(to: CGPoint(x: headCenter.x + 30, y: mouthY + 3))
    ctx.addLine(to: CGPoint(x: headCenter.x + 27, y: mouthY - 2))
    ctx.strokePath()
    ctx.restoreGState()
    
    // Front black spiky hair tufts
    for (ox, oy, w, h) in [(-42, -26, 16, 28), (-24, -36, 18, 30), (0, -40, 20, 32), (24, -36, 18, 30), (42, -26, 16, 28)] {
        fillEllipse(ctx, center: CGPoint(x: headCenter.x + CGFloat(ox), y: headCenter.y + CGFloat(oy)), rx: CGFloat(w), ry: CGFloat(h), fill: ink)
    }
    
    // Straw Hat (Front crown & red band)
    ctx.saveGState()
    let crownCenter = CGPoint(x: hatCenter.x, y: hatCenter.y - 28)
    fillEllipse(ctx, center: crownCenter, rx: 62, ry: 40, fill: strawYellow, stroke: ink, lineWidth: 3.0)
    // Red cloth band
    ctx.beginPath()
    // Band hugs the BASE of the crown. At radius 61 centred on crownCenter.y + 12 its
    // lowest point fell at +73 - well past the crown's base (ry 40) - so the band was
    // stroked straight across the face. Centre -10 with radius 46 puts the low point at
    // +36, just inside the crown.
    ctx.addArc(center: CGPoint(x: crownCenter.x, y: crownCenter.y - 10), radius: 46, startAngle: 0.25, endAngle: .pi - 0.25, clockwise: false)
    ctx.setStrokeColor(redVest)
    ctx.setLineWidth(14.0)
    ctx.setLineCap(.butt)
    ctx.strokePath()
    ctx.restoreGState()
}

// -----------------------------------------------------------------------------
// ZORO RENDERER
// -----------------------------------------------------------------------------
func drawZoroFrame(ctx: CGContext, anim: String, frame: Int, totalFrames: Int) {
    let t = CGFloat(frame) / CGFloat(totalFrames)
    let bounce = (anim == "walk") ? abs(sin(t * .pi * 2)) * 12.0 : sin(t * .pi * 2) * 2.8
    let isSleep = (anim == "sleep")
    let isBlink = (anim == "idle" && (frame == 8 || frame == 9)) || isSleep
    let swordBob = sin(t * .pi * 2) * 4.0
    
    let baseCenter = CGPoint(x: 256, y: 310 - bounce)
    let headCenter = CGPoint(x: baseCenter.x, y: baseCenter.y - 84 + (isSleep ? 12 : 0))
    let headR: CGFloat = 58
    
    let skin = hexColor("#fed1a8")
    let ink = hexColor("#1e261a")
    let mossGreen = hexColor("#488f40")
    let mossDark = hexColor("#265421")
    let coatGreen = hexColor("#1d3d2a")
    let haramaki = hexColor("#52a340")
    let gold = hexColor("#f1c40f")
    let pants = hexColor("#172b1d")
    let boots = hexColor("#1a1a20")
    let white = hexColor("#ffffff")
    
    // Moss green hair base
    fillEllipse(ctx, center: CGPoint(x: headCenter.x, y: headCenter.y - 10), rx: headR * 1.02, ry: headR * 0.98, fill: mossGreen)
    for i in 0..<8 {
        let a = CGFloat(i) * 0.4 - 1.4
        let spk = CGPoint(x: headCenter.x + sin(a) * (headR + 6), y: headCenter.y - cos(a) * (headR + 4))
        fillEllipse(ctx, center: spk, rx: 12, ry: 18, fill: mossDark)
    }
    
    // Legs & Boots
    let legWalkL = (anim == "walk") ? sin(t * .pi * 2) * 20 : 0
    let legWalkR = (anim == "walk") ? -sin(t * .pi * 2) * 20 : 0
    let footY: CGFloat = 465
    
    let hipL = CGPoint(x: baseCenter.x - 20, y: baseCenter.y + 60)
    let footL = CGPoint(x: baseCenter.x - (anim == "walk" ? 4 : 22) + legWalkL, y: footY)
    drawLimbCapsule(ctx, from: hipL, to: footL, r1: 15, r2: 12, fill: pants, stroke: ink, lineWidth: 2.5)
    fillEllipse(ctx, center: CGPoint(x: footL.x, y: footL.y + 2), rx: 17, ry: 7, fill: boots, stroke: ink, lineWidth: 2.2)
    
    let hipR = CGPoint(x: baseCenter.x + 20, y: baseCenter.y + 60)
    let footR = CGPoint(x: baseCenter.x + (anim == "walk" ? 4 : 22) + legWalkR, y: footY)
    drawLimbCapsule(ctx, from: hipR, to: footR, r1: 15, r2: 12, fill: pants, stroke: ink, lineWidth: 2.5)
    fillEllipse(ctx, center: CGPoint(x: footR.x, y: footR.y + 2), rx: 17, ry: 7, fill: boots, stroke: ink, lineWidth: 2.2)
    
    // Three Katana Scabbards (Wado Ichimonji, Sandai Kitetsu, Shusui)
    ctx.saveGState()
    ctx.translateBy(x: baseCenter.x - 28, y: baseCenter.y + 35 + swordBob)
    ctx.rotate(by: 0.38)
    let scabbards = [
        (hexColor("#fefefe"), gold, hexColor("#ffffff")),  // Wado Ichimonji
        (hexColor("#9b1c1c"), gold, hexColor("#1a1a1a")),  // Sandai Kitetsu
        (hexColor("#232328"), hexColor("#a67c2e"), hexColor("#1a1a1a")) // Shusui
    ]
    for (i, sc) in scabbards.enumerated() {
        let ox = CGFloat(i * 9 - 9)
        // Sheath blade
        fillRoundedRect(ctx, rect: CGRect(x: ox - 4, y: -45, width: 8, height: 90), rx: 3, ry: 3, fill: sc.0, stroke: ink, lineWidth: 1.8)
        // Tsuba guard
        fillEllipse(ctx, center: CGPoint(x: ox, y: -45), rx: 7, ry: 3.5, fill: sc.1, stroke: ink, lineWidth: 1.5)
        // Tsuka handle
        fillRoundedRect(ctx, rect: CGRect(x: ox - 3.5, y: -72, width: 7, height: 26), rx: 2, ry: 2, fill: sc.2, stroke: ink, lineWidth: 1.5)
    }
    ctx.restoreGState()
    
    // Torso: Dark green coat & Green Haramaki sash
    let chestCenter = CGPoint(x: baseCenter.x, y: baseCenter.y + 15)
    fillEllipse(ctx, center: chestCenter, rx: 34, ry: 46, fill: coatGreen, stroke: ink, lineWidth: 2.5)
    // Haramaki sash around belly
    fillRoundedRect(ctx, rect: CGRect(x: chestCenter.x - 30, y: chestCenter.y + 8, width: 60, height: 28), rx: 6, ry: 6, fill: haramaki, stroke: ink, lineWidth: 2.2)
    // Ribbed texture on sash
    ctx.saveGState()
    ctx.setStrokeColor(hexColor("#3e8230"))
    ctx.setLineWidth(1.8)
    for sx in [-18, -6, 6, 18] {
        ctx.beginPath()
        ctx.move(to: CGPoint(x: chestCenter.x + CGFloat(sx), y: chestCenter.y + 8))
        ctx.addLine(to: CGPoint(x: chestCenter.x + CGFloat(sx), y: chestCenter.y + 36))
        ctx.strokePath()
    }
    ctx.restoreGState()
    
    // Arms
    let armL = CGPoint(x: chestCenter.x - 34, y: chestCenter.y + 30)
    let armR = (anim == "wave") ? CGPoint(x: chestCenter.x + 45, y: chestCenter.y - 45) : CGPoint(x: chestCenter.x + 34, y: chestCenter.y + 30)
    drawLimbCapsule(ctx, from: CGPoint(x: chestCenter.x - 28, y: chestCenter.y - 18), to: armL, r1: 12, r2: 9, fill: coatGreen, stroke: ink, lineWidth: 2.2)
    fillEllipse(ctx, center: armL, rx: 9, ry: 9, fill: skin, stroke: ink, lineWidth: 2.0)
    
    drawLimbCapsule(ctx, from: CGPoint(x: chestCenter.x + 28, y: chestCenter.y - 18), to: armR, r1: 12, r2: 9, fill: coatGreen, stroke: ink, lineWidth: 2.2)
    fillEllipse(ctx, center: armR, rx: 9, ry: 9, fill: skin, stroke: ink, lineWidth: 2.0)
    
    // Head shape
    fillEllipse(ctx, center: headCenter, rx: headR * 0.94, ry: headR * 0.88, fill: skin, stroke: ink, lineWidth: 3.0)
    
    // Zoro's Triple Gold Hoop Earrings (left ear, viewer's left)
    ctx.saveGState()
    ctx.setStrokeColor(gold)
    ctx.setLineWidth(2.2)
    for i in 0..<3 {
        let ex = headCenter.x - headR * 0.94 + CGFloat(i * 4) - 3
        let ey = headCenter.y + 4
        ctx.beginPath()
        ctx.move(to: CGPoint(x: ex, y: ey))
        ctx.addLine(to: CGPoint(x: ex, y: ey + 14))
        ctx.strokePath()
        fillEllipse(ctx, center: CGPoint(x: ex, y: ey + 14), rx: 2.2, ry: 2.2, fill: gold)
    }
    ctx.restoreGState()
    
    // Eyes: Stoic, sharp eyes
    if isBlink {
        ctx.saveGState()
        ctx.setStrokeColor(ink)
        ctx.setLineWidth(3.0)
        ctx.beginPath()
        ctx.move(to: CGPoint(x: headCenter.x - 30, y: headCenter.y - 2))
        ctx.addLine(to: CGPoint(x: headCenter.x - 12, y: headCenter.y - 2))
        ctx.move(to: CGPoint(x: headCenter.x + 12, y: headCenter.y - 2))
        ctx.addLine(to: CGPoint(x: headCenter.x + 30, y: headCenter.y - 2))
        ctx.strokePath()
        ctx.restoreGState()
    } else {
        fillEllipse(ctx, center: CGPoint(x: headCenter.x - 22, y: headCenter.y - 4), rx: 11, ry: 13, fill: white, stroke: ink, lineWidth: 2.2)
        fillEllipse(ctx, center: CGPoint(x: headCenter.x - 21, y: headCenter.y - 4), rx: 7, ry: 9, fill: ink)
        
        fillEllipse(ctx, center: CGPoint(x: headCenter.x + 22, y: headCenter.y - 4), rx: 11, ry: 13, fill: white, stroke: ink, lineWidth: 2.2)
        fillEllipse(ctx, center: CGPoint(x: headCenter.x + 23, y: headCenter.y - 4), rx: 7, ry: 9, fill: ink)
    }
    
    // Left eye scar (running vertically across eye)
    ctx.saveGState()
    ctx.setStrokeColor(ink)
    ctx.setLineWidth(2.2)
    ctx.beginPath()
    ctx.move(to: CGPoint(x: headCenter.x + 22, y: headCenter.y - 20))
    ctx.addLine(to: CGPoint(x: headCenter.x + 22, y: headCenter.y + 14))
    ctx.strokePath()
    ctx.restoreGState()
    
    // Stoic smirk
    ctx.saveGState()
    ctx.setStrokeColor(ink)
    ctx.setLineWidth(2.4)
    ctx.beginPath()
    ctx.move(to: CGPoint(x: headCenter.x - 12, y: headCenter.y + 24))
    ctx.addQuadCurve(to: CGPoint(x: headCenter.x + 16, y: headCenter.y + 21), control: CGPoint(x: headCenter.x + 2, y: headCenter.y + 26))
    ctx.strokePath()
    ctx.restoreGState()
}

// -----------------------------------------------------------------------------
// SANJI RENDERER
// -----------------------------------------------------------------------------
func drawSanjiFrame(ctx: CGContext, anim: String, frame: Int, totalFrames: Int) {
    let t = CGFloat(frame) / CGFloat(totalFrames)
    let bounce = (anim == "walk") ? abs(sin(t * .pi * 2)) * 10.0 : sin(t * .pi * 2) * 2.5
    let isSleep = (anim == "sleep")
    let isBlink = (anim == "idle" && (frame == 8 || frame == 9)) || isSleep
    
    let baseCenter = CGPoint(x: 256, y: 310 - bounce)
    let headCenter = CGPoint(x: baseCenter.x, y: baseCenter.y - 84 + (isSleep ? 12 : 0))
    let headR: CGFloat = 58
    
    let skin = hexColor("#ffe4cf")
    let ink = hexColor("#231e1a")
    let blond = hexColor("#fed843")
    let blondDark = hexColor("#d1a31b")
    let suitBlack = hexColor("#1b212c")
    let shirtBlue = hexColor("#7bb3e8")
    let gold = hexColor("#f5d342")
    let shoes = hexColor("#11141a")
    let white = hexColor("#ffffff")
    
    // Legs & Shoes
    let legWalkL = (anim == "walk") ? sin(t * .pi * 2) * 22 : 0
    let legWalkR = (anim == "walk") ? -sin(t * .pi * 2) * 22 : 0
    let footY: CGFloat = 465
    
    let hipL = CGPoint(x: baseCenter.x - 18, y: baseCenter.y + 60)
    let footL = CGPoint(x: baseCenter.x - (anim == "walk" ? 4 : 20) + legWalkL, y: footY)
    drawLimbCapsule(ctx, from: hipL, to: footL, r1: 14, r2: 11, fill: suitBlack, stroke: ink, lineWidth: 2.5)
    fillEllipse(ctx, center: CGPoint(x: footL.x, y: footL.y + 2), rx: 16, ry: 6.5, fill: shoes, stroke: ink, lineWidth: 2.2)
    
    let hipR = CGPoint(x: baseCenter.x + 18, y: baseCenter.y + 60)
    let footR = CGPoint(x: baseCenter.x + (anim == "walk" ? 4 : 20) + legWalkR, y: footY)
    drawLimbCapsule(ctx, from: hipR, to: footR, r1: 14, r2: 11, fill: suitBlack, stroke: ink, lineWidth: 2.5)
    fillEllipse(ctx, center: CGPoint(x: footR.x, y: footR.y + 2), rx: 16, ry: 6.5, fill: shoes, stroke: ink, lineWidth: 2.2)
    
    // Torso: Double-breasted Suit Jacket
    let chestCenter = CGPoint(x: baseCenter.x, y: baseCenter.y + 15)
    fillEllipse(ctx, center: chestCenter, rx: 33, ry: 45, fill: suitBlack, stroke: ink, lineWidth: 2.5)
    // Light blue shirt collar & black tie
    ctx.saveGState()
    ctx.beginPath()
    ctx.move(to: CGPoint(x: chestCenter.x - 14, y: chestCenter.y - 35))
    ctx.addLine(to: CGPoint(x: chestCenter.x, y: chestCenter.y - 12))
    ctx.addLine(to: CGPoint(x: chestCenter.x + 14, y: chestCenter.y - 35))
    ctx.closePath()
    ctx.setFillColor(shirtBlue)
    ctx.fillPath()
    // Black tie
    ctx.beginPath()
    ctx.move(to: CGPoint(x: chestCenter.x - 4, y: chestCenter.y - 25))
    ctx.addLine(to: CGPoint(x: chestCenter.x + 4, y: chestCenter.y - 25))
    ctx.addLine(to: CGPoint(x: chestCenter.x + 5, y: chestCenter.y + 8))
    ctx.addLine(to: CGPoint(x: chestCenter.x, y: chestCenter.y + 14))
    ctx.addLine(to: CGPoint(x: chestCenter.x - 5, y: chestCenter.y + 8))
    ctx.closePath()
    ctx.setFillColor(ink)
    ctx.fillPath()
    // Double-breasted gold buttons
    for (bx, by) in [(-12, -8), (12, -8), (-12, 12), (12, 12)] {
        fillEllipse(ctx, center: CGPoint(x: chestCenter.x + CGFloat(bx), y: chestCenter.y + CGFloat(by)), rx: 3.5, ry: 3.5, fill: gold, stroke: ink, lineWidth: 1.2)
    }
    ctx.restoreGState()
    
    // Arms: Hands characteristically tucked into suit pockets!
    let handL = CGPoint(x: chestCenter.x - 26, y: chestCenter.y + 28)
    let handR = (anim == "wave") ? CGPoint(x: chestCenter.x + 42, y: chestCenter.y - 42) : CGPoint(x: chestCenter.x + 26, y: chestCenter.y + 28)
    drawLimbCapsule(ctx, from: CGPoint(x: chestCenter.x - 26, y: chestCenter.y - 20), to: handL, r1: 11, r2: 8, fill: suitBlack, stroke: ink, lineWidth: 2.2)
    drawLimbCapsule(ctx, from: CGPoint(x: chestCenter.x + 26, y: chestCenter.y - 20), to: handR, r1: 11, r2: 8, fill: suitBlack, stroke: ink, lineWidth: 2.2)
    if anim == "wave" {
        fillEllipse(ctx, center: handR, rx: 8, ry: 8, fill: skin, stroke: ink, lineWidth: 2.0)
    }
    
    // Head shape
    fillEllipse(ctx, center: headCenter, rx: headR * 0.94, ry: headR * 0.88, fill: skin, stroke: ink, lineWidth: 3.0)
    
    // Blond hair background base
    fillEllipse(ctx, center: CGPoint(x: headCenter.x, y: headCenter.y - 12), rx: headR * 1.05, ry: headR * 0.96, fill: blond)
    
    // Right eye (visible)
    let eyeCenter = CGPoint(x: headCenter.x + 22, y: headCenter.y - 4)
    if isBlink {
        ctx.saveGState()
        ctx.setStrokeColor(ink)
        ctx.setLineWidth(3.0)
        ctx.beginPath()
        ctx.move(to: CGPoint(x: eyeCenter.x - 12, y: eyeCenter.y))
        ctx.addLine(to: CGPoint(x: eyeCenter.x + 12, y: eyeCenter.y))
        ctx.strokePath()
        ctx.restoreGState()
    } else {
        fillEllipse(ctx, center: eyeCenter, rx: 11, ry: 14, fill: white, stroke: ink, lineWidth: 2.2)
        fillEllipse(ctx, center: CGPoint(x: eyeCenter.x + 1, y: eyeCenter.y), rx: 7, ry: 10, fill: ink)
        fillEllipse(ctx, center: CGPoint(x: eyeCenter.x - 1, y: eyeCenter.y - 4), rx: 3.5, ry: 3.5, fill: white)
    }
    
    // Sanji's iconic curly spiral eyebrow on the right eye!
    ctx.saveGState()
    ctx.setStrokeColor(ink)
    ctx.setLineWidth(2.4)
    ctx.beginPath()
    ctx.move(to: CGPoint(x: eyeCenter.x - 12, y: eyeCenter.y - 16))
    ctx.addLine(to: CGPoint(x: eyeCenter.x + 10, y: eyeCenter.y - 16))
    // Spiral swirl at outer tip
    ctx.addArc(center: CGPoint(x: eyeCenter.x + 14, y: eyeCenter.y - 13), radius: 3.8, startAngle: -.pi/2, endAngle: .pi, clockwise: false)
    ctx.strokePath()
    ctx.restoreGState()
    
    // Suave smirk & small chin stubble
    ctx.saveGState()
    ctx.setStrokeColor(ink)
    ctx.setLineWidth(2.4)
    ctx.beginPath()
    ctx.move(to: CGPoint(x: headCenter.x + 4, y: headCenter.y + 24))
    ctx.addQuadCurve(to: CGPoint(x: headCenter.x + 24, y: headCenter.y + 20), control: CGPoint(x: headCenter.x + 14, y: headCenter.y + 25))
    ctx.strokePath()
    // Stubble dots
    for off in [-3, 0, 3] {
        fillEllipse(ctx, center: CGPoint(x: headCenter.x + CGFloat(off), y: headCenter.y + 36), rx: 1.2, ry: 1.2, fill: ink)
    }
    ctx.restoreGState()
    
    // Sanji's signature long sweeping blond fringe covering his left eye!
    ctx.saveGState()
    ctx.beginPath()
    ctx.move(to: CGPoint(x: headCenter.x + 25, y: headCenter.y - headR * 0.85))
    ctx.addCurve(to: CGPoint(x: headCenter.x - 48, y: headCenter.y + 15),
                 control1: CGPoint(x: headCenter.x, y: headCenter.y - 35),
                 control2: CGPoint(x: headCenter.x - 42, y: headCenter.y - 15))
    ctx.addQuadCurve(to: CGPoint(x: headCenter.x - 10, y: headCenter.y - 10), control: CGPoint(x: headCenter.x - 25, y: headCenter.y + 10))
    ctx.addQuadCurve(to: CGPoint(x: headCenter.x + 25, y: headCenter.y - headR * 0.85), control: CGPoint(x: headCenter.x + 8, y: headCenter.y - 35))
    ctx.closePath()
    ctx.setFillColor(blond)
    ctx.fillPath()
    ctx.setStrokeColor(ink)
    ctx.setLineWidth(2.5)
    ctx.strokePath()
    ctx.restoreGState()
}

// -----------------------------------------------------------------------------
// NAMI RENDERER
// -----------------------------------------------------------------------------
func drawNamiFrame(ctx: CGContext, anim: String, frame: Int, totalFrames: Int) {
    let t = CGFloat(frame) / CGFloat(totalFrames)
    let bounce = (anim == "walk") ? abs(sin(t * .pi * 2)) * 12.0 : sin(t * .pi * 2) * 3.0
    let isSleep = (anim == "sleep")
    let isBlink = (anim == "idle" && (frame == 8 || frame == 9)) || isSleep
    let hairSway = sin(t * .pi * 2) * 6.0
    
    let baseCenter = CGPoint(x: 256, y: 310 - bounce)
    let headCenter = CGPoint(x: baseCenter.x, y: baseCenter.y - 84 + (isSleep ? 10 : 0))
    let headR: CGFloat = 58
    
    let skin = hexColor("#ffe2cc")
    let ink = hexColor("#3c261e")
    let orange = hexColor("#f57820")
    let orangeDark = hexColor("#c4540a")
    let bikiniGreen = hexColor("#169e7e")
    let denimBlue = hexColor("#245594")
    let gold = hexColor("#f5d342")
    let sandalTan = hexColor("#c77234")
    let white = hexColor("#ffffff")
    
    // Voluminous long orange hair in background
    ctx.saveGState()
    for (ox, oy, rx, ry) in [(-42, 20, 22, 60), (-30, 45, 24, 65), (30, 45, 24, 65), (42, 20, 22, 60)] {
        fillEllipse(ctx, center: CGPoint(x: headCenter.x + CGFloat(ox) + hairSway, y: headCenter.y + CGFloat(oy)), rx: CGFloat(rx), ry: CGFloat(ry), fill: orangeDark)
    }
    ctx.restoreGState()
    
    // Legs & High-heeled Sandals
    let legWalkL = (anim == "walk") ? sin(t * .pi * 2) * 20 : 0
    let legWalkR = (anim == "walk") ? -sin(t * .pi * 2) * 20 : 0
    let footY: CGFloat = 465
    
    let hipL = CGPoint(x: baseCenter.x - 16, y: baseCenter.y + 60)
    let footL = CGPoint(x: baseCenter.x - (anim == "walk" ? 4 : 18) + legWalkL, y: footY)
    drawLimbCapsule(ctx, from: hipL, to: footL, r1: 13, r2: 10, fill: denimBlue, stroke: ink, lineWidth: 2.5)
    fillEllipse(ctx, center: CGPoint(x: footL.x, y: footL.y + 2), rx: 14, ry: 6, fill: sandalTan, stroke: ink, lineWidth: 2.0)
    
    let hipR = CGPoint(x: baseCenter.x + 16, y: baseCenter.y + 60)
    let footR = CGPoint(x: baseCenter.x + (anim == "walk" ? 4 : 18) + legWalkR, y: footY)
    drawLimbCapsule(ctx, from: hipR, to: footR, r1: 13, r2: 10, fill: denimBlue, stroke: ink, lineWidth: 2.5)
    fillEllipse(ctx, center: CGPoint(x: footR.x, y: footR.y + 2), rx: 14, ry: 6, fill: sandalTan, stroke: ink, lineWidth: 2.0)
    
    // Torso: Bikini Top & Low-rise Jeans
    let chestCenter = CGPoint(x: baseCenter.x, y: baseCenter.y + 15)
    fillEllipse(ctx, center: chestCenter, rx: 28, ry: 44, fill: skin, stroke: ink, lineWidth: 2.5)
    // Bikini top cups (green with white circles)
    fillEllipse(ctx, center: CGPoint(x: chestCenter.x - 13, y: chestCenter.y - 12), rx: 14, ry: 14, fill: bikiniGreen, stroke: ink, lineWidth: 2.0)
    fillEllipse(ctx, center: CGPoint(x: chestCenter.x - 13, y: chestCenter.y - 12), rx: 6, ry: 6, fill: white)
    fillEllipse(ctx, center: CGPoint(x: chestCenter.x + 13, y: chestCenter.y - 12), rx: 14, ry: 14, fill: bikiniGreen, stroke: ink, lineWidth: 2.0)
    fillEllipse(ctx, center: CGPoint(x: chestCenter.x + 13, y: chestCenter.y - 12), rx: 6, ry: 6, fill: white)
    // Low-rise jeans waist & belt
    fillRoundedRect(ctx, rect: CGRect(x: chestCenter.x - 26, y: chestCenter.y + 24, width: 52, height: 18), rx: 5, ry: 5, fill: denimBlue, stroke: ink, lineWidth: 2.2)
    fillRoundedRect(ctx, rect: CGRect(x: chestCenter.x - 24, y: chestCenter.y + 22, width: 48, height: 7), rx: 3, ry: 3, fill: hexColor("#6b3816"), stroke: ink, lineWidth: 1.5)
    fillEllipse(ctx, center: CGPoint(x: chestCenter.x, y: chestCenter.y + 25), rx: 5, ry: 4, fill: gold)
    
    // Arms & Log Pose bracelet
    let armSwing = (anim == "walk") ? sin(t * .pi * 2) * 20 : 0
    let handL = (anim == "wave") ? CGPoint(x: chestCenter.x - 40, y: chestCenter.y - 50) : CGPoint(x: chestCenter.x - 30 - armSwing, y: chestCenter.y + 25)
    let handR = (anim == "wave") ? CGPoint(x: chestCenter.x + 40, y: chestCenter.y - 50) : CGPoint(x: chestCenter.x + 30 + armSwing, y: chestCenter.y + 25)
    drawLimbCapsule(ctx, from: CGPoint(x: chestCenter.x - 24, y: chestCenter.y - 18), to: handL, r1: 9, r2: 7, fill: skin, stroke: ink, lineWidth: 2.0)
    fillEllipse(ctx, center: handL, rx: 8, ry: 8, fill: skin, stroke: ink, lineWidth: 1.8)
    // Golden Log Pose sphere on left wrist
    fillEllipse(ctx, center: CGPoint(x: handL.x + 4, y: handL.y - 4), rx: 7, ry: 7, fill: gold, stroke: ink, lineWidth: 1.8)
    fillEllipse(ctx, center: CGPoint(x: handL.x + 4, y: handL.y - 4), rx: 4, ry: 4, fill: hexColor("#88e8ff"))
    
    drawLimbCapsule(ctx, from: CGPoint(x: chestCenter.x + 24, y: chestCenter.y - 18), to: handR, r1: 9, r2: 7, fill: skin, stroke: ink, lineWidth: 2.0)
    fillEllipse(ctx, center: handR, rx: 8, ry: 8, fill: skin, stroke: ink, lineWidth: 1.8)
    
    // Head shape
    fillEllipse(ctx, center: headCenter, rx: headR * 0.94, ry: headR * 0.88, fill: skin, stroke: ink, lineWidth: 3.0)
    
    // Warm peach cheeks
    fillEllipse(ctx, center: CGPoint(x: headCenter.x - 28, y: headCenter.y + 12), rx: 11, ry: 6, fill: hexColor("#f58595", alpha: 0.6))
    fillEllipse(ctx, center: CGPoint(x: headCenter.x + 28, y: headCenter.y + 12), rx: 11, ry: 6, fill: hexColor("#f58595", alpha: 0.6))
    
    // Big warm brown anime eyes with double sparkles
    if isBlink {
        ctx.saveGState()
        ctx.setStrokeColor(ink)
        ctx.setLineWidth(3.0)
        ctx.beginPath()
        ctx.move(to: CGPoint(x: headCenter.x - 30, y: headCenter.y - 2))
        ctx.addQuadCurve(to: CGPoint(x: headCenter.x - 12, y: headCenter.y - 2), control: CGPoint(x: headCenter.x - 21, y: headCenter.y - 10))
        ctx.move(to: CGPoint(x: headCenter.x + 12, y: headCenter.y - 2))
        ctx.addQuadCurve(to: CGPoint(x: headCenter.x + 30, y: headCenter.y - 2), control: CGPoint(x: headCenter.x + 21, y: headCenter.y - 10))
        ctx.strokePath()
        ctx.restoreGState()
    } else {
        fillEllipse(ctx, center: CGPoint(x: headCenter.x - 21, y: headCenter.y - 4), rx: 12, ry: 16, fill: white, stroke: ink, lineWidth: 2.2)
        fillEllipse(ctx, center: CGPoint(x: headCenter.x - 20, y: headCenter.y - 4), rx: 8, ry: 12, fill: hexColor("#6b4320"))
        fillEllipse(ctx, center: CGPoint(x: headCenter.x - 22, y: headCenter.y - 8), rx: 4, ry: 4, fill: white)
        fillEllipse(ctx, center: CGPoint(x: headCenter.x - 18, y: headCenter.y), rx: 2, ry: 2, fill: white)
        
        fillEllipse(ctx, center: CGPoint(x: headCenter.x + 21, y: headCenter.y - 4), rx: 12, ry: 16, fill: white, stroke: ink, lineWidth: 2.2)
        fillEllipse(ctx, center: CGPoint(x: headCenter.x + 22, y: headCenter.y - 4), rx: 8, ry: 12, fill: hexColor("#6b4320"))
        fillEllipse(ctx, center: CGPoint(x: headCenter.x + 20, y: headCenter.y - 8), rx: 4, ry: 4, fill: white)
        fillEllipse(ctx, center: CGPoint(x: headCenter.x + 24, y: headCenter.y), rx: 2, ry: 2, fill: white)
    }
    
    // Sweet smiling lips
    ctx.saveGState()
    ctx.setStrokeColor(hexColor("#b54457"))
    ctx.setLineWidth(2.4)
    ctx.beginPath()
    ctx.move(to: CGPoint(x: headCenter.x - 12, y: headCenter.y + 24))
    ctx.addQuadCurve(to: CGPoint(x: headCenter.x + 12, y: headCenter.y + 24), control: CGPoint(x: headCenter.x, y: headCenter.y + 30))
    ctx.strokePath()
    ctx.restoreGState()
    
    // Front orange hair clumps framing face
    ctx.saveGState()
    fillEllipse(ctx, center: CGPoint(x: headCenter.x, y: headCenter.y - 44), rx: 54, ry: 24, fill: orange, stroke: ink, lineWidth: 2.5)
    for (ox, oy, rx, ry) in [(-36, -10, 16, 35), (36, -10, 16, 35), (-15, -30, 14, 25), (15, -30, 14, 25)] {
        fillEllipse(ctx, center: CGPoint(x: headCenter.x + CGFloat(ox), y: headCenter.y + CGFloat(oy)), rx: CGFloat(rx), ry: CGFloat(ry), fill: orange, stroke: ink, lineWidth: 2.2)
    }
    ctx.restoreGState()
}

// -----------------------------------------------------------------------------
// CHOPPER RENDERER (Anthropomorphic Reindeer Brain Point)
// -----------------------------------------------------------------------------
func drawChopperFrame(ctx: CGContext, anim: String, frame: Int, totalFrames: Int) {
    let t = CGFloat(frame) / CGFloat(totalFrames)
    let bounce = (anim == "walk") ? abs(sin(t * .pi * 2)) * 14.0 : sin(t * .pi * 2) * 3.5
    let isSleep = (anim == "sleep")
    let isBlink = (anim == "idle" && (frame == 8 || frame == 9)) || isSleep
    let earTwitch = sin(t * .pi * 2) * 4.0
    
    let baseCenter = CGPoint(x: 256, y: 330 - bounce)
    let headCenter = CGPoint(x: baseCenter.x, y: baseCenter.y - 90 + (isSleep ? 12 : 0))
    let headR: CGFloat = 65 // Big cute chibi head
    
    let furBrown = hexColor("#8a5229")
    let furDark = hexColor("#5c3111")
    let muzzleTan = hexColor("#eed2b8")
    let blueNose = hexColor("#1e7ec8")
    let pinkHat = hexColor("#eb5d88")
    let pinkHatDark = hexColor("#c43360")
    let antlerBrown = hexColor("#4a2a14")
    let shortsMaroon = hexColor("#9e2a44")
    let hoofBlack = hexColor("#23150c")
    let ink = hexColor("#382012")
    let white = hexColor("#ffffff")
    
    // Tail
    let tailWag = sin(t * .pi * 4) * 8.0
    fillEllipse(ctx, center: CGPoint(x: baseCenter.x - 24 + tailWag, y: baseCenter.y + 40), rx: 12, ry: 9, fill: furBrown, stroke: ink, lineWidth: 2.0)
    fillEllipse(ctx, center: CGPoint(x: baseCenter.x - 30 + tailWag, y: baseCenter.y + 40), rx: 6, ry: 6, fill: white)
    
    // Short furry legs ending in hooves
    let legWalkL = (anim == "walk") ? sin(t * .pi * 2) * 18 : 0
    let legWalkR = (anim == "walk") ? -sin(t * .pi * 2) * 18 : 0
    let footY: CGFloat = 465
    
    let hipL = CGPoint(x: baseCenter.x - 18, y: baseCenter.y + 45)
    let footL = CGPoint(x: baseCenter.x - (anim == "walk" ? 4 : 20) + legWalkL, y: footY)
    drawLimbCapsule(ctx, from: hipL, to: footL, r1: 14, r2: 12, fill: furDark, stroke: ink, lineWidth: 2.5)
    fillEllipse(ctx, center: CGPoint(x: footL.x, y: footL.y + 2), rx: 15, ry: 7, fill: hoofBlack, stroke: ink, lineWidth: 2.2)
    
    let hipR = CGPoint(x: baseCenter.x + 18, y: baseCenter.y + 45)
    let footR = CGPoint(x: baseCenter.x + (anim == "walk" ? 4 : 22) + legWalkR, y: footY)
    drawLimbCapsule(ctx, from: hipR, to: footR, r1: 14, r2: 12, fill: furBrown, stroke: ink, lineWidth: 2.5)
    fillEllipse(ctx, center: CGPoint(x: footR.x, y: footR.y + 2), rx: 15, ry: 7, fill: hoofBlack, stroke: ink, lineWidth: 2.2)
    
    // Maroon shorts
    fillRoundedRect(ctx, rect: CGRect(x: baseCenter.x - 26, y: baseCenter.y + 22, width: 52, height: 26), rx: 8, ry: 8, fill: shortsMaroon, stroke: ink, lineWidth: 2.2)
    
    // Compact furry bipedal body
    let chestCenter = CGPoint(x: baseCenter.x, y: baseCenter.y + 5)
    fillEllipse(ctx, center: chestCenter, rx: 28, ry: 36, fill: furBrown, stroke: ink, lineWidth: 2.5)
    
    // Short cute furry arms ending in hooves
    let handL = (anim == "wave" || anim == "cheer") ? CGPoint(x: chestCenter.x - 38, y: chestCenter.y - 45) : CGPoint(x: chestCenter.x - 32, y: chestCenter.y + 20)
    let handR = (anim == "wave" || anim == "cheer") ? CGPoint(x: chestCenter.x + 38, y: chestCenter.y - 45) : CGPoint(x: chestCenter.x + 32, y: chestCenter.y + 20)
    drawLimbCapsule(ctx, from: CGPoint(x: chestCenter.x - 22, y: chestCenter.y - 12), to: handL, r1: 12, r2: 10, fill: furDark, stroke: ink, lineWidth: 2.2)
    fillEllipse(ctx, center: handL, rx: 10, ry: 8, fill: hoofBlack, stroke: ink, lineWidth: 2.0)
    
    drawLimbCapsule(ctx, from: CGPoint(x: chestCenter.x + 22, y: chestCenter.y - 12), to: handR, r1: 12, r2: 10, fill: furBrown, stroke: ink, lineWidth: 2.2)
    fillEllipse(ctx, center: handR, rx: 10, ry: 8, fill: hoofBlack, stroke: ink, lineWidth: 2.0)
    
    // Branching Antlers behind hat
    ctx.saveGState()
    ctx.setStrokeColor(antlerBrown)
    ctx.setLineWidth(7.0)
    ctx.setLineCap(.round)
    // Left antler
    ctx.beginPath()
    ctx.move(to: CGPoint(x: headCenter.x - 48, y: headCenter.y - 45))
    ctx.addQuadCurve(to: CGPoint(x: headCenter.x - 85, y: headCenter.y - 110), control: CGPoint(x: headCenter.x - 80, y: headCenter.y - 70))
    ctx.move(to: CGPoint(x: headCenter.x - 70, y: headCenter.y - 75))
    ctx.addLine(to: CGPoint(x: headCenter.x - 95, y: headCenter.y - 82))
    ctx.strokePath()
    // Right antler
    ctx.beginPath()
    ctx.move(to: CGPoint(x: headCenter.x + 48, y: headCenter.y - 45))
    ctx.addQuadCurve(to: CGPoint(x: headCenter.x + 85, y: headCenter.y - 110), control: CGPoint(x: headCenter.x + 80, y: headCenter.y - 70))
    ctx.move(to: CGPoint(x: headCenter.x + 70, y: headCenter.y - 75))
    ctx.addLine(to: CGPoint(x: headCenter.x + 95, y: headCenter.y - 82))
    ctx.strokePath()
    ctx.restoreGState()
    
    // Head shape (round cute fluffy fur)
    fillEllipse(ctx, center: headCenter, rx: headR, ry: headR * 0.9, fill: furBrown, stroke: ink, lineWidth: 3.2)
    
    // Fluffy reindeer ears below hat
    fillEllipse(ctx, center: CGPoint(x: headCenter.x - 56, y: headCenter.y + earTwitch), rx: 16, ry: 10, fill: furBrown, stroke: ink, lineWidth: 2.0)
    fillEllipse(ctx, center: CGPoint(x: headCenter.x - 56, y: headCenter.y + earTwitch), rx: 10, ry: 6, fill: muzzleTan)
    fillEllipse(ctx, center: CGPoint(x: headCenter.x + 56, y: headCenter.y - earTwitch), rx: 16, ry: 10, fill: furBrown, stroke: ink, lineWidth: 2.0)
    fillEllipse(ctx, center: CGPoint(x: headCenter.x + 56, y: headCenter.y - earTwitch), rx: 10, ry: 6, fill: muzzleTan)
    
    // Cream muzzle
    fillEllipse(ctx, center: CGPoint(x: headCenter.x, y: headCenter.y + 18), rx: 34, ry: 24, fill: muzzleTan, stroke: ink, lineWidth: 2.2)
    
    // Big emotive anime deer eyes
    if isBlink {
        ctx.saveGState()
        ctx.setStrokeColor(ink)
        ctx.setLineWidth(3.5)
        ctx.beginPath()
        ctx.move(to: CGPoint(x: headCenter.x - 35, y: headCenter.y - 4))
        ctx.addQuadCurve(to: CGPoint(x: headCenter.x - 15, y: headCenter.y - 4), control: CGPoint(x: headCenter.x - 25, y: headCenter.y + 6))
        ctx.move(to: CGPoint(x: headCenter.x + 15, y: headCenter.y - 4))
        ctx.addQuadCurve(to: CGPoint(x: headCenter.x + 35, y: headCenter.y - 4), control: CGPoint(x: headCenter.x + 25, y: headCenter.y + 6))
        ctx.strokePath()
        ctx.restoreGState()
    } else {
        fillEllipse(ctx, center: CGPoint(x: headCenter.x - 25, y: headCenter.y - 6), rx: 14, ry: 18, fill: ink)
        fillEllipse(ctx, center: CGPoint(x: headCenter.x - 28, y: headCenter.y - 11), rx: 5.5, ry: 5.5, fill: white)
        fillEllipse(ctx, center: CGPoint(x: headCenter.x - 22, y: headCenter.y), rx: 2.5, ry: 2.5, fill: white)
        
        fillEllipse(ctx, center: CGPoint(x: headCenter.x + 25, y: headCenter.y - 6), rx: 14, ry: 18, fill: ink)
        fillEllipse(ctx, center: CGPoint(x: headCenter.x + 22, y: headCenter.y - 11), rx: 5.5, ry: 5.5, fill: white)
        fillEllipse(ctx, center: CGPoint(x: headCenter.x + 28, y: headCenter.y), rx: 2.5, ry: 2.5, fill: white)
    }
    
    // Signature Blue Nose!
    fillEllipse(ctx, center: CGPoint(x: headCenter.x, y: headCenter.y + 10), rx: 12, ry: 9, fill: blueNose, stroke: ink, lineWidth: 2.0)
    fillEllipse(ctx, center: CGPoint(x: headCenter.x - 3, y: headCenter.y + 8), rx: 4, ry: 2.5, fill: white)
    
    // Cute smile
    ctx.saveGState()
    ctx.setStrokeColor(ink)
    ctx.setLineWidth(2.2)
    ctx.beginPath()
    ctx.move(to: CGPoint(x: headCenter.x - 12, y: headCenter.y + 26))
    ctx.addQuadCurve(to: CGPoint(x: headCenter.x + 12, y: headCenter.y + 26), control: CGPoint(x: headCenter.x, y: headCenter.y + 32))
    ctx.strokePath()
    ctx.restoreGState()
    
    // Tall Pink Doctor Hat with Brim & Bold White Cross (X)
    let hatY = headCenter.y - 48
    // Curved hat brim
    fillEllipse(ctx, center: CGPoint(x: headCenter.x, y: hatY + 6), rx: 78, ry: 24, fill: pinkHat, stroke: ink, lineWidth: 3.0)
    // Cylindrical hat crown
    fillRoundedRect(ctx, rect: CGRect(x: headCenter.x - 48, y: hatY - 60, width: 96, height: 62), rx: 16, ry: 16, fill: pinkHat, stroke: ink, lineWidth: 3.0)
    fillEllipse(ctx, center: CGPoint(x: headCenter.x, y: hatY - 60), rx: 48, ry: 18, fill: pinkHatDark, stroke: ink, lineWidth: 2.5)
    
    // Bold White Cross (X)
    ctx.saveGState()
    ctx.setStrokeColor(white)
    ctx.setLineWidth(10.0)
    ctx.setLineCap(.round)
    let cx = headCenter.x
    let cy = hatY - 28
    ctx.beginPath()
    ctx.move(to: CGPoint(x: cx - 18, y: cy - 18))
    ctx.addLine(to: CGPoint(x: cx + 18, y: cy + 18))
    ctx.move(to: CGPoint(x: cx + 18, y: cy - 18))
    ctx.addLine(to: CGPoint(x: cx - 18, y: cy + 18))
    ctx.strokePath()
    ctx.restoreGState()
}

// -----------------------------------------------------------------------------
// MAIN BATCH GENERATOR
// -----------------------------------------------------------------------------
let characters = ["luffy", "zoro", "sanji", "nami", "chopper"]
let animConfigs: [(name: String, frames: Int)] = [
    ("idle", 16),
    ("walk", 8),
    ("wave", 6),
    ("cheer", 6),
    ("sleep", 4)
]

let fm = FileManager.default
let tmpRoot = "tmp_art"

print("🎨 Starting One Piece character artwork generator...")

for cid in characters {
    print("▶ Generating assets for \(cid)...")
    for (anim, totalFrames) in animConfigs {
        let animDir = "\(tmpRoot)/\(cid)/\(anim)"
        try? fm.createDirectory(atPath: animDir, withIntermediateDirectories: true)
        
        for f in 0..<totalFrames {
            guard let ctx = CGContext(data: nil, width: W, height: H,
                                      bitsPerComponent: 8, bytesPerRow: 0,
                                      space: CGColorSpaceCreateDeviceRGB(),
                                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
                continue
            }
            ctx.clear(CGRect(x: 0, y: 0, width: W, height: H))
            ctx.setShouldAntialias(true)

            // CGContext has y increasing UPWARD, but every draw routine below is written
            // y-DOWN (web-canvas convention - e.g. headCenter.y = baseCenter.y - 100 is
            // meant to put the head ABOVE the hips). Without this flip the whole figure
            // came out inverted, with the head detached below the torso. Flipping the
            // context once here fixes all five characters at the source, rather than
            // negating every offset in every draw function.
            ctx.translateBy(x: 0, y: CGFloat(H))
            ctx.scaleBy(x: 1, y: -1)
            
            switch cid {
            case "luffy":
                drawLuffyFrame(ctx: ctx, anim: anim, frame: f, totalFrames: totalFrames)
            case "zoro":
                drawZoroFrame(ctx: ctx, anim: anim, frame: f, totalFrames: totalFrames)
            case "sanji":
                drawSanjiFrame(ctx: ctx, anim: anim, frame: f, totalFrames: totalFrames)
            case "nami":
                drawNamiFrame(ctx: ctx, anim: anim, frame: f, totalFrames: totalFrames)
            case "chopper":
                drawChopperFrame(ctx: ctx, anim: anim, frame: f, totalFrames: totalFrames)
            default:
                break
            }
            
            guard let img = ctx.makeImage() else { continue }
            let rep = NSBitmapImageRep(cgImage: img)
            if let png = rep.representation(using: .png, properties: [:]) {
                let framePath = "\(animDir)/frame-\(String(format: "%02d", f + 1)).png"
                try? png.write(to: URL(fileURLWithPath: framePath))
            }
        }
    }
    print("  ✓ Staged all frames for \(cid)")
}

print("🎉 Frame generation complete!")

