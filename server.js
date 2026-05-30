const path = require('path');
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config({ path: path.join(__dirname, '.env') });
}
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

const clientId = process.env.WCL_CLIENT_ID;
const clientSecret = process.env.WCL_CLIENT_SECRET;

// Configurar SQLite y crear tabla
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
    if (err) console.error("Error opening DB:", err.message);
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS logs_cache (
        log_id TEXT PRIMARY KEY,
        log_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    // Attempt to add column in case the DB was created before the column was added to the schema
    db.run(`ALTER TABLE logs_cache ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`, (err) => {
        // Ignore duplicate column errors silently
    });
});

function cleanupDatabase() {
    db.run("DELETE FROM logs_cache WHERE created_at < DATETIME('now', '-2 hours')", (err) => {
        if (err) {
            console.error("Cleanup error:", err.message);
        }
    });
}
cleanupDatabase();
setInterval(cleanupDatabase, 15 * 60 * 1000); // Se ejecuta cada 15 minutos

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Endpoint para el cliente
app.post('/api/audit', async (req, res) => {
    try {
        const logId = req.body.logId;
        const bypassCache = req.body.bypassCache === true;
        if (!logId) {
            return res.status(400).json({ error: "Missing logId" });
        }

        // Consultar a la base de datos como caché
        db.get("SELECT log_data FROM logs_cache WHERE log_id = ?", [logId], async (err, row) => {
            if (err) {
                console.error("Cache read error:", err);
            }
            if (!bypassCache && row && row.log_data) {
                // Encontrado en caché
                try {
                    return res.json(JSON.parse(row.log_data));
                } catch (e) {
                    console.error("JSON parse error:", e);
                }
            }

            // No existe o falló en caché, procedemos a consultar WCL
            try {

                if (!clientId || !clientSecret) {
                    return res.status(500).json({ error: "WCL_CLIENT_ID and WCL_CLIENT_SECRET are not configured on the server." });
                }

                // Obtener IDs de spells dinámicamente de data.js para no duplicar código
                const dataJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'data.js'), 'utf8');
                
                const parseIds = (varName) => {
                    const idx = dataJs.indexOf(`const ${varName} =`);
                    if (idx === -1) return "";
                    let nextIdx = dataJs.indexOf('const ', idx + 10);
                    if (nextIdx === -1) nextIdx = dataJs.length;
                    const block = dataJs.substring(idx, nextIdx);
                    const matches = [...block.matchAll(/^\s+(\d+):/gm)];
                    return matches.map(m => m[1]).join(',');
                };

                // Parse CLASS_ABILITY_TRACKING to get all cast+debuff IDs from the array entries
                const parseTrackingIds = () => {
                    const idx = dataJs.indexOf('const CLASS_ABILITY_TRACKING =');
                    if (idx === -1) return '';
                    const endIdx = dataJs.indexOf('if (typeof window', idx);
                    const block = endIdx !== -1 ? dataJs.substring(idx, endIdx) : dataJs.substring(idx);
                    const matches = [...block.matchAll(/ids:\s*\[([^\]]+)\]/g)];
                    const ids = new Set();
                    matches.forEach(m => {
                        m[1].split(',').forEach(id => {
                            const n = parseInt(id.trim());
                            if (!isNaN(n)) ids.add(n);
                        });
                    });
                    return [...ids].join(',');
                };

                let castIds = parseIds('SPELL_DB');
                if (!castIds) return res.status(500).json({ error: "No se pudo leer SPELL_DB desde data.js" });

                let buffIds = parseIds('BUFF_DB');
                let timelineIds = parseIds('TIMELINE_SPELLS');
                let trackingIds = parseTrackingIds();

                // Petición a WarcraftLogs para obtener token
                const responseToken = await axios.post(
                    "https://www.warcraftlogs.com/oauth/token",
                    `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
                    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
                );

                const token = responseToken.data.access_token;
                if (!token) throw new Error("Invalid or expired API Keys.");

                const resAbilityIds = [20608, 20707, 20748, 20749, 20750, 20758, 27239, 20484, 21849, 21850, 26993, 26994].join(',');
                
                const allUniqueIdsSet = new Set();
                [castIds, buffIds, timelineIds, trackingIds, '13241,30486,33671,30216,30217', resAbilityIds].forEach(str => {
                    if (str) {
                        str.split(',').forEach(id => {
                            const n = parseInt(id.trim());
                            if (!isNaN(n)) allUniqueIdsSet.add(n);
                        });
                    }
                });
                const allUniqueIds = [...allUniqueIdsSet].join(',');

                // Compact filter expression to avoid WCL length limits
                const filterExp = `type = 'combatantinfo' OR (type IN ('cast', 'damage', 'interrupt', 'resurrect', 'applybuff', 'applybuffstack', 'refreshbuff', 'removebuff', 'applydebuff', 'refreshdebuff', 'removedebuff') AND ability.id IN (${allUniqueIds}))`;
                // Función para obtener todas las páginas de eventos
                const fetchEventsPaginated = async (startEvent, startDeath) => {
                    const evStr = startEvent !== null ? `events(startTime: ${startEvent}, endTime: 999999999999, filterExpression: "${filterExp}") { data nextPageTimestamp }` : '';
                    const deathStr = startDeath !== null ? `deaths: events(startTime: ${startDeath}, endTime: 999999999999, dataType: Deaths) { data nextPageTimestamp }` : '';
                    
                    if (!evStr && !deathStr) return null;

                    const q = JSON.stringify({ query: `{reportData {report(code: "${logId}") { ${evStr} ${deathStr} }}}` });
                    const res = await axios.post("https://www.warcraftlogs.com/api/v2/client", q, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } });
                    if (res.data.errors) throw new Error(res.data.errors[0].message);
                    return res.data.data.reportData.report;
                };

                // Petición Inicial
                const query = JSON.stringify({
                    query: `{reportData {report(code: "${logId}") {title fights { id name startTime endTime kill difficulty } masterData { actors { id name subType icon type } } events(startTime: 0, endTime: 999999999999, filterExpression: "${filterExp}") { data nextPageTimestamp } deaths: events(startTime: 0, endTime: 999999999999, dataType: Deaths) { data nextPageTimestamp }}}}`
                });

                const responseData = await axios.post(
                    "https://www.warcraftlogs.com/api/v2/client",
                    query,
                    { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } }
                );

                if (responseData.data.errors) {
                    throw new Error(responseData.data.errors[0].message);
                }

                // Manejar la paginación (si el log es muy largo, WCL corta a los 10k eventos)
                let report = responseData.data.data.reportData.report;
                
                // Asegurar que events y deaths sean al menos un objeto vacío con data: []
                if (!report.events) report.events = { data: [] };
                if (!report.deaths) report.deaths = { data: [] };

                let nextEvent = report.events.nextPageTimestamp || null;
                let nextDeath = report.deaths.nextPageTimestamp || null;

                while (nextEvent !== null || nextDeath !== null) {
                    const page = await fetchEventsPaginated(nextEvent, nextDeath);
                    if (!page) break;
                    if (nextEvent !== null && page.events && page.events.data) {
                        report.events.data = report.events.data.concat(page.events.data);
                        nextEvent = page.events.nextPageTimestamp || null;
                    }
                    if (nextDeath !== null && page.deaths && page.deaths.data) {
                        report.deaths.data = report.deaths.data.concat(page.deaths.data);
                        nextDeath = page.deaths.nextPageTimestamp || null;
                    }
                }

                // Mezclar muertes con el array principal de eventos para que el frontend lo lea igual
                if (report.deaths && report.deaths.data && report.deaths.data.length > 0) {
                    report.events.data = report.events.data.concat(report.deaths.data);
                }

                // Ordenar por timestamp
                report.events.data.sort((a, b) => a.timestamp - b.timestamp);

                // Guardar en la base de datos (caché)
                const responseString = JSON.stringify(responseData.data);
                db.run("INSERT OR REPLACE INTO logs_cache (log_id, log_data) VALUES (?, ?)", [logId, responseString], (insertErr) => {
                    if (insertErr) {
                        console.error("Cache insert error:", insertErr);
                    }
                });

                res.json(responseData.data);

            } catch (error) {
                console.error(error);
                const errorMsg = error.response?.data?.message || error.message || "Unknown error";
                res.status(500).json({ error: errorMsg });
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Unknown error" });
    }
});
app.post('/api/dps', async (req, res) => {
    try {
        const { logId, startTime, endTime, fightIDs, playerId } = req.body;
        if (!logId || !playerId) {
            return res.status(400).json({ error: "Missing required parameters: logId, playerId" });
        }

        let cacheKey;
        if (fightIDs && Array.isArray(fightIDs) && fightIDs.length > 0) {
            cacheKey = `dps_${logId}_fights_${fightIDs.join('_')}_${playerId}`;
        } else if (startTime != null && endTime != null) {
            cacheKey = `dps_${logId}_${startTime}_${endTime}_${playerId}`;
        } else {
            return res.status(400).json({ error: "Missing either fightIDs or startTime/endTime" });
        }

        db.get("SELECT log_data FROM logs_cache WHERE log_id = ?", [cacheKey], async (err, row) => {
            if (row && row.log_data) {
                try { return res.json(JSON.parse(row.log_data)); } catch (e) {}
            }

            try {
                const responseToken = await axios.post(
                    "https://www.warcraftlogs.com/oauth/token",
                    `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
                    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
                );
                const token = responseToken.data.access_token;
                let query;
                if (fightIDs && Array.isArray(fightIDs) && fightIDs.length > 0 && fightIDs[0] === 'all') {
                    query = JSON.stringify({
                        query: `{reportData {report(code: "${logId}") {
                            fights { id startTime endTime }
                            damage: table(dataType: DamageDone, startTime: 0, endTime: 999999999999, sourceID: ${playerId})
                            healing: table(dataType: Healing, startTime: 0, endTime: 999999999999, sourceID: ${playerId})
                        }}}`
                    });
                } else if (fightIDs && Array.isArray(fightIDs) && fightIDs.length > 0) {
                    query = JSON.stringify({
                        query: `{reportData {report(code: "${logId}") {
                            fights { id startTime endTime }
                            damage: table(dataType: DamageDone, fightIDs: [${fightIDs.join(',')}], sourceID: ${playerId})
                            healing: table(dataType: Healing, fightIDs: [${fightIDs.join(',')}], sourceID: ${playerId})
                        }}}`
                    });
                } else {
                    query = JSON.stringify({
                        query: `{reportData {report(code: "${logId}") {
                            fights { id startTime endTime }
                            damage: table(dataType: DamageDone, startTime: ${startTime}, endTime: ${endTime}, sourceID: ${playerId})
                            healing: table(dataType: Healing, startTime: ${startTime}, endTime: ${endTime}, sourceID: ${playerId})
                        }}}`
                    });
                }

                const responseData = await axios.post(
                    "https://www.warcraftlogs.com/api/v2/client",
                    query,
                    { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } }
                );

                if (responseData.data.errors) throw new Error(responseData.data.errors[0].message);

                const report = responseData.data?.data?.reportData?.report;
                const entriesDmg = report?.damage?.data?.entries || [];
                const entriesHeal = report?.healing?.data?.entries || [];

                const dmgTotal = entriesDmg.reduce((sum, entry) => sum + (entry.total || 0), 0);
                const healTotal = entriesHeal.reduce((sum, entry) => sum + (entry.total || 0), 0);

                let duration = 0;
                const fights = report?.fights || [];
                if (fightIDs && Array.isArray(fightIDs) && fightIDs.length > 0 && fightIDs[0] === 'all') {
                    let totalDurationMs = 0;
                    fights.forEach(f => {
                        totalDurationMs += (f.endTime - f.startTime);
                    });
                    duration = Math.max(1, totalDurationMs / 1000);
                } else if (fightIDs && Array.isArray(fightIDs) && fightIDs.length > 0) {
                    let totalDurationMs = 0;
                    fights.forEach(f => {
                        if (fightIDs.includes(f.id) || fightIDs.includes(f.id.toString())) {
                            totalDurationMs += (f.endTime - f.startTime);
                        }
                    });
                    duration = Math.max(1, totalDurationMs / 1000);
                } else if (startTime != null && endTime != null) {
                    let totalDurationMs = 0;
                    fights.forEach(f => {
                        if (f.startTime >= startTime && f.endTime <= endTime) {
                            totalDurationMs += (f.endTime - f.startTime);
                        }
                    });
                    duration = Math.max(1, totalDurationMs / 1000);
                } else {
                    duration = 1;
                }

                let result = {};
                if (healTotal > dmgTotal * 1.5) { // If it's a healer
                    result = { dps: Math.round(healTotal / duration), total: healTotal, isHealing: true };
                } else {
                    result = { dps: Math.round(dmgTotal / duration), total: dmgTotal, isHealing: false };
                }

                db.run("INSERT OR REPLACE INTO logs_cache (log_id, log_data) VALUES (?, ?)", [cacheKey, JSON.stringify(result)]);
                res.json(result);
            } catch (error) {
                console.error(error);
                res.status(500).json({ error: "DPS fetch error" });
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Unknown error" });
    }
});

const https = require('https');

// Endpoint para iconos
app.get('/api/icon/:iconName([\\w\\.-]+).jpg', (req, res) => {
    const iconName = req.params.iconName;
    const fileName = iconName + '.jpg';
    const iconPath = path.join(__dirname, 'public', 'assets', 'icons', fileName);

    if (fs.existsSync(iconPath)) {
        return res.sendFile(iconPath);
    }

    const dir = path.dirname(iconPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const url = `https://wow.zamimg.com/images/wow/icons/large/${fileName}`;
    https.get(url, (response) => {
        if (response.statusCode === 200) {
            const writer = fs.createWriteStream(iconPath);
            response.pipe(writer);
            writer.on('finish', () => {
                writer.close();
                res.sendFile(iconPath);
            });
        } else {
            response.resume(); // free memory
            serveDefaultIcon(res);
        }
    }).on('error', (err) => {
        console.error('Error downloading icon:', err);
        serveDefaultIcon(res);
    });

    function serveDefaultIcon(responseObj) {
        const defPath = path.join(__dirname, 'public', 'assets', 'icons', 'inv_misc_questionmark.jpg');
        if (fs.existsSync(defPath)) {
            responseObj.sendFile(defPath);
        } else {
            responseObj.status(404).send('Icon not found');
        }
    }
});

// Nuevo EndPoint de Reporte Dinámico
app.get('/report/:logId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Fallback para SPA si es necesario en el futuro
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, 'public', 'index.html'));
// });

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
