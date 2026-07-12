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

function makeWindow(key, raw, pace) {
    var paceSummary = "";
    if (pace && pace[key] && pace[key].summary) {
        paceSummary = pace[key].summary;
    }
    return {
        key: key,
        label: windowLabel(raw.windowMinutes === undefined ? null : raw.windowMinutes),
        windowMinutes: raw.windowMinutes === undefined ? null : raw.windowMinutes,
        usedPercent: Math.round(raw.usedPercent || 0),
        resetsAt: raw.resetsAt || null,
        resetDescription: raw.resetDescription || "",
        paceSummary: paceSummary,
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
    for (var i = 0; i < model.windows.length; i++) {
        var minutes = model.windows[i].windowMinutes;
        if (minutes !== null && minutes !== undefined && minutes <= 1440 && outerIdx === -1) {
            outerIdx = i;
        } else if (minutes !== null && minutes !== undefined && minutes >= 10080 && innerIdx === -1) {
            innerIdx = i;
        }
    }
    if (outerIdx === -1 && innerIdx === -1 && model.windows.length > 0) {
        outerIdx = 0;
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
    };
}
