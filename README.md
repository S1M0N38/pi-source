# pi-source

Switch a Pi package checkout between the two ways Pi can load it: **the local working copy** and **the git clone** — or remove both.

Pi keys a git package by repository URL and a local package by resolved absolute path, so installing both loads the extension twice. `/source` exists to keep exactly one of them.

```
/source                    # where is this checkout installed from?
/source local              # install this checkout, remove the git entry
/source github             # install git:<origin>, remove the local entry
/source none               # remove both entries
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

| Installed | `/source local` | `/source github` | `/source none` |
|---|---|---|---|
| neither | install checkout | install `git:<origin>` | — already |
| local only | — already | install git, remove checkout | remove checkout |
| github only | install checkout, remove git | — already | remove git |
| both | remove git | remove checkout | remove both |

Install always precedes remove: if the install fails, the entry you had is still there. If the remove then fails, both entries remain, `/source` says so, and re-running the same mode heals it.

`none` has no install step, so its plan is removes only. The same failure rule applies: a failed remove leaves the other entry in place, `/source` names it, and re-running `/source none` heals it. It is not gated on an origin remote or on a Pi manifest — a checkout whose `pi` key you deleted is exactly the one that still needs removing.

`/source none` removes this extension too, so the reload that follows unloads `/source` from the session. Reinstalling afterwards means `pi install`.

Refused, with a message rather than a guess:

- `/source github` in a repository with no `origin` remote.
- Any switch in a directory Pi would not install — no `pi` key in `package.json` and no `extensions/`, `skills/`, `prompts/` or `themes/` directory.

## Limits

- **The git toplevel, always.** In a monorepo, `/source local` from a nested package installs the repository root, not the package. One repository is one Pi package.
- **`origin` only.** There is no flag to pick another remote.
- **This checkout only.** `/source none` removes the entries derived from the checkout in the session — the local path and the `origin` source. A package installed from `npm:`, `builtin:` or another directory is not touched, and you cannot uninstall a package you are not standing in.
- **No ref pinning.** `github` installs the bare source, so it tracks the remote's default branch.
