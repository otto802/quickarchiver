window.addEventListener("load", onLoad);

async function notifyMode(event) {
    await messenger.runtime.sendMessage({
        popupResponse: event.target.getAttribute("data")
    });
    window.close();
}


messenger.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message && message.hasOwnProperty("command")) {

        if (message.command === "setMessageId") {
            let full = await messenger.messages.getFull(message.messageId);
            console.debug(full);
        }
    }
});


async function onLoad() {
    document.getElementById("button_ok").addEventListener("click", notifyMode);
    document.getElementById("button_cancel").addEventListener("click", notifyMode);

    await messenger.runtime.sendMessage({
        command: "getMessageId"
    });

}
