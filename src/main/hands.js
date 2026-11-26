// Node side of Boo's hands: talks to hands.ps1, one JSON line per command.
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

export class Hands {
  constructor() {
    this.proc = null
    this.waiting = new Map()
    this.nextId = 1
  }

  start() {
    if (this.proc || process.platform !== 'win32') return
    this.proc = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(here, 'hands.ps1')], {
      windowsHide: true,
      env: { ...process.env, HAUNT_PID: String(process.pid) },
    })
    createInterface({ input: this.proc.stdout }).on('line', line => {
      let msg
      try {
        msg = JSON.parse(line)
      } catch {
        return
      }
      const done = this.waiting.get(msg.id)
      if (done) {
        this.waiting.delete(msg.id)
        done(msg)
      }
    })
    this.proc.on('exit', () => {
      this.proc = null
      for (const done of this.waiting.values()) done({ ok: false, error: 'hands stopped' })
      this.waiting.clear()
    })
  }

  ask(msg, timeoutMs = 20000) {
    if (process.platform !== 'win32') return Promise.resolve({ ok: false, error: 'Form filling needs Windows for now.' })
    this.start()
    const id = this.nextId++
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        this.waiting.delete(id)
        resolve({ ok: false, error: 'timed out' })
      }, timeoutMs)
      this.waiting.set(id, res => {
        clearTimeout(timer)
        resolve(res)
      })
      this.proc.stdin.write(JSON.stringify({ ...msg, id }) + '\n')
    })
  }

  /** Form fields in the window with that title, or the foreground window. */
  scan(title = '') {
    return this.ask({ cmd: 'scan', title })
  }

  fill(index, value) {
    return this.ask({ cmd: 'fill', index, value: String(value) })
  }

  press(index) {
    return this.ask({ cmd: 'press', index })
  }

  stop() {
    this.proc?.kill()
  }
}
