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
  section('function closeModal()', 'function openSettingsModal()'),
  section('function renderCardsList()', 'function renderCardDetail()'),
  section('function openEditCardModal(', 'function doEditCard('),
  section('function cardTreeOrder()', "document.addEventListener('keydown', handleGlobalKeydown);")
].join('\n');

const cards = [
  {uid:'1', sid:'1', text:'Root one', comment:'', parentUid:null, order:1, status:'active'},
  {uid:'2', sid:'2', text:'Root two', comment:'', parentUid:null, order:2, status:'active'},
  {uid:'1a', sid:'1.a', text:'Alpha child', comment:'', parentUid:'1', order:1, status:'active'},
  {uid:'1b', sid:'1.b', text:'Beta child', comment:'', parentUid:'1', order:2, status:'active'}
];
let timers = [];
let modalOpen = false;
let edited = [];
let created = [];
const overlay = {dataset:{}, classList:{
  contains:()=>modalOpen,
  remove:()=>{ modalOpen = false; }
}};
const textArea = {nodeType:1, focus(){ context.document.activeElement = this; }, closest(selector){ return selector.includes('textarea') ? this : null; }};
const treeItems = [];
const container = {};
let treeHtml = '';
Object.defineProperty(container, 'innerHTML', {
  get:()=>treeHtml,
  set:value=>{
    treeHtml = value;
    treeItems.length = 0;
    const pattern = /<div class="card-item([^"]*)" data-card-tree-uid="([^"]+)"([^>]*)>/g;
    let match;
    while ((match = pattern.exec(value))) {
      const item = {
        nodeType:1,
        dataset:{cardTreeUid:match[2]},
        tabIndex:/tabindex="0"/.test(match[3]) ? 0 : -1,
        focus(){ context.document.activeElement = this; },
        scrollIntoView(){},
        closest(){ return null; }
      };
      treeItems.push(item);
    }
  }
});

const context = {
  console,
  S:{cards},
  UI:{tab:'cards', selectedCardUid:'', searchQuery:''},
  document:{
    activeElement:null,
    querySelectorAll:()=>treeItems
  },
  setTimeout:fn=>{ timers.push(fn); return timers.length; },
  $:id=>id === 'cards-tree' ? container : id === 'modal-overlay' ? overlay : id === 'm-text' ? textArea : null,
  rootCards:()=>cards.filter(c=>!c.parentUid&&c.status!=='archived').sort((a,b)=>a.order-b.order),
  childrenOf:uid=>cards.filter(c=>c.parentUid===uid&&c.status!=='archived').sort((a,b)=>a.order-b.order),
  allActiveCards:()=>cards.filter(c=>c.status!=='archived'),
  findCard:uid=>cards.find(c=>c.uid===uid),
  esc:value=>String(value || ''),
  truncate:value=>value || '',
  renderCards(){ context.renderCardsList(); },
  openModal(){ modalOpen = true; },
  openNewCardModal(){},
  doCreateCard(parentUid){
    created.push(parentUid);
    context.UI.selectedCardUid = '1b';
    context.closeModal();
    context.renderCards();
  },
  doEditCard(uid){ edited.push(uid); context.closeModal(); context.renderCards(); }
};
vm.createContext(context);
new vm.Script(source, {filename:'index.html:keyboard-smoke'}).runInContext(context);
function flushTimers() { const queued = timers; timers = []; queued.forEach(fn=>fn()); }
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
context.renderCardsList();
assert.equal(context.UI.selectedCardUid, '1');
assert.equal(treeItems.filter(item=>item.tabIndex === 0).length, 1);
assert.equal(treeItems.find(item=>item.tabIndex === 0).dataset.cardTreeUid, '1');
context.focusSelectedCardElement();
assert.equal(key('ArrowDown'), true);
assert.equal(context.UI.selectedCardUid, '2');
assert.equal(key('ArrowUp'), true);
assert.equal(context.UI.selectedCardUid, '1');
assert.deepEqual(Array.from(context.cardTreeOrder(), card=>card.sid), ['1','1.a','1.b','2']);
context.UI.selectedCardUid = '1a';
context.renderCardsList();
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

// Search replaces an invisible selection with its first visible hit, while structure keys stay blocked.
context.UI.selectedCardUid = '2';
context.UI.searchQuery = 'alpha';
context.renderCardsList();
assert.equal(context.UI.selectedCardUid, '1a');
assert.equal(treeItems.filter(item=>item.tabIndex === 0).length, 1);
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

// Archiving/clearing selection falls back to the first active canonical card.
context.UI.searchQuery = '';
cards.find(card=>card.uid === '1a').status = 'archived';
context.UI.selectedCardUid = '1a';
context.renderCardsList();
assert.equal(context.UI.selectedCardUid, '1');
context.UI.selectedCardUid = '';
context.renderCardsList();
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

// The create-modal submit lifecycle likewise restores focus after the new selection renders.
modalOpen = true;
overlay.dataset = {cardModal:'create', parentUid:'1'};
context.document.activeElement = textArea;
assert.equal(key('Enter', {ctrlKey:true}), true);
flushTimers();
assert.equal(created.pop(), '1');
assert.equal(context.UI.selectedCardUid, '1b');
assert.equal(context.document.activeElement.dataset.cardTreeUid, '1b');
assert.equal(key('ArrowLeft'), true);

// Existing defensive guards remain effective.
const selectedBeforeGuard = context.UI.selectedCardUid;
assert.equal(key('ArrowUp', {target:textArea}), false);
assert.equal(key('ArrowUp', {isComposing:true}), false);
assert.equal(context.UI.selectedCardUid, selectedBeforeGuard);

console.log('Keyboard focus regression smoke passed');
