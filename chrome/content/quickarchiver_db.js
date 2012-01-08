var quickarchiver_sqlite = {

    headerParser: {},

    onLoad: function() {


        this.headerParser = Components.classes["@mozilla.org/messenger/headerparser;1"].
                getService(Components.interfaces.nsIMsgHeaderParser);

        this.dbInit();

        this.initialized = true;

    },

    dbConnection: null,

    dbSchema: {
        tables: {
            senders:"address TEXT PRIMARY KEY, \
                   uri TEXT"
        }
    },

    dbInit: function() {
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
    },

    _dbCreate: function(aDBService, aDBFile) {
        var dbConnection = aDBService.openDatabase(aDBFile);
        this._dbCreateTables(dbConnection);
        return dbConnection;
    },

    _dbCreateTables: function(aDBConnection) {
        for (var name in this.dbSchema.tables)
            aDBConnection.createTable(name, this.dbSchema.tables[name]);
    },

    parseEmailAddress: function(author) {
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

    dbGetRuleFromHdr: function(hdr) {

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
    dbInsertRule: function(field, value, folder, operator) {

        if (!operator) {
            operator = '=';
        }

        var sql = "INSERT INTO rules VALUES (:field, :operator, :value, :folder)";
        var statement = this.dbConnection.createStatement(sql);
  //      dump(sql);

        statement.params.field = field;
        statement.params.operator = operator;
        statement.params.value = value;
        statement.params.folder = folder;

        try {
            while (statement.step()) {
                // Use the results...
            }
        }
        finally {
            statement.reset();
        }
    },
    dbUpdateRule: function(field, value, folder, operator, id) {

        if (!operator) {
            operator = '=';
        }

        if (!id) {
            return false;
        }

        var sql = "UPDATE rules SET field = :field, operator = :operator, value = :value, folder = :folder WHERE rowid = :id";
        var statement = this.dbConnection.createStatement(sql);
//dump(sql);
        statement.params.field = field;
        statement.params.operator = operator;
        statement.params.value = value;
        statement.params.folder = folder;
        statement.params.id = id;

        try {
            while (statement.step()) {
                // Use the results...
            }
        }
        finally {
            statement.reset();
        }
    },

    dbRemoveRule: function(id) {

        if (!id) {
            return false;
        }

        var sql = "DELETE FROM rules WHERE rowid = :id";
        var statement = this.dbConnection.createStatement(sql);
        statement.params.id = id;

        try {
            while (statement.step()) {
                // Use the results...
            }
        }
        finally {
            statement.reset();
        }
    },


    dbGetPath: function(sender) {
        var statement = this.dbConnection.createStatement("SELECT * FROM senders WHERE address = :mail");
        statement.params.mail = sender;
        var uri = null;
        try {
            while (statement.step()) {
                uri = statement.row.uri;
            }
        }
        finally {
            statement.reset();
        }
        return uri;
    },
    dbCheckPath: function(sender, uri) {
        var statement = this.dbConnection.createStatement("SELECT * FROM senders WHERE address = :mail AND uri = :uri");
        statement.params.mail = sender;
        statement.params.uri = uri;
        var uri = null;
        try {
            while (statement.step()) {
                uri = statement.row.uri;
            }
        }
        finally {
            statement.reset();
        }
        return uri;
    },
    dbSetPath: function(sender, uri) {
        var update = false;
        if (!this.dbGetPath(sender)) {
            var statement = this.dbConnection.createStatement("INSERT INTO senders VALUES (:mail, :uri)");
            statement.params.mail = sender;
            statement.params.uri = uri;
            try {
                while (statement.step()) {
                    // Use the results...
                }
            }
            finally {
                statement.reset();
            }
        }
        else if (!this.dbCheckPath(sender, uri)) {
            var statement = this.dbConnection.createStatement("UPDATE senders SET uri = :uri WHERE address = :mail");
            statement.params.mail = sender;
            statement.params.uri = uri;
            update = true;
            try {
                while (statement.step()) {
                    // Use the results...
                }
            }
            finally {
                statement.reset();
            }
        }
        return update;
    },
    resetDatabase:function() {

        var statement = this.dbConnection.createStatement("DELETE FROM senders");
        try {
            while (statement.step()) {
                // Use the results...
            }
        }
        finally {
            statement.reset();
        }
    }
};
