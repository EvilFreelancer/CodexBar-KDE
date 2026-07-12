// BDD tests for package/contents/code/parser.js
// Run with: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const parser = require("../package/contents/code/parser.js");

const CODEX_PAYLOAD = {
    provider: "codex",
    version: "0.144.1",
    source: "oauth",
    credits: { remaining: 12.5, updatedAt: "2026-07-12T21:12:53Z" },
    usage: {
        accountEmail: "user@example.com",
        loginMethod: "plus",
        primary: null,
        secondary: {
            usedPercent: 37,
            windowMinutes: 10080,
            resetsAt: "2026-07-19T21:12:52Z",
            resetDescription: "Jul 20 at 12:12 AM",
        },
        tertiary: null,
        updatedAt: "2026-07-12T21:12:53Z",
    },
};

const CLAUDE_PAYLOAD = {
    provider: "claude",
    version: "2.1.197",
    source: "claude",
    usage: {
        primary: {
            usedPercent: 7,
            windowMinutes: 300,
            resetsAt: "2026-07-13T01:00:00Z",
            resetDescription: "Resets 4am",
        },
        secondary: {
            usedPercent: 20,
            windowMinutes: 10080,
            resetsAt: "2026-07-16T21:00:00Z",
        },
        tertiary: null,
        updatedAt: "2026-07-12T21:13:43Z",
    },
    pace: {
        primary: { summary: "18% in reserve | Lasts until reset" },
    },
};

const ERROR_PAYLOAD = {
    provider: "gemini",
    source: "api",
    error: { code: 2, message: "gemini CLI not found" },
};

test("parseUsageJson: parses a two-provider array into view models", () => {
    const text = JSON.stringify([CODEX_PAYLOAD, CLAUDE_PAYLOAD]);
    const result = parser.parseUsageJson(text);
    assert.equal(result.ok, true);
    assert.equal(result.models.length, 2);
    const [codex, claude] = result.models;
    assert.equal(codex.id, "codex");
    assert.equal(codex.error, null);
    assert.equal(codex.account, "user@example.com");
    assert.equal(claude.id, "claude");
    assert.equal(claude.windows.length, 2);
});

test("parseUsageJson: window labels derived from windowMinutes", () => {
    const result = parser.parseUsageJson(JSON.stringify([CLAUDE_PAYLOAD]));
    const windows = result.models[0].windows;
    assert.equal(windows[0].label, "Session");
    assert.equal(windows[1].label, "Weekly");
    assert.equal(windows[0].usedPercent, 7);
    assert.equal(windows[1].resetsAt, "2026-07-16T21:00:00Z");
});

test("parseUsageJson: pace summary is attached to matching window", () => {
    const result = parser.parseUsageJson(JSON.stringify([CLAUDE_PAYLOAD]));
    const windows = result.models[0].windows;
    assert.match(windows[0].paceSummary, /in reserve/);
    assert.equal(windows[1].paceSummary, "");
});

test("parseUsageJson: provider error payload becomes error model", () => {
    const result = parser.parseUsageJson(JSON.stringify([ERROR_PAYLOAD]));
    assert.equal(result.ok, true);
    const model = result.models[0];
    assert.equal(model.id, "gemini");
    assert.equal(model.windows.length, 0);
    assert.match(model.error, /not found/);
});

test("parseUsageJson: credits surface on the model", () => {
    const result = parser.parseUsageJson(JSON.stringify([CODEX_PAYLOAD]));
    assert.equal(result.models[0].credits, 12.5);
});

test("parseUsageJson: synthetic placeholder windows are dropped", () => {
    const payload = JSON.parse(JSON.stringify(CLAUDE_PAYLOAD));
    payload.usage.primary.isSyntheticPlaceholder = true;
    const result = parser.parseUsageJson(JSON.stringify([payload]));
    assert.equal(result.models[0].windows.length, 1);
    assert.equal(result.models[0].windows[0].label, "Weekly");
});

test("parseUsageJson: invalid JSON reports failure", () => {
    const result = parser.parseUsageJson("mangled {");
    assert.equal(result.ok, false);
    assert.ok(result.error.length > 0);
});

test("parseUsageJson: non-array JSON reports failure", () => {
    const result = parser.parseUsageJson('{"provider":"codex"}');
    assert.equal(result.ok, false);
});

test("windowLabel: known and fallback windows", () => {
    assert.equal(parser.windowLabel(300), "Session");
    assert.equal(parser.windowLabel(10080), "Weekly");
    assert.equal(parser.windowLabel(43200), "Monthly");
    assert.equal(parser.windowLabel(1440), "Daily");
    assert.equal(parser.windowLabel(60), "1h");
    assert.equal(parser.windowLabel(null), "Usage");
});

test("worstUsedPercent: max across windows, -1 when empty", () => {
    const result = parser.parseUsageJson(JSON.stringify([CLAUDE_PAYLOAD]));
    assert.equal(parser.worstUsedPercent(result.models[0]), 20);
    const err = parser.parseUsageJson(JSON.stringify([ERROR_PAYLOAD]));
    assert.equal(parser.worstUsedPercent(err.models[0]), -1);
});

test("usageStage: thresholds ok/warn/crit", () => {
    assert.equal(parser.usageStage(0), "ok");
    assert.equal(parser.usageStage(69), "ok");
    assert.equal(parser.usageStage(70), "warn");
    assert.equal(parser.usageStage(89), "warn");
    assert.equal(parser.usageStage(90), "crit");
    assert.equal(parser.usageStage(100), "crit");
});

test("formatCountdown: humanized remaining time", () => {
    const now = Date.parse("2026-07-12T21:00:00Z");
    assert.equal(parser.formatCountdown("2026-07-12T23:30:00Z", now), "2h 30m");
    assert.equal(parser.formatCountdown("2026-07-16T21:00:00Z", now), "4d 0h");
    assert.equal(parser.formatCountdown("2026-07-12T21:45:00Z", now), "45m");
    assert.equal(parser.formatCountdown("2026-07-12T20:00:00Z", now), "now");
    assert.equal(parser.formatCountdown(null, now), "");
});

test("shortName: compact provider badge", () => {
    assert.equal(parser.shortName("codex"), "Cx");
    assert.equal(parser.shortName("claude"), "Cl");
    assert.equal(parser.shortName("gemini"), "Gm");
    // Unknown providers fall back to first two letters, capitalized.
    assert.equal(parser.shortName("wayfinder"), "Wa");
});

test("providerDisplayName: catalog lookup with id fallback", () => {
    assert.equal(parser.providerDisplayName("codex"), "Codex");
    assert.equal(parser.providerDisplayName("zai"), "z.ai");
    assert.equal(parser.providerDisplayName("nonexistent"), "nonexistent");
});

test("PROVIDER_CATALOG: full 58-provider catalog with ids and names", () => {
    assert.equal(parser.PROVIDER_CATALOG.length, 58);
    const ids = parser.PROVIDER_CATALOG.map((p) => p.id);
    for (const id of ["codex", "claude", "gemini", "copilot", "cursor"]) {
        assert.ok(ids.includes(id), `missing ${id}`);
    }
    for (const p of parser.PROVIDER_CATALOG) {
        assert.ok(p.id && p.name);
    }
});

test("toggleSelection: add, remove, dedupe, keep order", () => {
    assert.equal(parser.toggleSelection("", "codex", true), "codex");
    assert.equal(parser.toggleSelection("codex", "claude", true), "codex,claude");
    assert.equal(parser.toggleSelection("codex,claude", "codex", false), "claude");
    // Adding an already-present id changes nothing.
    assert.equal(parser.toggleSelection("codex,claude", "claude", true), "codex,claude");
    // Removing a missing id changes nothing.
    assert.equal(parser.toggleSelection("codex", "gemini", false), "codex");
    // Whitespace-tolerant input.
    assert.equal(parser.toggleSelection(" codex , claude ", "gemini", true), "codex,claude,gemini");
});

test("selectionList: parses csv config string", () => {
    assert.deepEqual(parser.selectionList(""), []);
    assert.deepEqual(parser.selectionList("  "), []);
    assert.deepEqual(parser.selectionList("codex,claude"), ["codex", "claude"]);
    assert.deepEqual(parser.selectionList(" codex , claude "), ["codex", "claude"]);
});

test("gaugeRings: session goes to outer ring, weekly to inner", () => {
    const result = parser.parseUsageJson(JSON.stringify([CLAUDE_PAYLOAD]));
    const rings = parser.gaugeRings(result.models[0]);
    assert.equal(rings.outerIdx, 0);
    assert.equal(rings.innerIdx, 1);
});

test("gaugeRings: weekly-only provider lights only the inner ring", () => {
    const result = parser.parseUsageJson(JSON.stringify([CODEX_PAYLOAD]));
    const rings = parser.gaugeRings(result.models[0]);
    assert.equal(rings.outerIdx, -1);
    assert.equal(rings.innerIdx, 0);
});

test("gaugeRings: daily maps to outer, monthly to inner", () => {
    const payload = JSON.parse(JSON.stringify(CLAUDE_PAYLOAD));
    payload.usage.primary.windowMinutes = 1440;
    payload.usage.secondary.windowMinutes = 43200;
    const result = parser.parseUsageJson(JSON.stringify([payload]));
    const rings = parser.gaugeRings(result.models[0]);
    assert.equal(rings.outerIdx, 0);
    assert.equal(rings.innerIdx, 1);
});

test("gaugeRings: unclassifiable single window falls back to outer", () => {
    const payload = JSON.parse(JSON.stringify(CODEX_PAYLOAD));
    payload.usage.secondary.windowMinutes = null;
    const result = parser.parseUsageJson(JSON.stringify([payload]));
    const rings = parser.gaugeRings(result.models[0]);
    assert.equal(rings.outerIdx, 0);
    assert.equal(rings.innerIdx, -1);
});

test("gaugeRings: no windows means no rings", () => {
    const result = parser.parseUsageJson(JSON.stringify([ERROR_PAYLOAD]));
    const rings = parser.gaugeRings(result.models[0]);
    assert.equal(rings.outerIdx, -1);
    assert.equal(rings.innerIdx, -1);
});

test("gaugeCenterPercent: percent used of outer, falling back to inner", () => {
    const claude = parser.parseUsageJson(JSON.stringify([CLAUDE_PAYLOAD])).models[0];
    assert.equal(parser.gaugeCenterPercent(claude), 7); // session used
    const codex = parser.parseUsageJson(JSON.stringify([CODEX_PAYLOAD])).models[0];
    assert.equal(parser.gaugeCenterPercent(codex), 37); // weekly used
    const err = parser.parseUsageJson(JSON.stringify([ERROR_PAYLOAD])).models[0];
    assert.equal(parser.gaugeCenterPercent(err), -1);
});

test("sweepAngle: maps percent to degrees, clamped", () => {
    assert.equal(parser.sweepAngle(0), 0);
    assert.equal(parser.sweepAngle(50), 180);
    assert.equal(parser.sweepAngle(100), 360);
    assert.equal(parser.sweepAngle(150), 360);
    assert.equal(parser.sweepAngle(-5), 0);
});
