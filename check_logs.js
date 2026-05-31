const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

db.all("SELECT log_id, created_at FROM logs_cache ORDER BY created_at DESC", (err, rows) => {
    if (err) throw err;
    console.log("Cached logs:");
    console.table(rows);
});
