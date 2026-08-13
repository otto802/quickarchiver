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
    let columnReannouncedTabs = new Set();
    let shouldReannounceColumn = false;

    let reannounceColumn = async () => {
        try {
            await messenger.customColumns.reannounce(quickarchiver.columnId);
        } catch (error) {
            console.error("Could not reannounce QuickArchiver folder column", error);
        }
    };

    // Thunderbird 153 can create the 3-pane mail tab after the experiment
    // has registered the column. Reannounce after that tab has finished
    // loading so its column picker receives the definition.
    messenger.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
        if (changeInfo.status === "complete"
            && ["mail", "messageDisplay"].includes(tab?.type)
            && shouldReannounceColumn
            && !columnReannouncedTabs.has(tabId)) {
            columnReannouncedTabs.add(tabId);
            await reannounceColumn();
        }
    });

    messenger.tabs.onRemoved.addListener((tabId) => {
        columnReannouncedTabs.delete(tabId);
    });

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

    // MV3 event pages can be restarted at any time. Recreate the extension's
    // menus before handling the initially displayed messages below.
    await quickarchiver.createMenus();
    await quickarchiver.initRules();
    await quickarchiver.initColumn();
    shouldReannounceColumn = quickarchiver.columnReconnected === true;

    // On Thunderbird restart the experiment can retain the registered
    // column while the newly created 3-pane view has not received its
    // registration event. Reannounce only in that reconnect case.
    if (quickarchiver.columnReconnected) {
        let readyTabs = (await messenger.tabs.query({})).filter(tab =>
            ["mail", "messageDisplay"].includes(tab.type)
            && tab.status === "complete"
        );
        if (readyTabs.length > 0) {
            for (let tab of readyTabs) {
                if (!columnReannouncedTabs.has(tab.id)) {
                    columnReannouncedTabs.add(tab.id);
                    await reannounceColumn();
                }
            }
        }
    }

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
