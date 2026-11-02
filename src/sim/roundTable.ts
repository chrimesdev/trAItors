/**
 * The Round Table (plan §4.4): speeches, the player's statement, the vote and banishment.
 *
 * roundTableSpeeches() is pure and consumes no randomness, so the UI can show
 * the speeches first and then send `resolveRoundTable` with the player's choice;
 * resolving re-derives exactly the same speeches.
 */
import { foundToday, incriminatedBy } from './evidence';
import { contradictions, markContradicted } from './rumours';
import { sightingsOf } from './sightings';
import {
  addSuspicion,
  addTrust,
  aliveNpcs,
  getNpc,
  influence,
  isLiving,
  log,
  nameOf,
  rollPick,
  topSuspect,
} from './state';
import { PLAYER_ID, type GameState, type Id, type Npc, type PlayerStatement, type Speech } from './types';

export function roundTableSpeeches(s: GameState): Speech[] {
  const speeches: Speech[] = [];
  const t = s.balance.roundTable;

  for (const ev of foundToday(s)) {
    const finder = ev.foundBy as Id;
    if (ev.witnessed) {
      speeches.push({ speaker: finder, kind: 'caughtPlanting', target: PLAYER_ID, evidence: ev.id });
      continue;
    }
    const target =
      finder === PLAYER_ID
        ? ev.belongsTo && isLiving(s, ev.belongsTo)
          ? ev.belongsTo
          : undefined
        : incriminatedBy(s, ev, getNpc(s, finder), ev.foundIn as Id);
    speeches.push({
      speaker: finder,
      kind: 'evidence',
      evidence: ev.id,
      ...(target ? { target } : {}),
      ...(ev.foundIn ? { room: ev.foundIn } : {}),
    });
  }

  for (const { detective, rumour } of contradictions(s)) {
    speeches.push({ speaker: detective, kind: 'contradiction', target: PLAYER_ID, rumourId: rumour.id });
  }

  for (const n of aliveNpcs(s)) {
    if (n.exposeBribeDay === s.day) speeches.push({ speaker: n.id, kind: 'bribeExposed', target: PLAYER_ID });
  }

  for (const n of aliveNpcs(s)) {
    if (n.archetype === 'grudge' && n.lastAccusedBy && isLiving(s, n.lastAccusedBy)) {
      speeches.push({ speaker: n.id, kind: 'grudge', target: n.lastAccusedBy });
    }
    if (n.archetype === 'loyalist' && n.allyOf && isLiving(s, n.allyOf)) {
      speeches.push({ speaker: n.id, kind: 'defend', target: n.allyOf });
    }
    const exclude = n.archetype === 'loyalist' && n.allyOf ? [n.allyOf] : [];
    const top = topSuspect(s, n, exclude);
    if (top && (n.suspicion[top] ?? 0) >= t.accuseThreshold) {
      speeches.push({ speaker: n.id, kind: 'accuse', target: top });
    }
  }
  return speeches;
}

function listeners(s: GameState, speaker: Id): Npc[] {
  return aliveNpcs(s).filter((n) => n.id !== speaker);
}

function applySpeech(s: GameState, sp: Speech, defences: Record<Id, number>): void {
  const b = s.balance;
  const announce = b.evidence.announceFactor;
  const who = nameOf(s, sp.speaker);

  switch (sp.kind) {
    case 'evidence': {
      const ev = sp.evidence ? s.evidence[sp.evidence] : undefined;
      if (sp.target) {
        for (const l of listeners(s, sp.speaker)) {
          addSuspicion(
            s,
            l,
            sp.target,
            b.evidence.suspicionOnDiscovery * announce * influence(l, sp.speaker),
          );
        }
      }
      if (sp.speaker === PLAYER_ID) {
        // Provenance: the sharp ones wonder why you keep finding things.
        for (const l of aliveNpcs(s).filter(
          (n) => n.archetype === 'detective' || n.archetype === 'paranoid',
        )) {
          addSuspicion(s, l, PLAYER_ID, b.evidence.finderIsPlayerPenalty);
        }
      }
      log(
        s,
        `${who} present${sp.speaker === PLAYER_ID ? '' : 's'} the ${ev?.name ?? 'evidence'}` +
          (sp.target ? `, pointing at ${nameOf(s, sp.target)}.` : '.'),
      );
      break;
    }
    case 'caughtPlanting': {
      for (const l of listeners(s, sp.speaker)) {
        addSuspicion(s, l, PLAYER_ID, b.evidence.witnessedPlantPenalty * announce * influence(l, sp.speaker));
      }
      log(s, `${who} tells the table they saw you plant evidence.`);
      break;
    }
    case 'contradiction': {
      const rumour = s.rumours.find((r) => r.id === sp.rumourId);
      const d = getNpc(s, sp.speaker);
      addSuspicion(s, d, PLAYER_ID, b.lies.contradictionPenalty);
      for (const l of listeners(s, sp.speaker)) {
        addSuspicion(s, l, PLAYER_ID, b.lies.contradictionPenalty * announce * influence(l, sp.speaker));
      }
      if (rumour) markContradicted(s, rumour, sp.speaker);
      log(s, `${who} catches your lie about ${rumour ? nameOf(s, rumour.target) : 'someone'}.`);
      break;
    }
    case 'bribeExposed': {
      for (const l of listeners(s, sp.speaker)) {
        addSuspicion(s, l, PLAYER_ID, b.verbs.bribeExposedPenalty * influence(l, sp.speaker));
      }
      log(s, `${who} mentions you tried to buy their vote.`);
      break;
    }
    case 'accuse':
    case 'grudge': {
      const target = sp.target as Id;
      const factor = sp.kind === 'grudge' ? b.roundTable.grudgeFactor : 1;
      for (const l of listeners(s, sp.speaker)) {
        if (l.id === target) continue;
        addSuspicion(s, l, target, b.roundTable.speechInfluence * factor * influence(l, sp.speaker));
      }
      const accused = s.npcs[target];
      if (accused && accused.alive) {
        accused.lastAccusedBy = sp.speaker;
        addSuspicion(s, accused, sp.speaker, b.roundTable.accusedResentment);
      }
      log(s, `${who} ${sp.kind === 'grudge' ? 'turns on' : 'accuses'} ${nameOf(s, target)}.`);
      break;
    }
    case 'defend': {
      const target = sp.target as Id;
      for (const l of listeners(s, sp.speaker)) {
        addSuspicion(s, l, target, -b.roundTable.defendStrength * influence(l, sp.speaker));
      }
      defences[target] = (defences[target] ?? 0) + 1;
      log(s, `${who} defends ${nameOf(s, target)}.`);
      break;
    }
  }
}

function applyStatement(s: GameState, st: PlayerStatement, defences: Record<Id, number>): Speech[] {
  const b = s.balance;
  const reactions: Speech[] = [];
  if (st.kind === 'quiet') {
    log(s, 'You keep your head down.');
    return reactions;
  }
  if (st.isLie) s.player.lies.push({ day: s.day, toNpc: 'table', claim: describeStatement(s, st) });

  if (st.kind === 'accuse') {
    for (const l of listeners(s, PLAYER_ID)) {
      if (l.id === st.target) continue;
      addSuspicion(s, l, st.target, b.roundTable.playerAccuseStrength * influence(l, PLAYER_ID));
    }
    const accused = getNpc(s, st.target);
    accused.lastAccusedBy = PLAYER_ID;
    addSuspicion(s, accused, PLAYER_ID, b.roundTable.accusedResentment);
  } else if (st.kind === 'defend') {
    for (const l of listeners(s, PLAYER_ID)) {
      addSuspicion(s, l, st.target, -b.roundTable.defendStrength * influence(l, PLAYER_ID));
    }
    defences[st.target] = (defences[st.target] ?? 0) + 1;
  } else {
    // Alibi: Detectives check it against what they saw.
    const wasThere = s.player.trail.some((step) => step.day === s.day && step.room === st.room);
    for (const d of aliveNpcs(s).filter((n) => n.archetype === 'detective')) {
      const seen = sightingsOf(d, { subject: PLAYER_ID, day: s.day });
      const sawYouThere = seen.some((m) => m.room === st.room);
      if (wasThere && sawYouThere) {
        addSuspicion(s, d, PLAYER_ID, b.lies.verifiedTruthBonus);
        reactions.push({ speaker: d.id, kind: 'alibiConfirmed', target: PLAYER_ID, room: st.room });
      } else if (!wasThere && !sawYouThere && seen.length >= b.lies.alibiSightingsNeeded) {
        addSuspicion(s, d, PLAYER_ID, b.lies.contradictionPenalty);
        for (const l of listeners(s, d.id)) {
          addSuspicion(
            s,
            l,
            PLAYER_ID,
            b.lies.contradictionPenalty * b.evidence.announceFactor * influence(l, d.id),
          );
        }
        const lie = s.player.lies[s.player.lies.length - 1];
        if (st.isLie && lie) lie.contradictedBy = d.id;
        reactions.push({ speaker: d.id, kind: 'alibiDisproved', target: PLAYER_ID, room: st.room });
        log(s, `${d.name} says you were never in the ${s.rooms[st.room]?.name ?? st.room}.`);
      }
    }
  }
  log(s, `You ${describeStatement(s, st)}.`);
  return reactions;
}

function describeStatement(s: GameState, st: Exclude<PlayerStatement, { kind: 'quiet' }>): string {
  if (st.kind === 'accuse') return `accuse ${nameOf(s, st.target)}`;
  if (st.kind === 'defend') return `defend ${nameOf(s, st.target)}`;
  return `claim you were in the ${s.rooms[st.room]?.name ?? st.room}`;
}

/**
 * Each living NPC's vote, plus the player's (plan §4.4 vote resolution).
 * Order: Detectives, Grudges and Paranoids; then the player; then Loyalists;
 * then Sheep, who follow whoever is ahead.
 */
export function castVotes(s: GameState, playerVote: Id, defences: Record<Id, number> = {}): Record<Id, Id> {
  const votes: Record<Id, Id> = {};
  const alive = aliveNpcs(s);
  const valid = (voter: Npc, target: Id | undefined): target is Id =>
    target !== undefined && target !== voter.id && isLiving(s, target);

  const finalise = (n: Npc, choice: Id | undefined): void => {
    let pick = valid(n, choice) ? choice : topSuspect(s, n);
    if (pick === PLAYER_ID && n.bribedDay === s.day) pick = topSuspect(s, n, [PLAYER_ID]);
    if (pick) votes[n.id] = pick;
  };

  for (const n of alive) {
    if (n.archetype === 'detective') finalise(n, topSuspect(s, n));
    else if (n.archetype === 'grudge') finalise(n, n.lastAccusedBy);
    else if (n.archetype === 'paranoid') {
      const mostDefended = Object.entries(defences)
        .filter(([id, count]) => id !== n.id && count > 0 && isLiving(s, id))
        .sort((a, b) => b[1] - a[1])[0]?.[0];
      finalise(n, mostDefended);
    }
  }

  votes[PLAYER_ID] = playerVote;

  for (const n of alive.filter((x) => x.archetype === 'loyalist')) {
    const ally = n.allyOf && isLiving(s, n.allyOf) ? n.allyOf : undefined;
    finalise(n, ally ? votes[ally] : undefined);
  }

  for (const n of alive.filter((x) => x.archetype === 'sheep')) {
    const tally = countVotes(votes);
    delete tally[n.id];
    const max = Math.max(0, ...Object.values(tally));
    const leaders = Object.keys(tally).filter((id) => tally[id] === max);
    let choice: Id | undefined;
    if (leaders.length === 1) choice = leaders[0];
    else if (leaders.length > 1) {
      // Tie: back whichever leader they personally suspect most.
      choice = leaders.sort((a, b) => (n.suspicion[b] ?? 0) - (n.suspicion[a] ?? 0))[0];
    }
    finalise(n, choice);
  }
  return votes;
}

export function countVotes(votes: Record<Id, Id>): Record<Id, number> {
  const tally: Record<Id, number> = {};
  for (const target of Object.values(votes)) tally[target] = (tally[target] ?? 0) + 1;
  return tally;
}

/** Most votes is banished. The player loses every tie; other ties are broken by the seeded RNG. */
export function chooseBanished(s: GameState, votes: Record<Id, Id>): Id {
  const tally = countVotes(votes);
  const max = Math.max(...Object.values(tally));
  const tied = Object.keys(tally).filter((id) => tally[id] === max);
  if (tied.includes(PLAYER_ID)) return PLAYER_ID;
  return tied.length === 1 ? (tied[0] as Id) : rollPick(s, tied);
}

export function resolveRoundTable(s: GameState, playerVote: Id, statement: PlayerStatement): void {
  const b = s.balance;
  const defences: Record<Id, number> = {};
  const speeches = roundTableSpeeches(s);
  for (const sp of speeches) applySpeech(s, sp, defences);
  const reactions = applyStatement(s, statement, defences);

  const votes = castVotes(s, playerVote, defences);
  const banished = chooseBanished(s, votes);
  s.lastVote = { day: s.day, votes, banished };
  s.lastTable = { day: s.day, speeches, statement, reactions, votes, banished };
  log(
    s,
    'Votes: ' +
      Object.entries(votes)
        .map(([voter, target]) => `${nameOf(s, voter)}→${nameOf(s, target)}`)
        .join(', '),
  );

  // Shifting alliances: voting together builds trust, voting against you breaks it.
  const voters = Object.keys(votes);
  for (const a of voters) {
    for (const c of voters) {
      if (a === c || votes[a] !== votes[c]) continue;
      const npc = s.npcs[a];
      if (npc?.alive) addTrust(npc, c, b.roundTable.sameVoteTrustGain);
    }
    const target = s.npcs[votes[a] as Id];
    if (target?.alive) addTrust(target, a, b.roundTable.votedAgainstTrustLoss);
  }

  if (banished === PLAYER_ID) {
    s.outcome = 'lose';
    s.phase = 'ended';
    log(s, 'The table has spoken. You are banished. You were the Traitor.');
    return;
  }

  const out = getNpc(s, banished);
  out.alive = false;
  log(s, `${out.name} is banished. They were a Faithful.`);

  if (aliveNpcs(s).length <= b.day.faithfulsLeftToWin) {
    s.outcome = 'win';
    s.phase = 'ended';
    log(s, 'Too few Faithfuls remain to stop you. The Traitor wins.');
    return;
  }
  s.phase = 'night';
}
