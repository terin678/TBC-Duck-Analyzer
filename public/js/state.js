export const state = {
    currentReport: null,
    currentEvents: null,
    currentActors: null,
    currentLogId: null,
    currentLogTitle: '',
    selectedFightId: null,
    selectedPlayerName: null,
    detectedSpecs: {},
    playerGearDB: {},
    playerEnchantsForConsole: {},
    allViewClassFilter: null,
    timelineDB: {},
    castsDebuffDB: {},
    allActors: [],
    openPanels: { gear: false, timeline: false, casts: false }
};

export function resetStateForAudit(logId) {
    state.currentLogId = logId;
    state.detectedSpecs = {};
    state.playerGearDB = {};
    state.playerEnchantsForConsole = {};
    state.timelineDB = {};
    state.castsDebuffDB = {};
    state.allActors = [];
}

export function resetStateForLanding() {
    state.selectedFightId = null;
    state.selectedPlayerName = null;
    state.currentReport = null;
    state.currentEvents = null;
    state.currentActors = null;
}
