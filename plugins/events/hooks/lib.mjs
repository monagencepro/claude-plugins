// Shared helpers for the events plugin. Pure Node (>=18) — no python,
// curl, jq or git: the only runtime dependency is `node`, which Claude
// Code already requires to run. Node 18+ ships global `fetch`.
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { homedir, hostname } from 'node:os'
import { basename, dirname, join } from 'node:path'

export const HOOKS_DIR = join(homedir(), '.claude', 'hooks')
export const TOKEN_FILE = join(HOOKS_DIR, '.monagence-token')
export const PENDING_FILE = join(HOOKS_DIR, '.monagence-pending.json')
export const LOG_FILE = join(HOOKS_DIR, 'monagence-events.log')

export const BASE_URL = (process.env.MONAGENCE_BASE_URL || 'https://app.monagence.pro').replace(
  /\/+$/,
  '',
)
export const INGEST_URL = process.env.MONAGENCE_ENDPOINT || `${BASE_URL}/api/claude/events`

function ensureDir() {
  try {
    mkdirSync(HOOKS_DIR, { recursive: true })
  } catch {
    /* ignore */
  }
}

export function readToken() {
  if (process.env.MONAGENCE_TOKEN) return process.env.MONAGENCE_TOKEN.trim() || null
  try {
    return readFileSync(TOKEN_FILE, 'utf8').trim() || null
  } catch {
    return null
  }
}

export function writeToken(token) {
  ensureDir()
  writeFileSync(TOKEN_FILE, token, { mode: 0o600 })
  try {
    chmodSync(TOKEN_FILE, 0o600)
  } catch {
    /* Windows: mode bits not enforced — fine */
  }
}

export function readPending() {
  try {
    const p = JSON.parse(readFileSync(PENDING_FILE, 'utf8'))
    if (p && p.deviceCode && p.expiresAt) return p
  } catch {
    /* ignore */
  }
  return null
}

export function writePending(p) {
  ensureDir()
  writeFileSync(PENDING_FILE, JSON.stringify(p), { mode: 0o600 })
  try {
    chmodSync(PENDING_FILE, 0o600)
  } catch {
    /* ignore */
  }
}

export function clearPending() {
  try {
    rmSync(PENDING_FILE)
  } catch {
    /* ignore */
  }
}

export async function deviceStart(label) {
  const r = await fetch(`${BASE_URL}/api/claude/device/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ label }),
  })
  if (!r.ok) throw new Error(`device/start ${r.status}`)
  return r.json()
}

export async function devicePoll(deviceCode) {
  const r = await fetch(`${BASE_URL}/api/claude/device/poll`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deviceCode }),
  })
  if (!r.ok) throw new Error(`device/poll ${r.status}`)
  return r.json()
}

/** Nearest ancestor dir containing `.git`, else the cwd basename. */
export function projectSlug(cwd) {
  let dir = cwd
  for (let i = 0; i < 40; i++) {
    if (existsSync(join(dir, '.git'))) return basename(dir)
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return basename(cwd)
}

export function deviceLabel() {
  try {
    return hostname() || 'claude-code'
  } catch {
    return 'claude-code'
  }
}

/** Read all of stdin (the hook JSON). Resolves '' when there's no pipe. */
export function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('')
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (c) => (data += c))
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', () => resolve(data))
  })
}
