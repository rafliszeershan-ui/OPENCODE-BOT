const zlib = require('zlib')

function crc32(buf) {
  let c = 0xffffffff
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let v = n
    for (let k = 0; k < 8; k++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1
    table[n] = v
  }
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const t = Buffer.from(type, 'ascii')
  const crcData = Buffer.concat([t, data])
  const c = Buffer.alloc(4)
  c.writeUInt32BE(crc32(crcData))
  return Buffer.concat([len, t, data, c])
}

const PALETTES = [
  { skin: [180, 170, 160], eyes: [255, 0, 0], mouth: [80, 0, 0], cloth: [30, 30, 40] },
  { skin: [140, 200, 180], eyes: [0, 255, 100], mouth: [0, 60, 0], cloth: [10, 10, 20] },
  { skin: [100, 100, 120], eyes: [255, 50, 50], mouth: [60, 0, 0], cloth: [20, 20, 20] },
  { skin: [200, 180, 150], eyes: [255, 200, 0], mouth: [100, 0, 50], cloth: [40, 0, 40] },
  { skin: [60, 80, 90], eyes: [200, 0, 200], mouth: [40, 0, 40], cloth: [5, 5, 15] },
]

function setPixel(raw, x, y, w, h, r, g, b, a) {
  if (x < 0 || x >= w || y < 0 || y >= h) return
  const i = y * (w * 4 + 1) + 1 + x * 4
  raw[i] = r
  raw[i + 1] = g
  raw[i + 2] = b
  raw[i + 3] = a
}

function fillRect(raw, x, y, w, h, sw, sh, r, g, b, a) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      setPixel(raw, x + dx, y + dy, sw, sh, r, g, b, a)
}

function generateSkin(index) {
  const W = 64, H = 64
  const raw = Buffer.alloc((W * 4 + 1) * H)

  for (let y = 0; y < H; y++) raw[y * (W * 4 + 1)] = 0

  const pal = PALETTES[index % PALETTES.length]

  fillRect(raw, 8, 8, 8, 8, W, H, pal.skin[0], pal.skin[1], pal.skin[2], 255)
  fillRect(raw, 12, 12, 2, 2, W, H, pal.eyes[0], pal.eyes[1], pal.eyes[2], 255)
  fillRect(raw, 18, 12, 2, 2, W, H, pal.eyes[0], pal.eyes[1], pal.eyes[2], 255)
  fillRect(raw, 13, 10, 6, 1, W, H, pal.skin[0] / 2 | 0, pal.skin[1] / 2 | 0, pal.skin[2] / 2 | 0, 255)
  fillRect(raw, 14, 14, 4, 1, W, H, pal.mouth[0], pal.mouth[1], pal.mouth[2], 255)

  fillRect(raw, 20, 20, 8, 12, W, H, pal.cloth[0], pal.cloth[1], pal.cloth[2], 255)
  fillRect(raw, 40, 20, 4, 12, W, H, pal.cloth[0], pal.cloth[1], pal.cloth[2], 255)
  fillRect(raw, 44, 20, 4, 12, W, H, pal.cloth[0] * 0.7 | 0, pal.cloth[1] * 0.7 | 0, pal.cloth[2] * 0.7 | 0, 255)
  fillRect(raw, 0, 20, 4, 12, W, H, pal.cloth[0], pal.cloth[1], pal.cloth[2], 255)
  fillRect(raw, 4, 20, 4, 12, W, H, pal.cloth[0] * 0.7 | 0, pal.cloth[1] * 0.7 | 0, pal.cloth[2] * 0.7 | 0, 255)

  fillRect(raw, 24, 0, 16, 8, W, H, pal.cloth[0], pal.cloth[1], pal.cloth[2], 255)

  fillRect(raw, 12, 8, 2, 6, W, H, 0, 0, 0, 100)
  fillRect(raw, 18, 8, 2, 6, W, H, 0, 0, 0, 100)

  fillRect(raw, 48, 0, 16, 16, W, H, pal.cloth[0], pal.cloth[1], pal.cloth[2], 255)
  fillRect(raw, 56, 8, 2, 2, W, H, pal.eyes[0], pal.eyes[1], pal.eyes[2], 255)

  return toPNG(raw, W, H)
}

function toPNG(raw, w, h) {
  const compressed = zlib.deflateSync(raw)
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const cache = new Map()

function getSkin(index) {
  const key = index % PALETTES.length
  if (!cache.has(key)) cache.set(key, generateSkin(index))
  return cache.get(key)
}

module.exports = { getSkin }
