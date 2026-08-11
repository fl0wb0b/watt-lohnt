import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

mkdirSync('public', { recursive: true })

const svg = 'scripts/icon-source.svg'

await sharp(svg).resize(192, 192).png().toFile('public/pwa-192x192.png')
await sharp(svg).resize(512, 512).png().toFile('public/pwa-512x512.png')
await sharp(svg).resize(180, 180).png().toFile('public/apple-touch-icon.png')
await sharp(svg).resize(32, 32).png().toFile('public/favicon-32.png')

console.log('icons generated')
