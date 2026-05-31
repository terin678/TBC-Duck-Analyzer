const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

db.run("DELETE FROM logs_cache", (err) => {
    if (err) throw err;
    console.log("Cache cleared");
});
