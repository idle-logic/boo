// Builds the browser demo into site/ for Netlify.
// The demo reuses the desktop app's own modules, so Boo behaves the same.
import { cpSync, mkdirSync, rmSync, copyFileSync } from 'node:fs'

rmSync('site', { recursive: true, force: true })
mkdirSync('site/lib', { recursive: true })
mkdirSync('site/fonts', { recursive: true })
cpSync('web', 'site', { recursive: true })
for (const f of ['sprites.js', 'world.js', 'brain.js']) copyFileSync(`src/renderer/${f}`, `site/lib/${f}`)
copyFileSync('src/main/mapping.js', 'site/lib/mapping.js')
copyFileSync('assets/icon.png', 'site/icon.png')
copyFileSync(
  'node_modules/@fontsource/pixelify-sans/files/pixelify-sans-latin-500-normal.woff2',
  'site/fonts/pixelify-sans-latin-500-normal.woff2',
)
console.log('Built the browser demo into site/')
