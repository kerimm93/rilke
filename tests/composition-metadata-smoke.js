const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
function source(name) {
  const match = new RegExp(`(?:async )?function ${name}\\(`).exec(html);
  assert(match, name);
  const end = html.indexOf('\n}', match.index);
  return html.slice(match.index, end + 2);
}
const nodes = {};
const messages = [];
let writes = [], failed = false, release = null, closes = 0, debounced = 0, clock = 0;
const context = {
  console, S:{}, UI:{tab:'composition',selectedCardUid:'card',selectedCompositionUid:'a',searchQuery:''},
  _modalReturnFocusElement:null, _compositionMetadataSaving:false, _storageWriteError:false, _persistenceReady:true,
  _storageReadOnly:false, _storageBackend:'indexeddb', _syncInProgress:false, _saveTimer:null,
  _writeQueue:Promise.resolve(), _lastStorageError:null, _legacyConflictDetected:false,
  setTimeout, clearTimeout,
  now:()=>new Date(Date.UTC(2026,9,12,0,0,++clock)).toISOString(), uid:()=>String(clock++),
  $:id=>nodes[id] || null,
  toast:message=>messages.push(message),
  recordCommittedState(){},
  notifySaveError(){ context._storageWriteError=true; },
  idbSetState:async snapshot=> {
    writes.push(JSON.parse(JSON.stringify(snapshot)));
    if (release) await new Promise(resolve=>{ release=resolve; });
    if (failed) throw new Error('simulated IndexedDB failure');
  },
  closeModal(){ closes++; }, renderComposition(){}, scheduleModalAutofocus(){},
  renderCompDetail(){}, renderCompPreview(){}, renderCompCardPicker(){},
  openModal(markup){ nodes['modal-body']={innerHTML:markup}; },
  document:{querySelectorAll:()=>[]},
  esc:value=>String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),
  truncate:(text,n)=>String(text || '').slice(0,n),
};
vm.createContext(context);
const names = ['compositionDisplayTitle','compositionNote','isCompositionStatus','compositionStatus','compositionStatusLabel',
  'compositionUsageLookup','compositionUsageDescription','refreshCompositionCardUsage','refreshCompositionMetadataViews','renderCompList',
  'persistCompositionMetadata','doEditComp','changeCompositionStatus','doCreateComp',
  'openEditCompModal','renderCompDetail','renderCardsList','renderCardTree','cardItemHtml',
  'rootCards','childrenOf','allActiveCards','cardTreeOrder','findComp','findCard',
  'ensureStateWritable','isStateWritable','save','enqueueStateWrite','cloneState',
  'isCredentialKey','sanitizeBackupValue','buildBackupSnapshotFromState',
  'addCardToComp','removeCompCard','doDeleteComp'];
// One-line declarations cannot use the multiline closing-line extractor.
const oneLine = new Set(['findComp','findCard','rootCards','childrenOf','allActiveCards']);
const code = names.map(name=>oneLine.has(name) ? html.match(new RegExp(`function ${name}\\([^\\n]+`))[0] : source(name)).join('\n');
new vm.Script(code).runInContext(context);
context.saveDebounced=()=>{debounced++;};
function reset() {
  context.S={cards:[{uid:'card',sid:'1',text:'Fenster',comment:'',status:'active',parentUid:null,order:0}],
    compositions:[{uid:'a',title:'Gedicht',cardUids:['card'],createdAt:'2026-01-01T00:00:00.000Z'},
      {uid:'b',title:'Anderes',cardUids:[]}],pairRelations:[],deletedIds:{},config:{},_lastExported:''};
  context.UI.tab='composition'; context.UI.searchQuery=''; context.UI.selectedCompositionUid='a';
  nodes['m-title']={value:'Gedicht'}; nodes['m-comp-note']={value:''};
  nodes['comp-save']={disabled:false,addEventListener(){}}; nodes['comp-save-feedback']={textContent:''};
  nodes['comp-list']={innerHTML:''};
  nodes['comp-detail']={innerHTML:'',querySelectorAll:()=>[]}; nodes['cards-tree']={innerHTML:''};
  context._storageWriteError=false; context._storageReadOnly=false; context._syncInProgress=false;
  writes=[]; messages.length=0; closes=0; debounced=0; failed=false;
}
(async()=>{
  reset();
  const before=JSON.stringify(context.S);
  context.openEditCompModal('a');
  assert.equal(nodes['m-comp-note'].value,'');
  context.renderCompDetail();
  assert.equal(JSON.stringify(context.S),before,'legacy rendering must not mutate');
  await context.doEditComp('a');
  assert.equal(JSON.stringify(context.S),before);
  assert.equal(writes.length,0,'legacy unchanged save must not persist defaults');
  assert(!Object.hasOwn(context.S.compositions[0],'note'));
  assert(!Object.hasOwn(context.S.compositions[0],'status'));
  const control={value:'draft'};
  await context.changeCompositionStatus('a',control);
  assert.equal(JSON.stringify(context.S),before); assert.equal(writes.length,0);

  const note='  Übergang prüfen.\n\nVielleicht das Fenster-Motiv wiederholen.\n<script>alert("test")</script>  ';
  nodes['m-comp-note'].value=note;
  messages.length=0;
  release=true;
  const saving=context.doEditComp('a');
  await Promise.resolve(); await Promise.resolve();
  assert(!messages.includes('Komposition gespeichert'),'no success before IndexedDB completion');
  assert.equal(closes,1,'only the earlier no-op closed a modal');
  assert.equal(context.ensureStateWritable(),false,'other mutations blocked while saving');
  assert.equal(nodes['m-comp-note'].readOnly,true);
  release(); release=null;
  await saving;
  assert.equal(context.S.compositions[0].note,note);
  assert.equal(writes.at(-1).compositions[0].note,note);
  assert(context.S.compositions[0].updatedAt);
  assert.equal(context.S._lastExported,writes.at(-1)._lastExported);
  assert.equal(context.S._lastExported,new Date(Date.UTC(2026,9,12,0,0,clock)).toISOString());
  assert(!Object.hasOwn(context.S.compositions[0],'status'),'note edit must not materialize status');
  context.renderCompDetail();
  assert(nodes['comp-detail'].innerHTML.includes('&lt;script&gt;alert("test")&lt;/script&gt;'));
  assert(!nodes['comp-detail'].innerHTML.includes('<script>'));
  context.openEditCompModal('a'); assert.equal(nodes['m-comp-note'].value,note);
  const count=writes.length, timestamp=context.S.compositions[0].updatedAt;
  await context.doEditComp('a'); assert.equal(writes.length,count); assert.equal(context.S.compositions[0].updatedAt,timestamp);
  nodes['m-comp-note'].value=''; await context.doEditComp('a'); assert.equal(context.S.compositions[0].note,'');
  assert.equal(context.S.compositions[1].note,undefined,'notes remain independent');

  reset(); const legacy=JSON.stringify(context.S.compositions[0]);
  context.S._lastExported='2026-01-01T00:00:00.000Z';
  const failedWriteTimestamp=context.S._lastExported;
  failed=true; nodes['m-comp-note'].value=note;
  await context.doEditComp('a');
  assert.equal(JSON.stringify(context.S.compositions[0]),legacy,'failed save restores entity including field absence');
  assert.equal(nodes['m-comp-note'].value,note); assert.equal(nodes['m-comp-note'].readOnly,false);
  assert.equal(closes,0); assert(!messages.includes('Komposition gespeichert'));
  assert.match(nodes['comp-save-feedback'].textContent,/Nicht gespeichert/);
  assert.equal(context._storageWriteError,true);
  assert.equal(context.S._lastExported,failedWriteTimestamp,'failed metadata write must restore state timestamp');
  const writesBeforeRecovery=writes.length;
  await context.doEditComp('a'); // Recovery write fails again before metadata mutation.
  assert.equal(writes.length,writesBeforeRecovery+1,'retry must attempt exactly the recovery write');
  assert.equal(context.S._lastExported,failedWriteTimestamp,'failed recovery write must restore state timestamp');
  assert.equal(JSON.stringify(context.S.compositions[0]),legacy);
  assert.equal(nodes['m-comp-note'].value,note);
  assert.equal(closes,0); assert(!messages.includes('Komposition gespeichert'));
  assert.equal(context._storageWriteError,true);
  failed=false;
  await context.doEditComp('a');
  assert.equal(context.S.compositions[0].note,note);
  assert.equal(writes.at(-1).compositions[0].note,note);
  assert.equal(context._storageWriteError,false);
  assert.equal(context.S._lastExported,writes.at(-1)._lastExported);
  assert.equal(context.S._lastExported,new Date(Date.UTC(2026,9,12,0,0,clock)).toISOString(),'successful write retains current timestamp');
  assert.notEqual(context.S._lastExported,failedWriteTimestamp);
  assert(Date.parse(writes.at(-2)._lastExported)>Date.parse(failedWriteTimestamp),'successful recovery write also gets current timestamp');
  assert.equal(closes,1);

  // If recovery succeeds but the following metadata write fails, retain recovery's timestamp.
  reset();
  context.S._lastExported=failedWriteTimestamp;
  context._storageWriteError=true;
  nodes['m-comp-note'].value=note;
  const originalWriter=context.idbSetState;
  let retryWrites=0;
  context.idbSetState=async snapshot=>{failed=++retryWrites===2; return originalWriter(snapshot);};
  await context.doEditComp('a');
  context.idbSetState=originalWriter;
  assert.equal(writes.length,2);
  assert.equal(context.S._lastExported,writes[0]._lastExported,'failed metadata write preserves successful recovery timestamp');
  assert.notEqual(context.S._lastExported,failedWriteTimestamp);
  assert.equal(context.S.compositions[0].note,undefined);
  assert.equal(nodes['m-comp-note'].value,note);
  assert.equal(closes,0); assert(!messages.includes('Komposition gespeichert'));

  reset(); const cards=JSON.stringify(context.S.cards);
  for(const status of ['finished','published','draft']) {
    control.value=status; const old=context.S.compositions[0].updatedAt;
    await context.changeCompositionStatus('a',control);
    assert.equal(context.S.compositions[0].status,status);
    assert.notEqual(context.S.compositions[0].updatedAt,old);
    assert.equal(JSON.stringify(context.S.cards),cards);
  }
  control.value='active'; const state=JSON.stringify(context.S), saves=writes.length;
  await context.changeCompositionStatus('a',control);
  assert.equal(JSON.stringify(context.S),state); assert.equal(writes.length,saves); assert.equal(control.value,'draft');
  failed=true; control.value='published'; await context.changeCompositionStatus('a',control);
  assert.equal(control.value,'draft'); assert.equal(context.S.compositions[0].status,'draft');
  failed=false; control.value='published'; await context.changeCompositionStatus('a',control);
  assert.equal(context.S.compositions[0].status,'published');
  for(const guard of ['_storageReadOnly','_syncInProgress']) {
    context._storageWriteError=true;
    context[guard]=true;
    const guardedWrites=writes.length;
    assert.equal(await context.persistCompositionMetadata('a',{note:'blocked'}),false);
    assert.equal(writes.length,guardedWrites,'retry must not bypass readonly or sync guard');
    context[guard]=false;
    context._storageWriteError=false;
  }

  // Detached edit modal: the successfully committed data must still refresh the current view.
  reset();
  nodes['m-title'].value='Aktueller Titel'; nodes['m-comp-note'].value='Gespeicherte Anmerkung';
  release=true;
  const detachedSave=context.doEditComp('a');
  await Promise.resolve(); await Promise.resolve();
  context.closeModal(); delete nodes['m-comp-note'];
  release(); release=null; await detachedSave;
  assert(nodes['comp-list'].innerHTML.includes('Aktueller Titel'));
  assert(nodes['comp-detail'].innerHTML.includes('Gespeicherte Anmerkung'));
  assert.equal(closes,1,'completed detached save must not close another modal');
  assert.equal(writes.length,1,'refresh must not save');

  // Replacement modal retains both its editable draft and its focused element.
  reset(); nodes['m-title'].value='Erster Titel'; nodes['m-comp-note'].value='Erste Notiz';
  release=true;
  const replacedSave=context.doEditComp('a');
  await Promise.resolve(); await Promise.resolve();
  const otherNote={value:'Noch ungespeicherter anderer Text'};
  nodes['m-comp-note']=otherNote; nodes['m-title']={value:'Anderes Modal'};
  context.document.activeElement=otherNote;
  release(); release=null; await replacedSave;
  assert.strictEqual(nodes['m-comp-note'],otherNote);
  assert.equal(otherNote.value,'Noch ungespeicherter anderer Text');
  assert.equal(nodes['m-title'].value,'Anderes Modal');
  assert.strictEqual(context.document.activeElement,otherNote);
  assert.equal(closes,0);
  assert(nodes['comp-list'].innerHTML.includes('Erster Titel'));
  assert(nodes['comp-detail'].innerHTML.includes('Erste Notiz'));
  assert.equal(writes.length,1);

  // A tab switch renders the optimistic status; completion/rollback must update in place.
  for (const rejectWrite of [true,false]) {
    reset();
    context.S._lastExported='2026-01-01T00:00:00.000Z';
    const timestampBefore=context.S._lastExported;
    const row={dataset:{cardTreeUid:'card'},classes:new Set(),attributes:{},
      classList:{toggle(name,on){if(on) row.classes.add(name);else row.classes.delete(name);}},
      setAttribute(name,value){this.attributes[name]=value;},removeAttribute(name){delete this.attributes[name];}};
    const backlink={dataset:{compositionUid:'a'},textContent:'',attributes:{},
      setAttribute(name,value){this.attributes[name]=value;}};
    context.document.querySelectorAll=selector=>selector.includes('data-card-tree-uid')?[row]:[backlink];
    control.value='published'; release=true; failed=rejectWrite;
    const statusSave=context.changeCompositionStatus('a',control);
    await Promise.resolve(); await Promise.resolve();
    context.UI.tab='cards'; context.refreshCompositionMetadataViews();
    assert(row.classes.has('composition-published'));
    assert(backlink.textContent.endsWith('Veröffentlicht'));
    context.document.activeElement=backlink;
    release(); release=null; await statusSave;
    const expectedUsage=rejectWrite?'unpublished':'published';
    assert(row.classes.has('composition-'+expectedUsage));
    assert.equal(row.classes.size,1);
    assert.equal(backlink.textContent,'↗ Gedicht · '+(rejectWrite?'Entwurf':'Veröffentlicht'));
    assert.equal(backlink.attributes['aria-label'],'Komposition Gedicht, '+(rejectWrite?'Entwurf':'Veröffentlicht')+', öffnen');
    assert.strictEqual(context.document.activeElement,backlink,'refresh must preserve backlink focus');
    assert.equal(writes.length,1);
    if(rejectWrite) assert.equal(context.S._lastExported,timestampBefore);
    else assert.equal(context.S._lastExported,writes[0]._lastExported);
    // Returning to Composition before another completion must also show the restored state.
    context.UI.tab='composition'; context.renderCompDetail();
    assert(nodes['comp-detail'].innerHTML.includes('value="'+(rejectWrite?'draft':'published')+'" selected'));
    context.document.querySelectorAll=()=>[];
  }

  reset();
  let focusControls=[{id:'title'},{id:'status'}], focusedMarkup='';
  const focusDetail={querySelectorAll:()=>focusControls};
  Object.defineProperty(focusDetail,'innerHTML',{get:()=>focusedMarkup,set:markup=>{
    focusedMarkup=markup;
    focusControls=['title','status'].map(id=>({id,focus(){context.document.activeElement=this;}}));
  }});
  nodes['comp-detail']=focusDetail;
  context.document.activeElement=focusControls[1];
  context._modalReturnFocusElement=focusControls[0];
  const beforeRefresh=JSON.stringify(context.S);
  context.refreshCompositionMetadataViews();
  assert.strictEqual(context.document.activeElement,focusControls[1],'replace detail control without losing keyboard focus');
  assert.strictEqual(context._modalReturnFocusElement,focusControls[0],'keep modal return-focus target connected');
  assert.equal(JSON.stringify(context.S),beforeRefresh);
  assert.equal(writes.length,0);
  context._modalReturnFocusElement=null;

  reset(); nodes['m-title'].value='Neu'; context.doCreateComp();
  assert.equal(context.S.compositions.at(-1).note,''); assert.equal(context.S.compositions.at(-1).status,'draft');
  for(const status of [undefined,'draft','finished','published']) {
    context.S.compositions[0].status=status;
    const snapshot=JSON.stringify(context.S);
    assert.equal(context.compositionUsageLookup().get('card'),status==='published'?'published':'unpublished');
    assert.equal(JSON.stringify(context.S),snapshot);
  }
  for(const other of ['draft','finished']) {
    const purple={uid:'p',cardUids:['card'],status:other}, green={uid:'g',cardUids:['card'],status:'published'};
    for(const comps of [[purple,green],[green,purple]]) {
      context.S.compositions=comps;
      assert.equal(context.compositionUsageLookup().get('card'),'published');
    }
  }
  context.S.compositions=[{uid:'typed',cardUids:[1, null, {}]}];
  assert.equal(context.compositionUsageLookup().get('1'),undefined,'membership must use exact UID identity like indexOf');
  context.S.compositions=[]; assert.equal(context.compositionUsageLookup().get('card'),undefined);
  reset(); context.UI.tab='cards';
  const lookup=context.compositionUsageLookup();
  assert.equal(lookup.get('card'),'unpublished');
  context.renderCardsList(); const treeMarkup=nodes['cards-tree'].innerHTML;
  assert(treeMarkup.includes('composition-unpublished')); assert(treeMarkup.includes('aria-description="In unveröffentlichter Komposition verwendet"'));
  context.UI.searchQuery='Fenster'; context.renderCardsList();
  assert.equal(nodes['cards-tree'].innerHTML,treeMarkup,'search and tree must share marker semantics');
  context.S.compositions=JSON.parse(JSON.stringify([{uid:'remote',cardUids:['card'],status:'published',note}]));
  context.renderCardsList(); assert(nodes['cards-tree'].innerHTML.includes('composition-published'));
  assert(!context.cardItemHtml(context.S.cards[0],new Map()).includes('composition-'));
  assert.equal(debounced,0,'pure marker rendering must not save');
  reset(); context.UI.tab='cards';
  const visibleRow={dataset:{cardTreeUid:'card'},classes:new Set(),attributes:{},
    classList:{toggle(name,on){ if(on) visibleRow.classes.add(name); else visibleRow.classes.delete(name); }},
    setAttribute(name,value){this.attributes[name]=value;},removeAttribute(name){delete this.attributes[name];}};
  context.document.querySelectorAll=()=>[visibleRow];
  const rowIdentity=visibleRow;
  context.refreshCompositionCardUsage(); assert(visibleRow.classes.has('composition-unpublished'));
  context.S.compositions[0].status='published'; context.refreshCompositionCardUsage();
  assert(visibleRow.classes.has('composition-published')); assert(!visibleRow.classes.has('composition-unpublished'));
  context.S.compositions=[]; context.refreshCompositionCardUsage();
  assert.equal(visibleRow.classes.size,0); assert.equal(visibleRow.attributes['aria-description'],undefined);
  assert.strictEqual(visibleRow,rowIdentity,'visible refresh must preserve DOM identity/focus');
  context.document.querySelectorAll=()=>[];
  reset(); context.removeCompCard('a',0); assert.equal(context.compositionUsageLookup().get('card'),undefined);
  context.addCardToComp('card'); assert.equal(context.compositionUsageLookup().get('card'),'unpublished');
  context.doDeleteComp('a'); assert.equal(context.compositionUsageLookup().get('card'),undefined);
  assert(context.S.deletedIds.a);

  reset(); context.S.compositions[0].note=note; context.S.compositions[0].status='published';
  const snapshot=context.buildBackupSnapshotFromState(context.S);
  const restored=JSON.parse(JSON.stringify(snapshot));
  assert.equal(restored.compositions[0].note,note); assert.equal(restored.compositions[0].status,'published');
  assert.equal(context.S.compositions[0].note,note);
  console.log('composition metadata smoke tests passed: legacy, notes, write completion/failure/retry, status, guards, markers, CRUD, backup');
})().catch(error=>{console.error(error);process.exitCode=1;});
