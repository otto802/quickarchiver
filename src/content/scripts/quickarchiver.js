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
    currentMessageId: null,

    checkMovedMessages: async function (messages) {

        for (let i in messages) {
            let message = messages[i];

            let full = await messenger.messages.getFull(message.id);
            let rule = await this.findRule(full.headers);

            console.info("Moved message: " + message.subject);

            if (!rule) {
                await this.createDefaultRule(full.headers, message.folder);
            } else {
                console.info("Rule already exists.");
            }

        }
    },
    createDefaultRule: async function (headers, folder) {


        if (typeof (folder.type) !== "undefined" && folder.type === "inbox") {

            console.warn("Ignored the inbox folder destination!");

            return new Promise((resolve) => {
                resolve(false);
            });
        }

        if (typeof (folder.type) !== "undefined" && folder.type === "trash") {

            console.warn("Ignored the trash folder destination!");

            return new Promise((resolve) => {
                resolve(false);
            });
        }

        console.info("Create default rule for message " + headers.subject);

        let index = await this.createRule({
            activeFrom: true,
            from: this.parseEmail(headers.from[0]),
            to: this.parseEmail(headers.to[0]),
            subject: headers.subject[0],
            folder: folder,
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

    /*
        Finds a matching rule according header data
    */
    findRule: async function (header) {

        await this.initRules();

        let match = false;

        for (let i in this.rules) {

            let rule = this.rules[i];

            if (rule.activeFrom && this.parseEmail(header.from[0]).search(rule.from) !== -1) {
                match = true;
            } else if (rule.activeFrom) {
                match = false;
            }

            if (rule.activeTo && this.parseEmail(header.to[0]).search(rule.to) !== -1) {
                match = true;
            } else if (rule.activeTo) {
                match = false;
            }

            if (rule.activeSubject && header.subject[0].search(rule.subject) !== -1) {
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

    /*
        Creates and update the toolbar button
     */
    updateToolbarEntry: async function (messageId) {

        messenger.messageDisplayAction.setTitle({title: browser.i18n.getMessage("toolbar.title.rule_notfound")});
        messenger.messageDisplayAction.setLabel({label: browser.i18n.getMessage("toolbar.label")});
        messenger.messageDisplayAction.disable();

        let full = await messenger.messages.getFull(messageId);
        let rule = await quickarchiver.findRule(full.headers);

        this.currentMessageId = messageId;

        await messenger.menus.create({
            contexts: ["message_display_action"],
            id: 'qa_edit',
            title: browser.i18n.getMessage("toolbar.menu.title.edit_rule"),
            onclick: function () {

                messenger.windows.create({
                    url: "content/popup/rule.html",
                    type: "popup",
                    height: 500,
                    width: 600,
                    allowScriptsToClose: true,
                });

            }
        });

        if (rule && rule.folder) {

            messenger.messageDisplayAction.enable();
            messenger.messageDisplayAction.setTitle({
                title: browser.i18n.getMessage("toolbar.title.rule_present", [
                    full.headers.subject,
                    rule.folder.path
                ])
            });
            messenger.messageDisplayAction.setLabel({label: browser.i18n.getMessage("toolbar.label.rule_present")});
        }
    },

    moveMail: async function (message) {

        let full = await messenger.messages.getFull(message.id);
        let rule = await this.findRule(full.headers);

        if (rule && rule.folder) {
            try {
                await messenger.messages.move([message.id], rule.folder);
                console.info("Moved message with id " + message.id + " to folder " + rule.folder.path);
            } catch (ex) {
                console.error(ex);
            }
        }
    },
    parseEmail: function (string) {

        let email = string.match(/(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/g);

        if (email === null) {
            return '';
        }
        if (email.length > 1) {
            return email;
        } else {
            return email[0];
        }
    },
}