import { state } from './state.js';
import { parseLogId } from './utils.js';
import { detectPlayerSpec } from './utils.js';
import { renderFightsSidebar, renderPlayersSidebar } from './ui/sidebar.js';

export async function auditarLog() {
    const rawInput = document.getElementById('logInput').value.trim();
    const logId = parseLogId(rawInput);
    if (!logId) return;

    state.currentLogId = logId;
    state.detectedSpecs = {};
    state.playerGearDB = {};
    state.playerEnchantsForConsole = {};

    const statusEl = document.getElementById('landingStatus');
    statusEl.innerHTML = "<p style='color:#f4b400; font-weight:bold; font-size:1.2rem;'>POLICE IS INVESTIGATING...</p>";

    try {
        const bypassCache = document.getElementById('bypassCacheInput')?.checked || false;
        const response = await fetch('/api/audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logId, bypassCache })
        });

        const res = await response.json();
        if (res.error) throw new Error(res.error);
        if (res.errors) throw new Error(res.errors[0].message);
        if (!res.data || !res.data.reportData || !res.data.reportData.report) {
            throw new Error("Report not found, it is private, or the link is incorrect.");
        }

        const report = res.data.reportData.report;
        const allActors = report.masterData.actors || [];
        const allEvents = report.events.data || [];

        // Solo mostrar jugadores que tienen un evento combatantinfo
        // (WCL solo genera este evento para miembros reales de la raid/grupo)
        const combatantIds = new Set(
            allEvents.filter(ev => ev.type === 'combatantinfo').map(ev => ev.sourceID)
        );
        const raidActors = allActors.filter(a => combatantIds.has(a.id));

        state.currentReport = report;
        state.currentEvents = allEvents;
        state.currentActors = raidActors;
        state.currentLogTitle = report.title;

        // Pre-process: detect specs and store gear from combatantinfo events
        allEvents.forEach(ev => {
            if (ev.type === 'combatantinfo') {
                const p = allActors.find(x => x.id === ev.sourceID);
                if (p) {
                    const spec = detectPlayerSpec(p, ev);
                    state.detectedSpecs[p.name] = spec;

                    if (ev.gear) {
                        // Store gear for the first fight that has it (for overall)
                        if (!state.playerGearDB['overall']) state.playerGearDB['overall'] = {};
                        if (!state.playerGearDB['overall'][p.name]) {
                            state.playerGearDB['overall'][p.name] = ev.gear;
                        }
                    }
                }
            }
        });

        // Also store gear per fight
        report.fights.forEach(fight => {
            const fightEvents = allEvents.filter(ev =>
                ev.timestamp >= (fight.startTime - 15000) && ev.timestamp <= (fight.endTime + 5000)
            );
            fightEvents.forEach(ev => {
                if (ev.type === 'combatantinfo' && ev.gear) {
                    const p = allActors.find(x => x.id === ev.sourceID);
                    if (p) {
                        if (!state.playerGearDB[fight.id]) state.playerGearDB[fight.id] = {};
                        state.playerGearDB[fight.id][p.name] = ev.gear;
                    }
                }
            });
        });

        // Transition to app layout
        window.transitionToApp();

        // Set report info
        document.getElementById('reportInfo').textContent = logId;

        // Render sidebars
        renderFightsSidebar(report);
        renderPlayersSidebar(allActors);

        // Show Discord button
        document.getElementById('btnDiscord').style.display = 'block';

        // Update URL
        window.history.pushState({}, '', '/report/' + logId);

        // Reset content area
        document.getElementById('contentArea').innerHTML = `
            <div class="content-placeholder">
                <div class="placeholder-icon">🦆</div>
                <p>Select a fight and a player to view the analysis</p>
            </div>`;

        // Wowhead prefetch
        let prefetchDiv = document.getElementById('wh-prefetch');
        if (!prefetchDiv) {
            prefetchDiv = document.createElement('div');
            prefetchDiv.id = 'wh-prefetch';
            prefetchDiv.style.cssText = 'display:none; pointer-events:none; position:absolute; width:0; height:0; overflow:hidden;';
            document.body.appendChild(prefetchDiv);
        }
        let uniqueItemIds = new Set();
        if (state.playerGearDB) {
            Object.values(state.playerGearDB).forEach(fightMap => {
                Object.values(fightMap).forEach(gearArr => {
                    if (Array.isArray(gearArr)) {
                        gearArr.forEach(item => { if (item && item.id) uniqueItemIds.add(item.id); });
                    }
                });
            });
        }
        let prefetchHtml = '';
        uniqueItemIds.forEach(id => {
            prefetchHtml += `<a href="https://tbc.wowhead.com/item=${id}"></a>`;
        });
        prefetchDiv.innerHTML = prefetchHtml;

    } catch (e) {
        statusEl.innerHTML = `<p style='color:#ff5252; font-weight:bold; font-size:1.1rem;'>Error: ${e.message}</p>`;
    }
}

export async function fetchDps(logId, fightIDs, playerId) {
    try {
        const response = await fetch('/api/dps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logId, fightIDs, playerId })
        });
        const res = await response.json();
        const fightIdKey = (fightIDs && fightIDs.length === 1) ? fightIDs[0] : 'overall';
        const placeholders = document.querySelectorAll(`[id="dpsPlaceholder-${fightIdKey}-${playerId}"]`);
        placeholders.forEach(placeholder => {
            if (res.error) {
                placeholder.textContent = "(DPS error)";
            } else if (res.isHealing) {
                placeholder.textContent = `| ${res.dps} HPS (${(res.total / 1000).toFixed(1)}k heal)`;
            } else {
                placeholder.textContent = `| ${res.dps} DPS (${(res.total / 1000).toFixed(1)}k dmg)`;
            }
        });
    } catch (err) {
        const fightIdKey = (fightIDs && fightIDs.length === 1) ? fightIDs[0] : 'overall';
        const placeholders = document.querySelectorAll(`[id="dpsPlaceholder-${fightIdKey}-${playerId}"]`);
        placeholders.forEach(placeholder => {
            placeholder.textContent = "";
        });
    }
}
