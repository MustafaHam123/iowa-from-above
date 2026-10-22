// macOS build-time asset generator. Uses Apple's Core Image, no QR service.
// swift scripts/generateCompanionQR.swift <places.json> <output-directory> [icon-source icon-output]
import Foundation
import CoreImage
import ImageIO
import UniformTypeIdentifiers
import CoreGraphics

let args = CommandLine.arguments
let catalog = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: args[1]))) as! [[String: Any]]
let output = URL(fileURLWithPath: args[2], isDirectory: true)
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
let context = CIContext()
func writePNG(_ image: CGImage, _ url: URL) throws {
    guard let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else { throw CocoaError(.fileWriteUnknown) }
    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else { throw CocoaError(.fileWriteUnknown) }
}
for place in catalog {
    let id = place["id"] as! String
    let filter = CIFilter(name: "CIQRCodeGenerator")!
    filter.setValue(Data("fromabove://place/\(id)".utf8), forKey: "inputMessage")
    filter.setValue("M", forKey: "inputCorrectionLevel")
    let code = filter.outputImage!.transformed(by: CGAffineTransform(scaleX: 10, y: 10))
    let quietZone: CGFloat = 40
    let shifted = code.transformed(by: CGAffineTransform(translationX: quietZone, y: quietZone))
    let canvas = CGRect(x: 0, y: 0, width: code.extent.width + quietZone * 2, height: code.extent.height + quietZone * 2)
    let composited = shifted.composited(over: CIImage(color: .white).cropped(to: canvas))
    let cg = context.createCGImage(composited, from: canvas)!
    try writePNG(cg, output.appendingPathComponent("\(id).png"))
}
if args.count > 4 {
    let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: args[3]) as CFURL, nil)!
    let original = CGImageSourceCreateImageAtIndex(source, 0, nil)!
    let canvas = CGContext(data: nil, width: 1024, height: 1024, bitsPerComponent: 8, bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    canvas.setFillColor(CGColor(red: 0.08, green: 0.09, blue: 0.10, alpha: 1))
    canvas.fill(CGRect(x: 0, y: 0, width: 1024, height: 1024))
    canvas.interpolationQuality = .high
    canvas.draw(original, in: CGRect(x: 0, y: 0, width: 1024, height: 1024))
    try writePNG(canvas.makeImage()!, URL(fileURLWithPath: args[4]))
}
print("Generated \(catalog.count) place codes using Core Image.")
