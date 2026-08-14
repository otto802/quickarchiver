/**
 * QuickArchiver
 * Copyright (c) 2026 Otto Berger <otto@bergerdata.de>
 *
 * QuickArchiver is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

window.addEventListener("load", onLoad);

let folders = [];
let requestedFolderId = new URL(window.location.href).searchParams.get("folderId") ?? "";
let requestedFolderPath = new URL(window.location.href).searchParams.get("folderPath") ?? "";

async function onLoad() {
    document.getElementById("button-select").addEventListener("click", selectFolder);
    document.getElementById("button-cancel").addEventListener("click", closePicker);
    document.getElementById("folder-search").addEventListener("input", renderFolders);
    document.getElementById("folder-account-filter").addEventListener("change", renderFolders);
    document.getElementById("folder-select").addEventListener("dblclick", selectFolder);

    await messenger.runtime.sendMessage({command: "requestFolderList"});
}

async function closePicker() {
    window.close();
}

async function selectFolder() {
    let selected = document.getElementById("folder-select").selectedOptions[0];
    if (!selected) {
        return;
    }

    await messenger.runtime.sendMessage({
        command: "selectFolderForRule",
        folder: folders[Number(selected.value)],
    });
    await closePicker();
}

function getDisplayPath(path) {
    let displayPath = String(path ?? "").replace(/^\/?INBOX(?=\/|$)/i, "");
    return displayPath || "/";
}

function renderFolders() {
    let search = document.getElementById("folder-search").value.trim().toLocaleLowerCase();
    let accountId = document.getElementById("folder-account-filter").value;
    let select = document.getElementById("folder-select");
    select.replaceChildren();

    folders.forEach((folder, index) => {
        let label = getDisplayPath(folder.path);
        if (accountId && folder.accountId !== accountId) {
            return;
        }
        if (search && !label.toLocaleLowerCase().includes(search)) {
            return;
        }

        let option = document.createElement("option");
        option.value = index;
        option.textContent = label;
        option.selected = folder.id === requestedFolderId
            || (!requestedFolderId && folder.path === requestedFolderPath);
        select.appendChild(option);
    });

    document.getElementById("button-select").disabled = select.options.length === 0;
    document.getElementById("folder-status").textContent = select.options.length === 0
        ? browser.i18n.getMessage("popup.folder.status.empty")
        : "";
}

messenger.runtime.onMessage.addListener(async (broadcastMessage) => {
    if (broadcastMessage?.command === "transmitFolderList") {
        folders = broadcastMessage.folders ?? [];
        let accountFilter = document.getElementById("folder-account-filter");
        let accounts = new Map();
        for (let folder of folders) {
            accounts.set(folder.accountId, folder.accountName);
        }

        accountFilter.replaceChildren();
        for (let [accountId, accountName] of accounts) {
            let option = document.createElement("option");
            option.value = accountId;
            option.textContent = accountName;
            accountFilter.appendChild(option);
        }

        let currentFolder = folders.find(folder => folder.id === requestedFolderId
            || (!requestedFolderId && folder.path === requestedFolderPath));
        if (currentFolder) {
            accountFilter.value = currentFolder.accountId;
        } else if (accountFilter.options.length > 0) {
            accountFilter.selectedIndex = 0;
        }

        renderFolders();
    }
});
