// Boo's hands on a real desktop: the universal connector. Reads and operates
// any app through Windows UI Automation, with the same contract as the browser
// demo's adapter:
//   observe() -> elements on screen
//   act(action) -> what happened
//
// Safety: Boo only works in the window it started in, never types into
// password fields, and in a browser only on sites you allowed.

const ROLES = {
  button: 'button', link: 'button', menuitem: 'button', checkbox: 'button', radio: 'button',
  tab: 'tab', textbox: 'textbox', select: 'select', password: 'password',
  item: 'text', cell: 'text', text: 'text',
}

const pause = ms => new Promise(r => setTimeout(r, ms))

/** Sites Boo may work on, from HAUNT_ALLOW (comma separated). Never production unless you add it. */
export function allowedHosts(env = process.env.HAUNT_ALLOW) {
  return (env ?? 'idle-frontend-clean.onrender.com,localhost,127.0.0.1')
    .split(',')
    .map(h => h.trim().toLowerCase())
    .filter(Boolean)
}

/** Desktop apps (not browsers) Boo may work in, by window title, from HAUNT_ALLOW_APPS. None by default. */
export function allowedApps(env = process.env.HAUNT_ALLOW_APPS) {
  return (env ?? '')
    .split(',')
    .map(a => a.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * May Boo touch this window? A browser page needs an allowed site. Any other
 * app needs its name on the allowed apps list, so Boo never types into your
 * editor, terminal or email by accident.
 */
export function isAllowedTarget({ url, window }, hosts = allowedHosts(), apps = allowedApps()) {
  if (url) return isAllowedUrl(url, hosts)
  const title = String(window ?? '').toLowerCase()
  return Boolean(title) && apps.some(a => title.includes(a))
}

/** Is this page on a site Boo may touch? */
export function isAllowedUrl(url, hosts = allowedHosts()) {
  if (!url) return false
  let host
  try {
    host = new URL(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase()
  } catch {
    return false
  }
  return hosts.some(h => host === h || host.endsWith(`.${h}`))
}

/** "Idle and 2 more pages - Personal - Microsoft Edge" to "Idle". */
export function appName(title = '') {
  return title.split(/ and \d+ more pages?| - (Personal|Work|Microsoft|Google|Mozilla)|\s-\s[^-]*$/)[0].trim() || 'App'
}

export class NotAllowedError extends Error {}

/**
 * hands: Hands. guide(el): show Boo at an element before acting (screen pixels).
 * Starts in the window in front when the job begins, then sticks to it.
 */
export function uiaAdapter({ hands, guide = async () => {}, hosts = allowedHosts(), apps = allowedApps(), startTitle = '' }) {
  let first = true
  let current = []
  let url = ''
  let windowTitle = ''

  async function look() {
    const title = first ? startTitle : '@same'
    let res = await hands.ask({ cmd: 'observe', title, max: 260 }, 30000)
    // Browsers build their page tree on first request: ask again if it looks empty.
    if (res.ok && res.elements.length < 4) {
      await pause(500)
      res = await hands.ask({ cmd: 'observe', title: '@same', max: 260 }, 30000)
    }
    first = false
    return res
  }

  return {
    get url() {
      return url
    },

    async observe() {
      const res = await look()
      if (!res.ok) return []
      url = res.url ?? ''
      windowTitle = res.window ?? ''
      if (!isAllowedTarget({ url, window: windowTitle }, hosts, apps)) {
        throw new NotAllowedError(
          url
            ? `I only work on sites you allowed, and this one is not on the list.`
            : `I only work in apps you allowed, and ${appName(windowTitle)} is not on the list.`,
        )
      }
      current = res.elements
      const app = appName(res.window)
      return res.elements.map(e => {
        const role = ROLES[e.role] ?? 'text'
        const item = { id: `e${e.index}`, app, role, name: String(e.name ?? '') }
        if (role === 'textbox') item.value = e.value ?? ''
        if (role === 'select' && e.value) item.value = e.value
        if (e.selected) item.selected = true
        if (e.enabled === false) item.disabled = true
        if (e.offscreen) item.offscreen = true
        return item
      })
    },

    async act(action) {
      const index = Number(String(action.id).slice(1))
      const el = current.find(e => e.index === index)
      if (!el) return 'That is no longer on screen. Look again.'
      if (!isAllowedTarget({ url, window: windowTitle }, hosts, apps)) throw new NotAllowedError('This window is not on the allowed list.')
      await guide(el)
      let res
      if (action.type === 'click') res = await hands.ask({ cmd: 'click', index })
      else if (action.type === 'type') res = await hands.ask({ cmd: 'fill', index, value: action.text })
      else if (action.type === 'select') res = await hands.ask({ cmd: 'fill', index, value: action.option })
      else return 'Nothing to do.'
      if (!res.ok && (res.error === 'not-in-front' || res.error === 'no-focus')) {
        throw new NotAllowedError('I paused because the app is not in front any more. Bring it back and ask me again.')
      }
      await pause(action.type === 'click' ? 700 : 150) // let the app react before looking again
      return res.ok ? 'Done.' : `That did not work: ${res.error}.`
    },
  }
}
