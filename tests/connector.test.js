// The universal connector's safety rails.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fc from 'fast-check'
import { isAllowedUrl, isAllowedTarget, allowedHosts, allowedApps, appName } from '../src/main/uia-adapter.js'

const hosts = allowedHosts('idle-frontend-clean.onrender.com,localhost')

test('Boo works on staging and local pages, never on live Idle', () => {
  assert.equal(isAllowedUrl('https://idle-frontend-clean.onrender.com/home', hosts), true)
  assert.equal(isAllowedUrl('http://localhost:4317/', hosts), true)
  assert.equal(isAllowedUrl('https://app.idlebooking.com/home', hosts), false)
  assert.equal(isAllowedUrl('https://idlebooking.com/', hosts), false)
  assert.equal(isAllowedUrl('idle-frontend-clean.onrender.com/bookings', hosts), true)
})

test('a look-alike address never passes as an allowed one', () => {
  fc.assert(
    fc.property(fc.domain(), domain => {
      const sneaky = `https://idle-frontend-clean.onrender.com.${domain}/home`
      return isAllowedUrl(sneaky, hosts) === false
    }),
  )
  assert.equal(isAllowedUrl('https://evil-idle-frontend-clean.onrender.com/', hosts), false)
})

test('other desktop apps only when you name them, so Boo never types into your editor', () => {
  const none = allowedApps('')
  assert.equal(isAllowedTarget({ url: '', window: 'main.js - haunt - Visual Studio Code' }, hosts, none), false)
  assert.equal(isAllowedTarget({ url: '', window: 'ClinicMaster 98 - Clients' }, hosts, none), false)
  const legacy = allowedApps('ClinicMaster')
  assert.equal(isAllowedTarget({ url: '', window: 'ClinicMaster 98 - Clients' }, hosts, legacy), true)
  assert.equal(isAllowedTarget({ url: '', window: 'Visual Studio Code' }, hosts, legacy), false)
  assert.equal(isAllowedTarget({ url: 'https://app.idlebooking.com', window: 'Idle' }, hosts, legacy), false)
})

test('window titles become short app names', () => {
  assert.equal(appName('Idle and 1 more page - Personal - Microsoft​ Edge'), 'Idle')
  assert.equal(appName('Bookings - Idle - Personal - Microsoft Edge'), 'Bookings - Idle')
})
