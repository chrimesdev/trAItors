/**
 * Every tunable number lives here (implementation plan §4.6).
 * Starting values from the plan; expect to tune them in M5.
 *
 * GameState carries its own copy (state.balance) so tests and the M5
 * balancing sweep can run games with different values side by side.
 */
export const BALANCE = {
  day: {
    ticksPerDay: 6,
    actionBudget: 6,
    maxDays: 6,
    /** Win when this many (or fewer) Faithfuls remain. 1 = a final-three showdown on day 3. */
    faithfulsLeftToWin: 1,
  },
  suspicion: {
    initial: 10,
    /** First impressions: each starting score is initial ± up to this much (seeded). */
    initialJitter: 5,
    max: 100,
  },
  schedule: {
    /** Per tick, chance an NPC wanders to a room adjacent to its base schedule. */
    wanderChance: 0.25,
  },
  detection: {
    /** Chance a sneaking move inside a room with an NPC is still recorded as a sighting. */
    sneakingDetect: {
      detective: 0.7,
      paranoid: 0.6,
      sheep: 0.3,
      loyalist: 0.3,
      grudge: 0.3,
    },
    /** Override for the second, weaker detective (Rosa). */
    weakDetectiveSneakingDetect: 0.5,
    coneDegrees: 60,
    coneRangeTiles: 4,
  },
  memory: {
    /** Chance a sighting is distorted when it is remembered. */
    noise: {
      detective: 0,
      sheep: 0.5,
      grudge: 0.2,
      loyalist: 0.1,
      paranoid: 0.1,
    },
    sheepMisremberConfidence: 0.5,
    grudgeSwapConfidence: 0.8,
    paranoidInflatedConfidence: 1.5,
  },
  evidence: {
    discoverChancePerTick: 0.35,
    detectiveDiscoverChancePerTick: 0.6,
    suspicionOnDiscovery: 25,
    finderIsPlayerPenalty: 15,
    finderSawPlayerInRoomPenalty: 20,
    /** How strongly a Round Table announcement moves listeners, relative to finding it yourself. */
    announceFactor: 0.5,
    witnessedPlantPenalty: 40,
    witnessedPickUpPenalty: 10,
  },
  verbs: {
    seedDoubtStrength: 15,
    allyTrustGain: 0.4,
    paranoidAllyPenalty: 10,
    sheepMentionsBribeChance: 0.3,
    startingBribeTokens: 1,
    bribeExposedPenalty: 20,
  },
  lies: {
    contradictionPenalty: 30,
    verifiedTruthBonus: -5,
    /** Detective must have seen you this many times today to call out a false alibi. */
    alibiSightingsNeeded: 2,
  },
  rumours: {
    exchangeChance: 0.5,
    relayFactor: 0.6,
    decayPerDay: 3,
    minStrength: 3,
  },
  roundTable: {
    accuseThreshold: 25,
    speechInfluence: 8,
    accusedResentment: 10,
    defendStrength: 8,
    playerAccuseStrength: 10,
    grudgeFactor: 0.5,
    sameVoteTrustGain: 0.2,
    votedAgainstTrustLoss: -0.3,
  },
  /**
   * Pressure that finds a Traitor who does nothing, or does too much of one thing (M5).
   * Values chosen with `npm run tune`, confirmed with `npm run balance -- --games 1000`.
   */
  pressure: {
    /** Staying quiet at the Round Table: everyone notices. */
    quietPenalty: 2,
    /** Each Faithful you didn't speak to today trusts you a little less. */
    isolationPenalty: 1,
    /** The victim's top suspect (if they suspected them at least accuseThreshold) draws suspicion. */
    victimLeadPenalty: 8,
    /** Accusing someone who is banished and turns out Faithful. */
    pushedInnocentPenalty: 6,
    /** Voting for someone who is banished and turns out Faithful. */
    wrongVotePenalty: 2,
  },
  night: {
    sawPlayerInBodyRoomPenalty: 30,
    sawNpcInBodyRoomPenalty: 15,
    suspicionCapAfterNight: 80,
  },
};

export type Balance = typeof BALANCE;
