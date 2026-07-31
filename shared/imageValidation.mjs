export const imageLimits = Object.freeze({ maxDimension: 8192, maxPixels: 32_000_000 });

function jpegDimensions(buffer) {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > buffer.length) return null;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return null;
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7)
      || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return { width: buffer.readUInt16BE(offset + 5), height: buffer.readUInt16BE(offset + 3) };
    }
    offset += length;
  }
  return null;
}

function webpDimensions(buffer) {
  const kind = buffer.toString('ascii', 12, 16);
  if (kind === 'VP8X' && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }
  if (kind === 'VP8 ' && buffer.length >= 30 && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  if (kind === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f) {
    const bits = buffer.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  return null;
}

export function inspectImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) return null;
  let mime = null;
  let dimensions = null;
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && buffer.toString('ascii', 12, 16) === 'IHDR') {
    mime = 'image/png';
    dimensions = { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  } else if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    mime = 'image/jpeg';
    dimensions = jpegDimensions(buffer);
  } else if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    mime = 'image/webp';
    dimensions = webpDimensions(buffer);
  }
  if (!mime || !dimensions || dimensions.width < 1 || dimensions.height < 1) return null;
  return { mime, ...dimensions };
}

export function validateImageBuffer(buffer, declaredMime, limits = imageLimits) {
  const inspected = inspectImage(buffer);
  if (!inspected) return { ok: false, error: 'invalid_image_content' };
  if (inspected.mime !== declaredMime) return { ok: false, error: 'image_type_mismatch' };
  if (inspected.width > limits.maxDimension || inspected.height > limits.maxDimension
    || inspected.width * inspected.height > limits.maxPixels) {
    return { ok: false, error: 'image_dimensions_too_large' };
  }
  return { ok: true, ...inspected };
}
