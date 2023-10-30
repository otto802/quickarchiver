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
    document.getElementById("tools-export").addEventListener("click", selectAll);

    await messenger.runtime.sendMessage({
        command: "requestAllRules"
    });
}



async function toolsImport() {

    if (!confirm(browser.i18n.getMessage("tab.tools.backup.import.message.confirm"))) {
        return false;
    }

    let text = document.getElementById("tools-import").value;

    try{
        let data = JSON.parse(text);

        await messenger.runtime.sendMessage({
            command: "requestToolsImportRules",
            importData: data
        });

    } catch (e){
        alert(browser.i18n.getMessage("tab.tools.backup.import.message.parse_error"));
    }
}


async function closeTab() {
    window.close();
}

async function selectAll() {
    this.select();
}


async function openTools() {
    await messenger.runtime.sendMessage({
        command: "requestOpenToolsTab"
    });
}

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
