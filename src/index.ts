/**
 * `/source` — show or switch where the checkout in this session is installed
 * from: the local working copy, or the published git clone.
 *
 *   /source                    report the current state
 *   /source local              install this checkout's path, remove the git entry
 *   /source github             install git:<origin>, remove the local entry
 *   /source <mode> --dry-run   print the commands instead of running them
 *
 * Both values come from the checkout, never from configuration: the local path
 * is the git toplevel, the git source is `host/owner/repo` parsed from `origin`.
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem } from "@earendil-works/pi-tui";
import type { Exec, ExecOptions, ExecOutput } from "./git.ts";
import { type Mode, type State, describe, planSwitch, renderPlan } from "./plan.ts";
import { resolveState } from "./state.ts";

const USAGE = "usage: /source [local|github] [--dry-run]";
const VALUES = ["local", "github", "--dry-run"];

interface Parsed {
	mode?: Mode;
	dryRun: boolean;
}

function parse(args: string): Parsed | { error: string } {
	const tokens = args.trim().split(/\s+/).filter(Boolean);
	if (tokens.some((token) => !VALUES.includes(token))) return { error: USAGE };

	const modes = tokens.filter((token): token is Mode => token === "local" || token === "github");
	if (modes.length > 1) return { error: USAGE };

	const dryRun = tokens.includes("--dry-run");
	if (modes.length === 0 && dryRun) return { error: USAGE };

	const mode = modes[0];
	return { ...(mode !== undefined ? { mode } : {}), dryRun };
}

function firstLine(text: string): string {
	return text.split("\n").find((line) => line.trim()) ?? "(no output)";
}

/**
 * Completes both the mode and the flag. Modes are mutually exclusive, so once
 * one is on the line the other is no longer offered.
 */
function completions(prefix: string): AutocompleteItem[] | null {
	const trailing = /\s$/.test(prefix);
	const tokens = prefix.trim().split(/\s+/).filter(Boolean);
	const partial = trailing ? "" : (tokens[tokens.length - 1] ?? "");
	const used = trailing ? tokens : tokens.slice(0, -1);
	const modeUsed = used.some((token) => token === "local" || token === "github");

	const items = VALUES.filter((value) => !used.includes(value))
		.filter((value) => !(modeUsed && (value === "local" || value === "github")))
		.filter((value) => value.startsWith(partial))
		.map((value) => ({
			value: [...used, value].join(" "),
			label: value,
		}));
	return items.length > 0 ? items : null;
}

async function switchTo(
	mode: Mode,
	state: State,
	dryRun: boolean,
	exec: Exec,
	ctx: ExtensionCommandContext,
): Promise<void> {
	const plan = planSwitch(state, mode);
	if ("error" in plan) {
		ctx.ui.notify(plan.error, "error");
		return;
	}
	if (plan.length === 0) {
		ctx.ui.notify(`already installed from ${mode}`, "info");
		return;
	}

	const suffix = state.note ? ` · ${state.note}` : "";
	if (dryRun) {
		ctx.ui.notify(`dry run: ${renderPlan(plan)}${suffix}`, "info");
		return;
	}

	for (const step of plan) {
		const result = await exec(step.command, step.args, { timeout: step.timeout, cwd: ctx.cwd });
		if (result.code !== 0) {
			ctx.ui.notify(`${step.args[0]} failed: ${firstLine(result.stderr || result.stdout)}`, "error");
			return;
		}
	}

	ctx.ui.notify(`switched to ${mode} — reloading${suffix}`, "info");
	await ctx.reload();
}

export default function sourceCommand(pi: ExtensionAPI): void {
	const exec: Exec = (command: string, args: string[], options: ExecOptions): Promise<ExecOutput> =>
		pi.exec(command, args, options);

	pi.registerCommand("source", {
		description: "Show or switch where this checkout is installed from (local or github)",
		getArgumentCompletions: completions,
		handler: async (args, ctx) => {
			const parsed = parse(args);
			if ("error" in parsed) {
				ctx.ui.notify(parsed.error, "error");
				return;
			}

			const state = await resolveState(exec, ctx.cwd);
			if (parsed.mode === undefined) {
				ctx.ui.notify(describe(state), "info");
				return;
			}

			await switchTo(parsed.mode, state, parsed.dryRun, exec, ctx);
		},
	});
}
