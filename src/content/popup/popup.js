window.addEventListener("load", onLoad);

let rule = {};
let messageId = {};

async function notifyMode(event) {
    await messenger.runtime.sendMessage({
        popupResponse: event.target.getAttribute("data")
    });
    window.close();
}

async function ruleSave(event) {

    if (typeof (rule.index) !== "undefined") {

        rule.from = document.getElementById("from").value;
        rule.to = document.getElementById("to").value;
        rule.subject = document.getElementById("subject").value;
        rule.activeFrom = document.getElementById("active-from").checked;
        rule.activeTo = document.getElementById("active-to").checked;
        rule.activeSubject = document.getElementById("active-subject").checked;

        await quickarchiver.updateRule(rule.index, rule);
        await quickarchiver.updateToolbarEntry(messageId);
    }
    window.close();
}

async function ruleCancel(event) {
    window.close();
}


async function ruleDelete(event) {
    if (typeof (rule.index) !== "undefined") {
        await quickarchiver.deleteRule(rule.index);
        await quickarchiver.updateToolbarEntry(messageId);
    }
    window.close();
}


messenger.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message && message.hasOwnProperty("command")) {

        if (message.command === "setMessageId") {
            messageId = message.messageId;

            let full = await messenger.messages.getFull(messageId);

            rule = await quickarchiver.findRule(full.headers);

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
        command: "getMessageId"
    });

}
