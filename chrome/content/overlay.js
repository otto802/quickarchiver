var quickarchiver_newMailListener = {
    msgsMoveCopyCompleted: function(aMove, aSrcMsgs, aDestFolder, aDestMsgs) {

        const nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;
        var ignoreFlags = nsMsgFolderFlags.Trash | nsMsgFolderFlags.SentMail |
                nsMsgFolderFlags.Drafts | nsMsgFolderFlags.Queue |
                nsMsgFolderFlags.Templates | nsMsgFolderFlags.Junk |
                nsMsgFolderFlags.Inbox;

        if (!(aDestFolder.flags & ignoreFlags)) { // isSpecialFlags does some strange hacks
            for each (let msgHdr in fixIterator(aSrcMsgs.enumerate(),
                    Components.interfaces.nsIMsgDBHdr)) {
                let mailfrom = quickarchiver.getEmailAddress(msgHdr.author);

                quickarchiver_sqlite.dbSetPath(mailfrom, aDestFolder.URI);
            }
        }
    }
}

var columnHandler = {
    getCellText:         function(row, col) {

        var key = gDBView.getKeyAt(row);
        var hdr = gDBView.db.GetMsgHdrForKey(key);

        var address = quickarchiver.getEmailAddress(hdr.author);
        var path = quickarchiver_sqlite.dbGetPath(address);

        if (path) {
            return quickarchiver.getFullPathForList(GetMsgFolderFromUri(path, false));
        }
        return '';

    },
    getSortStringForRow: function(hdr) {

        var address = quickarchiver.getEmailAddress(hdr.author);
        var path = quickarchiver_sqlite.dbGetPath(address);

        if (path) {
            return quickarchiver.getFullPathForList(GetMsgFolderFromUri(path, false));
        }
        return '';
    },
    isString:            function() {
        return true;
    },

    getCellProperties:   function(row, col, props) {
    },
    getRowProperties:    function(row, props) {
    },
    getImageSrc:         function(row, col) {
        return null;
    },
    getSortLongForRow:   function(hdr) {
        return 0;
    }
}


var quickarchiver = {
    headerParser: {},
    tree: {},
    copyService: {},
    onLoad: function() {

        this.initialized = true;
        this.strings = document.getElementById("quickarchiver-strings");
        quickarchiver_sqlite.onLoad();

        this.tree = GetThreadTree();
        this.tree.addEventListener('click', quickarchiver.moveMailOnClickEvent, true);


        this.headerParser = Components.classes["@mozilla.org/messenger/headerparser;1"].
                getService(Components.interfaces.nsIMsgHeaderParser);

        this.copyService = Components.classes["@mozilla.org/messenger/messagecopyservice;1"]
                .getService(Components.interfaces.nsIMsgCopyService);

        var notificationService =
                Components.classes["@mozilla.org/messenger/msgnotificationservice;1"]
                        .getService(Components.interfaces.nsIMsgFolderNotificationService);
        notificationService.addListener(quickarchiver_newMailListener, notificationService.msgsMoveCopyCompleted);
    },

    getFullPath: function(folder) {
        var ret = "";
        while (folder && folder.parent) {
            if (ret.length == 0) ret = folder.name;
            else ret = folder.name + "/" + ret;
            folder = folder.parent;
        }
        return ret;
    },
    getFullPathForList: function(folder) {
        var ret = "";
        var first_folder = false;

        while (folder && folder.parent.parent) {

            if (!first_folder) {
                first_folder = folder.name;
                folder = folder.parent;
                continue;
            }
            if (ret.length == 0) {
                ret = folder.name;
            } else {
                ret = folder.name + "/" + ret;
            }
            folder = folder.parent;
        }

        if (ret) {
            return first_folder + ' (' + ret + ')';
        }
        return first_folder;
    },
    notify: function(title, text) {
        try {
            Components.classes['@mozilla.org/alerts-service;1']
                    .getService(Components.interfaces.nsIAlertsService)
                    .showAlertNotification(null, title, text, false, '', null);
        } catch(e) {
            // prevents runtime error on platforms that don't implement nsIAlertsService
        }
    },
    getEmailAddress: function(author) {
        var aEmailAddresses = {};
        var aNames = {};
        var aFullNames = {};

        let numAddress = this.headerParser.parseHeadersWithArray(author,
                aEmailAddresses, aNames, aFullNames);
        if (numAddress > 0) {
            return aEmailAddresses.value[0];
        }
        return author;
    },
    moveMailOnClickEvent : function(event) {
        try {
            var row = {}, col = {}, obj = {};
            quickarchiver.tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, obj);

            if (event && event.type == "click" && event.button == 0) {

                if (obj.value == "text" && (col.value == "colQuickArchiver" || col.value.id == "colQuickArchiver")) {

                    var key = gDBView.getKeyAt(row.value);
                    var hdr = gDBView.db.GetMsgHdrForKey(key);

                    var address = quickarchiver.getEmailAddress(hdr.author);
                    var path = quickarchiver_sqlite.dbGetPath(address);

                    var folder_src = hdr.folder;
                    var folder_dst = GetMsgFolderFromUri(path);

                    if (folder_src && folder_dst) {
                        Components.utils.import("resource:///modules/iteratorUtils.jsm"); // import toXPCOMArray
                        let xpcomHdrArray = toXPCOMArray(new Array(hdr), Components.interfaces.nsIMutableArray);

                        quickarchiver.copyService.CopyMessages(folder_src, xpcomHdrArray, folder_dst, true, null, msgWindow, false);

                        quickarchiver.notify(quickarchiver.strings.getString("NotifyOnMoveHeadline"), address + " " + quickarchiver.strings.getString("NotifyOnMoveTo") + " " + quickarchiver.getFullPath(folder_dst));
                    }
                }
            }

        } catch(e) {
            dump(e);
        }

    },
    moveSelectedMail: function() {

        if (gFolderDisplay.selectedCount == 1) {
            let address = this.getEmailAddress(gFolderDisplay.selectedMessage.author);
            let path = quickarchiver_sqlite.dbGetPath(address);
            if (path) {
                MsgMoveMessage(GetMsgFolderFromUri(path, false));
                quickarchiver.notify(this.strings.getString("NotifyOnMoveHeadline"), address + " " + this.strings.getString("NotifyOnMoveTo") + " " + this.getFullPath(GetMsgFolderFromUri(path)));
            }
        }
    },
    clickResetDatabase:function() {


        if (confirm("really?")) {


        } else {


        }
    },


    onMenuItemCommand: function(e) {
        var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                .getService(Components.interfaces.nsIPromptService);
        promptService.alert(window, this.strings.getString("helloMessageTitle"),
                this.strings.getString("helloMessage"));
    },

    onToolbarButtonCommand: function(e) {
        // just reuse the function above.  you can change this, obviously!
        quickarchiver.onMenuItemCommand(e);
    }
};


window.addEventListener("load", function () {

    var ObserverService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
    ObserverService.addObserver(CreateDbObserver, "MsgCreateDBView", false);

    quickarchiver.onLoad();
}, false);


var CreateDbObserver = {
    // Components.interfaces.nsIObserver
    observe: function(aMsgFolder, aTopic, aData) {
        addCustomColumnHandler();
    }
}

function addCustomColumnHandler() {
    gDBView.addColumnHandler("colQuickArchiver", columnHandler);
}