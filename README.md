# Claude Burn Check

![Status](https://img.shields.io/badge/status-active-16a34a)
![Claude Code](https://img.shields.io/badge/Claude%20Code-skill-7c3aed)
![Token Diagnostics](https://img.shields.io/badge/focus-token%20diagnostics-111827)
![Safe Fixes](https://img.shields.io/badge/safe%20fixes-automatic-059669)
![Shell](https://img.shields.io/badge/runtime-shell-334155)

Find why Claude Code is burning context, then suggest safe fixes before your session melts down.

Claude Burn Check is a tiny [Claude Code skill](https://docs.anthropic.com/en/docs/claude-code/skills) for diagnosing context-window waste: noisy git status, missing `.claudeignore`, oversized memory files, chat history bloat, Docker warning spam, giant file rereads, and other invisible token drains.

## Why people use it

Claude Code can feel slow or expensive for reasons that are hard to see. The problem is often not the model — it is project noise getting injected over and over.

This skill gives you a fast report:

```text
what is burning my context?
```

Then it ranks the biggest burn vectors and fixes the safe ones automatically.

## Quick install

```bash
mkdir -p ~/.claude/skills/token-diagnostics
cp SKILL.md ~/.claude/skills/token-diagnostics/SKILL.md
```

Claude Code automatically loads skills from `~/.claude/skills/`.

## Run it

Ask Claude Code naturally:

```text
token diagnostics
why am I hitting my context limit?
what's burning through my tokens?
run claude burn check
```

## What it checks

| # | Burn vector | Typical cost |
|---|---|---|
| 1 | System prompt bloat from MCP tools, skills, git status | 10–50k tokens/turn |
| 2 | Missing `.claudeignore` | Entire repo indexed on searches |
| 3 | Git status noise from untracked files | Bloats session start and tool context |
| 4 | Large files reread across turns | Hundreds to thousands of tokens each |
| 5 | Noisy tool output from Docker/test logs | 1–2k tokens per command |
| 6 | Full file rewrites instead of diffs | Scales with file size |
| 7 | Subagent overhead | Full context injection per agent |
| 8 | Long conversation history | Accumulates until `/compact` |
| 9 | Memory file bloat | Loaded every turn |
| 10 | `CLAUDE.md` bloat | Loaded every turn |

## Safe fixes

Applied automatically:

- Creates `.claudeignore` if missing.
- Fixes `${VAR}` → `${VAR:-}` in `docker-compose.yml` to suppress variable warnings.

Asks first:

- `.gitignore` additions, because they change git tracking behavior.

Never does silently:

- Deletes source files.
- Rewrites project architecture.
- Removes intentional context files.

## Example finding

Running this on a real project found **101 “variable is not set” warnings** firing on every `docker compose` command — roughly **1,500 tokens wasted per command**. A one-line Python fix dropped it to zero.

## Sample output

```text
TOKEN DIAGNOSTICS REPORT
========================

SYSTEM PROMPT OVERHEAD:
  MCP tools:          8 servers
  Skills:             24 loaded
  Git status:         79 lines + 75 untracked files
  Context files:      ~1,940 tokens
  Estimated overhead: ~6,000–8,000 tokens/turn

INDEXING SURFACE:
  Total files:        62,389
  After exclusions:   1,178 files
  .claudeignore:      EXISTS ✓

TOOL OUTPUT NOISE:
  Docker warnings:    101 per command (~1,515 wasted tokens) ← FIXED

FIXES APPLIED:
  1. docker-compose.yml: 155 bare ${VAR} → ${VAR:-}
  2. Added generated files to .gitignore
```

## Example burn patterns

| Symptom | Likely cause |
|---|---|
| Claude gets slow after every command | Tool output is too noisy |
| Searches feel huge | Missing or weak `.claudeignore` |
| Every session starts bloated | Git status has many untracked/generated files |
| Good edits suddenly become expensive | Large files are being reread or rewritten |
| `/compact` helps for a while, then pain returns | History is not the only burn source |

## How Claude Code skills work

A skill is a Markdown file with YAML frontmatter that tells Claude when to activate it. When a trigger phrase is detected, Claude loads the skill and follows its instructions.

Skills live in `~/.claude/skills/<skill-name>/SKILL.md` and are loaded globally across projects.

## Contributing

PRs welcome. Good additions are new burn vectors, safer diagnostics, clearer estimates, and realistic examples of context waste.