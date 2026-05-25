const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
    if (err) console.error("Error opening DB:", err.message);
});

db.serialize(() => {
    db.all("SELECT log_id, log_data FROM logs_cache WHERE log_id LIKE 'dps_%'", [], (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log("Cached DPS values:");
        rows.forEach(r => {
            console.log(`- Key: ${r.log_id} -> Data: ${r.log_data}`);
        });
        db.close();
    });
});
