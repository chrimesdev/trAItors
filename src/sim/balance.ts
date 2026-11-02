/**
 * Every tunable number lives here (implementation plan §4.6).
 * Starting values from the plan; expect to tune them in M5.
 */
export const BALANCE = {
  day: {
    ticksPerDay: 6,
    actionBudget: 6,
    maxDays: 6,
    faithfulsLeftToWin: 2,
  },
  detection: {
    /** Chance a sneaking move inside a cone is still recorded as a sighting. */
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
  memoryNoise: {
    detective: 0,
    sheep: 0.5,
    grudge: 0.2,
    loyalist: 0.1,
    paranoid: 0.1,
  },
  evidence: {
    discoverChancePerTick: 0.35,
    detectiveDiscoverChancePerTick: 0.6,
    suspicionOnDiscovery: 25,
    finderIsPlayerPenalty: 15,
    finderSawPlayerInRoomPenalty: 20,
  },
  verbs: {
    seedDoubtStrength: 15,
    allyTrustGain: 0.4,
    paranoidAllyPenalty: 10,
    sheepMentionsBribeChance: 0.3,
  },
  lies: {
    contradictionPenalty: 30,
    verifiedTruthBonus: -5,
  },
  rumours: {
    exchangeChance: 0.5,
    relayFactor: 0.6,
    decayPerDay: 3,
    minStrength: 3,
  },
  roundTable: {
    sameVoteTrustGain: 0.2,
    votedAgainstTrustLoss: -0.3,
  },
  night: {
    sawPlayerInBodyRoomPenalty: 30,
    sawNpcInBodyRoomPenalty: 15,
    suspicionCapAfterNight: 80,
  },
} as const;

export type Balance = typeof BALANCE;
