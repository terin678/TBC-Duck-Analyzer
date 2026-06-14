import { state } from '../state.js?v=2.1.0';
import { formatDuration, escapeHtml } from '../utils.js?v=2.1.0';

export function renderFightsSidebar(report) {
    const fightsList = document.getElementById('fightsList');
    let html = '';

    // Compare button
    html += `<div style="padding: 10px 15px;">
        <button id="btnCompare" onclick="window.openCompareMode()" style="width: 100%; padding: 8px; background: #2c3e50; color: #fff; border: 1px solid #34495e; border-radius: 4px; cursor: pointer; font-weight: bold;">⚖️ Compare Logs</button>
    </div>`;

    // OVERALL entry
    html += `<div class="fight-item" data-fight="overall" onclick="window.selectFight('overall')">
        <div class="fight-info">
            <div class="fight-name">Overall</div>
            <div class="fight-status fight-status-overall">ALL FIGHTS</div>
        </div>
    </div>`;

    // Individual fights
    let wipeCounts = {};
    const bossFights = report.fights.filter(f => f.kill === true || f.kill === false || f.difficulty);
    bossFights.forEach(fight => {
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

        html += `<div class="fight-item" data-fight="${fight.id}" onclick="window.selectFight('${fight.id}')">
            <div class="fight-info">
                <div class="fight-name">${fight.name}${wipeNum}</div>
                <div class="fight-status ${statusClass}">${statusText}</div>
            </div>
            <div class="fight-time">${timeStr}</div>
        </div>`;
    });

    fightsList.innerHTML = html;
}

export function renderPlayersSidebar(allActors) {
    const playersList = document.getElementById('playersList');

    // "All" option at the top
    let html = `<div class="player-item all-player-item" data-player="__ALL__" onclick="window.selectPlayer('__ALL__')">
        <span class="all-player-icon">👥</span>
        <span class="all-player-label">All</span>
    </div>`;

    // Sort by class order, then by spec, then by name
    const sorted = [...allActors].sort((a, b) => {
        const ci = window.CLASSES.indexOf(a.subType) - window.CLASSES.indexOf(b.subType);
        if (ci !== 0) return ci;
        const specA = state.detectedSpecs[a.name] || a.subType;
        const specB = state.detectedSpecs[b.name] || b.subType;
        const si = specA.localeCompare(specB);
        if (si !== 0) return si;
        return a.name.localeCompare(b.name);
    });

    html += sorted.map(player => {
        const spec = state.detectedSpecs[player.name] || player.subType;
        const specIcon = window.SPEC_ICONS[spec] || window.SPEC_ICONS[player.subType] || 'inv_misc_questionmark';
        const className = player.subType;
        // Escape single quotes in player names for onclick
        const safeName = player.name.replace(/'/g, "\\'");
        return `<div class="player-item" data-player="${escapeHtml(player.name)}" onclick="window.selectPlayer('${safeName}')">
            <img src="/api/icon/${specIcon}.jpg" class="player-item-icon" onerror="this.src='/api/icon/inv_misc_questionmark.jpg'">
            <span class="${className}-color">${player.name}</span>
        </div>`;
    }).join('');

    playersList.innerHTML = html;
}
