const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('// ─── PairRelation helpers');
const end = html.indexOf('// ─── Composition helpers', start);
assert(start >= 0 && end > start, 'missing PairRelation helper section');
function section(sectionStart, sectionEnd) {
  const from = html.indexOf(sectionStart);
  const to = html.indexOf(sectionEnd, from);
  assert(from >= 0 && to > from, `missing source section: ${sectionStart}`);
  return html.slice(from, to);
}

let sequence = 0;
let saves = 0;
const context = {
  S:{cards:[], pairRelations:[]},
  uid:()=>`relation-${++sequence}`,
  now:()=>`2026-09-29T00:00:0${sequence}.000Z`,
  findCard(uid){ return context.S.cards.find(card=>card.uid === uid); },
  ensureStateWritable:()=>true,
  saveDebounced:()=>{ saves++; },
  toast(message){ context.lastToast = message; },
  validIso(value){ return typeof value === 'string' && !Number.isNaN(Date.parse(value)); },
  getObjectFreshness(item){
    if (item && context.validIso(item.updatedAt)) return Date.parse(item.updatedAt);
    if (item && context.validIso(item.createdAt)) return Date.parse(item.createdAt);
    return null;
  }
};
vm.createContext(context);
new vm.Script([
  html.slice(start, end),
  section('function dedupeManualPairRelations(', 'function compareCardsForSidRepair(')
].join('\n'), {filename:'index.html:relations-smoke'}).runInContext(context);

function card(uid, sid, text, comment='', status='active') {
  return {uid, sid, text, comment, status};
}

const a = card('a', '1', 'Nacht am Fluss');
const b = card('b', '2', 'Leise Sterne', 'Heller Nachthimmel');
const archived = card('old', '3', 'Archiv', '', 'archived');
context.S.cards = [a, b, archived];

assert.equal(context.createManualCrossReference('a', 'a'), null);
assert.equal(context.createManualCrossReference('a', 'missing'), null);
assert.equal(context.createManualCrossReference('a', 'old'), null);
assert.equal(context.S.pairRelations.length, 0);
assert.equal(saves, 0);

const relation = context.createManualCrossReference('a', 'b');
assert(relation);
assert.equal(relation.origin, 'manual');
assert.equal(relation.positionType, '');
assert.equal(context.S.pairRelations.length, 1);
assert.equal(saves, 1);
assert.strictEqual(context.createManualCrossReference('a', 'b'), relation);
assert.strictEqual(context.createManualCrossReference('b', 'a'), relation);
assert.equal(context.S.pairRelations.length, 1);
assert.equal(saves, 1);
assert.equal(context.lastToast, 'Verweis besteht bereits');

assert.deepEqual(Array.from(context.manualOutgoingRelationsForCard('a')), [relation]);
assert.deepEqual(Array.from(context.manualIncomingRelationsForCard('b')), [relation]);
context.S.pairRelations.push({uid:'brain', fromCardUid:'a', toCardUid:'b', origin:'brainstorm', positionType:'rechts'});
assert.equal(context.manualOutgoingRelationsForCard('a').length, 1);
assert.equal(context.manualIncomingRelationsForCard('b').length, 1);
assert.deepEqual(Array.from(context.brainstormRelationsForCard('a'), item=>item.uid), ['brain']);
assert.equal(context.brainstormRelationsForCard('b').length, 0);

const searchCards = [
  card('exact', '7', 'Nacht'),
  card('partial', '8', 'Eine lange Nacht am Fluss'),
  card('fuzzy', '9', 'Nächtliche Sterne'),
  card('comment', '10', 'Leise', 'Dunkle Nacht')
];
assert(context.crossReferenceSearchScore('fluss', searchCards[1]) > 0);
assert(context.crossReferenceSearchScore('ncht', searchCards[0]) > 0);
const ranked = context.rankCrossReferenceCards('nacht', searchCards);
assert.equal(ranked[0].card.uid, 'exact');
assert(ranked.some(result=>result.card.uid === 'comment'));
assert.equal(context.rankCrossReferenceCards('7', searchCards)[0].card.uid, 'exact');

function manual(uid, from, to, updatedAt) {
  return {uid, fromCardUid:from, toCardUid:to, origin:'manual', createdAt:updatedAt, updatedAt};
}
const older = manual('r-local', 'a', 'b', '2026-09-01T00:00:00.000Z');
const newer = manual('r-remote', 'b', 'a', '2026-09-02T00:00:00.000Z');
const sameDirection = manual('r-same', 'a', 'b', '2026-08-31T00:00:00.000Z');
const otherPair = manual('r-other', 'a', 'c', '2026-09-03T00:00:00.000Z');
const brainstorm = {uid:'r-brainstorm', fromCardUid:'a', toCardUid:'b', origin:'brainstorm', updatedAt:'2026-09-04T00:00:00.000Z'};
const existingTombstone = '2099-01-01T00:00:00.000Z';
function dedupeInOrder(relations) {
  const state = {pairRelations:relations.slice(), deletedIds:{'r-local':existingTombstone}};
  assert.equal(context.dedupeManualPairRelations(state), true);
  return state;
}
const merged = dedupeInOrder([older, newer, sameDirection, otherPair, brainstorm]);
const reversed = dedupeInOrder([brainstorm, otherPair, sameDirection, newer, older]);
assert.deepEqual(Array.from(merged.pairRelations, relation=>relation.uid), ['r-remote', 'r-other', 'r-brainstorm']);
assert.deepEqual(Array.from(reversed.pairRelations, relation=>relation.uid).sort(), ['r-brainstorm', 'r-other', 'r-remote']);
assert.equal(merged.deletedIds['r-local'], existingTombstone);
assert(Date.parse(merged.deletedIds['r-same']) >= Date.parse(sameDirection.updatedAt));
assert.equal(context.dedupeManualPairRelations(merged), false);
assert.deepEqual(Array.from(merged.pairRelations, relation=>relation.uid), ['r-remote', 'r-other', 'r-brainstorm']);

const tiedFirst = manual('r-a', 'a', 'b', '2026-09-05T00:00:00.000Z');
const tiedSecond = manual('r-z', 'b', 'a', '2026-09-05T00:00:00.000Z');
const tiedState = {pairRelations:[tiedSecond, tiedFirst], deletedIds:{}};
context.dedupeManualPairRelations(tiedState);
assert.equal(tiedState.pairRelations[0].uid, 'r-a');
assert(tiedState.deletedIds['r-z']);

assert.match(html, /function runSyncCandidateMaintenance\(candidate\)[\s\S]*dedupeManualPairRelations\(candidate\)/);
assert.match(html, /function runLocalRecoveryMaintenance\(\)[\s\S]*dedupeManualPairRelations\(\)/);

assert.match(html, />\+ Verweis hinzufügen</);
assert.match(html, /<div class="detail-label">Querverweise<\/div>/);
assert.match(html, /<div class="detail-label">Brainstorm-Verbindungen<\/div>/);

console.log('relations smoke: ok');
