# Release checklist

Use this checklist before publishing `claude-burn-check` to npm.

## Preflight

- [ ] Merge the README / npm CLI PR.
- [ ] Confirm `validate-skill` passes.
- [ ] Confirm `npm-cli` passes.
- [ ] Confirm `package.json` has the intended version.
- [ ] Confirm `SKILL.md` frontmatter still uses `name: token-diagnostics`.
- [ ] Confirm the CLI works locally:

```bash
node bin/claude-burn-check.js --help
node bin/claude-burn-check.js doctor --repo
npm pack --dry-run
```

## Publish

Prefer npm trusted publishing / provenance if configured. If publishing manually, use npm 2FA and avoid long-lived tokens.

```bash
npm publish --access public
```

## Smoke test after publish

```bash
npx claude-burn-check --help
npx claude-burn-check print-skill | head
npx claude-burn-check doctor || true
```

To test install in a disposable environment:

```bash
TMP_HOME=$(mktemp -d)
HOME="$TMP_HOME" npx claude-burn-check install
HOME="$TMP_HOME" npx claude-burn-check doctor
rm -rf "$TMP_HOME"
```

## GitHub release

Create a GitHub release matching the npm version, for example:

```text
v0.1.0
```

Release notes should mention:

- Claude Code skill installer
- `doctor` validation command
- manual `print-skill` fallback
- uninstall command
