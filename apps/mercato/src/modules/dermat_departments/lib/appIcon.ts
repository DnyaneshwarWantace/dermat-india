import { deflateSync } from 'node:zlib'

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    table[index] = value >>> 0
  }
  return table
})()

function crc32(data: Buffer): number {
  let crc = 0xffffffff
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

const BACKGROUND = [14, 107, 102]
const INK = [255, 255, 255]

function inLetter(x: number, y: number): boolean {
  if (x >= 0.28 && x <= 0.4 && y >= 0.26 && y <= 0.74) return true
  if (x < 0.4) return false
  const dx = x - 0.4
  const dy = y - 0.5
  const distance = Math.sqrt(dx * dx + dy * dy)
  return distance <= 0.24 && distance >= 0.12
}

const cache = new Map<number, Buffer>()

export function appIconPng(size: number): Buffer {
  const cached = cache.get(size)
  if (cached) return cached
  const samples = 4
  const raw = Buffer.alloc((size * 3 + 1) * size)
  for (let row = 0; row < size; row += 1) {
    raw[row * (size * 3 + 1)] = 0
    for (let col = 0; col < size; col += 1) {
      let hits = 0
      for (let sy = 0; sy < samples; sy += 1) for (let sx = 0; sx < samples; sx += 1) if (inLetter((col + (sx + 0.5) / samples) / size, (row + (sy + 0.5) / samples) / size)) hits += 1
      const share = hits / (samples * samples)
      const offset = row * (size * 3 + 1) + 1 + col * 3
      for (let channel = 0; channel < 3; channel += 1) raw[offset + channel] = Math.round(BACKGROUND[channel] * (1 - share) + INK[channel] * share)
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 2
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
  cache.set(size, png)
  return png
}
