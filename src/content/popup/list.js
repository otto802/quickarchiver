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

    console.debug(rules);

    let table = document.getElementById("rule-list-table");

    await buildTableHead(table, {
        from: "FROM",
        to: "TO",
        subject: "SUBJECT",
        activeFrom: "FROM",
        activeTo: "FROM",
        activeSubject: "FROM",
        folder: "FOLDER"
    });
    await buildTableBody(table, rules);

}

function buildTableHead(table, data) {
    let thead = table.createTHead();
    let row = thead.insertRow();
    for (let key in data) {


        let th = document.createElement("th");
        let value = document.createTextNode(data[key]);
        th.appendChild(value);
        row.appendChild(th);
    }
}

function buildTableBody(table, data) {
    for (let row_data of data) {
        let row = table.insertRow();
        for (let key in row_data) {
            let cell = row.insertCell();
            let value = document.createTextNode(row_data[key]);
            cell.appendChild(value);
        }
    }
}

