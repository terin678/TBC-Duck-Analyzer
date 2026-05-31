const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

db.get("SELECT log_data FROM logs_cache WHERE log_id = 'HPwQkDCzha97FT1Z'", (err, row) => {
    if (err) throw err;
    if (!row) { console.log("No log data"); return; }
    
    let report = JSON.parse(row.log_data).data.reportData.report;
    let allEvents = report.events.data;
    let fights = report.fights;
    
    let frostbolts = allEvents.filter(ev => ev.type === 'cast' && ev.abilityGameID === 27072);
    
    let boss = 0;
    let trash = 0;
    
    frostbolts.forEach(ev => {
        let inFight = fights.find(f => ev.timestamp >= f.startTime && ev.timestamp <= f.endTime && f.boss !== 0);
        if (inFight) boss++;
        else trash++;
    });
    
    console.log(`Frostbolt Boss: ${boss}, Frostbolt Trash: ${trash}`);
});
