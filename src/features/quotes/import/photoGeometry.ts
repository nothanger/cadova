/** Percentages removed from the edges of the rotated, fully visible image. */
export type PhotoCrop = { left: number; top: number; right: number; bottom: number }
export type PhotoAdjustments = { rotation: number; angle: number; crop: PhotoCrop }

export const DEFAULT_PHOTO_ADJUSTMENTS: PhotoAdjustments = {
  rotation: 0,
  angle: 0,
  crop: { left: 0, top: 0, right: 0, bottom: 0 },
}

export function normalizePhotoAdjustments(value: PhotoAdjustments): PhotoAdjustments {
  const finite = (number: number) => (Number.isFinite(number) ? number : 0)
  const edge = (number: number) => Math.min(45, Math.max(0, finite(number)))
  return {
    rotation: (((Math.round(finite(value.rotation) / 90) * 90) % 360) + 360) % 360,
    angle: Math.min(15, Math.max(-15, finite(value.angle))),
    crop: {
      left: edge(value.crop.left),
      top: edge(value.crop.top),
      right: edge(value.crop.right),
      bottom: edge(value.crop.bottom),
    },
  }
}

export function photoGeometry(width: number, height: number, value: PhotoAdjustments) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    throw new Error("Les dimensions de la photo sont invalides.")
  const adjustments = normalizePhotoAdjustments(value)
  const radians = ((adjustments.rotation + adjustments.angle) * Math.PI) / 180
  const cosine = Math.abs(Math.cos(radians))
  const sine = Math.abs(Math.sin(radians))
  // Round floating-point noise at quarter turns, while keeping every corner.
  const fullWidth = Math.ceil(width * cosine + height * sine - 1e-8)
  const fullHeight = Math.ceil(width * sine + height * cosine - 1e-8)
  const { crop } = adjustments
  return {
    radians,
    fullWidth,
    fullHeight,
    x: (fullWidth * crop.left) / 100,
    y: (fullHeight * crop.top) / 100,
    width: fullWidth * (1 - (crop.left + crop.right) / 100),
    height: fullHeight * (1 - (crop.top + crop.bottom) / 100),
  }
}

/** A conservative signal, never proof that a document is readable. */
export function photoSharpness(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
) {
  if (width < 3 || height < 3 || pixels.length !== width * height * 4)
    throw new Error("L’aperçu de la photo est invalide.")
  const luminance = new Float32Array(width * height)
  let sum = 0
  let squareSum = 0
  for (let index = 0; index < luminance.length; index++) {
    const offset = index * 4
    const gray =
      pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114
    luminance[index] = gray
    sum += gray
    squareSum += gray * gray
  }
  let laplacianSum = 0
  let laplacianSquareSum = 0
  let count = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = y * width + x
      const laplacian =
        luminance[index - width] +
        luminance[index + width] +
        luminance[index - 1] +
        luminance[index + 1] -
        4 * luminance[index]
      laplacianSum += laplacian
      laplacianSquareSum += laplacian * laplacian
      count++
    }
  }
  const variance = Math.max(0, laplacianSquareSum / count - (laplacianSum / count) ** 2)
  const contrast = Math.sqrt(
    Math.max(0, squareSum / luminance.length - (sum / luminance.length) ** 2),
  )
  return {
    variance,
    contrast,
    // Smooth lighting and blank paper should not be described as blurred text.
    warning: contrast < 8 ? "low-detail" : variance < 24 ? "blurred" : null,
  } as const
}
