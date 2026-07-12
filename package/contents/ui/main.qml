import QtQuick
import org.kde.plasma.plasmoid
import org.kde.plasma.core as PlasmaCore
import org.kde.plasma.plasma5support as Plasma5Support
import org.kde.kirigami as Kirigami
import "../code/parser.js" as Parser

PlasmoidItem {
    id: root

    // Provider view models produced by parser.js, in display order.
    property var models: []
    // Raw results keyed by command source, merged into `models`.
    property var resultsBySource: ({})
    property string globalError: ""
    property bool loading: false
    property double lastUpdatedMs: 0
    // Ticks every 30s so countdown labels stay fresh.
    property double nowMs: Date.now()

    // Ring palette, shared by compact and full representations. The weekly
    // orange is darkened on light themes to keep contrast against the track.
    readonly property bool darkTheme: Kirigami.Theme.textColor.hslLightness > 0.5
    readonly property color sessionColor: root.darkTheme ? "#3daee9" : "#2980b9"
    readonly property color weeklyColor: root.darkTheme ? "#f67400" : "#c85400"

    readonly property string codexbarPath: Plasmoid.configuration.codexbarPath || "codexbar"
    readonly property bool showPace: Plasmoid.configuration.showPace
    readonly property var selectedProviders: Parser.selectionList(Plasmoid.configuration.selectedProviders || "")

    // One command per selected provider; a single unscoped command otherwise
    // (the CLI then reports every provider enabled in its own config file).
    readonly property var commands: {
        // ~/.local/bin is not always on plasmashell's PATH.
        var base = 'env PATH="$HOME/.local/bin:$PATH" ' + root.codexbarPath
            + " usage --format json --no-color"
        if (root.selectedProviders.length === 0) {
            return [base]
        }
        return root.selectedProviders.map(function(id) {
            return base + " --provider " + id
        })
    }

    switchWidth: Kirigami.Units.gridUnit * 15
    switchHeight: Kirigami.Units.gridUnit * 12

    Plasmoid.icon: "office-chart-bar"
    toolTipMainText: i18n("CodexBar")
    toolTipSubText: {
        if (root.globalError.length > 0) {
            return root.globalError
        }
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
                parts.push(w.label + " " + w.usedPercent + "% used")
            }
            lines.push(m.name + ": " + (parts.length ? parts.join(", ") : i18n("no data")))
        }
        return lines.join("\n")
    }

    onCommandsChanged: root.refresh()

    function refresh() {
        root.resultsBySource = {}
        root.globalError = ""
        root.loading = true
        // Disconnect and reconnect to force the executable engine to rerun.
        executable.connectedSources = []
        for (var i = 0; i < root.commands.length; i++) {
            executable.connectSource(root.commands[i])
        }
    }

    function handleResult(source, stdout, stderr, exitCode) {
        var parsed = Parser.parseUsageJson(stdout)
        var results = root.resultsBySource
        if (parsed.ok) {
            results[source] = { models: parsed.models, error: "" }
        } else {
            var message = stderr && stderr.trim().length > 0
                ? stderr.trim().split("\n").pop()
                : parsed.error
            if (exitCode === 127) {
                message = i18n("codexbar binary not found — set its path in the widget settings")
            }
            results[source] = { models: [], error: message }
        }
        root.resultsBySource = results
        root.rebuildModels()
    }

    function rebuildModels() {
        var done = 0
        var merged = []
        var errors = []
        for (var i = 0; i < root.commands.length; i++) {
            var r = root.resultsBySource[root.commands[i]]
            if (!r) {
                continue
            }
            done++
            merged = merged.concat(r.models)
            if (r.error) {
                errors.push(r.error)
            }
        }
        root.models = merged
        root.globalError = merged.length === 0 && errors.length > 0 ? errors[0] : ""
        if (done >= root.commands.length) {
            root.loading = false
            root.lastUpdatedMs = Date.now()
        }
    }

    Plasma5Support.DataSource {
        id: executable
        engine: "executable"
        connectedSources: []
        onNewData: function(source, data) {
            executable.disconnectSource(source)
            root.handleResult(
                source,
                data["stdout"] || "",
                data["stderr"] || "",
                data["exit code"])
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

    Component.onCompleted: root.refresh()

    compactRepresentation: CompactRepresentation {}
    fullRepresentation: FullRepresentation {}
}
