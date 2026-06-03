import { state } from '../state.js?v=1.3.6';
import { formatDuration, escapeHtml } from '../utils.js?v=1.3.6';

// =============================================
// GEAR INSPECTOR 
// =============================================

export function toggleGearInline(playerName, encounterId, className, specName) {
    const container = document.getElementById('inlineGearContainer');
    if (container.style.display === 'flex') {
        container.style.display = 'none';
        state.openPanels.gear = false;
        return;
    }
    
    // Hide timeline if open (gear is exclusive with timeline)
    const timelineContainer = document.getElementById('inlineTimelineContainer');
    if (timelineContainer) timelineContainer.style.display = 'none';
    // Note: Casts/Debuff panel stays open — both Gear and Casts/Debuff can be open at the same time

    container.style.display = 'flex';
    state.openPanels.gear = true;
    container.innerHTML = '<p style="color:#aaa;">Loading gear...</p>';

    const gear = (state.playerGearDB && state.playerGearDB[encounterId] && state.playerGearDB[encounterId][playerName]) ? state.playerGearDB[encounterId][playerName] : [];

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
                if (typeof window.OPTIMAL_ENCHANTS !== 'undefined' && window.OPTIMAL_ENCHANTS[specName]) {
                    const enchData = window.OPTIMAL_ENCHANTS[specName];
                    if (enchData.best && enchData.best.includes(rawEnchant)) {
                        color = "#4caf50";
                    } else if (enchData.alt && enchData.alt.includes(rawEnchant)) {
                        color = "#f4b400";
                    }
                }
                if (window.ENCHANT_DB && window.ENCHANT_DB[rawEnchant]) {
                    enchantHtml = `<span style="color: ${color};">${window.ENCHANT_DB[rawEnchant].name}</span>`;
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

    let tableHtml = `
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

    if (typeof window.$WowheadPower !== 'undefined') {
        window.$WowheadPower.refreshLinks();
    }
}

export function closeGearModal() {
    document.getElementById('gearOverlay').classList.remove('is-open');
}

// === CASTS / DEBUFF INLINE ===
export function toggleCastsDebuffInline(playerName, fightId) {
    const container = document.getElementById('inlineCastsContainer');
    if (container.style.display === 'block') {
        container.style.display = 'none';
        state.openPanels.casts = false;
        return;
    }

    // Note: timeline stays open — both casts and timeline can be open at the same time
    // Note: gear inspector stays open — both casts/debuff and gear can be open at the same time

    // Retrieve data stored by mainContent
    const castData = (state.castsDebuffDB && state.castsDebuffDB[fightId] && state.castsDebuffDB[fightId][playerName])
        ? state.castsDebuffDB[fightId][playerName]
        : null;

    if (!castData || (Object.keys(castData.castCounts).length === 0 && Object.keys(castData.debuffTimeline).length === 0)) {
        container.innerHTML = '<div class="cd-empty">No cast/debuff data available for this spec.</div>';
        container.style.display = 'block';
        state.openPanels.casts = true;
        return;
    }

    const isOverall = (fightId === 'overall' || fightId == null);
    const fightInfo = (!isOverall && state.currentReport && state.currentReport.fights)
        ? state.currentReport.fights.find(f => f.id == fightId || f.id == parseInt(fightId))
        : null;
    const durationMs = fightInfo ? (fightInfo.endTime - fightInfo.startTime) : 0;

    let html = '<div class="cd-wrapper">';

    // ── Section 1: Cast Counts (always shown) ────────────────────────────────
    const castEntries = Object.entries(castData.castCounts);
    if (castEntries.length > 0) {
        html += '<div class="cd-section">';
        html += `<div class="cd-section-title">⚔️ Cast Counts${isOverall ? ' <span class="cd-overall-label">(Overall)</span>' : ''}</div>`;
        html += '<div class="cd-spells-list">';
        // Sort by count descending
        castEntries.sort((a, b) => b[1].count - a[1].count).forEach(([name, data]) => {
            const lowRank = data.lowRankCount && data.lowRankCount > 0;
            const lowRankBadge = lowRank
                ? `<span class="cd-lowrank-badge" title="⚠️ ${data.lowRankCount} cast${data.lowRankCount > 1 ? 's' : ''} were sub-optimal rank!">⚠️ ${data.lowRankCount}x low rank</span>`
                : '';
            html += `
                <div class="spell-item${lowRank ? ' cd-cast-warn' : ''}">
                    <img class="spell-icon" src="/api/icon/${data.icon}.jpg" onerror="this.src='/api/icon/inv_misc_questionmark.jpg'" title="${name}">
                    <span class="spell-name">${name}</span>
                    <span class="spell-count">×${data.count}</span>
                    ${lowRankBadge}
                </div>`;
        });

        html += '</div></div>';
    }


    // ── Section 2: Debuff Timeline (per-fight only) ──────────────────────────
    const debuffEntries = Object.entries(castData.debuffTimeline);

    if (isOverall) {
        if (debuffEntries.length > 0 && state.currentReport && state.currentReport.fights) {
            const allFights = state.currentReport.fights;
            const totalCombatMs = allFights.reduce((sum, f) => sum + (f.endTime - f.startTime), 0);

            if (totalCombatMs > 0) {
                // Filter out point-only debuffs and those explicitly hidden from overall
                const durationDebuffs = debuffEntries.filter(([, dl]) => !dl.isCastPoint && !dl.hideFromOverall);

                if (durationDebuffs.length > 0) {
                    // Pre-calculate uptimes to avoid rendering empty sections
                    const validRows = [];
                    durationDebuffs
                        .sort((a, b) => {
                            const aOrder = a[1].sortOrder != null ? a[1].sortOrder : 999;
                            const bOrder = b[1].sortOrder != null ? b[1].sortOrder : 999;
                            return aOrder - bOrder;
                        })
                        .forEach(([debuffName, dlData]) => {
                            let allSegs = [];
                            Object.values(dlData.targets).forEach(segs => {
                                allSegs = allSegs.concat(segs);
                            });
                            if (allSegs.length === 0) return;

                            allSegs.sort((a, b) => a.start - b.start);
                            const merged = [];
                            for (const seg of allSegs) {
                                if (!merged.length || seg.start > merged[merged.length - 1].end) {
                                    merged.push({ start: seg.start, end: seg.end });
                                } else {
                                    merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, seg.end);
                                }
                            }

                            let coveredMs = 0;
                            merged.forEach(seg => {
                                allFights.forEach(fight => {
                                    const start = Math.max(seg.start, fight.startTime);
                                    const end   = Math.min(seg.end,   fight.endTime);
                                    if (end > start) coveredMs += (end - start);
                                });
                            });

                            const uptime = Math.min(100, Math.round((coveredMs / totalCombatMs) * 100));
                            if (uptime > 0) {
                                validRows.push({ debuffName, dlData, uptime });
                            }
                        });

                    if (validRows.length > 0) {
                        html += '<div class="cd-section">';
                        html += '<div class="cd-section-title">🩸 Uptime <span class="cd-overall-label">(Overall — all fights)</span></div>';
                        html += '<div class="cd-overall-uptime-list">';

                        validRows.forEach(({ debuffName, dlData, uptime }) => {
                            const color = dlData.color || '#f4b400';
                            html += `
                            <div class="cd-overall-uptime-row">
                                <div class="cd-overall-uptime-left">
                                    <img class="cd-debuff-icon" src="/api/icon/${dlData.icon}.jpg" onerror="this.src='/api/icon/inv_misc_questionmark.jpg'" title="${debuffName}">
                                    <span class="cd-debuff-name" style="color:${color};">${debuffName}</span>
                                </div>
                                <div class="cd-overall-uptime-bar-wrap">
                                    <div class="cd-overall-uptime-track">
                                        <div class="cd-overall-uptime-fill" style="width:${uptime}%; background:${color}; box-shadow: 0 0 6px ${color}40;"></div>
                                    </div>
                                    <span class="cd-overall-uptime-pct" style="color:${color};">${uptime}%</span>
                                </div>
                            </div>`;
                        });

                        html += '</div></div>';
                    }
                }
            }
        }
    } else {
        const validDebuffs = debuffEntries.filter(([, dlData]) => {
            return Object.entries(dlData.targets).some(([, segs]) => segs.length > 0);
        });

        if (validDebuffs.length > 0 && durationMs > 0) {
            html += '<div class="cd-section">';
            html += '<div class="cd-section-title">🩸 Uptime</div>';
            html += '<div class="cd-debuff-block">';

            validDebuffs
                .sort((a, b) => {
                    // alwaysOnTop entries come first, sorted by sortOrder (lower = higher position)
                    const aTop = a[1].alwaysOnTop ? 0 : 1;
                    const bTop = b[1].alwaysOnTop ? 0 : 1;
                    if (aTop !== bTop) return aTop - bTop;
                    // Within the same tier, sort by sortOrder
                    const aOrder = a[1].sortOrder != null ? a[1].sortOrder : 999;
                    const bOrder = b[1].sortOrder != null ? b[1].sortOrder : 999;
                    return aOrder - bOrder;
                })
                .forEach(([debuffName, dlData]) => {
            const color = dlData.color || '#f4b400';
            const isPoint = dlData.isCastPoint;
            // Only show targets with at least one segment
            const targets = Object.entries(dlData.targets).filter(([, segs]) => segs.length > 0);
            if (targets.length === 0) return;

            // For cast-point entries: show total cast count instead of uptime %
            let headerLabel = '';
            if (isPoint) {
                const totalCasts = targets.reduce((sum, [, segs]) => sum + segs.length, 0);
                headerLabel = `${totalCasts}×`;
            } else {
                // Compute per-target uptime and pick the one with most coverage for the header %
                let bestUptime = 0;
                targets.forEach(([tName, segs]) => {
                    let covered = 0;
                    segs.forEach(s => {
                        const relS = Math.max(0, s.start - fightInfo.startTime);
                        const relE = Math.min(durationMs, s.end - fightInfo.startTime);
                        if (relE > relS) covered += (relE - relS);
                    });
                    
                    let targetDur = durationMs;
                    if (castData.targetLifespans && castData.targetLifespans[tName]) {
                        const tLife = castData.targetLifespans[tName];
                        let aliveMs = 0;
                        let lastAliveStart = Math.max(fightInfo.startTime, tLife.firstSeen);
                        let isAlive = true;
                        
                        let events = [];
                        if (tLife.deaths) tLife.deaths.forEach(d => events.push({time: d, type: 'death'}));
                        if (tLife.rebirths) tLife.rebirths.forEach(r => events.push({time: r, type: 'rebirth'}));
                        events.sort((a, b) => a.time - b.time);
                        
                        events.forEach(ev => {
                            if (ev.time > fightInfo.endTime + 5000) return;
                            if (ev.time < lastAliveStart) {
                                if (ev.type === 'death') isAlive = false;
                                else isAlive = true;
                                return;
                            }
                            if (ev.type === 'death' && isAlive) {
                                aliveMs += (ev.time - lastAliveStart);
                                isAlive = false;
                            } else if (ev.type === 'rebirth' && !isAlive) {
                                lastAliveStart = ev.time;
                                isAlive = true;
                            }
                        });
                        
                        if (isAlive) {
                            aliveMs += (fightInfo.endTime - lastAliveStart);
                        }
                        targetDur = aliveMs > 0 ? aliveMs : durationMs;
                    }

                    const pct = Math.round((covered / targetDur) * 100);
                    if (pct > bestUptime) bestUptime = pct;
                });
                headerLabel = `${bestUptime}%`;
            }

            html += `
            <div class="cd-debuff-row">
                <div class="cd-debuff-header">
                    <img class="cd-debuff-icon" src="/api/icon/${dlData.icon}.jpg" onerror="this.src='/api/icon/inv_misc_questionmark.jpg'">
                    <span class="cd-debuff-name" style="color: ${color};">${debuffName}</span>
                    <span class="cd-debuff-uptime" title="${isPoint ? 'Total casts' : 'Best uptime across targets'}">${headerLabel}</span>
                </div>`;

            targets.forEach(([targetName, segs]) => {
                let rightLabel = '';
                if (isPoint) {
                    rightLabel = `${segs.length}×`;
                } else {
                    // Compute per-target uptime
                    let covered = 0;
                    segs.forEach(s => {
                        const relS = Math.max(0, s.start - fightInfo.startTime);
                        const relE = Math.min(durationMs, s.end - fightInfo.startTime);
                        if (relE > relS) covered += (relE - relS);
                    });
                    
                    let targetDur = durationMs;
                    if (castData.targetLifespans && castData.targetLifespans[targetName]) {
                        const tLife = castData.targetLifespans[targetName];
                        let aliveMs = 0;
                        let lastAliveStart = Math.max(fightInfo.startTime, tLife.firstSeen);
                        let isAlive = true;
                        
                        let events = [];
                        if (tLife.deaths) tLife.deaths.forEach(d => events.push({time: d, type: 'death'}));
                        if (tLife.rebirths) tLife.rebirths.forEach(r => events.push({time: r, type: 'rebirth'}));
                        events.sort((a, b) => a.time - b.time);
                        
                        events.forEach(ev => {
                            if (ev.time > fightInfo.endTime + 5000) return;
                            if (ev.time < lastAliveStart) {
                                if (ev.type === 'death') isAlive = false;
                                else isAlive = true;
                                return;
                            }
                            if (ev.type === 'death' && isAlive) {
                                aliveMs += (ev.time - lastAliveStart);
                                isAlive = false;
                            } else if (ev.type === 'rebirth' && !isAlive) {
                                lastAliveStart = ev.time;
                                isAlive = true;
                            }
                        });
                        
                        if (isAlive) {
                            aliveMs += (fightInfo.endTime - lastAliveStart);
                        }
                        targetDur = aliveMs > 0 ? aliveMs : durationMs;
                    }

                    rightLabel = `${Math.round((covered / targetDur) * 100)}%`;
                }

                html += `
                <div class="cd-debuff-target-row">
                    <div class="cd-debuff-target-name" title="${targetName}">${targetName}</div>
                    <div class="cd-debuff-track">`;

                if (castData.targetLifespans && castData.targetLifespans[targetName]) {
                    const tLife = castData.targetLifespans[targetName];
                    let events = [];
                    if (tLife.deaths) tLife.deaths.forEach(d => events.push({time: d, type: 'death'}));
                    if (tLife.rebirths) tLife.rebirths.forEach(r => events.push({time: r, type: 'rebirth'}));
                    events.sort((a, b) => a.time - b.time);
                    
                    let isDead = false;
                    let deadStart = 0;
                    events.forEach(ev => {
                        const relT = ev.time - fightInfo.startTime;
                        if (relT < 0 || relT > durationMs) return;
                        
                        if (ev.type === 'death' && !isDead) {
                            isDead = true;
                            deadStart = relT;
                            const leftPct = (relT / durationMs) * 100;
                            html += `<div class="cd-debuff-death-marker" title="Died at ${formatDuration(relT)}" style="left:${leftPct.toFixed(2)}%; position:absolute; width:2px; height:100%; background:#ff3333; z-index:10; box-shadow: 0 0 4px #ff3333;"></div>`;
                        } else if (ev.type === 'rebirth' && isDead) {
                            isDead = false;
                            const deadWidth = ((relT - deadStart) / durationMs) * 100;
                            const deadLeft = (deadStart / durationMs) * 100;
                            html += `<div class="cd-debuff-dead-zone" style="left:${deadLeft.toFixed(2)}%; width:${deadWidth.toFixed(2)}%; position:absolute; height:100%; background:rgba(255,51,51,0.1); z-index:5;"></div>`;
                            
                            const leftPct = (relT / durationMs) * 100;
                            html += `<div class="cd-debuff-ress-marker" title="Resurrected at ${formatDuration(relT)}" style="left:${leftPct.toFixed(2)}%; position:absolute; width:2px; height:100%; background:#4caf50; z-index:10; box-shadow: 0 0 4px #4caf50;"></div>`;
                        }
                    });
                    
                    if (isDead) {
                        const deadWidth = ((durationMs - deadStart) / durationMs) * 100;
                        const deadLeft = (deadStart / durationMs) * 100;
                        html += `<div class="cd-debuff-dead-zone" style="left:${deadLeft.toFixed(2)}%; width:${deadWidth.toFixed(2)}%; position:absolute; height:100%; background:rgba(255,51,51,0.1); z-index:5;"></div>`;
                    }
                }

                segs.forEach(s => {
                    const relStart = Math.max(0, s.start - fightInfo.startTime);
                    const relEnd   = Math.min(durationMs, s.end - fightInfo.startTime);
                    if (isPoint || s.isPoint) {
                        // Render as a thin vertical marker line at the cast moment
                        const leftPct = (relStart / durationMs) * 100;
                        html += `<div class="cd-debuff-marker" title="${formatDuration(relStart)}" style="left:${leftPct.toFixed(2)}%; background:${color}; box-shadow: 0 0 4px ${color};"></div>`;
                    } else if (relEnd > relStart) {
                        const leftPct  = (relStart / durationMs) * 100;
                        const widthPct = ((relEnd - relStart) / durationMs) * 100;
                        html += `<div class="cd-debuff-bar" title="${formatDuration(relEnd - relStart)}" style="left:${leftPct.toFixed(2)}%; width:${widthPct.toFixed(2)}%; background:${color}; box-shadow: 0 0 6px ${color};"></div>`;
                    }
                });
                html += `</div>
                    <div class="cd-debuff-tpct">${rightLabel}</div>
                </div>`;
            });

            html += '</div>';
        });

        // Time axis
        html += `
        <div class="cd-time-axis">
            <span>0:00</span>
            <span>${formatDuration(durationMs / 4)}</span>
            <span>${formatDuration(durationMs / 2)}</span>
            <span>${formatDuration(durationMs * 0.75)}</span>
            <span>${formatDuration(durationMs)}</span>
        </div>`;

        html += '</div></div>';
        }
    }

    html += '</div>';
    container.innerHTML = html;
    container.style.display = 'block';
    state.openPanels.casts = true;
}


// === TIMELINE INLINE ===
export function toggleTimelineInline(playerName, fightId) {
    const container = document.getElementById('inlineTimelineContainer');
    if (container.style.display === 'block') {
        container.style.display = 'none';
        state.openPanels.timeline = false;
        return;
    }
    
    // Note: all panels (gear, timeline, casts/debuff) can be open simultaneously in any combination

    if (!state.timelineDB || !state.timelineDB[fightId] || !state.timelineDB[fightId][playerName]) {
        container.innerHTML = '<div class="timeline-empty">No timeline data available.</div>';
        container.style.display = 'block';
        state.openPanels.timeline = true;
        return;
    }

    const events = state.timelineDB[fightId][playerName];
    const fightInfo = state.currentReport.fights.find(f => f.id == fightId || f.id == parseInt(fightId));
    if (!fightInfo) return;
    
    const durationMs = fightInfo.endTime - fightInfo.startTime;
    let html = `<div class="timeline-wrapper"><div class="timeline-title">FIGHT TIMELINE</div><div class="timeline-content">`;
    
    const usedSpells = Object.keys(events).filter(sId => events[sId].length > 0);
    
    if (usedSpells.length === 0) {
        html += '<div class="timeline-empty">No tracked cooldowns or procs used.</div>';
    } else {
        usedSpells.forEach(spellIdStr => {
            const baseSpellId = spellIdStr.split('-')[0];
            let spellInfo = window.TIMELINE_SPELLS[baseSpellId];
            if (!spellInfo) return;
            spellInfo = { ...spellInfo };

            if (spellIdStr.includes('-')) {
                spellInfo.name = `Innervate (${spellIdStr.split('-')[1]})`;
            }

            if (baseSpellId == 33370) {
                let hasScarab = false;
                if (fightId === 'overall') {
                    if (state.playerGearDB) {
                        for (let fId in state.playerGearDB) {
                            if (state.playerGearDB[fId][playerName] && state.playerGearDB[fId][playerName].some(g => g && g.id === 28190)) {
                                hasScarab = true;
                                break;
                            }
                        }
                    }
                } else {
                    const gear = (state.playerGearDB && state.playerGearDB[fightId] && state.playerGearDB[fightId][playerName]) ? state.playerGearDB[fightId][playerName] : [];
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
                
            // Calculate overlapping levels
            let stackLevels = [];
            events[spellIdStr].forEach(ev => {
                let placed = false;
                for (let i = 0; i < stackLevels.length; i++) {
                    let overlaps = stackLevels[i].some(existing => (ev.start < existing.end && ev.end > existing.start));
                    if (!overlaps) {
                        stackLevels[i].push(ev);
                        ev._level = i;
                        placed = true;
                        break;
                    }
                }
                if (!placed) {
                    ev._level = stackLevels.length;
                    stackLevels.push([ev]);
                }
            });

            events[spellIdStr].forEach(ev => {
                let relStart = ev.start - fightInfo.startTime;
                let relEnd = ev.end - fightInfo.startTime;
                relStart = Math.max(0, relStart);
                relEnd = Math.min(durationMs, relEnd);
                
                if (relEnd > relStart) {
                    const leftPct = (relStart / durationMs) * 100;
                    const widthPct = ((relEnd - relStart) / durationMs) * 100;
                    const levelOffset = ev._level ? (ev._level * 5) : 0;
                    html += `<div class="timeline-bar" style="left: ${leftPct}%; width: ${widthPct}%; background-color: ${color}; opacity: 0.85; border: 1px solid rgba(0,0,0,0.5); border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.5); top: calc(50% - 7px + ${levelOffset}px); height: 14px; z-index: ${ev._level || 0};"></div>`;
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
    state.openPanels.timeline = true;
}

// =============================================
// DISCORD WEBHOOK SYSTEM
// =============================================

let _editingWebhookId = null;

export function getWebhookProfiles() {
    try { return JSON.parse(localStorage.getItem('discord_webhooks') || '[]'); }
    catch { return []; }
}

export function saveWebhookProfiles(profiles) {
    localStorage.setItem('discord_webhooks', JSON.stringify(profiles));
}

export function renderWebhookProfiles() {
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
                <button class="webhook-btn-send" onclick="window.sendToWebhookProfile('${p.id}')">▶ Send</button>
                <button class="webhook-btn-edit" onclick="window.editWebhookProfile('${p.id}')">✏</button>
                <button class="webhook-btn-delete" onclick="window.deleteWebhookProfile('${p.id}')">🗑</button>
            </div>
        </div>
    `).join('');
}

export function showWebhookForm(editId = null) {
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

export function hideWebhookForm() {
    _editingWebhookId = null;
    document.getElementById('webhookForm').style.display = 'none';
    document.querySelector('.webhook-profiles-section').style.display = 'flex';
}

export function saveWebhookProfile() {
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

export function editWebhookProfile(id) { showWebhookForm(id); }

export function deleteWebhookProfile(id) {
    const profiles = getWebhookProfiles().filter(x => x.id !== id);
    saveWebhookProfiles(profiles);
    renderWebhookProfiles();
}

export async function sendToWebhookProfile(id) {
    const profiles = getWebhookProfiles();
    const p = profiles.find(x => x.id === id);
    if (!p) return;

    const btn = document.querySelector(`.webhook-profile-card .webhook-btn-send[onclick*="${id}"]`);
    if (btn) { btn.textContent = '⏳ Sending...'; btn.disabled = true; }

    const logId = state.currentLogId;
    const reportUrl = `${window.location.origin}/report/${logId}`;
    const msg = {
        embeds: [{
            title: "🦆 TBC Duck Analyzer - Log Audit",
            description: `${state.currentLogTitle || logId}\n\n📊 [**View Full Audit**](${reportUrl})\n📜 [**Original WCL Report**](https://www.warcraftlogs.com/reports/${logId})`,
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

export function enviarADiscord() {
    document.getElementById('discordOverlay').classList.add('is-open');
    hideWebhookForm();
    renderWebhookProfiles();
}

export function closeDiscordModal() {
    document.getElementById('discordOverlay').classList.remove('is-open');
    hideWebhookForm();
}
