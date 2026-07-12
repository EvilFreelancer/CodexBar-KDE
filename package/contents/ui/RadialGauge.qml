import QtQuick
import QtQuick.Shapes
import org.kde.kirigami as Kirigami
import "../code/parser.js" as Parser

// Two-ring radial gauge: outer ring = session window, inner ring = weekly
// window. A percent of -1 leaves the ring as a bare track.
Item {
    id: gauge

    property real outerPercent: -1
    property real innerPercent: -1
    property color outerColor: Kirigami.Theme.highlightColor
    property color innerColor: "#f67400"
    property string centerText: ""
    property real centerTextScale: 0.32

    readonly property real ringWidth: Math.max(2, Math.min(width, height) / 15)
    readonly property real ringGap: ringWidth * 1.2
    readonly property real outerRadius: (Math.min(width, height) - ringWidth) / 2
    readonly property real innerRadius: outerRadius - ringWidth - ringGap
    readonly property color trackColor: Qt.alpha(Kirigami.Theme.textColor, 0.18)

    Shape {
        anchors.fill: parent
        preferredRendererType: Shape.CurveRenderer

        // Outer track.
        ShapePath {
            strokeColor: gauge.trackColor
            fillColor: "transparent"
            strokeWidth: gauge.ringWidth
            capStyle: ShapePath.FlatCap
            PathAngleArc {
                centerX: gauge.width / 2
                centerY: gauge.height / 2
                radiusX: gauge.outerRadius
                radiusY: gauge.outerRadius
                startAngle: 0
                sweepAngle: 360
            }
        }

        // Inner track.
        ShapePath {
            strokeColor: gauge.trackColor
            fillColor: "transparent"
            strokeWidth: gauge.ringWidth
            capStyle: ShapePath.FlatCap
            PathAngleArc {
                centerX: gauge.width / 2
                centerY: gauge.height / 2
                radiusX: gauge.innerRadius
                radiusY: gauge.innerRadius
                startAngle: 0
                sweepAngle: 360
            }
        }

        // Outer progress (session).
        ShapePath {
            strokeColor: gauge.outerColor
            fillColor: "transparent"
            strokeWidth: gauge.ringWidth
            capStyle: ShapePath.RoundCap
            PathAngleArc {
                centerX: gauge.width / 2
                centerY: gauge.height / 2
                radiusX: gauge.outerRadius
                radiusY: gauge.outerRadius
                startAngle: -90
                sweepAngle: gauge.outerPercent >= 0 ? Parser.sweepAngle(gauge.outerPercent) : 0
            }
        }

        // Inner progress (weekly).
        ShapePath {
            strokeColor: gauge.innerColor
            fillColor: "transparent"
            strokeWidth: gauge.ringWidth
            capStyle: ShapePath.RoundCap
            PathAngleArc {
                centerX: gauge.width / 2
                centerY: gauge.height / 2
                radiusX: gauge.innerRadius
                radiusY: gauge.innerRadius
                startAngle: -90
                sweepAngle: gauge.innerPercent >= 0 ? Parser.sweepAngle(gauge.innerPercent) : 0
            }
        }
    }

    Text {
        anchors.centerIn: parent
        visible: gauge.centerText.length > 0
        text: gauge.centerText
        color: Kirigami.Theme.textColor
        font.pixelSize: Math.max(7, Math.min(gauge.width, gauge.height) * gauge.centerTextScale)
        font.bold: true
    }
}
