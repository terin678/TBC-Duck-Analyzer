const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

db.get("SELECT log_data FROM logs_cache WHERE log_id = 'HPwQkDCzha97FT1Z'", (err, row) => {
    if (err) throw err;
    if (!row) { console.log("No log data"); return; }
    
    let report = JSON.parse(row.log_data).data.reportData.report;
    let fights = report.fights;
    
    fights.forEach(f => {
        if (f.boss !== 0) console.log(JSON.stringify(f.name));
    });
});
