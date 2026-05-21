#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const sourceSkill = join(repoRoot, "SKILL.md");
const targetDir = join(homedir(), ".claude", "skills", "token-diagnostics");
const targetSkill = join(targetDir, "SKILL.md");

function usage() {
  console.log(`Claude Burn Check

Usage:
  claude-burn-check install       Install the Claude Code skill
  claude-burn-check doctor        Check local installation
  claude-burn-check print-skill   Print SKILL.md for manual copy/paste
  claude-burn-check uninstall     Remove the installed skill

Examples:
  npx claude-burn-check install
  npx claude-burn-check doctor
`);
}

function readSkill() {
  if (!existsSync(sourceSkill)) {
    throw new Error(`Could not find SKILL.md at ${sourceSkill}`);
  }
  return readFileSync(sourceSkill, "utf8");
}

function validateSkillText(text) {
  const required = [
    "---",
    "name: token-diagnostics",
    "description:"
  ];

  const missing = required.filter((needle) => !text.includes(needle));
  return {
    ok: missing.length === 0,
    missing
  };
}

function install() {
  const text = readSkill();
  const validation = validateSkillText(text);
  if (!validation.ok) {
    console.error(`SKILL.md is missing required metadata: ${validation.missing.join(", ")}`);
    process.exit(1);
  }

  mkdirSync(targetDir, { recursive: true });
  writeFileSync(targetSkill, text, "utf8");

  console.log(`Installed Claude Burn Check skill to:\n${targetSkill}`);
  console.log("Restart Claude Code or ask it to reload skills if needed.");
}

function doctor({ repo = false } = {}) {
  const pathToCheck = repo ? sourceSkill : targetSkill;
  const label = repo ? "repository SKILL.md" : "installed skill";

  if (!existsSync(pathToCheck)) {
    console.error(`Missing ${label}: ${pathToCheck}`);
    if (!repo) {
      console.error("Run: npx claude-burn-check install");
    }
    process.exit(1);
  }

  const text = readFileSync(pathToCheck, "utf8");
  const validation = validateSkillText(text);

  if (!validation.ok) {
    console.error(`${label} is invalid. Missing: ${validation.missing.join(", ")}`);
    process.exit(1);
  }

  console.log(`${label} looks valid: ${pathToCheck}`);
}

function printSkill() {
  process.stdout.write(readSkill());
}

function uninstall() {
  if (!existsSync(targetSkill)) {
    console.log(`No installed skill found at:\n${targetSkill}`);
    return;
  }

  rmSync(targetDir, { recursive: true, force: true });
  console.log(`Removed Claude Burn Check skill from:\n${targetDir}`);
}

const [command, ...args] = process.argv.slice(2);

try {
  switch (command) {
    case "install":
      install();
      break;
    case "doctor":
      doctor({ repo: args.includes("--repo") });
      break;
    case "print-skill":
      printSkill();
      break;
    case "uninstall":
      uninstall();
      break;
    case undefined:
    case "help":
    case "--help":
    case "-h":
      usage();
      break;
    default:
      console.error(`Unknown command: ${command}\n`);
      usage();
      process.exit(1);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
