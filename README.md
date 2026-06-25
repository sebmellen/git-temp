# git-temp

Purpose: create a local AI scratchpad inside a Git repo without committing it.

`git-temp` makes a `temp/` folder, adds it to `.git/info/exclude`, and keeps it visible to editors and AI tools. That means no noisy `git status`, no accidental commits, and no `.gitignore` rule that hides files from indexing or `@` tagging.

## Use

```bash
npx git-temp            # creates temp/
npx git-temp notes      # creates notes/
npx git-temp status     # shows hidden scratchpad contents
npx git-temp clean -f   # empties and recreates temp/
npx git-temp integrate  # updates existing agent instruction files
```

## What it creates

- `temp/scripts/` for one-off scripts
- `temp/dumps/` for JSON, CSV, logs, and payloads
- `temp/drafts/` for notes and draft specs
- `temp/scratch/` for experiments
- `temp/README.md` explaining the folder to humans and AI agents

## Intention list

- Keep scratch work searchable and taggable by AI/editor tooling.
- Ignore scratch work locally through `.git/info/exclude`, not shared `.gitignore`.
- Avoid committing temporary files by accident.
- Remove blocking nested `temp/.gitignore` files that contain `*` or `/*`.
- Stay zero-dependency and fast under `npx`.

## Commands

### Initialize

```bash
git-temp [directory] [--integrate]
```

Creates the scratchpad, subfolders, README, and local exclude entry.

### Status

```bash
git-temp status [directory]
```

Shows file count, directory count, size, and modified times for files Git now hides.

### Clean

```bash
git-temp clean [directory] [--force]
```

Deletes scratchpad contents, then recreates the standard structure.

### Integrate

```bash
git-temp integrate [directory]
```

Appends an AI scratchpad guideline to existing instruction files only:

- `AGENTS.md`
- `CLAUDE.md`
- `.cursorrules`
- `.windsurfrules`
- `.github/copilot-instructions.md`

## Requirements

- Node.js 18+
- Git
- Run inside a Git repository
