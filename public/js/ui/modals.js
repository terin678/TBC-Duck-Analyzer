import { state } from '../state.js?v=1.2.7';
import { formatDuration, escapeHtml } from '../utils.js?v=1.2.7';

// =============================================
// GEAR INSPECTOR 
// =============================================

export function toggleGearInline(playerName, encounterId, className, specName) {
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

// === TIMELINE INLINE ===
export function toggleTimelineInline(playerName, fightId) {
    const container = document.getElementById('inlineTimelineContainer');
    if (container.style.display === 'block') {
        container.style.display = 'none';
        return;
    }
    
    // Hide gear if open
    const gearContainer = document.getElementById('inlineGearContainer');
    if (gearContainer) gearContainer.style.display = 'none';

    if (!state.timelineDB || !state.timelineDB[fightId] || !state.timelineDB[fightId][playerName]) {
        container.innerHTML = '<div class="timeline-empty">No timeline data available.</div>';
        container.style.display = 'block';
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
        usedSpells.forEach(spellId => {
            let spellInfo = window.TIMELINE_SPELLS[spellId];
            if (!spellInfo) return;
            spellInfo = { ...spellInfo };

            if (spellId == 33370) {
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
