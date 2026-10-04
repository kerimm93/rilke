const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');

function functionSource(name) {
  const pattern = new RegExp(`function\\s+${name}\\s*\\(`);
  const match = pattern.exec(html);
  assert(match, `missing function: ${name}`);
  const start = match.index;
  const open = html.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = open; i < html.length; i++) {
    const char = html[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue; }
    if (char === '{') depth++;
    if (char === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  assert.fail(`unterminated function: ${name}`);
}

const cards = [];
for (let i = 35; i >= 1; i--) {
  cards.push({
    uid: `card_${i}`,
    sid: String(i),
    text: `Kartentext ${i}`,
    comment: i === 35 ? 'Einzigartiger Kommentarfund' : '',
    parentUid: null,
    order: i,
    status: 'active'
  });
}
cards.push({uid:'archived', sid:'99', text:'Archivfund', comment:'', parentUid:null, order:99, status:'archived'});

const picker = {value:'', innerHTML:''};
const nodes = {
  'comp-card-picker': picker,
  'comp-card-search': {value:''}
};
const composition = {uid:'comp_1', title:'Test', cardUids:['card_2'], createdAt:'old', updatedAt:'old'};
let saves = 0;
const context = {
  console,
  S: {cards, compositions:[composition]},
  UI: {selectedCompositionUid:'comp_1'},
  $: id => nodes[id] || null,
  esc: value => String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  truncate: (value, length) => value && value.length > length ? value.slice(0, length) + '…' : (value || ''),
  ensureStateWritable: () => true,
  saveDebounced: () => { saves++; },
  renderCompDetail: () => {},
  renderCompPreview: () => {},
  toast: () => {},
  now: () => 'new'
};

const names = [
  'findComp', 'rootCards', 'childrenOf', 'allActiveCards', 'cardTreeOrder',
  'normalizeCrossReferenceSearch', 'fuzzySubsequenceScore',
  'crossReferenceSearchScore', 'rankCrossReferenceCards',
  'compositionPickerCards', 'renderCompCardPicker', 'addCardToComp', 'removeCompCard'
];
vm.createContext(context);
new vm.Script(names.map(functionSource).join('\n'), {filename:'index.html:composition-picker-smoke'}).runInContext(context);

const browsable = context.compositionPickerCards('');
assert.equal(browsable.length, 35, 'all active cards must remain browsable');
assert.equal(browsable[0].uid, 'card_1', 'picker must use canonical tree order');
assert.equal(browsable[34].uid, 'card_35', 'card beyond the former limit must remain reachable');
assert(!browsable.some(card => card.uid === 'archived'), 'archived cards must be excluded');

let treeCallsDuringSearch = 0;
const originalCardTreeOrder = context.cardTreeOrder;
context.cardTreeOrder = () => {
  treeCallsDuringSearch++;
  throw new Error('non-empty picker search must not build the card tree');
};
assert.equal(context.compositionPickerCards('kommentarfund')[0].uid, 'card_35', 'existing ranking must find comments beyond the former limit');
assert.equal(context.compositionPickerCards('Kartentext 35')[0].uid, 'card_35', 'existing ranking must find text beyond the former limit');
assert.equal(context.compositionPickerCards('35')[0].uid, 'card_35', 'existing ranking must find an exact SID beyond the former limit');
assert.equal(treeCallsDuringSearch, 0, 'non-empty search must bypass cardTreeOrder');
context.cardTreeOrder = originalCardTreeOrder;

context.renderCompCardPicker();
assert(picker.innerHTML.includes('data-comp-picker-uid="card_35"'), 'render must include cards beyond index 29');
assert(!picker.innerHTML.includes('data-comp-picker-uid="archived"'), 'render must exclude archived cards');
const includedButton = picker.innerHTML.match(/<button[^>]*data-comp-picker-uid="card_2"[^>]*>/)[0];
const includedMarkup = picker.innerHTML.match(/<button[^>]*data-comp-picker-uid="card_2"[^>]*>[\s\S]*?<\/button>/)[0];
assert(includedButton.includes('selected'));
assert(includedButton.includes('disabled'));
assert(!includedButton.includes('onclick='), 'included cards must not be addable again');
assert(!includedButton.includes('aria-label='), 'visible card content must provide the accessible name');
assert(includedMarkup.includes('<span class="sid">2</span>'));
assert(includedMarkup.includes('<span class="text">Kartentext 2</span>'));
assert(includedMarkup.includes('Bereits enthalten'));

const originalOrder = composition.cardUids.slice();
context.compositionPickerCards('kartentext');
assert.deepEqual(composition.cardUids, originalOrder, 'picker sorting must not change composition order');

context.addCardToComp('card_35');
assert.deepEqual(composition.cardUids, ['card_2', 'card_35'], 'add must append without sorting');
assert(picker.innerHTML.match(/<button[^>]*data-comp-picker-uid="card_35"[^>]*>/)[0].includes('disabled'), 'add must refresh selected state');

context.removeCompCard('comp_1', 1);
assert.deepEqual(composition.cardUids, ['card_2'], 'remove must preserve remaining order');
const removedButton = picker.innerHTML.match(/<button[^>]*data-comp-picker-uid="card_35"[^>]*>/)[0];
assert(!removedButton.includes('disabled'), 'remove must make the card addable again');
assert(removedButton.includes('onclick='));
assert.equal(saves, 2);

console.log('composition picker smoke tests passed');
