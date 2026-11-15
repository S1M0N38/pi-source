/**
 * The vocabulary and the decision. Nothing here touches the filesystem, runs a
 * command, or imports pi: `planSwitch` is a pure function of a `State`, which
 * is what lets the test suite cover the ordering invariant without a harness.
 */

import { basename } from "node:path";

export type Mode = "local" | "github";

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

/**
 * Install before removing, always: reversing the order leaves nothing installed
 * when the install fails, and pi keys a git package by URL and a local package
 * by resolved path, so the two entries are otherwise indistinguishable to it.
 *
 * Returns the empty array when the requested mode is already the only one.
 */
export function planSwitch(state: State, mode: Mode): Step[] | { error: string } {
	const repo = basename(state.repoRoot);

	if (!state.hasManifest) {
		return { error: `${repo} is not a Pi package (no package.json "pi" key, no resource directories)` };
	}
	if (mode === "github" && !state.gitSource) {
		return { error: "no git remote origin — cannot install from github" };
	}

	const installed = mode === "github" ? state.github : state.local;
	const other = mode === "github" ? state.local : state.github;
	const target = mode === "github" ? state.gitSource : state.repoRoot;
	const otherTarget = mode === "github" ? state.repoRoot : state.gitSource;

	const steps: Step[] = [];
	if (!installed) steps.push({ command: piBinary(), args: ["install", target], timeout: INSTALL_TIMEOUT_MS });
	if (other) steps.push({ command: piBinary(), args: ["remove", otherTarget], timeout: REMOVE_TIMEOUT_MS });
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
