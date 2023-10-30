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

    document.getElementById("button-cancel").addEventListener("click", closeTab);
    document.getElementById("button-import").addEventListener("click", toolsImport);
    document.getElementById("button-export").addEventListener("click", toolsExport);

    document.getElementById("import-file").addEventListener("change", toolsImportFile);

    await messenger.runtime.sendMessage({
        command: "requestAllRules"
    });
}

function toolsImportFile() {

    let reader = new FileReader();
    reader.addEventListener(
        "load",
        async () => {

            try {
                let data = JSON.parse(reader.result);

                if (!confirm(browser.i18n.getMessage("tab.tools.backup.import.message.confirm"))) {
                    return false;
                }

                await messenger.runtime.sendMessage({
                    command: "requestToolsImportRules",
                    importData: data
                });

            } catch (e) {
                alert(browser.i18n.getMessage("tab.tools.backup.import.message.parse_error"));
            }
        },
        false,
    );

    let files = document.getElementById("import-file");
    if (typeof (files.files) !== "undefined") {
        reader.readAsText(files.files[0]);
    }
}


async function toolsImport() {
    document.getElementById("import-file").click();
}


async function toolsExport() {

    let today = new Date();
    let dateStr = today.toISOString();
    dateStr = dateStr.replaceAll(":", "");
    dateStr = dateStr.replaceAll("-", "");
    dateStr = dateStr.substring(0, 15);

    saveAsFile(rules, "QuickArchiver-RulesExport-" + dateStr + ".json");
}


async function closeTab() {
    window.close();
}

async function openTools() {
    await messenger.runtime.sendMessage({
        command: "requestOpenToolsTab"
    });
}

let saveAsFile = (function () {
    let a = document.createElement("a");
    a.style = "display:none";
    document.body.appendChild(a);
    return function (data, fileName) {
        let json = JSON.stringify(data, null, 4),
            blob = new Blob([json], {type: "octet/stream"}),
            url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);
    };
}());

messenger.runtime.onMessage.addListener(async (broadcastMessage) => {

    if (broadcastMessage && broadcastMessage.hasOwnProperty("command")) {

        console.info("Broadcast Message received: " + broadcastMessage.command);

        if (broadcastMessage.command === "transmitAllRules" && broadcastMessage.rules) {
            rules = broadcastMessage.rules
            await renderExport();
        }
        if (broadcastMessage.command === "transmitToolsImportResponse" && broadcastMessage.message) {
            alert(broadcastMessage.message);
            window.close();
        }
    }
});

async function renderExport() {
    document.getElementById("tools-export").textContent = JSON.stringify(rules, null, 4);
}
