/**
 * Public surface of the simulation. Presentation code (src/phaser, src/ui)
 * imports from here only.
 */
export * from './types';
export * from './rng';
export { BALANCE, type Balance } from './balance';
export { createGame, applyCommand, validateCommand, legalCommands, InvalidCommandError } from './game';
export { roundTableSpeeches, castVotes, countVotes } from './roundTable';
export { recordSighting } from './sightings';
export { npcRoomOf, playerRoomAt, playerSawToday, roomsPlayerVisitedToday } from './queries';
export { carefulBot, idleBot, naiveBot, scapegoat, type Bot } from './bots';
export { speak, greet, reply, narrate } from './dialogue';
export { rumourText, whispersSince } from './rumours';
export { watchingYou, isWary } from './tells';
