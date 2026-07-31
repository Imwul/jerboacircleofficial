import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectImage, validateImageBuffer } from '../shared/imageValidation.mjs';

function png(width, height) {
  const buffer = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer, 0);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

test('image inspection uses file signatures and dimensions', () => {
  assert.deepEqual(inspectImage(png(1200, 800)), { mime: 'image/png', width: 1200, height: 800 });
  assert.equal(inspectImage(Buffer.from('<svg onload=alert(1)>')), null);
});

test('image validation rejects declared type mismatches and decompression dimensions', () => {
  assert.deepEqual(validateImageBuffer(png(1200, 800), 'image/jpeg'), { ok: false, error: 'image_type_mismatch' });
  assert.deepEqual(validateImageBuffer(png(9000, 2), 'image/png'), { ok: false, error: 'image_dimensions_too_large' });
  assert.deepEqual(validateImageBuffer(png(8000, 8000), 'image/png'), { ok: false, error: 'image_dimensions_too_large' });
  assert.equal(validateImageBuffer(png(1200, 800), 'image/png').ok, true);
});
