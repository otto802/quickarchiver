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

(async () => {

    // at the first start after install the onMessageDisplayed gets not fired
    // therefore handle all opened messages

    let tabs = (await messenger.tabs.query({})).filter(t => ["messageDisplay", "mail"].includes(t.type));

    for (let tab of tabs) {
        let message = await messenger.messageDisplay.getDisplayedMessage(tab.id);

        if (message) {
            await quickarchiver.updateToolbarEntry(message);
        }
    }

    // onMessageDisplayed listener. Fires when a email-message gets displayed.
    messenger.messageDisplay.onMessageDisplayed.addListener(async (tab, message) => {
        await quickarchiver.updateToolbarEntry(message);
    });

    // onClicked listener. Fires when the toolbar button is clicked.
    messenger.messageDisplayAction.onClicked.addListener(async (tab) => {

        let message = await messenger.messageDisplay.getDisplayedMessage(tab.id);
        await quickarchiver.moveMailOrOpenRulePopupIfSameFolder(message);
    });

    // onCommand listener. Fires when the command key is pressed.
    messenger.commands.onCommand.addListener(async (command, tab) => {

        if (command === "quickarchiver_move") {
            let messages = await messenger.messageDisplay.getDisplayedMessages(tab.id);
            await quickarchiver.moveMails(messages);
        }
    });

    // onMoved listener. fired when message is moved to a folder.
    messenger.messages.onMoved.addListener(async (originalMessages, movedMessages) => {
        await quickarchiver.handleMovedMessages(movedMessages.messages);
    });

    // onMessage listener. fired when an internal message is sent via the internal message bus.
    // not an actual email-message ;-)
    messenger.runtime.onMessage.addListener(async (message) => {
        await quickarchiver.handleBroadcastMessage(message);
    });

    // onInstalled listener. fires quickArchiver got an update.
    messenger.runtime.onInstalled.addListener((info) => {
        quickarchiver.openAboutTab(info);
    });

})()