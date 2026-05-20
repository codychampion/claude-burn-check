# token-diagnostics

![Status](https://img.shields.io/badge/status-active-16a34a)
![Claude Code](https://img.shields.io/badge/Claude%20Code-skill-7c3aed)
![Token Diagnostics](https://img.shields.io/badge/focus-token%20diagnostics-111827)
![Safe Fixes](https://img.shields.io/badge/safe%20fixes-automatic-059669)
![Shell](https://img.shields.io/badge/runtime-shell-334155)

A [Claude Code skill](https://docs.anthropic.com/en/docs/claude-code/skills) that diagnoses why your context window is burning through tokens — and fixes the worst offenders automatically.

## What it does

Run it when Claude Code starts feeling slow, hitting context limits, or when you're burning through tokens faster than expected. It checks 10 common burn vectors, ranks them by impact, and auto-fixes the safe ones.

**Burn vectors checked:**

| # | Vector | Typical cost |
|---|--------|-------------|
| 1 | System prompt bloat (MCP tools, skills, git status) | 10–50k tokens/turn |
| 2 | Missing `.claudeignore` | Entire repo indexed on every search |
| 3 | Git status noise (untracked files) | Bloats system prompt at session start |
| 4 | Large files re-read across turns | Hundreds to thousands of tokens each |
| 5 | Noisy tool output (docker warnings, test logs) | 1–2k tokens per command |
| 6 | Full file rewrites instead of diffs | Scales with file size |
| 7 | Subagent overhead | Full context injection per agent |
| 8 | Long conversation history | Accumulates until /compact |
| 9 | Memory file bloat | Loaded every turn |
| 10 | CLAUDE.md bloat | Loaded every turn |

**Auto-fixed without asking:**
- Creates `.claudeignore` if missing
- Fixes `${VAR}` → `${VAR:-}` in `docker-compose.yml` to suppress variable warnings

**Asks before applying:**
- `.gitignore` additions (changes git tracking behaviour)

## Real-world example

Running this on my project found **101 "variable is not set" warnings** firing on every `docker compose` command — roughly **1,500 tokens wasted per command**. A one-line Python fix dropped it to zero.

## Installation

Copy `SKILL.md` into your Claude Code skills directory:

```bash
# Create the skills directory if it doesn't exist
mkdir -p ~/.claude/skills/token-diagnostics

# Copy the skill
cp SKILL.md ~/.claude/skills/token-diagnostics/SKILL.md
```

That's it. Claude Code automatically loads skills from `~/.claude/skills/`.

## Usage

Just ask Claude Code naturally:

```text
token diagnostics
why am I hitting my context limit?
what's burning through my tokens?
```

Claude will run the diagnostic steps in parallel, synthesize a report, and fix what it safely can.

## Sample output

```text
TOKEN DIAGNOSTICS REPORT
========================

SYSTEM PROMPT OVERHEAD (per turn):
  MCP tools:          8 servers
  Skills:             24 loaded
  Git status:         79 lines + 75 untracked files
  Context files:      ~1,940 tokens (CLAUDE.md + memory)
  ESTIMATED:          ~6,000–8,000 tokens/turn in fixed overhead

INDEXING SURFACE:
  Total files:        62,389 (without .claudeignore filtering)
  After exclusions:   1,178 files
  .claudeignore:      EXISTS ✓

TOOL OUTPUT NOISE:
  Docker warnings:    101 per command (~1,515 wasted tokens) ← FIXED

PRIMARY BURN VECTORS:
  [x] Docker compose warnings — 101/command × ~15 tokens each
  [x] 75 untracked files bloating git status
  [ ] .claudeignore present ✓
  [ ] Memory lean ✓
  [ ] CLAUDE.md lean ✓

FIXES APPLIED:
  1. docker-compose.yml: 155 bare ${VAR} → ${VAR:-}
  2. Deleted stale artifact
  3. Added missing generated files to .gitignore
```

## How Claude Code skills work

A skill is a Markdown file with a YAML frontmatter block that tells Claude when to activate it. When a trigger phrase is detected, Claude loads the skill and follows its instructions.

Skills live in `~/.claude/skills/<skill-name>/SKILL.md` and are loaded globally across all your projects.

## Contributing

PRs welcome. If you find a new burn vector or a better diagnostic, open an issue or submit a fix.
