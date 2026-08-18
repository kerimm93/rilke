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
  section('var _cardModalFocusTimer', 'function openSettingsModal()'),
  section('function renderCards()', 'function renderCardDetail()'),
  section('function openNewCardModal(', 'function doCreateCard('),
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
let nextTimerId = 1;
let modalOpen = false;
let edited = [];
let created = [];
let detailUid = '';
let actionsUid = '';
const overlay = {dataset:{}, classList:{
  contains:()=>modalOpen,
  add:()=>{ modalOpen = true; },
  remove:()=>{ modalOpen = false; }
}};
const textArea = {nodeType:1, focus(){ context.document.activeElement = this; }, closest(selector){ return selector.includes('textarea') ? this : null; }};
const modalBody = {innerHTML:''};
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
  setTimeout:(fn, delay)=>{ const timer = {id:nextTimerId++, fn, delay:delay || 0, cancelled:false}; timers.push(timer); return timer.id; },
  clearTimeout:id=>{ const timer = timers.find(item=>item.id === id); if (timer) timer.cancelled = true; },
  $:id=>id === 'cards-tree' ? container : id === 'modal-overlay' ? overlay : id === 'modal-body' ? modalBody : id === 'm-text' ? textArea : null,
  rootCards:()=>cards.filter(c=>!c.parentUid&&c.status!=='archived').sort((a,b)=>a.order-b.order),
  childrenOf:uid=>cards.filter(c=>c.parentUid===uid&&c.status!=='archived').sort((a,b)=>a.order-b.order),
  allActiveCards:()=>cards.filter(c=>c.status!=='archived'),
  findCard:uid=>cards.find(c=>c.uid===uid),
  esc:value=>String(value || ''),
  truncate:value=>value || '',
  renderCardDetail(){ detailUid = context.UI.selectedCardUid; },
  renderCardActions(){ actionsUid = context.UI.selectedCardUid; },
  doCreateCard(parentUid){
    created.push(parentUid);
    if (!cards.some(card=>card.uid === 'new')) cards.push({uid:'new', sid:'1.b.1', text:'New child', comment:'', parentUid, order:0, status:'active'});
    context.UI.selectedCardUid = 'new';
    context.closeModal();
    context.renderCards();
  },
  doEditCard(uid){ edited.push(uid); context.closeModal(); context.renderCards(); }
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
assert.equal(context.UI.selectedCardUid, 'new');
assert.equal(context.document.activeElement.dataset.cardTreeUid, 'new');
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
