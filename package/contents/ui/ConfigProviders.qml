import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.kirigami as Kirigami
import "../code/parser.js" as Parser

ColumnLayout {
    id: page

    property string cfg_selectedProviders: ""

    readonly property var selectedList: Parser.selectionList(page.cfg_selectedProviders)

    function isSelected(id) {
        return page.selectedList.indexOf(id) !== -1
    }

    function toggle(id, checked) {
        page.cfg_selectedProviders = Parser.toggleSelection(page.cfg_selectedProviders, id, checked)
    }

    QQC2.Label {
        Layout.fillWidth: true
        wrapMode: Text.WordWrap
        text: i18n("Pick the coding agents to display. With nothing selected, the widget shows the providers enabled in the CodexBar CLI config (~/.config/codexbar/config.json).")
    }

    Kirigami.SearchField {
        id: searchField
        Layout.fillWidth: true
        placeholderText: i18n("Filter providers…")
    }

    QQC2.ScrollView {
        Layout.fillWidth: true
        Layout.fillHeight: true

        ListView {
            id: providerListView
            clip: true
            model: {
                var query = searchField.text.toLowerCase().trim()
                if (query.length === 0) {
                    return Parser.PROVIDER_CATALOG
                }
                return Parser.PROVIDER_CATALOG.filter(function(p) {
                    return p.id.indexOf(query) !== -1
                        || p.name.toLowerCase().indexOf(query) !== -1
                })
            }

            delegate: QQC2.CheckDelegate {
                required property var modelData
                width: providerListView.width
                text: modelData.name + " (" + modelData.id + ")"
                checked: page.isSelected(modelData.id)
                onToggled: page.toggle(modelData.id, checked)
            }
        }
    }

    QQC2.Label {
        Layout.fillWidth: true
        text: page.selectedList.length > 0
            ? i18np("%1 provider selected", "%1 providers selected", page.selectedList.length)
            : i18n("Following the CLI config")
        opacity: 0.6
        font.pointSize: Kirigami.Theme.smallFont.pointSize
    }
}
