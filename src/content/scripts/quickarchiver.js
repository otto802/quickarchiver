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

let quickarchiver = {

    rules: {},
    defaultRule: {
        from: '',
        to: '',
        subject: '',
        activeFrom: false,
        activeTo: false,
        activeSubject: false,
        activeAccount: false,
        accountId: '',
        folder: {},
    },
    currentRule: null,
    currentMessage: null,
    toolbarMenuEditRuleId: 'qa_edit',
    toolbarMenuListRulesId: 'qa_list',
    toolbarMenuAboutId: 'qa_about',
    toolbarMenuMoveId: 'qa_move',
    toolbarMenuOptionsId: 'qa_options',
    toolbarMenuPopupOnNewRuleId: 'qa_popup_on_new_rule',
    columnId: 'quickarchiverFolder',
    columnRegistered: false,
    openRulePopupOnNewRule: false,

    getMessages: function (messageList) {
        // MV3 returns a MessageList. Keep accepting arrays for compatibility
        // with older Thunderbird versions and existing callers.
        return Array.isArray(messageList) ? messageList : (messageList?.messages ?? []);
    },

    describeError: function (error) {
        return {
            name: error?.name,
            message: error?.message,
            code: error?.code,
            stack: error?.stack,
        };
    },

    getFolderId: async function (folder) {
        // MV3 messages.move() expects a MailFolderId, not a MailFolder object.
        if (typeof folder === "string") {
            console.info("[QuickArchiver move] Destination is already an ID", {
                folderId: folder,
            });
            return folder;
        }
        if (folder?.id) {
            console.info("[QuickArchiver move] Resolved destination from rule", {
                folderId: folder.id,
                path: folder.path,
                accountId: folder.accountId,
            });
            return folder.id;
        }

        // Rules created by MV2 contain accountId/path but no folder id.
        // Resolve those legacy rules once against the current folder tree.
        if (folder?.accountId && folder?.path && messenger.folders?.query) {
            let folders = await messenger.folders.query({accountId: folder.accountId});
            let resolvedFolder = folders.find(candidate => candidate.path === folder.path);
            console.info("[QuickArchiver move] Resolved legacy destination", {
                accountId: folder.accountId,
                path: folder.path,
                folderId: resolvedFolder?.id ?? null,
                folderCount: folders.length,
            });
            return resolvedFolder?.id ?? null;
        }

        console.warn("[QuickArchiver move] Could not resolve destination", {folder});
        return null;
    },

    createMenus: async function () {

        // Recreate only this extension's menus. This also cleans up menus
        // created by older MV2 versions during an update.
        await messenger.menus.removeAll();

        let settings = await messenger.storage.local.get('openRulePopupOnNewRule');
        this.openRulePopupOnNewRule = settings.openRulePopupOnNewRule === true;

        await messenger.menus.create({
            id: this.toolbarMenuEditRuleId,
            contexts: ["message_display_action", "message_list"],
            title: browser.i18n.getMessage("toolbar.menu.title.edit_rule"),
            enabled: false,
        });
        await messenger.menus.create({
            id: this.toolbarMenuListRulesId,
            contexts: ["message_display_action", "message_list"],
            title: browser.i18n.getMessage("toolbar.menu.title.list_rules"),
        });
        await messenger.menus.create({
            id: this.toolbarMenuOptionsId,
            contexts: ["message_display_action", "message_list"],
            title: browser.i18n.getMessage("toolbar.menu.title.options"),
        });
        await messenger.menus.create({
            id: this.toolbarMenuPopupOnNewRuleId,
            parentId: this.toolbarMenuOptionsId,
            contexts: ["message_display_action", "message_list"],
            type: "checkbox",
            checked: this.openRulePopupOnNewRule,
            title: browser.i18n.getMessage("toolbar.menu.title.popup_on_new_rule"),
        });
        await messenger.menus.create({
            id: this.toolbarMenuAboutId,
            contexts: ["message_display_action"],
            title: browser.i18n.getMessage("toolbar.menu.title.about"),
        });
        await messenger.menus.create({
            id: this.toolbarMenuMoveId,
            contexts: ["message_list"],
            title: browser.i18n.getMessage("toolbar.label.rule_present"),
            enabled: false,
        });

    },

    updateOpenRulePopupOnNewRule: async function (enabled) {
        this.openRulePopupOnNewRule = enabled === true;
        await messenger.storage.local.set({
            openRulePopupOnNewRule: this.openRulePopupOnNewRule,
        });
        await messenger.menus.update(this.toolbarMenuPopupOnNewRuleId, {
            checked: this.openRulePopupOnNewRule,
        });
    },

    handleMovedMessages: async function (messages, originalMessages = []) {

        let popupOpened = false;

        for (let index = 0; index < messages.length; index++) {
            const message = messages[index];
            const originalMessage = originalMessages[index] ?? message;

            console.info("Check moved message with subject '" + message.subject + "'");

            // The moved message points to the destination folder. Account
            // restrictions refer to the source account, so rule lookup must
            // use the original message from the onMoved event.
            let rule = await this.findRule(originalMessage);

            if (!rule) {
                let index = await this.createDefaultRule(message, {
                    allowSpecialFolder: this.openRulePopupOnNewRule,
                    sourceMessage: originalMessage,
                });

                if (this.openRulePopupOnNewRule && index !== false && !popupOpened) {
                    this.currentMessage = message;
                    this.currentRule = await this.getRule(index);
                    popupOpened = true;
                    await this.openRulePopup(this.currentRule);
                }
            } else {
                console.info("Rule for message with subject '" + message.subject + "' already exists.");
            }
        }
    },
    isSpecialFolder: function (folder, specialUse, legacyType) {
        return folder?.type === legacyType
            || (Array.isArray(folder?.specialUse)
                && folder.specialUse.includes(specialUse));
    },
    createDefaultRule: async function (message, options = {}) {

        let allowSpecialFolder = options.allowSpecialFolder === true;
        let sourceMessage = options.sourceMessage ?? message;

        if (!allowSpecialFolder && this.isSpecialFolder(message?.folder, "inbox", "inbox")) {

            console.warn("Ignored the inbox folder destination!");
            return false;
        }

        if (!allowSpecialFolder && this.isSpecialFolder(message?.folder, "trash", "trash")) {

            console.warn("Ignored the trash folder destination!");
            return false;
        }

        console.info("Create default rule for message with subject '" + message.subject + "'");

        let index = await this.createRule({
            activeFrom: true,
            from: this.getMessageHeaderValue(sourceMessage, "author"),
            to: this.getMessageHeaderValue(sourceMessage, "recipients"),
            subject: this.getMessageHeaderValue(sourceMessage, "subject"),
            accountId: sourceMessage?.folder?.accountId ?? '',
            folder: message.folder,
        })

        this.refreshColumnAfterMove();

        return new Promise((resolve) => {
            resolve(index);
        });
    },

    initRules: async function () {

        if (!Array.isArray(this.rules)) {
            await this.loadRules();
        }
        return true;
    },
    refreshColumnAfterMove: function () {
        // Thunderbird may still be rebuilding the moved message row when
        // messages.onMoved fires. Refresh once more after the thread pane has
        // had a chance to display the new row.
        setTimeout(async () => {
            try {
                await this.initRules();
                await this.initColumn();
            } catch (error) {
                console.error("Could not refresh QuickArchiver folder column after move", error);
            }
        }, 250);
    },
    normalizeFolder: function (folder) {
        // A stored folder only needs the stable identity and display path.
        // The other properties are metadata from the current Thunderbird
        // folder tree and can make the rules database unnecessarily large.
        if (!folder || typeof folder !== "object" || Array.isArray(folder)) {
            return folder;
        }

        let compactFolder = {};
        for (let key of ["id", "path", "accountId"]) {
            if (typeof folder[key] !== "undefined") {
                compactFolder[key] = folder[key];
            }
        }

        // Keep malformed/legacy values intact if they do not contain any of
        // the fields understood by the current folder representation.
        return Object.keys(compactFolder).length > 0 ? compactFolder : folder;
    },
    normalizeRules: function (rules) {
        if (!Array.isArray(rules)) {
            return rules;
        }

        return rules.map(rule => {
            if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
                return rule;
            }

            let folder = this.normalizeFolder(rule.folder);
            return folder === rule.folder ? rule : {...rule, folder};
        });
    },
    loadRules: async function () {
        let rules = await messenger.storage.local.get('rules');

        if (typeof (rules.rules) === "undefined") {
            this.rules = [];
        } else {
            this.rules = rules.rules;
        }

        let normalizedRules = this.normalizeRules(this.rules);
        if (JSON.stringify(normalizedRules) !== JSON.stringify(this.rules)) {
            this.rules = normalizedRules;
            await messenger.storage.local.set({rules: this.rules});
            console.info("QuickArchiver rule database migrated: compacted stored folders.");
        }

        return true;
    },
    initColumn: async function () {
        if (typeof messenger.customColumns?.add !== "function") {
            console.warn("QuickArchiver folder column API is unavailable.");
            return false;
        }

        if (!this.columnRegistered) {
            await messenger.customColumns.add(
                this.columnId,
                browser.i18n.getMessage("column.quickarchiverFolder"),
                this.rules,
                browser.i18n.getMessage("column.currentFolder")
            );
            this.columnRegistered = true;
        } else {
            let updated = await messenger.customColumns.setRules(this.columnId, this.rules);
            if (updated === false) {
                // The experiment may have been restarted while the MV3
                // background context was idle. Re-register the column so it
                // receives the current rule list and refreshes its cells.
                await messenger.customColumns.add(
                    this.columnId,
                    browser.i18n.getMessage("column.quickarchiverFolder"),
                    this.rules,
                    browser.i18n.getMessage("column.currentFolder")
                );
            }
        }

        return true;
    },
    saveRules: async function () {
        // Also compact newly created and imported rules before persisting them.
        this.rules = this.normalizeRules(this.rules);
        await messenger.storage.local.set({
            rules: this.rules
        });

        // reload rules after changing them
        await this.loadRules();
        await this.initColumn();

        return true;
    },
    importRules: async function (importData) {

        // quick check of importedData
        for (let rule of importData) {

            if (typeof (rule.from) === "undefined"
                || typeof (rule.to) === "undefined"
                || typeof (rule.subject) === "undefined"
                || typeof (rule.folder) === "undefined") {
                return false;
            }
        }

        this.rules = importData
        await this.saveRules();

        return true;
    },

    findMatch: function (string, value) {
        return QuickArchiverRuleMatching.findMatch(string, value);
    },
    getMessageHeaderValue: function (message, type) {
        return QuickArchiverRuleMatching.getMessageHeaderValue(message, type);
    },

    /*
        Finds a matching rule according header data
    */
    findRule: async function (message) {

        await this.initRules();

        try {

            const rule = QuickArchiverRuleMatching.findRule(message, this.rules);
            if (rule) {
                rule.index = this.rules.indexOf(rule);
                return rule;
            }

        } catch (e) {
            console.error(e);
        }

        return false;
    },

    /*
        Creates a new rule in storage
    */
    createRule: async function (rule) {

        await this.initRules();

        let newRule = {...this.defaultRule};

        for (let key in newRule) {

            if (typeof (rule[key]) !== "undefined") {
                newRule[key] = rule[key];
            }
        }

        this.rules.push(newRule);

        await this.saveRules();

        return this.rules.length - 1;

    },

    /*
        Updates rule in storage
    */
    updateRule: async function (index, rule) {

        await this.initRules();

        let updateRule = {...this.defaultRule};

        for (let key in updateRule) {

            if (typeof (rule[key]) !== "undefined") {
                updateRule[key] = rule[key];
            }
        }

        this.rules[index] = updateRule;

        await this.saveRules();

        return index;
    },

    /*
        Returns rule in storage
    */
    getRule: async function (index) {

        await this.initRules();

        let rule = this.rules[index];
        if (!rule) {
            return false;
        }
        return {...rule, index};
    },

    /*
        Deletes rule from storage
    */
    deleteRule: async function (index) {

        await this.initRules();

        delete this.rules[index];

        // remove null values after deletion
        this.rules = this.rules.filter(function (element) {
            return element != null;
        });

        await this.saveRules();

        return index;
    },

    openRulePopup: async function (rule = null) {

        let url = "content/popup/rule.html";
        if (rule && typeof rule.index !== "undefined") {
            url += "?ruleIndex=" + encodeURIComponent(rule.index);
        }

        await messenger.windows.create({
            url,
            type: "popup",
            height: 640,
            width: 600,
            allowScriptsToClose: true
        });
    },

    openFolderPicker: async function (folderId = "", folderPath = "") {
        let params = new URLSearchParams();
        if (folderId) {
            params.set("folderId", folderId);
        }
        if (folderPath) {
            params.set("folderPath", folderPath);
        }

        let url = "content/popup/folder.html";
        let query = params.toString();
        if (query) {
            url += "?" + query;
        }

        await messenger.windows.create({
            url,
            type: "popup",
            height: 650,
            width: 560,
            allowScriptsToClose: true,
        });
    },

    openAllRulesTab: async function () {

        await messenger.tabs.create({
            url: "content/tab/list.html",
        });
    },

    openAboutTab: function () {

        let path = browser.i18n.getMessage("locale.aboutUrl");

        messenger.tabs.create({
            url: "content/tab/" + path,
        });
    },

    openToolsTab: function () {

        messenger.tabs.create({
            url: "content/tab/tools.html",
        });
    },

    getThemeColorScheme: async function () {

        let theme = await messenger.theme.getCurrent();

        if ((theme.properties && theme.properties.color_scheme === "dark")
            || (window.matchMedia && !!window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            return "dark";
        }
        return "light";
    },

    /*
        Creates and update the toolbar button
     */
    updateToolbarEntry: async function (message) {

        if (message == null) {
            return new Promise((resolve) => {
                resolve(false);
            });
        }

        this.currentMessage = message;

        try {

            let rule = await quickarchiver.findRule(message);

            let color_scheme = await this.getThemeColorScheme();

            if (rule && rule.folder) {

                this.currentRule = rule;

                messenger.messageDisplayAction.enable();

                if (this.messageIsInFolder(message, rule.folder)) {
                    messenger.messageDisplayAction.setIcon({path: "content/icons/" + color_scheme + "/qa_edit.svg"});
                    // messenger.messageDisplayAction.setThemeIcons
                    messenger.messageDisplayAction.setTitle({
                        title: browser.i18n.getMessage("toolbar.title.rule_edit")
                    });
                    messenger.messageDisplayAction.setLabel({label: browser.i18n.getMessage("toolbar.label.rule_edit")});
                } else {
                    messenger.messageDisplayAction.setIcon({path: "content/icons/" + color_scheme + "/qa_move.svg"});
                    messenger.messageDisplayAction.setTitle({
                        title: browser.i18n.getMessage("toolbar.title.rule_present", [
                            message.subject,
                            rule.folder.path
                        ])
                    });
                    messenger.messageDisplayAction.setLabel({label: browser.i18n.getMessage("toolbar.label.rule_present")});
                }

                await messenger.menus.update(this.toolbarMenuEditRuleId, {enabled: true});


                await messenger.menus.update(this.toolbarMenuMoveId, {enabled: true});

            } else {

                messenger.messageDisplayAction.setTitle({title: browser.i18n.getMessage("toolbar.title.rule_notfound")});
                messenger.messageDisplayAction.setLabel({label: browser.i18n.getMessage("toolbar.label")});
                messenger.messageDisplayAction.setIcon({path: "content/icons/" + color_scheme + "/qa_move.svg"});
                messenger.messageDisplayAction.disable();

                this.currentRule = null;
                await messenger.menus.update(this.toolbarMenuEditRuleId, {enabled: false});
                await messenger.menus.update(this.toolbarMenuMoveId, {enabled: false});
            }


        } catch (e) {
            console.error(e);
        }
    },

    messageIsInFolder: function (message, folder) {
        return folder.path === message.folder.path && folder.accountId === message.folder.accountId;
    },

    moveMails: async function (messages) {

        console.info("[QuickArchiver move] Starting batch", {
            count: messages?.length ?? 0,
            messageIds: messages?.map(message => message.id) ?? [],
        });

        for (let index = 0; index < (messages?.length ?? 0); index++) {
            const message = messages[index];
            console.info("[QuickArchiver move] Processing batch item", {
                index,
                messageId: message?.id,
                subject: message?.subject,
            });
            await this.moveMail(message);
        }

        console.info("[QuickArchiver move] Batch finished");
    },

    moveMail: async function (message) {

        console.info("[QuickArchiver move] Start message", {
            messageId: message?.id,
            subject: message?.subject,
            sourceFolder: message?.folder
                ? {
                    id: message.folder.id,
                    path: message.folder.path,
                    accountId: message.folder.accountId,
                    type: message.folder.type,
                    specialUse: message.folder.specialUse,
                }
                : null,
        });

        if (message == null) {
            console.warn("[QuickArchiver move] Skipping empty message");
            return new Promise((resolve) => {
                resolve(false);
            });
        }

        let rule = await this.findRule(message);

        console.info("[QuickArchiver move] Rule lookup result", {
            messageId: message.id,
            matched: Boolean(rule),
            ruleIndex: rule?.index,
            destination: rule?.folder
                ? {
                    id: rule.folder.id,
                    path: rule.folder.path,
                    accountId: rule.folder.accountId,
                }
                : null,
        });

        if (rule && rule.folder) {
            try {
                let folderId = await this.getFolderId(rule.folder);
                if (!folderId) {
                    console.error("Could not resolve destination folder", rule.folder);
                    return false;
                }

                // A selected IMAP message can still be represented by a
                // partially loaded message object. Fetch it once before the
                // move so Thunderbird has a current message header.
                try {
                    message = await messenger.messages.get(message.id);
                    console.info("[QuickArchiver move] Refreshed message", {
                        messageId: message.id,
                        subject: message.subject,
                        sourceFolderId: message.folder?.id,
                    });
                } catch (refreshError) {
                    console.warn("[QuickArchiver move] Could not refresh message; using selected message", {
                        messageId: message.id,
                        error: refreshError,
                    });
                }

                console.info("[QuickArchiver move] Calling messages.move", {
                    messageId: message.id,
                    destinationFolderId: folderId,
                });
                await messenger.messages.move([message.id], folderId);
                console.info("[QuickArchiver move] messages.move succeeded", {
                    messageId: message.id,
                    destinationFolderId: folderId,
                });
                console.info("Moved message with with subject '" + message.subject + "' to folder '" + rule.folder.path + "'");
            } catch (ex) {
                console.error("[QuickArchiver move] messages.move failed", {
                    messageId: message.id,
                    destination: rule.folder,
                    error: this.describeError(ex),
                });
            }
        } else {
            console.info("[QuickArchiver move] No rule found", {
                messageId: message.id,
                subject: message.subject,
            });
        }
    },

    moveMailOrOpenRulePopupIfSameFolder: async function (message) {

        if (message == null) {
            return new Promise((resolve) => {
                resolve(false);
            });
        }

        let rule = await this.findRule(message);

        if (rule && rule.folder && this.messageIsInFolder(message, rule.folder)) {

            await this.openRulePopup();

        } else if (rule && rule.folder) {

            try {
                let folderId = await this.getFolderId(rule.folder);
                if (!folderId) {
                    console.error("Could not resolve destination folder", rule.folder);
                    return false;
                }
                await messenger.messages.move([message.id], folderId);
                console.info("Moved message with with subject '" + message.subject + "' to folder '" + rule.folder.path + "'");
            } catch (ex) {
                console.error(ex);
            }
        } else {
            console.info("No rule found to move message with subject '" + message.subject + "'.");
        }
    },
    getAllRules: async function () {
        await this.initRules();
        return this.rules;
    },
    getAccounts: async function () {
        if (typeof messenger.accounts?.list !== "function") {
            return [];
        }

        try {
            return (await messenger.accounts.list()).map(account => ({
                id: account.id,
                name: account.name || account.id,
                email: account.identities?.[0]?.email || ''
            }));
        } catch (error) {
            console.warn("Could not load Thunderbird accounts", error);
            return [];
        }
    },
    getSelectableFolders: async function () {
        if (typeof messenger.folders?.query !== "function") {
            return [];
        }

        try {
            let accounts = await this.getAccounts();
            let accountNames = new Map(accounts.map(account => [account.id, account.name]));
            let folders = await messenger.folders.query({canAddMessages: true});

            return folders.map(folder => ({
                id: folder.id,
                path: folder.path,
                accountId: folder.accountId,
                name: folder.name,
                accountName: accountNames.get(folder.accountId) ?? folder.accountId,
            }));
        } catch (error) {
            console.warn("Could not load selectable folders", error);
            return [];
        }
    },
    handleBroadcastMessage: async function (broadcastMessage) {

        if (broadcastMessage && broadcastMessage.hasOwnProperty("command")) {

            console.info("Broadcast Message received: " + broadcastMessage.command);

            switch (broadcastMessage.command) {

                case "requestRule":

                    let requestedRule = this.currentRule;
                    if (typeof broadcastMessage.ruleIndex !== "undefined") {
                        requestedRule = await this.getRule(Number(broadcastMessage.ruleIndex));
                    }

                    await messenger.runtime.sendMessage({
                        command: "transmitRule",
                        rule: requestedRule,
                        accounts: await this.getAccounts(),
                        openRulePopupOnNewRule: this.openRulePopupOnNewRule,
                    });
                    break;
                case "updateOpenRulePopupOnNewRule":

                    await this.updateOpenRulePopupOnNewRule(broadcastMessage.enabled);
                    break;
                case "requestRuleUpdate":

                    if (broadcastMessage.rule) {
                        await quickarchiver.updateRule(broadcastMessage.rule.index, broadcastMessage.rule);
                        await quickarchiver.updateToolbarEntry(this.currentMessage);
                    }
                    break;
                case "requestRuleDelete":

                    if (broadcastMessage.rule) {
                        await quickarchiver.deleteRule(broadcastMessage.rule.index);
                        await quickarchiver.updateToolbarEntry(this.currentMessage);

                        // trigger reload of the rule table (if any)
                        await messenger.runtime.sendMessage({
                            command: "transmitAllRules",
                            rules: await this.getAllRules(),
                            accounts: await this.getAccounts(),
                        });
                    }
                    break;
                case "requestRefreshList":
                case "requestAllRules":

                    await messenger.runtime.sendMessage({
                        command: "transmitAllRules",
                        rules: await this.getAllRules(),
                        accounts: await this.getAccounts(),
                    });
                    break;
                case "requestToolsImportRules":

                    if (broadcastMessage.importData) {
                        let ret = await this.importRules(broadcastMessage.importData);

                        if (ret) {
                            await messenger.runtime.sendMessage({
                                command: "transmitToolsImportResponse",
                                message: browser.i18n.getMessage("tab.tools.backup.import.message.success")
                            });

                            // trigger reload of the rule table
                            await messenger.runtime.sendMessage({
                                command: "transmitAllRules",
                                rules: await this.getAllRules(),
                                accounts: await this.getAccounts(),
                            });
                        } else {

                            await messenger.runtime.sendMessage({
                                command: "transmitToolsImportResponse",
                                message: browser.i18n.getMessage("tab.tools.backup.import.message.failed")
                            });
                        }
                    }

                    break;
                case "requestOpenRulePopup":

                    if (broadcastMessage.ruleId) {
                        this.currentRule = await this.getRule(broadcastMessage.ruleId)
                        await this.openRulePopup();
                    }
                    break;
                case "requestOpenFolderPicker":

                    await this.openFolderPicker(
                        broadcastMessage.folderId,
                        broadcastMessage.folderPath
                    );
                    break;
                case "requestFolderList":

                    await messenger.runtime.sendMessage({
                        command: "transmitFolderList",
                        folders: await this.getSelectableFolders(),
                    });
                    break;
                case "selectFolderForRule":

                    await messenger.runtime.sendMessage({
                        command: "transmitSelectedFolder",
                        folder: broadcastMessage.folder,
                    });
                    break;
                case "requestOpenToolsTab":

                    await this.openToolsTab();
                    break;
                case "requestOpenAllRulesTab":

                    await this.openAllRulesTab();
                    break;
                case "requestOpenAboutTab":

                    await this.openAboutTab();
                    break;
            }
        }
    },
    parseEmail: function (string) {
        return QuickArchiverRuleMatching.parseEmail(string);
    },
}
