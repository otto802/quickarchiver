/**
 * QuickArchiver
 * Copyright (c) 2023 Otto Berger <otto@bergerdata.de>
 *
 * QuickArchiver is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with QuickArchiver. If not, see <http://www.gnu.org/licenses/>.
 */


window.addEventListener("load", onLoad);

let rules = {};

async function onLoad() {

    document.getElementById("button_cancel").addEventListener("click", ruleCancel);

    await messenger.runtime.sendMessage({
        command: "requestAllRules"
    });
}

async function ruleCancel() {
    window.close();
}

messenger.runtime.onMessage.addListener(async (broadcastMessage) => {

    if (broadcastMessage && broadcastMessage.hasOwnProperty("command")) {

        console.info("Broadcast Message received: " + broadcastMessage.command);

        if (broadcastMessage.command === "transmitAllRules" && broadcastMessage.rules) {
            rules = broadcastMessage.rules
            await renderTable();
        }
    }
});

async function renderTable() {

    let tab = new htmlSimpleTable();
    tab.setData(rules);
    tab.setTableConfig({
        table: {
            class: "qa-table system-font-size",
            rowHighlighter: function (key) {
                return (key % 2) ? "highlight" : "";
            }
        },
        fields: [
            {
                field: "from",
                title: "From"
            },
            {
                field: "to",
                title: "To"
            },
            {
                field: "subject",
                title: "Subject"
            },
            {
                field: "folder",
                title: "Folder",
                formatterField: function (value) {
                    return value.path;
                }
            },
            {
                field: "index",
                title: "Edit",
                createChild: function (value, key) {

                    let a = document.createElement("a");
                    a.style = 'cursor:pointer';
                    a.onclick = async function () {

                        await messenger.runtime.sendMessage({
                            command: "requestOpenRulePopup",
                            ruleId: key
                        });
                    }
                    a.textContent = "Edit";

                    return a;
                }
            }
        ]
    });

    let s = tab.build();
    document.getElementById("rule-list-table").textContent = null;
    document.getElementById("rule-list-table").appendChild(s);
}
