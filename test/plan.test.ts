import assert from "node:assert/strict";
import { test } from "node:test";
import { remotePath } from "../src/git.ts";
import { type State, describe, planSwitch, renderPlan } from "../src/plan.ts";

const ROOT = "/Users/simo/Code/github.com/S1M0N38/pi-source";
const GIT = "git:github.com/S1M0N38/pi-source";

function state(overrides: Partial<State> = {}): State {
	return {
		repoRoot: ROOT,
		gitSource: GIT,
		local: false,
		github: false,
		hasManifest: true,
		...overrides,
	};
}

/** [["install", ROOT], ["remove", GIT], ...] for readable assertions. */
function steps(result: ReturnType<typeof planSwitch>): string[][] {
	assert.ok(Array.isArray(result), `expected steps, got error: ${JSON.stringify(result)}`);
	return result.map((step) => step.args);
}

function error(result: ReturnType<typeof planSwitch>): string {
	assert.ok(!Array.isArray(result), `expected an error, got steps: ${JSON.stringify(result)}`);
	return result.error;
}

test("remotePath normalises every remote form to host/owner/repo", () => {
	for (const url of [
		"git@github.com:S1M0N38/pi-source.git",
		"https://github.com/S1M0N38/pi-source.git",
		"https://github.com/S1M0N38/pi-source",
		"https://github.com/S1M0N38/pi-source/",
		"ssh://git@github.com/S1M0N38/pi-source",
		"git://github.com/S1M0N38/pi-source.git",
	]) {
		assert.equal(remotePath(url), "github.com/S1M0N38/pi-source", url);
	}
});

test("local switches install the checkout and remove the git entry, in that order", () => {
	assert.deepEqual(steps(planSwitch(state({ github: true }), "local")), [
		["install", ROOT],
		["remove", GIT],
	]);
});

test("github switches install the git source and remove the checkout, in that order", () => {
	assert.deepEqual(steps(planSwitch(state({ local: true }), "github")), [
		["install", GIT],
		["remove", ROOT],
	]);
});

test("a first install needs one step", () => {
	assert.deepEqual(steps(planSwitch(state(), "local")), [["install", ROOT]]);
	assert.deepEqual(steps(planSwitch(state(), "github")), [["install", GIT]]);
});

test("the requested mode alone needs no steps", () => {
	assert.deepEqual(steps(planSwitch(state({ local: true }), "local")), []);
	assert.deepEqual(steps(planSwitch(state({ github: true }), "github")), []);
});

test("both installed heals by removing the other entry", () => {
	assert.deepEqual(steps(planSwitch(state({ local: true, github: true }), "local")), [["remove", GIT]]);
	assert.deepEqual(steps(planSwitch(state({ local: true, github: true }), "github")), [["remove", ROOT]]);
});

test("none removes both entries and installs nothing", () => {
	assert.deepEqual(steps(planSwitch(state({ local: true, github: true }), "none")), [
		["remove", ROOT],
		["remove", GIT],
	]);
});

test("none removes whichever entry exists", () => {
	assert.deepEqual(steps(planSwitch(state({ local: true }), "none")), [["remove", ROOT]]);
	assert.deepEqual(steps(planSwitch(state({ github: true }), "none")), [["remove", GIT]]);
});

test("none with nothing installed needs no steps", () => {
	assert.deepEqual(steps(planSwitch(state(), "none")), []);
});

test("none does not require an origin remote or a pi manifest", () => {
	assert.deepEqual(steps(planSwitch(state({ gitSource: "", hasManifest: false, local: true }), "none")), [
		["remove", ROOT],
	]);
});

test("refuses github without an origin remote", () => {
	assert.match(error(planSwitch(state({ gitSource: "" }), "github")), /no git remote origin/);
});

test("refuses a directory pi would not install", () => {
	assert.match(error(planSwitch(state({ hasManifest: false }), "local")), /is not a Pi package/);
});

test("renderPlan prints one copy-pasteable line in execution order", () => {
	const rendered = renderPlan(planSwitch(state({ local: true }), "github") as never);
	assert.ok(rendered.includes(`install ${GIT}`), rendered);
	assert.ok(rendered.includes(`remove ${ROOT}`), rendered);
	assert.ok(rendered.indexOf("install") < rendered.indexOf("remove"), rendered);
	assert.ok(!rendered.includes("\n"), rendered);
});

test("describe names both entries when both are installed", () => {
	const line = describe(state({ local: true, github: true, note: "2 commits ahead of origin/main" }));
	assert.match(line, /local \(pi-source\) and git:github\.com/);
	assert.match(line, /· 2 commits ahead of origin\/main/);
});
