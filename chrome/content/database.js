var quickarchiver_sqlite = {

    onLoad: function() {
        this.initialized = true;
        this.dbInit();
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
