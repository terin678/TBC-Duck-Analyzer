// =============================================
// TBC DUCK ANALYZER — Main Application Logic
// =============================================

// === GLOBAL STATE ===
window.currentReport = null;
window.currentEvents = null;
window.currentActors = null;
window.currentLogId = null;
window.currentLogTitle = '';
window.selectedFightId = null;
window.selectedPlayerName = null;
window.detectedSpecs = {};
window.playerGearDB = {};
window.playerEnchantsForConsole = {};

// === SPEC DETECTION ===

const SPEC_ALIASES = {
    "Druid-Guardian": "Druid-Feral",
    "Druid-Feral Combat": "Druid-Feral",
    "Warlock-Curses": "Warlock-Affliction",
    "Paladin-Justicar": "Paladin-Protection",
};

const CLASS_SPEC_DEFAULTS = {
    "Warrior": "Warrior-Fury",
    "Paladin": "Paladin-Holy",
    "Hunter": "Hunter-BeastMastery",
    "Rogue": "Rogue-Combat",
    "Priest": "Priest-Holy",
    "Shaman": "Shaman-Restoration",
    "Mage": "Mage-Fire",
    "Warlock": "Warlock-Destruction",
    "Druid": "Druid-Balance",
};

function detectPlayerSpec(player, combatantInfo) {
    if (!player) return "Unknown";
    if (player.icon) {
        const iconStr = player.icon.toLowerCase();
        if (iconStr.includes('-') || CLASSES.map(c => c.toLowerCase()).includes(iconStr)) {
            const parts = iconStr.split('-');
            if (parts.length >= 2) {
                const normalized = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('-');
                if (SPEC_ALIASES[normalized]) return SPEC_ALIASES[normalized];
                if (SPEC_ICONS[normalized]) return normalized;
            } else if (parts.length === 1) {
                const normalized = iconStr.charAt(0).toUpperCase() + iconStr.slice(1);
                if (CLASSES.includes(normalized)) {
                    return inferSpecFromStats(normalized, combatantInfo);
                }
            }
        }
        return player.icon;
    }
    if (player.subType && CLASSES.includes(player.subType)) {
        return inferSpecFromStats(player.subType, combatantInfo);
    }
    return player.subType || "Unknown";
}

function inferSpecFromStats(className, info) {
    if (!info) return CLASS_SPEC_DEFAULTS[className] || className;
    const agi = info.agility || 0;
    const intel = info.intellect || 0;
    const str = info.strength || 0;
    const armor = info.armor || 0;
    const hitSpell = info.hitSpell || 0;
    const hitMelee = info.hitMelee || 0;
    const critSpell = info.critSpell || 0;
    const block = info.block || 0;
    const dodge = info.dodge || 0;

    switch (className) {
        case "Paladin":
            if (armor > 12000 || block > 15) return "Paladin-Protection";
            if (str > intel && str > 250 && hitMelee > 0) return "Paladin-Retribution";
            return "Paladin-Holy";
        case "Warrior":
            if (armor > 12000 || block > 15) return "Warrior-Protection";
            return "Warrior-Fury";
        case "Druid":
            if ((agi > 300 || armor > 15000) && hitMelee > hitSpell) return "Druid-Feral";
            if (hitSpell > 50 && critSpell > 50) return "Druid-Balance";
            if (intel > 300 && hitSpell <= 50 && hitMelee <= 30) return "Druid-Restoration";
            return agi > intel ? "Druid-Feral" : "Druid-Balance";
        case "Priest":
            if (hitSpell > 50 && critSpell > 50) return "Priest-Shadow";
            return "Priest-Holy";
        case "Shaman":
            if (agi > 300 && hitMelee > 30) return "Shaman-Enhancement";
            if (hitSpell > 50 && critSpell > 50) return "Shaman-Elemental";
            return "Shaman-Restoration";
        default:
            return CLASS_SPEC_DEFAULTS[className] || className;
    }
}

// === UTILITY ===

function parseLogId(input) {
    if (!input) return "";
    let val = input.trim();
    if (val.includes("warcraftlogs.com/reports/")) {
        val = val.split("/reports/")[1].split(/[#?\/]/)[0];
    }
    return val;
}

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// === PAGE TRANSITIONS ===

function transitionToApp() {
    document.getElementById('landingPage').classList.add('hidden');
    document.getElementById('appLayout').classList.add('visible');
}

function goBackToLanding() {
    document.getElementById('appLayout').classList.remove('visible');
    document.getElementById('landingPage').classList.remove('hidden');
    window.selectedFightId = null;
    window.selectedPlayerName = null;
    window.currentReport = null;
    window.currentEvents = null;
    window.currentActors = null;
    document.getElementById('btnDiscord').style.display = 'none';
}

// === MAIN AUDIT FUNCTION ===

async function auditarLog() {
    const rawInput = document.getElementById('logInput').value.trim();
    const logId = parseLogId(rawInput);
    if (!logId) return;

    window.currentLogId = logId;
    window.detectedSpecs = {};
    window.playerGearDB = {};
    window.playerEnchantsForConsole = {};

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

        window.currentReport = report;
        window.currentEvents = allEvents;
        window.currentActors = allActors;
        window.currentLogTitle = report.title;

        // Pre-process: detect specs and store gear from combatantinfo events
        allEvents.forEach(ev => {
            if (ev.type === 'combatantinfo') {
                const p = allActors.find(x => x.id === ev.sourceID);
                if (p) {
                    const spec = detectPlayerSpec(p, ev);
                    window.detectedSpecs[p.name] = spec;

                    if (ev.gear) {
                        // Store gear for the first fight that has it (for overall)
                        if (!window.playerGearDB['overall']) window.playerGearDB['overall'] = {};
                        if (!window.playerGearDB['overall'][p.name]) {
                            window.playerGearDB['overall'][p.name] = ev.gear;
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
                        if (!window.playerGearDB[fight.id]) window.playerGearDB[fight.id] = {};
                        window.playerGearDB[fight.id][p.name] = ev.gear;
                    }
                }
            });
        });

        // Transition to app layout
        transitionToApp();

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
        if (window.playerGearDB) {
            Object.values(window.playerGearDB).forEach(fightMap => {
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

// === SIDEBAR RENDERING ===

function renderFightsSidebar(report) {
    const fightsList = document.getElementById('fightsList');
    let html = '';

    // OVERALL entry
    html += `<div class="fight-item" data-fight="overall" onclick="selectFight('overall')">
        <div class="fight-info">
            <div class="fight-name">Overall</div>
            <div class="fight-status fight-status-overall">ALL FIGHTS</div>
        </div>
    </div>`;

    // Individual fights
    let wipeCounts = {};
    report.fights.forEach(fight => {
        const duration = fight.endTime - fight.startTime;
        const timeStr = formatDuration(duration);
        const isKill = fight.kill;
        const statusClass = isKill ? 'fight-status-kill' : 'fight-status-wipe';
        const statusText = isKill ? 'KILL' : 'WIPE';

        let wipeNum = '';
        if (!isKill) {
            wipeCounts[fight.name] = (wipeCounts[fight.name] || 0) + 1;
            wipeNum = ` #${wipeCounts[fight.name]}`;
        }

        html += `<div class="fight-item" data-fight="${fight.id}" onclick="selectFight('${fight.id}')">
            <div class="fight-info">
                <div class="fight-name">${fight.name}${wipeNum}</div>
                <div class="fight-status ${statusClass}">${statusText}</div>
            </div>
            <div class="fight-time">${timeStr}</div>
        </div>`;
    });

    fightsList.innerHTML = html;
}

function renderPlayersSidebar(allActors) {
    const playersList = document.getElementById('playersList');

    // "All" option at the top
    let html = `<div class="player-item all-player-item" data-player="__ALL__" onclick="selectPlayer('__ALL__')">
        <span class="all-player-icon">👥</span>
        <span class="all-player-label">All</span>
    </div>`;

    // Sort by class order, then by name
    const sorted = [...allActors].sort((a, b) => {
        const ci = CLASSES.indexOf(a.subType) - CLASSES.indexOf(b.subType);
        if (ci !== 0) return ci;
        return a.name.localeCompare(b.name);
    });

    html += sorted.map(player => {
        const spec = window.detectedSpecs[player.name] || player.subType;
        const specIcon = SPEC_ICONS[spec] || SPEC_ICONS[player.subType] || 'inv_misc_questionmark';
        const className = player.subType;
        // Escape single quotes in player names for onclick
        const safeName = player.name.replace(/'/g, "\\'");
        return `<div class="player-item" data-player="${escapeHtml(player.name)}" onclick="selectPlayer('${safeName}')">
            <img src="/api/icon/${specIcon}.jpg" class="player-item-icon" onerror="this.src='/api/icon/inv_misc_questionmark.jpg'">
            <span class="${className}-color">${player.name}</span>
        </div>`;
    }).join('');

    playersList.innerHTML = html;
}

// === SELECTION HANDLERS ===

function selectFight(fightId) {
    window.selectedFightId = fightId;
    document.querySelectorAll('.fight-item').forEach(el => {
        el.classList.toggle('active', el.dataset.fight == fightId);
    });
    renderMainContent();
}

function selectPlayer(playerName) {
    window.selectedPlayerName = playerName;
    document.querySelectorAll('.player-item').forEach(el => {
        el.classList.toggle('active', el.dataset.player === playerName);
    });
    renderMainContent();
}

// === MAIN CONTENT RENDERING ===

function renderMainContent() {
    const contentArea = document.getElementById('contentArea');

    if (!window.selectedFightId || !window.selectedPlayerName) {
        let msg = 'Select a fight and a player to view the analysis';
        if (window.selectedFightId && !window.selectedPlayerName) {
            msg = 'Now select a player to view the analysis';
        } else if (!window.selectedFightId && window.selectedPlayerName) {
            msg = 'Now select a fight to view the analysis';
        }
        contentArea.innerHTML = `<div class="content-placeholder"><div class="placeholder-icon">🦆</div><p>${msg}</p></div>`;
        return;
    }

    const fightId = window.selectedFightId;
    const playerName = window.selectedPlayerName;
    const report = window.currentReport;
    const allEvents = window.currentEvents;
    const allActors = window.currentActors;

    // Get fight events
    let fightEvents;
    let fightInfo = null;
    if (fightId === 'overall') {
        fightEvents = allEvents;
    } else {
        fightInfo = report.fights.find(f => f.id == fightId);
        if (!fightInfo) {
            contentArea.innerHTML = '<div class="content-placeholder"><p>Fight not found</p></div>';
            return;
        }
        fightEvents = allEvents.filter(ev =>
            ev.timestamp >= (fightInfo.startTime - 15000) && ev.timestamp <= (fightInfo.endTime + 5000)
        );
    }

    // "All" view — raid summary
    if (playerName === '__ALL__') {
        contentArea.innerHTML = renderAllPlayersView(fightId, fightEvents, allActors, fightInfo);
        // Refresh Wowhead tooltips
        if (typeof $WowheadPower !== 'undefined') {
            $WowheadPower.refreshLinks();
        }
        return;
    }

    // Find player actor
    const player = allActors.find(a => a.name === playerName);
    if (!player) {
        contentArea.innerHTML = '<div class="content-placeholder"><p>Player not found</p></div>';
        return;
    }

    // Process and render
    const playerData = processPlayerData(fightId, fightEvents, player);
    contentArea.innerHTML = renderPlayerView(playerData, player, fightInfo);

    // Fetch DPS
    if (fightInfo) {
        fetchDps(window.currentLogId, fightInfo.startTime, fightInfo.endTime, player.id);
    } else {
        // Overall: compute total time range from all fights
        const fights = report.fights;
        if (fights && fights.length > 0) {
            const minStart = Math.min(...fights.map(f => f.startTime));
            const maxEnd = Math.max(...fights.map(f => f.endTime));
            fetchDps(window.currentLogId, minStart, maxEnd, player.id);
        }
    }

    // Refresh Wowhead tooltips
    if (typeof $WowheadPower !== 'undefined') {
        $WowheadPower.refreshLinks();
    }
}

// === PLAYER DATA PROCESSING ===

function processPlayerData(fightId, fightEvents, player) {
    let combatantInfos = [];
    let tempEnchants = [];
    let spells = {};
    let timelineEvents = {};
    let deaths = [];
    let rebirths = [];

    // Phase 1: combatantinfo + buff events
    fightEvents.forEach(ev => {
        if (ev.type === 'combatantinfo' && ev.sourceID === player.id) {
            combatantInfos.push(ev.auras ? ev.auras.map(a => a.ability) : []);

            if (ev.gear && ev.gear.length > 0) {
                if (!window.playerGearDB[fightId]) window.playerGearDB[fightId] = {};
                window.playerGearDB[fightId][player.name] = ev.gear;

                // Temp enchants
                let enchants = [];
                let weapons = 1;
                let offHand = ev.gear[16];
                if (['Rogue', 'Hunter', 'Warrior', 'Shaman'].includes(player.subType)) {
                    if (offHand && offHand.id !== 0 && offHand.icon) {
                        let iconName = offHand.icon.toLowerCase();
                        let isWeapon = iconName.includes('sword') || iconName.includes('axe') ||
                            iconName.includes('mace') || iconName.includes('hammer') ||
                            iconName.includes('dagger') || iconName.includes('fist') ||
                            iconName.includes('blade') || iconName.includes('knife') ||
                            iconName.includes('weapon');
                        if (isWeapon) weapons = 2;
                    }
                }

                [15, 16].forEach(slotIdx => {
                    let item = ev.gear[slotIdx];
                    if (item && item.id !== 0) {
                        let rawEnchant = item.temporaryEnchant || item.tempEnchant;
                        if (!window.playerEnchantsForConsole[player.name]) window.playerEnchantsForConsole[player.name] = new Set();
                        if (rawEnchant) window.playerEnchantsForConsole[player.name].add(rawEnchant);
                        if (rawEnchant && ENCHANT_DB[rawEnchant]) {
                            enchants.push(rawEnchant);
                        }
                    }
                });
                tempEnchants.push({ enchants, weapons });
            }
        }

        // Buff tracking from applybuff/refreshbuff/cast events
        let isBuffTarget = ['applybuff', 'applybuffstack', 'refreshbuff'].includes(ev.type) && ev.targetID === player.id;
        let isCastSource = ev.type === 'cast' && ev.sourceID === player.id;

        if (isBuffTarget || isCastSource) {
            if (typeof BUFF_DB !== 'undefined' && BUFF_DB[ev.abilityGameID]) {
                if (combatantInfos.length === 0) combatantInfos.push([]);
                let lastInfos = combatantInfos[combatantInfos.length - 1];
                if (!lastInfos.includes(ev.abilityGameID)) {
                    lastInfos.push(ev.abilityGameID);
                }
            }
        }
    });

    // Phase 2: Spell casts, interrupts, damage
    fightEvents.forEach(ev => {
        if (ev.type === 'death' && (ev.targetID === player.id || (!ev.targetID && ev.sourceID === player.id))) {
            deaths.push(ev.timestamp);
        }
        // Combat Res (Druid Rebirth)
        if (ev.type === 'cast' && (ev.abilityGameID === 20484 || ev.abilityGameID === 26994) && ev.targetID === player.id) {
            rebirths.push({ timestamp: ev.timestamp, type: 'Combat Res', icon: '🌿' });
        }
        // Shaman Reincarnation (Ankh)
        if (ev.type === 'cast' && ev.abilityGameID === 20608 && ev.sourceID === player.id) {
            rebirths.push({ timestamp: ev.timestamp, type: 'Ankh', icon: '⚡' });
        }
        // Soulstone Resurrection
        if (ev.type === 'cast' && ev.abilityGameID === 20707 && ev.targetID === player.id) {
            rebirths.push({ timestamp: ev.timestamp, type: 'Soulstone', icon: '💎' });
        }

        let playerId = ev.sourceID;
        if (ev.type === 'damage' && ev.abilityGameID === 33671) playerId = ev.targetID;
        if (['applybuff', 'applybuffstack', 'refreshbuff', 'removebuff'].includes(ev.type)) playerId = ev.targetID;
        if (playerId !== player.id) return;

        if (ev.type === 'cast' && SPELL_DB[ev.abilityGameID] && !SPELL_DB[ev.abilityGameID].isInterrupt && !SPELL_DB[ev.abilityGameID].isMechanic && !SPELL_DB[ev.abilityGameID].isRes && SPELL_DB[ev.abilityGameID].category !== 5 && SPELL_DB[ev.abilityGameID].category !== 3) {
            if (ev.abilityGameID === 33671) return;
            if (!spells[ev.abilityGameID]) spells[ev.abilityGameID] = { count: 0, damage: 0 };
            spells[ev.abilityGameID].count += 1;
        }
        else if (ev.type === 'interrupt' && SPELL_DB[ev.abilityGameID]) {
            if (!spells[ev.abilityGameID]) spells[ev.abilityGameID] = { count: 0, damage: 0 };
            spells[ev.abilityGameID].count += 1;
        }
        // Sappers: track cast count + accumulate damage from hits
        else if (ev.type === 'cast' && (ev.abilityGameID === 13241 || ev.abilityGameID === 30486)) {
            if (!spells[ev.abilityGameID]) spells[ev.abilityGameID] = { count: 0, damage: 0 };
            spells[ev.abilityGameID].count += 1;
        }
        else if (ev.type === 'damage' && (ev.abilityGameID === 13241 || ev.abilityGameID === 30486 || ev.abilityGameID === 33671)) {
            if (!spells[ev.abilityGameID]) spells[ev.abilityGameID] = { count: 0, damage: 0 };
            spells[ev.abilityGameID].damage += (ev.amount || 0) + (ev.absorbed || 0);
            if (ev.abilityGameID === 33671) spells[ev.abilityGameID].count += 1;
        }

        // Phase 3: Timeline tracking
        if (typeof TIMELINE_SPELLS !== 'undefined' && TIMELINE_SPELLS[ev.abilityGameID]) {
            let spellId = ev.abilityGameID;
            if (!timelineEvents[spellId]) timelineEvents[spellId] = [];
            
            if (['applybuff', 'applybuffstack', 'refreshbuff'].includes(ev.type)) {
                let openEv = timelineEvents[spellId].find(t => t.end === null);
                if (!openEv) {
                    timelineEvents[spellId].push({ start: ev.timestamp, end: null });
                }
            } else if (ev.type === 'removebuff') {
                let openEv = timelineEvents[spellId].find(t => t.end === null);
                if (openEv) {
                    openEv.end = ev.timestamp;
                }
            } else if (ev.type === 'cast' && TIMELINE_SPELLS[spellId].duration) {
                // Track instantaneous casts like Sappers that have a defined fake duration for visual purposes
                timelineEvents[spellId].push({ start: ev.timestamp, end: ev.timestamp + TIMELINE_SPELLS[spellId].duration });
            }
        }
    });

    // Cleanup any open timeline events
    Object.keys(timelineEvents).forEach(spellId => {
        timelineEvents[spellId].forEach(ev => {
            if (ev.end === null) {
                // If it never removed, assume it lasted 15s or until the end of fight
                // We will cap it in render.
                ev.end = ev.start + 15000; 
            }
        });
    });

    return {
        combatantInfos,
        tempEnchants,
        spells,
        timelineEvents,
        deaths,
        rebirths,
        spec: window.detectedSpecs[player.name] || player.subType
    };
}

// === PLAYER VIEW RENDERING ===

function renderPlayerView(data, player, fightInfo) {
    const spec = data.spec;
    const specIcon = SPEC_ICONS[spec] || SPEC_ICONS[player.subType] || 'inv_misc_questionmark';
    const className = player.subType;
    const fightId = window.selectedFightId;
    const isOverall = (fightId === 'overall');
    const totalFights = Math.max(1, data.combatantInfos.length);

    // Fight title
    let fightTitle = 'Overall';
    if (fightInfo) {
        const duration = fightInfo.endTime - fightInfo.startTime;
        fightTitle = `${fightInfo.name} — ${formatDuration(duration)}`;
    }

    // === BUFFS ===
    let standardBuffHtmls = [];
    let weaponBuffHtmls = [];

    const usedBuffs = Object.keys(BUFF_DB).filter(id =>
        data.combatantInfos.some(auras => auras.includes(parseInt(id)))
    );
    usedBuffs.forEach(id => {
        const count = data.combatantInfos.filter(auras => auras.includes(parseInt(id))).length;
        let ratioDisplay = `<span class="buff-ratio">${count}${isOverall && totalFights > 1 ? `/${totalFights}` : ''}</span>`;
        standardBuffHtmls.push(`<div class="buff-item"><img class="buff-icon" src="/api/icon/${BUFF_DB[id].icon}.jpg" onerror="this.src='/api/icon/inv_misc_questionmark.jpg'"><span class="buff-name">${BUFF_DB[id].name}</span>${ratioDisplay}</div>`);
    });

    // Weapon enchant buffs
    const weaponBuffsAggregated = {};
    let totalExpectedWeapons = 0;
    data.tempEnchants.forEach(info => {
        totalExpectedWeapons += info.weapons;
        info.enchants.forEach(eId => {
            if (ENCHANT_DB[eId]) {
                let enchName = ENCHANT_DB[eId].name;
                if (!weaponBuffsAggregated[enchName]) weaponBuffsAggregated[enchName] = { count: 0, icon: ENCHANT_DB[eId].icon || 'inv_misc_questionmark' };
                weaponBuffsAggregated[enchName].count += 1;
            }
        });
    });
    Object.entries(weaponBuffsAggregated).forEach(([enchName, d]) => {
        let ratioHtml = `<span class="buff-ratio">${d.count}${isOverall || totalExpectedWeapons > 1 ? `/${totalExpectedWeapons}` : ''}</span>`;
        weaponBuffHtmls.push(`<div class="buff-item"><img class="buff-icon weapon-enchant" src="/api/icon/${d.icon}.jpg" onerror="this.src='/api/icon/inv_misc_questionmark.jpg'"><span class="buff-name">${enchName} (Weapon)</span>${ratioHtml}</div>`);
    });

    let allBuffHtmls = [...standardBuffHtmls, ...weaponBuffHtmls];
    let buffsHtml = allBuffHtmls.length === 0
        ? '<span class="no-buffs">NO BUFFS</span>'
        : allBuffHtmls.join('');

    // === SPELLS ===
    let spellListHtml = Object.entries(data.spells)
        .filter(([spellId]) => SPELL_DB[spellId])
        .sort(([a], [b]) => {
            const catA = SPELL_DB[a].category || 2;
            const catB = SPELL_DB[b].category || 2;
            return catA - catB;
        })
        .map(([spellId, sData]) => {
            let dmgText = sData.damage > 0 ? (sData.damage >= 1000 ? (sData.damage / 1000).toFixed(1) + 'k' : sData.damage) : '';
            return `<div class="spell-item">
                <img class="spell-icon" src="/api/icon/${SPELL_DB[spellId].icon}.jpg" onerror="this.src='/api/icon/inv_misc_questionmark.jpg'">
                <span class="spell-name">${SPELL_DB[spellId].name}</span>
                <span class="spell-count">x${Math.max(1, sData.count)}</span>
                ${sData.damage > 0 ? `<span class="spell-damage">${dmgText}</span>` : ''}
            </div>`;
        }).join('');

    // === GEAR BUTTON ===
    const safeName = player.name.replace(/'/g, "\\'");
    let gearBtnHtml = `<button class="inspect-btn" onclick="toggleGearInline('${safeName}', '${fightId}', '${className}', '${spec}')">🔍 Inspect Gear</button>`;

    // === TIMELINE BUTTON ===
    window.timelineDB = window.timelineDB || {};
    if (!window.timelineDB[fightId]) window.timelineDB[fightId] = {};
    window.timelineDB[fightId][player.name] = data.timelineEvents;

    let timelineBtnHtml = '';
    if (!isOverall) {
        timelineBtnHtml = `<button class="inspect-btn timeline-btn" onclick="toggleTimelineInline('${safeName}', '${fightId}')">⏱️ Timeline</button>`;
    }

    // === DEATHS & RESS (chronological) ===
    let eventsHtml = '';
    if (isOverall) {
        if (data.deaths && data.deaths.length > 0) {
            eventsHtml += `<span class="event-pill event-death" style="color:#ff5252; margin-left: 10px; font-size: 0.85rem; font-weight: bold; background: rgba(255,82,82,0.1); padding: 2px 6px; border-radius: 4px;">✕ ${data.deaths.length} Deaths</span>`;
        }
        if (data.rebirths && data.rebirths.length > 0) {
            const resByType = {};
            data.rebirths.forEach(r => {
                if (!resByType[r.type]) resByType[r.type] = { count: 0, icon: r.icon };
                resByType[r.type].count++;
            });
            Object.entries(resByType).forEach(([type, info]) => {
                eventsHtml += `<span class="event-pill event-ress" style="color:#4caf50; margin-left: 10px; font-size: 0.85rem; font-weight: bold; background: rgba(76,175,80,0.1); padding: 2px 6px; border-radius: 4px;">${info.icon} ${info.count} ${type}</span>`;
            });
        }
    } else {
        // Merge deaths and rebirths chronologically
        let allEvents = [];
        if (data.deaths) {
            data.deaths.forEach(d => {
                allEvents.push({ timestamp: d, type: 'death' });
            });
        }
        if (data.rebirths) {
            data.rebirths.forEach(r => {
                allEvents.push({ timestamp: r.timestamp, type: 'res', resType: r.type, icon: r.icon });
            });
        }
        allEvents.sort((a, b) => a.timestamp - b.timestamp);
        allEvents.forEach(ev => {
            let relTime = fightInfo ? ev.timestamp - fightInfo.startTime : 0;
            if (ev.type === 'death') {
                eventsHtml += `<span class="event-pill event-death" style="color:#ff5252; font-size: 0.8rem; font-weight: bold; background: rgba(255,82,82,0.1); padding: 2px 6px; border-radius: 4px;">✕ Dead at ${formatDuration(Math.max(0, relTime))}</span>`;
            } else {
                eventsHtml += `<span class="event-pill event-ress" style="color:#4caf50; font-size: 0.8rem; font-weight: bold; background: rgba(76,175,80,0.1); padding: 2px 6px; border-radius: 4px;">${ev.icon} ${ev.resType} at ${formatDuration(Math.max(0, relTime))}</span>`;
            }
        });
    }

    // === BOSS ICON ===
    let bossSlug = fightTitle.replace(/'/g, '').replace(/[\s,-]+/g, '-').toLowerCase();
    let bossIconHtml = isOverall ? '' : `<img src="/assets/bosses/ui-ej-boss-${bossSlug}.png" style="height: 24px; vertical-align: middle; margin-right: 8px; border-radius: 4px;" onerror="this.style.display='none'">`;

    return `
        <div class="player-view">
            <div class="player-view-header">
                <img src="/api/icon/${specIcon}.jpg" class="player-view-spec-icon" onerror="this.src='/api/icon/inv_misc_questionmark.jpg'">
                <span class="player-view-name ${className}-color">${player.name}</span>
                <div class="player-view-right">
                    <div class="player-view-fight-line">${bossIconHtml}${fightTitle} <span id="dpsPlaceholder-${fightId}-${player.id}" style="color:#f4b400; margin-left: 15px; font-size:0.9rem;">(Loading DPS...)</span></div>
                    ${eventsHtml ? `<div class="player-view-events">${eventsHtml}</div>` : ''}
                </div>
            </div>

            <div class="player-view-section">
                <div class="player-view-section-title">Consumables & Buffs</div>
                <div class="buff-bar">${buffsHtml}</div>
            </div>

            <div class="player-view-section">
                <div class="player-view-section-title">Abilities</div>
                <div class="spell-grid">${spellListHtml || '<span class="no-data">No tracked abilities used</span>'}</div>
            </div>

            <div class="player-view-actions">
                ${gearBtnHtml}
                ${timelineBtnHtml}
            </div>
            <div id="inlineGearContainer" style="display:none; margin-top: 10px;"></div>
            <div id="inlineTimelineContainer" style="display:none; margin-top: 10px;"></div>
        </div>
    `;
}

// =============================================
// ALL PLAYERS — RAID SUMMARY VIEW
// =============================================

window._allViewClassFilter = null; // null = show all, or a class name

function renderAllPlayersView(fightId, fightEvents, allActors, fightInfo) {
    const isOverall = (fightId === 'overall');

    // Fight title
    let fightTitle = 'Overall';
    if (fightInfo) {
        const duration = fightInfo.endTime - fightInfo.startTime;
        fightTitle = `${fightInfo.name} — ${formatDuration(duration)}`;
    }
    let bossSlug = fightTitle.replace(/'/g, '').replace(/[\s,-]+/g, '-').toLowerCase();
    let bossIconHtml = isOverall ? '' : `<img src="/assets/bosses/ui-ej-boss-${bossSlug}.png" style="height: 20px; vertical-align: middle; margin-right: 6px; border-radius: 4px;" onerror="this.style.display='none'">`;

    // Group players by class
    const playersByClass = {};
    CLASSES.forEach(cls => { playersByClass[cls] = []; });
    const sorted = [...allActors].sort((a, b) => {
        const ci = CLASSES.indexOf(a.subType) - CLASSES.indexOf(b.subType);
        if (ci !== 0) return ci;
        return a.name.localeCompare(b.name);
    });
    sorted.forEach(player => {
        if (playersByClass[player.subType]) {
            playersByClass[player.subType].push(player);
        }
    });

    // Class filter chips
    const activeFilter = window._allViewClassFilter;
    let filterHtml = `<div class="all-view-class-filter">`;
    filterHtml += `<button class="all-view-class-chip ${!activeFilter ? 'active' : ''}" onclick="filterAllViewByClass(null)">All</button>`;
    CLASSES.forEach(cls => {
        if (playersByClass[cls].length === 0) return;
        const isActive = activeFilter === cls;
        filterHtml += `<button class="all-view-class-chip ${cls}-chip ${isActive ? 'active' : ''}" onclick="filterAllViewByClass('${cls}')">${cls} <span class="chip-count">${playersByClass[cls].length}</span></button>`;
    });
    filterHtml += `</div>`;

    // Render each class section
    let sectionsHtml = '';
    CLASSES.forEach(cls => {
        const players = playersByClass[cls];
        if (players.length === 0) return;
        const isHidden = activeFilter && activeFilter !== cls;

        const classIcon = SPEC_ICONS[cls] || 'inv_misc_questionmark';
        sectionsHtml += `<div class="all-view-class-section ${isHidden ? 'hidden-section' : ''}" data-class="${cls}">`;
        sectionsHtml += `<div class="all-view-class-header">
            <img src="/api/icon/${classIcon}.jpg" class="all-view-class-icon" onerror="this.src='/api/icon/inv_misc_questionmark.jpg'">
            <span class="${cls}-color">${cls}</span>
            <span class="all-view-class-count">${players.length}</span>
        </div>`;

        sectionsHtml += `<div class="all-view-players-grid">`;
        players.forEach(player => {
            const playerData = processPlayerData(fightId, fightEvents, player);
            sectionsHtml += renderAllPlayerCard(playerData, player, fightInfo, isOverall);
        });
        sectionsHtml += `</div></div>`;
    });

    return `
        <div class="all-view">
            <div class="all-view-header">
                <span class="all-view-icon">👥</span>
                <span class="all-view-title">Raid Summary</span>
                <span class="all-view-fight">${bossIconHtml}${fightTitle}</span>
            </div>
            ${filterHtml}
            ${sectionsHtml}
        </div>
    `;
}

function renderAllPlayerCard(data, player, fightInfo, isOverall) {
    const spec = data.spec;
    const specIcon = SPEC_ICONS[spec] || SPEC_ICONS[player.subType] || 'inv_misc_questionmark';
    const className = player.subType;
    const fightId = window.selectedFightId;
    const totalFights = Math.max(1, data.combatantInfos.length);

    // Compact buff icons (no names)
    const usedBuffs = Object.keys(BUFF_DB).filter(id =>
        data.combatantInfos.some(auras => auras.includes(parseInt(id)))
    );
    let buffsHtml = '';
    usedBuffs.forEach(id => {
        const count = data.combatantInfos.filter(auras => auras.includes(parseInt(id))).length;
        let ratioText = `${count}${isOverall && totalFights > 1 ? '/' + totalFights : ''}`;
        buffsHtml += `<div class="av-buff" title="${BUFF_DB[id].name}">
            <img src="/api/icon/${BUFF_DB[id].icon}.jpg" onerror="this.src='/api/icon/inv_misc_questionmark.jpg'">
            <span class="av-ratio">${ratioText}</span>
        </div>`;
    });

    // Weapon enchant buffs (compact)
    const weaponBuffsAggregated = {};
    let totalExpectedWeapons = 0;
    data.tempEnchants.forEach(info => {
        totalExpectedWeapons += info.weapons;
        info.enchants.forEach(eId => {
            if (ENCHANT_DB[eId]) {
                let enchName = ENCHANT_DB[eId].name;
                if (!weaponBuffsAggregated[enchName]) weaponBuffsAggregated[enchName] = { count: 0, icon: ENCHANT_DB[eId].icon || 'inv_misc_questionmark' };
                weaponBuffsAggregated[enchName].count += 1;
            }
        });
    });
    Object.entries(weaponBuffsAggregated).forEach(([enchName, d]) => {
        let ratioText = `${d.count}${isOverall || totalExpectedWeapons > 1 ? '/' + totalExpectedWeapons : ''}`;
        buffsHtml += `<div class="av-buff av-weapon" title="${enchName} (Weapon)">
            <img src="/api/icon/${d.icon}.jpg" onerror="this.src='/api/icon/inv_misc_questionmark.jpg'">
            <span class="av-ratio">${ratioText}</span>
        </div>`;
    });

    // Compact spell/CD icons (no names)
    let spellsHtml = '';
    Object.entries(data.spells)
        .filter(([spellId]) => SPELL_DB[spellId])
        .sort(([a], [b]) => {
            const catA = SPELL_DB[a].category || 2;
            const catB = SPELL_DB[b].category || 2;
            return catA - catB;
        })
        .forEach(([spellId, sData]) => {
            let dmgText = sData.damage > 0 ? (sData.damage >= 1000 ? (sData.damage / 1000).toFixed(1) + 'k' : sData.damage) : '';
            spellsHtml += `<div class="av-spell" title="${SPELL_DB[spellId].name}">
                <img src="/api/icon/${SPELL_DB[spellId].icon}.jpg" onerror="this.src='/api/icon/inv_misc_questionmark.jpg'">
                <span class="av-count">x${Math.max(1, sData.count)}</span>
                ${dmgText ? `<span class="av-dmg">${dmgText}</span>` : ''}
            </div>`;
        });

    // Deaths & Ress (compact)
    let eventsHtml = '';
    if (data.deaths && data.deaths.length > 0) {
        if (isOverall) {
            eventsHtml += `<span class="av-event av-death">✕${data.deaths.length}</span>`;
        } else {
            data.deaths.forEach(d => {
                let relTime = fightInfo ? d - fightInfo.startTime : 0;
                eventsHtml += `<span class="av-event av-death">✕${formatDuration(Math.max(0, relTime))}</span>`;
            });
        }
    }
    if (data.rebirths && data.rebirths.length > 0) {
        if (isOverall) {
            const resByType = {};
            data.rebirths.forEach(r => {
                if (!resByType[r.type]) resByType[r.type] = { count: 0, icon: r.icon };
                resByType[r.type].count++;
            });
            Object.entries(resByType).forEach(([type, info]) => {
                eventsHtml += `<span class="av-event av-ress">${info.icon}${info.count}</span>`;
            });
        } else {
            data.rebirths.forEach(r => {
                let relTime = fightInfo ? r.timestamp - fightInfo.startTime : 0;
                eventsHtml += `<span class="av-event av-ress">${r.icon}${formatDuration(Math.max(0, relTime))}</span>`;
            });
        }
    }

    let noBuffsHtml = (!buffsHtml) ? '<span class="av-no-data">No buffs</span>' : '';
    let noSpellsHtml = (!spellsHtml) ? '<span class="av-no-data">—</span>' : '';

    return `
        <div class="all-view-player-card">
            <div class="av-player-header">
                <img src="/api/icon/${specIcon}.jpg" class="av-spec-icon" onerror="this.src='/api/icon/inv_misc_questionmark.jpg'">
                <span class="av-player-name ${className}-color">${player.name}</span>
                ${eventsHtml}
            </div>
            <div class="av-sections">
                <div class="av-section">
                    <div class="av-section-label">Consumables</div>
                    <div class="av-buff-grid">${buffsHtml || noBuffsHtml}</div>
                </div>
                <div class="av-section">
                    <div class="av-section-label">CDs</div>
                    <div class="av-spell-grid">${spellsHtml || noSpellsHtml}</div>
                </div>
            </div>
        </div>
    `;
}

function filterAllViewByClass(className) {
    window._allViewClassFilter = className;
    // Update chips
    document.querySelectorAll('.all-view-class-chip').forEach(chip => {
        chip.classList.remove('active');
    });
    if (!className) {
        document.querySelector('.all-view-class-chip:first-child').classList.add('active');
    } else {
        document.querySelector(`.all-view-class-chip.${className}-chip`).classList.add('active');
    }
    // Show/hide sections
    document.querySelectorAll('.all-view-class-section').forEach(section => {
        if (!className || section.dataset.class === className) {
            section.classList.remove('hidden-section');
        } else {
            section.classList.add('hidden-section');
        }
    });
}

async function fetchDps(logId, startTime, endTime, playerId) {
    try {
        const response = await fetch('/api/dps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logId, startTime, endTime, playerId })
        });
        const res = await response.json();
        const placeholders = document.querySelectorAll(`[id$="-${playerId}"]`);
        placeholders.forEach(placeholder => {
            if (placeholder.id.startsWith('dpsPlaceholder-')) {
                if (res.error) {
                    placeholder.textContent = "(DPS error)";
                } else if (res.isHealing) {
                    placeholder.textContent = `| ${res.dps} HPS (${(res.total / 1000).toFixed(1)}k heal)`;
                } else {
                    placeholder.textContent = `| ${res.dps} DPS (${(res.total / 1000).toFixed(1)}k dmg)`;
                }
            }
        });
    } catch (err) {
        const placeholders = document.querySelectorAll(`[id$="-${playerId}"]`);
        placeholders.forEach(placeholder => {
            if (placeholder.id.startsWith('dpsPlaceholder-')) placeholder.textContent = "";
        });
    }
}

// =============================================
// GEAR INSPECTOR (kept from original)
// =============================================

function toggleGearInline(playerName, encounterId, className, specName) {
    const container = document.getElementById('inlineGearContainer');
    if (container.style.display === 'flex') {
        container.style.display = 'none';
        return;
    }
    
    // Hide timeline if open
    const timelineContainer = document.getElementById('inlineTimelineContainer');
    if (timelineContainer) timelineContainer.style.display = 'none';

    container.style.display = 'flex';
    container.innerHTML = '<p style="color:#aaa;">Loading gear...</p>';

    const gear = (window.playerGearDB && window.playerGearDB[encounterId] && window.playerGearDB[encounterId][playerName]) ? window.playerGearDB[encounterId][playerName] : [];

    if (!gear || gear.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#aaa; padding:20px; width:100%;">No gear data available for this encounter.</p>`;
        return;
    }

    const groups = [
        { title: "Armor", slots: [0, 2, 14, 4, 8, 9, 5, 6, 7] },
        { title: "Jewelry", slots: [1, 10, 11, 12, 13] },
        { title: "Weapons", slots: [15, 16, 17] }
    ];

    let groupHtmlMap = { "Armor": "", "Jewelry": "", "Weapons": "" };
    let allGearIds = gear.filter(g => g && g.id !== 0).map(g => g.id).join(':');

    const ring1 = gear[10];
    const ring2 = gear[11];
    const isEnchanter = (
        (ring1 && ring1.id !== 0 && (ring1.permanentEnchant || ring1.enchant)) ||
        (ring2 && ring2.id !== 0 && (ring2.permanentEnchant || ring2.enchant))
    );

    for (let i = 0; i <= 18; i++) {
        let item = gear[i];

        if (item && item.id !== 0) {
            let iconUrlStr = item.icon ? item.icon.toLowerCase().replace(/\s+/g, '_').replace(/\.jpg$/i, '') : '';
            let iconUrl = iconUrlStr ? `/api/icon/${iconUrlStr}.jpg` : '/api/icon/inv_misc_questionmark.jpg';

            let wowheadParams = `item=${item.id}&pcs=${allGearIds}`;
            let gemsHtml = '';
            let gemsTableHtml = '';
            if (item.gems && item.gems.length > 0) {
                let gemIdsStr = item.gems.map(g => g.id).join(':');
                wowheadParams += `&gems=${gemIdsStr}`;

                item.gems.forEach((g, gemIdx) => {
                    let gemIconStr = g.icon ? g.icon.toLowerCase().replace(/\s+/g, '_').replace(/\.jpg$/i, '') : 'inv_misc_questionmark';
                    let isMetaGem = (i === 0 && gemIdx === 0);
                    let gemClass = isMetaGem ? 'paperdoll-gem-icon meta-gem' : 'paperdoll-gem-icon';
                    let gemTableClass = isMetaGem ? 'socket-icon meta-gem' : 'socket-icon';
                    let linkStyle = isMetaGem ? 'display:inline-block; line-height:0;' : 'display:inline-block; line-height:0; border-radius:50%;';
                    let linkTableStyle = isMetaGem ? 'display:inline-block; line-height:0; margin:0 1px;' : 'display:inline-block; line-height:0; border-radius:50%; margin:0 1px;';
                    gemsHtml += `<a href="https://www.wowhead.com/tbc/item=${g.id}" onclick="event.preventDefault();" data-wowhead="item=${g.id}&domain=tbc" data-wh-rename-link="false" data-wh-icon-size="none" style="${linkStyle}"><img class="${gemClass}" src="/api/icon/${gemIconStr}.jpg" onerror="this.style.display='none'"></a>`;
                    gemsTableHtml += `<a href="https://www.wowhead.com/tbc/item=${g.id}" onclick="event.preventDefault();" data-wowhead="item=${g.id}&domain=tbc" data-wh-rename-link="false" data-wh-icon-size="none" style="${linkTableStyle}"><img class="${gemTableClass}" src="/api/icon/${gemIconStr}.jpg" onerror="this.style.display='none'"></a>`;
                });
            }

            let permEnchant = item.permanentEnchant || item.enchant;
            let rawEnchant = permEnchant;
            let enchantHtml = '';
            let slotId = i + 1;

            function isEnchantable(sId) {
                const validSlots = [1, 3, 5, 7, 8, 9, 10, 15, 16, 17];
                return validSlots.includes(sId);
            }

            let needsEnchant = isEnchantable(slotId);

            if ((i === 10 || i === 11) && isEnchanter) {
                needsEnchant = true;
            }

            if (slotId === 17) {
                const itemName = (item.name || "").toLowerCase();
                const itemType = (item.type || "").toLowerCase();
                const itemSubType = (item.subType || "").toLowerCase();
                if (!itemName.includes("shield") && !itemType.includes("shield") && !itemType.includes("weapon") && !itemSubType.includes("shield")) {
                    needsEnchant = false;
                }
            }

            let isMissingEnchant = false;

            if (needsEnchant && (typeof permEnchant === 'undefined' || !permEnchant || permEnchant === 0)) {
                isMissingEnchant = true;
                enchantHtml = `<span style="color: #ff5252; font-weight:bold;">Slacking</span>`;
            } else if (rawEnchant && rawEnchant !== 0) {
                wowheadParams += `&ench=${rawEnchant}`;
                let color = "#ff5252";
                if (typeof OPTIMAL_ENCHANTS !== 'undefined' && OPTIMAL_ENCHANTS[specName]) {
                    const enchData = OPTIMAL_ENCHANTS[specName];
                    if (enchData.best && enchData.best.includes(rawEnchant)) {
                        color = "#4caf50";
                    } else if (enchData.alt && enchData.alt.includes(rawEnchant)) {
                        color = "#f4b400";
                    }
                }
                if (ENCHANT_DB[rawEnchant]) {
                    enchantHtml = `<span style="color: ${color};">${ENCHANT_DB[rawEnchant].name}</span>`;
                } else {
                    enchantHtml = `<a href="https://www.wowhead.com/tbc/enchant=${rawEnchant}" data-wowhead="domain=tbc" style="color: ${color}; text-decoration:none; pointer-events: none;">Enchant #${rawEnchant}</a>`;
                }
            }

            wowheadParams += `&domain=tbc`;

            let qClass = '', iconClass = '';
            if (item.quality === 4) { qClass = 'q-epic'; iconClass = 'icon-q4'; }
            else if (item.quality === 3) { qClass = 'q-rare'; iconClass = 'icon-q3'; }
            else if (item.quality === 5) { qClass = 'q-legendary'; iconClass = 'icon-q5'; }
            else if (item.quality === 2) { qClass = 'q-uncommon'; iconClass = 'icon-q2'; }

            let fallbackWowhead = iconUrlStr ? `https://wow.zamimg.com/images/wow/icons/large/${iconUrlStr}.jpg` : '/api/icon/inv_misc_questionmark.jpg';

            let rowHtml = `
                <div class="gear-table-row">
                    <div class="gear-table-icon-group">
                        <a href="https://www.wowhead.com/tbc/item=${item.id}" onclick="event.preventDefault();" data-wowhead="${wowheadParams}" data-wh-rename-link="false" data-wh-icon-size="none" style="display:block; text-decoration:none;">
                            <img class="gear-table-icon ${iconClass}" src="${iconUrl}" onerror="this.src='${fallbackWowhead}'; this.onerror=function(){this.src='/api/icon/inv_misc_questionmark.jpg'};">
                        </a>
                    </div>
                    <div class="gear-table-details">
                        <span class="gear-table-name ${qClass}" style="background-image:none !important; padding-left:0 !important;">
                            <a href="https://www.wowhead.com/tbc/item=${item.id}" onclick="event.preventDefault();" data-wowhead="domain=tbc" data-wh-rename-link="true" class="item-name-no-tooltip">...</a>
                        </span>
                        ${enchantHtml ? `<div class="gear-table-enchants">${enchantHtml}</div>` : ''}
                    </div>
                </div>`;

            groups.forEach(group => {
                if (group.slots.includes(i)) groupHtmlMap[group.title] += rowHtml;
            });

        }
    }

    tableHtml = `
        <div class="gear-column" style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
            <div class="table-section-title">Armor</div>
            ${groupHtmlMap["Armor"]}
        </div>
        <div class="gear-column" style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
            <div class="table-section-title">Jewelry</div>
            ${groupHtmlMap["Jewelry"]}
        </div>
        <div class="gear-column" style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
            <div class="table-section-title">Weapons</div>
            ${groupHtmlMap["Weapons"]}
        </div>
    `;

    const contentHtmlStr = `
        <div class="gear-modal-content" style="display:flex; width:100%; gap:15px; padding-top: 10px;">
            ${tableHtml}
        </div>
    `;

    container.innerHTML = contentHtmlStr;

    if (typeof $WowheadPower !== 'undefined') {
        $WowheadPower.refreshLinks();
    }
}

// === TIMELINE INLINE ===
function toggleTimelineInline(playerName, fightId) {
    const container = document.getElementById('inlineTimelineContainer');
    if (container.style.display === 'block') {
        container.style.display = 'none';
        return;
    }
    
    // Hide gear if open
    const gearContainer = document.getElementById('inlineGearContainer');
    if (gearContainer) gearContainer.style.display = 'none';

    if (!window.timelineDB || !window.timelineDB[fightId] || !window.timelineDB[fightId][playerName]) {
        container.innerHTML = '<div class="timeline-empty">No timeline data available.</div>';
        container.style.display = 'block';
        return;
    }

    const events = window.timelineDB[fightId][playerName];
    const fightInfo = window.currentReport.fights.find(f => f.id == fightId || f.id == parseInt(fightId));
    if (!fightInfo) return;
    
    const durationMs = fightInfo.endTime - fightInfo.startTime;
    let html = `<div class="timeline-wrapper"><div class="timeline-title">FIGHT TIMELINE</div><div class="timeline-content">`;
    
    const usedSpells = Object.keys(events).filter(sId => events[sId].length > 0);
    
    if (usedSpells.length === 0) {
        html += '<div class="timeline-empty">No tracked cooldowns or procs used.</div>';
    } else {
        usedSpells.forEach(spellId => {
            let spellInfo = TIMELINE_SPELLS[spellId];
            if (!spellInfo) return;
            spellInfo = { ...spellInfo };

            if (spellId == 33370) {
                let hasScarab = false;
                if (fightId === 'overall') {
                    if (window.playerGearDB) {
                        for (let fId in window.playerGearDB) {
                            if (window.playerGearDB[fId][playerName] && window.playerGearDB[fId][playerName].some(g => g && g.id === 28190)) {
                                hasScarab = true;
                                break;
                            }
                        }
                    }
                } else {
                    const gear = (window.playerGearDB && window.playerGearDB[fightId] && window.playerGearDB[fightId][playerName]) ? window.playerGearDB[fightId][playerName] : [];
                    hasScarab = gear.some(g => g && g.id === 28190);
                }

                if (hasScarab) {
                    spellInfo.name = "Fate's Decree (Scarab)";
                    spellInfo.icon = "inv_misc_orb_03";
                }
            }

            const color = spellInfo.color || '#f4b400';
            html += `
            <div class="timeline-row-container">
                <div class="timeline-spell-name" style="color: ${color};">${spellInfo.name}</div>
                <div class="timeline-track">`;
                
            events[spellId].forEach(ev => {
                let relStart = ev.start - fightInfo.startTime;
                let relEnd = ev.end - fightInfo.startTime;
                relStart = Math.max(0, relStart);
                relEnd = Math.min(durationMs, relEnd);
                
                if (relEnd > relStart) {
                    const leftPct = (relStart / durationMs) * 100;
                    const widthPct = ((relEnd - relStart) / durationMs) * 100;
                    html += `<div class="timeline-bar" style="left: ${leftPct}%; width: ${widthPct}%; background-color: ${color}; opacity: 0.7; box-shadow: 0 0 8px ${color}; border: 1px solid ${color};"></div>`;
                }
            });
            html += `</div></div>`;
        });
        
        // Draw the time axis
        html += `<div class="timeline-axis">
            <span>0:00</span>
            <span>${formatDuration(durationMs/4)}</span>
            <span>${formatDuration(durationMs/2)}</span>
            <span>${formatDuration(durationMs * 0.75)}</span>
            <span>${formatDuration(durationMs)}</span>
        </div>`;
    }
    
    html += `</div></div>`;
    container.innerHTML = html;
    container.style.display = 'block';
}

function closeGearModal() {
    document.getElementById('gearOverlay').classList.remove('is-open');
}

// =============================================
// DISCORD WEBHOOK SYSTEM (kept from original)
// =============================================

let _editingWebhookId = null;

function getWebhookProfiles() {
    try { return JSON.parse(localStorage.getItem('discord_webhooks') || '[]'); }
    catch { return []; }
}

function saveWebhookProfiles(profiles) {
    localStorage.setItem('discord_webhooks', JSON.stringify(profiles));
}

function renderWebhookProfiles() {
    const list = document.getElementById('webhookProfilesList');
    if (!list) return;
    const profiles = getWebhookProfiles();
    if (profiles.length === 0) { list.innerHTML = ''; return; }

    list.innerHTML = profiles.map(p => `
        <div class="webhook-profile-card">
            <div class="webhook-profile-info">
                <div class="webhook-profile-name">💬 ${escapeHtml(p.name)}</div>
                <div class="webhook-profile-url">${escapeHtml(p.url)}</div>
            </div>
            <div class="webhook-profile-actions">
                <button class="webhook-btn-send" onclick="sendToWebhookProfile('${p.id}')">▶ Send</button>
                <button class="webhook-btn-edit" onclick="editWebhookProfile('${p.id}')">✏</button>
                <button class="webhook-btn-delete" onclick="deleteWebhookProfile('${p.id}')">🗑</button>
            </div>
        </div>
    `).join('');
}

function showWebhookForm(editId = null) {
    _editingWebhookId = editId;
    const form = document.getElementById('webhookForm');
    const section = document.querySelector('.webhook-profiles-section');
    const formTitle = document.getElementById('webhookFormTitle');
    const nameInput = document.getElementById('webhookNameInput');
    const urlInput = document.getElementById('discordWebhookInput');

    if (editId) {
        const profiles = getWebhookProfiles();
        const p = profiles.find(x => x.id === editId);
        if (p) { nameInput.value = p.name; urlInput.value = p.url; }
        formTitle.textContent = '✏️ Edit Profile';
    } else {
        nameInput.value = ''; urlInput.value = '';
        formTitle.textContent = '➕ New Profile';
    }
    section.style.display = 'none';
    form.style.display = 'flex';
    nameInput.focus();
}

function hideWebhookForm() {
    _editingWebhookId = null;
    document.getElementById('webhookForm').style.display = 'none';
    document.querySelector('.webhook-profiles-section').style.display = 'flex';
}

function saveWebhookProfile() {
    const name = document.getElementById('webhookNameInput').value.trim();
    const url = document.getElementById('discordWebhookInput').value.trim();

    if (!name) {
        document.getElementById('webhookNameInput').focus();
        document.getElementById('webhookNameInput').style.borderColor = '#ff5252';
        setTimeout(() => document.getElementById('webhookNameInput').style.borderColor = '', 2000);
        return;
    }
    if (!url || !url.includes('discord.com/api/webhooks/')) {
        document.getElementById('discordWebhookInput').focus();
        document.getElementById('discordWebhookInput').style.borderColor = '#ff5252';
        setTimeout(() => document.getElementById('discordWebhookInput').style.borderColor = '', 2000);
        return;
    }

    const profiles = getWebhookProfiles();
    if (_editingWebhookId) {
        const idx = profiles.findIndex(x => x.id === _editingWebhookId);
        if (idx !== -1) { profiles[idx].name = name; profiles[idx].url = url; }
    } else {
        profiles.push({ id: Date.now().toString(), name, url });
    }
    saveWebhookProfiles(profiles);
    hideWebhookForm();
    renderWebhookProfiles();
}

function editWebhookProfile(id) { showWebhookForm(id); }

function deleteWebhookProfile(id) {
    const profiles = getWebhookProfiles().filter(x => x.id !== id);
    saveWebhookProfiles(profiles);
    renderWebhookProfiles();
}

async function sendToWebhookProfile(id) {
    const profiles = getWebhookProfiles();
    const p = profiles.find(x => x.id === id);
    if (!p) return;

    const btn = document.querySelector(`.webhook-profile-card .webhook-btn-send[onclick*="${id}"]`);
    if (btn) { btn.textContent = '⏳ Sending...'; btn.disabled = true; }

    const logId = window.currentLogId;
    const reportUrl = `${window.location.origin}/report/${logId}`;
    const msg = {
        embeds: [{
            title: "🦆 TBC Duck Analyzer - Log Audit",
            description: `${window.currentLogTitle || logId}\n\n📊 [**View Full Audit**](${reportUrl})\n📜 [**Original WCL Report**](https://www.warcraftlogs.com/reports/${logId})`,
            color: 16035840
        }]
    };

    try {
        const resp = await fetch(p.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(msg) });
        if (resp.ok || resp.status === 204) {
            if (btn) { btn.textContent = '✅ Sent!'; setTimeout(() => { btn.textContent = '▶ Send'; btn.disabled = false; }, 2000); }
        } else { throw new Error(`HTTP ${resp.status}`); }
    } catch (e) {
        if (btn) { btn.textContent = '❌ Error'; setTimeout(() => { btn.textContent = '▶ Send'; btn.disabled = false; }, 2500); }
    }
}

function enviarADiscord() {
    document.getElementById('discordOverlay').classList.add('is-open');
    hideWebhookForm();
    renderWebhookProfiles();
}

function closeDiscordModal() {
    document.getElementById('discordOverlay').classList.remove('is-open');
    hideWebhookForm();
}

// =============================================
// INITIALIZATION
// =============================================

window.onload = () => {
    let potentialLogId = null;

    // Check URL params
    const urlParams = new URLSearchParams(window.location.search);
    potentialLogId = urlParams.get('log');

    // Check /report/:logId path
    if (window.location.pathname.startsWith('/report/')) {
        potentialLogId = window.location.pathname.split('/report/')[1];
    }

    if (potentialLogId) {
        document.getElementById('logInput').value = potentialLogId;
        auditarLog();
    }

    // Enter key on input
    document.getElementById('logInput').addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            auditarLog();
        }
    });

    // Escape key closes modals
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            document.getElementById('gearOverlay').classList.remove('is-open');
            document.getElementById('discordOverlay').classList.remove('is-open');
        }
    });
};
