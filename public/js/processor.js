import { state } from './state.js';

const SEAL_TO_TYPE = {
    // Seal of Righteousness
    25742: 'Righteousness', 25740: 'Righteousness', 25739: 'Righteousness',
    25738: 'Righteousness', 25737: 'Righteousness', 25736: 'Righteousness',
    25735: 'Righteousness', 25713: 'Righteousness', 27156: 'Righteousness',
    27155: 'Righteousness',
    // Seal of the Crusader
    20154: 'Crusader', 20305: 'Crusader', 20306: 'Crusader',
    20307: 'Crusader', 20308: 'Crusader', 21082: 'Crusader', 27158: 'Crusader',
    // Seal of Justice
    20164: 'Justice',
    // Seal of Light
    20165: 'Light', 20347: 'Light', 20348: 'Light', 20349: 'Light', 27160: 'Light',
    27159: 'Light',
    // Seal of Wisdom
    20166: 'Wisdom', 20356: 'Wisdom', 20357: 'Wisdom', 27167: 'Wisdom',
    27166: 'Wisdom',
    // Seal of Command
    20375: 'Command', 20376: 'Command', 20377: 'Command',
    20378: 'Command', 20379: 'Command', 27157: 'Command',
    // Seal of Blood
    31892: 'Blood',
    // Seal of Martyr
    34870: 'Martyr',
    // Seal of Vengeance
    31801: 'Vengeance'
};

export function processPlayerData(fightId, fightEvents, player) {
    let combatantInfos = [];
    let tempEnchants = [];
    let spells = {};
    let timelineEvents = {};
    let deaths = [];
    let rebirths = [];
    let activeSeal = null;

    // Phase 1: combatantinfo + buff events
    fightEvents.forEach(ev => {
        if (ev.type === 'combatantinfo' && ev.sourceID === player.id) {
            combatantInfos.push(ev.auras ? ev.auras.map(a => a.ability) : []);

            // Initialize timeline events for buffs already active at start
            if (ev.auras) {
                ev.auras.forEach(aura => {
                    const spellId = aura.ability;
                    if (SEAL_TO_TYPE[spellId]) {
                        activeSeal = SEAL_TO_TYPE[spellId];
                    }
                    if (typeof window.TIMELINE_SPELLS !== 'undefined' && window.TIMELINE_SPELLS[spellId]) {
                        if (!timelineEvents[spellId]) timelineEvents[spellId] = [];
                        if (!timelineEvents[spellId].some(t => t.end === null)) {
                            timelineEvents[spellId].push({ start: ev.timestamp, end: null });
                        }
                    }
                });
            }

            if (ev.gear && ev.gear.length > 0) {
                if (!state.playerGearDB[fightId]) state.playerGearDB[fightId] = {};
                state.playerGearDB[fightId][player.name] = ev.gear;

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
                        if (!state.playerEnchantsForConsole[player.name]) state.playerEnchantsForConsole[player.name] = new Set();
                        if (rawEnchant) state.playerEnchantsForConsole[player.name].add(rawEnchant);
                        if (rawEnchant && window.ENCHANT_DB && window.ENCHANT_DB[rawEnchant]) {
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
            if (typeof window.BUFF_DB !== 'undefined' && window.BUFF_DB[ev.abilityGameID]) {
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
        const isRebirth = (ev.abilityGameID === 20484 || ev.abilityGameID === 21849 || ev.abilityGameID === 21850 || ev.abilityGameID === 26993 || ev.abilityGameID === 26994);
        const isAnkh = (ev.abilityGameID === 20608);
        const isSoulstone = (ev.abilityGameID === 20707 || ev.abilityGameID === 20748 || ev.abilityGameID === 20749 || ev.abilityGameID === 20750 || ev.abilityGameID === 20758 || ev.abilityGameID === 27239);

        if (deaths.length > 0 && deaths.some(d => d < ev.timestamp)) {
            const hasRecentRes = rebirths.some(r => Math.abs(r.timestamp - ev.timestamp) < 2000);
            if (!hasRecentRes) {
                if ((ev.type === 'cast' || ev.type === 'resurrect' || ev.type === 'applybuff') && isRebirth && ev.targetID === player.id) {
                    rebirths.push({ timestamp: ev.timestamp, type: 'Combat Res', icon: '🌿' });
                }
                else if ((ev.type === 'cast' || ev.type === 'applybuff' || ev.type === 'resurrect') && isAnkh && (ev.targetID === player.id || ev.sourceID === player.id)) {
                    rebirths.push({ timestamp: ev.timestamp, type: 'Ankh', icon: '⚡' });
                }
                else if ((ev.type === 'cast' || ev.type === 'applybuff' || ev.type === 'resurrect') && isSoulstone && ev.targetID === player.id) {
                    rebirths.push({ timestamp: ev.timestamp, type: 'Soulstone', icon: '💎' });
                }
                else if (ev.type === 'resurrect' && ev.targetID === player.id) {
                    rebirths.push({ timestamp: ev.timestamp, type: 'Resurrect', icon: '✨' });
                }
            }
        }

        let playerId = ev.sourceID;
        if (ev.type === 'damage' && ev.abilityGameID === 33671) playerId = ev.targetID;
        if (['applybuff', 'applybuffstack', 'refreshbuff', 'removebuff'].includes(ev.type)) playerId = ev.targetID;
        if (playerId !== player.id) return;

        let spellId = ev.abilityGameID;

        // Ignorar los "casteos fantasma" de procs pasivos generados por golpes a melee (Sello de Comando/Sangre)
        if (ev.type === 'cast' && (spellId === 20424 || spellId === 31898)) return;

        if (ev.type === 'cast' && window.SPELL_DB && window.SPELL_DB[spellId] && !SEAL_TO_TYPE[spellId] && !window.SPELL_DB[spellId].isInterrupt && !window.SPELL_DB[spellId].isMechanic && !window.SPELL_DB[spellId].isRes && window.SPELL_DB[spellId].category !== 5 && window.SPELL_DB[spellId].category !== 3) {
            if (spellId === 33671) return;
            if (!spells[spellId]) spells[spellId] = { count: 0, damage: 0 };
            spells[spellId].count += 1;
        }
        else if (ev.type === 'interrupt' && window.SPELL_DB && window.SPELL_DB[spellId]) {
            if (!spells[spellId]) spells[spellId] = { count: 0, damage: 0 };
            spells[spellId].count += 1;
        }
        // Sappers: track cast count + accumulate damage from hits
        else if (ev.type === 'cast' && (spellId === 13241 || spellId === 30486)) {
            if (!spells[spellId]) spells[spellId] = { count: 0, damage: 0 };
            spells[spellId].count += 1;
        }
        else if (ev.type === 'damage' && (spellId === 13241 || spellId === 30486 || spellId === 33671)) {
            if (!spells[spellId]) spells[spellId] = { count: 0, damage: 0 };
            spells[spellId].damage += (ev.amount || 0) + (ev.absorbed || 0);
            if (spellId === 33671) spells[spellId].count += 1;
        }

        // Phase 3: Timeline tracking
        if (typeof window.TIMELINE_SPELLS !== 'undefined' && window.TIMELINE_SPELLS[spellId]) {
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
            } else if (ev.type === 'cast' && window.TIMELINE_SPELLS[spellId].duration) {
                // Track instantaneous casts like Sappers that have a defined fake duration for visual purposes
                timelineEvents[spellId].push({ start: ev.timestamp, end: ev.timestamp + window.TIMELINE_SPELLS[spellId].duration });
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
        spec: state.detectedSpecs[player.name] || player.subType
    };
}
