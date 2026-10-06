import assert from "node:assert/strict"
import test from "node:test"
import {
  DEFAULT_PHOTO_ADJUSTMENTS,
  normalizePhotoAdjustments,
  photoGeometry,
  photoSharpness,
} from "../src/features/quotes/import/photoGeometry.ts"
import { imageDimensions } from "../src/features/quotes/import/imageDimensions.ts"

test("quarter turns preserve exact page dimensions without trimming", () => {
  for (const [rotation, expected] of [
    [0, [800, 1200]],
    [90, [1200, 800]],
    [180, [800, 1200]],
    [270, [1200, 800]],
  ] as const) {
    const geometry = photoGeometry(800, 1200, {
      ...DEFAULT_PHOTO_ADJUSTMENTS,
      rotation,
    })
    assert.deepEqual([geometry.width, geometry.height], expected)
    assert.equal(geometry.x, 0)
    assert.equal(geometry.y, 0)
  }
})

test("deskewing keeps every original corner inside the expanded page", () => {
  for (const rotation of [0, 90, 180, 270])
    for (const angle of [-15, -3.4, 0, 6.2, 15]) {
      const geometry = photoGeometry(800, 1200, {
        ...DEFAULT_PHOTO_ADJUSTMENTS,
        rotation,
        angle,
      })
      for (const x of [-400, 400])
        for (const y of [-600, 600]) {
          const transformedX =
            x * Math.cos(geometry.radians) -
            y * Math.sin(geometry.radians) +
            geometry.fullWidth / 2
          const transformedY =
            x * Math.sin(geometry.radians) +
            y * Math.cos(geometry.radians) +
            geometry.fullHeight / 2
          assert.ok(transformedX >= -1e-8 && transformedX <= geometry.fullWidth + 1e-8)
          assert.ok(transformedY >= -1e-8 && transformedY <= geometry.fullHeight + 1e-8)
        }
    }
})

test("only explicit crop removes page content, in the rotated coordinates", () => {
  const geometry = photoGeometry(800, 1200, {
    rotation: 90,
    angle: 0,
    crop: { left: 10, top: 5, right: 20, bottom: 15 },
  })
  assert.deepEqual(
    [geometry.x, geometry.y, geometry.width, geometry.height],
    [120, 40, 840, 640],
  )
})

test("invalid and excessive adjustment values remain bounded", () => {
  const normalized = normalizePhotoAdjustments({
    rotation: -450,
    angle: Infinity,
    crop: { left: NaN, top: -4, right: 90, bottom: 45 },
  })
  assert.deepEqual(normalized, {
    rotation: 270,
    angle: 0,
    crop: { left: 0, top: 0, right: 45, bottom: 45 },
  })
  const geometry = photoGeometry(100, 100, {
    rotation: 0,
    angle: 30,
    crop: { left: 100, right: 100, top: 100, bottom: 100 },
  })
  assert.ok(geometry.width > 0 && geometry.height > 0)
  assert.throws(() => photoGeometry(0, 100, DEFAULT_PHOTO_ADJUSTMENTS), /invalides/)
})

function raster(gray: Float64Array, width: number, height: number) {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let index = 0; index < gray.length; index++) {
    pixels[index * 4] = pixels[index * 4 + 1] = pixels[index * 4 + 2] = gray[index]
    pixels[index * 4 + 3] = 255
  }
  return pixels
}

function blur(gray: Float64Array, width: number, height: number, radius: number) {
  const horizontal = new Float64Array(gray.length)
  const output = new Float64Array(gray.length)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let sum = 0
      for (let offset = -radius; offset <= radius; offset++)
        sum += gray[y * width + Math.min(width - 1, Math.max(0, x + offset))]
      horizontal[y * width + x] = sum / (radius * 2 + 1)
    }
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let sum = 0
      for (let offset = -radius; offset <= radius; offset++)
        sum += horizontal[Math.min(height - 1, Math.max(0, y + offset)) * width + x]
      output[y * width + x] = sum / (radius * 2 + 1)
    }
  return output
}

test("measured sharpness distinguishes crisp document edges from heavily defocused edges", () => {
  const width = 320,
    height = 200
  const gray = new Float64Array(width * height).fill(255)
  for (let y = 25; y < 170; y++)
    for (let x = 20; x < 290; x++) {
      if (y % 30 < 9 && x % 35 < 25) gray[y * width + x] = 20
    }
  const sharp = photoSharpness(raster(gray, width, height), width, height)
  const defocused = photoSharpness(
    raster(blur(blur(gray, width, height, 7), width, height, 7), width, height),
    width,
    height,
  )
  assert.equal(sharp.warning, null)
  assert.equal(defocused.warning, "blurred")
  assert.ok(sharp.variance > defocused.variance * 10)
})

test("blank paper is classified as low detail rather than a confident blur diagnosis", () => {
  const width = 100,
    height = 100
  assert.equal(
    photoSharpness(
      raster(new Float64Array(width * height).fill(250), width, height),
      width,
      height,
    ).warning,
    "low-detail",
  )
  assert.throws(() => photoSharpness(new Uint8ClampedArray(0), 100, 100), /invalide/)
})

test("image header checks reject disguised or incomplete images before native decoding", () => {
  assert.equal(imageDimensions(new TextEncoder().encode("not an image")), null)
  const png = new Uint8Array(24)
  png.set([0x89, 0x50, 0x4e, 0x47], 0)
  png.set([0x49, 0x48, 0x44, 0x52], 12)
  new DataView(png.buffer).setUint32(16, 800)
  new DataView(png.buffer).setUint32(20, 1200)
  assert.deepEqual(imageDimensions(png), {
    width: 800,
    height: 1200,
    mime: "image/png",
  })
  assert.equal(imageDimensions(png.slice(0, 20)), null)
  assert.equal(
    imageDimensions(new Uint8Array([0xff, 0xd8, ...new Array(30).fill(0xff)])),
    null,
  )
})
