let quickarchiver = {

    rules: {},
    defaultRule: {
        from: '',
        to: '',
        subject: '',
        activeFrom: false,
        activeTo: false,
        activeSubject: false,
        folder: {},
    },
    currentRule: null,
    currentMessage: null,
    toolbarMenuEditRuleId: null,
    toolbarMenuListRulesId: null,
    toolbarMenuAboutId: null,

    handleMovedMessages: async function (messages) {

        for (const message of messages) {

            console.info("Check moved message with subject '" + message.subject + "'");

            let rule = await this.findRule(message);

            if (!rule) {
                await this.createDefaultRule(message);
            } else {
                console.info("Rule for message with subject '" + message.subject + "' already exists.");
            }
        }
    },
    createDefaultRule: async function (message) {

        if (typeof (message.folder.type) !== "undefined" && message.folder.type === "inbox") {

            console.warn("Ignored the inbox folder destination!");

            return new Promise((resolve) => {
                resolve(false);
            });
        }

        if (typeof (message.folder.type) !== "undefined" && message.folder.type === "trash") {

            console.warn("Ignored the trash folder destination!");

            return new Promise((resolve) => {
                resolve(false);
            });
        }

        console.info("Create default rule for message with subject '" + message.subject + "'");

        let index = await this.createRule({
            activeFrom: true,
            from: this.getMessageHeaderValue(message, "author"),
            to: this.getMessageHeaderValue(message, "recipients"),
            subject: this.getMessageHeaderValue(message, "subject"),
            folder: message.folder,
        })

        return new Promise((resolve) => {
            resolve(index);
        });
    },

    initRules: async function () {
        let rules = await messenger.storage.local.get('rules');

        if (typeof (rules.rules) === "undefined") {
            this.rules = [];
        } else {
            this.rules = rules.rules;
        }

        return new Promise((resolve) => {
            resolve(true);
        });
    },
    saveRules: async function () {
        await messenger.storage.local.set({
            rules: this.rules
        });

        return new Promise((resolve) => {
            resolve(true);
        });
    },

    findMatch: function (string, value) {

        if (typeof (string) !== "string") {
            return false;
        }

        return string.search(value) !== -1;
    },
    getMessageHeaderValue: function (message, type) {

        let string = '';

        if (typeof (message[type]) === "string") {
            string = message[type];
        } else if (typeof (message[type]) !== "string") {
            string = message[type][0];
        }

        switch (type) {
            case "author":
            case "from":
            case "recipients":
            case "to":
                string = this.parseEmail(string);
                break;
        }

        return string;
    },

    /*
        Finds a matching rule according header data
    */
    findRule: async function (message) {

        await this.initRules();

        let match = false;

        try {

            for (let i in this.rules) {

                let rule = this.rules[i];

                if (rule.activeFrom && typeof (message.author) === "string"
                    && this.findMatch(this.getMessageHeaderValue(message, "author"), rule.from)) {
                    match = true;
                } else if (rule.activeFrom) {
                    match = false;
                }

                if (rule.activeTo && typeof (message.recipients[0]) === "string"
                    && this.findMatch(this.getMessageHeaderValue(message, "recipients"), rule.to)) {
                    match = true;
                } else if (rule.activeTo) {
                    match = false;
                }

                if (rule.activeSubject && typeof (message.subject) === "string"
                    && this.findMatch(this.getMessageHeaderValue(message, "subject"), rule.subject)) {
                    match = true;
                } else if (rule.activeSubject) {
                    match = false;
                }

                if (match) {
                    rule.index = i;
                    return new Promise((resolve) => {
                        resolve(rule);
                    });
                }
            }

        } catch (e) {
            console.error(e);
        }

        return new Promise((resolve) => {
            resolve(false);
        });
    },

    /*
        Creates a new rule in storage
    */
    createRule: async function (rule) {

        await this.initRules();

        let newRule = this.defaultRule;

        for (let key in newRule) {

            if (typeof (rule[key]) !== "undefined") {
                newRule[key] = rule[key];
            }
        }

        this.rules.push(newRule);

        await this.saveRules();

        return new Promise((resolve) => {
            resolve(this.rules.length - 1);
        });

    },

    /*
        Updates rule in storage
    */
    updateRule: async function (index, rule) {

        await this.initRules();

        let updateRule = this.defaultRule;

        for (let key in updateRule) {

            if (typeof (rule[key]) !== "undefined") {
                updateRule[key] = rule[key];
            }
        }

        this.rules[index] = updateRule;

        await this.saveRules();

        return new Promise((resolve) => {
            resolve(index);
        });
    },

    /*
        Returns rule in storage
    */
    getRule: async function (index) {

        await this.initRules();

        return new Promise((resolve) => {

            let rule = this.rules[index];
            rule.index = index;
            resolve(rule);
        });
    },

    /*
        Deletes rule from storage
    */
    deleteRule: async function (index) {

        await this.initRules();

        delete this.rules[index];

        await this.saveRules();

        return new Promise((resolve) => {
            resolve(index);
        });
    },

    openRulePopup: async function () {

        await messenger.windows.create({
            url: "content/popup/rule.html",
            type: "popup",
            height: 550,
            width: 600,
            allowScriptsToClose: true
        });
    },
    openAboutTab: function () {

        let path = browser.i18n.getMessage("locale.aboutUrl");

        messenger.tabs.create({
            url: "content/tab/" + path,
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

            let menuEditRuleProperties = {
                contexts: ["message_display_action"],
                title: browser.i18n.getMessage("toolbar.menu.title.edit_rule"),
                enabled: false,
                onclick: async function () {
                    await quickarchiver.openRulePopup();
                }
            };

            if (this.toolbarMenuEditRuleId) {

                // if menu exists, update it (avoid a console warning)
                await messenger.menus.update(this.toolbarMenuEditRuleId, menuEditRuleProperties);
            } else {
                menuEditRuleProperties['id'] = 'qa_edit';
                this.toolbarMenuEditRuleId = await messenger.menus.create(menuEditRuleProperties);
            }

            let menuListRulesProperties = {
                contexts: ["message_display_action"],
                title: browser.i18n.getMessage("toolbar.menu.title.list_rules"),
                onclick: function () {

                    messenger.tabs.create({
                        url: "content/tab/list.html",
                    });
                }
            };

            if (this.toolbarMenuListRulesId) {

                // if menu exists, update it (avoid a console warning)
                await messenger.menus.update(this.toolbarMenuListRulesId, menuListRulesProperties);
            } else {
                menuListRulesProperties['id'] = 'qa_list';
                this.toolbarMenuListRulesId = await messenger.menus.create(menuListRulesProperties);
            }

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

            } else {

                messenger.messageDisplayAction.setTitle({title: browser.i18n.getMessage("toolbar.title.rule_notfound")});
                messenger.messageDisplayAction.setLabel({label: browser.i18n.getMessage("toolbar.label")});
                messenger.messageDisplayAction.setIcon({path: "content/icons/" + color_scheme + "/qa_move.svg"});
                messenger.messageDisplayAction.disable();

                this.currentRule = null;
            }


            let menuAboutProperties = {
                contexts: ["message_display_action"],
                title: browser.i18n.getMessage("toolbar.menu.title.about"),
                onclick: function () {
                    quickarchiver.openAboutTab();
                }
            };

            if (this.toolbarMenuAboutId) {

                // if menu exists, update it (avoid a console warning)
                await messenger.menus.update(this.toolbarMenuAboutId, menuAboutProperties);
            } else {
                menuAboutProperties['id'] = 'qa_about';
                this.toolbarMenuAboutId = await messenger.menus.create(menuAboutProperties);
            }


        } catch (e) {
            console.error(e);
        }
    },

    messageIsInFolder: function (message, folder) {
        return folder.path === message.folder.path && folder.accountId === message.folder.accountId;
    },

    moveMails: async function (messages) {

        for (const message of messages) {
            await this.moveMail(message);
        }
    },

    moveMail: async function (message) {

        if (message == null) {
            return new Promise((resolve) => {
                resolve(false);
            });
        }

        let rule = await this.findRule(message);

        if (rule && rule.folder) {
            try {
                await messenger.messages.move([message.id], rule.folder);
                console.info("Moved message with with subject '" + message.subject + "' to folder '" + rule.folder.path + "'");
            } catch (ex) {
                console.error(ex);
            }
        } else {
            console.info("No rule found to move message with subject '" + message.subject + "'.");
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
                await messenger.messages.move([message.id], rule.folder);
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
    handleBroadcastMessage: async function (broadcastMessage) {

        if (broadcastMessage && broadcastMessage.hasOwnProperty("command")) {

            console.info("Broadcast Message received: " + broadcastMessage.command);

            switch (broadcastMessage.command) {

                case "requestRule":

                    await messenger.runtime.sendMessage({
                        command: "transmitRule",
                        rule: this.currentRule
                    });
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
                    }
                    break;
                case "requestRefreshList":
                case "requestAllRules":

                    await messenger.runtime.sendMessage({
                        command: "transmitAllRules",
                        rules: await this.getAllRules()
                    });
                    break;
                case "requestOpenRulePopup":

                    if (broadcastMessage.ruleId) {
                        this.currentRule = await this.getRule(broadcastMessage.ruleId)
                        await this.openRulePopup();
                    }
                    break;
            }
        }
    },
    parseEmail: function (string) {

        let email = string.match(/(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/g);

        if (email === null) {
            return '';
        }
        if (email.length > 1) {
            // return the last match if multiple addresses are found
            return email[email.length - 1];
        } else {
            return email[0];
        }
    },
}