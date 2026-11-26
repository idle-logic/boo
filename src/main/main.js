// Haunt: Boo, a pixel ghost that lives on your screen and keeps an eye on Kiro.
//
// One see-through window covers the main display. Clicks pass through it,
// except on Boo. A small local server takes events from Kiro hooks, the CLI
// and the MCP server, and Boo acts on them.

import { app, BrowserWindow, dialog, ipcMain, screen, Tray, Menu, nativeImage } from 'electron'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { startEventServer, EVENT_PORT } from './events.js'
import { Hands } from './hands.js'
import { Migration } from './migrate.js'
import { Ambient } from './ambient.js'
import { loadEnv } from './model.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
loadEnv(root)

let overlay = null
let tray = null
let watcher = null
let paused = false

if (!app.requestSingleInstanceLock()) app.quit()

function primaryGeometry() {
  const display = screen.getPrimaryDisplay()
  const { bounds, workArea, scaleFactor } = display
  return {
    bounds,
    scaleFactor,
    // Where Boo may go, in overlay coordinates. The floor sits on the taskbar.
    world: { x: 0, y: 0, w: workArea.width, h: workArea.y + workArea.height - bounds.y },
  }
}

function createOverlay() {
  const { bounds } = primaryGeometry()
  overlay = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    alwaysOnTop: true,
    title: 'Haunt',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(here, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  })
  overlay.setAlwaysOnTop(true, 'screen-saver')
  overlay.setVisibleOnAllWorkspaces(true)
  overlay.setIgnoreMouseEvents(true, { forward: true })
  overlay.loadFile(join(root, 'src', 'renderer', 'index.html'))
  overlay.webContents.on('did-finish-load', () => sendGeometry())
  if (process.env.HAUNT_DEBUG) {
    overlay.webContents.on('console-message', e => console.log(`[boo] ${e.message}`))
  }
}

function sendGeometry() {
  const { world } = primaryGeometry()
  overlay?.webContents.send('geometry', world)
}

/** Watch the other windows on screen and pass their positions to Boo as ledges. */
function startWindowWatcher() {
  if (process.platform !== 'win32') return // Elsewhere Boo walks on the floor only.
  watcher = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(here, 'windows.ps1')], {
    windowsHide: true,
  })
  createInterface({ input: watcher.stdout }).on('line', line => {
    let list
    try {
      list = JSON.parse(line)
    } catch {
      return
    }
    const { bounds, scaleFactor } = primaryGeometry()
    const windows = list
      .filter(([, , , , pid]) => pid !== process.pid)
      .map(([x, y, w, h]) => ({
        x: x / scaleFactor - bounds.x,
        y: y / scaleFactor - bounds.y,
        w: w / scaleFactor,
        h: h / scaleFactor,
      }))
    overlay?.webContents.send('windows', windows)
  })
  watcher.on('exit', () => {
    watcher = null
  })
}

function sendCursor() {
  if (!overlay) return
  const p = screen.getCursorScreenPoint()
  const { bounds } = primaryGeometry()
  overlay.webContents.send('cursor', { x: p.x - bounds.x, y: p.y - bounds.y })
}

function haunt(event) {
  if (!paused) overlay?.webContents.send('haunt-event', event)
}

function buildTray() {
  tray = new Tray(nativeImage.createFromPath(join(root, 'assets', 'tray.png')))
  tray.setToolTip('Haunt')
  const menu = () =>
    Menu.buildFromTemplate([
      migration.active
        ? { label: 'Stop moving clients', click: () => { migration.stop(); refreshTray() } }
        : { label: 'Move clients into my software…', click: () => chooseExport() },
      {
        label: 'Tell me what is going on in my apps',
        type: 'checkbox',
        checked: ambient.on,
        click: () => {
          if (ambient.on) ambient.stop()
          else ambient.start()
          refreshTray()
        },
      },
      { type: 'separator' },
      { label: tucked ? 'Bring Boo back' : 'Tuck Boo away', click: () => toggleTuck() },
      {
        label: 'Try Boo out',
        submenu: [
          { label: 'Say hi', click: () => haunt({ type: 'say', text: 'Hi! I am Boo.' }) },
          { label: 'Kiro needs you', click: () => haunt({ type: 'needs-you', text: 'approve a command' }) },
          { label: 'Kiro finished', click: () => haunt({ type: 'done', text: 'all tasks complete' }) },
          { label: 'Tests failed', click: () => haunt({ type: 'fail', text: '3 tests failed' }) },
        ],
      },
      { type: 'separator' },
      {
        label: paused ? 'Show Boo' : 'Hide Boo',
        click: () => {
          paused = !paused
          if (paused) overlay?.hide()
          else overlay?.showInactive()
          refreshTray()
        },
      },
      { label: 'Quit Haunt', click: () => app.quit() },
    ])
  refreshTray = () => tray.setContextMenu(menu())
  refreshTray()
}

let refreshTray = () => {}
let tucked = false

function toggleTuck() {
  tucked = !tucked
  overlay?.webContents.send('haunt-event', { type: tucked ? 'tuck' : 'untuck' })
  refreshTray()
}

async function chooseExport() {
  const pick = await dialog.showOpenDialog({
    title: 'Pick the export from your old software',
    filters: [{ name: 'Spreadsheet (CSV)', extensions: ['csv'] }],
    properties: ['openFile'],
  })
  if (pick.canceled || !pick.filePaths[0]) return
  tucked = false
  migration.begin(pick.filePaths[0])
  refreshTray()
}

/** Screen pixels from the hands to overlay coordinates for Boo. */
function toOverlay(rect) {
  const { bounds, scaleFactor } = primaryGeometry()
  return {
    x: rect.x / scaleFactor - bounds.x,
    y: rect.y / scaleFactor - bounds.y,
    w: rect.w / scaleFactor,
    h: rect.h / scaleFactor,
  }
}

const hands = new Hands()
const migration = new Migration({ hands, haunt: e => overlay?.webContents.send('haunt-event', e), toOverlay })
const ambient = new Ambient({ hands, haunt: e => haunt(e), busy: () => migration.active })

app.whenReady().then(() => {
  createOverlay()
  startWindowWatcher()
  buildTray()
  setInterval(sendCursor, 120)

  // For demos and testing: start a migration straight away, optionally on autopilot.
  const migrateArg = process.argv.find(a => a.startsWith('--migrate='))
  if (migrateArg) {
    migration.autopilot = process.argv.includes('--autopilot')
    setTimeout(() => {
      const targetArg = process.argv.find(a => a.startsWith('--target='))
      migration.begin(migrateArg.slice('--migrate='.length), { target: targetArg ? targetArg.slice('--target='.length) : '' })
      refreshTray()
    }, 2500)
  }

  startEventServer(haunt).then(
    () => console.log(`Haunt is listening for Kiro on http://127.0.0.1:${EVENT_PORT}`),
    err => console.error('Haunt event server failed', err),
  )

  ipcMain.on('boo-clicked', async () => {
    if (tucked) {
      tucked = false
      refreshTray()
    }
    if (migration.active) {
      await migration.clicked()
      refreshTray()
    }
  })

  ipcMain.on('set-interactive', (_e, interactive) => {
    if (!overlay) return
    if (interactive) overlay.setIgnoreMouseEvents(false)
    else overlay.setIgnoreMouseEvents(true, { forward: true })
  })

  screen.on('display-metrics-changed', () => {
    const { bounds } = primaryGeometry()
    overlay?.setBounds(bounds)
    sendGeometry()
  })

  // Optional: save a picture of the screen after a few seconds, for checking the build.
  const shotArg = process.argv.find(a => a.startsWith('--capture='))
  if (shotArg) {
    const [path, delay] = shotArg.slice('--capture='.length).split('@')
    setTimeout(async () => {
      const image = await overlay.webContents.capturePage()
      const { writeFileSync } = await import('node:fs')
      writeFileSync(path, image.toPNG())
      console.log(`captured ${path}`)
      if (process.argv.includes('--quit-after-capture')) app.quit()
    }, Number(delay ?? 4000))
  }
})

app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => {
  watcher?.kill()
  hands.stop()
})
