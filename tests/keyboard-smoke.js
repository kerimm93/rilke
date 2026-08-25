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
  section('var _modalAutofocusTimer', 'function openSettingsModal()'),
  section('function renderCards()', 'function renderCardDetail()'),
  section('function openNewCardModal(', 'function generateJitter()'),
  section('function openNewCardFromRelation(', 'function doCreateCardFromRel('),
  section('function openNewCompModal(', 'function doCreateComp('),
  section('function cardTreeOrder()', "document.addEventListener('keydown', handleGlobalKeydown);")
].join('\n');

const cards = [
  {uid:'1', sid:'1', text:'Root one', comment:'', parentUid:null, order:1, status:'active'},
  {uid:'2', sid:'2', text:'Root two', comment:'', parentUid:null, order:2, status:'active'},
  {uid:'1a', sid:'1.a', text:'Alpha child', comment:'', parentUid:'1', order:1, status:'active'},
  {uid:'1b', sid:'1.b', text:'Beta child', comment:'', parentUid:'1', order:2, status:'active'}
];
let timers = [];
let nextTimerId = 1;
let modalOpen = false;
let edited = [];
let created = [];
let createdCardCount = 0;
let detailUid = '';
let actionsUid = '';
let actionButtonToDisconnect = null;
const overlay = {dataset:{}, classList:{
  contains:()=>modalOpen,
  add:()=>{ modalOpen = true; },
  remove:()=>{ modalOpen = false; }
}};
function focusable(name) {
  return {name, nodeType:1, isConnected:true, focus(){ context.document.activeElement = this; }, closest(){ return null; }};
}
const textArea = focusable('modal textarea');
textArea.closest = selector=>selector.includes('textarea') ? textArea : null;
textArea.value = 'Card text';
const commentArea = {value:''};
const statusSelect = {value:'active'};
const titleInput = focusable('composition title');
titleInput.value = 'Composition';
let modalHtml = '';
const modalBody = {};
Object.defineProperty(modalBody, 'innerHTML', {
  get:()=>modalHtml,
  set:value=>{
    textArea.isConnected = false;
    titleInput.isConnected = false;
    modalHtml = value;
    if (/id="m-text"/.test(value)) textArea.isConnected = true;
    if (/id="m-title"/.test(value)) titleInput.isConnected = true;
  }
});
const treeItems = [];
const container = {};
let treeHtml = '';
Object.defineProperty(container, 'innerHTML', {
  get:()=>treeHtml,
  set:value=>{
    treeHtml = value;
    treeItems.forEach(item=>{ item.isConnected = false; });
    treeItems.length = 0;
    const pattern = /<div class="card-item([^"]*)" data-card-tree-uid="([^"]+)"([^>]*)>/g;
    let match;
    while ((match = pattern.exec(value))) {
      const item = {
        nodeType:1,
        isConnected:true,
        dataset:{cardTreeUid:match[2]},
        tabIndex:/tabindex="0"/.test(match[3]) ? 0 : -1,
        scrollCalls:0,
        lastScrollOptions:null,
        focus(){ context.document.activeElement = this; },
        scrollIntoView(options){ this.scrollCalls++; this.lastScrollOptions = options; },
        closest(selector){ return selector === '#cards-tree [data-card-tree-uid]' ? this : null; }
      };
      treeItems.push(item);
    }
  }
});

const context = {
  console,
  S:{cards, pairRelations:[{uid:'rel1', fromCardUid:'1', toCardUid:'2', note:''}], compositions:[]},
  UI:{tab:'cards', selectedCardUid:'', searchQuery:''},
  document:{
    activeElement:null,
    body:focusable('body'),
    querySelectorAll:()=>treeItems
  },
  setTimeout:(fn, delay)=>{ const timer = {id:nextTimerId++, fn, delay:delay || 0, cancelled:false}; timers.push(timer); return timer.id; },
  clearTimeout:id=>{ const timer = timers.find(item=>item.id === id); if (timer) timer.cancelled = true; },
  $:id=>id === 'cards-tree' ? container : id === 'modal-overlay' ? overlay : id === 'modal-body' ? modalBody : id === 'm-text' ? (textArea.isConnected ? textArea : null) : id === 'm-comment' ? commentArea : id === 'm-status' ? statusSelect : id === 'm-title' ? (titleInput.isConnected ? titleInput : null) : null,
  rootCards:()=>cards.filter(c=>!c.parentUid&&c.status!=='archived').sort((a,b)=>a.order-b.order),
  childrenOf:uid=>cards.filter(c=>c.parentUid===uid&&c.status!=='archived').sort((a,b)=>a.order-b.order),
  allActiveCards:()=>cards.filter(c=>c.status!=='archived'),
  findCard:uid=>cards.find(c=>c.uid===uid),
  esc:value=>String(value || ''),
  truncate:value=>value || '',
  renderCardDetail(){ detailUid = context.UI.selectedCardUid; },
  renderCardActions(){ actionsUid = context.UI.selectedCardUid; if (actionButtonToDisconnect) actionButtonToDisconnect.isConnected = false; },
  ensureStateWritable:()=>true,
  createCard(text, comment, parentUid){
    created.push(parentUid);
    createdCardCount++;
    const card = {uid:'new'+createdCardCount, sid:parentUid ? '1.b.1' : '3', text, comment, parentUid, order:parentUid ? context.childrenOf(parentUid).length : 99, status:'active'};
    cards.push(card);
    return card;
  },
  updateCard(uid){ edited.push(uid); return true; },
  deleteCard(uid){ const card = cards.find(item=>item.uid === uid); if (!card) return false; card.status = 'archived'; return true; },
  splitSentences(text){ return String(text).split(/(?<=[.!?])\s+/).map(part=>part.trim()).filter(Boolean); },
  toast(){}
};
vm.createContext(context);
new vm.Script(source, {filename:'index.html:keyboard-smoke'}).runInContext(context);
function flushTimers() {
  const queued = timers.sort((a,b)=>a.delay-b.delay || a.id-b.id);
  timers = [];
  queued.forEach(timer=>{ if (!timer.cancelled) timer.fn(); });
}
function key(keyName, extra={}) {
  let prevented = false;
  const event = Object.assign({
    key:keyName, target:context.document.activeElement, defaultPrevented:false, isComposing:false, keyCode:0,
    ctrlKey:false, metaKey:false, altKey:false, shiftKey:false, preventDefault(){ prevented = true; }
  }, extra);
  context.handleGlobalKeydown(event);
  return prevented;
}

// Existing collections always establish a logical and roving-tabindex entry point.
context.renderCards();
assert.equal(context.UI.selectedCardUid, '1');
assert.equal(treeItems.filter(item=>item.tabIndex === 0).length, 1);
assert.equal(treeItems.find(item=>item.tabIndex === 0).dataset.cardTreeUid, '1');

// Main-tree pointer selection focuses the replacement node created by the rerender.
assert.match(html, /data-card-tree-uid=.*onclick="selectTreeCard\(/);
const oldSelectedTreeItem = treeItems.find(item=>item.dataset.cardTreeUid === '1');
context.selectTreeCard('1a');
assert.equal(oldSelectedTreeItem.isConnected, false);
assert.equal(context.UI.selectedCardUid, '1a');
assert.equal(context.document.activeElement.isConnected, true);
assert.equal(context.document.activeElement.dataset.cardTreeUid, '1a');
assert.equal(context.document.activeElement.scrollCalls, 0);
assert.equal(key('ArrowDown'), true);
assert.equal(context.UI.selectedCardUid, '1b');

// Re-selecting the current tree card still focuses its newly rendered replacement.
const oldReselectedTreeItem = context.document.activeElement;
context.selectTreeCard('1b');
assert.equal(oldReselectedTreeItem.isConnected, false);
assert.equal(context.document.activeElement.isConnected, true);
assert.equal(context.document.activeElement.dataset.cardTreeUid, '1b');
assert.equal(key('ArrowLeft'), true);

// Non-tree selectCard callers rerender selection without pulling focus into the tree.
const detailContextElement = focusable('detail context');
detailContextElement.focus();
context.selectCard('1a');
assert.equal(context.UI.selectedCardUid, '1a');
assert.equal(context.document.activeElement, detailContextElement);
context.UI.selectedCardUid = '1';
context.renderCards();

// Navigation boundaries deliberately preserve native browser behavior.
function focusTreeUid(uid) { context.UI.selectedCardUid = uid; context.renderCards(); context.focusSelectedCardElement(); }
focusTreeUid('1a');
assert.equal(key('ArrowUp'), false);
assert.equal(context.UI.selectedCardUid, '1a');
focusTreeUid('1b');
assert.equal(key('ArrowDown'), false);
assert.equal(context.UI.selectedCardUid, '1b');
focusTreeUid('1');
assert.equal(key('ArrowLeft'), false);
assert.equal(context.UI.selectedCardUid, '1');
focusTreeUid('1b');
assert.equal(key('ArrowRight'), false);
assert.equal(context.UI.selectedCardUid, '1b');
focusTreeUid('1');
assert.equal(key('PageUp'), false);
assert.equal(context.UI.selectedCardUid, '1');
focusTreeUid('2');
assert.equal(key('PageDown'), false);
assert.equal(context.UI.selectedCardUid, '2');
focusTreeUid('1');

// Relation and composition modals share the managed overlay autofocus lifecycle.
const relationButton = focusable('relation idea button');
relationButton.focus();
context.openNewCardFromRelation('rel1');
flushTimers();
assert.equal(context.document.activeElement, textArea);
context.closeModal();
flushTimers();
assert.equal(context.document.activeElement, relationButton);
assert.equal(textArea.isConnected, false);
assert.equal(modalHtml, '');

relationButton.focus();
context.openNewCardFromRelation('rel1');
context.closeModal();
flushTimers();
assert.equal(context.document.activeElement, relationButton);
assert.notEqual(context.document.activeElement, textArea);

const compositionButton = focusable('new composition button');
compositionButton.focus();
context.openNewCompModal();
flushTimers();
assert.equal(context.document.activeElement, titleInput);
context.closeModal();
flushTimers();
assert.equal(context.document.activeElement, compositionButton);
assert.equal(titleInput.isConnected, false);
assert.equal(modalHtml, '');

compositionButton.focus();
context.openNewCompModal();
context.closeModal();
flushTimers();
assert.equal(context.document.activeElement, compositionButton);
assert.notEqual(context.document.activeElement, titleInput);

// Replacing modal A cancels its target; only modal B may autofocus.
relationButton.focus();
context.openNewCardFromRelation('rel1');
textArea.focus();
context.openNewCompModal();
assert.equal(textArea.isConnected, false);
flushTimers();
assert.equal(context.document.activeElement, titleInput);
assert.notEqual(context.document.activeElement, textArea);
context.closeModal();
flushTimers();
assert.equal(context.document.activeElement, relationButton);

// A fully closed session captures a different external opener next time.
const nextSessionButton = focusable('next modal session button');
nextSessionButton.focus();
context.openNewCompModal();
context.closeModal();
flushTimers();
assert.equal(context.document.activeElement, nextSessionButton);

// Replacement also preserves an explicit card-return intention for the open session.
context.focusSelectedCardElement();
assert.equal(key('Enter'), true);
context.openNewCompModal();
context.closeModal();
flushTimers();
assert.equal(context.document.activeElement.dataset.cardTreeUid, context.UI.selectedCardUid);

// Logical selection alone never activates tree shortcuts from body or other non-card focus.
context.document.body.focus();
const selectedBeforeBodyKeys = context.UI.selectedCardUid;
['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','PageUp','PageDown','Enter'].forEach(keyName=>assert.equal(key(keyName), false));
assert.equal(key('ArrowRight', {ctrlKey:true}), false);
assert.equal(context.UI.selectedCardUid, selectedBeforeBodyKeys);
assert.equal(modalOpen, false);
const headerElement = focusable('header');
headerElement.focus();
['ArrowDown','PageDown','Enter'].forEach(keyName=>assert.equal(key(keyName), false));
assert.equal(context.UI.selectedCardUid, selectedBeforeBodyKeys);
assert.equal(modalOpen, false);
context.UI.selectedCardUid = '2';
treeItems.find(item=>item.dataset.cardTreeUid === '1').focus();
assert.equal(key('ArrowDown'), false);
assert.equal(context.UI.selectedCardUid, '2');
context.UI.selectedCardUid = '1';
context.focusSelectedCardElement();

// General modals return to their connected opener rather than the selected card.
const settingsButton = focusable('settings');
const modalControl = focusable('generic modal control');
settingsButton.focus();
context.openModal('<p>Settings</p>');
modalControl.focus();
context.closeModal();
flushTimers();
assert.equal(context.document.activeElement, settingsButton);
assert.notEqual(context.document.activeElement, modalControl);
assert.notEqual(context.document.activeElement.dataset && context.document.activeElement.dataset.cardTreeUid, context.UI.selectedCardUid);

// A no-result search does not prevent a general modal from restoring its opener.
const emptySearchButton = focusable('empty search opener');
context.UI.searchQuery = 'no matches';
context.renderCards();
assert.equal(treeItems.length, 0);
emptySearchButton.focus();
context.openModal('<p>General modal</p>');
modalControl.focus();
context.closeModal();
flushTimers();
assert.equal(context.document.activeElement, emptySearchButton);
assert.notEqual(context.document.activeElement, modalControl);
context.UI.searchQuery = '';
context.renderCards();

// A newer modal suppresses a pending return-focus callback from the prior modal.
settingsButton.focus();
context.openModal('<p>Modal A</p>');
modalControl.focus();
context.closeModal();
const secondModalControl = focusable('second modal control');
context.openModal('<p>Modal B</p>');
secondModalControl.focus();
flushTimers();
assert.equal(modalOpen, true);
assert.equal(context.document.activeElement, secondModalControl);
context.closeModal();
flushTimers();
assert.equal(key('ArrowDown'), false);
assert.equal(key('PageDown'), false);
assert.equal(context.UI.selectedCardUid, '1');
context.focusSelectedCardElement();
assert.equal(key('ArrowDown'), true);
assert.equal(context.UI.selectedCardUid, '2');
assert.equal(key('ArrowUp'), true);
assert.equal(context.UI.selectedCardUid, '1');
assert.deepEqual(Array.from(context.cardTreeOrder(), card=>card.sid), ['1','1.a','1.b','2']);
context.UI.selectedCardUid = '1a';
context.renderCards();
context.focusSelectedCardElement();
assert.equal(key('ArrowDown'), true);
assert.equal(context.UI.selectedCardUid, '1b');
assert.equal(key('ArrowLeft'), true);
assert.equal(context.UI.selectedCardUid, '1');
assert.equal(key('ArrowRight'), true);
assert.equal(context.UI.selectedCardUid, '1a');
assert.equal(key('PageDown'), true);
assert.equal(context.UI.selectedCardUid, '1b');
assert.equal(key('PageUp'), true);
assert.equal(context.UI.selectedCardUid, '1a');

// The actual search-input render path keeps list, detail, and actions on the same visible hit.
assert.match(html, /oninput="UI\.searchQuery=this\.value;renderCards\(\)"/);
context.UI.selectedCardUid = '2';
context.UI.searchQuery = 'alpha';
context.renderCards();
assert.equal(context.UI.selectedCardUid, '1a');
assert.equal(treeItems.filter(item=>item.tabIndex === 0).length, 1);
assert.equal(treeItems.find(item=>item.tabIndex === 0).dataset.cardTreeUid, '1a');
assert.equal(detailUid, '1a');
assert.equal(actionsUid, '1a');
const searchInput = focusable('search input');
searchInput.closest = selector=>selector.includes('input') ? searchInput : null;
searchInput.focus();
assert.equal(key('ArrowDown'), false);
context.focusSelectedCardElement();
assert.equal(key('Enter'), true);
assert.deepEqual(edited, []);
flushTimers();
assert.equal(context.document.activeElement, textArea);
assert.equal(key('ArrowDown'), false);

// Escape restores focus from the edit textarea to the selected visible tree card.
assert.equal(key('Escape'), false);
flushTimers();
assert.equal(context.document.activeElement.dataset.cardTreeUid, '1a');
assert.equal(key('ArrowDown'), false); // Search still blocks structure navigation, not the form guard.

// No-result searches preserve the logical selection and render the existing empty state.
const selectionBeforeNoResults = context.UI.selectedCardUid;
context.UI.searchQuery = 'no such card';
context.renderCards();
assert.equal(context.UI.selectedCardUid, selectionBeforeNoResults);
assert.match(treeHtml, /Keine Treffer/);

// Closing edit before its delayed autofocus cancels the stale textarea focus.
context.UI.searchQuery = '';
context.renderCards();
context.focusSelectedCardElement();
assert.equal(key('Enter'), true);
assert.equal(modalOpen, true);
assert.equal(key('Escape'), false);
flushTimers();
assert.equal(modalOpen, false);
assert.notEqual(context.document.activeElement, textArea);
assert.equal(context.document.activeElement.dataset.cardTreeUid, context.UI.selectedCardUid);
assert.equal(key('PageDown'), true);

// The same cancellation contract applies when create is opened and immediately escaped.
assert.equal(key('ArrowRight', {ctrlKey:true}), true);
assert.equal(modalOpen, true);
assert.equal(overlay.dataset.cardModal, 'create');
assert.equal(key('Escape'), false);
flushTimers();
assert.equal(modalOpen, false);
assert.notEqual(context.document.activeElement, textArea);
assert.equal(context.document.activeElement.dataset.cardTreeUid, context.UI.selectedCardUid);
assert.equal(key('PageUp'), true);

// A card-create modal opened by its normal button returns to that button on cancel.
const newCardButton = focusable('new card button');
newCardButton.focus();
context.openNewCardModal();
assert.equal(modalOpen, true);
assert.equal(key('Escape'), false);
flushTimers();
assert.equal(context.document.activeElement, newCardButton);
assert.notEqual(context.document.activeElement.dataset && context.document.activeElement.dataset.cardTreeUid, context.UI.selectedCardUid);

// Edit opened from an action button keeps opener focus on cancel.
const editButton = focusable('edit action button');
editButton.focus();
context.openEditCardModal(context.UI.selectedCardUid);
flushTimers();
assert.equal(context.document.activeElement, textArea);
assert.equal(key('Escape'), false);
flushTimers();
assert.equal(context.document.activeElement, editButton);
assert.notEqual(context.document.activeElement.dataset && context.document.activeElement.dataset.cardTreeUid, context.UI.selectedCardUid);

// Successful button-originated edit ignores the disconnected rerendered opener and returns to the card.
editButton.isConnected = true;
editButton.focus();
context.openEditCardModal(context.UI.selectedCardUid);
flushTimers();
actionButtonToDisconnect = editButton;
assert.equal(key('Enter', {ctrlKey:true}), true);
flushTimers();
actionButtonToDisconnect = null;
assert.equal(editButton.isConnected, false);
assert.notEqual(context.document.activeElement, editButton);
assert.notEqual(context.document.activeElement, textArea);
assert.equal(context.document.activeElement.dataset.cardTreeUid, context.UI.selectedCardUid);
assert.equal(key('PageDown'), true);
edited.length = 0;

// Successful create from the normal button returns to the newly selected card, not its still-connected opener.
newCardButton.focus();
context.openNewCardModal();
flushTimers();
assert.equal(context.document.activeElement, textArea);
assert.equal(key('Enter', {ctrlKey:true}), true);
flushTimers();
assert.equal(context.UI.selectedCardUid, 'new1');
assert.equal(context.document.activeElement.dataset.cardTreeUid, 'new1');
assert.equal(context.document.activeElement.scrollCalls, 1);
assert.deepEqual(context.document.activeElement.lastScrollOptions, {block:'nearest'});
assert.notEqual(context.document.activeElement, newCardButton);
assert.equal(key('PageUp'), true);
created.length = 0;

// Archive cancel returns to its button; successful archive returns to the visible fallback card.
const archiveButton = focusable('archive action button');
archiveButton.focus();
context.confirmDeleteCard('2');
assert.equal(key('Escape'), false);
flushTimers();
assert.equal(context.document.activeElement, archiveButton);
assert.equal(cards.find(card=>card.uid === '2').status, 'active');

archiveButton.isConnected = true;
archiveButton.focus();
context.confirmDeleteCard('2');
actionButtonToDisconnect = archiveButton;
context.doDeleteCard('2');
flushTimers();
actionButtonToDisconnect = null;
assert.equal(archiveButton.isConnected, false);
assert.equal(cards.find(card=>card.uid === '2').status, 'archived');
assert.equal(context.UI.selectedCardUid, '1');
assert.equal(context.document.activeElement.dataset.cardTreeUid, '1');
assert.equal(context.document.activeElement.isConnected, true);
assert.equal(context.document.activeElement.scrollCalls, 1);
assert.equal(key('PageDown'), true);

// Existing sentence split keeps its data behavior and returns focus to the origin card.
const splitButton = focusable('split action button');
cards.find(card=>card.uid === '1').text = 'First sentence. Second sentence.';
focusTreeUid('1');
splitButton.focus();
context.openSplitModal('1');
assert.equal(key('Escape'), false);
flushTimers();
assert.equal(context.document.activeElement, splitButton);
assert.equal(context.childrenOf('1').length, 2);

splitButton.isConnected = true;
splitButton.focus();
context.openSplitModal('1');
actionButtonToDisconnect = splitButton;
context.doSplitCard('1');
flushTimers();
actionButtonToDisconnect = null;
const splitChildren = context.childrenOf('1');
assert.equal(splitChildren.length, 4);
assert.deepEqual(splitChildren.slice(-2).map(card=>card.text), ['First sentence.','Second sentence.']);
assert.ok(splitChildren.slice(-2).every(card=>card.parentUid === '1'));
assert.equal(splitButton.isConnected, false);
assert.equal(context.UI.selectedCardUid, '1');
assert.equal(context.document.activeElement.dataset.cardTreeUid, '1');
assert.equal(context.document.activeElement.scrollCalls, 1);
assert.equal(key('ArrowDown'), true);
created.length = 0;

// Archiving/clearing selection falls back to the first active canonical card.
cards.find(card=>card.uid === '1a').status = 'archived';
context.UI.selectedCardUid = '1a';
context.renderCards();
assert.equal(context.UI.selectedCardUid, '1');
context.UI.selectedCardUid = '';
context.renderCards();
assert.equal(context.UI.selectedCardUid, '1');

// Ctrl+Enter follows the existing edit path, renders, then restores card focus.
context.focusSelectedCardElement();
assert.equal(key('Enter'), true);
flushTimers();
assert.equal(context.document.activeElement, textArea);
assert.equal(key('Enter', {ctrlKey:true}), true);
flushTimers();
assert.equal(edited.pop(), '1');
assert.equal(context.document.activeElement.dataset.cardTreeUid, '1');
assert.equal(key('PageDown'), true);

// The create-modal submit lifecycle likewise autofocuses, submits once, and restores card focus.
assert.equal(key('ArrowRight', {ctrlKey:true}), true);
flushTimers();
assert.equal(context.document.activeElement, textArea);
assert.equal(key('Enter', {ctrlKey:true}), true);
flushTimers();
assert.equal(created.pop(), '1b');
assert.equal(created.length, 0);
assert.equal(context.UI.selectedCardUid, 'new4');
assert.equal(context.document.activeElement.dataset.cardTreeUid, 'new4');
assert.equal(context.document.activeElement.scrollCalls, 1);
assert.deepEqual(context.document.activeElement.lastScrollOptions, {block:'nearest'});
assert.equal(key('ArrowLeft'), true);

// Existing defensive guards remain effective.
const selectedBeforeGuard = context.UI.selectedCardUid;
assert.equal(key('ArrowUp', {target:textArea}), false);
assert.equal(key('ArrowUp', {isComposing:true}), false);
assert.equal(key('ArrowUp', {keyCode:229}), false);
assert.equal(context.UI.selectedCardUid, selectedBeforeGuard);

// Unrelated modals do not receive card Ctrl+Enter behavior.
modalOpen = true;
overlay.dataset = {};
assert.equal(key('Enter', {ctrlKey:true}), false);
assert.equal(created.length, 0);
assert.equal(edited.length, 0);

console.log('Keyboard focus regression smoke passed');
