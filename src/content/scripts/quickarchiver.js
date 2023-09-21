let quickarchiver = {

    rules: {},

    init: async function () {

        return new Promise((resolve) => {
            resolve(true);
        });

    },

    movedMessages: async function (messages) {

        for (let i in messages) {
            let message = messages[i];

            console.info("Moved message:");

            await this.updateRule("from", this.parseEmail(message.author), message.folder)

        }
    },
    initRules: async function () {
        let rules = await messenger.storage.local.get('rules');

        if (typeof (rules.rules) === "undefined") {
            this.rules = {
                from: []
            };
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
    getFolder: async function(header){

        await this.initRules();

        for (let i in this.rules.from) {

            if (this.rules.from[i].value === this.parseEmail(header.from[0])) {
                return new Promise((resolve) => {
                    resolve(this.rules.from[i].folder);
                });
            }
        }

    },
    getRule: async function(header){

        await this.initRules();

        for (let i in this.rules.from) {

            if (this.rules.from[i].value === this.parseEmail(header.from[0])) {
                return new Promise((resolve) => {
                    resolve(this.rules.from[i]);
                });
            }
        }

    },
    updateRule: async function (type, value, folder) {

        if (typeof(folder.type) !== "undefined" && folder.type === "inbox"){

            console.info("Ignore the Inbox folder!")

            return new Promise((resolve) => {
                resolve(true);
            });
        }

        await this.initRules();

        let found_index = false;

        for (let i in this.rules[type]) {

            if (this.rules[type][i].value === value) {
                found_index = i;
            }
        }

        if (found_index !== false) {
            // update rule
            this.rules[type][found_index].folder = folder;
        } else {
            // add rule
            this.rules[type].push({
                value: value,
                folder: folder
            });
        }

        await this.saveRules();

        return new Promise((resolve) => {
            resolve(true);
        });
    },
    moveMail: async function(message) {

        let full = await messenger.messages.getFull(message.id);
        let folder = await this.getFolder(full.headers);

        if (folder) {
            try {
                await messenger.messages.move([message.id], folder);
                console.info("Moved message with id " + message.id + " to folder " + folder.path);
            } catch(ex) {
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