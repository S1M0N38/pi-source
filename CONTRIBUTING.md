# Contributing

## Development

`pi-source` develops itself: once it is installed, `/source` in this repository switches *this* repository between the clone and the checkout.

For a fresh clone, before it is installed, run Pi with the extension for one session:

```sh
pi -e ./pi-source
```

Then:

```
/source local     # install this checkout, remove the git entry, reload
/source github    # back to the published clone
/source none      # remove both entries, reload — /source is gone from the session
/source           # report what is installed now
```

Only one entry can exist: Pi keys a git package by repository URL and a local package by resolved absolute path, so both together register `/source` twice.

<details>
<summary>Manual equivalent</summary>

```sh
pi remove git:github.com/S1M0N38/pi-source
pi install ~/Code/github.com/S1M0N38/pi-source
```

</details>

Then:

```sh
npm install         # typescript and @types/node only
npm run typecheck   # tsc --noEmit
npm test            # node --test, no fixtures
```

`/reload` in a session picks up edits. Commit with conventional messages (`feat:`, `fix:`, `docs:`, `chore:`).

## Tests

Fourteen assertions over the pure functions, and nothing else: `remotePath` across the remote URL forms, and `planSwitch` for every installed/requested combination — including `none`, which skips the two refusals — plus both refusals. No git, no pi, no temporary directories.

Behaviour that needs a real repository — resolving a stored local entry, the ahead/dirty note — is verified by hand, outside the suite. Keep it that way: a harness that stands up git and settings fixtures would be larger than the extension.

## Notes

- The local entry in `settings.json` is relative to the agent dir: machine-local, never commit or copy it between machines.
- `/source` reads the checkout's own git state, so an uncommitted `src/` change is visible to `/source` but not to a `github` install — that is what the note in the report is for.
- `pi -e ./pi-source` skips the settings change for one run, but a git install must still be removed — same identity rule.

## Architecture

Internals live in [ARCHITECTURE.md](ARCHITECTURE.md): the two identities, the plan/execute split and why `planSwitch` is pure, how a `settings.json` entry is resolved, and the subprocess table.
