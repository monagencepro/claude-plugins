#!/usr/bin/env node
// Explicit device-flow login (also driven by the /maw-login command).
// Blocks until the machine is authorized, then writes the token. Useful
// to (re)link a machine on demand rather than waiting for SessionStart.
import { exec } from 'node:child_process'
import { deviceLabel, devicePoll, deviceStart, writeToken } from '../hooks/lib.mjs'

function openBrowser(url) {
  const cmd =
    process.platform === 'darwin'
      ? `open "${url}"`
      : process.platform === 'win32'
        ? `start "" "${url}"`
        : `xdg-open "${url}"`
  exec(cmd, () => {})
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const d = await deviceStart(deviceLabel())
const url = d.verificationUriComplete || d.verificationUri
console.log(`\nOuvre cette URL pour autoriser la machine :\n  ${url}`)
console.log(`Code : ${d.userCode}\n`)
openBrowser(url)

const deadline = Date.now() + (d.expiresIn || 600) * 1000
const interval = (d.interval || 5) * 1000
process.stdout.write("En attente d'autorisation")

while (Date.now() < deadline) {
  await sleep(interval)
  process.stdout.write('.')
  let res
  try {
    res = await devicePoll(d.deviceCode)
  } catch {
    continue
  }
  if (res.status === 'approved' && res.token) {
    writeToken(res.token)
    console.log(
      `\n✓ Machine autorisée${res.workspaceSlug ? ` sur « ${res.workspaceSlug} »` : ''}. Token enregistré.`,
    )
    process.exit(0)
  }
  if (res.status === 'denied' || res.status === 'expired') {
    console.log(`\n✗ ${res.status}. Relance la commande.`)
    process.exit(1)
  }
}
console.log('\n✗ Délai dépassé. Relance la commande.')
process.exit(1)
