/**
 * The vocabulary and the decision. Nothing here touches the filesystem, runs a
 * command, or imports pi: `planSwitch` is a pure function of a `State`, which
 * is what lets the test suite cover the ordering invariant without a harness.
 */

import { basename } from "node:path";

/** The identity to end up with. `none` ends with no entry at all. */
export type Mode = "local" | "github" | "none";

export interface State {
	/** Top of the checkout, taken from `git rev-parse --show-toplevel`. */
	repoRoot: string;
	/** `git:host/owner/repo` derived from `origin`; `""` when absent. */
	gitSource: string;
	local: boolean;
	github: boolean;
	/** Stored declaration strings, for reporting. */
	localEntry?: string;
	githubEntry?: string;
	/** Whether the checkout root is something pi would install. */
	hasManifest: boolean;
	/** Commits and edits a `github` install would not contain. */
	note?: string;
}

export interface Step {
	command: string;
	args: string[];
	timeout: number;
}

export const INSTALL_TIMEOUT_MS = 120_000;
export const REMOVE_TIMEOUT_MS = 30_000;

function piBinary(): string {
	return basename(process.execPath) === "pi" ? process.execPath : "pi";
}

function installStep(target: string): Step {
	return { command: piBinary(), args: ["install", target], timeout: INSTALL_TIMEOUT_MS };
}

function removeStep(target: string): Step {
	return { command: piBinary(), args: ["remove", target], timeout: REMOVE_TIMEOUT_MS };
}

/**
 * For the switching modes, install before removing: reversing the order leaves
 * nothing installed when the install fails, and pi keys a git package by URL and
 * a local package by resolved path, so the two entries are otherwise
 * indistinguishable to it.
 *
 * `none` has no install step, so its plan is removes only, and it is not gated
 * on `hasManifest` or on an origin remote: neither is needed to uninstall, and a
 * checkout whose `pi` key was deleted is exactly the one that still needs
 * removing.
 *
 * Returns the empty array when the requested mode is already the only one — or,
 * for `none`, when nothing is installed.
 */
export function planSwitch(state: State, mode: Mode): Step[] | { error: string } {
	if (mode === "none") {
		const steps: Step[] = [];
		if (state.local) steps.push(removeStep(state.repoRoot));
		if (state.github) steps.push(removeStep(state.gitSource));
		return steps;
	}

	const repo = basename(state.repoRoot);

	if (!state.hasManifest) {
		return { error: `${repo} is not a Pi package (no package.json "pi" key, no resource directories)` };
	}
	if (mode === "github" && !state.gitSource) {
		return { error: "no git remote origin — cannot install from github" };
	}

	const steps: Step[] = [];
	const installed = mode === "github" ? state.github : state.local;
	const other = mode === "github" ? state.local : state.github;

	if (!installed) steps.push(installStep(mode === "github" ? state.gitSource : state.repoRoot));
	if (other) steps.push(removeStep(mode === "github" ? state.repoRoot : state.gitSource));
	return steps;
}

function suffix(state: State): string {
	return state.note ? ` · ${state.note}` : "";
}

/** One line, ready for `ctx.ui.notify`. */
export function describe(state: State): string {
	const repo = basename(state.repoRoot);
	if (state.local && state.github) {
		return `installed from local (${repo}) and ${state.gitSource} — /source <local|github> to switch${suffix(state)}`;
	}
	if (state.local) return `installed from local (${repo}) — /source github to switch${suffix(state)}`;
	if (state.github) return `installed from ${state.gitSource} — /source local to switch${suffix(state)}`;
	return `not installed — /source local or /source github${suffix(state)}`;
}

function quote(value: string): string {
	return /^[\w./:@~^-]+$/.test(value) ? value : `'${value.replace(/'/g, "'\\''")}'`;
}

/** The plan as shell fragments, so a dry run can be copy-pasted. */
export function renderPlan(steps: Step[]): string {
	return steps.map((step) => [step.command, ...step.args].map(quote).join(" ")).join(" → ");
}
