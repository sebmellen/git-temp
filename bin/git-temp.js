#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { existsSync, realpathSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_DIR = 'temp';
const SUBDIRS = ['scripts', 'dumps', 'drafts', 'scratch'];
const INSTRUCTION_FILES = [
  'AGENTS.md',
  'CLAUDE.md',
  '.cursorrules',
  '.windsurfrules',
  '.github/copilot-instructions.md',
];

if (isCliEntry()) {
  main().catch((error) => {
    console.error(`git-temp: ${error.message}`);
    process.exit(1);
  });
}

function isCliEntry(argvPath = process.argv[1]) {
  try {
    return Boolean(argvPath) && realpathSync(argvPath) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.command === 'init') return initScratchpad(parsed.dir || DEFAULT_DIR, { integrate: parsed.integrate });
  if (parsed.command === 'status') return status(parsed.dir || DEFAULT_DIR);
  if (parsed.command === 'clean') return clean(parsed.dir || DEFAULT_DIR, parsed.force);
  if (parsed.command === 'integrate') return integrate(parsed.dir || DEFAULT_DIR);
  printHelp();
}

function parseArgs(args) {
  const unknown = args.find((arg) => arg.startsWith('-') && !['--integrate', '--force', '-f', '--help', '-h'].includes(arg));
  if (unknown) throw new Error(`unknown option: ${unknown}`);
  if (args.includes('--help') || args.includes('-h') || args[0] === 'help') return { command: 'help' };

  const positionals = args.filter((arg) => !arg.startsWith('-'));
  const command = positionals[0];

  if (!command || command === 'init' || !['status', 'clean', 'integrate'].includes(command)) {
    return { command: 'init', dir: command === 'init' ? positionals[1] : command, integrate: args.includes('--integrate') };
  }

  return { command, dir: positionals[1], force: args.includes('--force') || args.includes('-f') };
}

async function initScratchpad(dir, options = {}) {
  const root = gitRoot();
  const relativeDir = cleanRelative(dir);
  const absoluteDir = path.join(root, relativeDir);

  await fs.mkdir(absoluteDir, { recursive: true });
  await Promise.all(SUBDIRS.map((subdir) => fs.mkdir(path.join(absoluteDir, subdir), { recursive: true })));
  await fs.writeFile(path.join(absoluteDir, 'README.md'), scratchpadReadme(relativeDir));
  await removeBlockingGitignore(absoluteDir);
  await ensureExcluded(root, relativeDir);
  if (options.integrate) await integrate(relativeDir);

  console.log(`Ready: ${relativeDir}/ is ignored via .git/info/exclude and visible to editors.`);
}

async function status(dir) {
  const root = gitRoot();
  const relativeDir = cleanRelative(dir);
  const absoluteDir = path.join(root, relativeDir);

  if (!existsSync(absoluteDir)) throw new Error(`${relativeDir}/ does not exist`);

  const entries = await walk(absoluteDir);
  const files = entries.filter((entry) => entry.stats.isFile());
  const dirs = entries.filter((entry) => entry.stats.isDirectory());
  const bytes = files.reduce((sum, entry) => sum + entry.stats.size, 0);

  console.log(`Scratchpad: ${relativeDir}/`);
  console.log(`Files: ${files.length}  Directories: ${dirs.length}  Size: ${formatBytes(bytes)}`);
  for (const file of files) {
    console.log(`${path.relative(absoluteDir, file.path)}  modified ${file.stats.mtime.toISOString()}`);
  }
}

async function clean(dir, force) {
  const root = gitRoot();
  const relativeDir = cleanRelative(dir);
  const absoluteDir = path.join(root, relativeDir);

  if (!existsSync(absoluteDir)) return console.log(`Nothing to clean: ${relativeDir}/ does not exist.`);
  if (!force) {
    const rl = createInterface({ input, output });
    const answer = await rl.question(`Delete everything inside ${relativeDir}/? [y/N] `);
    rl.close();
    if (!/^y(es)?$/i.test(answer.trim())) return console.log('Aborted.');
  }

  for (const name of await fs.readdir(absoluteDir)) await fs.rm(path.join(absoluteDir, name), { recursive: true, force: true });
  await initScratchpad(relativeDir);
  console.log(`Cleaned: ${relativeDir}/`);
}

async function integrate(dir) {
  const root = gitRoot();
  const relativeDir = cleanRelative(dir);
  const snippet = instructionSnippet(relativeDir);
  let changed = 0;

  for (const file of INSTRUCTION_FILES) {
    const target = path.join(root, file);
    if (!existsSync(target)) continue;
    const current = await fs.readFile(target, 'utf8');
    if (current.includes('### AI Scratchpad Guideline')) continue;
    await fs.appendFile(target, `${current.endsWith('\n') ? '' : '\n'}\n${snippet}\n`);
    changed += 1;
  }

  console.log(changed ? `Updated ${changed} instruction file(s).` : 'No instruction files needed changes.');
}

function gitRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    throw new Error('not inside a Git repository');
  }
}

function cleanRelative(dir) {
  const raw = dir || DEFAULT_DIR;
  if (path.isAbsolute(raw)) throw new Error('directory must be inside the repository');
  const normalized = path.normalize(raw).replace(/^[/\\]+|[/\\]+$/g, '');
  if (!normalized || normalized === '.' || normalized.startsWith('..')) throw new Error('directory must be inside the repository');
  return normalized;
}

async function ensureExcluded(root, relativeDir) {
  const exclude = path.join(root, '.git', 'info', 'exclude');
  const line = `${relativeDir}/`;
  const current = existsSync(exclude) ? await fs.readFile(exclude, 'utf8') : '';
  const entries = current.split(/\r?\n/).map((entry) => entry.trim());
  if (!entries.includes(line) && !entries.includes(relativeDir)) await fs.appendFile(exclude, `${current.endsWith('\n') || !current ? '' : '\n'}${line}\n`);
}

async function removeBlockingGitignore(dir) {
  const file = path.join(dir, '.gitignore');
  if (!existsSync(file)) return;
  const current = await fs.readFile(file, 'utf8');
  if (current.split(/\r?\n/).some((line) => ['*', '/*'].includes(line.trim()))) await fs.rm(file);
}

async function walk(dir) {
  const names = await fs.readdir(dir);
  const entries = await Promise.all(names.map(async (name) => {
    const entryPath = path.join(dir, name);
    const stats = await fs.stat(entryPath);
    return [{ path: entryPath, stats }, ...(stats.isDirectory() ? await walk(entryPath) : [])];
  }));
  return entries.flat();
}

function scratchpadReadme(dir) {
  return `# ${dir}/ scratchpad\n\nLocal workspace for temporary AI/editor-visible files. Git ignores this folder through \`.git/info/exclude\`, not \`.gitignore\`, so files stay searchable and @-taggable without cluttering commits.\n\n- \`scripts/\` quick one-off scripts\n- \`dumps/\` JSON, CSV, logs, and payloads\n- \`drafts/\` notes, specs, and prose drafts\n- \`scratch/\` experiments\n\nDo not commit this directory unless you intentionally remove it from local exclude.\n`;
}

function instructionSnippet(dir) {
  return `### AI Scratchpad Guideline\nYou have a local scratchpad folder at \`./${dir}/\`.\n- It is locally ignored by Git via \`.git/info/exclude\` but is fully visible and taggable in this workspace.\n- Always use \`./${dir}/\` for temporary scripts, file dumps, spec drafts, CSV exports, or scratch code.\n- Do NOT create scratch files in the root directory or standard source folders.`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function printHelp() {
  console.log(`Usage:\n  git-temp [directory] [--integrate]\n  git-temp status [directory]\n  git-temp clean [directory] [--force]\n  git-temp integrate [directory]`);
}

export { cleanRelative, formatBytes, instructionSnippet, isCliEntry, parseArgs, scratchpadReadme };
