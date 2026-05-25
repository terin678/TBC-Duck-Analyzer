import { state } from '../state.js?v=1.2.7';
import { formatDuration } from '../utils.js?v=1.2.7';
import { processPlayerData } from '../processor.js?v=1.2.7';
import { fetchDps } from '../api.js?v=1.2.7';

export function renderMainContent() {
    const contentArea = document.getElementById('contentArea');

    if (!state.selectedFightId || !state.selectedPlayerName) {
        let msg = 'Select a fight and a player to view the analysis';
        if (state.selectedFightId && !state.selectedPlayerName) {
            msg = 'Now select a player to view the analysis';
        } else if (!state.selectedFightId && state.selectedPlayerName) {
            msg = 'Now select a fight to view the analysis';
        }
        contentArea.innerHTML = `<div class="content-placeholder"><div class="placeholder-icon">🦆</div><p>${msg}</p></div>`;
        return;
    }

    const fightId = state.selectedFightId;
    const playerName = state.selectedPlayerName;
    const report = state.currentReport;
    const allEvents = state.currentEvents;
    const allActors = state.currentActors;

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
        const combatantInfosMap = {};
        const regularEvents = [];
        
        allEvents.forEach(ev => {
            if (ev.type === 'combatantinfo') {
                if (ev.timestamp <= fightInfo.startTime + 15000 && ev.timestamp >= fightInfo.startTime - 180000) {
                    combatantInfosMap[ev.sourceID] = ev;
                }
            } else if (ev.timestamp >= (fightInfo.startTime - 15000) && ev.timestamp <= (fightInfo.endTime + 5000)) {
                regularEvents.push(ev);
            }
        });
        
        fightEvents = [...Object.values(combatantInfosMap), ...regularEvents].sort((a, b) => a.timestamp - b.timestamp);
    }

    // "All" view — raid summary
    if (playerName === '__ALL__') {
        contentArea.innerHTML = renderAllPlayersView(fightId, fightEvents, allActors, fightInfo);
        // Refresh Wowhead tooltips
        if (typeof window.$WowheadPower !== 'undefined') {
            window.$WowheadPower.refreshLinks();
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
        fetchDps(state.currentLogId, [fightInfo.id], player.id);
    } else {
        const fights = report.fights;
        if (fights && fights.length > 0) {
            fetchDps(state.currentLogId, fights.map(f => f.id), player.id);
        }
    }

    // Refresh Wowhead tooltips
    if (typeof window.$WowheadPower !== 'undefined') {
        window.$WowheadPower.refreshLinks();
    }
}

export function renderPlayerView(data, player, fightInfo) {
    const spec = data.spec;
    const specIcon = window.SPEC_ICONS[spec] || window.SPEC_ICONS[player.subType] || 'inv_misc_questionmark';
    const className = player.subType;
    const fightId = state.selectedFightId;
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

    const usedBuffs = Object.keys(window.BUFF_DB).filter(id =>
        window.BUFF_DB[id].category !== 3 && window.BUFF_DB[id].category !== 'seal' && (data.combatantInfos.some(auras => auras.includes(parseInt(id))) || data.itemCasts[id])
    ).sort((a, b) => (window.BUFF_DB[a].order ?? 99) - (window.BUFF_DB[b].order ?? 99));
    
    usedBuffs.forEach(id => {
        const isConsumableCast = window.BUFF_DB[id].category === 5 || window.BUFF_DB[id].order === 70;
        let ratioDisplay = '';
        const ciCount = data.combatantInfos.filter(auras => auras.includes(parseInt(id))).length;

        if (isConsumableCast) {
            let casts = data.itemCasts[id] || 0;
            let pre = data.prePots[id] || 0;
            let totalUses = casts + pre;
            if (totalUses === 0) return;
            ratioDisplay = `<span class="buff-ratio">x${totalUses}</span>`;
        } else {
            ratioDisplay = `<span class="buff-ratio">${ciCount}${isOverall && totalFights > 1 ? `/${totalFights}` : ''}</span>`;
        }

        standardBuffHtmls.push(`<div class="buff-item"><img class="buff-icon" src="/api/icon/${window.BUFF_DB[id].icon}.jpg" onerror="this.src='/api/icon/inv_misc_questionmark.jpg'"><span class="buff-name">${window.BUFF_DB[id].name}</span>${ratioDisplay}</div>`);
    });

    // Weapon enchant buffs
    const weaponBuffsAggregated = {};
    let totalExpectedWeapons = 0;
    data.tempEnchants.forEach(info => {
        totalExpectedWeapons += info.weapons;
        info.enchants.forEach(eId => {
            if (window.ENCHANT_DB && window.ENCHANT_DB[eId]) {
                let enchName = window.ENCHANT_DB[eId].name;
                if (!weaponBuffsAggregated[enchName]) weaponBuffsAggregated[enchName] = { count: 0, icon: window.ENCHANT_DB[eId].icon || 'inv_misc_questionmark' };
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
    const groupedSpells = {};
    Object.entries(data.spells)
        .filter(([spellId]) => window.SPELL_DB && window.SPELL_DB[spellId])
        .forEach(([spellId, sData]) => {
            const sInfo = window.SPELL_DB[spellId];
            const name = sInfo.name;
            if (!groupedSpells[name]) {
                groupedSpells[name] = {
                    name: name,
                    icon: sInfo.icon,
                    category: sInfo.category || 2,
                    count: 0,
                    damage: 0,
                    spellId: spellId
                };
            }
            groupedSpells[name].count += sData.count;
            groupedSpells[name].damage += sData.damage;
        });

    let spellListHtml = Object.values(groupedSpells)
        .sort((a, b) => a.category - b.category)
        .map(spell => {
            let dmgText = spell.damage > 0 ? (spell.damage >= 1000 ? (spell.damage / 1000).toFixed(1) + 'k' : spell.damage) : '';
            return `<div class="spell-item">
                <img class="spell-icon" src="/api/icon/${spell.icon}.jpg" onerror="this.src='/api/icon/inv_misc_questionmark.jpg'">
                <span class="spell-name">${spell.name}</span>
                <span class="spell-count">x${Math.max(1, spell.count)}</span>
                ${spell.damage > 0 ? `<span class="spell-damage">${dmgText}</span>` : ''}
            </div>`;
        }).join('');

    // === GEAR BUTTON ===
    const safeName = player.name.replace(/'/g, "\\'");
    let gearBtnHtml = `<button class="inspect-btn" onclick="window.toggleGearInline('${safeName}', '${fightId}', '${className}', '${spec}')">🔍 Inspect Gear</button>`;

    // === TIMELINE BUTTON ===
    if (!state.timelineDB[fightId]) state.timelineDB[fightId] = {};
    state.timelineDB[fightId][player.name] = data.timelineEvents;

    let timelineBtnHtml = '';
    if (!isOverall) {
        timelineBtnHtml = `<button class="inspect-btn timeline-btn" onclick="window.toggleTimelineInline('${safeName}', '${fightId}')">⏱️ Timeline</button>`;
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
    let bossSlug = (fightInfo && fightInfo.name) ? fightInfo.name.replace(/'/g, '').replace(/[\s,-]+/g, '-').toLowerCase() : '';
    let bossIconHtml = isOverall ? '' : `<img src="/assets/bosses/ui-ej-boss-${bossSlug}.png" style="height: 40px; vertical-align: middle; margin-right: 12px; border-radius: 6px;" onerror="this.style.display='none'">`;

    return `
        <div class="player-view">
            <div class="player-view-header">
                <div style="position: absolute; left: -85px; top: 16px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: #ddd; font-size: 1rem; font-weight: bold; padding: 6px 12px; background: rgba(255,255,255,0.08); border-radius: 6px; user-select: none; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'" onclick="if(window.selectPlayer) window.selectPlayer('__ALL__')" title="Back to All Players">
                    <span style="margin-right: 6px; font-size: 1.2rem; line-height: 1;">&#8592;</span> All
                </div>
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

export function renderAllPlayersView(fightId, fightEvents, allActors, fightInfo) {
    const isOverall = (fightId === 'overall');

    // Fight title
    let fightTitle = 'Overall';
    if (fightInfo) {
        const duration = fightInfo.endTime - fightInfo.startTime;
        fightTitle = `${fightInfo.name} — ${formatDuration(duration)}`;
    }
    let bossSlug = (fightInfo && fightInfo.name) ? fightInfo.name.replace(/'/g, '').replace(/[\s,-]+/g, '-').toLowerCase() : '';
    let bossIconHtml = isOverall ? '' : `<img src="/assets/bosses/ui-ej-boss-${bossSlug}.png" style="height: 40px; vertical-align: middle; margin-right: 12px; border-radius: 6px;" onerror="this.style.display='none'">`;

    // Calculate global max fights for the overall denominator
    let globalMaxFights = 1;
    if (isOverall) {
        const ciCounts = {};
        fightEvents.forEach(ev => {
            if (ev.type === 'combatantinfo') {
                ciCounts[ev.sourceID] = (ciCounts[ev.sourceID] || 0) + 1;
            }
        });
        const counts = Object.values(ciCounts);
        if (counts.length > 0) {
            globalMaxFights = Math.max(...counts);
        }
    }

    // Group players by class
    const playersByClass = {};
    window.CLASSES.forEach(cls => { playersByClass[cls] = []; });
    const sorted = [...allActors].sort((a, b) => {
        const ci = window.CLASSES.indexOf(a.subType) - window.CLASSES.indexOf(b.subType);
        if (ci !== 0) return ci;
        const specA = state.detectedSpecs[a.name] || a.subType;
        const specB = state.detectedSpecs[b.name] || b.subType;
        const si = specA.localeCompare(specB);
        if (si !== 0) return si;
        return a.name.localeCompare(b.name);
    });
    sorted.forEach(player => {
        if (playersByClass[player.subType]) {
            playersByClass[player.subType].push(player);
        }
    });

    // Class filter chips
    const activeFilter = state.allViewClassFilter;
    let filterHtml = `<div class="all-view-class-filter">`;
    filterHtml += `<button class="all-view-class-chip ${!activeFilter ? 'active' : ''}" onclick="window.filterAllViewByClass(null)">All</button>`;
    window.CLASSES.forEach(cls => {
        if (playersByClass[cls].length === 0) return;
        const isActive = activeFilter === cls;
        filterHtml += `<button class="all-view-class-chip ${cls}-chip ${isActive ? 'active' : ''}" onclick="window.filterAllViewByClass('${cls}')">${cls} <span class="chip-count">${playersByClass[cls].length}</span></button>`;
    });
    filterHtml += `</div>`;

    // Render each class section
    let sectionsHtml = '';
    window.CLASSES.forEach(cls => {
        const players = playersByClass[cls];
        if (players.length === 0) return;
        const isHidden = activeFilter && activeFilter !== cls;

        const classIcon = window.SPEC_ICONS[cls] || 'inv_misc_questionmark';
        sectionsHtml += `<div class="all-view-class-section ${isHidden ? 'hidden-section' : ''}" data-class="${cls}">`;
        sectionsHtml += `<div class="all-view-class-header">
            <img src="/api/icon/${classIcon}.jpg" class="all-view-class-icon" onerror="this.src='/api/icon/inv_misc_questionmark.jpg'">
            <span class="${cls}-color">${cls}</span>
            <span class="all-view-class-count">${players.length}</span>
        </div>`;

        sectionsHtml += `<div class="all-view-players-grid">`;
        players.forEach(player => {
            const playerData = processPlayerData(fightId, fightEvents, player);
            sectionsHtml += renderAllPlayerCard(playerData, player, fightInfo, isOverall, globalMaxFights);
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

function renderAllPlayerCard(data, player, fightInfo, isOverall, globalMaxFights = 1) {
    const spec = data.spec;
    const specIcon = window.SPEC_ICONS[spec] || window.SPEC_ICONS[player.subType] || 'inv_misc_questionmark';
    const className = player.subType;
    const fightId = state.selectedFightId;
    const totalFights = isOverall ? globalMaxFights : Math.max(1, data.combatantInfos.length);

    // Compact buff icons (no names)
    const usedBuffs = Object.keys(window.BUFF_DB).filter(id =>
        window.BUFF_DB[id].category !== 3 && window.BUFF_DB[id].category !== 'seal' && (data.combatantInfos.some(auras => auras.includes(parseInt(id))) || data.itemCasts[id])
    ).sort((a, b) => (window.BUFF_DB[a].order ?? 99) - (window.BUFF_DB[b].order ?? 99));
    let buffsHtml = '';
    usedBuffs.forEach(id => {
        const isConsumableCast = window.BUFF_DB[id].category === 5 || window.BUFF_DB[id].order === 70;
        let ratioText = '';
        const ciCount = data.combatantInfos.filter(auras => auras.includes(parseInt(id))).length;

        if (isConsumableCast) {
            let casts = data.itemCasts[id] || 0;
            let pre = data.prePots[id] || 0;
            let totalUses = casts + pre;
            if (totalUses === 0) return;
            ratioText = `x${totalUses}`;
        } else {
            ratioText = `${ciCount}${isOverall && totalFights > 1 ? '/' + totalFights : ''}`;
        }

        buffsHtml += `<div class="av-buff" title="${window.BUFF_DB[id].name}">
            <img src="/api/icon/${window.BUFF_DB[id].icon}.jpg" onerror="this.src='/api/icon/inv_misc_questionmark.jpg'">
            <span class="av-ratio">${ratioText}</span>
        </div>`;
    });

    // Weapon enchant buffs (compact)
    const weaponBuffsAggregated = {};
    let totalExpectedWeapons = 0;
    data.tempEnchants.forEach(info => {
        totalExpectedWeapons += info.weapons;
        info.enchants.forEach(eId => {
            if (window.ENCHANT_DB && window.ENCHANT_DB[eId]) {
                let enchName = window.ENCHANT_DB[eId].name;
                if (!weaponBuffsAggregated[enchName]) weaponBuffsAggregated[enchName] = { count: 0, icon: window.ENCHANT_DB[eId].icon || 'inv_misc_questionmark' };
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
    const groupedSpellsAll = {};
    Object.entries(data.spells)
        .filter(([spellId]) => window.SPELL_DB && window.SPELL_DB[spellId])
        .forEach(([spellId, sData]) => {
            const sInfo = window.SPELL_DB[spellId];
            const name = sInfo.name;
            if (!groupedSpellsAll[name]) {
                groupedSpellsAll[name] = {
                    name: name,
                    icon: sInfo.icon,
                    category: sInfo.category || 2,
                    count: 0,
                    damage: 0,
                    spellId: spellId
                };
            }
            groupedSpellsAll[name].count += sData.count;
            groupedSpellsAll[name].damage += sData.damage;
        });

    Object.values(groupedSpellsAll)
        .sort((a, b) => a.category - b.category)
        .forEach(spell => {
            let dmgText = spell.damage > 0 ? (spell.damage >= 1000 ? (spell.damage / 1000).toFixed(1) + 'k' : spell.damage) : '';
            spellsHtml += `<div class="av-spell" title="${spell.name}">
                <img src="/api/icon/${spell.icon}.jpg" onerror="this.src='/api/icon/inv_misc_questionmark.jpg'">
                <span class="av-count">x${Math.max(1, spell.count)}</span>
                ${dmgText ? `<span class="av-dmg">${dmgText}</span>` : ''}
            </div>`;
        });

    // Deaths & Ress (compact)
    let eventsHtml = '';
    if (isOverall) {
        if (data.deaths && data.deaths.length > 0) {
            eventsHtml += `<span class="av-event av-death">✕${data.deaths.length}</span>`;
        }
        if (data.rebirths && data.rebirths.length > 0) {
            const resByType = {};
            data.rebirths.forEach(r => {
                if (!resByType[r.type]) resByType[r.type] = { count: 0, icon: r.icon };
                resByType[r.type].count++;
            });
            Object.entries(resByType).forEach(([type, info]) => {
                eventsHtml += `<span class="av-event av-ress">${info.icon}${info.count}</span>`;
            });
        }
    } else {
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
                eventsHtml += `<span class="av-event av-death">✕${formatDuration(Math.max(0, relTime))}</span>`;
            } else {
                eventsHtml += `<span class="av-event av-ress">${ev.icon}${formatDuration(Math.max(0, relTime))}</span>`;
            }
        });
    }

    let noBuffsHtml = (!buffsHtml) ? '<span class="av-no-data">No buffs</span>' : '';
    let noSpellsHtml = (!spellsHtml) ? '<span class="av-no-data">—</span>' : '';

    return `
        <div class="all-view-player-card">
            <div class="av-player-header">
                <img src="/api/icon/${specIcon}.jpg" class="av-spec-icon" onerror="this.src='/api/icon/inv_misc_questionmark.jpg'">
                <span class="av-player-name ${className}-color" style="cursor: pointer;" onclick="if(window.selectPlayer) window.selectPlayer('${player.name}')" title="Click to view details for ${player.name}">${player.name}</span>
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

export function filterAllViewByClass(className) {
    state.allViewClassFilter = className;
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
