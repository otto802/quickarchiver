var quickarchiver_sqlite = {

    headerParser:{},

    onLoad:function () {


        this.headerParser = Components.classes["@mozilla.org/messenger/headerparser;1"].
                getService(Components.interfaces.nsIMsgHeaderParser);

        this.dbInit();

        this.initialized = true;

    },

    dbConnection:null,

    dbSchema:{
        tables:{
            rules:"field TEXT, \
                   operator TEXT, \
                   value TEXT, \
                   folder TEXT",
            misc:"key TEXT, \
                   value TEXT"
        }
    },

    dbInit:function () {
        var dirService = Components.classes["@mozilla.org/file/directory_service;1"].
                getService(Components.interfaces.nsIProperties);

        var dbFile = dirService.get("ProfD", Components.interfaces.nsIFile);
        dbFile.append("quickarchiver.sqlite");

        var dbService = Components.classes["@mozilla.org/storage/service;1"].
                getService(Components.interfaces.mozIStorageService);

        var dbConnection;

        if (!dbFile.exists())
            dbConnection = this._dbCreate(dbService, dbFile);
        else {
            dbConnection = dbService.openDatabase(dbFile);
        }
        this.dbConnection = dbConnection;
        this._dbCheckUpdate();
    },

    _dbCreate:function (aDBService, aDBFile) {
        var dbConnection = aDBService.openDatabase(aDBFile);
        this._dbCreateTables(dbConnection);
        return dbConnection;
    },

    _dbCreateTables:function (aDBConnection) {
        for (var name in this.dbSchema.tables)
            aDBConnection.createTable(name, this.dbSchema.tables[name]);
    },

    _dbCheckUpdate:function () {

        var statement = this.dbConnection.createStatement(

                "SELECT COUNT(*) as c FROM sqlite_master " +
                        "WHERE type='table' and name='misc';");

        try {
            while (statement.step()) {

                if (statement.row.c == "0") {

                    // old scheme, so update
                    this._dbCreateTables(this.dbConnection);

                    // insert first version number

                    var statement_ver = this.dbConnection.createStatement(
                            "INSERT INTO misc VALUES ('version', 1)");

                    try {
                        statement_ver.step();
                    }
                    finally {
                        statement_ver.reset();
                    }
                }
            }
        }
        finally {
            statement.reset();
        }

        var statement = this.dbConnection.createStatement(
                "SELECT value as version FROM misc where key='version';");

        var version = null;
        try {
            while (statement.step()) {
                version = statement.row.version;
            }
        }
        finally {
            statement.reset();
        }

        switch (version) {

            case "1":

                var statement = this.dbConnection.createStatement(
                        "INSERT INTO rules (field, operator, value, folder) " +
                                "SELECT 'from' AS field, '=' AS operator, address AS value, uri AS folder FROM senders;");

                try {
                    statement.step();
                }
                finally {
                    statement.reset();
                }

                var statement = this.dbConnection.createStatement(
                        "UPDATE misc SET value=2 WHERE key = 'version';");
                try {
                    statement.step();
                }
                finally {
                    statement.reset();
                }

                break;
        }

    },

    parseEmailAddress:function (author) {
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

    dbGetRuleFromHdr:function (hdr) {

        var sql = "SELECT rowid,* FROM rules WHERE 0 ";

        if (hdr.subject) {
            sql += "OR (field='subject' AND :subject LIKE '%' || value || '%' ESCAPE '/') ";
        }
        if (hdr.author) {
            sql += "OR (field='from' AND :from LIKE '%' || value || '%' ESCAPE '/') ";
        }
        if (hdr.recipients) {
            sql += "OR (field='to' AND :to LIKE '%' || value || '%' ESCAPE '/') ";
        }

        var statement = this.dbConnection.createStatement(sql);
        statement.params.subject = hdr.subject;
        statement.params.from = '%' + this.parseEmailAddress(hdr.author) + '%';
        statement.params.to = '%' + this.parseEmailAddress(hdr.recipients) + '%';

        var data = {};

        try {
            while (statement.step()) {
                data['id'] = statement.row.rowid;
                data['field'] = statement.row.field;
                data['value'] = statement.row.value;
                data['operator'] = statement.row.operator;
                data['folder'] = statement.row.folder;
            }
        }
        finally {
            statement.reset();
        }

        return data;
    },
    dbInsertRule:function (field, value, folder, operator) {

        if (!operator) {
            operator = '=';
        }

        var sql = "INSERT INTO rules VALUES (:field, :operator, :value, :folder)";
        var statement = this.dbConnection.createStatement(sql);

        statement.params.field = field;
        statement.params.operator = operator;
        statement.params.value = value;
        statement.params.folder = folder;

        try {
            statement.step();
        }
        finally {
            statement.reset();
        }
    },
    dbUpdateRule:function (field, value, folder, operator, id) {

        if (!operator) {
            operator = '=';
        }

        if (!id) {
            return false;
        }

        var sql = "UPDATE rules SET field = :field, operator = :operator, value = :value, folder = :folder WHERE rowid = :id";
        var statement = this.dbConnection.createStatement(sql);

        statement.params.field = field;
        statement.params.operator = operator;
        statement.params.value = value;
        statement.params.folder = folder;
        statement.params.id = id;

        try {
            statement.step();
        }
        finally {
            statement.reset();
        }
    },

    dbRemoveRule:function (id) {

        if (!id) {
            return false;
        }

        var sql = "DELETE FROM rules WHERE rowid = :id";
        var statement = this.dbConnection.createStatement(sql);
        statement.params.id = id;

        try {
            statement.step();
        }
        finally {
            statement.reset();
        }
    },

    resetDatabase:function () {

        var statement = this.dbConnection.createStatement("DELETE FROM rules");
        try {
            statement.step();
        }
        finally {
            statement.reset();
        }
    }
};
