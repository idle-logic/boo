// The only bridge between Boo's page and the app. Nothing else is exposed.
const { contextBridge, ipcRenderer } = require('electron')

const listen = channel => callback => {
  const handler = (_event, value) => callback(value)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

contextBridge.exposeInMainWorld('haunt', {
  onGeometry: listen('geometry'),
  onWindows: listen('windows'),
  onCursor: listen('cursor'),
  onEvent: listen('haunt-event'),
  setInteractive: interactive => ipcRenderer.send('set-interactive', Boolean(interactive)),
  clicked: () => ipcRenderer.send('boo-clicked'),
})
