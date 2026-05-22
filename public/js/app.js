import { state, resetStateForLanding } from './state.js';
import { auditarLog } from './api.js';
import { renderMainContent, filterAllViewByClass } from './ui/mainContent.js';
import { 
    toggleGearInline, closeGearModal, toggleTimelineInline, 
    sendToWebhookProfile, editWebhookProfile, deleteWebhookProfile, 
    enviarADiscord, closeDiscordModal 
} from './ui/modals.js';

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
    state.selectedPlayerName = playerName;
    document.querySelectorAll('.player-item').forEach(el => {
        el.classList.toggle('active', el.dataset.player === playerName);
    });
    renderMainContent();
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
