// Writes assets/tray.png (32x32) and assets/icon.png (256x256) from Boo's idle pose.
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { pose } from '../src/renderer/sprites.js'

function crc32(buf) {
  let crc = 0xffffffff
  for (const b of buf) {
    let c = (crc ^ b) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(name, scale) {
  const { grid, palette } = pose(name)
  const W = grid[0].length * scale
  const H = grid.length * scale
  const raw = Buffer.alloc((W * 4 + 1) * H)
  const hex = h => [1, 3, 5].map(o => parseInt(h.slice(o, o + 2), 16))
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const key = grid[Math.floor(y / scale)][Math.floor(x / scale)]
      const i = y * (W * 4 + 1) + 1 + x * 4
      if (!key) continue
      const [r, g, b] = hex(palette[key])
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = 255
    }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ])
}
mkdirSync('assets', { recursive: true })
writeFileSync('assets/tray.png', png('idleA', 2))
writeFileSync('assets/icon.png', png('idleA', 16))
console.log('wrote assets/tray.png and assets/icon.png')
