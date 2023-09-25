(async () => {

    // onMessageDisplayed listener. Fires when a email-message gets displayed.
    messenger.messageDisplay.onMessageDisplayed.addListener(async (tab, message) => {
        await quickarchiver.updateToolbarEntry(message.id);
    });


    // onClicked listener. Fires when the toolbar button is clicked.
    messenger.messageDisplayAction.onClicked.addListener(async (tab, info) => {

        let message = await messenger.messageDisplay.getDisplayedMessage(tab.id);
        await quickarchiver.moveMail(message);
    });

    // onCommand listener. Fires when the command key is pressed.
    messenger.commands.onCommand.addListener(async (command, tab) => {

        if (command === "quickarchiver_move") {
            let message = await messenger.messageDisplay.getDisplayedMessage(tab.id);
            await quickarchiver.moveMail(message);
        }
    });

    // onMoved listener. fired when message is moved to a folder.
    messenger.messages.onMoved.addListener(async (originalMessages, movedMessages) => {

        await quickarchiver.checkMovedMessages(movedMessages.messages);
    });

    // onMessage listener. fired when an internal message is sent via the internal message bus.
    // not an actual email-message ;-)
    messenger.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message && message.hasOwnProperty("command")) {

            if (message.command === "getMessageId") {
                messenger.runtime.sendMessage({
                    command: "setMessageId",
                    messageId: quickarchiver.currentMessageId
                });
            }
        }
    });

})()