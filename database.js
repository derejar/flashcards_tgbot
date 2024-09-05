const Config = require("./config.js");
const datastore = require('nedb');

let database = {};
database.users = new datastore({filename: Config.FLASHCARDS_FOLDER + "/users.db", autoload: true});
database.decks = new datastore({filename: Config.FLASHCARDS_FOLDER + "/decks.db", autoload: true});
database.flashcards = new datastore({filename: Config.FLASHCARDS_FOLDER + "/flashcards.db", autoload: true});
database.queues = new datastore({filename: Config.FLASHCARDS_FOLDER + "/queues.db", autoload: true});
database.logs = new datastore({filename: Config.FLASHCARDS_FOLDER + "/logs.db", autoload: true});

database.users.persistence.setAutocompactionInterval(1000*Config.DATABASE_AUTOCOMPACTION_INTERVAL_IN_SECONDS);
database.decks.persistence.setAutocompactionInterval(1000*Config.DATABASE_AUTOCOMPACTION_INTERVAL_IN_SECONDS);
database.flashcards.persistence.setAutocompactionInterval(1000*Config.DATABASE_AUTOCOMPACTION_INTERVAL_IN_SECONDS);
database.queues.persistence.setAutocompactionInterval(1000*Config.DATABASE_AUTOCOMPACTION_INTERVAL_IN_SECONDS);
database.logs.persistence.setAutocompactionInterval(1000*Config.DATABASE_AUTOCOMPACTION_INTERVAL_IN_SECONDS);

module.exports = database;