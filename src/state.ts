/**
 * What is installed right now. Reads pi's `settings.json` the same way pi does:
 * a local declaration is stored relative to the settings file, so it has to be
 * resolved against the agent dir and canonicalised before it can be compared
 * with the checkout path.
 */

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { type Exec, originSource, repoRoot, workNote } from "./git.ts";
import type { State } from "./plan.ts";

const SOURCE_PREFIX = /^(?:git:|npm:|https?:|builtin:)/;
const RESOURCE_DIRS = ["extensions", "skills", "prompts", "themes"];

/**
 * A directory is installable when pi would find something in it: a `pi` key in
 * `package.json`, or the conventional resource directories. Both are legal, so
 * only a directory with neither is refused.
 */
export function hasPiManifest(dir: string): boolean {
	try {
		const parsed = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8")) as { pi?: unknown };
		if (parsed.pi !== undefined && parsed.pi !== null) return true;
	} catch {
		// no package.json, or unreadable JSON: fall through to the directories
	}
	return RESOURCE_DIRS.some((name) => existsSync(join(dir, name)));
}

function readPackages(settingsPath: string): string[] {
	try {
		const parsed = JSON.parse(readFileSync(settingsPath, "utf-8")) as { packages?: unknown };
		if (!Array.isArray(parsed.packages)) return [];
		return parsed.packages.flatMap((entry) => {
			if (typeof entry === "string") return [entry];
			const source = (entry as { source?: unknown } | null)?.source;
			return typeof source === "string" ? [source] : [];
		});
	} catch {
		return [];
	}
}

function resolveEntry(entry: string, settingsDir: string): string {
	if (entry === "~") return homedir();
	if (entry.startsWith("~/")) return join(homedir(), entry.slice(2));
	return resolve(settingsDir, entry);
}

function realPath(path: string): string {
	try {
		return realpathSync(path);
	} catch {
		return resolve(path);
	}
}

export async function resolveState(exec: Exec, cwd: string): Promise<State> {
	const root = await repoRoot(exec, cwd);
	const gitSource = await originSource(exec, cwd);
	const settingsDir = getAgentDir();
	const entries = readPackages(join(settingsDir, "settings.json"));
	const checkout = realPath(root);

	const localEntry = entries.find(
		(entry) => !SOURCE_PREFIX.test(entry) && realPath(resolveEntry(entry, settingsDir)) === checkout,
	);
	const githubEntry = gitSource
		? entries.find((entry) => entry === gitSource || entry.startsWith(`${gitSource}@`))
		: undefined;
	const note = await workNote(exec, cwd);

	return {
		repoRoot: root,
		gitSource,
		local: localEntry !== undefined,
		github: githubEntry !== undefined,
		hasManifest: hasPiManifest(root),
		...(localEntry !== undefined ? { localEntry } : {}),
		...(githubEntry !== undefined ? { githubEntry } : {}),
		...(note !== undefined ? { note } : {}),
	};
}
