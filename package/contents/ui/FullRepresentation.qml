import QtQuick
import QtQuick.Layouts
import org.kde.plasma.plasmoid
import org.kde.plasma.components as PlasmaComponents3
import org.kde.plasma.extras as PlasmaExtras
import org.kde.kirigami as Kirigami
import "../code/parser.js" as Parser

PlasmaExtras.Representation {
    id: full

    Layout.preferredWidth: Kirigami.Units.gridUnit * 22
    Layout.preferredHeight: Kirigami.Units.gridUnit * 24
    Layout.minimumWidth: Kirigami.Units.gridUnit * 16
    Layout.minimumHeight: Kirigami.Units.gridUnit * 10

    collapseMarginsHint: true

    function stageColor(usedPercent) {
        var stage = Parser.usageStage(usedPercent)
        if (stage === "crit") {
            return Kirigami.Theme.negativeTextColor
        }
        if (stage === "warn") {
            return Kirigami.Theme.neutralTextColor
        }
        return Kirigami.Theme.positiveTextColor
    }

    function resetText(w) {
        var countdown = Parser.formatCountdown(w.resetsAt, root.nowMs)
        if (countdown === "now") {
            return i18n("resets soon")
        }
        if (countdown.length > 0) {
            return i18n("resets in %1", countdown)
        }
        return w.resetDescription
    }

    header: PlasmaExtras.PlasmoidHeading {
        RowLayout {
            anchors.fill: parent
            spacing: Kirigami.Units.smallSpacing

            Kirigami.Heading {
                Layout.fillWidth: true
                Layout.leftMargin: Kirigami.Units.smallSpacing
                level: 2
                text: i18n("CodexBar")
            }

            PlasmaComponents3.Label {
                visible: root.lastUpdatedMs > 0
                text: Qt.formatTime(new Date(root.lastUpdatedMs), "hh:mm")
                opacity: 0.6
                font.pointSize: Kirigami.Theme.smallFont.pointSize
            }

            PlasmaComponents3.BusyIndicator {
                visible: root.loading
                Layout.preferredWidth: Kirigami.Units.iconSizes.small
                Layout.preferredHeight: Kirigami.Units.iconSizes.small
            }

            PlasmaComponents3.ToolButton {
                icon.name: "view-refresh"
                enabled: !root.loading
                onClicked: root.refresh()
                PlasmaComponents3.ToolTip { text: i18n("Refresh") }
            }
        }
    }

    contentItem: ListView {
        id: providerList
        clip: true
        spacing: Kirigami.Units.smallSpacing
        model: root.models
        topMargin: Kirigami.Units.smallSpacing
        bottomMargin: Kirigami.Units.smallSpacing
        leftMargin: Kirigami.Units.smallSpacing
        rightMargin: Kirigami.Units.smallSpacing

        PlasmaExtras.PlaceholderMessage {
            anchors.centerIn: parent
            width: parent.width - Kirigami.Units.gridUnit * 2
            visible: root.models.length === 0
            iconName: root.globalError.length > 0 ? "data-warning" : "office-chart-bar"
            text: {
                if (root.globalError.length > 0) {
                    return root.globalError
                }
                if (root.loading) {
                    return i18n("Fetching usage…")
                }
                return i18n("No providers configured. Pick providers in the widget settings or enable them with “codexbar config enable --provider <id>”.")
            }
        }

        delegate: Kirigami.AbstractCard {
            id: card
            required property var modelData
            readonly property var rings: Parser.gaugeRings(modelData)
            readonly property int centerPercent: Parser.gaugeCenterPercent(modelData)
            width: providerList.width - providerList.leftMargin - providerList.rightMargin

            function ringColor(index) {
                if (index === card.rings.outerIdx) {
                    return root.sessionColor
                }
                if (index === card.rings.innerIdx) {
                    return root.weeklyColor
                }
                return Qt.alpha(Kirigami.Theme.textColor, 0.4)
            }

            contentItem: RowLayout {
                spacing: Kirigami.Units.largeSpacing

                RadialGauge {
                    Layout.preferredWidth: Kirigami.Units.gridUnit * 4.5
                    Layout.preferredHeight: Kirigami.Units.gridUnit * 4.5
                    Layout.alignment: Qt.AlignTop
                    outerColor: root.sessionColor
                    innerColor: root.weeklyColor
                    outerPercent: card.rings.outerIdx >= 0
                        ? card.modelData.windows[card.rings.outerIdx].usedPercent : -1
                    innerPercent: card.rings.innerIdx >= 0
                        ? card.modelData.windows[card.rings.innerIdx].usedPercent : -1
                    centerText: card.modelData.error
                        ? "!"
                        : (card.centerPercent >= 0 ? card.centerPercent + "%" : "")
                    centerTextScale: 0.2
                }

                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: Kirigami.Units.smallSpacing

                    RowLayout {
                        Layout.fillWidth: true
                        spacing: Kirigami.Units.smallSpacing

                        Kirigami.Heading {
                            level: 4
                            text: card.modelData.name
                        }

                        Rectangle {
                            visible: card.modelData.status !== null
                            width: Kirigami.Units.smallSpacing * 2
                            height: width
                            radius: width / 2
                            color: Kirigami.Theme.negativeTextColor

                            PlasmaComponents3.ToolTip {
                                text: card.modelData.status
                                    ? (card.modelData.status.indicator + ": " + card.modelData.status.description)
                                    : ""
                            }
                        }

                        Item { Layout.fillWidth: true }

                        PlasmaComponents3.Label {
                            visible: !!card.modelData.plan
                            text: card.modelData.plan || ""
                            opacity: 0.6
                            font.pointSize: Kirigami.Theme.smallFont.pointSize
                        }
                    }

                    PlasmaComponents3.Label {
                        visible: !!card.modelData.account
                        Layout.fillWidth: true
                        text: card.modelData.account || ""
                        elide: Text.ElideMiddle
                        opacity: 0.6
                        font.pointSize: Kirigami.Theme.smallFont.pointSize
                    }

                    PlasmaComponents3.Label {
                        visible: !!card.modelData.error
                        Layout.fillWidth: true
                        text: card.modelData.error || ""
                        wrapMode: Text.WordWrap
                        color: Kirigami.Theme.negativeTextColor
                        font.pointSize: Kirigami.Theme.smallFont.pointSize
                    }

                    Repeater {
                        model: card.modelData.windows

                        delegate: ColumnLayout {
                            id: windowRow
                            required property var modelData
                            required property int index
                            Layout.fillWidth: true
                            spacing: 0

                            RowLayout {
                                Layout.fillWidth: true
                                spacing: Kirigami.Units.smallSpacing

                                Rectangle {
                                    width: Kirigami.Units.smallSpacing * 2
                                    height: width
                                    radius: width / 2
                                    color: card.ringColor(windowRow.index)
                                }

                                PlasmaComponents3.Label {
                                    text: windowRow.modelData.label
                                    font.pointSize: Kirigami.Theme.smallFont.pointSize
                                }

                                Item { Layout.fillWidth: true }

                                PlasmaComponents3.Label {
                                    text: i18n("%1% used", windowRow.modelData.usedPercent)
                                    font.pointSize: Kirigami.Theme.smallFont.pointSize
                                    color: full.stageColor(windowRow.modelData.usedPercent)
                                }

                                PlasmaComponents3.Label {
                                    text: "· " + full.resetText(windowRow.modelData)
                                    visible: full.resetText(windowRow.modelData).length > 0
                                    opacity: 0.6
                                    font.pointSize: Kirigami.Theme.smallFont.pointSize
                                }
                            }

                            PlasmaComponents3.Label {
                                visible: root.showPace && windowRow.modelData.paceSummary.length > 0
                                Layout.fillWidth: true
                                Layout.leftMargin: Kirigami.Units.smallSpacing * 2 + Kirigami.Units.smallSpacing
                                text: windowRow.modelData.paceSummary
                                elide: Text.ElideRight
                                opacity: 0.5
                                font.pointSize: Kirigami.Theme.smallFont.pointSize
                            }
                        }
                    }

                    PlasmaComponents3.Label {
                        visible: card.modelData.credits !== null && card.modelData.credits > 0
                        text: i18n("Credits: %1", card.modelData.credits !== null
                            ? Number(card.modelData.credits).toLocaleString(Qt.locale(), "f", 1)
                            : "")
                        font.pointSize: Kirigami.Theme.smallFont.pointSize
                        opacity: 0.7
                    }
                }
            }
        }
    }
}
