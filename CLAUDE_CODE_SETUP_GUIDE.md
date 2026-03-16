# Claude Code Project Setup Guide

> A guide to setting up a well-structured Claude Code development environment.
> Based on a real production project (Carbonara) — adapt to your project's domain.

---

## Table of Contents

1. [Overview — What We Built](#overview)
2. [File Structure](#file-structure)
3. [CLAUDE.md — The Root Instructions](#claudemd)
4. [docs/ — Modular Documentation](#docs-directory)
5. [.claude/commands/ — Slash Commands](#slash-commands)
6. [.claude/settings.json — Permissions & Hooks](#settings)
7. [.gitignore Additions](#gitignore)
8. [Beads Integration](#beads-integration)
9. [Migration Checklist](#migration-checklist)

---

## Overview

The goal is to give Claude Code deep, structured knowledge of your project so it can:

- **Navigate** the codebase without guessing
- **Follow** your coding conventions automatically
- **Plan** work using your issue tracker (beads)
- **Execute** common workflows via slash commands
- **Verify** its own changes via hooks

The setup has three layers:

```
CLAUDE.md              ← Always loaded. Compact. Links to docs.
docs/*.md              ← Loaded on demand via @-references. Deep knowledge per domain.
.claude/commands/*.md  ← Slash commands for repeatable workflows.
.claude/settings.json  ← Permissions, hooks (auto-typecheck, etc.)
```

**Key principle:** CLAUDE.md should be short enough to scan in seconds. All detail lives in `docs/` and is pulled in only when relevant.

---

## File Structure

```
your-project/
├── CLAUDE.md                    # Root instructions (always loaded)
├── CLAUDE.local.md              # Personal overrides (gitignored)
├── .claude/
│   ├── settings.json            # Shared permissions + hooks (committed)
│   ├── settings.local.json      # Personal permission overrides (gitignored)
│   └── commands/                # Slash commands
│       ├── plan.md              # /plan — plan work into beads
│       ├── implement.md         # /implement — execute a plan step
│       ├── commit.md            # /commit — conventional commit from staged changes
│       ├── review.md            # /review — code review
│       └── debug.md             # /debug — systematic debugging
├── docs/                        # Deep documentation (referenced from CLAUDE.md)
│   ├── architecture.md          # System overview, data model, auth
│   ├── backend-structure.md     # API routes, DB schema, services
│   ├── frontend-state.md        # Contexts, state management, persistence
│   ├── conventions.md           # Code style rules, naming, patterns
│   ├── [domain-specific].md     # One doc per major subsystem
│   ├── beads-workflow.md        # How to use beads in this project
│   └── diagrams/                # Mermaid diagrams
│       └── *.mmd
└── .beads/                      # Beads database (gitignored)
```

---

## CLAUDE.md

This is the **single most important file**. It's always loaded into context, so it must be:

- **Compact** — under 200 lines ideally, never bloated
- **Structured** — clear sections with consistent headers
- **Linking** — points to `docs/` for details via `@docs/filename.md`

### Template

```markdown
# Project Name

## What
[2-3 sentences: what this project does, who uses it, what problem it solves]

**Stack:** [list tech stack concisely]

## Project Structure
[Tree of the most important directories — not exhaustive, just orientation]

## Commands
[Copy-paste commands to build, test, run, typecheck — grouped by area]

### Frontend
\`\`\`bash
pnpm dev              # Dev server
pnpm test             # Tests
tsc --noEmit          # Type-check
\`\`\`

### Backend
\`\`\`bash
docker compose up -d  # Start services
pytest                # Tests
\`\`\`

### Beads (task management)
\`\`\`bash
bd ready              # Show work ready to start
bd list               # List all issues
bd show <id>          # Show issue details
\`\`\`

## Code Style
[5-10 bullet points — the rules that matter most]
- TypeScript strict, no `any`
- Falsy safety: use `??` not `||`, use `is None` not `or`
- File size max 500 lines
- [naming conventions for your project]

## Workflow
- Task management via Beads — never invent todo lists
- Conventional commits: `feat(<scope>): description (bd:<id>)`
- Branch naming: `feat/<id>-short-slug`
- Plan before implementing
- Small diffs, run tests after each change

## Reference Documentation

### Architecture & Structure
- Architecture overview: @docs/architecture.md
- Backend structure: @docs/backend-structure.md
- Conventions: @docs/conventions.md

### Domain Systems
- [Domain A]: @docs/domain-a.md
- [Domain B]: @docs/domain-b.md

### Frontend
- State management: @docs/frontend-state.md
- [Feature X]: @docs/feature-x.md

### Workflow
- Beads task management: @docs/beads-workflow.md
```

### How @-references work

When Claude Code sees `@docs/architecture.md` in CLAUDE.md, it loads that file into context **at conversation start**. This means:

- Every file referenced with `@` is always available — no need to re-reference in commands
- Keep references to files that are **frequently relevant** (architecture, conventions)
- Very domain-specific docs can be referenced only from commands or read on demand
- The files must exist at the referenced path relative to project root

**Important:** All `@docs/...` references in CLAUDE.md are loaded automatically. Your slash commands (`/plan`, `/implement`, etc.) inherit this context — they do NOT need their own `@` references.

---

## docs/ Directory

Each doc file should be a **self-contained reference** for one subsystem or concern. Write them for an AI that needs to understand the system well enough to modify it.

### What makes a good doc file

1. **Start with purpose** — one sentence about what this subsystem does
2. **Show the structure** — directory tree, key files, data flow
3. **Define the data model** — schemas, types, enums
4. **Show patterns** — how to add a new X, how data flows from A to B
5. **List key files** — exact paths so Claude can find them
6. **Include "how to extend"** — step-by-step for common additions

### Recommended docs for most projects

| File | Contents |
|------|----------|
| `architecture.md` | System overview, data model, auth flow, deployment |
| `backend-structure.md` | API routes, DB schema, services layout |
| `frontend-state.md` | State management, contexts/stores, persistence |
| `conventions.md` | Code style rules, naming, common pitfalls |
| `beads-workflow.md` | Beads commands, workflow loop, commit format |

### Domain-specific docs

Add one doc per major subsystem. Examples from Carbonara:

| File | Why it exists |
|------|---------------|
| `calculation-system.md` | Complex multi-step calculation pipeline with taxonomy |
| `property-system.md` | Bidirectional property normalization (Swedish ↔ English) |
| `export-system.md` | Multiple export formats with different data contracts |
| `layer-management.md` | GIS layer UX with colors, grouping, undo/redo |
| `upload-flow.md` | Multi-step wizard with auto-classification |

**Rule of thumb:** If a subsystem has its own conventions, data model, or non-obvious patterns, it deserves its own doc.

### How to write docs efficiently

Don't write docs from scratch. Use Claude Code itself:

```
Read through [subsystem files] and create a reference doc for docs/[name].md
covering: structure, data model, key patterns, extension points, and key files.
Keep it factual and concise — this will be used as AI context.
```

Then review and adjust. The docs should stay accurate — update them when the system changes.

---

## Slash Commands

Slash commands live in `.claude/commands/` and are invoked as `/command-name` in Claude Code. Each is a markdown file with YAML frontmatter.

### plan.md — Plan work into beads

This is the most important command. It structures how Claude plans and registers work.

```markdown
---
description: Plan new work using beads methodology
---

Plan the following work: $ARGUMENTS

## Phase 1: Understand

1. Read the relevant docs from `docs/` to understand the affected domain
2. Explore the codebase — read key files that will be affected, trace data flows
3. If a beads issue already exists, run `bd show <id>` to read context and comments

## Phase 2: Design

Break the work into concrete implementation steps. For each step, define:
- **What**: one clear change (e.g., "Add `new_field` to schema and API endpoint")
- **Where**: which files are affected
- **Done-when**: observable verification (test passes, typecheck clean, UI shows X)
- **Risks/questions**: anything uncertain or needing user input

Keep steps small — each should be a single commit-sized change.

## Phase 3: Register in beads

Choose the right structure based on scope:

**Small work (1-3 steps):** Single issue with steps in description
\`\`\`bash
bd new "Short title" -t task -p 2 \
  --description "What and why.

Steps:
1. Step one — done-when: ...
2. Step two — done-when: ...
3. Step three — done-when: ..."
\`\`\`

**Larger work (4+ steps or multiple concerns):** Epic with child issues
\`\`\`bash
bd new "Epic title" -t epic -p 2 --description "Overall goal and scope"
bd new "Step 1 title" -t task --parent <epic-id> --description "What, where, done-when"
bd new "Step 2 title" -t task --parent <epic-id> --description "What, where, done-when"
bd dep add <step2-id> <step1-id>   # step 2 depends on step 1
\`\`\`

**Priority:** 0=critical, 1=high, 2=medium (default), 3=low, 4=backlog
**Labels:** `area:frontend`, `area:backend`, `type:feature`, `type:bug`

## Phase 4: Present

Show the plan as a numbered summary with:
- Issue IDs created
- Dependency chain (what blocks what)
- Total scope estimate (number of files, rough complexity)
- Any open questions or decisions needed

Do NOT start implementing. Wait for approval.
```

### implement.md — Execute a plan step

```markdown
---
description: Implement a specific step from an existing plan
---

Implement: $ARGUMENTS

Rules:
1. Make minimal changes — only what is required for this step
2. Run relevant tests after the change: `pnpm test` (frontend) or `pytest` (backend)
3. Run typecheck: `tsc --noEmit` (frontend)
4. Do not commit automatically — stage and show the diff first
5. Reference the bead ID in any commit message: `(bd:<id>)`
```

### commit.md — Conventional commit

```markdown
---
description: Create a conventional commit message from staged changes
---

Analyze staged changes (`git diff --staged`) and create a commit message.

Format: `<type>(<scope>): <description> (bd:<id>)`
Types: feat, fix, refactor, docs, test, chore
Scopes: [list your project's scopes, e.g.: frontend, backend, api, db, deps]

Body format (when needed):
\`\`\`
Varför:
  <why this change>

Hur:
  <key implementation details>

Tester:
  <how it was verified>
\`\`\`

If the changes are too large for a single commit, suggest how to split them.
Do not commit — present the message for approval first.
```

### review.md — Code review

```markdown
---
description: Code review with focus on correctness and project conventions
---

Review: $ARGUMENTS

Focus areas:
1. Logical errors and edge cases
2. Security issues (injection, auth bypass, exposed secrets)
3. Type errors and null-safety
4. Adherence to project conventions (see CLAUDE.md):
   - [list your key conventions here]
   - Strict TypeScript — no `any`, no implicit types
   - File size limit: 500 lines

Point to exact file paths and line numbers. Suggest concrete fixes.
```

### debug.md — Systematic debugging

```markdown
---
description: Systematic debugging workflow
---

Debug: $ARGUMENTS

Steps:
1. Reproduce the problem — identify the exact trigger
2. Read error messages carefully — look at stack traces and log output
3. Identify the root cause — do not treat symptoms
4. Propose a fix with reasoning — explain why it solves the root cause
5. Verify the fix works — run relevant tests, check typecheck passes

Do not apply the fix without presenting it first.
```

---

## Settings

### .claude/settings.json (committed, shared with team)

Controls permissions and hooks. The key sections:

```json
{
  "permissions": {
    "allow": [
      "Bash(bd *)",
      "Bash(pnpm *)",
      "Bash(tsc --noEmit)",
      "Bash(git diff*)",
      "Bash(git status)",
      "Bash(git log*)"
    ],
    "deny": []
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "your-typecheck-command-here"
          }
        ]
      }
    ]
  }
}
```

**Permissions:** Pre-approve safe, read-only, and common commands so Claude doesn't prompt for each one. Add your test runner, linter, build commands.

**Hooks:** The PostToolUse hook runs after every Write/Edit and catches type errors immediately. Adapt the command to your project:

```bash
# TypeScript project (frontend)
"command": "cd /path/to/frontend && pnpm exec tsc --noEmit --pretty false 2>&1 | tail -5"

# Python project
"command": "cd /path/to/backend && python -m mypy app/ --no-error-summary 2>&1 | tail -5"
```

The hook runs typecheck only on relevant files (check the file extension in the command) and shows just the last 5 lines to keep output manageable.

### .claude/settings.local.json (gitignored, personal)

For personal permission overrides that shouldn't be shared:

```json
{
  "permissions": {
    "allow": [
      "Bash(some-personal-tool *)"
    ]
  }
}
```

---

## .gitignore

Add these lines to your `.gitignore`:

```gitignore
# Beads issue tracker - local database
.beads/

# Claude Code - personal overrides
CLAUDE.local.md
```

`.claude/settings.local.json` is already gitignored by Claude Code itself.

---

## Beads Integration

Beads (`bd`) is a lightweight issue tracker with first-class dependency support. It lives in your repo as a local database (`.beads/`) and syncs via git.

### Initial setup

```bash
bd init                      # Initialize in project root
bd quickstart                # Interactive guide
```

### Workflow loop

```
1. bd ready                              # Find work without blockers
2. bd show <id>                          # Read details
3. bd update <id> --status in_progress   # Claim it
4. [implement, test, typecheck]
5. git commit -m "feat: ... (bd:<id>)"
6. bd close <id> --reason "Verified"
7. Back to step 1
```

### Key commands

```bash
# Finding work
bd ready                     # Ready issues (no blockers)
bd list                      # All issues
bd list --status open        # Open issues
bd show <id>                 # Full details with dependencies

# Creating work
bd new "Title" -t task -p 2 --description "..."
bd new "Epic" -t epic -p 2 --description "..."
bd new "Child" -t task --parent <epic-id> --description "..."

# Dependencies
bd dep add <issue> <depends-on>    # issue depends on depends-on
bd blocked                          # Show all blocked issues

# Comments (for plans, notes, decisions)
bd comments <id>                    # View comments
bd comments add <id> "Plan: ..."    # Add comment

# Labels
bd label add <id> area:frontend
bd label add <id> type:bug

# Closing
bd close <id> --reason "Done"
bd close <id1> <id2> <id3>          # Close multiple at once

# Sync
bd sync                              # Sync with git
```

### beads-workflow.md for docs/

Create a `docs/beads-workflow.md` that documents your project-specific workflow. Include:

- The workflow loop (ready → show → implement → close)
- Your commit format with `(bd:<id>)`
- Your branch naming convention
- Label taxonomy (`area:*`, `type:*`)
- Priority scale (0-4)

This file is then referenced from CLAUDE.md via `@docs/beads-workflow.md`.

---

## Migration Checklist

Use this when converting an existing project from `AGENTS.md` / `AI_CONTEXT.md` to this structure.

### Step 1: Create the structure

```bash
mkdir -p docs docs/diagrams .claude/commands
```

### Step 2: Write CLAUDE.md

Start with the template from the [CLAUDE.md section](#claudemd). Fill in:

- [ ] Project description (What section)
- [ ] Tech stack
- [ ] Project structure tree
- [ ] Build/test/run commands
- [ ] Code style rules (5-10 most important)
- [ ] Workflow conventions
- [ ] Reference links to docs/ (add as you create the docs)

### Step 3: Extract docs from existing files

If you have an `AGENTS.md` or `AI_CONTEXT.md`, split its contents:

- Architecture / system overview → `docs/architecture.md`
- API routes, DB schema → `docs/backend-structure.md`
- Frontend patterns → `docs/frontend-state.md`
- Code conventions → `docs/conventions.md`
- Domain-specific knowledge → `docs/[domain].md`

You can use Claude Code to help:

```
Read AGENTS.md and AI_CONTEXT.md, then split the content into modular
docs following the structure in CLAUDE.md. Create one doc per major
subsystem. Each doc should be self-contained with: purpose, structure,
data model, key patterns, key files, and how to extend.
```

### Step 4: Create slash commands

Copy the commands from the [Slash Commands section](#slash-commands) and adapt:

- [ ] `plan.md` — adjust labels/scopes for your project
- [ ] `implement.md` — adjust test/typecheck commands
- [ ] `commit.md` — adjust scopes list
- [ ] `review.md` — adjust convention rules
- [ ] `debug.md` — usually works as-is

### Step 5: Configure settings

Create `.claude/settings.json` with:

- [ ] Permission allows for your build/test/lint commands
- [ ] Permission allows for `bd *` (beads)
- [ ] PostToolUse hook for typecheck on Write/Edit (if applicable)

### Step 6: Set up beads

```bash
bd init
bd quickstart
```

Create `docs/beads-workflow.md` with your project's conventions.

### Step 7: Update .gitignore

Add:
```
.beads/
CLAUDE.local.md
```

### Step 8: Clean up old files

Once you've migrated all content:

```bash
git rm AGENTS.md AI_CONTEXT.md  # or whatever the old files were called
```

### Step 9: Verify

Start a new Claude Code session and check:

- [ ] `/plan some feature` produces a structured plan with beads commands
- [ ] `/implement bd-xxx` reads the issue and makes minimal changes
- [ ] `/commit` produces correctly formatted commit messages
- [ ] Typecheck hook fires on file edits (if configured)
- [ ] `bd ready` shows available work

---

## Design Principles

1. **CLAUDE.md is the index, not the encyclopedia.** Keep it under 200 lines. Link to docs for detail.

2. **One doc per concern.** Don't create a mega-doc. Split by subsystem so only relevant context is loaded.

3. **Write for modification, not just understanding.** Every doc should include "how to add a new X" — that's what Claude Code actually needs.

4. **Commands encode workflow, not knowledge.** Slash commands define *process* (phases, verification steps). Domain knowledge lives in docs.

5. **Hooks prevent mistakes automatically.** A typecheck hook after every edit catches errors before they compound.

6. **Beads is the single source of truth for tasks.** No todo lists in prompts, no markdown task files. Everything goes through `bd`.

7. **@-references give you lazy loading.** Reference 10 docs in CLAUDE.md but Claude only gets them in context when the conversation starts — it costs tokens but saves hallucination.
