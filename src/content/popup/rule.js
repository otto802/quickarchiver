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

let rule = {};

async function ruleSave() {

    if (typeof (rule.index) !== "undefined") {

        rule.from = document.getElementById("from").value;
        rule.to = document.getElementById("to").value;
        rule.subject = document.getElementById("subject").value;
        rule.activeFrom = document.getElementById("active-from").checked;
        rule.activeTo = document.getElementById("active-to").checked;
        rule.activeSubject = document.getElementById("active-subject").checked;

        await messenger.runtime.sendMessage({
            command: "requestRuleUpdate",
            rule: rule
        });

        await messenger.runtime.sendMessage({
            command: "requestRefreshList"
        });

    }
    window.close();
}

async function ruleCancel() {
    window.close();
}

async function ruleDelete() {

    if (typeof (rule.index) !== "undefined") {
        await messenger.runtime.sendMessage({
            command: "requestRuleDelete",
            rule: rule
        });

        await messenger.runtime.sendMessage({
            command: "requestRefreshList"
        });
    }
    window.close();
}

messenger.runtime.onMessage.addListener(async (broadcastMessage) => {
    if (broadcastMessage && broadcastMessage.hasOwnProperty("command")) {

        console.info("Broadcast Message received: " + broadcastMessage.command);

        if (broadcastMessage.command === "transmitRule" && broadcastMessage.rule) {

            rule = broadcastMessage.rule;

            document.getElementById("from").value = rule.from;
            document.getElementById("to").value = rule.to;
            document.getElementById("subject").value = rule.subject;
            document.getElementById("active-from").checked = rule.activeFrom;
            document.getElementById("active-to").checked = rule.activeTo;
            document.getElementById("active-subject").checked = rule.activeSubject;
            document.getElementById("folder").value = rule.folder.path;
        }
    }
});

async function onLoad() {

    document.getElementById("button_save").addEventListener("click", ruleSave);
    document.getElementById("button_cancel").addEventListener("click", ruleCancel);
    document.getElementById("button_delete").addEventListener("click", ruleDelete);

    await messenger.runtime.sendMessage({
        command: "requestRule"
    });
}

