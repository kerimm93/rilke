const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('index.html', 'utf8');

// Extract top-level declarations without evaluating app startup or persistence.
function functionSource(name) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(html);
  assert(match, `missing function: ${name}`);
  const next = html.slice(match.index + 1).search(/\n(?:async )?function\s+/);
  const candidate = next < 0 ? html.slice(match.index) : html.slice(match.index, match.index + 1 + next);
  // Some declarations are followed by globals: stop at the function's closing line.
  const end = candidate.indexOf('\n}');
  if (end >= 0) return candidate.slice(0, end + 2);
  return candidate.split('\n')[0];
}

const nodes = {};
let context;
class Element {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.style = {};
    this.attributes = {};
    this.listeners = {};
    this.textContent = '';
    this.className = '';
    this.classList = {toggle: (name, enabled) => { this.attributes[name] = enabled; }};
  }
  appendChild(child) { this.children.push(child); return child; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  click() { this.listeners.click(); }
  focus() { context.document.activeElement = this; }
  set innerHTML(value) {
    this.markup = value;
    this.children = [];
    if (this === nodes['card-detail-content']) {
      delete nodes['card-composition-backlinks'];
      if (value.includes('id="card-composition-backlinks"')) {
        const anchor = new Element();
        nodes['card-composition-backlinks'] = anchor;
        this.appendChild(anchor);
      }
    }
    if (this === nodes['comp-detail']) {
      delete nodes['comp-detail-title'];
      const title = value.match(/<h2 id="comp-detail-title" tabindex="(-?\d+)"[^>]*>(.*?)<\/h2>/);
      if (title) {
        const heading = new Element('h2');
        heading.attributes.tabindex = title[1];
        heading.textContent = title[2];
        nodes['comp-detail-title'] = heading;
        this.appendChild(heading);
      }
    }
  }
  get innerHTML() { return this.markup || ''; }
  closest(selector) { return this.tagName === 'BUTTON' && selector.includes('button') ? this : null; }
  get nodeType() { return 1; }
}
['cards-empty', 'card-detail-content', 'comp-list', 'comp-detail', 'comp-preview',
 'view-cards', 'view-brainstorm', 'view-composition', 'card-search'].forEach(id => { nodes[id] = new Element(); });
const tabs = ['Karten', 'Brainstorm', 'Komposition'].map(text => { const tab = new Element('button'); tab.textContent = text; return tab; });
let saves = 0;
let compositionRenders = 0;
const escapeText = value => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
context = {
  S: {}, UI: {tab:'cards', selectedCardUid:'card', selectedCompositionUid:'', searchQuery:'keep filter'},
  document: {createElement: tag => new Element(tag), querySelectorAll: () => tabs, activeElement:null},
  $: id => nodes[id] || null,
  esc: escapeText,
  ensureStateWritable: () => true,
  save: () => { saves++; }, saveDebounced: () => { saves++; },
  now: () => '2026-10-11T00:00:00.000Z', closeModal(){}, toast(){},
  renderCompCardPicker(){}, renderCardsList(){}, renderCardActions(){},
  renderBrainstorm(){}, shuffleBrainstorm(){}, brainstormOrder:[],
};
vm.createContext(context);
const names = ['findCard', 'findComp', 'compositionsForCard', 'compositionDisplayTitle',
  'openCompositionFromCard', 'renderCompositionBacklinks', 'renderCardDetail', 'renderCards',
  'switchTab', 'renderComposition', 'renderCompList', 'renderCompDetail', 'renderCompPreview',
  'addCardToComp', 'removeCompCard', 'doEditComp', 'doDeleteComp', 'isKeyboardFormControl'];
new vm.Script(names.map(functionSource).join('\n'), {filename:'index.html:composition-backlinks-smoke'}).runInContext(context);
const renderComposition = context.renderComposition;
context.renderComposition = () => { compositionRenders++; renderComposition(); };
function composition(uid, title, cardUids = ['card']) {
  return {uid, title, cardUids, createdAt:'2026-01-01T00:00:00.000Z', updatedAt:'2026-02-01T00:00:00.000Z'};
}
function reset(compositions = []) {
  context.S = {
    cards:[{uid:'card', sid:'1', text:'Gedicht', comment:'Kommentar', status:'active', parentUid:null, order:0}],
    compositions, deletedIds:{old:'2026-01-01T00:00:00.000Z'}, pairRelations:[],
    _syncMeta:{fingerprint:'unchanged'}
  };
  context.UI.tab = 'cards';
  context.UI.selectedCardUid = 'card';
  context.UI.selectedCompositionUid = '';
  context.UI.searchQuery = 'keep filter';
  nodes['card-search'].value = 'keep filter';
  saves = compositionRenders = 0;
}
function buttons() { return (nodes['card-composition-backlinks']?.children || []).filter(node => node.tagName === 'BUTTON'); }
function renderUnchanged() {
  const before = JSON.stringify(context.S);
  const saved = saves;
  context.renderCardDetail();
  assert.equal(JSON.stringify(context.S), before, 'render must preserve all state and metadata');
  assert.equal(saves, saved, 'render must not save');
}
reset();
renderUnchanged();
assert.equal(nodes['card-composition-backlinks'], undefined);

const a = composition('a', 'Gedichtentwurf A', ['card','card']);
const b = composition('b', 'Gedichtentwurf B');
reset([a]);
renderUnchanged();
assert.equal(buttons().length, 1);
reset([b, composition('other', 'Andere', ['different']), a]);
renderUnchanged();
assert.deepEqual(Array.from(context.compositionsForCard('card'), comp => comp.uid), ['b','a']);
assert.deepEqual(buttons().map(button => button.textContent), ['↗ Gedichtentwurf B','↗ Gedichtentwurf A']);
assert.equal(nodes['card-composition-backlinks'].children[0].textContent, 'Verwendet in');
const detailMarkup = nodes['card-detail-content'].innerHTML;
assert(detailMarkup.indexOf('Kommentar') < detailMarkup.indexOf('card-composition-backlinks'));
assert(detailMarkup.indexOf('card-composition-backlinks') < detailMarkup.indexOf('>Status<'));
renderUnchanged();
assert.equal(buttons().length, 2, 'rerender must replace rather than duplicate buttons');
buttons().forEach(button => {
  assert.equal(button.type, 'button');
  assert.equal(button.attributes.onclick, undefined);
  assert.equal(context.isKeyboardFormControl(button), true, 'native button must be protected by existing keyboard guard');
});
assert.equal(buttons()[1].attributes['aria-label'], 'Komposition Gedichtentwurf A öffnen');
const stateBeforeNavigation = JSON.stringify(context.S);
buttons()[1].click();
assert.equal(context.UI.selectedCompositionUid, 'a');
assert.equal(context.UI.tab, 'composition');
assert.equal(nodes['view-composition'].style.display, 'flex');
assert.equal(nodes['view-cards'].style.display, 'none');
assert.equal(tabs[2].attributes.active, true);
assert(nodes['comp-list'].innerHTML.includes('class="comp-item selected" onclick="selectComp(\'a\')"'));
assert.equal(nodes['comp-detail-title'].textContent, 'Gedichtentwurf A');
assert.equal(nodes['comp-detail-title'].tagName, 'H2');
assert.equal(nodes['comp-detail-title'].attributes.tabindex, '-1');
assert.strictEqual(context.document.activeElement, nodes['comp-detail-title']);
assert.equal(compositionRenders, 1);
assert.equal(context.UI.selectedCardUid, 'card');
assert.equal(context.UI.searchQuery, 'keep filter');
assert.equal(nodes['card-search'].value, 'keep filter');
assert.equal(JSON.stringify(context.S), stateBeforeNavigation);
assert.equal(saves, 0);

// Exercise existing mutations, then the actual tab-return path.
nodes['m-title'] = {value:'Neuer Titel'};
context.doEditComp('a');
context.switchTab('cards');
assert.equal(buttons()[1].textContent, '↗ Neuer Titel');
context.UI.selectedCompositionUid = 'b';
context.switchTab('composition');
context.removeCompCard('b', 0);
context.switchTab('cards');
assert.deepEqual(buttons().map(button => button.textContent), ['↗ Neuer Titel']);
context.switchTab('composition');
context.addCardToComp('card');
context.switchTab('cards');
assert.equal(buttons().length, 2);
context.switchTab('composition');
context.doDeleteComp('a');
context.switchTab('cards');
assert.deepEqual(buttons().map(button => button.textContent), ['↗ Gedichtentwurf B']);
assert.equal(context.S.deletedIds.a, context.now());
assert.equal(saves, 4, 'only existing CRUD actions save');

// Historical input is ignored or displayed without repair.
reset([null, {}, {uid:'no-array', title:'No array'}, composition('invalid', 'Invalid', 'card'),
  composition('null-array', 'Null', null), composition('empty', ''),
  composition('no-title', undefined), composition('wrong-title', 42), composition('spaces', '   ')]);
renderUnchanged();
assert.equal(buttons().length, 4);
assert(buttons().every(button => button.textContent === '↗ Unbenannte Komposition'));
assert.equal(buttons()[0].attributes['aria-label'], 'Komposition Unbenannte Komposition öffnen');
assert.equal(Object.hasOwn(context.S.compositions[2], 'cardUids'), false);

const specialTitle = '<img src=x onerror="attack()"> & \' " >';
const specialUid = `comp_'\"; globalThis.attacked = true; //`;
reset([composition(specialUid, specialTitle)]);
renderUnchanged();
assert.equal(buttons()[0].textContent, '↗ ' + specialTitle);
assert.equal(buttons()[0].children.length, 0, 'title must remain text, not markup');
assert.equal(buttons()[0].attributes['aria-label'], 'Komposition ' + specialTitle + ' öffnen');
const specialBefore = JSON.stringify(context.S);
buttons()[0].click();
assert.equal(context.UI.selectedCompositionUid, specialUid);
assert.equal(context.attacked, undefined);
assert.equal(JSON.stringify(context.S), specialBefore);
assert.equal(saves, 0);
assert.equal(nodes['comp-detail-title'].textContent, escapeText(specialTitle));

context.switchTab('cards');
const staleButton = buttons()[0];
context.S.compositions = [];
const uiBefore = JSON.stringify(context.UI);
const rendersBefore = compositionRenders;
staleButton.click();
assert.equal(JSON.stringify(context.UI), uiBefore, 'missing target must leave navigation unchanged');
assert.equal(compositionRenders, rendersBefore);
assert.equal(saves, 0);
renderUnchanged();
assert.equal(nodes['card-composition-backlinks'], undefined);

reset([composition('a','Persistiert'), composition('b','Zweiter')]);
renderUnchanged();
const expected = buttons().map(button => button.textContent);
const original = JSON.stringify(context.S);
context.S = JSON.parse(original);
context.switchTab('cards');
assert.deepEqual(buttons().map(button => button.textContent), expected);
assert.equal(JSON.stringify(context.S), original, 'JSON roundtrip must need no new backlink fields');
assert.equal(saves, 0);
// Equivalent to the existing sync adoption's current-tab rendering after replacement.
context.S = JSON.parse(original);
context.S.compositions[0].title = 'Remote-Titel';
context.switchTab(context.UI.tab);
assert.equal(buttons()[0].textContent, '↗ Remote-Titel');
console.log('composition backlinks smoke tests passed');
