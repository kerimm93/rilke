const test=require('node:test'),assert=require('node:assert/strict');
const {app,source,seed,session,handoff,html}=require('./helpers.cjs');
const serial=x=>JSON.parse(JSON.stringify(x));
function flexible(a,s){const h=handoff(a,s,'reading_journal');h.version='2.1';h.items[0].route='sprint_update';h.items[0].user_processing={};h.items[0].decision='Sprint ergänzen und eine Aufgabe anlegen';h.items[0].actions=[{description:'Sprintnotiz ergänzt',status:'completed',system:'notion',details:{connections:['a','b'],importance:3}},{description:'Aufgabe im Time-Sektor angelegt',status:'completed',url:null,custom:{nested:[true,null,{own:'Gedanke'}]}}];h.items[0].extra={future_use:{ideas:['später auswerten']}};h.items[0].artifacts[0].sprint={name:'Aktuelle Arbeit'};h.extra={new_field:['unbekannt',{x:2}]};h.session.context={device:'mobile'};h.summary.custom_count=2;return h;}

test('new default is Notion; legacy sessions upgrade deterministically with Anki and retain content',()=>{
 const a=app();seed(a);const s=session(a);a.S=a.applyHandoff(a.S,s.id,handoff(a,s)).state;
 const legacy=serial(a.S);delete legacy.workflows;for(const s of legacy.sessions){delete s.workflow;delete s.handoff_imported_at;}
 const before=serial(legacy),up=a.validateState(legacy);assert.deepEqual(legacy,before);assert.deepEqual(serial(up.sessions[0].handoff),legacy.sessions[0].handoff);assert.deepEqual(serial(up.sessions[0].cards),legacy.sessions[0].cards);assert.equal(up.sessions[0].workflow.id,'anki');assert.equal(up.sessions[0].handoff_imported_at,null);assert.ok(a.same(up,a.validateState(up)));assert.ok(a.equalState(legacy,up));assert.equal(a.processingLog(up)[0].imported_at,null);
 const b=app();seed(b);const current=b.newSession(b.S,['101']);assert.equal(current.session.workflow.id,'notion');
});
test('private templates persist, new sessions snapshot them, old sessions stay stable',async()=>{
 const a=app();seed(a,[source('1'),source('2')]);const first=session(a,['1'],'notion'),before=a.buildStartPrompt(first);a.DRAFTS['workflow.notion.start_template']='Privates Ziel: https://www.notion.so/personal-collection\n{{COUNT}} · {{SESSION_ID}}\n{{COUNT}}';a.DRAFTS['workflow.notion.handoff_template']='Zusätzliche Verbindungen im Feld extra protokollieren.';
 await a.saveWorkflow('notion');assert.equal(Object.keys(a.DRAFTS).length,0);assert.equal(a.buildStartPrompt(a.S.sessions[0]),before);
 const next=session(a,['2'],'notion'),prompt=a.buildStartPrompt(next);assert.match(prompt,/personal-collection/);assert.doesNotMatch(prompt,/\{\{COUNT\}\}/);assert.match(prompt,/"highlight_id": "2"/);assert.match(a.buildHandoffPrompt(next),/App-Vertrag/);assert.match(a.buildHandoffPrompt(next),/expected_highlight_ids/);
 const reloaded=a.validateState(JSON.parse(a.localStorage.getItem('rww2.fallback')).state);assert.match(reloaded.workflows.find(w=>w.id==='notion').start_template,/personal-collection/);
 assert.doesNotMatch(html,/8f1702404a6e454da8bb205c738ea703|d2462e8e4d7d4088ad8b2920f126a884/);
});
test('source template-like text is data and is not expanded recursively',()=>{
 const a=app();seed(a,[source('101',{text:'Literal {{COUNT}} and {{SESSION_ID}} and $&'})]);const s=session(a,undefined,'notion');const p=a.buildStartPrompt(s);assert.match(p,/Literal \{\{COUNT\}\} and \{\{SESSION_ID\}\} and \$&/);assert.match(p,/Quellen.*Daten/);
 assert.throws(()=>a.validateTemplate('{{UNKNOWN_VARIABLE}}','Test'),/Unbekannte Variable/);
});
test('failed template persistence keeps saved template and draft intact',async()=>{
 const a=app();const before=serial(a.S);a.DRAFTS['workflow.notion.start_template']='Mein neuer Prompt';a.writeLocal=async()=>{throw Error('quota');};a.console={error(){}};await a.saveWorkflow('notion');assert.deepEqual(serial(a.S),before);assert.equal(a.DRAFTS['workflow.notion.start_template'],'Mein neuer Prompt');
});
test('flexible Handoff preserves unknown fields through import, encryption, backup and log',async()=>{
 const a=app();seed(a);const s=session(a,undefined,'notion'),h=flexible(a,s);a.S=a.applyHandoff(a.S,s.id,h).state;assert.equal(a.candidateStatus(a.S.candidates[0]),'processed');assert.equal(a.allCards().length,0);assert.equal(a.sessionDone(a.S.sessions[0]),true);
 assert.deepEqual(serial(a.S.sessions[0].handoff),serial(h));a.passphrase='workflow-test-passphrase';const cipher=await a.encryptState(a.S,a.passphrase);assert.doesNotMatch(JSON.stringify(cipher),/Sprintnotiz/);const decoded=await a.decodeGist(JSON.stringify(cipher)),restored=a.validateState(serial(decoded));assert.deepEqual(serial(restored),serial(a.S));
 const event=a.processingLog(restored)[0];assert.deepEqual(serial(event.result.extra),h.items[0].extra);assert.deepEqual(serial(event.handoff_context.extra),h.extra);assert.deepEqual(serial(event.handoff_context.session.context),h.session.context);assert.ok(event.imported_at);assert.equal(event.processed_at,null);assert.equal(event.source.id,'101');assert.match(a.renderHistory(),/Sprintnotiz ergänzt/);
});
test('action-only processing is valid, incomplete or failed actions cannot claim completion',()=>{
 const a=app();seed(a);const s=session(a,undefined,'notion'),h=flexible(a,s);h.items[0].artifacts=[];h.summary=a.summarizeHandoff(h.items);assert.doesNotThrow(()=>a.validateHandoff(h,s));
 const planned=serial(h);planned.items[0].actions[0].status='planned';assert.throws(()=>a.validateHandoff(planned,s),/Unfertige/);
 const failed=serial(h);failed.items[0].actions[0].status='failed';assert.throws(()=>a.validateHandoff(failed,s),/Fehlgeschlagene/);failed.items[0].outcome='error';failed.items[0].notes='Write gescheitert';failed.errors=['Write gescheitert'];failed.summary=a.summarizeHandoff(failed.items);assert.doesNotThrow(()=>a.validateHandoff(failed,s));
});
test('Notion workflow rejects direct Anki payload and malformed identities remain rejected',()=>{
 const a=app();seed(a);const s=session(a,undefined,'notion');assert.throws(()=>a.validateHandoff(handoff(a,s),s),/ohne AnkiConnect/);
 for(const mutate of [h=>h.items[0].highlight_id='999',h=>h.session.session_id='foreign',h=>h.items[0].outcome='learned',h=>h.items[0].actions[0].url='javascript:alert(1)',h=>h.items[0].processed_at='unknown']){const h=flexible(a,s);mutate(h);assert.throws(()=>a.validateHandoff(h,s));}
});
test('Handoff replay adds no log events; repeated use appends and import time never drifts',()=>{
 const a=app();seed(a);const first=session(a,undefined,'notion'),h=flexible(a,first);h.session.completed_at='2026-10-01T12:00:00Z';a.S=a.applyHandoff(a.S,first.id,h).state;const before=serial(a.processingLog());assert.equal(a.applyHandoff(a.S,first.id,h).noop,true);a.S.sessions[0].updated_at='2026-10-05T12:00:00Z';assert.deepEqual(serial(a.processingLog()),before);
 a.S.candidates[0].generation++;const second=session(a,undefined,'notion');assert.equal(a.processingLog().length,1);assert.match(a.renderHistory(),/Sprintnotiz/);assert.equal(second.items[0].previous_results.length,1);a.S=a.applyHandoff(a.S,second.id,handoff(a,second,'discard')).state;const log=a.processingLog();assert.equal(log.length,2);assert.equal(new Set(log.map(e=>e.event_id)).size,2);assert.deepEqual(serial(log.find(e=>e.session_id===first.id)),before[0]);
});
test('Handoff import records confirmation time after a delayed preview and replay preserves it',async()=>{
 const a=app();seed(a);const s=session(a),h=handoff(a,s);h.session.completed_at='2026-10-02T10:00:00.000Z';
 const key='session.'+s.id+'.handoff_draft';a.DRAFTS[key]=JSON.stringify(h);const before=serial(a.S);
 let clock='2026-10-03T10:00:00.000Z',confirm; a.now=()=>clock;a.ask=()=>new Promise(resolve=>{confirm=resolve;});
 const pending=a.previewHandoff(s.id);assert.equal(typeof confirm,'function');assert.deepEqual(serial(a.S),before);assert.equal(a.localStorage.getItem('rww2.fallback'),null);
 clock='2026-10-04T12:00:00.000Z';confirm(true);await pending;
 const imported=a.S.sessions[0];assert.equal(imported.handoff_imported_at,clock);assert.equal(imported.updated_at,clock);assert.equal(imported.cards[0].created_at,clock);assert.equal(imported.cards[0].updated_at,clock);assert.equal(imported.handoff.session.completed_at,h.session.completed_at);
 const saved=JSON.parse(a.localStorage.getItem('rww2.fallback')).state;assert.equal(saved.sessions[0].handoff_imported_at,clock);assert.equal(a.processingLog()[0].imported_at,clock);assert.equal(a.DRAFTS[key],undefined);
 const accepted=serial(a.S);a.DRAFTS[key]=JSON.stringify(h);clock='2026-10-05T12:00:00.000Z';let prompts=0;a.ask=async()=>{prompts++;return true;};await a.previewHandoff(s.id);assert.equal(prompts,0);assert.deepEqual(serial(a.S),accepted);
});
test('cancelling a Handoff preview leaves state and draft untouched',async()=>{
 const a=app();seed(a);const s=session(a,undefined,'notion'),h=flexible(a,s),before=serial(a.S),key='session.'+s.id+'.handoff_draft';a.DRAFTS[key]=JSON.stringify(h);
 let confirm;a.ask=()=>new Promise(resolve=>{confirm=resolve;});const pending=a.previewHandoff(s.id);confirm(false);await pending;
 assert.deepEqual(serial(a.S),before);assert.equal(a.DRAFTS[key],JSON.stringify(h));assert.equal(a.localStorage.getItem('rww2.fallback'),null);assert.equal(a.processingLog().length,0);
});
test('failed Handoff persistence keeps the draft; retry uses the new confirmation time',async()=>{
 const a=app();seed(a);const s=session(a,undefined,'notion'),h=flexible(a,s),before=serial(a.S),key='session.'+s.id+'.handoff_draft';a.DRAFTS[key]=JSON.stringify(h);
 let clock='2026-10-03T10:00:00.000Z';a.now=()=>clock;const write=a.writeLocal;a.writeLocal=async()=>{throw Error('quota');};a.console={error(){}};
 await a.previewHandoff(s.id);assert.deepEqual(serial(a.S),before);assert.equal(a.DRAFTS[key],JSON.stringify(h));assert.equal(a.processingLog().length,0);
 a.writeLocal=write;clock='2026-10-04T12:00:00.000Z';await a.previewHandoff(s.id);assert.equal(a.S.sessions[0].handoff_imported_at,clock);assert.equal(a.DRAFTS[key],undefined);
});
test('free data renders escaped and log export retains complete selected events',()=>{
 const a=app();seed(a);const s=session(a,undefined,'notion'),h=flexible(a,s);h.items[0].route='<img src=x onerror=alert(1)>';h.items[0].extra={unsafe:'</pre><script>alert(1)</script>'};a.S=a.applyHandoff(a.S,s.id,h).state;const markup=a.renderHistory();assert.doesNotMatch(markup,/<script>alert|<img src=x/);assert.match(markup,/&lt;script/);
 a.UI.historyFilter='Sprintnotiz';let exported;a.downloadJson=(name,data)=>{exported=data;};a.exportProcessingLog();assert.equal(exported.events.length,1);assert.equal(exported.events[0].result.extra.unsafe,h.items[0].extra.unsafe);a.UI.historyFilter='unmatched';a.exportProcessingLog();assert.equal(exported.events.length,0);
});
test('templates merge per workflow, conflicting edits require choice and custom empty workspace is protected',()=>{
 const a=app();seed(a);const base=serial(a.S),local=serial(base),remote=serial(base);local.workflows.find(w=>w.id==='notion').start_template='Mein Notion Prompt';remote.workflows.find(w=>w.id==='anki').handoff_template='Mein Anki Zusatz';const merged=a.mergeStates(local,remote,base);assert.equal(merged.conflicts.length,0);assert.equal(merged.state.workflows.find(w=>w.id==='notion').start_template,'Mein Notion Prompt');assert.equal(merged.state.workflows.find(w=>w.id==='anki').handoff_template,'Mein Anki Zusatz');
 remote.workflows.find(w=>w.id==='notion').start_template='Andere Änderung';assert.equal(a.mergeStates(local,remote,base).conflicts.length,1);assert.equal(a.mergeStates(local,remote,base,{'workflows:notion':'remote'}).state.workflows.find(w=>w.id==='notion').start_template,'Andere Änderung');
 const b=app();b.S.workflows[0].start_template='Noch nicht synchronisiert';assert.equal(b.isEmptyState(b.S),false);assert.throws(()=>b.mergeStates(b.S,a.S,null),/anderen/);
});
test('legacy base and remote normalize without spurious session conflicts',()=>{
 const a=app();seed(a);session(a);const old=serial(a.S);delete old.workflows;old.sessions.forEach(s=>{delete s.workflow;delete s.handoff_imported_at;});const local=a.validateState(old);local.sessions[0].checkpoint_text='Weitergearbeitet';const m=a.mergeStates(local,old,old);assert.equal(m.conflicts.length,0);assert.equal(m.state.sessions[0].checkpoint_text,'Weitergearbeitet');
});
