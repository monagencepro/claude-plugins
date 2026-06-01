#!/usr/bin/env node
// Claude Code event logger → Mon Agence Web. Parses the hook payload and
// the session transcript (tokens / model / tool duration), then POSTs a
// compact event. If no token is present yet but a device authorization is
// pending, it opportunistically redeems it here (no daemon — polling
// piggybacks on the events the user generates).
import { appendFileSync, readFileSync } from 'node:fs'
import {
  INGEST_URL,
  LOG_FILE,
  clearPending,
  devicePoll,
  projectSlug,
  readPending,
  readStdin,
  readToken,
  writeToken,
} from './lib.mjs'

const eventType = process.argv[2] || 'unknown'

function log(line) {
  try {
    appendFileSync(LOG_FILE, line + '\n')
  } catch {
    /* ignore */
  }
}

async function resolveToken() {
  const existing = readToken()
  if (existing) return existing
  const pending = readPending()
  if (!pending) return null
  if (Date.parse(pending.expiresAt) < Date.now()) {
    clearPending()
    return null
  }
  try {
    const res = await devicePoll(pending.deviceCode)
    if (res.status === 'approved' && res.token) {
      writeToken(res.token)
      clearPending()
      return res.token
    }
    if (res.status === 'expired' || res.status === 'denied') clearPending()
  } catch {
    /* network hiccup — try again on the next event */
  }
  return null
}

const raw = await readStdin()
const token = await resolveToken()
if (!token) process.exit(0)

let pl = {}
try {
  pl = raw ? JSON.parse(raw) : {}
} catch {
  pl = {}
}
if (!pl || typeof pl !== 'object') pl = {}

const cwd = pl.cwd || process.cwd()
const slug = projectSlug(cwd)

function normPath(p) {
  if (!p) return null
  const m = /^\/([a-zA-Z])\/(.*)$/.exec(p) // /c/Users/... → C:/Users/...
  return m ? `${m[1].toUpperCase()}:/${m[2]}` : p
}
const tsOf = (s) => {
  const t = Date.parse(s || '')
  return Number.isNaN(t) ? null : t
}

const body = {
  eventType,
  sessionId: pl.session_id || null,
  toolName: pl.tool_name || null,
  cwd,
  projectSlug: slug,
}

// Load the transcript once if we need it for this event type.
let entries = []
const transcriptPath = normPath(pl.transcript_path)
if (transcriptPath && (eventType === 'Stop' || eventType === 'PostToolUse')) {
  try {
    for (const line of readFileSync(transcriptPath, 'utf8').split('\n')) {
      const s = line.trim()
      if (!s) continue
      try {
        entries.push(JSON.parse(s))
      } catch {
        /* skip malformed line */
      }
    }
  } catch {
    entries = []
  }
}

if (eventType === 'UserPromptSubmit') {
  const p = (pl.prompt || pl.user_prompt || '').slice(0, 8000)
  if (p) body.prompt = p
} else if (eventType === 'Stop') {
  const lastAssistant = [...entries].reverse().find((e) => e?.type === 'assistant')
  const msg = lastAssistant?.message
  if (msg) {
    const u = msg.usage || {}
    if (msg.model) body.model = msg.model
    if (u.input_tokens != null) body.inputTokens = u.input_tokens
    if (u.output_tokens != null) body.outputTokens = u.output_tokens
    if (u.cache_creation_input_tokens != null) body.cacheCreationTokens = u.cache_creation_input_tokens
    if (u.cache_read_input_tokens != null) body.cacheReadTokens = u.cache_read_input_tokens
  }
} else if (eventType === 'PostToolUse') {
  let resultId = null
  let resultTs = null
  for (let i = entries.length - 1; i >= 0; i--) {
    const content = entries[i]?.message?.content
    if (!Array.isArray(content)) continue
    const tr = content.find((c) => c && c.type === 'tool_result')
    if (tr) {
      resultId = tr.tool_use_id
      resultTs = tsOf(entries[i].timestamp)
      break
    }
  }
  if (resultId) {
    body.toolUseId = resultId
    let useTs = null
    for (const e of entries) {
      const content = e?.message?.content
      if (!Array.isArray(content)) continue
      const tu = content.find((c) => c && c.type === 'tool_use' && c.id === resultId)
      if (tu) {
        useTs = tsOf(e.timestamp)
        break
      }
    }
    if (useTs && resultTs && resultTs >= useTs) body.durationMs = resultTs - useTs
  }
}

for (const k of Object.keys(body)) if (body[k] == null) delete body[k]

try {
  const r = await fetch(INGEST_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  log(`${new Date().toISOString()} ${eventType} slug=${slug} HTTP ${r.status}`)
  if (!r.ok) log(`  BODY: ${(await r.text()).slice(0, 400)}`)
} catch (e) {
  log(`${new Date().toISOString()} ${eventType} ERROR ${String(e).slice(0, 200)}`)
}
process.exit(0)
