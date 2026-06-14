import { state } from '../state.js?v=1.3.6';
import { processPlayerData } from '../processor.js?v=1.3.6';
import { parseLogId } from '../utils.js?v=1.3.6';
import { generateTimelineHTML } from './modals.js?v=1.3.6';

export function openCompareMode() {
    state.compareState.active = true;
    
    // Set initial values if empty
    if (!state.compareState.fightA) {
        state.compareState.fightA = state.selectedFightId || 'overall';
    }
    if (!state.compareState.playerA) {
        state.compareState.playerA = state.selectedPlayerName && state.selectedPlayerName !== '__ALL__' ? state.selectedPlayerName : '';
    }
    // Hide sidebars to give full width to compare view
    const sbLeft = document.getElementById('sidebarLeft');
    const sbRight = document.getElementById('sidebarRight');
    if (sbLeft) sbLeft.style.display = 'none';
    if (sbRight) sbRight.style.display = 'none';

    renderCompareUI();
    if (window.updateURL) window.updateURL();
}

function renderCompareUI() {
    const contentArea = document.getElementById('contentArea');
    
    // Build options for Log A (Current Log)
    const fightsA = buildFightsOptions(state.currentReport, state.compareState.fightA);
    const playersA = buildPlayersOptions(state.currentActors, state.compareState.playerA);

    // Build options for Log B (Compare Log)
    let logBTop = '';
    let logBBottom = '';
    if (!state.compareLogB) {
        logBTop = `
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
        logBTop = `
            <div style="display: flex; gap: 15px; margin-top: 15px; align-items: center;">
                <div style="color: #2ecc71; font-weight: bold;">Log B Loaded: ${state.compareLogB.logId}</div>
                <button onclick="window.clearCompareLog()" style="padding: 5px 10px; background: #e74c3c; color: #fff; border: none; cursor: pointer; border-radius: 4px;">Change Log B</button>
            </div>
        `;
        logBBottom = `
            <div style="display: flex; gap: 10px; margin-top: auto;">
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
                <div style="flex: 1; background: #1a252f; padding: 15px; border-radius: 8px; display: flex; flex-direction: column;">
                    <h3 style="margin-top: 0; color: #3498db;">Log A: ${state.currentLogId}</h3>
                    <div style="display: flex; gap: 10px; margin-top: auto;">
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
                <div style="flex: 1; background: #1a252f; padding: 15px; border-radius: 8px; display: flex; flex-direction: column;">
                    <h3 style="margin-top: 0; color: #e67e22;">Log B</h3>
                    ${logBTop}
                    ${logBBottom}
                </div>
            </div>

            <div style="margin-top: 30px;">
                ${compareResult}
            </div>
            
            <div id="compareTimelineContainer" style="margin-top: 30px;"></div>
        </div>
    `;
    
    // Inject timeline if compare Result was generated and players selected
    if (compareResult) {
        setTimeout(() => {
            renderCompareTimeline();
        }, 100);
    }
}

// === TIMELINE INTEGRATION ===
function renderCompareTimeline() {
    const container = document.getElementById('compareTimelineContainer');
    if (!container || !state.compareState.fightA || !state.compareLogB || !state.compareState.fightB) return;

    container.innerHTML = `<h3 style="color: #f1c40f; margin-bottom: 15px;">⏳ Comparative Timeline</h3>`;
    
    // We reuse the existing toggleTimelineInline function logic from modals.js, but adapted to render inline.
    // However, timeline.js is built to render a specific player and fight. We might need to render multiple timelines.
    // For simplicity, we can instantiate the timeline HTML and logic manually for the selected players here.
    
    // Fetch logic from modals.js -> renderTimeline
    // To keep it simple and within existing architecture: we will render a grid of timelines.
    const playersA = getFilteredActors(state.currentActors, state.compareState.playerA, state.currentEvents);
    const playersB = getFilteredActors(state.compareLogB.actors, state.compareState.playerB, state.compareLogB.events);

    let html = '<div style="display: flex; gap: 20px; width: 100%;">';
    
    // Helper to generate a placeholder for a timeline
    const addTimelinePlaceholder = (player, side) => {
        const id = `timeline-container-${side}-${player.id}`;
        const innerId = `timeline-${side}-${player.id}`;
        let htmlChunk = `<div id="${id}" class="timeline-draggable" draggable="true" 
            ondragstart="window.handleTimelineDragStart(event)" 
            ondragend="window.handleTimelineDragEnd(event)"
            ondragover="window.handleTimelineDragOver(event)"
            ondragleave="window.handleTimelineDragLeave(event)"
            ondrop="window.handleTimelineDrop(event)"
            style="margin-bottom: 20px; transition: border 0.2s;">
            <h4 style="margin: 0 0 10px 0; color: ${side === 'A' ? '#f1c40f' : '#3498db'}; cursor: grab;">
                <span style="color: #7f8c8d; margin-right: 5px; font-size: 0.9em;">☰</span> ${player.name}
            </h4>
            <div id="${innerId}" class="timeline-inline-container" style="min-height: 100px;"></div>
        </div>`;
        return { html: htmlChunk, data: { id: innerId, player, side } };
    };

    const timelinesToRender = [];
    
    // Left column (Log A)
    html += '<div style="flex: 1; display: flex; flex-direction: column; gap: 20px;">';
    playersA.forEach(p => {
        const res = addTimelinePlaceholder(p, 'A');
        html += res.html;
        timelinesToRender.push(res.data);
    });
    html += '</div>';

    // Right column (Log B)
    html += '<div style="flex: 1; display: flex; flex-direction: column; gap: 20px;">';
    playersB.forEach(p => {
        const res = addTimelinePlaceholder(p, 'B');
        html += res.html;
        timelinesToRender.push(res.data);
    });
    html += '</div>';

    html += '</div>';
    container.innerHTML += html;

    timelinesToRender.forEach(t => {
        const containerEl = document.getElementById(t.id);
        if (!containerEl) return;
        const evs = t.side === 'A' ? state.currentEvents : state.compareLogB.events;
        const fightId = t.side === 'A' ? state.compareState.fightA : state.compareState.fightB;
        const report = t.side === 'A' ? state.currentReport : state.compareLogB.report;
        const fightEvents = extractRelevantEventsForFight(evs, report, fightId);
        
        // We use processPlayerData which populates timelineEvents internally
        const pData = processPlayerData(fightId, fightEvents, t.player);
        if (pData && pData.timelineEvents) {
            const fightInfo = report.fights.find(f => String(f.id) === String(fightId));
            if (fightInfo) {
                containerEl.innerHTML = generateTimelineHTML(t.player.name, fightId, pData.timelineEvents, fightInfo, true);
            } else {
                containerEl.innerHTML = '<span style="color:#7f8c8d;">Fight info not found.</span>';
            }
        } else {
            containerEl.innerHTML = '<span style="color:#7f8c8d;">No timeline data available.</span>';
        }
    });
}

function getFilteredActors(actors, selection, events) {
    if (!selection) return [];
    if (selection.startsWith('ROLE:')) {
        const role = selection.split(':')[1];
        return actors.filter(a => {
            const ci = events.find(e => e.type === 'combatantinfo' && e.sourceID === a.id);
            let r = window.SPEC_ROLES[a.subType] || 'Unknown';
            if (role === 'Healer' && ['Priest', 'Paladin', 'Shaman', 'Druid'].includes(a.subType)) r = 'Healer';
            if (role === 'Tank' && ['Warrior', 'Paladin', 'Druid'].includes(a.subType)) r = 'Tank';
            if (role === 'Ranged DPS' && ['Mage', 'Warlock', 'Hunter', 'Druid', 'Shaman', 'Priest'].includes(a.subType)) r = 'Ranged DPS';
            if (role === 'Melee DPS' && ['Rogue', 'Warrior', 'Paladin', 'Shaman', 'Druid'].includes(a.subType)) r = 'Melee DPS';
            return r === role;
        });
    } else if (selection.startsWith('CLASS:')) {
        const cls = selection.split(':')[1];
        return actors.filter(a => a.subType === cls);
    } else {
        return actors.filter(a => a.name === selection);
    }
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
    
    // Restore sidebars
    const sbLeft = document.getElementById('sidebarLeft');
    const sbRight = document.getElementById('sidebarRight');
    if (sbLeft) sbLeft.style.display = '';
    if (sbRight) sbRight.style.display = '';

    if (window.updateURL) window.updateURL();

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
    const filteredActors = getFilteredActors(actors, selection, events);
    if (filteredActors.length === 0) return null;

    const fightEvents = extractRelevantEventsForFight(events, report, fightId);
    
    let playersData = [];

    filteredActors.forEach(player => {
        const pData = processPlayerData(fightId, fightEvents, player);
        if (!pData) return;

        let totalCasts = {};
        let totalConsumables = {};
        let totalCI = [];

        // Sum Item Casts (Consumables)
        for (const [id, count] of Object.entries(pData.itemCasts || {})) {
            totalConsumables[id] = (totalConsumables[id] || 0) + count;
        }
        for (const [id, count] of Object.entries(pData.prePots || {})) {
            totalConsumables[id] = (totalConsumables[id] || 0) + count;
        }

        // Sum Spell Casts (pData.spells is an object like { id: { count: X, damage: Y } })
        for (const [id, data] of Object.entries(pData.spells || {})) {
            totalCasts[id] = (totalCasts[id] || 0) + data.count;
        }

        pData.combatantInfos.forEach(auras => {
            totalCI.push(auras);
        });

        playersData.push({
            name: player.name,
            subType: player.subType,
            totalCasts,
            totalConsumables,
            totalCI
        });
    });

    // Sort alphabetically
    playersData.sort((a,b) => a.name.localeCompare(b.name));

    return { players: playersData, count: playersData.length, name: selection };
}

function generateComparisonTable() {
    const dataA = aggregateData(state.currentActors, state.compareState.playerA, state.currentEvents, state.currentReport, state.compareState.fightA);
    const dataB = aggregateData(state.compareLogB.actors, state.compareState.playerB, state.compareLogB.events, state.compareLogB.report, state.compareState.fightB);

    if (!dataA || !dataB) {
        return `<div style="color: #e74c3c;">Could not find players or data for the selected options.</div>`;
    }

    // Build unique sets of items/spells to compare
    const allConsumables = new Set();
    const allSpells = new Set();
    const allAuras = new Set();

    [...dataA.players, ...dataB.players].forEach(p => {
        Object.keys(p.totalConsumables).forEach(id => allConsumables.add(id));
        Object.keys(p.totalCasts).forEach(id => allSpells.add(id));
        p.totalCI.forEach(auras => auras.forEach(a => { if(window.BUFF_DB[a]) allAuras.add(a); }));
    });

    const is1v1 = dataA.players.length === 1 && dataB.players.length === 1;

    let html = `<div style="overflow-x: auto;"><table class="compare-table" style="width: 100%; border-collapse: collapse; text-align: left; background: #1a252f; border-radius: 8px; overflow: hidden; min-width: 600px;">
        <thead>
            <tr style="background: #2c3e50; color: #fff;">
                <th style="padding: 12px; border-bottom: 2px solid #34495e;">Item / Spell</th>
    `;

    dataA.players.forEach(p => {
        html += `<th style="padding: 12px; border-bottom: 2px solid #34495e; text-align: center; color: #f1c40f;">${p.name}</th>`;
    });
    
    dataB.players.forEach(p => {
        html += `<th style="padding: 12px; border-bottom: 2px solid #34495e; text-align: center; color: #3498db;">${p.name}</th>`;
    });

    if (is1v1) {
        html += `<th style="padding: 12px; border-bottom: 2px solid #34495e; text-align: center;">Diff (A - B)</th>`;
    }

    html += `</tr></thead><tbody>`;

    const addRow = (iconUrl, name, id, isAura) => {
        html += `<tr style="border-bottom: 1px solid #2c3e50;">
            <td style="padding: 10px; display: flex; align-items: center; gap: 10px;">
                <img src="${iconUrl}" style="width: 24px; height: 24px; border-radius: 4px;" onerror="this.src='/api/icon/inv_misc_questionmark.jpg'">
                <span style="color: #ecf0f1;">${name}</span>
            </td>`;

        let valA = 0;
        let valB = 0;

        // Render A columns
        dataA.players.forEach(p => {
            let val = isAura ? (p.totalCI.filter(auras => auras.includes(parseInt(id))).length > 0 ? 1 : 0) : (p.totalConsumables[id] || p.totalCasts[id] || 0);
            valA += val;
            html += `<td style="padding: 10px; text-align: center; color: #f1c40f; font-weight: bold;">${val}</td>`;
        });

        // Render B columns
        dataB.players.forEach(p => {
            let val = isAura ? (p.totalCI.filter(auras => auras.includes(parseInt(id))).length > 0 ? 1 : 0) : (p.totalConsumables[id] || p.totalCasts[id] || 0);
            valB += val;
            html += `<td style="padding: 10px; text-align: center; color: #3498db; font-weight: bold;">${val}</td>`;
        });

        // Render Diff if 1v1
        if (is1v1) {
            const diff = valA - valB;
            let diffColor = '#bdc3c7'; // neutral
            if (diff > 0) diffColor = '#2ecc71';
            if (diff < 0) diffColor = '#e74c3c';
            html += `<td style="padding: 10px; text-align: center; color: ${diffColor}; font-weight: bold;">${diff > 0 ? '+' : ''}${diff}</td>`;
        }

        html += `</tr>`;
    };

    const colSpanTotal = 1 + dataA.players.length + dataB.players.length + (is1v1 ? 1 : 0);

    html += `<tr><td colspan="${colSpanTotal}" style="background: #22313f; padding: 8px; font-weight: bold; color: #95a5a6;">Consumables</td></tr>`;
    const sortedCons = [...allConsumables].sort((a,b) => (window.BUFF_DB[a]?.name || '').localeCompare(window.BUFF_DB[b]?.name || ''));
    sortedCons.forEach(id => {
        if (!window.BUFF_DB[id]) return;
        addRow(`/api/icon/${window.BUFF_DB[id].icon}.jpg`, window.BUFF_DB[id].name, id, false);
    });

    html += `<tr><td colspan="${colSpanTotal}" style="background: #22313f; padding: 8px; font-weight: bold; color: #95a5a6;">Buffs</td></tr>`;
    const sortedAuras = [...allAuras].sort((a,b) => (window.BUFF_DB[a]?.name || '').localeCompare(window.BUFF_DB[b]?.name || ''));
    sortedAuras.forEach(id => {
        // Exclude category 5 (consumables) from being displayed in buffs
        if (typeof window.SPELL_DB !== 'undefined' && window.SPELL_DB[id] && window.SPELL_DB[id].category === 5) return;
        addRow(`/api/icon/${window.BUFF_DB[id].icon}.jpg`, window.BUFF_DB[id].name, id, true);
    });

    html += `<tr><td colspan="${colSpanTotal}" style="background: #22313f; padding: 8px; font-weight: bold; color: #95a5a6;">Abilities & Spells</td></tr>`;
    const getSpellInfo = (id) => {
        if (typeof window.SPELL_DB !== 'undefined' && window.SPELL_DB[id]) {
            return window.SPELL_DB[id];
        }
        return { name: `Spell ${id}`, icon: 'inv_misc_questionmark' };
    };

    const sortedSpells = [...allSpells].sort((a,b) => getSpellInfo(a).name.localeCompare(getSpellInfo(b).name));
    sortedSpells.forEach(id => {
        const info = getSpellInfo(id);
        addRow(`/api/icon/${info.icon}.jpg`, info.name, id, false);
    });

    html += `</tbody></table></div>`;
    return html;
}

// === DRAG & DROP TIMELINES ===
window.handleTimelineDragStart = function(e) {
    const target = e.target.closest('.timeline-draggable');
    if (target) {
        e.dataTransfer.setData('text/plain', target.id);
        target.style.opacity = '0.4';
    }
};

window.handleTimelineDragEnd = function(e) {
    const target = e.target.closest('.timeline-draggable');
    if (target) target.style.opacity = '1';
    document.querySelectorAll('.timeline-draggable').forEach(el => {
        el.style.borderTop = '';
        el.style.borderBottom = '';
    });
};

window.handleTimelineDragOver = function(e) {
    e.preventDefault();
    const target = e.target.closest('.timeline-draggable');
    if (target) {
        const rect = target.getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
            target.style.borderTop = '2px solid #f1c40f';
            target.style.borderBottom = '';
        } else {
            target.style.borderBottom = '2px solid #f1c40f';
            target.style.borderTop = '';
        }
    }
};

window.handleTimelineDragLeave = function(e) {
    const target = e.target.closest('.timeline-draggable');
    if (target) {
        target.style.borderTop = '';
        target.style.borderBottom = '';
    }
};

window.handleTimelineDrop = function(e) {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    const draggedEl = document.getElementById(draggedId);
    const dropZone = e.target.closest('.timeline-draggable');

    document.querySelectorAll('.timeline-draggable').forEach(el => {
        el.style.borderTop = '';
        el.style.borderBottom = '';
    });

    if (dropZone && draggedEl && draggedEl !== dropZone) {
        // Ensure they belong to the same column (A or B)
        const isColumnA = draggedId.includes('-container-A-') && dropZone.id.includes('-container-A-');
        const isColumnB = draggedId.includes('-container-B-') && dropZone.id.includes('-container-B-');
        
        if (isColumnA || isColumnB) {
            const rect = dropZone.getBoundingClientRect();
            if (e.clientY < rect.top + rect.height / 2) {
                dropZone.parentNode.insertBefore(draggedEl, dropZone);
            } else {
                dropZone.parentNode.insertBefore(draggedEl, dropZone.nextSibling);
            }
        }
    }
};
