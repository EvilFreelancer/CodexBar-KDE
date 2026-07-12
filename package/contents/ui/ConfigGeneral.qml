import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.FormLayout {
    id: page

    property alias cfg_codexbarPath: pathField.text
    property alias cfg_refreshMinutes: refreshSpin.value
    property alias cfg_showPace: paceCheck.checked

    QQC2.TextField {
        id: pathField
        Kirigami.FormData.label: i18n("codexbar binary:")
        placeholderText: "codexbar"
        Layout.fillWidth: true
    }

    QQC2.Label {
        text: i18n("Plain name is resolved via PATH (including ~/.local/bin); an absolute path also works.")
        font.pointSize: Kirigami.Theme.smallFont.pointSize
        opacity: 0.6
        Layout.fillWidth: true
        wrapMode: Text.WordWrap
    }

    QQC2.SpinBox {
        id: refreshSpin
        Kirigami.FormData.label: i18n("Refresh every:")
        from: 1
        to: 120
        textFromValue: function(value) { return i18np("%1 minute", "%1 minutes", value) }
        valueFromText: function(text) { return parseInt(text) || 5 }
    }

    QQC2.CheckBox {
        id: paceCheck
        Kirigami.FormData.label: i18n("Details:")
        text: i18n("Show pace summaries")
    }
}
