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

test("parseUsageJson: extraRateWindows become titled windows", () => {
    const payload = JSON.parse(JSON.stringify(CODEX_PAYLOAD));
    payload.usage.extraRateWindows = [
        {
            id: "codex-spark",
            title: "Codex Spark Weekly",
            window: { usedPercent: 0, windowMinutes: 10080, resetsAt: "2026-07-19T21:12:52Z" },
        },
        {
            id: "code-review",
            title: "Code review",
            window: { usedPercent: 12, windowMinutes: null, resetsAt: null },
        },
    ];
    const model = parser.parseUsageJson(JSON.stringify([payload])).models[0];
    assert.equal(model.windows.length, 3);
    assert.equal(model.windows[1].label, "Codex Spark Weekly");
    assert.equal(model.windows[2].label, "Code review");
    assert.equal(model.windows[2].usedPercent, 12);
});

test("parseUsageJson: extra windows with usageKnown=false are marked", () => {
    const payload = JSON.parse(JSON.stringify(CODEX_PAYLOAD));
    payload.usage.extraRateWindows = [
        {
            id: "mystery",
            title: "Mystery lane",
            usageKnown: false,
            window: { usedPercent: 0, windowMinutes: 10080, resetsAt: "2026-07-19T21:12:52Z" },
        },
    ];
    const model = parser.parseUsageJson(JSON.stringify([payload])).models[0];
    const lane = model.windows.find((w) => w.label === "Mystery lane");
    assert.equal(lane.usageKnown, false);
    // Primary/secondary windows report usage as known.
    assert.equal(model.windows[0].usageKnown, true);
});

test("parseUsageJson: dashboard code review becomes a window when absent from extras", () => {
    const payload = JSON.parse(JSON.stringify(CODEX_PAYLOAD));
    payload.openaiDashboard = { codeReviewRemainingPercent: 80 };
    const model = parser.parseUsageJson(JSON.stringify([payload])).models[0];
    const review = model.windows.find((w) => w.label === "Code review");
    assert.ok(review, "code review window missing");
    assert.equal(review.usedPercent, 20);
});

test("gaugeRings: unknown-usage windows never claim a ring", () => {
    const payload = JSON.parse(JSON.stringify(CLAUDE_PAYLOAD));
    payload.usage.extraRateWindows = [
        {
            id: "mystery",
            title: "Mystery",
            usageKnown: false,
            window: { usedPercent: 0, windowMinutes: 300, resetsAt: null },
        },
    ];
    const model = parser.parseUsageJson(JSON.stringify([payload])).models[0];
    const rings = parser.gaugeRings(model);
    assert.equal(model.windows[rings.outerIdx].label, "Session");
    assert.equal(model.windows[rings.innerIdx].label, "Weekly");
});

test("applyUpdate: fresh data replaces the provider entry", () => {
    const first = parser.parseUsageJson(JSON.stringify([CODEX_PAYLOAD])).models;
    const state = parser.applyUpdate({}, first, 1000);
    assert.equal(state.byId.codex.fetchedAtMs, 1000);
    const updated = JSON.parse(JSON.stringify(CODEX_PAYLOAD));
    updated.usage.secondary.usedPercent = 55;
    const second = parser.parseUsageJson(JSON.stringify([updated])).models;
    const state2 = parser.applyUpdate(state.byId, second, 2000);
    assert.equal(state2.byId.codex.windows[0].usedPercent, 55);
    assert.equal(state2.byId.codex.fetchedAtMs, 2000);
});

test("applyUpdate: error keeps cached data and marks it stale", () => {
    const good = parser.parseUsageJson(JSON.stringify([CODEX_PAYLOAD])).models;
    const state = parser.applyUpdate({}, good, 1000);
    const errModels = parser.parseUsageJson(JSON.stringify([
        { provider: "codex", source: "oauth", error: { code: 1, message: "network down" } },
    ])).models;
    const state2 = parser.applyUpdate(state.byId, errModels, 2000);
    const codex = state2.byId.codex;
    assert.equal(codex.windows.length, 1, "cached windows must survive");
    assert.match(codex.staleError, /network down/);
    assert.equal(codex.fetchedAtMs, 1000, "fetch time stays at last good data");
});

test("applyUpdate: error without cache shows the error model", () => {
    const errModels = parser.parseUsageJson(JSON.stringify([ERROR_PAYLOAD])).models;
    const state = parser.applyUpdate({}, errModels, 500);
    assert.match(state.byId.gemini.error, /not found/);
});

test("formatAgo: humanized elapsed time", () => {
    const now = 10 * 60 * 1000;
    assert.equal(parser.formatAgo(now - 20 * 1000, now), "just now");
    assert.equal(parser.formatAgo(now - 5 * 60 * 1000, now), "5m ago");
    assert.equal(parser.formatAgo(now - 0, now), "just now");
    const now2 = 4 * 3600 * 1000;
    assert.equal(parser.formatAgo(now2 - (2 * 3600 + 15 * 60) * 1000, now2), "2h 15m ago");
    assert.equal(parser.formatAgo(0, 30 * 3600 * 1000), "1d 6h ago");
    assert.equal(parser.formatAgo(-1, 1000), "");
});

const COST_PAYLOAD = [
    {
        provider: "codex",
        sessionCostUSD: 0.42,
        sessionTokens: 12345,
        last30DaysCostUSD: 6.284147,
        last30DaysTokens: 3376947,
        daily: [
            { date: "2026-07-08", totalCost: 0.35315, totalTokens: 223689 },
            { date: "2026-07-12", totalCost: 1.658283, totalTokens: 771027 },
        ],
    },
    {
        provider: "claude",
        sessionCostUSD: 862.0005,
        sessionTokens: 628688150,
        last30DaysCostUSD: 2881.9548,
        last30DaysTokens: 2472054411,
        daily: [],
    },
];

test("parseCostJson: maps payloads by provider id", () => {
    const result = parser.parseCostJson(JSON.stringify(COST_PAYLOAD));
    assert.equal(result.ok, true);
    const codex = result.byId.codex;
    assert.equal(codex.todayCostUSD, 0.42);
    assert.equal(codex.todayTokens, 12345);
    assert.equal(codex.month30CostUSD, 6.284147);
    assert.equal(codex.month30Tokens, 3376947);
    assert.equal(codex.daily.length, 2);
    assert.equal(codex.daily[1].totalCost, 1.658283);
    assert.ok(result.byId.claude);
});

test("parseCostJson: rejects invalid input", () => {
    assert.equal(parser.parseCostJson("nope {").ok, false);
    assert.equal(parser.parseCostJson('{"provider":"codex"}').ok, false);
});

test("humanTokens: compact token counts", () => {
    assert.equal(parser.humanTokens(0), "0");
    assert.equal(parser.humanTokens(950), "950");
    assert.equal(parser.humanTokens(12345), "12.3K");
    assert.equal(parser.humanTokens(3376947), "3.4M");
    assert.equal(parser.humanTokens(2472054411), "2.5B");
    assert.equal(parser.humanTokens(null), "");
});

test("formatMoney: USD with two decimals", () => {
    assert.equal(parser.formatMoney(6.284147), "$6.28");
    assert.equal(parser.formatMoney(0), "$0.00");
    assert.equal(parser.formatMoney(2881.9548), "$2881.95");
    assert.equal(parser.formatMoney(null), "");
});

test("chartSeries: zero-filled last N days ending today", () => {
    const daily = [
        { date: "2026-07-08", totalCost: 0.35, totalTokens: 10 },
        { date: "2026-07-12", totalCost: 1.66, totalTokens: 20 },
    ];
    const series = parser.chartSeries(daily, 7, "2026-07-12");
    assert.equal(series.length, 7);
    assert.equal(series[6].value, 1.66); // today
    assert.equal(series[2].value, 0.35); // 2026-07-08
    assert.equal(series[0].value, 0);    // gap zero-filled
    assert.equal(series[6].date, "2026-07-12");
});

test("buildCommands: proxy env vars wrap the CLI call", () => {
    const cmds = parser.buildCommands("codexbar", ["codex"], "http://127.0.0.1:3128");
    assert.equal(cmds.length, 1);
    assert.match(cmds[0], /https_proxy='http:\/\/127\.0\.0\.1:3128'/);
    assert.match(cmds[0], /HTTPS_PROXY='http:\/\/127\.0\.0\.1:3128'/);
    assert.match(cmds[0], /--provider codex/);
});

test("buildCommands: no proxy means no proxy vars, config mode is one command", () => {
    const cmds = parser.buildCommands("codexbar", [], "");
    assert.equal(cmds.length, 1);
    assert.ok(cmds[0].indexOf("https_proxy") === -1);
    assert.ok(cmds[0].indexOf("--provider") === -1);
    const multi = parser.buildCommands("/opt/bin/codexbar", ["codex", "claude"], "");
    assert.equal(multi.length, 2);
    assert.match(multi[1], /--provider claude/);
});

test("buildCostCommand: cost subcommand with proxy", () => {
    const cmd = parser.buildCostCommand("codexbar", "socks5://10.0.0.1:1080");
    assert.match(cmd, /codexbar cost --format json --no-color/);
    assert.match(cmd, /ALL_PROXY='socks5:\/\/10\.0\.0\.1:1080'/);
    const plain = parser.buildCostCommand("codexbar", "");
    assert.ok(plain.indexOf("ALL_PROXY") === -1);
});
