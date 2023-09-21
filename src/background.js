(async () => {

    let currentMessageId = false;

    messenger.messageDisplay.onMessageDisplayed.addListener(async (tab, message) => {

        messenger.messageDisplayAction.setTitle({title: 'No role found'});
        messenger.messageDisplayAction.setLabel({label: 'QuickArchiver'});
        messenger.messageDisplayAction.disable();

        let full = await messenger.messages.getFull(message.id);
        let folder = await quickarchiver.getFolder(full.headers);

        currentMessageId = message.id;

        await messenger.menus.create({
            contexts: ["message_display_action"],
            id: 'qa_edit',
            title: "Edit QuickArchiver rule",
            onclick: function () {

                let window = messenger.windows.create({
                    url: "content/popup/rule.html",
                    type: "popup",
                    height: 500,
                    width: 600,
                    allowScriptsToClose: true,
                });

            }
        });

        if (folder) {

            messenger.messageDisplayAction.enable();
            messenger.messageDisplayAction.setTitle({title: 'Move "' + message.subject + '" to Folder ' + folder.path});
            messenger.messageDisplayAction.setLabel({label: 'QuickArchiver: Move'});
        }
    });

    messenger.commands.onCommand.addListener(async (command, tab) => {

        if (command === "quickarchiver_move") {
            let message = await messenger.messageDisplay.getDisplayedMessage(tab.id);
            await quickarchiver.moveMail(message);
        }
    });

    messenger.messageDisplayAction.onClicked.addListener(async (tab, info) => {

        let message = await messenger.messageDisplay.getDisplayedMessage(tab.id);
        await quickarchiver.moveMail(message);
    });

    //onMoved listener. fired when tab is moved into the same window
    messenger.messages.onMoved.addListener(async (originalMessages, movedMessages) => {

        await quickarchiver.movedMessages(movedMessages.messages);
    });

    messenger.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message && message.hasOwnProperty("command")) {

            if (message.command === "getMessageId") {
                messenger.runtime.sendMessage({
                    command: "setMessageId",
                    messageId: currentMessageId
                });
            }
        }
    });

})()