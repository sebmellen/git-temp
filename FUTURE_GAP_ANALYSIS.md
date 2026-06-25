# Future gap analysis

Private planning notes for later, not required for the first useful version.

## Possible gaps

- Package name availability on npm is unknown.
- `clean` recreates the standard README after deleting contents; add `--keep-readme` only if users ask.
- `status` uses modified time only; add created time if a target platform exposes it reliably.
- Integrations append to existing files only; add `--create` if people want missing instruction files generated.
- No Windows CI yet; logic uses Node path APIs, but shell install/link behavior should be checked there.
- No publish workflow; add one when this is actually released to npm.
- No config file; keep it that way unless repeated custom directory structures become real demand.

## Later checks

- Test in a worktree and submodule.
- Verify behavior with `.git` file indirection, not only `.git/` directory.
- Confirm common editors index `.git/info/exclude` ignored files as intended.
