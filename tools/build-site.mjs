// Builds the browser demo into site/ for Netlify.
import { cpSync, mkdirSync, rmSync, copyFileSync } from 'node:fs'

rmSync('site', { recursive: true, force: true })
mkdirSync('site/fonts', { recursive: true })
cpSync('web', 'site', { recursive: true })
mkdirSync('site/lib', { recursive: true })
copyFileSync('src/renderer/sprites.js', 'site/lib/sprites.js') // Boo's pixel art, shared with the desktop app
for (const w of [400, 500, 600, 700]) {
  copyFileSync(`node_modules/@fontsource/dm-sans/files/dm-sans-latin-${w}-normal.woff2`, `site/fonts/dm-sans-latin-${w}-normal.woff2`)
}
console.log('Built the browser demo into site/')
