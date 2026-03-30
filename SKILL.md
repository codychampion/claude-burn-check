---
name: token-diagnostics
description: Diagnoses Claude Code token usage to identify what is burning through context limits. Trigger whenever the user says "token diagnostics", "why am I hitting my limit", "token usage", "context usage", "burning tokens", "hitting my limit", "running out of context", or asks how to debug or understand their token consumption. Run this before recommending any token-saving interventions.
---

# Token Diagnostics Skill

Identifies the root cause of high token consumption in Claude Code sessions before recommending fixes.

## Burn Vectors (ranked by typical impact)

| # | Vector | Typical cost | Diagnosis |
|---|--------|-------------|-----------|
| 1 | **System prompt bloat** | 10–50k tokens/turn — MCP tool descriptions, skills list, git status, safety rules | Count MCP tools, skills, git status lines |
| 2 | **No .claudeignore** | Glob/grep searches return junk from node_modules, .next, build dirs | Check file exists + count indexable files |
| 3 | **Git status noise** | Untracked files in .gitignore gaps bloat the system prompt injected at conversation start | Count untracked files, find .gitignore gaps |
| 4 | **Large files re-read** | Same file read multiple times across turns | Scan conversation for duplicate reads |
| 5 | **Noisy tool output** | Docker logs, test output, grep results returning thousands of lines | Check recent bash output sizes |
| 6 | **Full file rewrites** | Entire file in assistant output when a diff would suffice | Count lines in code blocks |
| 7 | **Subagent overhead** | Each spawned agent gets full system prompt + context injection | Count agent calls in session |
| 8 | **Conversation length** | Accumulated history before compression kicks in | Estimate turn count |
| 9 | **Memory file bloat** | MEMORY.md + referenced files loaded every turn | Measure total memory file size |
| 10 | **CLAUDE.md bloat** | Project instructions loaded every turn | Measure file sizes |

## Execution Steps

Run ALL steps in parallel where possible. Collect raw numbers first, then synthesize.

### Step 1 — System prompt overhead

```bash
echo "=== MCP Tool Count ==="
for f in .claude/settings.json .claude/settings.local.json "$HOME/.claude/settings.json"; do
  if [ -f "$f" ]; then
    count=$(python3 -c "import json; d=json.load(open('$f')); mcps=d.get('mcpServers',{}); print(sum(1 for _ in mcps))" 2>/dev/null)
    echo "$f: $count MCP servers"
  fi
done

echo ""
echo "=== Skills Count ==="
find "$HOME/.claude" -name "SKILL.md" 2>/dev/null | wc -l
echo "total SKILL.md files (each adds description to system prompt)"

echo ""
echo "=== Git Status Size (injected at conversation start) ==="
git status --short 2>/dev/null | wc -l
echo "lines in git status"

echo ""
echo "=== Untracked Files ==="
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l)
echo "$UNTRACKED untracked files"
if [ "$UNTRACKED" -gt 20 ]; then
  echo "WARNING: $UNTRACKED untracked files — likely missing .gitignore entries"
  echo "Top directories with untracked files:"
  git ls-files --others --exclude-standard 2>/dev/null | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -10
fi
```

### Step 2 — File indexing surface

```bash
echo "=== .claudeignore ==="
if [ -f ".claudeignore" ]; then
  echo "EXISTS ($(wc -l < .claudeignore) rules)"
  cat .claudeignore
else
  echo "MISSING — Claude Code indexes everything in the repo"
fi

echo ""
echo "=== Indexable Files ==="
TOTAL_FILES=$(find . -type f -not -path "*/.git/*" 2>/dev/null | wc -l)
echo "$TOTAL_FILES total files (without .claudeignore filtering)"

CLEAN_FILES=$(find . -type f \
  -not -path "*/.git/*" \
  -not -path "*/node_modules/*" \
  -not -path "*/.next/*" \
  -not -path "*/__pycache__/*" \
  -not -path "*/.venv/*" \
  -not -path "*/dist/*" \
  -not -path "*/build/*" \
  -not -name "*.pyc" \
  -not -name "*.min.js" \
  -not -name "*.min.css" \
  -not -name "*.log" \
  -not -name "package-lock.json" \
  -not -name "yarn.lock" \
  -not -name "pnpm-lock.yaml" \
  2>/dev/null | wc -l)
echo "$CLEAN_FILES files after standard exclusions"
if [ "$TOTAL_FILES" -gt 0 ]; then
  echo "Potential reduction: $((TOTAL_FILES - CLEAN_FILES)) files ($((100 - (CLEAN_FILES * 100 / TOTAL_FILES)))%)"
fi
```

### Step 3 — .gitignore gaps

```bash
echo "=== .gitignore Gap Analysis ==="
for dir in node_modules .next dist build .venv __pycache__ .cache .turbo .parcel-cache; do
  while IFS= read -r found; do
    if [ -n "$found" ]; then
      count=$(find "$found" -type f 2>/dev/null | wc -l)
      if git check-ignore -q "$found" 2>/dev/null; then
        ignored="yes"
      else
        ignored="NO — add to .gitignore"
      fi
      echo "$found: $count files, gitignored: $ignored"
    fi
  done < <(find . -type d -name "$dir" -not -path "*/.git/*" 2>/dev/null | head -3)
done
```

### Step 4 — Context file sizes

```bash
echo "=== Auto-loaded Context Files ==="
TOTAL_CONTEXT=0
for f in CLAUDE.md .claude/CLAUDE.md claude.md; do
  if [ -f "$f" ]; then
    lines=$(wc -l < "$f")
    tokens=$((lines * 10))
    TOTAL_CONTEXT=$((TOTAL_CONTEXT + tokens))
    echo "$f: $lines lines (~$tokens tokens)"
  fi
done

echo ""
echo "=== Memory Files ==="
MEMDIR="$HOME/.claude/projects"
if [ -d "$MEMDIR" ]; then
  for d in "$MEMDIR"/*/memory; do
    if [ -d "$d" ]; then
      mem_lines=$(cat "$d"/*.md 2>/dev/null | wc -l)
      mem_files=$(ls "$d"/*.md 2>/dev/null | wc -l)
      tokens=$((mem_lines * 10))
      TOTAL_CONTEXT=$((TOTAL_CONTEXT + tokens))
      echo "$d: $mem_files files, $mem_lines lines (~$tokens tokens)"
    fi
  done
fi

echo ""
echo "Total estimated context injection per turn: ~$TOTAL_CONTEXT tokens"
```

### Step 5 — Codebase profile

```bash
echo "=== Source File Profile (top 15 by size) ==="
find . -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.yaml" -o -name "*.yml" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.next/*" -not -path "*/.venv/*" \
  | xargs wc -l 2>/dev/null | sort -rn | head -15

echo ""
echo "=== Files Over 500 Lines (full-read risk) ==="
find . -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.yaml" -o -name "*.yml" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.next/*" -not -path "*/.venv/*" \
  | while read -r f; do
    lines=$(wc -l < "$f" 2>/dev/null)
    if [ "$lines" -gt 500 ]; then
      echo "$lines $f"
    fi
  done | sort -rn
```

### Step 6 — Docker/command output noise

```bash
echo "=== Docker Compose Variable Warnings ==="
if command -v docker &>/dev/null && [ -f "docker-compose.yml" ]; then
  NOISE=$(docker compose ps 2>&1 | grep -c "variable is not set" 2>/dev/null || echo 0)
  echo "$NOISE 'variable is not set' warnings per docker compose command"
  if [ "$NOISE" -gt 20 ]; then
    echo "WARNING: Each docker compose command wastes ~$((NOISE * 15)) tokens on warnings"
    echo "Fix: Change \${VAR} to \${VAR:-} in docker-compose.yml for secret variables"
  fi
fi
```

### Step 7 — Hooks overhead

```bash
echo "=== Hooks ==="
if [ -d ".claude/hooks" ]; then
  for f in .claude/hooks/*; do
    lines=$(wc -l < "$f" 2>/dev/null)
    echo "$f: $lines lines"
  done
else
  echo "No hooks directory"
fi

echo ""
echo "=== Scheduled Tasks ==="
COUNT=$(ls "$HOME/.claude/scheduled-tasks/" 2>/dev/null | wc -l)
echo "$COUNT scheduled tasks (each injects context when triggered)"
```

## Report Template

After running all steps, synthesize into this format:

```
TOKEN DIAGNOSTICS REPORT
========================

SYSTEM PROMPT OVERHEAD (per turn):
  MCP tools:          X servers, ~Y tool definitions
  Skills:             X loaded
  Git status:         X lines + Y untracked files
  Context files:      ~X tokens (CLAUDE.md + memory)
  ESTIMATED:          ~X tokens/turn in fixed overhead

INDEXING SURFACE:
  Total files:        X (without .claudeignore: Y)
  Reduction possible: X% by adding .claudeignore
  .gitignore gaps:    [list directories not ignored]

CODEBASE RISK:
  Files >500 lines:   X (each full read costs ~Y tokens)
  Largest:            [top 3]

TOOL OUTPUT NOISE:
  Docker warnings:    X per command (~Y wasted tokens)

PRIMARY BURN VECTORS (checked = detected):
  [x] No .claudeignore — X files indexable vs Y needed
  [x] .gitignore gaps — X untracked files bloating git status
  [x] Large files re-read repeatedly
  [x] Docker/command output noise
  [x] CLAUDE.md + memory bloat (>300 lines)
  [x] Conversation too long — needs /compact
  [x] Too many MCP tools loaded
  [x] Subagent overuse

FIXES (in priority order):
  1. [highest-impact fix with specific command]
  2. [next fix]
  3. [next fix]
```

## Auto-Fix Rules

Apply these fixes immediately without asking (they are always safe):

**No .claudeignore** — create one:
```bash
cat > .claudeignore << 'EOF'
# Build artifacts & dependencies
**/node_modules/
**/.next/
**/__pycache__/
**/.venv/
dist/
build/
*.pyc
*.min.js
*.min.css

# Large non-code files
*.whl
*.tar.gz
*.zip
*.sqlite
*.db

# Lock files
package-lock.json
yarn.lock
pnpm-lock.yaml
poetry.lock

# Git
.git/

# Logs & temp
*.log
tmp/
.cache/
.turbo/
EOF
echo ".claudeignore created"
```

**CLAUDE.md too large** — warn only (don't modify):
```bash
if [ -f "CLAUDE.md" ] && [ "$(wc -l < CLAUDE.md)" -gt 200 ]; then
  echo "WARNING: CLAUDE.md is $(wc -l < CLAUDE.md) lines — consider splitting into topic files"
fi
```

**docker-compose.yml variable warnings** — fix bare `${VAR}` references:
```python
import re

with open('docker-compose.yml', 'r') as f:
    content = f.read()

fixed = re.sub(r'\$\{([A-Z_][A-Z0-9_]*)\}', lambda m: '${' + m.group(1) + ':-}', content)

with open('docker-compose.yml', 'w') as f:
    f.write(fixed)

print("Fixed docker-compose.yml variable defaults")
```

**.gitignore gaps** — suggest additions but ASK before applying, as it changes git behavior.

## Execution Notes

- Run Steps 1–7 in parallel (3–4 bash calls max, combine related steps)
- Synthesize into the report format above
- Auto-apply .claudeignore if missing; auto-fix docker-compose warnings
- Recommend specific .gitignore additions but confirm with user before applying
- Recommend exactly ONE highest-priority next action
- If input_tokens trend is rising: context accumulation → recommend `/compact`
- If input_tokens are flat but output is high: verbose responses → recommend terse mode
