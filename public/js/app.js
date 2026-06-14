import { state, resetStateForLanding } from './state.js?v=2.1.0';
import { auditarLog } from './api.js?v=2.1.0';
import { renderMainContent, toggleAllViewFilter } from './ui/mainContent.js?v=2.1.0';
import { updatePlayersSidebar } from './ui/sidebar.js?v=2.1.0';
import { 
    closeModal, 
    toggleTimelineInline, 
    toggleCastsDebuffInline 
} from './ui/modals.js?v=2.1.0';
import { 
    openCompareMode,
    closeCompareMode,
    loadCompareLog, 
    useSameLogForCompare, 
    clearCompareLog, 
    updateCompareSelection 
} from './ui/compareView.js?v=2.1.0';

// === PAGE TRANSITIONS ===

export function transitionToApp() {
    document.getElementById('landingPage').classList.add('hidden');
    document.getElementById('appLayout').classList.add('visible');
}

export function goBackToLanding() {
    document.getElementById('appLayout').classList.remove('visible');
    document.getElementById('landingPage').classList.remove('hidden');
    resetStateForLanding();
    document.getElementById('btnDiscord').style.display = 'none';
    window.history.pushState({}, '', '/');
}

// === URL STATE MANAGEMENT ===
export function updateURL() {
    const url = new URL(window.location);
    if (state.currentLogId) url.searchParams.set('log', state.currentLogId);
    else url.searchParams.delete('log');

    if (state.selectedFightId) url.searchParams.set('fight', state.selectedFightId);
    else url.searchParams.delete('fight');

    if (state.selectedPlayerName && state.selectedPlayerName !== '__ALL__') {
        url.searchParams.set('player', state.selectedPlayerName);
    } else {
        url.searchParams.delete('player');
    }

    if (state.compareState && state.compareState.active) {
        url.searchParams.set('compare', 'true');
        if (state.compareLogB) url.searchParams.set('logB', state.compareLogB.logId);
        if (state.compareState.fightA) url.searchParams.set('fightA', state.compareState.fightA);
        if (state.compareState.playerA) url.searchParams.set('playerA', state.compareState.playerA);
        if (state.compareState.fightB) url.searchParams.set('fightB', state.compareState.fightB);
        if (state.compareState.playerB) url.searchParams.set('playerB', state.compareState.playerB);
    } else {
        url.searchParams.delete('compare');
        url.searchParams.delete('logB');
        url.searchParams.delete('fightA');
        url.searchParams.delete('playerA');
        url.searchParams.delete('fightB');
        url.searchParams.delete('playerB');
    }

    window.history.pushState({}, '', url);
}

// === SELECTION HANDLERS ===

export function selectFight(fightId) {
    // Save which panels were open before re-render
    const wasGearOpen = state.openPanels.gear;
    const wasTimelineOpen = state.openPanels.timeline;
    const wasCastsOpen = state.openPanels.casts;

    // Reset panel state since renderMainContent will destroy the DOM
    state.openPanels.gear = false;
    state.openPanels.timeline = false;
    state.openPanels.casts = false;

    state.selectedFightId = fightId;
    document.querySelectorAll('.fight-item').forEach(el => {
        el.classList.toggle('active', el.dataset.fight == fightId);
    });
    renderMainContent();
    updateURL();

    // Re-open previously open panels for the current player on the new encounter
    const playerName = state.selectedPlayerName;
    if (playerName && playerName !== '__ALL__' && fightId) {
        const safeName = playerName.replace(/'/g, "\\'");
        const isOverall = (fightId === 'overall');

        setTimeout(() => {
            if (wasGearOpen) {
                const player = state.currentActors && state.currentActors.find(a => a.name === playerName);
                if (player) {
                    const spec = state.detectedSpecs[playerName] || player.subType;
                    window.toggleGearInline(safeName, fightId, player.subType, spec);
                }
            }
            if (wasTimelineOpen && !isOverall) {
                window.toggleTimelineInline(safeName, fightId);
            }
            if (wasCastsOpen) {
                window.toggleCastsDebuffInline(safeName, fightId);
            }
        }, 50);
    }
}

export function selectPlayer(playerName) {
    // Save which panels were open before re-render
    const wasGearOpen = state.openPanels.gear;
    const wasTimelineOpen = state.openPanels.timeline;
    const wasCastsOpen = state.openPanels.casts;

    // Reset panel state since renderMainContent will destroy the DOM
    state.openPanels.gear = false;
    state.openPanels.timeline = false;
    state.openPanels.casts = false;

    state.selectedPlayerName = playerName;
    document.querySelectorAll('.player-item').forEach(el => {
        el.classList.toggle('active', el.dataset.player === playerName);
    });
    renderMainContent();
    updateURL();

    // Re-open previously open panels for the new player (only for individual player views)
    if (playerName && playerName !== '__ALL__' && state.selectedFightId) {
        const safeName = playerName.replace(/'/g, "\\'");
        const fightId = state.selectedFightId;
        const isOverall = (fightId === 'overall');

        // Use setTimeout to let the DOM render first
        setTimeout(() => {
            if (wasGearOpen) {
                const player = state.currentActors && state.currentActors.find(a => a.name === playerName);
                if (player) {
                    const spec = state.detectedSpecs[playerName] || player.subType;
                    window.toggleGearInline(safeName, fightId, player.subType, spec);
                }
            }
            if (wasTimelineOpen && !isOverall) {
                window.toggleTimelineInline(safeName, fightId);
            }
            if (wasCastsOpen) {
                window.toggleCastsDebuffInline(safeName, fightId);
            }
        }, 50);
    }
}

// === EXPOSE TO WINDOW FOR INLINE ONCLICK HANDLERS ===
window.auditarLog = auditarLog;
window.transitionToApp = transitionToApp;
window.goBackToLanding = goBackToLanding;
window.selectFight = selectFight;
window.selectPlayer = selectPlayer;
window.toggleAllViewFilter = toggleAllViewFilter;
window.renderMainContent = renderMainContent;

// Modals
window.toggleGearInline = toggleGearInline;
window.closeGearModal = closeGearModal;
window.toggleTimelineInline = toggleTimelineInline;
window.toggleCastsDebuffInline = toggleCastsDebuffInline;

// Discord
window.enviarADiscord = enviarADiscord;
window.closeDiscordModal = closeDiscordModal;
window.sendToWebhookProfile = sendToWebhookProfile;
window.editWebhookProfile = editWebhookProfile;
window.deleteWebhookProfile = deleteWebhookProfile;

// Compare
window.openCompareMode = openCompareMode;
window.exitCompareMode = exitCompareMode;
window.loadCompareLog = loadCompareLog;
window.useSameLogForCompare = useSameLogForCompare;
window.clearCompareLog = clearCompareLog;
window.updateCompareSelection = updateCompareSelection;
window.updateURL = updateURL;

// === INITIALIZATION ===

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
    
    // Read state from URL before audit
    if (urlParams.get('fight')) state.selectedFightId = urlParams.get('fight');
    if (urlParams.get('player')) state.selectedPlayerName = urlParams.get('player');
    
    if (urlParams.get('compare') === 'true') {
        state.compareState.active = true;
        if (urlParams.get('fightA')) state.compareState.fightA = urlParams.get('fightA');
        if (urlParams.get('playerA')) state.compareState.playerA = urlParams.get('playerA');
        if (urlParams.get('fightB')) state.compareState.fightB = urlParams.get('fightB');
        if (urlParams.get('playerB')) state.compareState.playerB = urlParams.get('playerB');
        if (urlParams.get('logB')) {
            // We will load logB after main audit finishes. We store it temporarily.
            state._pendingLogB = urlParams.get('logB');
        }
    }

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
