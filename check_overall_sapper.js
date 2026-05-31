const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

db.get("SELECT log_data FROM logs_cache WHERE log_id = 'HPwQkDCzha97FT1Z'", (err, row) => {
    if (err) throw err;
    if (!row) { console.log("No log data"); return; }
    
    let report = JSON.parse(row.log_data).data.reportData.report;
    let allEvents = report.events.data.sort((a,b) => a.timestamp - b.timestamp);
    
    // Find player ID for a player who used sappers, e.g. Chiner
    let player = report.masterData.actors.find(a => a.type === 'Player' && a.name === 'Chiner');
    if (!player) {
        // Fallback to finding any player who did sapper damage
        const sapperEvent = allEvents.find(e => e.type === 'damage' && (e.abilityGameID === 30486 || e.abilityGameID === 33671));
        if (sapperEvent) {
            player = report.masterData.actors.find(a => a.id === sapperEvent.sourceID);
        }
    }
    
    if (!player) { console.log("No sapper user found"); return; }
    console.log("Found player:", player.name);

    let itemCasts = { _lastTimestamp: {} };
    
    allEvents.forEach(ev => {
        if (ev.sourceID !== player.id) return;
        let spellId = ev.abilityGameID;
        if (ev.type === 'damage' && (spellId === 13241 || spellId === 30486 || spellId === 30216 || spellId === 30217 || spellId === 23063 || spellId === 33671)) {
            let mapId = spellId === 33671 ? 30486 : spellId;
            let lastTs = itemCasts._lastTimestamp[mapId];
            let timeSinceLast = lastTs === undefined ? 999999 : (ev.timestamp - lastTs);
            if (timeSinceLast > 5000) {
                itemCasts[mapId] = (itemCasts[mapId] || 0) + 1;
                itemCasts._lastTimestamp[mapId] = ev.timestamp;
            }
        }
    });
    
    console.log("Overall itemCasts for sappers:", itemCasts);
});
