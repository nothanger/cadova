export const MAX_QUOTE_IMAGE_PIXELS = 32_000_000

export function imageDimensions(
  data: Uint8Array,
): { width: number; height: number; mime: string } | null {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  if (
    data.length >= 24 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47 &&
    data[12] === 0x49 &&
    data[13] === 0x48 &&
    data[14] === 0x44 &&
    data[15] === 0x52
  ) {
    return { width: view.getUint32(16), height: view.getUint32(20), mime: "image/png" }
  }
  if (data.length >= 12 && data[0] === 0xff && data[1] === 0xd8) {
    for (let offset = 2; offset + 8 < data.length;) {
      if (data[offset] !== 0xff) return null
      while (data[offset] === 0xff) offset++
      const marker = data[offset++]
      if (marker === 0xd9 || marker === 0xda) break
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
      if (offset + 2 > data.length) return null
      const length = view.getUint16(offset)
      if (length < 2 || offset + length > data.length) return null
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
        ].includes(marker)
      ) {
        if (length < 8) return null
        return {
          width: view.getUint16(offset + 5),
          height: view.getUint16(offset + 3),
          mime: "image/jpeg",
        }
      }
      offset += length
    }
  }
  if (
    data.length >= 30 &&
    String.fromCharCode(...data.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...data.slice(8, 12)) === "WEBP"
  ) {
    const format = String.fromCharCode(...data.slice(12, 16))
    if (format === "VP8X")
      return {
        width: 1 + data[24] + (data[25] << 8) + (data[26] << 16),
        height: 1 + data[27] + (data[28] << 8) + (data[29] << 16),
        mime: "image/webp",
      }
    if (
      format === "VP8 " &&
      data[23] === 0x9d &&
      data[24] === 0x01 &&
      data[25] === 0x2a
    )
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
        mime: "image/webp",
      }
    if (format === "VP8L" && data[20] === 0x2f)
      return {
        width: 1 + data[21] + ((data[22] & 0x3f) << 8),
        height:
          1 + ((data[22] & 0xc0) >> 6) + (data[23] << 2) + ((data[24] & 0x0f) << 10),
        mime: "image/webp",
      }
  }
  return null
}
