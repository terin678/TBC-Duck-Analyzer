import { state } from './state.js?v=2.1.0';

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
    let lastCiTimestamp = 0;
    let tempEnchants = [];
    let spells = {};
    let timelineEvents = {};
    let deaths = [];
    let rebirths = [];
    let activeSeal = null;
    let itemCasts = {};
    let prePots = {};
    let targetLifespans = {};

    // Build actorId → name map from ALL actors (players + NPCs/bosses)
    const actorNameMap = {};
    const allActorsSrc = state.allActors && state.allActors.length > 0
        ? state.allActors
        : (state.currentReport && state.currentReport.masterData && state.currentReport.masterData.actors) || [];
    allActorsSrc.forEach(a => { actorNameMap[a.id] = a.name; });
    // Also add raid players as fallback
    if (state.currentActors) {
        state.currentActors.forEach(a => { if (!actorNameMap[a.id]) actorNameMap[a.id] = a.name; });
    }

    // Phase 1: combatantinfo + buff events
    fightEvents.forEach(ev => {
        if (ev.type === 'combatantinfo' && ev.sourceID === player.id) {
            if (ev.timestamp - lastCiTimestamp <= 30000) return;
            lastCiTimestamp = ev.timestamp;
            combatantInfos.push(ev.auras ? ev.auras.map(a => a.ability) : []);

            // Initialize timeline events for buffs already active at start
            if (ev.auras) {
                ev.auras.forEach(aura => {
                    const spellId = aura.ability;
                    if (SEAL_TO_TYPE[spellId]) {
                        activeSeal = SEAL_TO_TYPE[spellId];
                    }
                    if (typeof window.BUFF_DB !== 'undefined' && window.BUFF_DB[spellId]) {
                        let isConsumable = window.BUFF_DB[spellId].category === 5 || window.BUFF_DB[spellId].order === 70;
                        if (isConsumable) {
                            prePots[spellId] = (prePots[spellId] || 0) + 1;
                        }
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
                if (combatantInfos.length > 0) {
                    let lastInfos = combatantInfos[combatantInfos.length - 1];
                    if (!lastInfos.includes(ev.abilityGameID)) {
                        lastInfos.push(ev.abilityGameID);
                    }
                }
            }
        }
    });

    // Phase 2: Spell casts, interrupts, damage
    fightEvents.forEach(ev => {
        const checkActor = (id, ts) => {
            if (!id) return;
            const name = actorNameMap[id] || `#${id}`;
            if (!targetLifespans[name]) targetLifespans[name] = { firstSeen: ts, deaths: [], rebirths: [] };
            else if (ts < targetLifespans[name].firstSeen) targetLifespans[name].firstSeen = ts;
        };
        checkActor(ev.sourceID, ev.timestamp);
        checkActor(ev.targetID, ev.timestamp);

        if (ev.type === 'death') {
            const deathId = ev.targetID || ev.sourceID;
            if (deathId) {
                const name = actorNameMap[deathId] || `#${deathId}`;
                if (!targetLifespans[name]) targetLifespans[name] = { firstSeen: ev.timestamp, deaths: [], rebirths: [] };
                if (!targetLifespans[name].deaths.some(d => Math.abs(d - ev.timestamp) < 5000)) {
                    targetLifespans[name].deaths.push(ev.timestamp);
                }
            }
        }

        if (ev.type === 'death' && (ev.targetID === player.id || (!ev.targetID && ev.sourceID === player.id))) {
            if (!deaths.some(d => Math.abs(d - ev.timestamp) < 5000)) {
                deaths.push(ev.timestamp);
            }
        }

        // ── Detección de resurrecciones ────────────────────────────────────────
        // Se hace ANTES del filtro de playerId para que no se pierdan eventos
        // donde WCL no incluye targetID (ej: Ankh del propio Shaman)
        const isRebirth = (ev.abilityGameID === 20484 || ev.abilityGameID === 20739 || ev.abilityGameID === 20742 || ev.abilityGameID === 20747 || ev.abilityGameID === 20748 || ev.abilityGameID === 26994);
        const isAnkh = (ev.abilityGameID === 20608);
        const isSoulstone = (ev.abilityGameID === 20707 || ev.abilityGameID === 20762 || ev.abilityGameID === 20749 || ev.abilityGameID === 20750 || ev.abilityGameID === 20758 || ev.abilityGameID === 27239);

        // El jugador es el objetivo o la fuente (Ankh se castea a sí mismo)
        const playerIsTarget = (ev.targetID === player.id);
        const playerIsSource = (ev.sourceID === player.id);

        if (deaths.length > 0 && deaths.some(d => d < ev.timestamp)) {
            const hasRecentRes = rebirths.some(r => Math.abs(r.timestamp - ev.timestamp) < 2000);
            if (!hasRecentRes) {
                if ((ev.type === 'cast' || ev.type === 'resurrect' || ev.type === 'applybuff') && isRebirth && playerIsTarget) {
                    rebirths.push({ timestamp: ev.timestamp, type: 'Combat Res', icon: '🌿' });
                }
                else if (isAnkh && (playerIsTarget || playerIsSource)) {
                    if (ev.type === 'cast' || ev.type === 'applybuff' || ev.type === 'resurrect') {
                        rebirths.push({ timestamp: ev.timestamp, type: 'Ankh', icon: '⚡' });
                    }
                }
                else if ((ev.type === 'cast' || ev.type === 'applybuff' || ev.type === 'resurrect') && isSoulstone && playerIsTarget) {
                    rebirths.push({ timestamp: ev.timestamp, type: 'Soulstone', icon: '💎' });
                }
            }
        }

        // Track rebirths for targetLifespans
        if ((ev.type === 'cast' || ev.type === 'resurrect' || ev.type === 'applybuff') && isRebirth && ev.targetID) {
            const name = actorNameMap[ev.targetID] || `#${ev.targetID}`;
            if (targetLifespans[name]) {
                if (!targetLifespans[name].rebirths) targetLifespans[name].rebirths = [];
                targetLifespans[name].rebirths.push(ev.timestamp);
            }
        }
        else if (isAnkh && ev.sourceID && (ev.type === 'cast' || ev.type === 'applybuff' || ev.type === 'resurrect')) {
            const name = actorNameMap[ev.sourceID] || `#${ev.sourceID}`;
            if (targetLifespans[name]) {
                if (!targetLifespans[name].rebirths) targetLifespans[name].rebirths = [];
                targetLifespans[name].rebirths.push(ev.timestamp);
            }
        }
        else if ((ev.type === 'cast' || ev.type === 'applybuff' || ev.type === 'resurrect') && isSoulstone && ev.targetID) {
            const name = actorNameMap[ev.targetID] || `#${ev.targetID}`;
            if (targetLifespans[name]) {
                if (!targetLifespans[name].rebirths) targetLifespans[name].rebirths = [];
                targetLifespans[name].rebirths.push(ev.timestamp);
            }
        }

        let playerId = ev.sourceID;
        if (ev.type === 'damage' && ev.abilityGameID === 33671) playerId = ev.targetID;
        if (['applybuff', 'applybuffstack', 'refreshbuff', 'removebuff'].includes(ev.type)) playerId = ev.targetID;
        if (playerId !== player.id) return;

        let spellId = ev.abilityGameID;

        // Ignorar los "casteos fantasma" de procs pasivos generados por golpes a melee (Sello de Comando/Sangre)
        if (ev.type === 'cast' && (spellId === 20424 || spellId === 31898)) return;

        // Para Consumibles y CDs, WCL a veces registra 'applybuff' pero no 'cast' (especialmente en trash)
        let isConsumableOrCD = false;
        let isBuffOrCast = ev.type === 'cast' || (ev.type === 'applybuff' && ev.sourceID === player.id);
        
        if (isBuffOrCast) {
            if (!itemCasts._lastTimestamp) itemCasts._lastTimestamp = {};
            
            let lastTs = itemCasts._lastTimestamp[spellId];
            let timeSinceLast = lastTs === undefined ? 999999 : (ev.timestamp - lastTs);
            if (timeSinceLast > 5000) { // Evitar doble conteo entre cast y applybuff
                let counted = false;
                if (typeof window.BUFF_DB !== 'undefined' && window.BUFF_DB[spellId]) {
                    itemCasts[spellId] = (itemCasts[spellId] || 0) + 1;
                    counted = true;
                    itemCasts._lastTimestamp[spellId] = ev.timestamp;
                }
                if (!counted && typeof window.SPELL_DB !== 'undefined' && window.SPELL_DB[spellId] && window.SPELL_DB[spellId].category === 5) {
                    itemCasts[spellId] = (itemCasts[spellId] || 0) + 1;
                    counted = true;
                    itemCasts._lastTimestamp[spellId] = ev.timestamp;
                }
                
                // Track class CDs and trinkets (category 3)
                if (!counted && window.SPELL_DB && window.SPELL_DB[spellId] && !SEAL_TO_TYPE[spellId] && !window.SPELL_DB[spellId].isInterrupt && !window.SPELL_DB[spellId].isMechanic && !window.SPELL_DB[spellId].isRes && window.SPELL_DB[spellId].category !== 5) {
                    if (spellId !== 33671) {
                        if (!spells[spellId]) spells[spellId] = { count: 0, damage: 0 };
                        spells[spellId].count += 1;
                        itemCasts._lastTimestamp[spellId] = ev.timestamp;
                    }
                }
            }
        }

        // Track trinket procs (category 3) from applybuff events where sourceID may not be the player
        if (ev.type === 'applybuff' && !isBuffOrCast && window.SPELL_DB && window.SPELL_DB[spellId] && window.SPELL_DB[spellId].category === 3) {
            if (!itemCasts._lastTimestamp) itemCasts._lastTimestamp = {};
            let lastTs = itemCasts._lastTimestamp[spellId];
            let timeSinceLast = lastTs === undefined ? 999999 : (ev.timestamp - lastTs);
            if (timeSinceLast > 5000) {
                if (!spells[spellId]) spells[spellId] = { count: 0, damage: 0 };
                spells[spellId].count += 1;
                itemCasts._lastTimestamp[spellId] = ev.timestamp;
            }
        }

        if (ev.type === 'interrupt' && window.SPELL_DB && window.SPELL_DB[spellId]) {
            if (!spells[spellId]) spells[spellId] = { count: 0, damage: 0 };
            spells[spellId].count += 1;
        }
        // Sappers: accumulate damage and track missing casts via damage
        else if (ev.type === 'damage' && (spellId === 13241 || spellId === 30486 || spellId === 30216 || spellId === 30217 || spellId === 23063 || spellId === 33671)) {
            let mapId = spellId === 33671 ? 30486 : spellId;
            if (!spells[mapId]) spells[mapId] = { count: 0, damage: 0 };
            spells[mapId].damage += (ev.amount || 0) + (ev.absorbed || 0);
            
            if (!itemCasts._lastTimestamp) itemCasts._lastTimestamp = {};
            let lastTs = itemCasts._lastTimestamp[mapId];
            let timeSinceLast = lastTs === undefined ? 999999 : (ev.timestamp - lastTs);
            if (timeSinceLast > 5000) {
                itemCasts[mapId] = (itemCasts[mapId] || 0) + 1;
                itemCasts._lastTimestamp[mapId] = ev.timestamp;
            }
        }

        // Phase 3: Timeline tracking
        if (typeof window.TIMELINE_SPELLS !== 'undefined' && window.TIMELINE_SPELLS[spellId]) {
            if (!timelineEvents[spellId]) timelineEvents[spellId] = [];
            
            let timelineKey = spellId;
            if (spellId === 29166 && ev.sourceID && ev.sourceID !== 0) {
                const druidName = actorNameMap[ev.sourceID] || 'Unknown';
                timelineKey = `${spellId}-${druidName}`;
                if (!timelineEvents[timelineKey]) timelineEvents[timelineKey] = [];
            }

            if (['applybuff', 'applybuffstack', 'refreshbuff'].includes(ev.type)) {
                if (spellId === 28093) {
                    // Mongoose can stack up to 2 times, just push a new segment
                    let openCount = timelineEvents[timelineKey].filter(t => t.end === null).length;
                    if (openCount < 2) {
                        timelineEvents[timelineKey].push({ start: ev.timestamp, end: null });
                    }
                } else {
                    let openEv = timelineEvents[timelineKey].find(t => t.end === null);
                    if (!openEv) {
                        timelineEvents[timelineKey].push({ start: ev.timestamp, end: null });
                    }
                }
            } else if (ev.type === 'removebuff') {
                if (spellId === 28093) {
                    let openEvs = timelineEvents[timelineKey].filter(t => t.end === null);
                    if (openEvs.length > 0) {
                        openEvs[0].end = ev.timestamp; // Close oldest open segment
                    }
                } else if (spellId === 29166) {
                    const openKey = Object.keys(timelineEvents).find(k => k.startsWith('29166') && timelineEvents[k].some(t => t.end === null));
                    if (openKey) {
                        let openEv = timelineEvents[openKey].find(t => t.end === null);
                        if (openEv) openEv.end = ev.timestamp;
                    }
                } else {
                    let openEv = timelineEvents[spellId].find(t => t.end === null);
                    if (openEv) {
                        openEv.end = ev.timestamp;
                    }
                }
            } else if (ev.type === 'cast' && window.TIMELINE_SPELLS[spellId].duration) {
                timelineEvents[spellId].push({ start: ev.timestamp, end: ev.timestamp + window.TIMELINE_SPELLS[spellId].duration });
            }
        }
    });

    // Cleanup any open timeline events
    const fightEndTl = fightEvents.length > 0 ? fightEvents[fightEvents.length - 1].timestamp : 0;
    Object.keys(timelineEvents).forEach(spellId => {
        timelineEvents[spellId].forEach(ev => {
            if (ev.end === null) {
                ev.end = fightEndTl; 
            }
        });
    });

    // ── Heurística Ankh para Shaman ─────────────────────────────────────────
    // WCL NO registra ningún evento de resurrect/cast para el Ankh.
    // Si el jugador es Shaman y tiene muertes sin ressurrección detectada,
    // buscamos el primer cast que haga DESPUÉS de cada muerte: ese timestamp
    // es cuando volvió a la vida con el Ankh.
    if (player.subType === 'Shaman' && deaths.length > 0) {
        deaths.forEach(deathTs => {
            // ¿Ya tenemos una ress para esta muerte?
            const alreadyCovered = rebirths.some(r => r.timestamp > deathTs && r.timestamp < deathTs + 120000);
            if (alreadyCovered) return;

            // Buscar el primer cast del jugador después de la muerte,
            // dentro de una ventana de 30 segundos máximo.
            // Si tarda más de 30s en volver a castear, asumimos que
            // anduvo de vuelta / lo resucitaron normalmente → NO es Ankh.
            const ANKH_MAX_WINDOW_MS = 30000;
            const firstCastAfterDeath = fightEvents.find(ev =>
                ev.type === 'cast' &&
                ev.sourceID === player.id &&
                ev.timestamp > deathTs &&
                ev.timestamp <= deathTs + ANKH_MAX_WINDOW_MS
            );

            if (firstCastAfterDeath) {
                rebirths.push({
                    timestamp: firstCastAfterDeath.timestamp,
                    type: 'Ankh',
                    icon: '⚡'
                });
            }
        });
    }

    // ── Phase 4: Casts/Debuff tracking by class spec ─────────────────────────
    const spec = state.detectedSpecs[player.name] || player.subType;
    const castCounts = {};     // { "Shadow Bolt": { count: N, icon: "...", lowRank: bool }, ... }
    const debuffTimeline = {}; // { "Corruption": { targets: { npcName: [{start,end},...] }, icon, color } }

    // Build actorId → name map from ALL actors (players + NPCs/bosses)
    // (Moved to the top of processPlayerData for Phase 3 access)

    // Find the tracking config: exact spec match first, then try class-level default
    let tracking = window.CLASS_ABILITY_TRACKING && window.CLASS_ABILITY_TRACKING[spec];
    if (!tracking && window.CLASS_ABILITY_TRACKING) {
        // Fallback: try the player's base class with a default suffix
        const baseClass = player.subType;
        const fallbackKey = Object.keys(window.CLASS_ABILITY_TRACKING).find(k => k.startsWith(baseClass + '-'));
        if (fallbackKey) tracking = window.CLASS_ABILITY_TRACKING[fallbackKey];
    }

    if (tracking) {
        // Build lookup maps: spellId (number) → tracking entry
        const castIdMap = {};
        if (tracking && tracking.casts) {
            tracking.casts.forEach(entry => {
                entry.ids.forEach((id, index) => {
                    // Create a separate map entry per ID so we can assign specific rankStrings
                    let mappedEntry = { ...entry };
                    if (entry.maxRank) {
                        const currentRank = entry.maxRank - index;
                        // For max rank, we don't append rankString (or we can if user wants, but user said "Flash heal y punto" for max rank)
                        if (index > 0) {
                            mappedEntry.rankString = `(Rank ${currentRank})`;
                        }
                    }
                    castIdMap[id] = mappedEntry;
                });
            });
        }
        const debuffIdMap = {};
        tracking.debuffs.forEach(entry => {
            entry.ids.forEach(id => { debuffIdMap[id] = entry; });
        });

        // Estimated debuff durations in ms (cast-based fallback)
        const DEBUFF_DURATION_MS = {
            27218: 24000, 27216: 18000, 27215: 12000, 27228: 300000,
            27226: 120000, 11717: 120000, 603: 60000, 30910: 60000,
            26867: 12000, 26996: 9000, 26997: 12000, 26988: 12000,
            26993: 300000, 27016: 15000, 25368: 18000, 34914: 15000,
            // Windfury Totem (rank 1-5) — 2 minutes
            8512: 120000, 25587: 120000,
            // Grace of Air Totem — 2 minutes
            25359: 120000, 25528: 120000,
            // Wrath of Air Totem — 2 minutes
            3738: 120000,
            // Totem of Wrath — 2 minutes
            30706: 120000,
            // Faerie Fire (Feral) — 5 minutes
            27011: 300000,
            // Battle Shout (all ranks) — 2 minutes
            2048: 120000, 6673: 120000, 5242: 120000, 6192: 120000,
            11549: 120000, 11550: 120000, 11551: 120000, 25289: 120000,
        };
        const DEFAULT_DEBUFF_MS = 15000;

        // Track which targets have real applydebuff events per debuff name
        const hasRealEvents = {}; // debuffName -> Set of targetNames

        // Pre-process combatantinfo to capture buffs active at the start of combat (e.g. Battle Shout cast before pull)
        fightEvents.forEach(ev => {
            if (ev.type === 'combatantinfo' && ev.auras) {
                const targetId = ev.sourceID; // The player who has the buff
                const targetName = actorNameMap[targetId] || `#${targetId}`;
                ev.auras.forEach(aura => {
                    // Check if the aura matches our tracked debuffs and the source is our player
                    if (aura.source === player.id) {
                        const sid = aura.ability;
                        const entry = debuffIdMap[sid];
                        if (entry && !entry.isCastPoint) {
                            if (!debuffTimeline[entry.name]) {
                                debuffTimeline[entry.name] = {
                                    icon: entry.icon,
                                    color: entry.color || '#f4b400',
                                    isCastPoint: false,
                                    alwaysOnTop: entry.alwaysOnTop || false,
                                    sortOrder: entry.sortOrder != null ? entry.sortOrder : 999,
                                    group: entry.group || null,
                                    hideFromOverall: entry.hideFromOverall || false,
                                    targets: {}
                                };
                            }
                            const tl = debuffTimeline[entry.name];
                            if (!tl.targets[targetName]) tl.targets[targetName] = [];
                            if (!tl.targets[targetName].some(s => s.end === null)) {
                                tl.targets[targetName].push({ start: ev.timestamp, end: null, real: true });
                            }
                            if (!hasRealEvents[entry.name]) hasRealEvents[entry.name] = new Set();
                            hasRealEvents[entry.name].add(targetName);
                        }
                    }
                });
            }
        });

        fightEvents.forEach(ev => {
            const sid = ev.abilityGameID;
            if (!sid) return;

            // ── Cast counting (regular 'cast' events) ────────────────────────
            if (ev.type === 'cast' && ev.sourceID === player.id && castIdMap[sid]) {
                const entry = castIdMap[sid];
                // Skip trackOnDamage entries (counted via damage events below)
                if (!entry.trackOnDamage) {
                    // Skip if this spell is already in SPELL_DB (shown in Abilities section as a CD)
                    const inSpellDB = typeof window.SPELL_DB !== 'undefined' && !!window.SPELL_DB[sid];
                    if (!inSpellDB) {
                        const spellName = entry.rankString ? `${entry.name} ${entry.rankString}` : entry.name;
                        if (!castCounts[spellName]) {
                            castCounts[spellName] = { count: 0, icon: entry.icon, lowRankCount: 0 };
                        }
                        castCounts[spellName].count++;
                        // Detect low rank: if entry has topIds, check if this cast is a lower rank
                        if (entry.topIds && !entry.topIds.includes(sid)) {
                            castCounts[spellName].lowRankCount++;
                        }
                    }
                }
            }

            // ── Cast counting for melee abilities via 'damage' events ─────────
            // Heroic Strike, Cleave etc. don't generate 'cast' events in WCL
            if (ev.type === 'damage' && ev.sourceID === player.id && castIdMap[sid]) {
                const entry = castIdMap[sid];
                if (entry.trackOnDamage) {
                    const spellName = entry.name;
                    if (!castCounts[spellName]) {
                        castCounts[spellName] = { count: 0, icon: entry.icon, lowRankCount: 0 };
                    }
                    castCounts[spellName].count++;
                }
            }

            // ── trackAllCasts: count cast events for spells that also track interrupts ──
            // (e.g. Earth Shock: show all casts, and separately show kicks)
            // NOTE: Do NOT check inSpellDB here — trackAllCasts entries like Earth Shock ARE
            // in SPELL_DB as interrupts, but we still want to count all their casts here.
            if (ev.type === 'cast' && ev.sourceID === player.id) {
                const castTrackEntry = tracking.casts && tracking.casts.find(e => e.trackAllCasts && e.ids.includes(sid));
                if (castTrackEntry) {
                    const spellName = castTrackEntry.name;
                    if (!castCounts[spellName]) castCounts[spellName] = { count: 0, icon: castTrackEntry.icon, lowRankCount: 0 };
                    castCounts[spellName].count++;
                }
            }

            // ── Interrupt (kick) labeling: only counted in spells/Abilities, NOT in castCounts ──
            // (Earth Shock kicks appear in Abilities with "(kick)" label, not here)

            // ── Debuff timeline ──────────────────────────────────────────────
            // ── Debuff timeline ──────────────────────────────────────────────
            let entry = debuffIdMap[sid];
            if (!entry) return;

            // Resolve target name from actors map
            const targetId = ev.targetID;
            
            // For isCastPoint entries: allow any target (use 'Raid' as fallback)
            // For regular debuffs: skip self-buff events (targetID === player.id)
            // Exception: 'cast' events (e.g. totem drops) always use 'Raid' when there's no real target
            if (ev.type !== 'cast' && !entry.isCastPoint && targetId === player.id) return;

            let targetName;
            if (entry.isCastPoint || (ev.type === 'cast' && (!targetId || targetId === player.id))) {
                targetName = actorNameMap[targetId] || 'Raid';
            } else {
                targetName = actorNameMap[targetId] || `#${targetId}`;
            }

            const isDebuffEv = ['applydebuff', 'refreshdebuff', 'removedebuff'].includes(ev.type);
            const isPlayerSrc = ev.sourceID === player.id;

            // We accept debuff events from the player, or applydebuff events where source
            // cannot be confirmed (WCL sometimes omits sourceID on applydebuff)

            // For non-debuff events: must be from player
            if (!isDebuffEv && !isPlayerSrc) return;
            // For debuff events with a known sourceID that is NOT the player: skip
            if (isDebuffEv && ev.sourceID && ev.sourceID !== 0 && !isPlayerSrc) return;

            if (!debuffTimeline[entry.name]) {
                debuffTimeline[entry.name] = {
                    icon: entry.icon,
                    color: entry.color || '#f4b400',
                    isCastPoint: entry.isCastPoint || false,
                    alwaysOnTop: entry.alwaysOnTop || false,
                    sortOrder: entry.sortOrder != null ? entry.sortOrder : 999,
                    group: entry.group || null,
                    hideFromOverall: entry.hideFromOverall || false,
                    targets: {}
                };
            }
            const tl = debuffTimeline[entry.name];
            if (!tl.targets[targetName]) tl.targets[targetName] = [];
            const segments = tl.targets[targetName];

            if (ev.type === 'applydebuff' || ev.type === 'applybuff') {
                // isCastPoint: just store the single timestamp, no uptime bar tracking
                if (entry.isCastPoint) {
                    segments.push({ start: ev.timestamp, end: ev.timestamp, real: true, isPoint: true });
                    if (!hasRealEvents[entry.name]) hasRealEvents[entry.name] = new Set();
                    hasRealEvents[entry.name].add(targetName);
                // Normal debuff tracking
                } else {
                    // Close any open segment (re-application)
                    const open = segments.find(s => s.end === null);
                    if (open) open.end = ev.timestamp;
                    segments.push({ start: ev.timestamp, end: null, real: true });
                    if (!hasRealEvents[entry.name]) hasRealEvents[entry.name] = new Set();
                    hasRealEvents[entry.name].add(targetName);
                }

            } else if (ev.type === 'refreshdebuff' || ev.type === 'refreshbuff') {
                if (entry.isCastPoint) {
                    segments.push({ start: ev.timestamp, end: ev.timestamp, real: true, isPoint: true });
                    if (!hasRealEvents[entry.name]) hasRealEvents[entry.name] = new Set();
                    hasRealEvents[entry.name].add(targetName);
                } else {
                    const open = segments.find(s => s.end === null);
                    if (open) open.end = ev.timestamp;
                    segments.push({ start: ev.timestamp, end: null, real: true });
                    if (!hasRealEvents[entry.name]) hasRealEvents[entry.name] = new Set();
                    hasRealEvents[entry.name].add(targetName);
                }

            } else if (ev.type === 'removedebuff' || ev.type === 'removebuff') {
                if (!entry.isCastPoint) {
                    const open = segments.find(s => s.end === null);
                    if (open) open.end = ev.timestamp;
                }

            } else if (ev.type === 'cast' && isPlayerSrc) {
                if (entry.isCastPoint) {
                    // For cast-point debuffs (Earth Shock) — track exact cast moment
                    segments.push({ start: ev.timestamp, end: ev.timestamp, real: true, isPoint: true });
                    if (!hasRealEvents[entry.name]) hasRealEvents[entry.name] = new Set();
                    hasRealEvents[entry.name].add(targetName);
                } else {
                    // Cast-based fallback: creates a duration bar
                    // If this debuff belongs to a group (e.g. air-totem), close sibling debuffs' open bars first
                    if (entry.group) {
                        Object.entries(debuffTimeline).forEach(([otherName, otherDl]) => {
                            if (otherDl.group === entry.group && otherName !== entry.name) {
                                // Close any open or future-ending bar for this target in the sibling
                                Object.values(otherDl.targets).forEach(otherSegs => {
                                    otherSegs.forEach(seg => {
                                        if (seg.end > ev.timestamp) seg.end = ev.timestamp;
                                    });
                                });
                            }
                        });
                    }
                    const dur = DEBUFF_DURATION_MS[sid] || DEFAULT_DEBUFF_MS;
                    segments.push({ start: ev.timestamp, end: ev.timestamp + dur, real: false });
                }
            }
        });

        // Post-process: remove cast-based estimates if real events exist; merge overlapping segments
        const fightEnd = fightEvents.length > 0 ? fightEvents[fightEvents.length - 1].timestamp : 0;
        Object.entries(debuffTimeline).forEach(([debuffName, dl]) => {
            const realSet = hasRealEvents[debuffName] || new Set();
            Object.entries(dl.targets).forEach(([tName, segs]) => {
                if (realSet.size > 0) {
                    // Remove estimated cast-based segments globally if any real events exist
                    dl.targets[tName] = segs.filter(s => s.real !== false);
                }
                // Close any still-open segments at fight end
                dl.targets[tName].forEach(s => { if (s.end === null) s.end = fightEnd; });

                // Merge overlapping segments to prevent uptime > 100%
                const sorted = dl.targets[tName].slice().sort((a, b) => a.start - b.start);
                const merged = [];
                for (const seg of sorted) {
                    if (!merged.length || seg.start > merged[merged.length - 1].end) {
                        merged.push({ start: seg.start, end: seg.end });
                    } else {
                        // Extend the last merged segment if this one ends later
                        merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, seg.end);
                    }
                }
                dl.targets[tName] = merged;
            });
        });

    }
    // Transfer itemCasts to spells ONLY for items that already exist in spells (e.g. Sappers/Bombs that dealt damage).
    // This prevents standard consumables (Potions) from incorrectly showing up in the CDs/Abilities grid.
    Object.keys(itemCasts).forEach(id => {
        if (id === '_lastTimestamp') return;
        if (typeof window.SPELL_DB !== 'undefined' && window.SPELL_DB[id] && window.SPELL_DB[id].category === 5) {
            if (spells[id]) {
                spells[id].count += itemCasts[id];
            }
        }
    });

    return {
        combatantInfos,
        tempEnchants,
        spells,
        timelineEvents,
        deaths,
        rebirths,
        itemCasts,
        prePots,
        castCounts,
        debuffTimeline,
        targetLifespans,
        spec
    };
}

