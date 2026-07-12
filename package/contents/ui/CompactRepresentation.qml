import QtQuick
import QtQuick.Layouts
import org.kde.plasma.plasmoid
import org.kde.plasma.components as PlasmaComponents3
import org.kde.kirigami as Kirigami
import "../code/parser.js" as Parser

// Panel view: one mini usage meter per provider (short badge + fill bar).
Item {
    id: compact

    readonly property int itemWidth: Kirigami.Units.gridUnit * 2.4

    Layout.minimumWidth: meterRow.implicitWidth + Kirigami.Units.smallSpacing * 2
    Layout.minimumHeight: Kirigami.Units.iconSizes.small

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

    RowLayout {
        id: meterRow
        anchors.centerIn: parent
        spacing: Kirigami.Units.smallSpacing * 2

        Kirigami.Icon {
            visible: root.models.length === 0
            source: "office-chart-bar"
            Layout.preferredWidth: Kirigami.Units.iconSizes.small
            Layout.preferredHeight: Kirigami.Units.iconSizes.small
            opacity: root.loading ? 0.5 : 1
        }

        Repeater {
            model: root.models

            delegate: ColumnLayout {
                id: meter
                required property var modelData
                readonly property int worst: Parser.worstUsedPercent(modelData)
                readonly property bool hasData: worst >= 0 && !modelData.error

                spacing: 1
                Layout.preferredWidth: compact.itemWidth

                PlasmaComponents3.Label {
                    Layout.alignment: Qt.AlignHCenter
                    text: Parser.shortName(meter.modelData.id)
                        + (meter.hasData ? " " + (100 - meter.worst) + "%" : "")
                    font.pixelSize: Math.max(Kirigami.Units.gridUnit * 0.55, 9)
                    color: meter.modelData.error
                        ? Kirigami.Theme.negativeTextColor
                        : Kirigami.Theme.textColor
                }

                Rectangle {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 3
                    radius: 1.5
                    color: Qt.alpha(Kirigami.Theme.textColor, 0.25)

                    Rectangle {
                        anchors.left: parent.left
                        anchors.top: parent.top
                        anchors.bottom: parent.bottom
                        radius: parent.radius
                        width: meter.hasData ? parent.width * meter.worst / 100 : 0
                        color: compact.stageColor(meter.worst)
                    }
                }
            }
        }
    }

    MouseArea {
        anchors.fill: parent
        onClicked: root.expanded = !root.expanded
    }
}
