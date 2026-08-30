import path from "node:path";
import sharp from "sharp";

const [inputPath, outputDirectory] = process.argv.slice(2);

if (!inputPath || !outputDirectory) {
  throw new Error(
    "Usage: node scripts/generate-skybox.mjs <equirectangular-image> <output-directory>",
  );
}

const FACE_SIZE = 768;
const faces = {
  positiveX: (u, v) => [1, -v, -u],
  negativeX: (u, v) => [-1, -v, u],
  positiveY: (u, v) => [u, 1, v],
  negativeY: (u, v) => [u, -1, -v],
  positiveZ: (u, v) => [u, -v, 1],
  negativeZ: (u, v) => [-u, -v, -1],
};

const { data, info } = await sharp(inputPath)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

function samplePanorama(longitude, latitude, channel) {
  const sourceX =
    ((longitude / (Math.PI * 2) + 0.5) * info.width + info.width) %
    info.width;
  const sourceY = Math.min(
    info.height - 1,
    Math.max(0, (0.5 - latitude / Math.PI) * info.height),
  );
  const x0 = Math.floor(sourceX);
  const y0 = Math.floor(sourceY);
  const x1 = (x0 + 1) % info.width;
  const y1 = Math.min(y0 + 1, info.height - 1);
  const xMix = sourceX - x0;
  const yMix = sourceY - y0;
  const topLeft = data[(y0 * info.width + x0) * info.channels + channel];
  const topRight = data[(y0 * info.width + x1) * info.channels + channel];
  const bottomLeft = data[(y1 * info.width + x0) * info.channels + channel];
  const bottomRight = data[(y1 * info.width + x1) * info.channels + channel];
  const top = topLeft + (topRight - topLeft) * xMix;
  const bottom = bottomLeft + (bottomRight - bottomLeft) * xMix;

  return Math.round(top + (bottom - top) * yMix);
}

for (const [name, directionForPixel] of Object.entries(faces)) {
  const output = Buffer.alloc(FACE_SIZE * FACE_SIZE * 3);

  for (let y = 0; y < FACE_SIZE; y += 1) {
    const v = ((y + 0.5) / FACE_SIZE) * 2 - 1;

    for (let x = 0; x < FACE_SIZE; x += 1) {
      const u = ((x + 0.5) / FACE_SIZE) * 2 - 1;
      const [directionX, directionY, directionZ] = directionForPixel(u, v);
      const length = Math.hypot(directionX, directionY, directionZ);
      const longitude = Math.atan2(directionZ, directionX);
      const latitude = Math.asin(directionY / length);
      const outputOffset = (y * FACE_SIZE + x) * 3;

      for (let channel = 0; channel < 3; channel += 1) {
        output[outputOffset + channel] = samplePanorama(
          longitude,
          latitude,
          channel,
        );
      }
    }
  }

  await sharp(output, {
    raw: { width: FACE_SIZE, height: FACE_SIZE, channels: 3 },
  })
    .jpeg({ quality: 91, chromaSubsampling: "4:4:4" })
    .toFile(path.join(outputDirectory, `${name}.jpg`));
}
