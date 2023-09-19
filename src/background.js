(async () => {

    messenger.messageDisplay.onMessageDisplayed.addListener(async (tab, message) => {

        messenger.messageDisplayAction.setTitle({title: 'No role found'});
        messenger.messageDisplayAction.setLabel({label: 'QuickArchiver'});
        messenger.messageDisplayAction.disable();

        let full = await messenger.messages.getFull(message.id);
        let folder = await quickarchiver.getFolder(full.headers);

        if (folder) {

            messenger.messageDisplayAction.enable();
            messenger.messageDisplayAction.setTitle({title: 'Move "' + message.subject + '" to Folder ' + folder.path});
            messenger.messageDisplayAction.setLabel({label: 'QuickArchiver: Move'});

            console.info("Create menu");
            await messenger.menus.create({
                contexts: ["message_display_action"],
                id: 'qa_edit',
                title: "Edit QuickArchiver rule",
                onclick: awaitPopup
            });
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


    // Function to open a popup and await user feedback
    async function awaitPopup() {
        async function popupPrompt(popupId, defaultResponse) {
            try {
                await messenger.windows.get(popupId);
            } catch (e) {
                // Window does not exist, assume closed.
                return defaultResponse;
            }
            return new Promise(resolve => {
                let response = defaultResponse;

                function windowRemoveListener(closedId) {
                    if (popupId == closedId) {
                        messenger.windows.onRemoved.removeListener(windowRemoveListener);
                        messenger.runtime.onMessage.removeListener(messageListener);
                        resolve(response);
                    }
                }

                function messageListener(request, sender, sendResponse) {
                    if (sender.tab.windowId != popupId || !request) {
                        return;
                    }

                    if (request.popupResponse) {
                        response = request.popupResponse;
                    }
                }

                messenger.runtime.onMessage.addListener(messageListener);
                messenger.windows.onRemoved.addListener(windowRemoveListener);
            });
        }

        let window = await messenger.windows.create({
            url: "content/popup.html",
            type: "popup",
            height: 280,
            width: 390,
            allowScriptsToClose: true,
        });
        // Wait for the popup to be closed and define a default return value if the
        // window is closed without clicking a button.
        let rv = await popupPrompt(window.id, "cancel");
        console.log(rv);
    }

// Listener to trigger the popup.
    //messenger.browserAction.onClicked.addListener(awaitPopup);

})()