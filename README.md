# pi-source

Switch a Pi package checkout between the two ways Pi can load it: **the local working copy** and **the git clone**.

Pi keys a git package by repository URL and a local package by resolved absolute path, so installing both loads the extension twice. `/source` exists to keep exactly one of them.

```
/source                    # where is this checkout installed from?
/source local              # install this checkout, remove the git entry
/source github             # install git:<origin>, remove the local entry
/source local --dry-run    # print the commands, change nothing
```

## Install

```bash
pi install git:github.com/S1M0N38/pi-source
```

Or, to run a checkout you already have:

```bash
pi install ~/Code/github.com/S1M0N38/pi-source
```

Not on npm. Nothing else to configure — no config file, no settings.

## What it derives

Both values come from the checkout in the session, never from configuration:

| Value | Source |
|---|---|
| local path | `git rev-parse --show-toplevel` — the repository root, not the current directory |
| git source | `git:host/owner/repo`, parsed from `git remote get-url origin` |

`git@github.com:owner/repo.git`, `https://github.com/owner/repo.git`, `ssh://git@github.com/owner/repo` and `git://…` all normalise to the same source, which is why a clone over SSH still matches an entry installed over HTTPS.

Before switching to `github` it reports what the clone would *not* contain — commits ahead of upstream, uncommitted files — because a git install is a fresh clone of the remote.

## Behaviour

| Installed | `/source local` | `/source github` |
|---|---|---|
| neither | install checkout | install `git:<origin>` |
| local only | — already | install git, remove checkout |
| github only | install checkout, remove git | — already |
| both | remove git | remove checkout |

Install always precedes remove: if the install fails, the entry you had is still there. If the remove then fails, both entries remain, `/source` says so, and re-running the same mode heals it.

Refused, with a message rather than a guess:

- `/source github` in a repository with no `origin` remote.
- Any switch in a directory Pi would not install — no `pi` key in `package.json` and no `extensions/`, `skills/`, `prompts/` or `themes/` directory.

## Limits

- **The git toplevel, always.** In a monorepo, `/source local` from a nested package installs the repository root, not the package. One repository is one Pi package.
- **`origin` only.** There is no flag to pick another remote.
- **No ref pinning.** `github` installs the bare source, so it tracks the remote's default branch.
