const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

db.get("SELECT log_data FROM logs_cache WHERE log_id = 'HPwQkDCzha97FT1Z'", (err, row) => {
    if (err) throw err;
    if (!row) { console.log("No log data"); return; }
    
    let report = JSON.parse(row.log_data).data.reportData.report;
    let allEvents = report.events.data;
    let fights = report.fights;
    let actors = report.masterData.actors;
    
    let actorMap = {};
    actors.forEach(a => actorMap[a.id] = a.name);
    
    let chinerId = actors.find(a => a.name === 'Chiner')?.id;
    if (!chinerId) return;
    
    let sappers = allEvents.filter(ev => ev.type === 'cast' && ev.abilityGameID === 30486 && ev.sourceID === chinerId);
    
    sappers.forEach(ev => {
        let inFight = fights.find(f => ev.timestamp >= f.startTime && ev.timestamp <= f.endTime && f.boss !== 0);
        console.log(`Sapper by Chiner at ${ev.timestamp}: Boss? ${inFight ? inFight.name : 'Trash'}`);
    });
});
