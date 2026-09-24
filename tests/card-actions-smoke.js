const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');
function section(start, end) {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from);
  assert(from >= 0 && to > from, `missing source section: ${start}`);
  return html.slice(from, to);
}

const source = [
  section('function parseSid(', '// ─── PairRelation helpers'),
  section('function openNewCardModal(', 'function confirmDeleteCard(')
].join('\n');

let sequence = 0;
let saves = 0;
let clock = 0;
const editor = {value:'', selectionStart:0, selectionEnd:0, focus(){ context.focused = this; }};
const comment = {value:''};
const status = {value:'active'};
const overlay = {dataset:{cardModal:'edit', cardUid:''}};
const context = {
  console,
  S:{cards:[]},
  UI:{selectedCardUid:'', tab:'cards'},
  focused:null,
  uid:()=>`new-${++sequence}`,
  now:()=>`2026-09-02T00:00:${String(++clock).padStart(2, '0')}.000Z`,
  ensureStateWritable:()=>true,
  saveDebounced:()=>{ saves++; },
  findCard(uid){ return context.S.cards.find(card=>card.uid === uid); },
  rootCards(){ return context.S.cards.filter(card=>!card.parentUid && card.status !== 'archived').sort((a,b)=>a.order-b.order); },
  childrenOf(uid){ return context.S.cards.filter(card=>card.parentUid === uid && card.status !== 'archived').sort((a,b)=>a.order-b.order); },
  $:id=>id === 'modal-overlay' ? overlay : id === 'm-text' ? editor : id === 'm-comment' ? comment : id === 'm-status' ? status : null,
  esc:value=>String(value == null ? '' : value),
  openModal(){}, closeModal(){}, renderCards(){}, returnCardModalFocusToTree(){},
  scheduleModalAutofocus(){ context.focused = editor; }, toast(message){ context.lastToast = message; }
};
vm.createContext(context);
new vm.Script(source, {filename:'index.html:card-actions-smoke'}).runInContext(context);

function card(uid, sid, parentUid, order, text='text') {
  return {uid, sid, parentUid, order, text, comment:'', childUids:[], status:'active', createdAt:'2025-01-01T00:00:00.000Z', updatedAt:'2025-01-01T00:00:00.000Z'};
}
function reset(cards) {
  context.S.cards = cards;
  sequence = saves = clock = 0;
  context.lastToast = '';
  comment.value = '';
  status.value = 'active';
}

// Middle insertion reorders only the following sibling range and rebases its subtree.
const parent = card('p', '1', null, 0);
const a = card('a', '1.a', 'p', 0);
const b = card('b', '1.b', 'p', 1);
const c = card('c', '1.c', 'p', 2);
const descendant = card('c1', '1.c.1', 'c', 0);
const otherParent = card('q', '2', null, 1);
const otherChild = card('q1', '2.a', 'q', 0);
parent.childUids = ['a','b','c'];
c.childUids = ['c1'];
reset([parent,a,b,c,descendant,otherParent,otherChild]);
const oldA = a.updatedAt;
const oldOther = otherChild.updatedAt;
const inserted = context.insertSiblingAfter('b', ' right', 'note');
assert.equal(inserted.parentUid, 'p');
assert.equal(inserted.order, 2);
assert.equal(inserted.sid, '1.c');
assert.deepEqual(Array.from(context.childrenOf('p'), item=>item.sid), ['1.a','1.b','1.c','1.d']);
assert.equal(c.order, 3);
assert.equal(c.sid, '1.d');
assert.equal(descendant.sid, '1.d.1');
assert.equal(descendant.uid, 'c1');
assert.equal(descendant.parentUid, 'c');
assert.notEqual(c.updatedAt, '2025-01-01T00:00:00.000Z');
assert.equal(c.updatedAt, descendant.updatedAt);
assert.equal(a.updatedAt, oldA);
assert.equal(otherChild.updatedAt, oldOther);
assert.equal(parent.childUids.filter(uid=>uid === inserted.uid).length, 1);
assert.equal(saves, 1);

// Last, root, and deep insertions use the same canonical operation.
reset([card('r1','1',null,0), card('r2','2',null,1)]);
assert.equal(context.insertSiblingAfter('r2','last','').sid, '3');
assert.deepEqual(Array.from(context.rootCards(), item=>item.order), [0,1,2]);
reset([card('r1','1',null,0), card('r2','2',null,1)]);
assert.equal(context.insertSiblingAfter('r1','middle','').sid, '2');
assert.equal(context.findCard('r2').sid, '3');
reset([card('r','1',null,0), card('d','1.a','r',0), card('deep','1.a.1','d',0)]);
assert.equal(context.insertSiblingAfter('deep','deeper','').sid, '1.a.2');

// A leading historical gap is removed so the existing nextOrder contract remains collision-free.
const gapFirst = card('gap-a','1.a','gap-parent',1);
const gapSecond = card('gap-b','1.b','gap-parent',2);
const gapParent = card('gap-parent','1',null,0);
gapParent.childUids = ['gap-a','gap-b'];
reset([gapParent,gapFirst,gapSecond]);
const gapInserted = context.insertSiblingAfter('gap-a','between','');
const gapSiblings = context.childrenOf('gap-parent');
assert.deepEqual(Array.from(gapSiblings, item=>item.order), [0,1,2]);
assert.deepEqual(Array.from(gapSiblings, item=>item.sid), ['1.a','1.b','1.c']);
assert.equal(context.nextOrder('gap-parent'), 3);
assert.equal(gapSiblings.filter(item=>item.order === context.nextOrder('gap-parent')).length, 0);
assert.notEqual(gapFirst.updatedAt, '2025-01-01T00:00:00.000Z');
assert.notEqual(gapSecond.updatedAt, '2025-01-01T00:00:00.000Z');
assert.equal(gapFirst.updatedAt, gapSecond.updatedAt);
assert.equal(gapInserted.updatedAt, gapFirst.updatedAt);
assert.equal(gapParent.updatedAt, gapFirst.updatedAt);

// Invalid parent SID fails before any order, SID, freshness, membership, or persistence mutation.
const invalidParent = card('invalid-parent','not.a.sid',null,0);
const invalidA = card('invalid-a','old.a','invalid-parent',4);
const invalidB = card('invalid-b','old.b','invalid-parent',7);
invalidParent.childUids = ['invalid-a','invalid-b'];
reset([invalidParent,invalidA,invalidB]);
const invalidSnapshot = JSON.stringify(context.S);
assert.equal(context.insertSiblingAfter('invalid-a','must not exist',''), null);
assert.equal(JSON.stringify(context.S), invalidSnapshot);
assert.equal(context.S.cards.length, 3);
assert.equal(saves, 0);

function prepareSplit(raw, cursor, end=cursor) {
  editor.value = raw;
  editor.selectionStart = cursor;
  editor.selectionEnd = end;
  overlay.dataset = {cardModal:'edit', cardUid:'base'};
  context.UI.selectedCardUid = 'base';
}

// Cursor split preserves raw text exactly, commits once, and selects/edits the new card.
reset([card('base','1',null,0,'old'), card('tail','2',null,1)]);
const raw = 'Wind \n\n und Stimmen';
prepareSplit(raw, 5);
context.findCard('base').comment = 'alt';
context.findCard('base').status = 'draft';
comment.value = '  neuer Kommentar  ';
status.value = 'active';
const splitSibling = context.splitCardAtCursor('base','sibling');
assert.equal(context.findCard('base').text, raw.slice(0,5));
assert.equal(context.findCard('base').comment, 'neuer Kommentar');
assert.equal(context.findCard('base').status, 'active');
assert.equal(splitSibling.text, raw.slice(5));
assert.equal(splitSibling.comment, '');
assert.equal(splitSibling.status, 'draft');
assert.equal(context.findCard('base').updatedAt, splitSibling.updatedAt);
assert.equal(context.findCard('base').text + splitSibling.text, raw);
assert.equal(splitSibling.sid, '2');
assert.equal(context.findCard('tail').sid, '3');
assert.equal(context.UI.selectedCardUid, splitSibling.uid);
assert.equal(overlay.dataset.cardModal, 'edit');
assert.equal(overlay.dataset.cardUid, splitSibling.uid);
assert.equal(context.focused, editor);
assert.equal(saves, 1);
context.closeModal();
assert.equal(context.findCard('base').text + splitSibling.text, raw);
assert.equal(context.S.cards.length, 3);

// Split at start allows an empty existing card; child split keeps exact right text.
reset([card('base','1',null,0,'abc')]);
prepareSplit('abc', 0);
const child = context.splitCardAtCursor('base','child');
assert.equal(context.findCard('base').text, '');
assert.equal(child.text, 'abc');
assert.equal(child.parentUid, 'base');
assert.equal(child.sid, '1.a');
assert.equal(context.isDirectChildSid(context.parseSid(context.findCard('base').sid), context.parseSid(child.sid)), true);
assert.equal(context.findCard('base').childUids.filter(uid=>uid === child.uid).length, 1);
assert.equal(saves, 1);

// End/whitespace-only right sides and active selections are exact no-ops.
reset([card('base','1',null,0,'abc   ')]);
const untouched = context.findCard('base').updatedAt;
prepareSplit('abc   ', 3);
assert.equal(context.splitCardAtCursor('base','sibling'), null);
assert.equal(context.findCard('base').text, 'abc   ');
assert.equal(context.findCard('base').updatedAt, untouched);
assert.equal(context.S.cards.length, 1);
assert.equal(saves, 0);
prepareSplit('abcdef', 1, 4);
assert.equal(context.splitCardAtCursor('base','child'), null);
assert.equal(editor.selectionStart, 1);
assert.equal(editor.selectionEnd, 4);
assert.equal(context.findCard('base').updatedAt, untouched);
assert.equal(saves, 0);

// Split to sibling also rejects simultaneous archival without introducing an order gap.
const guardedSiblingBase = card('base','1',null,0,'stored sibling text');
const guardedSiblingTail = card('guarded-tail','2',null,1,'tail');
guardedSiblingBase.comment = 'stored sibling comment';
reset([guardedSiblingBase,guardedSiblingTail]);
prepareSplit('left and right', 5);
comment.value = 'unsaved sibling comment';
status.value = 'archived';
const guardedSiblingSnapshot = JSON.stringify(context.S);
const guardedSiblingSelection = [editor.selectionStart, editor.selectionEnd];
assert.equal(context.splitCardAtCursor('base','sibling'), null);
assert.equal(JSON.stringify(context.S), guardedSiblingSnapshot);
assert.equal(context.S.cards.length, 2);
assert.equal(context.findCard('base').text, 'stored sibling text');
assert.equal(context.findCard('base').comment, 'stored sibling comment');
assert.equal(context.findCard('base').status, 'active');
assert.deepEqual(context.findCard('base').childUids, []);
assert.deepEqual(Array.from(context.rootCards(), item=>item.order), [0,1]);
assert.deepEqual(Array.from(context.rootCards(), item=>item.sid), ['1','2']);
assert.equal(context.findCard('base').updatedAt, '2025-01-01T00:00:00.000Z');
assert.equal(context.nextOrder(null), 2);
assert.equal(context.rootCards().filter(item=>item.order === context.nextOrder(null)).length, 0);
assert.equal(saves, 0);
assert.equal(overlay.dataset.cardModal, 'edit');
assert.equal(overlay.dataset.cardUid, 'base');
assert.deepEqual([editor.selectionStart, editor.selectionEnd], guardedSiblingSelection);
assert.match(context.lastToast, /geteilt und archiviert/);

// Split to child cannot commit an archived parent with a new active child.
const guardedBase = card('base','1',null,0,'stored original text');
guardedBase.comment = 'stored comment';
guardedBase.status = 'active';
reset([guardedBase]);
prepareSplit('left and right', 5);
comment.value = 'unsaved comment';
status.value = 'archived';
const guardedSnapshot = JSON.stringify(context.S);
const guardedSelection = [editor.selectionStart, editor.selectionEnd];
assert.equal(context.splitCardAtCursor('base','child'), null);
assert.equal(JSON.stringify(context.S), guardedSnapshot);
assert.equal(context.findCard('base').text, 'stored original text');
assert.equal(context.findCard('base').comment, 'stored comment');
assert.equal(context.findCard('base').status, 'active');
assert.equal(context.findCard('base').updatedAt, '2025-01-01T00:00:00.000Z');
assert.deepEqual(context.findCard('base').childUids, []);
assert.equal(context.S.cards.length, 1);
assert.equal(saves, 0);
assert.equal(overlay.dataset.cardModal, 'edit');
assert.equal(overlay.dataset.cardUid, 'base');
assert.deepEqual([editor.selectionStart, editor.selectionEnd], guardedSelection);
assert.match(context.lastToast, /geteilt und archiviert/);

// The same editor state still permits child splitting when the selected status is active.
status.value = 'active';
const allowedChild = context.splitCardAtCursor('base','child');
assert.ok(allowedChild);
assert.equal(allowedChild.parentUid, 'base');
assert.equal(allowedChild.text, 'and right');
assert.equal(context.findCard('base').text, 'left ');
assert.equal(context.findCard('base').comment, 'unsaved comment');
assert.equal(context.findCard('base').status, 'active');
assert.equal(saves, 1);

// Invalid source SID blocks child split before creating a fallback root SID child.
const invalidChildBase = card('base','invalid.sid.1',null,0,'stored invalid source text');
invalidChildBase.comment = 'stored invalid comment';
reset([invalidChildBase]);
prepareSplit('left and right', 5);
comment.value = 'unsaved invalid comment';
status.value = 'active';
const invalidChildSnapshot = JSON.stringify(context.S);
const invalidChildSelection = [editor.selectionStart, editor.selectionEnd];
assert.equal(context.splitCardAtCursor('base','child'), null);
assert.equal(JSON.stringify(context.S), invalidChildSnapshot);
assert.equal(context.findCard('base').text, 'stored invalid source text');
assert.equal(context.findCard('base').comment, 'stored invalid comment');
assert.equal(context.findCard('base').status, 'active');
assert.equal(context.findCard('base').updatedAt, '2025-01-01T00:00:00.000Z');
assert.deepEqual(context.findCard('base').childUids, []);
assert.equal(context.S.cards.length, 1);
assert.equal(saves, 0);
assert.equal(overlay.dataset.cardModal, 'edit');
assert.equal(overlay.dataset.cardUid, 'base');
assert.deepEqual([editor.selectionStart, editor.selectionEnd], invalidChildSelection);
assert.match(context.lastToast, /Karten-ID ist ungültig/);

// A failed sibling split leaves the complete editor-backed source card untouched.
const splitInvalidParent = card('split-parent','invalid',null,0);
const splitBase = card('base','legacy-child','split-parent',5,'original complete text');
splitBase.comment = 'stored comment';
splitBase.status = 'draft';
splitInvalidParent.childUids = ['base'];
reset([splitInvalidParent,splitBase]);
prepareSplit('edited left and right', 11);
comment.value = 'unsaved comment';
status.value = 'archived';
const failedSplitSnapshot = JSON.stringify(context.S);
assert.equal(context.splitCardAtCursor('base','sibling'), null);
assert.equal(JSON.stringify(context.S), failedSplitSnapshot);
assert.equal(context.S.cards.length, 2);
assert.equal(saves, 0);

assert.match(html, /function splitSentences\(/);
assert.match(html, /function doSplitCard\(/);
console.log('Relative card actions and cursor split smoke passed');
