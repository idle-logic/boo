// Renders every pose to one PNG sheet so the pixel art can be checked by eye.
//   node tools/preview-sprites.mjs out.png [scale]
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { POSES, pose, SIZE } from '../src/renderer/sprites.js'


const out = process.argv[2] ?? 'sprites.png'
const scale = Number(process.argv[3] ?? 8)
const names = Object.keys(POSES)
const cols = 5
const pad = 4
const cell = SIZE * scale + pad * 2
const W = cols * cell
const H = Math.ceil(names.length / cols) * cell
const px = Buffer.alloc(W * H * 4)

// Checker background so transparency is visible.
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4
    const v = ((x >> 3) + (y >> 3)) % 2 ? 60 : 72
    px[i] = v; px[i + 1] = v; px[i + 2] = v + 10; px[i + 3] = 255
  }

const hex = h => [1, 3, 5].map(o => parseInt(h.slice(o, o + 2), 16))
names.forEach((name, n) => {
  const { grid, palette } = pose(name)
  const ox = (n % cols) * cell + pad
  const oy = Math.floor(n / cols) * cell + pad
  grid.forEach((row, gy) =>
    row.forEach((key, gx) => {
      if (!key) return
      const [r, g, b] = hex(palette[key])
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) {
          const i = ((oy + gy * scale + dy) * W + ox + gx * scale + dx) * 4
          px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255
        }
    }),
  )
})

function crc32(buf) {
  let c, crc = 0xffffffff
  for (const b of buf) {
    c = (crc ^ b) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
const raw = Buffer.alloc((W * 4 + 1) * H)
for (let y = 0; y < H; y++) px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4)
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6
writeFileSync(out, Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]))
console.log(`wrote ${out}: ${names.join(', ')}`)
