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

async function onLoad() {

    document.getElementById("button-tools").addEventListener("click", openTools);
    document.getElementById("button-all-rules").addEventListener("click", openAllRules);
    document.getElementById("button-about").addEventListener("click", openAboutTab);

}


async function openTools() {
    await messenger.runtime.sendMessage({
        command: "requestOpenToolsTab"
    });
}

async function openAllRules() {
    await messenger.runtime.sendMessage({
        command: "requestOpenAllRulesTab"
    });
}

async function openAboutTab() {
    await messenger.runtime.sendMessage({
        command: "requestOpenAboutTab"
    });
}