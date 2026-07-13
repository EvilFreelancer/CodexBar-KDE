import QtQuick
import org.kde.plasma.plasmoid
import org.kde.plasma.core as PlasmaCore
import org.kde.plasma.plasma5support as Plasma5Support
import org.kde.kirigami as Kirigami
import "../code/parser.js" as Parser

PlasmoidItem {
    id: root

    // Cached provider view models keyed by provider id. Entries are only
    // replaced when fresh data arrives, so the panel never blanks out while
    // a background refresh is in flight.
    property var modelsById: ({})
    // Display order of provider ids (selection order, or arrival order when
    // following the CLI config).
    property var modelOrder: []
    // Ordered list consumed by the representations.
    property var models: []
    property string globalError: ""
    property bool loading: false
    property int pendingCount: 0
    property double lastUpdatedMs: -1
    // Ticks every 30s so countdown and "ago" labels stay fresh.
    property double nowMs: Date.now()

    // Ring palette, shared by compact and full representations. The weekly
    // orange is darkened on light themes to keep contrast against the track.
    readonly property bool darkTheme: Kirigami.Theme.textColor.hslLightness > 0.5
    readonly property color sessionColor: root.darkTheme ? "#3daee9" : "#2980b9"
    readonly property color weeklyColor: root.darkTheme ? "#f67400" : "#c85400"

    // Local token-cost stats keyed by provider id (Codex/Claude scans).
    property var costById: ({})

    readonly property string codexbarPath: Plasmoid.configuration.codexbarPath || "codexbar"
    readonly property bool showPace: Plasmoid.configuration.showPace
    readonly property bool showCost: Plasmoid.configuration.showCost
    readonly property bool showHistory: Plasmoid.configuration.showHistory
    readonly property string proxyUrl: Plasmoid.configuration.proxyUrl || ""
    readonly property var selectedProviders: Parser.selectionList(Plasmoid.configuration.selectedProviders || "")

    readonly property var commands: Parser.buildCommands(root.codexbarPath, root.selectedProviders, root.proxyUrl)
    readonly property string costCommand: Parser.buildCostCommand(root.codexbarPath, root.proxyUrl)

    switchWidth: Kirigami.Units.gridUnit * 15
    switchHeight: Kirigami.Units.gridUnit * 12

    Plasmoid.icon: "office-chart-bar"
    toolTipMainText: i18n("CodexBar")
    toolTipSubText: {
        var lines = []
        for (var i = 0; i < root.models.length; i++) {
            var m = root.models[i]
            if (m.error) {
                lines.push(m.name + ": " + m.error)
                continue
            }
            var parts = []
            for (var j = 0; j < m.windows.length; j++) {
                var w = m.windows[j]
                if (w.usageKnown === false) {
                    continue
                }
                parts.push(w.label + " " + w.usedPercent + "% used")
            }
            lines.push(m.name + ": " + (parts.length ? parts.join(", ") : i18n("no data")))
        }
        if (root.globalError.length > 0 && root.models.length === 0) {
            lines.push(root.globalError)
        }
        var ago = Parser.formatAgo(root.lastUpdatedMs, root.nowMs)
        if (root.loading) {
            lines.push(ago.length > 0
                ? i18n("Updating… (last update %1)", ago)
                : i18n("Updating…"))
        } else if (ago.length > 0) {
            lines.push(i18n("Updated %1", ago))
        }
        return lines.join("\n")
    }

    onCommandsChanged: root.refresh()

    function refresh() {
        if (root.loading) {
            return
        }
        root.loading = true
        root.pendingCount = root.commands.length + (root.showCost ? 1 : 0)
        // Old models stay on screen; the executable engine reruns each
        // command and results merge in as they arrive.
        executable.connectedSources = []
        for (var i = 0; i < root.commands.length; i++) {
            executable.connectSource(root.commands[i])
        }
        if (root.showCost) {
            executable.connectSource(root.costCommand)
        }
    }

    function handleCostResult(stdout) {
        var parsed = Parser.parseCostJson(stdout)
        if (parsed.ok) {
            root.costById = parsed.byId
            root.persistCache()
        }
        // A failed cost scan keeps the previous numbers; usage is unaffected.
    }

    function handleResult(stdout, stderr, exitCode) {
        var parsed = Parser.parseUsageJson(stdout)
        if (!parsed.ok) {
            var message = stderr && stderr.trim().length > 0
                ? stderr.trim().split("\n").pop()
                : parsed.error
            if (exitCode === 127) {
                message = i18n("codexbar binary not found — set its path in the widget settings")
            }
            // No parseable payload: keep whatever is cached, surface the error.
            root.globalError = root.models.length === 0 ? message : ""
            return
        }
        root.globalError = ""
        var now = Date.now()
        var state = Parser.applyUpdate(root.modelsById, parsed.models, now)
        root.modelsById = state.byId
        var hadFreshData = parsed.models.some(function(m) { return !m.error })
        if (hadFreshData) {
            root.lastUpdatedMs = now
        }
        for (var i = 0; i < parsed.models.length; i++) {
            var id = parsed.models[i].id
            if (root.modelOrder.indexOf(id) === -1) {
                root.modelOrder = root.modelOrder.concat([id])
            }
        }
        root.rebuildModels()
        root.persistCache()
    }

    function rebuildModels() {
        var order = root.selectedProviders.length > 0
            ? root.selectedProviders
            : root.modelOrder
        var list = []
        for (var i = 0; i < order.length; i++) {
            var m = root.modelsById[order[i]]
            if (m) {
                list.push(m)
            }
        }
        root.models = list
    }

    function persistCache() {
        Plasmoid.configuration.cacheJson = JSON.stringify({
            byId: root.modelsById,
            order: root.modelOrder,
            costById: root.costById,
            updatedAtMs: root.lastUpdatedMs,
        })
    }

    function loadCache() {
        var raw = Plasmoid.configuration.cacheJson || ""
        if (raw.length === 0) {
            return
        }
        try {
            var cache = JSON.parse(raw)
            root.modelsById = cache.byId || {}
            root.modelOrder = cache.order || []
            root.costById = cache.costById || {}
            root.lastUpdatedMs = cache.updatedAtMs !== undefined ? cache.updatedAtMs : -1
            root.rebuildModels()
        } catch (e) {
            // Corrupt cache is not fatal; the next refresh rewrites it.
        }
    }

    Plasma5Support.DataSource {
        id: executable
        engine: "executable"
        connectedSources: []
        onNewData: function(source, data) {
            executable.disconnectSource(source)
            root.pendingCount = Math.max(0, root.pendingCount - 1)
            if (root.pendingCount === 0) {
                root.loading = false
            }
            if (source === root.costCommand) {
                root.handleCostResult(data["stdout"] || "")
            } else {
                root.handleResult(
                    data["stdout"] || "",
                    data["stderr"] || "",
                    data["exit code"])
            }
        }
    }

    Timer {
        interval: Math.max(1, Plasmoid.configuration.refreshMinutes) * 60 * 1000
        running: true
        repeat: true
        onTriggered: root.refresh()
    }

    Timer {
        interval: 30 * 1000
        running: true
        repeat: true
        onTriggered: root.nowMs = Date.now()
    }

    Component.onCompleted: {
        root.loadCache()
        root.refresh()
    }

    compactRepresentation: CompactRepresentation {}
    fullRepresentation: FullRepresentation {}
}
