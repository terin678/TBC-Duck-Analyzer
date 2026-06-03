import { state, resetStateForLanding } from './state.js?v=1.3.6';
import { auditarLog } from './api.js?v=1.3.6';
import { renderMainContent, filterAllViewByClass } from './ui/mainContent.js?v=1.3.6';
import { 
    toggleGearInline, closeGearModal, toggleTimelineInline, 
    toggleCastsDebuffInline,
    sendToWebhookProfile, editWebhookProfile, deleteWebhookProfile, 
    enviarADiscord, closeDiscordModal 
} from './ui/modals.js?v=1.3.6';

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
}

// === SELECTION HANDLERS ===

export function selectFight(fightId) {
    state.selectedFightId = fightId;
    document.querySelectorAll('.fight-item').forEach(el => {
        el.classList.toggle('active', el.dataset.fight == fightId);
    });
    renderMainContent();
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
window.filterAllViewByClass = filterAllViewByClass;

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
