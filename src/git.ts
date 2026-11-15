/**
 * Everything that shells out to git, plus the one pure parser that turns a
 * remote URL into a Pi `git:` package source.
 *
 * Every command runs against an explicit cwd: `/source` acts on the repository
 * the session starts in, which is not necessarily the process working directory.
 */

export interface ExecOutput {
	stdout: string;
	stderr: string;
	code: number;
}

export interface ExecOptions {
	timeout: number;
	cwd?: string;
}

export type Exec = (command: string, args: string[], options: ExecOptions) => Promise<ExecOutput>;

const GIT_TIMEOUT_MS = 5_000;

async function run(exec: Exec, args: string[], cwd: string): Promise<string | undefined> {
	const result = await exec("git", args, { cwd, timeout: GIT_TIMEOUT_MS });
	const text = result.stdout.trim();
	return result.code === 0 && text ? text : undefined;
}

function plural(count: number, word: string): string {
	return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** `git@github.com:owner/repo.git` or `https://host/owner/repo.git` -> `host/owner/repo`. */
export function remotePath(url: string): string {
	const cleaned = url.trim().replace(/\/+$/, "").replace(/\.git$/, "");
	const scp = cleaned.match(/^[^@/]+@([^:/]+):(.+)$/);
	if (scp) return `${scp[1]}/${scp[2]}`;
	try {
		const parsed = new URL(cleaned);
		if (parsed.host && parsed.pathname !== "/") return `${parsed.host}${parsed.pathname}`.replace(/\/+$/, "");
	} catch {
		// not a URL: fall through
	}
	return cleaned;
}

/** Top of the checkout containing `cwd`; `cwd` itself when it is not in a repository. */
export async function repoRoot(exec: Exec, cwd: string): Promise<string> {
	return (await run(exec, ["rev-parse", "--show-toplevel"], cwd)) ?? cwd;
}

/** `git:host/owner/repo` for `origin`, or `""` when there is no origin remote. */
export async function originSource(exec: Exec, cwd: string): Promise<string> {
	const remote = await run(exec, ["remote", "get-url", "origin"], cwd);
	return remote ? `git:${remotePath(remote)}` : "";
}

/**
 * What a `github` install would leave behind: commits that exist only in this
 * checkout, and uncommitted edits. Undefined when the checkout is clean, and
 * when there is no upstream to compare against.
 */
export async function workNote(exec: Exec, cwd: string): Promise<string | undefined> {
	const parts: string[] = [];

	const upstream = await run(exec, ["rev-parse", "--abbrev-ref", "@{upstream}"], cwd);
	if (upstream) {
		const ahead = Number(await run(exec, ["rev-list", "--count", "@{upstream}..HEAD"], cwd));
		if (Number.isFinite(ahead) && ahead > 0) parts.push(`${plural(ahead, "commit")} ahead of ${upstream}`);
	}

	const status = await exec("git", ["status", "--porcelain"], { cwd, timeout: GIT_TIMEOUT_MS });
	if (status.code === 0) {
		const dirty = status.stdout.split("\n").filter((line) => line.trim()).length;
		if (dirty > 0) parts.push(`${plural(dirty, "dirty file")}`);
	}

	return parts.length > 0 ? parts.join(", ") : undefined;
}
