const fs = require('fs');

const dataJs = fs.readFileSync('./public/js/data.js', 'utf8');

// We can run a small extraction script directly.
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

db.get("SELECT log_data FROM logs_cache ORDER BY created_at DESC LIMIT 1", (err, row) => {
    if (err) throw err;
    if (!row) { console.log("No data"); return; }
    
    let report = JSON.parse(row.log_data).data.reportData.report;
    let allEvents = report.events.data;
    
    let counts = {};
    let timestamps = {};
    let spells = {};
    
    allEvents.forEach(ev => {
        let spellId = ev.abilityGameID;
        let playerId = ev.sourceID;
        if (ev.type === 'damage' && spellId === 33671) playerId = ev.targetID;
        if (['applybuff', 'applybuffstack', 'refreshbuff', 'removebuff'].includes(ev.type)) playerId = ev.targetID;
        
        let mapId = spellId === 33671 ? 30486 : spellId;
        
        let isBuffOrCast = ev.type === 'cast' || (ev.type === 'applybuff'); // Simplified
        if (!counts[playerId]) counts[playerId] = {};
        if (!timestamps[playerId]) timestamps[playerId] = {};
        
        if (mapId === 30486) {
            if (isBuffOrCast && spellId === 30486) {
                let lastTs = timestamps[playerId][30486];
                let timeSince = lastTs === undefined ? 999999 : ev.timestamp - lastTs;
                if (timeSince > 5000) {
                    counts[playerId][30486] = (counts[playerId][30486] || 0) + 1;
                    timestamps[playerId][30486] = ev.timestamp;
                }
            } else if (ev.type === 'damage' && (spellId === 30486 || spellId === 33671)) {
                let lastTs = timestamps[playerId][30486];
                let timeSince = lastTs === undefined ? 999999 : ev.timestamp - lastTs;
                if (timeSince > 5000) {
                    counts[playerId][30486] = (counts[playerId][30486] || 0) + 1;
                    timestamps[playerId][30486] = ev.timestamp;
                }
            }
        }
    });
    
    console.log("Counts:", counts);
});
