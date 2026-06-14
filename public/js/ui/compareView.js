import { state } from '../state.js?v=1.3.6';
import { processPlayerData } from '../processor.js?v=1.3.6';
import { parseLogId } from '../utils.js?v=1.3.6';

export function openCompareMode() {
    state.compareState.active = true;
    
    // Set initial values if empty
    if (!state.compareState.fightA) {
        state.compareState.fightA = state.selectedFightId || 'overall';
    }
    if (!state.compareState.playerA) {
        state.compareState.playerA = state.selectedPlayerName && state.selectedPlayerName !== '__ALL__' ? state.selectedPlayerName : '';
    }

    renderCompareUI();
}

function renderCompareUI() {
    const contentArea = document.getElementById('contentArea');
    
    // Build options for Log A (Current Log)
    const fightsA = buildFightsOptions(state.currentReport, state.compareState.fightA);
    const playersA = buildPlayersOptions(state.currentActors, state.compareState.playerA);

    // Build options for Log B (Compare Log)
    let logBSection = '';
    if (!state.compareLogB) {
        logBSection = `
            <div style="margin-top: 15px;">
                <input type="text" id="compareLogInput" placeholder="Paste Log B URL or ID here..." style="padding: 8px; width: 60%; background: #2c3e50; border: 1px solid #34495e; color: #fff;">
                <button onclick="window.loadCompareLog()" style="padding: 8px 15px; background: #27ae60; color: #fff; border: none; cursor: pointer; font-weight: bold; border-radius: 4px;">Load Log B</button>
                <button onclick="window.useSameLogForCompare()" style="padding: 8px 15px; background: #2980b9; color: #fff; border: none; cursor: pointer; font-weight: bold; margin-left: 10px; border-radius: 4px;">Compare with same log</button>
            </div>
            <div id="compareLogStatus" style="margin-top: 10px; font-weight: bold;"></div>
        `;
    } else {
        const fightsB = buildFightsOptions(state.compareLogB.report, state.compareState.fightB);
        const playersB = buildPlayersOptions(state.compareLogB.actors, state.compareState.playerB);
        logBSection = `
            <div style="display: flex; gap: 15px; margin-top: 15px; align-items: center;">
                <div style="color: #2ecc71; font-weight: bold;">Log B Loaded: ${state.compareLogB.logId}</div>
                <button onclick="window.clearCompareLog()" style="padding: 5px 10px; background: #e74c3c; color: #fff; border: none; cursor: pointer; border-radius: 4px;">Change Log B</button>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 10px;">
                <select id="compareFightB" onchange="window.updateCompareSelection()" style="padding: 8px; background: #2c3e50; color: #fff; border: 1px solid #34495e; flex: 1;">
                    <option value="">-- Select Fight B --</option>
                    ${fightsB}
                </select>
                <select id="comparePlayerB" onchange="window.updateCompareSelection()" style="padding: 8px; background: #2c3e50; color: #fff; border: 1px solid #34495e; flex: 1;">
                    <option value="">-- Select Player B --</option>
                    ${playersB}
                </select>
            </div>
        `;
    }

    let compareResult = '';
    if (state.compareState.fightA && state.compareState.playerA && state.compareLogB && state.compareState.fightB && state.compareState.playerB) {
        compareResult = generateComparisonTable();
    }

    contentArea.innerHTML = `
        <div style="padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #34495e; padding-bottom: 10px; margin-bottom: 20px;">
                <h2 style="margin: 0; color: #f1c40f;">⚖️ Compare Logs</h2>
                <button onclick="window.exitCompareMode()" style="padding: 8px 15px; background: #c0392b; color: #fff; border: none; cursor: pointer; font-weight: bold; border-radius: 4px;">Close</button>
            </div>
            
            <div style="display: flex; gap: 40px;">
                <!-- Column A -->
                <div style="flex: 1; background: #1a252f; padding: 15px; border-radius: 8px;">
                    <h3 style="margin-top: 0; color: #3498db;">Log A: ${state.currentLogId}</h3>
                    <div style="display: flex; gap: 10px;">
                        <select id="compareFightA" onchange="window.updateCompareSelection()" style="padding: 8px; background: #2c3e50; color: #fff; border: 1px solid #34495e; flex: 1;">
                            <option value="">-- Select Fight A --</option>
                            ${fightsA}
                        </select>
                        <select id="comparePlayerA" onchange="window.updateCompareSelection()" style="padding: 8px; background: #2c3e50; color: #fff; border: 1px solid #34495e; flex: 1;">
                            <option value="">-- Select Player A --</option>
                            ${playersA}
                        </select>
                    </div>
                </div>

                <!-- Column B -->
                <div style="flex: 1; background: #1a252f; padding: 15px; border-radius: 8px;">
                    <h3 style="margin-top: 0; color: #e67e22;">Log B</h3>
                    ${logBSection}
                </div>
            </div>

            <div style="margin-top: 30px;">
                ${compareResult}
            </div>
        </div>
    `;
}

function buildFightsOptions(report, selectedId) {
    let html = `<option value="overall" ${selectedId === 'overall' ? 'selected' : ''}>Overall</option>`;
    if (!report || !report.fights) return html;
    
    let wipeCounts = {};
    const bossFights = report.fights.filter(f => f.kill === true || f.kill === false || f.difficulty);
    bossFights.forEach(fight => {
        let wipeNum = '';
        if (!fight.kill) {
            wipeCounts[fight.name] = (wipeCounts[fight.name] || 0) + 1;
            wipeNum = ` (Wipe ${wipeCounts[fight.name]})`;
        }
        const isSelected = selectedId === String(fight.id) ? 'selected' : '';
        html += `<option value="${fight.id}" ${isSelected}>${fight.name}${wipeNum}</option>`;
    });
    return html;
}

function buildPlayersOptions(actors, selectedName) {
    let html = '';
    if (!actors) return html;

    const sorted = [...actors].sort((a, b) => {
        const ci = window.CLASSES.indexOf(a.subType) - window.CLASSES.indexOf(b.subType);
        if (ci !== 0) return ci;
        return a.name.localeCompare(b.name);
    });

    // Add aggregate options for roles
    const ROLES = ["Healer", "Tank", "Melee DPS", "Ranged DPS"];
    ROLES.forEach(r => {
        const val = `ROLE:${r}`;
        html += `<option value="${val}" ${selectedName === val ? 'selected' : ''} style="color: #f1c40f;">[All ${r}s]</option>`;
    });
    
    // Add aggregate options for classes
    window.CLASSES.forEach(c => {
        const val = `CLASS:${c}`;
        html += `<option value="${val}" ${selectedName === val ? 'selected' : ''} style="color: #3498db;">[All ${c}s]</option>`;
    });

    html += `<option disabled>──────────</option>`;

    sorted.forEach(p => {
        const isSelected = selectedName === p.name ? 'selected' : '';
        html += `<option value="${p.name}" ${isSelected}>${p.name} (${p.subType})</option>`;
    });
    return html;
}

export function updateCompareSelection() {
    state.compareState.fightA = document.getElementById('compareFightA').value;
    state.compareState.playerA = document.getElementById('comparePlayerA').value;
    
    if (state.compareLogB) {
        state.compareState.fightB = document.getElementById('compareFightB').value;
        state.compareState.playerB = document.getElementById('comparePlayerB').value;
    }
    
    renderCompareUI();
}

export function exitCompareMode() {
    state.compareState.active = false;
    // Trigger main content re-render
    if (window.selectFight) {
        window.selectFight(state.selectedFightId || 'overall');
    }
}

export async function loadCompareLog() {
    const rawInput = document.getElementById('compareLogInput').value.trim();
    const logId = parseLogId(rawInput);
    const statusEl = document.getElementById('compareLogStatus');
    
    if (!logId) {
        statusEl.innerHTML = '<span style="color:#e74c3c;">Invalid URL or Log ID</span>';
        return;
    }
    
    statusEl.innerHTML = '<span style="color:#f1c40f;">Loading Log B...</span>';
    
    try {
        const response = await fetch('/api/audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logId, bypassCache: false })
        });
        
        const res = await response.json();
        if (res.error) throw new Error(res.error);
        if (res.errors) throw new Error(res.errors[0].message);
        
        const report = res.data.reportData.report;
        const allActors = report.masterData.actors || [];
        const allEvents = report.events.data || [];

        const combatantIds = new Set(allEvents.filter(ev => ev.type === 'combatantinfo').map(ev => ev.sourceID));
        const raidActors = allActors.filter(a => combatantIds.has(a.id));

        state.compareLogB = {
            logId,
            report,
            events: allEvents,
            actors: raidActors
        };
        
        // Match fight B with fight A if possible
        if (!state.compareState.fightB) state.compareState.fightB = state.compareState.fightA;
        if (!state.compareState.playerB) state.compareState.playerB = state.compareState.playerA;

        renderCompareUI();
        
    } catch (e) {
        statusEl.innerHTML = `<span style="color:#e74c3c;">Error: ${e.message}</span>`;
    }
}

export function useSameLogForCompare() {
    state.compareLogB = {
        logId: state.currentLogId,
        report: state.currentReport,
        events: state.currentEvents,
        actors: state.currentActors
    };
    
    if (!state.compareState.fightB) state.compareState.fightB = state.compareState.fightA;
    if (!state.compareState.playerB) state.compareState.playerB = state.compareState.playerA;

    renderCompareUI();
}

export function clearCompareLog() {
    state.compareLogB = null;
    state.compareState.fightB = null;
    state.compareState.playerB = null;
    renderCompareUI();
}

// === COMPARISON TABLE LOGIC ===

function extractRelevantEventsForFight(events, report, fightId) {
    if (fightId === 'overall') {
        const validFightIds = new Set(report.fights.map(f => f.id));
        return events.filter(ev => ev.type === 'combatantinfo' || validFightIds.has(ev.fight));
    } else {
        const fightInfo = report.fights.find(f => String(f.id) === String(fightId));
        if (!fightInfo) return [];
        const combatantInfosMap = {};
        const regularEvents = [];
        events.forEach(ev => {
            if (ev.type === 'combatantinfo') {
                if (ev.timestamp <= fightInfo.startTime + 15000 && ev.timestamp >= fightInfo.startTime - 180000) {
                    combatantInfosMap[ev.sourceID] = ev;
                }
            } else if (ev.timestamp >= (fightInfo.startTime - 15000) && ev.timestamp <= (fightInfo.endTime + 5000)) {
                regularEvents.push(ev);
            }
        });
        return [...Object.values(combatantInfosMap), ...regularEvents].sort((a, b) => a.timestamp - b.timestamp);
    }
}

function aggregateData(actors, selection, events, report, fightId) {
    let filteredActors = [];
    if (selection.startsWith('ROLE:')) {
        const role = selection.split(':')[1];
        // Heuristic: map subType to generic roles, or better, process all and check their detected spec
        // We will process all actors and filter by their detected spec role
        filteredActors = actors.filter(a => {
            // Find one combatantinfo to detect spec
            const ci = events.find(e => e.type === 'combatantinfo' && e.sourceID === a.id);
            if (!ci) return false;
            // Hack: manually duplicate detectPlayerSpec logic or just map subTypes
            let r = window.SPEC_ROLES[a.subType] || 'Unknown';
            // Proper spec detection needs more logic, let's just use broad classes for now if no spec is available
            if (role === 'Healer' && ['Priest', 'Paladin', 'Shaman', 'Druid'].includes(a.subType)) r = 'Healer'; // Simplify
            if (role === 'Tank' && ['Warrior', 'Paladin', 'Druid'].includes(a.subType)) r = 'Tank'; // Simplify
            if (role === 'Ranged DPS' && ['Mage', 'Warlock', 'Hunter', 'Druid', 'Shaman', 'Priest'].includes(a.subType)) r = 'Ranged DPS';
            if (role === 'Melee DPS' && ['Rogue', 'Warrior', 'Paladin', 'Shaman', 'Druid'].includes(a.subType)) r = 'Melee DPS';
            return r === role;
        });
    } else if (selection.startsWith('CLASS:')) {
        const cls = selection.split(':')[1];
        filteredActors = actors.filter(a => a.subType === cls);
    } else {
        filteredActors = actors.filter(a => a.name === selection);
    }

    if (filteredActors.length === 0) return null;

    const fightEvents = extractRelevantEventsForFight(events, report, fightId);
    
    // Process each actor and sum up stats
    let totalCasts = {};
    let totalConsumables = {};
    let totalCI = [];

    filteredActors.forEach(player => {
        const pData = processPlayerData(fightId, fightEvents, player);
        if (!pData) return;

        // Sum Item Casts (Consumables)
        for (const [id, count] of Object.entries(pData.itemCasts || {})) {
            totalConsumables[id] = (totalConsumables[id] || 0) + count;
        }
        for (const [id, count] of Object.entries(pData.prePots || {})) {
            totalConsumables[id] = (totalConsumables[id] || 0) + count;
        }

        // Sum Spell Casts
        for (const [id, count] of Object.entries(pData.casts || {})) {
            totalCasts[id] = (totalCasts[id] || 0) + count;
        }

        // Store CI for auras (just take all auras and we can count occurrences)
        pData.combatantInfos.forEach(auras => {
            totalCI.push(auras);
        });
    });

    return { totalCasts, totalConsumables, totalCI, count: filteredActors.length, name: selection };
}

function generateComparisonTable() {
    const dataA = aggregateData(state.currentActors, state.compareState.playerA, state.currentEvents, state.currentReport, state.compareState.fightA);
    const dataB = aggregateData(state.compareLogB.actors, state.compareState.playerB, state.compareLogB.events, state.compareLogB.report, state.compareState.fightB);

    if (!dataA || !dataB) {
        return `<div style="color: #e74c3c;">Could not find players or data for the selected options.</div>`;
    }

    // Build unique sets of items/spells to compare
    const allConsumables = new Set([...Object.keys(dataA.totalConsumables), ...Object.keys(dataB.totalConsumables)]);
    const allSpells = new Set([...Object.keys(dataA.totalCasts), ...Object.keys(dataB.totalCasts)]);
    
    // For auras (flasks, elixirs that are not casts)
    const allAuras = new Set();
    dataA.totalCI.forEach(auras => auras.forEach(a => { if(window.BUFF_DB[a]) allAuras.add(a); }));
    dataB.totalCI.forEach(auras => auras.forEach(a => { if(window.BUFF_DB[a]) allAuras.add(a); }));

    let html = `<table class="compare-table" style="width: 100%; border-collapse: collapse; text-align: left; background: #1a252f; border-radius: 8px; overflow: hidden;">
        <thead>
            <tr style="background: #2c3e50; color: #fff;">
                <th style="padding: 12px; border-bottom: 2px solid #34495e;">Item / Spell</th>
                <th style="padding: 12px; border-bottom: 2px solid #34495e; text-align: center;">${dataA.name} (A) <span style="font-size: 0.8em; color: #7f8c8d;">(${dataA.count} player${dataA.count>1?'s':''})</span></th>
                <th style="padding: 12px; border-bottom: 2px solid #34495e; text-align: center;">${dataB.name} (B) <span style="font-size: 0.8em; color: #7f8c8d;">(${dataB.count} player${dataB.count>1?'s':''})</span></th>
                <th style="padding: 12px; border-bottom: 2px solid #34495e; text-align: center;">Diff (A - B)</th>
            </tr>
        </thead>
        <tbody>
    `;

    const addRow = (iconUrl, name, valA, valB, isAverage) => {
        const diff = valA - valB;
        let diffColor = '#bdc3c7'; // neutral
        if (diff > 0) diffColor = '#2ecc71';
        if (diff < 0) diffColor = '#e74c3c';
        
        let formatVal = v => isAverage ? (v === Math.round(v) ? v : v.toFixed(1)) : v;

        html += `
            <tr style="border-bottom: 1px solid #2c3e50;">
                <td style="padding: 10px; display: flex; align-items: center; gap: 10px;">
                    <img src="${iconUrl}" style="width: 24px; height: 24px; border-radius: 4px;" onerror="this.src='/api/icon/inv_misc_questionmark.jpg'">
                    <span style="color: #ecf0f1;">${name}</span>
                </td>
                <td style="padding: 10px; text-align: center; color: #f1c40f; font-weight: bold;">${formatVal(valA)}</td>
                <td style="padding: 10px; text-align: center; color: #3498db; font-weight: bold;">${formatVal(valB)}</td>
                <td style="padding: 10px; text-align: center; color: ${diffColor}; font-weight: bold;">${diff > 0 ? '+' : ''}${formatVal(diff)}</td>
            </tr>
        `;
    };

    html += `<tr><td colspan="4" style="background: #22313f; padding: 8px; font-weight: bold; color: #95a5a6;">Consumables (Casts)</td></tr>`;
    const sortedCons = [...allConsumables].sort((a,b) => (window.BUFF_DB[a]?.name || '').localeCompare(window.BUFF_DB[b]?.name || ''));
    sortedCons.forEach(id => {
        if (!window.BUFF_DB[id]) return;
        const countA = dataA.totalConsumables[id] || 0;
        const countB = dataB.totalConsumables[id] || 0;
        addRow(`/api/icon/${window.BUFF_DB[id].icon}.jpg`, window.BUFF_DB[id].name, countA, countB, false);
    });

    html += `<tr><td colspan="4" style="background: #22313f; padding: 8px; font-weight: bold; color: #95a5a6;">Buffs (from combatantinfo) - Avg per player</td></tr>`;
    const sortedAuras = [...allAuras].sort((a,b) => (window.BUFF_DB[a]?.name || '').localeCompare(window.BUFF_DB[b]?.name || ''));
    sortedAuras.forEach(id => {
        let occA = dataA.totalCI.filter(auras => auras.includes(parseInt(id))).length;
        let occB = dataB.totalCI.filter(auras => auras.includes(parseInt(id))).length;
        // Average per fight per player
        let avgA = dataA.totalCI.length ? occA / dataA.totalCI.length : 0;
        let avgB = dataB.totalCI.length ? occB / dataB.totalCI.length : 0;
        addRow(`/api/icon/${window.BUFF_DB[id].icon}.jpg`, window.BUFF_DB[id].name, avgA, avgB, true);
    });

    html += `<tr><td colspan="4" style="background: #22313f; padding: 8px; font-weight: bold; color: #95a5a6;">Abilities & Spells</td></tr>`;
    // We need spell names. For now, we will use SPELL_DB or generic names. We can query WCL or use our DB.
    // We will just use the ID if we don't have the name.
    const getSpellInfo = (id) => {
        // Search in SPELL_DB
        for (let cls in window.SPELL_DB) {
            for (let cat of ['casts', 'debuffs']) {
                const sp = window.SPELL_DB[cls][cat] && window.SPELL_DB[cls][cat].find(s => s.ids && s.ids.includes(parseInt(id)));
                if (sp) return sp;
            }
        }
        return { name: `Spell ${id}`, icon: 'inv_misc_questionmark' };
    };

    const sortedSpells = [...allSpells].sort((a,b) => getSpellInfo(a).name.localeCompare(getSpellInfo(b).name));
    sortedSpells.forEach(id => {
        const info = getSpellInfo(id);
        const countA = dataA.totalCasts[id] || 0;
        const countB = dataB.totalCasts[id] || 0;
        addRow(`/api/icon/${info.icon}.jpg`, info.name, countA, countB, false);
    });

    html += `</tbody></table>`;
    return html;
}
