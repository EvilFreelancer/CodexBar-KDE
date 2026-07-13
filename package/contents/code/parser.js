// Parsing and formatting helpers for the CodexBar plasmoid.
// This file is imported both from QML (import "../code/parser.js" as Parser)
// and from Node.js unit tests (tests/parser.test.mjs), so it must stay
// engine-neutral: no QML pragmas, no Node-only APIs.

// Catalog captured from `codexbar config providers` (CodexBar CLI v0.42.1).
var PROVIDER_CATALOG = [
    { id: "codex", name: "Codex" },
    { id: "openai", name: "OpenAI" },
    { id: "azureopenai", name: "Azure OpenAI" },
    { id: "claude", name: "Claude" },
    { id: "cursor", name: "Cursor" },
    { id: "opencode", name: "OpenCode" },
    { id: "opencodego", name: "OpenCode Go" },
    { id: "alibaba", name: "Alibaba" },
    { id: "alibabatokenplan", name: "Alibaba Token Plan" },
    { id: "factory", name: "Droid" },
    { id: "gemini", name: "Gemini" },
    { id: "antigravity", name: "Antigravity" },
    { id: "copilot", name: "Copilot" },
    { id: "devin", name: "Devin" },
    { id: "zai", name: "z.ai" },
    { id: "minimax", name: "MiniMax" },
    { id: "manus", name: "Manus" },
    { id: "kimi", name: "Kimi" },
    { id: "kilo", name: "Kilo" },
    { id: "kiro", name: "Kiro" },
    { id: "vertexai", name: "Vertex AI" },
    { id: "augment", name: "Augment" },
    { id: "jetbrains", name: "JetBrains AI" },
    { id: "kimik2", name: "Kimi K2 (unofficial)" },
    { id: "moonshot", name: "Moonshot / Kimi API" },
    { id: "amp", name: "Amp" },
    { id: "t3chat", name: "T3 Chat" },
    { id: "ollama", name: "Ollama" },
    { id: "synthetic", name: "Synthetic" },
    { id: "warp", name: "Warp" },
    { id: "openrouter", name: "OpenRouter" },
    { id: "elevenlabs", name: "ElevenLabs" },
    { id: "windsurf", name: "Windsurf" },
    { id: "zed", name: "Zed" },
    { id: "perplexity", name: "Perplexity" },
    { id: "mimo", name: "Xiaomi MiMo" },
    { id: "doubao", name: "Doubao" },
    { id: "sakana", name: "Sakana AI" },
    { id: "abacus", name: "Abacus AI" },
    { id: "mistral", name: "Mistral" },
    { id: "deepseek", name: "DeepSeek" },
    { id: "codebuff", name: "Codebuff" },
    { id: "crof", name: "Crof" },
    { id: "venice", name: "Venice" },
    { id: "commandcode", name: "Command Code" },
    { id: "qoder", name: "Qoder" },
    { id: "stepfun", name: "StepFun" },
    { id: "bedrock", name: "AWS Bedrock" },
    { id: "grok", name: "Grok" },
    { id: "groq", name: "Groq" },
    { id: "llmproxy", name: "LLM Proxy" },
    { id: "litellm", name: "LiteLLM" },
    { id: "deepgram", name: "Deepgram" },
    { id: "poe", name: "Poe" },
    { id: "chutes", name: "Chutes" },
    { id: "crossmodel", name: "CrossModel" },
    { id: "clawrouter", name: "ClawRouter" },
    { id: "wayfinder", name: "Wayfinder" },
];

var SHORT_NAMES = {
    codex: "Cx",
    openai: "OA",
    azureopenai: "Az",
    claude: "Cl",
    cursor: "Cu",
    gemini: "Gm",
    copilot: "Cp",
    antigravity: "Ag",
    openrouter: "OR",
    minimax: "MM",
    deepseek: "DS",
    jetbrains: "JB",
    vertexai: "Vx",
    bedrock: "BR",
    litellm: "LL",
    llmproxy: "LP",
    groq: "Gq",
    grok: "Gk",
};

function providerDisplayName(id) {
    for (var i = 0; i < PROVIDER_CATALOG.length; i++) {
        if (PROVIDER_CATALOG[i].id === id) {
            return PROVIDER_CATALOG[i].name;
        }
    }
    return id;
}

function shortName(id) {
    if (SHORT_NAMES[id]) {
        return SHORT_NAMES[id];
    }
    if (!id || id.length === 0) {
        return "?";
    }
    var base = id.slice(0, 2);
    return base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
}

function windowLabel(windowMinutes) {
    if (windowMinutes === null || windowMinutes === undefined) {
        return "Usage";
    }
    if (windowMinutes === 10080) {
        return "Weekly";
    }
    if (windowMinutes === 43200) {
        return "Monthly";
    }
    if (windowMinutes === 1440) {
        return "Daily";
    }
    if (windowMinutes >= 180 && windowMinutes <= 360) {
        return "Session";
    }
    if (windowMinutes % 1440 === 0) {
        return (windowMinutes / 1440) + "d";
    }
    if (windowMinutes % 60 === 0) {
        return (windowMinutes / 60) + "h";
    }
    return windowMinutes + "m";
}

function usageStage(usedPercent) {
    if (usedPercent >= 90) {
        return "crit";
    }
    if (usedPercent >= 70) {
        return "warn";
    }
    return "ok";
}

function formatCountdown(resetsAtIso, nowMs) {
    if (!resetsAtIso) {
        return "";
    }
    var target = Date.parse(resetsAtIso);
    if (isNaN(target)) {
        return "";
    }
    var diffMinutes = Math.floor((target - nowMs) / 60000);
    if (diffMinutes <= 0) {
        return "now";
    }
    var days = Math.floor(diffMinutes / 1440);
    var hours = Math.floor((diffMinutes % 1440) / 60);
    var minutes = diffMinutes % 60;
    if (days > 0) {
        return days + "d " + hours + "h";
    }
    if (hours > 0) {
        return hours + "h " + minutes + "m";
    }
    return minutes + "m";
}

function makeWindow(key, raw, pace, labelOverride, usageKnown) {
    var paceSummary = "";
    if (pace && pace[key] && pace[key].summary) {
        paceSummary = pace[key].summary;
    }
    var minutes = raw.windowMinutes === undefined ? null : raw.windowMinutes;
    return {
        key: key,
        label: labelOverride || windowLabel(minutes),
        windowMinutes: minutes,
        usedPercent: Math.round(raw.usedPercent || 0),
        resetsAt: raw.resetsAt || null,
        resetDescription: raw.resetDescription || "",
        paceSummary: paceSummary,
        usageKnown: usageKnown === undefined ? true : usageKnown,
    };
}

function payloadToModel(payload) {
    var usage = payload.usage || null;
    var windows = [];
    if (usage) {
        var keys = ["primary", "secondary", "tertiary"];
        for (var i = 0; i < keys.length; i++) {
            var raw = usage[keys[i]];
            if (!raw || raw.isSyntheticPlaceholder) {
                continue;
            }
            windows.push(makeWindow(keys[i], raw, payload.pace || null));
        }
        // Named model-specific lanes (e.g. Codex Spark, Code review).
        var extras = usage.extraRateWindows || [];
        for (var j = 0; j < extras.length; j++) {
            var extra = extras[j];
            if (!extra || !extra.window || extra.window.isSyntheticPlaceholder) {
                continue;
            }
            windows.push(makeWindow(
                "extra:" + (extra.id || j),
                extra.window,
                null,
                extra.title || extra.id || "Extra",
                extra.usageKnown === undefined ? true : extra.usageKnown));
        }
    }
    // OpenAI web dashboard exposes code review as a bare remaining percent.
    var dashboard = payload.openaiDashboard || null;
    if (dashboard && typeof dashboard.codeReviewRemainingPercent === "number") {
        var hasReviewLane = windows.some(function(w) {
            return w.label.toLowerCase().indexOf("code review") !== -1;
        });
        if (!hasReviewLane) {
            windows.push(makeWindow(
                "extra:code-review",
                { usedPercent: 100 - dashboard.codeReviewRemainingPercent, windowMinutes: null, resetsAt: null },
                null,
                "Code review",
                true));
        }
    }
    var account = null;
    if (usage && usage.identity && usage.identity.accountEmail) {
        account = usage.identity.accountEmail;
    } else if (usage && usage.accountEmail) {
        account = usage.accountEmail;
    } else if (payload.account) {
        account = payload.account;
    }
    var plan = null;
    if (usage && usage.identity && usage.identity.loginMethod) {
        plan = usage.identity.loginMethod;
    } else if (usage && usage.loginMethod) {
        plan = usage.loginMethod;
    }
    var credits = null;
    if (payload.credits && typeof payload.credits.remaining === "number") {
        credits = payload.credits.remaining;
    }
    var status = null;
    if (payload.status && payload.status.indicator && payload.status.indicator !== "none") {
        status = {
            indicator: payload.status.indicator,
            description: payload.status.description || "",
        };
    }
    return {
        id: payload.provider || "?",
        name: providerDisplayName(payload.provider || "?"),
        source: payload.source || "",
        version: payload.version || "",
        account: account,
        plan: plan,
        credits: credits,
        status: status,
        error: payload.error ? String(payload.error.message || "error") : null,
        windows: windows,
        updatedAt: usage && usage.updatedAt ? usage.updatedAt : null,
    };
}

function parseUsageJson(text) {
    var parsed;
    try {
        parsed = JSON.parse(text);
    } catch (e) {
        return { ok: false, error: "Invalid JSON from codexbar: " + e.message, models: [] };
    }
    if (!Array.isArray(parsed)) {
        return { ok: false, error: "Unexpected codexbar payload (expected array)", models: [] };
    }
    var models = [];
    for (var i = 0; i < parsed.length; i++) {
        models.push(payloadToModel(parsed[i]));
    }
    return { ok: true, error: "", models: models };
}

function worstUsedPercent(model) {
    var worst = -1;
    for (var i = 0; i < model.windows.length; i++) {
        if (model.windows[i].usedPercent > worst) {
            worst = model.windows[i].usedPercent;
        }
    }
    return worst;
}

// Ring assignment for the radial gauge: outer ring shows the short
// (session/daily) window, inner ring the long (weekly/monthly) window.
function gaugeRings(model) {
    var outerIdx = -1;
    var innerIdx = -1;
    var firstKnownIdx = -1;
    for (var i = 0; i < model.windows.length; i++) {
        if (model.windows[i].usageKnown === false) {
            continue;
        }
        if (firstKnownIdx === -1) {
            firstKnownIdx = i;
        }
        var minutes = model.windows[i].windowMinutes;
        if (minutes !== null && minutes !== undefined && minutes <= 1440 && outerIdx === -1) {
            outerIdx = i;
        } else if (minutes !== null && minutes !== undefined && minutes >= 10080 && innerIdx === -1) {
            innerIdx = i;
        }
    }
    if (outerIdx === -1 && innerIdx === -1 && firstKnownIdx !== -1) {
        outerIdx = firstKnownIdx;
    }
    return { outerIdx: outerIdx, innerIdx: innerIdx };
}

function gaugeCenterPercent(model) {
    var rings = gaugeRings(model);
    var idx = rings.outerIdx !== -1 ? rings.outerIdx : rings.innerIdx;
    if (idx === -1) {
        return -1;
    }
    return Math.max(0, Math.min(100, model.windows[idx].usedPercent));
}

function sweepAngle(percent) {
    var clamped = Math.max(0, Math.min(100, percent));
    return clamped * 3.6;
}

// Local token-cost scan payloads from `codexbar cost --format json`.
function parseCostJson(text) {
    var parsed;
    try {
        parsed = JSON.parse(text);
    } catch (e) {
        return { ok: false, error: "Invalid cost JSON: " + e.message, byId: {} };
    }
    if (!Array.isArray(parsed)) {
        return { ok: false, error: "Unexpected cost payload (expected array)", byId: {} };
    }
    var byId = {};
    for (var i = 0; i < parsed.length; i++) {
        var p = parsed[i];
        if (!p || !p.provider) {
            continue;
        }
        var daily = [];
        var rawDaily = p.daily || [];
        for (var j = 0; j < rawDaily.length; j++) {
            daily.push({
                date: rawDaily[j].date || "",
                totalCost: Number(rawDaily[j].totalCost) || 0,
                totalTokens: Number(rawDaily[j].totalTokens) || 0,
            });
        }
        byId[p.provider] = {
            todayCostUSD: typeof p.sessionCostUSD === "number" ? p.sessionCostUSD : null,
            todayTokens: typeof p.sessionTokens === "number" ? p.sessionTokens : null,
            month30CostUSD: typeof p.last30DaysCostUSD === "number" ? p.last30DaysCostUSD : null,
            month30Tokens: typeof p.last30DaysTokens === "number" ? p.last30DaysTokens : null,
            daily: daily,
        };
    }
    return { ok: true, error: "", byId: byId };
}

function humanTokens(value) {
    if (value === null || value === undefined || !isFinite(value)) {
        return "";
    }
    var n = Number(value);
    if (n < 1000) {
        return String(Math.round(n));
    }
    if (n < 1000000) {
        return (Math.round(n / 100) / 10) + "K";
    }
    if (n < 1000000000) {
        return (Math.round(n / 100000) / 10) + "M";
    }
    return (Math.round(n / 100000000) / 10) + "B";
}

function formatMoney(value) {
    if (value === null || value === undefined || !isFinite(value)) {
        return "";
    }
    return "$" + Number(value).toFixed(2);
}

// Zero-filled per-day cost series for the history chart, ending at todayIso.
function chartSeries(daily, days, todayIso) {
    var byDate = {};
    for (var i = 0; i < (daily || []).length; i++) {
        byDate[daily[i].date] = daily[i];
    }
    var series = [];
    var today = new Date(todayIso + "T00:00:00Z");
    for (var d = days - 1; d >= 0; d--) {
        var day = new Date(today.getTime() - d * 86400000);
        var iso = day.toISOString().slice(0, 10);
        var entry = byDate[iso];
        series.push({
            date: iso,
            value: entry ? entry.totalCost : 0,
            tokens: entry ? entry.totalTokens : 0,
        });
    }
    return series;
}

function shellQuote(value) {
    return "'" + String(value).replace(/'/g, "'\"'\"'") + "'";
}

function commandPrefix(proxyUrl) {
    // ~/.local/bin is not always on plasmashell's PATH.
    var prefix = 'env PATH="$HOME/.local/bin:$PATH"';
    if (proxyUrl && proxyUrl.trim().length > 0) {
        var quoted = shellQuote(proxyUrl.trim());
        prefix += " http_proxy=" + quoted + " https_proxy=" + quoted
            + " HTTP_PROXY=" + quoted + " HTTPS_PROXY=" + quoted
            + " ALL_PROXY=" + quoted;
    }
    return prefix;
}

// One usage command per selected provider; a single unscoped command when the
// selection is empty (the CLI then reports the providers enabled in its own
// config file).
function buildCommands(codexbarPath, selected, proxyUrl) {
    var base = commandPrefix(proxyUrl) + " " + codexbarPath + " usage --format json --no-color";
    if (!selected || selected.length === 0) {
        return [base];
    }
    return selected.map(function(id) {
        return base + " --provider " + id;
    });
}

function buildCostCommand(codexbarPath, proxyUrl) {
    return commandPrefix(proxyUrl) + " " + codexbarPath + " cost --format json --no-color";
}

// Merge freshly parsed provider models into the cached map. Successful
// fetches replace the cache entry; errors keep the last good data and only
// mark it stale, so panel gauges never blank out during background refreshes.
function applyUpdate(prevById, models, nowMs) {
    var byId = {};
    var key;
    for (key in prevById) {
        byId[key] = prevById[key];
    }
    for (var i = 0; i < models.length; i++) {
        var model = models[i];
        var cached = byId[model.id];
        if (model.error && cached && cached.windows && cached.windows.length > 0) {
            var stale = {};
            for (key in cached) {
                stale[key] = cached[key];
            }
            stale.staleError = model.error;
            byId[model.id] = stale;
            continue;
        }
        model.fetchedAtMs = nowMs;
        model.staleError = null;
        byId[model.id] = model;
    }
    return { byId: byId };
}

function formatAgo(thenMs, nowMs) {
    if (thenMs === null || thenMs === undefined || thenMs < 0) {
        return "";
    }
    var minutes = Math.floor((nowMs - thenMs) / 60000);
    if (minutes < 1) {
        return "just now";
    }
    if (minutes < 60) {
        return minutes + "m ago";
    }
    var hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return hours + "h " + (minutes % 60) + "m ago";
    }
    var days = Math.floor(hours / 24);
    return days + "d " + (hours % 24) + "h ago";
}

function selectionList(csv) {
    if (!csv) {
        return [];
    }
    var out = [];
    var parts = csv.split(",");
    for (var i = 0; i < parts.length; i++) {
        var id = parts[i].trim();
        if (id.length > 0) {
            out.push(id);
        }
    }
    return out;
}

function toggleSelection(csv, id, checked) {
    var list = selectionList(csv);
    var index = list.indexOf(id);
    if (checked && index === -1) {
        list.push(id);
    } else if (!checked && index !== -1) {
        list.splice(index, 1);
    }
    return list.join(",");
}

// Node.js test hook; ignored by the QML JS engine.
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        PROVIDER_CATALOG: PROVIDER_CATALOG,
        providerDisplayName: providerDisplayName,
        shortName: shortName,
        windowLabel: windowLabel,
        usageStage: usageStage,
        formatCountdown: formatCountdown,
        parseUsageJson: parseUsageJson,
        worstUsedPercent: worstUsedPercent,
        selectionList: selectionList,
        toggleSelection: toggleSelection,
        gaugeRings: gaugeRings,
        gaugeCenterPercent: gaugeCenterPercent,
        sweepAngle: sweepAngle,
        applyUpdate: applyUpdate,
        formatAgo: formatAgo,
        parseCostJson: parseCostJson,
        humanTokens: humanTokens,
        formatMoney: formatMoney,
        chartSeries: chartSeries,
        buildCommands: buildCommands,
        buildCostCommand: buildCostCommand,
    };
}
