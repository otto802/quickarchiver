/**
 * QuickArchiver
 * Copyright (c) 2026 Otto Berger <otto@bergerdata.de>
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
    // onMessagesDisplayed listener. In MV3 this also covers a single message.
    messenger.messageDisplay.onMessagesDisplayed.addListener(async (tab, messageList) => {
        let messages = quickarchiver.getMessages(messageList);
        await quickarchiver.updateToolbarEntry(messages.length === 1 ? messages[0] : null);
    });

    // onClicked listener. Fires when the toolbar button is clicked.
    messenger.messageDisplayAction.onClicked.addListener(async (tab) => {

        let messageList = await messenger.messageDisplay.getDisplayedMessages(tab.id);
        let messages = quickarchiver.getMessages(messageList);
        let message = messages.length === 1 ? messages[0] : null;
        await quickarchiver.moveMailOrOpenRulePopupIfSameFolder(message);
    });

    // onCommand listener. Fires when the command key is pressed.
    messenger.commands.onCommand.addListener(async (command, tab) => {

        if (command === "quickarchiver_move") {
            let messageList = await messenger.messageDisplay.getDisplayedMessages(tab.id);
            let messages = quickarchiver.getMessages(messageList);
            console.info("[QuickArchiver move] Command received", {
                tabId: tab?.id,
                count: messages.length,
                messageIds: messages.map(message => message.id),
            });
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
        try {
            await quickarchiver.handleBroadcastMessage(message);
        } catch (error) {
            console.error("QuickArchiver message handling failed", {
                message,
                error,
            });
        }
        return true;
    });

    // MV3 event pages require menu items with fixed IDs and a central click handler.
    messenger.menus.onClicked.addListener(async (info) => {
        switch (info.menuItemId) {
            case quickarchiver.toolbarMenuEditRuleId:
                await quickarchiver.openRulePopup();
                break;
            case quickarchiver.toolbarMenuListRulesId:
                await quickarchiver.openAllRulesTab();
                break;
            case quickarchiver.toolbarMenuAboutId:
                await quickarchiver.openAboutTab();
                break;
            case quickarchiver.toolbarMenuMoveId:
                let selectedMessages = quickarchiver.getMessages(info.selectedMessages);
                console.info("[QuickArchiver move] Menu action received", {
                    count: selectedMessages.length,
                    messageIds: selectedMessages.map(message => message.id),
                });
                await quickarchiver.moveMails(selectedMessages);
                break;
            case quickarchiver.toolbarMenuPopupOnNewRuleId:
                quickarchiver.openRulePopupOnNewRule = !quickarchiver.openRulePopupOnNewRule;
                await messenger.storage.local.set({
                    openRulePopupOnNewRule: quickarchiver.openRulePopupOnNewRule,
                });
                await messenger.menus.update(quickarchiver.toolbarMenuPopupOnNewRuleId, {
                    checked: quickarchiver.openRulePopupOnNewRule,
                });
                break;
        }
    });

    // onInstalled listener. fires when quickArchiver got an update.
    messenger.runtime.onInstalled.addListener(async (info) => {
        quickarchiver.openAboutTab(info);
    });

    // MV3 event pages can otherwise be woken only by a later mail event.
    // Thunderbird must initialize the column at application startup, before
    // the user selects a message in the thread pane.
    messenger.runtime.onStartup.addListener(async () => {
        try {
            await quickarchiver.initRules();
            await quickarchiver.initColumn();
        } catch (error) {
            console.error("QuickArchiver startup initialization failed", error);
        }
    });

    // MV3 event pages can be restarted at any time. Recreate the extension's
    // menus before handling the initially displayed messages below.
    await quickarchiver.createMenus();
    await quickarchiver.initRules();
    await quickarchiver.initColumn();

    // at the first start after install the display event may not be fired
    // therefore handle all opened messages

    let tabs = (await messenger.tabs.query({})).filter(t => ["messageDisplay", "mail"].includes(t.type));

    for (let tab of tabs) {
        let messageList = await messenger.messageDisplay.getDisplayedMessages(tab.id);
        let messages = quickarchiver.getMessages(messageList);
        let message = messages.length === 1 ? messages[0] : null;

        if (message) {
            await quickarchiver.updateToolbarEntry(message);
        }
    }


})()
