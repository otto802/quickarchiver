var quickarchiverDialog = {
    params: {},
    onLoad: function () {
        quickarchiverSqlite.onLoad();
        this.params = window.arguments[0];

        if (this.params.sent.field) {
            document.getElementById("field").selectedItem = document.getElementById(this.params.sent.field);
        }

        document.getElementById("desc-folder").value = this.params.sent.folderPath;

        this.switchRadio();

        // handle events

        document.addEventListener("dialogaccept", function(event) {
            quickarchiverDialog.send();
        });
        document.addEventListener("dialogextra1", function(event) {
            quickarchiverDialog.deleteRule();
        });

    },
    deleteRule: function () {
        let strings = document.getElementById("quickarchiver-dialog-strings");

        let prompts =
            Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
                getService(Components.interfaces.nsIPromptService);

        if (prompts.confirm(window, strings.getString('confirmDeleteRuleTitle'), strings.getString('confirmDeleteRule'))) {

            if (this.params.sent.id) {
                quickarchiverSqlite.dbRemoveRule(this.params.sent.id);
            }
            window.close();
        }
    },
    send: function () {
        var ret_vals = {
            value: document.getElementById("value").value,
            field: document.getElementById("field").selectedItem.value
        }

        window.arguments[0].returned = ret_vals;

        return true;
    },
    switchGroup: function () {

        if (document.getElementById("custom").checked) {
            document.getElementById("value").disabled = false;
            document.getElementById("value-label").disabled = false;
            // document.getElementById("regex").disabled = false;
        } else {
            document.getElementById("value").disabled = true;
            document.getElementById("value-label").disabled = true;
            //document.getElementById("regex").disabled = true;
        }
    },
    switchRadio: function () {

        var field = document.getElementById("field").selectedItem.value;

        var params = window.arguments[0];

        switch (field) {

            case "to" :
                document.getElementById("value").value = params.sent.to;
                break;
            case "from" :
                document.getElementById("value").value = params.sent.from;
                break;
            case "subject" :
                document.getElementById("value").value = params.sent.subject;
                break;
        }
    }
};

