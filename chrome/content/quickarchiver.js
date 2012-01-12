var quickarchiver_newMailListener = {
    msgsMoveCopyCompleted:function (aMove, aSrcMsgs, aDestFolder, aDestMsgs) {

        const nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;
        var ignoreFlags = nsMsgFolderFlags.Trash | nsMsgFolderFlags.SentMail |
                nsMsgFolderFlags.Drafts | nsMsgFolderFlags.Queue |
                nsMsgFolderFlags.Templates | nsMsgFolderFlags.Junk |
                nsMsgFolderFlags.Inbox;

        if (!(aDestFolder.flags & ignoreFlags)) { // isSpecialFlags does some strange hacks
            for each (let msgHdr in fixIterator(aSrcMsgs.enumerate(),
                    Components.interfaces.nsIMsgDBHdr)) {

                var rule = quickarchiver_sqlite.dbGetRuleFromHdr(msgHdr);

                if (!rule.id) {

                    // create default rule

                    quickarchiver_sqlite.dbInsertRule('from',
                            quickarchiver_sqlite.parseEmailAddress(msgHdr.author),
                            aDestFolder.URI,
                            "=");
                }
            }
        }
    }
}

var quickarchiverColumn = {
    CreateDbObserver:{
        // Components.interfaces.nsIObserver
        observe:function (aMsgFolder, aTopic, aData) {
            quickarchiverColumn.addCustomColumnHandler();
        }
    },
    addCustomColumnHandler:function () {
        gDBView.addColumnHandler("colQuickArchiver", quickarchiverColumn.columnHandler);
    },
    columnHandler:{
        getCellText:function (row, col) {

            if (gDBView.isContainer(row)) {
                return '';
            }

            var key = gDBView.getKeyAt(row);
            var hdr = gDBView.db.GetMsgHdrForKey(key);

            var rule = quickarchiver_sqlite.dbGetRuleFromHdr(hdr);

            if (rule.folder) {

                var folder = GetMsgFolderFromUri(rule.folder, false);

                // check if destination folder exists (if not remove rule)

                try {

                    // try to access msgDatabase for check folder as valid
                    // maybe there is a more elegant way to validate folder object

                    var db = folder.msgDatabase;
                    return quickarchiver.getFullPathForList(folder);

                } catch (e) {
                    // folder not valid

                    quickarchiver_sqlite.dbRemoveRule(rule.id);
                    // dump("invalid rule removed.");
                }
            }
            return '';

        },
        getSortStringForRow:function (hdr) {

            var rule = quickarchiver_sqlite.dbGetRuleFromHdr(hdr);

            if (rule.folder) {
                return quickarchiver.getFullPathForList(GetMsgFolderFromUri(rule.folder, false));
            }
            return '';
        },
        isString:function () {
            return true;
        },
        getCellProperties:function (row, col, props) {
        },
        getRowProperties:function (row, props) {
        },
        getImageSrc:function (row, col) {
            return null;
        },
        getSortLongForRow:function (hdr) {
            return 0;
        }
    }
}


var quickarchiver = {
    tree:{},
    copyService:{},
    onLoad:function () {

        this.initialized = true;
        this.strings = document.getElementById("quickarchiver-strings");
        quickarchiver_sqlite.onLoad();


        var ObserverService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
        ObserverService.addObserver(quickarchiverColumn.CreateDbObserver, "MsgCreateDBView", false);

        this.tree = GetThreadTree();
        this.tree.addEventListener('click', quickarchiver.moveMailOnClickEvent, true);

        this.copyService = Components.classes["@mozilla.org/messenger/messagecopyservice;1"]
                .getService(Components.interfaces.nsIMsgCopyService);

        var notificationService =
                Components.classes["@mozilla.org/messenger/msgnotificationservice;1"]
                        .getService(Components.interfaces.nsIMsgFolderNotificationService);
        notificationService.addListener(quickarchiver_newMailListener, notificationService.msgsMoveCopyCompleted);
    },

    getActualTopFolder:function () {

        var actual_top_folder;
        var folder = gFolderDisplay.displayedFolder;

        while (folder) {
            actual_top_folder = folder.name;
            folder = folder.parent;
        }

        return actual_top_folder;

    },

    getFullPath:function (folder) {

        var string = '';

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
    getFullPathForList:function (folder) {

        var string = '';
        var actual_top_folder = this.getActualTopFolder();
        var actual_folder = gFolderDisplay.displayedFolder;
        var folders = [];

        while (folder) {

            folders.push(folder.name);
            folder = folder.parent;
        }

        folders.reverse();

        if (folders.length > 1) {

            var displayFolders = [];

            for (var i in folders) {

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
    notify:function (title, text) {
        try {
            Components.classes['@mozilla.org/alerts-service;1']
                    .getService(Components.interfaces.nsIAlertsService)
                    .showAlertNotification(null, title, text, false, '', null);
        } catch (e) {
            // prevents runtime error on platforms that don't implement nsIAlertsService
        }
    },
    showDialog:function (hdr, folder) {

        var rule = quickarchiver_sqlite.dbGetRuleFromHdr(hdr);

        if (rule.id && !folder) {
            folder = rule.folder;
        } else if (!folder) {
            folder = '';
        }

        var params = {
            sent:{
                to:quickarchiver_sqlite.parseEmailAddress(hdr.recipients),
                from:quickarchiver_sqlite.parseEmailAddress(hdr.author),
                subject:quickarchiver_sqlite.parseEmailAddress(hdr.subject),
                folder:folder,
                folderPath:this.getFullPath(GetMsgFolderFromUri(folder)),
                id:rule.id
            },
            returned:null
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
                "chrome://quickarchiver/content/dialog.xul",
                "", "chrome, dialog, modal, resizable=yes, height=220, width=500",
                params).focus();

        if (params.returned !== null) {

            // if user dont clicked cancel

            if (rule.id) {

                // update
                quickarchiver_sqlite.dbUpdateRule(params.returned.field,
                        params.returned.value, folder, '=', rule.id);
            } else {

                //insert
                quickarchiver_sqlite.dbInsertRule(params.returned.field,
                        params.returned.value, folder, '=');
            }
        }

    },
    showDialogFromSelected:function () {

        if (gFolderDisplay.selectedCount == 1) {
            this.showDialog(gFolderDisplay.selectedMessage);
        }
    },
    getRuleFromSelected:function () {

        if (gFolderDisplay.selectedCount == 1) {
            return quickarchiver_sqlite.dbGetRuleFromHdr(gFolderDisplay.selectedMessage);
        }

        return {};
    },
    moveMail:function (folder_src, folder_dst, hdr) {

        if (folder_src && folder_dst) {

            Components.utils.import("resource:///modules/iteratorUtils.jsm");
            let xpcomHdrArray = toXPCOMArray(new Array(hdr), Components.interfaces.nsIMutableArray);

            quickarchiver.copyService.CopyMessages(folder_src, xpcomHdrArray, folder_dst, true, null, msgWindow, false);
            quickarchiver.notify(quickarchiver.strings.getString("NotifyOnMoveHeadline"), quickarchiver_sqlite.parseEmailAddress(hdr.author) + " " + quickarchiver.strings.getString("NotifyOnMoveTo") + " " + quickarchiver.getFullPath(folder_dst));
        }
    },
    moveMailOnClickEvent:function (event) {

        try {
            var row = {}, col = {}, obj = {};
            quickarchiver.tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, obj);

            if (event && event.type == "click" && event.button == 0) {

                if (obj.value == "text" && (col.value == "colQuickArchiver" || col.value.id == "colQuickArchiver")) {

                    var key = gDBView.getKeyAt(row.value);
                    var hdr = gDBView.db.GetMsgHdrForKey(key);

                    var rule = quickarchiver_sqlite.dbGetRuleFromHdr(hdr);

                    if (rule.folder) {
                        quickarchiver.moveMail(hdr.folder, GetMsgFolderFromUri(rule.folder), hdr);
                    }
                }
            }

        } catch (e) {
            dump(e);
        }

    },
    moveSelectedMail:function () {

        if (gFolderDisplay.selectedCount > 0) {

            for each (let hdr in gFolderDisplay.selectedMessages) {

                var rule = quickarchiver_sqlite.dbGetRuleFromHdr(hdr);

                if (rule.folder) {
                    quickarchiver.moveMail(hdr.folder, GetMsgFolderFromUri(rule.folder), hdr);
                }
            }
        }
    }
};


window.addEventListener("load", function () {
    quickarchiver.onLoad();
}, false);
