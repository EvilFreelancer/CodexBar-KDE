import QtQuick
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

// Rounded per-day spend bars for the last N days (zero days render as dots).
Item {
    id: chart

    property var series: []
    property color accentColor: Kirigami.Theme.highlightColor

    readonly property real maxValue: {
        var max = 0
        for (var i = 0; i < chart.series.length; i++) {
            if (chart.series[i].value > max) {
                max = chart.series[i].value
            }
        }
        return max
    }

    RowLayout {
        anchors.fill: parent
        spacing: 2

        Repeater {
            model: chart.series

            delegate: Item {
                required property var modelData

                Layout.fillWidth: true
                Layout.fillHeight: true

                Rectangle {
                    anchors.left: parent.left
                    anchors.right: parent.right
                    anchors.bottom: parent.bottom
                    height: chart.maxValue > 0
                        ? Math.max(3, parent.height * modelData.value / chart.maxValue)
                        : 3
                    radius: Math.min(width / 2, 4)
                    color: chart.accentColor
                    opacity: modelData.value > 0 ? 0.75 : 0.2
                }
            }
        }
    }
}
