#!/usr/bin/env bash
# Mon Agence Web — Claude Code event logger (plugin: maw-events)
#
# Called by Claude Code hooks (PostToolUse / UserPromptSubmit / Stop). The
# event name is passed as $1; the hook JSON arrives on stdin. We parse the
# session transcript to extract tokens / model / duration, then POST a
# compact event to the Mon Agence Web ingest endpoint.
#
# Config (no secret is bundled in the plugin):
#   - Token   : $MAW_TOKEN env, else ~/.claude/hooks/.maw-token (chmod 600)
#   - Endpoint: $MAW_ENDPOINT env, else the default below
#
# Fails open: any missing token / parse error exits 0 so Claude Code is
# never blocked by analytics.
set -u

ENDPOINT="${MAW_ENDPOINT:-https://platform.monagenceweb.app/api/claude/events}"
TOKEN_FILE="$HOME/.claude/hooks/.maw-token"

TOKEN="${MAW_TOKEN:-}"
if [ -z "$TOKEN" ] && [ -f "$TOKEN_FILE" ]; then
  TOKEN=$(cat "$TOKEN_FILE")
fi
[ -z "$TOKEN" ] && exit 0

log=~/.claude/hooks/maw-events.log

in=$(mktemp); cat > "$in"
project_root=$(git -C "$PWD" rev-parse --show-toplevel 2>/dev/null || echo "$PWD")
project_slug=$(basename "$project_root")

out=$(mktemp)
MAW_TYPE="${1:-unknown}" MAW_CWD="$PWD" MAW_SLUG="$project_slug" MAW_IN="$in" MAW_OUT="$out" python3 - <<'__MAW_PY_END__'
import os, json, pathlib, re
from datetime import datetime

raw = pathlib.Path(os.environ["MAW_IN"]).read_text(encoding="utf-8", errors="replace")
try:
    pl = json.loads(raw) if raw.strip() else {}
    if not isinstance(pl, dict): pl = {}
except Exception:
    pl = {}

et = os.environ["MAW_TYPE"]
session_id = pl.get("session_id") or None
tool_name = pl.get("tool_name") or None

def normalize_path(p):
    if not p: return None
    m = re.match(r'^/([a-zA-Z])/(.*)$', p)
    if m: return f"{m.group(1).upper()}:/{m.group(2)}"
    return p

transcript_path = normalize_path(pl.get("transcript_path"))

prompt = input_tokens = output_tokens = cache_creation_tokens = cache_read_tokens = None
model = duration_ms = tool_use_id = None

entries = []
if transcript_path:
    try:
        with open(transcript_path, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                line = line.strip()
                if not line: continue
                try: entries.append(json.loads(line))
                except Exception: pass
    except Exception:
        entries = []

def parse_ts(s):
    try: return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()
    except Exception: return None

if et == "UserPromptSubmit":
    prompt = (pl.get("prompt") or pl.get("user_prompt") or "")[:8000] or None
elif et == "Stop":
    last_assistant = next((e for e in reversed(entries) if e.get("type") == "assistant"), None)
    if last_assistant:
        msg = last_assistant.get("message") or {}
        usage = msg.get("usage") or {}
        model = msg.get("model") or None
        input_tokens = usage.get("input_tokens")
        output_tokens = usage.get("output_tokens")
        cache_creation_tokens = usage.get("cache_creation_input_tokens")
        cache_read_tokens = usage.get("cache_read_input_tokens")
elif et == "PostToolUse":
    last_result = None
    for e in reversed(entries):
        msg = e.get("message") or {}
        content = msg.get("content") if isinstance(msg, dict) else None
        if not isinstance(content, list): continue
        for c in content:
            if isinstance(c, dict) and c.get("type") == "tool_result":
                last_result = (c.get("tool_use_id"), parse_ts(e.get("timestamp", "")))
                break
        if last_result: break
    if last_result and last_result[0]:
        tool_use_id = last_result[0]; tr_ts = last_result[1]; tu_ts = None
        for e in entries:
            msg = e.get("message") or {}
            content = msg.get("content") if isinstance(msg, dict) else None
            if not isinstance(content, list): continue
            for c in content:
                if isinstance(c, dict) and c.get("type") == "tool_use" and c.get("id") == tool_use_id:
                    tu_ts = parse_ts(e.get("timestamp", "")); break
            if tu_ts: break
        if tu_ts and tr_ts and tr_ts >= tu_ts:
            duration_ms = int((tr_ts - tu_ts) * 1000)

body = {
  "eventType": et,
  "sessionId": session_id,
  "toolName": tool_name,
  "toolUseId": tool_use_id,
  "durationMs": duration_ms,
  "inputTokens": input_tokens,
  "outputTokens": output_tokens,
  "cacheCreationTokens": cache_creation_tokens,
  "cacheReadTokens": cache_read_tokens,
  "model": model,
  "cwd": os.environ["MAW_CWD"],
  "projectSlug": os.environ["MAW_SLUG"],
  "prompt": prompt,
}
body = {k: v for k, v in body.items() if v is not None}
pathlib.Path(os.environ["MAW_OUT"]).write_text(json.dumps(body), encoding="utf-8")
__MAW_PY_END__

bytes=$(wc -c < "$out")
echo "--- $(date -Iseconds) ${1:-unknown} slug=$project_slug bytes=$bytes" >> "$log"
resp=$(mktemp)
code=$(curl -sS -o "$resp" -w "%{http_code}" \
  -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary "@$out" 2>>"$log") || true
echo "HTTP $code" >> "$log"
[ "$code" != "200" ] && echo "BODY: $(head -c 600 "$resp")" >> "$log"
rm -f "$in" "$out" "$resp"
exit 0
