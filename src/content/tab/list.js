window.addEventListener("load", onLoad);

let rules = {};

async function onLoad() {

    document.getElementById("button_cancel").addEventListener("click", ruleCancel);

    await messenger.runtime.sendMessage({
        command: "requestAllRules"
    });
}

async function ruleCancel() {
    window.close();
}

messenger.runtime.onMessage.addListener(async (broadcastMessage) => {

    if (broadcastMessage && broadcastMessage.hasOwnProperty("command")) {

        console.info("Broadcast Message received: " + broadcastMessage.command);

        if (broadcastMessage.command === "transmitAllRules" && broadcastMessage.rules) {
            rules = broadcastMessage.rules
            await renderTable();
        }
    }
});

async function renderTable() {

    let tab = new htmlSimpleTable();
    tab.setData(rules);
    tab.setTableConfig({
        table: {
            class: "qa-table system-font-size",
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
            },
            {
                field: "index",
                title: "Edit",
                createChild: function (value, key) {

                    let a = document.createElement("a");
                    a.style = 'cursor:pointer';
                    a.onclick = async function () {

                        await messenger.runtime.sendMessage({
                            command: "requestOpenRulePopup",
                            ruleId: key
                        });
                    }
                    a.textContent = "Edit";

                    return a;
                }
            }
        ]
    });

    let s = tab.build();
    document.getElementById("rule-list-table").textContent = null;
    document.getElementById("rule-list-table").appendChild(s);
}
