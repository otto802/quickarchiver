window.addEventListener("load", onLoad);


async function notifyMode(event) {
    await messenger.runtime.sendMessage({
        popupResponse: event.target.getAttribute("data")
    });
    window.close();
}

async function ruleCancel() {
    window.close();
}

/*
messenger.runtime.onMessage.addListener(async (broadcastMessage) => {
    if (broadcastMessage && broadcastMessage.hasOwnProperty("command")) {

        if (broadcastMessage.command === "setMailMessage" && broadcastMessage.mailMessage) {
            message = broadcastMessage.mailMessage;

            rule = await quickarchiver.findRule(message);

            document.getElementById("from").value = rule.from;
            document.getElementById("to").value = rule.to;
            document.getElementById("subject").value = rule.subject;
            document.getElementById("active-from").checked = rule.activeFrom;
            document.getElementById("active-to").checked = rule.activeTo;
            document.getElementById("active-subject").checked = rule.activeSubject;
            document.getElementById("folder").value = rule.folder.path;
        }
    }
});
*/

async function onLoad() {

    document.getElementById("button_cancel").addEventListener("click", ruleCancel);

    /*await messenger.runtime.sendMessage({
        command: "getMailMessage"
    });*/


    let rules = await quickarchiver.getAllRules();

    let tab = new htmlSimpleTable();
    tab.setData(rules);
    tab.setTableConfig({
        table: {
            class: "qa-table",
            rowHighlighter: function (key) {
                return (key % 2) ? "highlight" : "";
            }
        },
        fields: [
            {
                field: "from",
                title: "From"
            },
            {
                field: "to",
                title: "To"
            },
            {
                field: "subject",
                title: "Subject"
            },
            {
                field: "folder",
                title: "Folder",
                formatterField: function (value) {
                    return value.path;
                }
            }
        ]
    });

    let s = tab.build();

    console.debug(s);

    document.getElementById("rule-list-table").appendChild(s);

}