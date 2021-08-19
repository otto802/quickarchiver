var quickarchiver_newMailListener = {
    msgsMoveCopyCompleted: function (aMove, aSrcMsgs, aDestFolder, aDestMsgs) {

        const nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;
        let ignoreFlags = nsMsgFolderFlags.Trash | nsMsgFolderFlags.SentMail |
            nsMsgFolderFlags.Drafts | nsMsgFolderFlags.Queue |
            nsMsgFolderFlags.Templates | nsMsgFolderFlags.Junk |
            nsMsgFolderFlags.Inbox;

        if (!(aDestFolder.flags & ignoreFlags)) { // isSpecialFlags does some strange hacks

            for (let msgHdr of aDestMsgs) {

                let rule = quickarchiverStorage.dbGetRuleFromHdr(msgHdr);

                if (!rule.id) {

                    // create default rule

                    quickarchiverStorage.dbInsertRule('from',
                        quickarchiverStorage.parseEmailAddress(msgHdr.author),
                        aDestFolder.URI,
                        "=");
                }
            }
        }
    }
};

var quickarchiverColumn = {
    CreateDbObserver: {
        // Components.interfaces.nsIObserver
        observe: function (aMsgFolder, aTopic, aData) {
            quickarchiverColumn.addCustomColumnHandler();
        }
    },
    addCustomColumnHandler: function () {
        gDBView.addColumnHandler("colQuickArchiver", quickarchiverColumn.columnHandler);
    },
    columnHandler: {
        getCellText: function (row, col) {

            if (gDBView.isContainer(row)) {
                return '';
            }

            let key = gDBView.getKeyAt(row);
            let hdr = gDBView.db.GetMsgHdrForKey(key);
            let rule = quickarchiverStorage.dbGetRuleFromHdr(hdr);

            if (rule.folder) {

                let folder = quickarchiver.getMsgFolderFromUri(rule.folder, false);

                // check if destination folder exists (if not remove rule)

                try {

                    // try to access msgDatabase for check folder as valid
                    // maybe there is a more elegant way to validate folder object

                    let db = folder.msgDatabase;

                    if (hdr.folder === folder) {
                        return quickarchiver.strings.getString("FolderIsAlreadyDestination");
                    }

                    return quickarchiver.getFullPathForList(folder);

                } catch (e) {
                    // folder not valid

                    quickarchiverStorage.dbRemoveRule(rule.id);
                    console.debug("invalid rule removed");
                }
            }
            return '';

        },
        getSortStringForRow: function (hdr) {

            let rule = quickarchiverStorage.dbGetRuleFromHdr(hdr);

            if (rule.folder) {
                return quickarchiver.getFullPathForList(quickarchiver.getMsgFolderFromUri(rule.folder, false));
            }
            return '';
        },
        isString: function () {
            return true;
        },
        getCellProperties: function (row, col, props) {

            if (gDBView.isContainer(row)) {
                return '';
            }

            let key = gDBView.getKeyAt(row);
            let hdr = gDBView.db.GetMsgHdrForKey(key);

            let rule = quickarchiverStorage.dbGetRuleFromHdr(hdr);

            if (rule.folder) {

                let folder = quickarchiver.getMsgFolderFromUri(rule.folder, false);

                if (hdr.folder === folder) {

                    // display a muted message if the destination folder is the same as the current folder

                    if (props) {
                        let aserv = Components.classes["@mozilla.org/atom-service;1"].getService(Components.interfaces.nsIAtomService);
                        props.AppendElement(aserv.getAtom("muted"));
                    } else {
                        return "muted";
                    }
                }
            }
        },
        getRowProperties: function (row, props) {
        },
        getImageSrc: function (row, col) {
            return null;
        },
        getSortLongForRow: function (hdr) {
            return 0;
        }
    }
};

var { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");

var quickarchiver = {
    tree: {},
    initialized: false,
    strings: {},
    copyService: {},
    onLoad: function () {

        this.initialized = true;
        this.strings = document.getElementById("quickarchiver-strings");
        quickarchiverStorage.init();

        let ObserverService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
        ObserverService.addObserver(quickarchiverColumn.CreateDbObserver, "MsgCreateDBView", false);

        this.tree = GetThreadTree();
        this.tree.addEventListener('click', quickarchiver.moveMailOnClickEvent, true);

        this.copyService = MailServices.copy  // Tb91
            || Components.classes["@mozilla.org/messenger/messagecopyservice;1"].getService(Ci.nsIMsgCopyService); // older

        var notificationService = Components.classes["@mozilla.org/messenger/msgnotificationservice;1"]
            .getService(Components.interfaces.nsIMsgFolderNotificationService);
        notificationService.addListener(quickarchiver_newMailListener, notificationService.msgsMoveCopyCompleted);
    },
    getMsgFolderFromUri: function (uri, checkFolderAttributes) {

        if (typeof MailUtils != 'undefined') {
            return MailUtils.getExistingFolder(uri, checkFolderAttributes);
        } else {
            GetMsgFolderFromUri(uri, checkFolderAttributes);
        }

    },
    getActualTopFolder: function () {

        let actual_top_folder;
        let folder = gFolderDisplay.displayedFolder;

        while (folder) {
            actual_top_folder = folder.name;
            folder = folder.parent;
        }

        return actual_top_folder;

    },

    getFullPath: function (folder) {

        let string = '';

        while (folder) {
            if (string.length == 0) {
                string = folder.name;
            } else {
                string = folder.name + "/" + string;
            }
            folder = folder.parent;
        }

        return string;
    },
    getFullPathForList: function (folder) {

        let string = '';
        let actual_top_folder = this.getActualTopFolder();
        let actual_folder = gFolderDisplay.displayedFolder;
        let folders = [];

        while (folder) {

            folders.push(folder.name);
            folder = folder.parent;
        }

        folders.reverse();

        if (folders.length > 1) {

            let displayFolders = [];

            for (let i in folders) {

                if (i == 0 && folders[i] == actual_top_folder) {

                    // don't display main folder of the selected account
                    continue;
                }

                if (i == folders.length - 1) {

                    // dont't display the target folder in brackets
                    continue;
                }

                if (folders[i] == actual_folder.name) {

                    // don't display actual folder in brackets
                    // reason/example: don't show the inbox folder in brackets
                    // if the target folder is a subfolder of inbox
                    // todo: make this configurable

                    continue;
                }

                displayFolders.push(folders[i]);
            }

            string = folders[folders.length - 1];

            if (displayFolders.length) {
                string += ' (' + displayFolders.join('/') + ')';
            }

        } else {
            string = folder.name;
        }

        return string;
    },
    notify: function (title, text) {
        try {
            Components.classes['@mozilla.org/alerts-service;1']
                .getService(Components.interfaces.nsIAlertsService)
                .showAlertNotification(null, title, text, false, '', null);
        } catch (e) {
            // prevents runtime error on platforms that don't implement nsIAlertsService
        }
    },
    showDialog: function (hdr, folder) {

        let rule = quickarchiverStorage.dbGetRuleFromHdr(hdr);

        if (rule.id && !folder) {
            folder = rule.folder;
        } else if (!folder) {
            folder = '';
        }

        let params = {
            sent: {
                to: quickarchiverStorage.parseEmailAddress(hdr.recipients),
                from: quickarchiverStorage.parseEmailAddress(hdr.author),
                subject: quickarchiverStorage.parseEmailAddress(hdr.subject),
                folder: folder,
                folderPath: this.getFullPath(this.getMsgFolderFromUri(folder)),
                id: rule.id
            },
            returned: null
        };

        if (rule.id) {

            params.sent.update = true;

            switch (rule.field) {

                case "to" :
                    params.sent.to = rule.value;
                    params.sent.field = 'to';
                    break;
                case "from" :
                    params.sent.from = rule.value;
                    params.sent.field = 'from';
                    break;
                case "subject" :
                    params.sent.subject = rule.value;
                    params.sent.field = 'subject';
                    break;
            }
        } else {
            params.sent.update = false;
            params.sent.field = 'from';
        }

        window.openDialog(
            "chrome://quickarchiver/content/dialog.xhtml",
            "", "chrome, dialog, modal, resizable=yes, height=220, width=500",
            params).focus();

        if (params.returned !== null) {

            // if user dont clicked cancel

            if (rule.id) {

                // update
                quickarchiverStorage.dbUpdateRule(params.returned.field,
                    params.returned.value, folder, '=', rule.id);
            } else {

                //insert
                quickarchiverStorage.dbInsertRule(params.returned.field,
                    params.returned.value, folder, '=');
            }
        }

    },
    showDialogFromSelected: function () {

        if (gFolderDisplay.selectedCount == 1) {
            this.showDialog(gFolderDisplay.selectedMessage);
        }
    },
    getRuleFromSelected: function () {

        if (gFolderDisplay.selectedCount == 1) {
            return quickarchiverStorage.dbGetRuleFromHdr(gFolderDisplay.selectedMessage);
        }

        return {};
    },
    moveMail: function (folder_src, folder_dst, hdr) {

        if (folder_src && folder_dst) {

            if (typeof this.copyService.copyMessages != "undefined") {
                // Thunderbird 91
                this.copyService.copyMessages(folder_src, [hdr], folder_dst, true, null, msgWindow, false);
            } else {
                let xpcomHdrArray = toXPCOMArray(new Array(hdr), Components.interfaces.nsIMutableArray);
                this.copyService.CopyMessages(folder_src, xpcomHdrArray, folder_dst, true, null, msgWindow, false);
            }

            quickarchiver.notify(quickarchiver.strings.getString("NotifyOnMoveHeadline"), quickarchiverStorage.parseEmailAddress(hdr.author) + " " + quickarchiver.strings.getString("NotifyOnMoveTo") + " " + quickarchiver.getFullPath(folder_dst));
        }
    },
    moveMailOnClickEvent: function (event) {

        try {
            let cell = quickarchiver.tree.getCellAt(event.clientX, event.clientY);

            if (event && event.type == "click" && event.button == 0) {

                if (cell.col.id == "colQuickArchiver") {

                    let key = gDBView.getKeyAt(cell.row);
                    let hdr = gDBView.db.GetMsgHdrForKey(key);

                    let rule = quickarchiverStorage.dbGetRuleFromHdr(hdr);

                    if (rule.folder && hdr.folder) {
                        quickarchiver.moveMail(hdr.folder, quickarchiver.getMsgFolderFromUri(rule.folder), hdr);
                    }
                }
            }

        } catch (e) {
            dump(e);
        }
    },
    moveSelectedMail: function () {

        if (gFolderDisplay.selectedCount > 0) {

            for (let hdr of gFolderDisplay.selectedMessages) {

                let rule = quickarchiverStorage.dbGetRuleFromHdr(hdr);

                if (rule.folder) {
                    quickarchiver.moveMail(hdr.folder, quickarchiver.getMsgFolderFromUri(rule.folder), hdr);
                }
            }
        }
    }
};

