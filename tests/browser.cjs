// Isolated browser contexts + mocked external services; never calls real accounts.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const runtimeRequire=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?createRequire(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'_tests.cjs')):require;
const {chromium}=runtimeRequire('playwright');
const root=path.resolve(__dirname,'..'),outDir=process.env.TEST_OUTPUT_DIR||path.join(root,'test-output');
const api={remote:null,writes:0,adds:0,notes:[],rawReads:0},errors=[];
const sourceExport={results:[{user_book_id:42,title:'Verstehen statt Wiedererkennen',author:'Testquelle · synthetisch',source:'reader',external_id:'fixture-reader',source_url:'https://example.org/source',category:'articles',highlights:[
 {id:101,text:'Etwas selbst erklären zu können macht sichtbar, wo noch eine Verständnislücke liegt.',note:'Ich verwechsle manchmal Vertrautheit mit Verständnis.',tags:[],created_at:'2026-09-23T12:00:00Z',updated_at:'2026-09-23T12:00:00Z'},
 {id:102,text:'Nicht jeder interessante Gedanke braucht eine Karte.',note:'Bewusst auswählen.',tags:[{name:'Workbench'},{name:'make-anki'}],created_at:'2020-01-01T00:00:00Z',updated_at:'2026-09-23T12:00:00Z'}]}],nextPageCursor:null};
async function intercept(ctx,origin){await ctx.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.origin===origin)return route.continue();let body;
 if(url.hostname==='readwise.io'&&url.pathname==='/api/v2/export/')body=sourceExport;
 else if(url.hostname==='api.github.com'&&url.pathname==='/gists/abc123'){
  if(req.method()==='PATCH'){const files=req.postDataJSON().files;assert.deepEqual(Object.keys(files),['readwise_workbench_v2.json']);api.remote=files['readwise_workbench_v2.json'].content;api.writes++;body={id:'abc123'};}
  else body={public:false,files:api.remote?{'readwise_workbench_v2.json':{truncated:true,content:'truncated...',raw_url:'https://gist.githubusercontent.com/test/abc123/raw/rev/state.json'}}:{}};
 }else if(url.hostname==='gist.githubusercontent.com'){
  assert.equal(req.headers().authorization,undefined);api.rawReads++;return route.fulfill({status:200,contentType:'text/plain',body:api.remote,headers:{'Access-Control-Allow-Origin':'*'}});
 }else if(url.hostname==='127.0.0.1'&&url.port==='8765'){
  const {action,params:p}=req.postDataJSON();let result;
  if(action==='version')result=6;
  else if(action==='modelFieldNames')result=['Frage','Antwort','Zitat','Notizen','Medien'];
  else if(action==='modelTemplates')result={'Karte 1':{Front:'{{Frage}}',Back:'{{Antwort}} {{Zitat}} {{Notizen}} {{Medien}}'}};
  else if(action==='createDeck')result=7;
  else if(action==='findNotes')result=api.notes.filter(n=>p.query.startsWith('tag:')?n.tags.includes(p.query.slice(4)):Object.values(n.fields).some(f=>f.value.includes(p.query.replaceAll('"','')))).map(n=>n.noteId);
  else if(action==='notesInfo')result=api.notes.filter(n=>p.notes.includes(n.noteId));
  else if(action==='addNote'){api.adds++;const note=p.note;result=1800000000000+api.adds;api.notes.push({noteId:result,modelName:note.modelName,tags:note.tags,fields:Object.fromEntries(Object.entries(note.fields).map(([k,v])=>[k,{value:v}]))});}
  else throw Error('Unexpected Anki action '+action);
  body={result,error:null};
 }else{errors.push('Unexpected external request: '+url.hostname);return route.abort();}
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body),headers:{'Access-Control-Allow-Origin':'*'}});
 });}
async function nav(p,name){if(await p.locator('.menu').isVisible())await p.locator('.menu').click();await p.locator('#nav').getByRole('button',{name:new RegExp('^'+name)}).click();}
async function idle(p){await p.waitForFunction(()=>!BUSY);}
async function confirm(p){await p.locator('#dialog[open]').waitFor();await p.locator('#modalOK').click();await idle(p);}
async function sync(p,needsConfirm=true){await nav(p,'Einstellungen');await p.getByLabel('Sync-Passphrase (mindestens 10 Zeichen)').fill('test-passphrase-only');await p.getByRole('button',{name:'Passphrase entsperren',exact:true}).click();await p.getByRole('button',{name:'Jetzt abgleichen',exact:true}).click();if(needsConfirm)await confirm(p);else await idle(p);assert.doesNotMatch(await p.locator('#message').innerText(),/gesperrt|fehlgeschlagen|nicht verifiziert|ungültig/);}
async function configure(p,first){await nav(p,'Einstellungen');await p.getByLabel('GitHub-Token (Gist-Schreibrecht)').fill('test-token-not-real');await p.getByLabel('Gist-ID (bestehender geheimer Gist)').fill('abc123');if(first){await p.getByLabel('Access Token',{exact:true}).fill('test-readwise-not-real');await p.getByLabel('Neue Highlights seit (UTC)').fill('2026-09-01');}await p.getByRole('button',{name:'Einstellungen speichern',exact:true}).first().click();await idle(p);}
(async()=>{
 fs.mkdirSync(outDir,{recursive:true});
 const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');let rel=decodeURIComponent(url.pathname).replace(/^\/readwise-workbench-2\/?/,'');if(!rel)rel='index.html';const file=path.resolve(root,rel);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}try{res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.webmanifest')?'application/manifest+json':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'text/plain');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,appUrl=origin+'/readwise-workbench-2/';
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 try{
 const a=await browser.newContext({viewport:{width:1360,height:1000}}),b=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await intercept(a,origin);await intercept(b,origin);const pa=await a.newPage(),pb=await b.newPage();for(const p of [pa,pb])p.on('pageerror',e=>errors.push(e.message));
 await pa.goto(appUrl);await pa.getByRole('heading',{name:'Was bleibt hängen?'}).waitFor();await configure(pa,true);await nav(pa,'Eingang');await pa.getByRole('button',{name:'Readwise laden',exact:true}).click();await idle(pa);assert.equal(await pa.evaluate(()=>S.candidates.length),2);
 // Sort selection survives reload, preserves selected IDs and controls quick selection.
 const visibleIds=()=>pa.locator('input[aria-label^="Highlight "]').evaluateAll(xs=>xs.map(x=>x.getAttribute('aria-label')));
 assert.equal(await pa.getByLabel('Sortierung',{exact:true}).inputValue(),'newest');
 assert.deepEqual(await visibleIds(),['Highlight 101 auswählen','Highlight 102 auswählen']);
 await pa.getByLabel('Sortierung',{exact:true}).selectOption('oldest');
 assert.deepEqual(await visibleIds(),['Highlight 102 auswählen','Highlight 101 auswählen']);
 await pa.reload();await pa.getByRole('heading',{name:'Was bleibt hängen?'}).waitFor();
 assert.equal(await pa.getByLabel('Sortierung',{exact:true}).inputValue(),'oldest');
 await pa.getByRole('button',{name:'1',exact:true}).click();assert.deepEqual(await pa.evaluate(()=>UI.selected),['102']);
 await pa.getByLabel('Sortierung',{exact:true}).selectOption('newest');
 assert.deepEqual(await pa.evaluate(()=>UI.selected),['102']);
 await pa.screenshot({path:path.join(outDir,'desktop-inbox.png'),fullPage:true});
 await pa.setViewportSize({width:390,height:844});
 assert.equal(await pa.evaluate(()=>document.documentElement.scrollWidth<=390),true);
 await pa.screenshot({path:path.join(outDir,'mobile-inbox.png'),fullPage:true});
 await pa.setViewportSize({width:1360,height:1000});
 await pa.getByLabel('Workflow für neue Session').selectOption('anki');
 await pa.getByRole('checkbox',{name:'Highlight 101 auswählen'}).check();await pa.getByRole('checkbox',{name:'Highlight 102 auswählen'}).check();await pa.getByRole('button',{name:'Verarbeitung beginnen →',exact:true}).click();await idle(pa);const sid=await pa.evaluate(()=>S.sessions[0].id);
 await pa.getByLabel('Zwischenstand / bisheriger Dialog').fill('Begonnen: Ich erkläre Highlight 101. Highlight 102 könnte ich verwerfen.');await pa.getByRole('button',{name:'Zwischenstand speichern',exact:true}).click();await idle(pa);await sync(pa);assert.equal(api.writes,1);assert.equal(api.remote.includes('Verständnislücke'),false);
 await pb.goto(appUrl);await pb.getByRole('heading',{name:'Was bleibt hängen?'}).waitFor();await configure(pb,false);await sync(pb);assert.equal(await pb.evaluate(()=>S.sessions[0].id),sid);assert.equal(await pb.evaluate(()=>S.candidates.length),2);assert.equal(api.writes,1);
 await nav(pb,'Sessions');await pb.getByRole('button',{name:'Fortsetzen →',exact:true}).click();assert.match(await pb.getByLabel('Zwischenstand / bisheriger Dialog').inputValue(),/Begonnen/);
 await pb.getByLabel('Zwischenstand / bisheriger Dialog').fill('Erklärt: eigene Worte decken Lücken auf. 101 wird Anki; 102 wird bewusst verworfen.');await pb.getByRole('button',{name:'Dialog beendet · Handoff ausstehend',exact:true}).click();await idle(pb);
 const h=await pb.evaluate(()=>({type:'readwise-workbench-handoff-v2',version:'2.0',session:{session_id:S.sessions[0].id,input_count:2,completed_at:null},items:[{highlight_id:'101',outcome:'processed',route:'anki',user_processing:{own_words:'Wenn mir eigene Worte fehlen, habe ich den Gedanken noch nicht verstanden.',key_distinction:'Wiedererkennen ist nicht Erklären.',open_question:null,possible_intermediate_packet_use:null},artifacts:[],anki:{status:'ready_for_sync',target_deck:null,target_model:null,core_fields:{Frage:'Wie kann eine Erklärung in eigenen Worten Verständnislücken sichtbar machen?',Antwort:'Wo die Erklärung oder ein eigenes Beispiel stockt, reicht bloßes Wiedererkennen nicht aus.',Zitat:S.sessions[0].items[0].source.text,Notizen:'',Medien:'',Tags:'lernen verstehen'},learning_fields:{feynman_explanation:'Ich brauche eigene Worte und ein Beispiel.',mnemonic:null}},notes:''},{highlight_id:'102',outcome:'discarded',route:'discard',user_processing:{own_words:'Daraus brauche ich keine Karte.',key_distinction:null,open_question:null,possible_intermediate_packet_use:null},artifacts:[],anki:null,notes:'Nach Verarbeitung bewusst verworfen.'}],summary:{processed:1,discarded:1,deferred:0,anki_ready:1,notion_artifacts:0},errors:[]}));
 await pb.getByLabel('JSON-Handoff aus dem Chat').fill(JSON.stringify(h));await pb.getByRole('button',{name:'Entwurf speichern',exact:true}).click();await idle(pb);await pb.screenshot({path:path.join(outDir,'mobile-session.png'),fullPage:true});assert.equal(await pb.evaluate(()=>document.documentElement.scrollWidth<=390),true);await sync(pb);assert.equal(api.writes,2);
 await sync(pa);assert.equal(api.writes,2);await nav(pa,'Sessions');await pa.getByRole('button',{name:'Fortsetzen →',exact:true}).click();assert.match(await pa.getByLabel('Zwischenstand / bisheriger Dialog').inputValue(),/bewusst verworfen/);assert.equal(await pa.getByLabel('JSON-Handoff aus dem Chat').inputValue(),JSON.stringify(h));
 await pa.getByRole('button',{name:'Prüfen & übernehmen',exact:true}).click();await confirm(pa);assert.equal(await pa.evaluate(()=>allCards().length),1);assert.equal(await pa.evaluate(()=>candidateStatus(candidate('101'))),'pending_anki');assert.equal(await pa.evaluate(()=>candidateStatus(candidate('102'))),'discarded');
 await pa.getByRole('button',{name:'1 Karten prüfen →',exact:true}).click();await pa.getByRole('button',{name:'Prüfung speichern & freigeben',exact:true}).click();await idle(pa);await pa.getByRole('button',{name:'Freigegebene Karten synchronisieren',exact:true}).click();await confirm(pa);assert.equal(api.adds,1);assert.equal(await pa.evaluate(()=>allCards()[0].status),'synced');
 await pa.evaluate(async h=>{const r=applyHandoff(S,S.sessions[0].id,h);if(!r.noop)throw Error('replay not no-op');},h);assert.equal(api.adds,1);
 await sync(pa);await sync(pb);assert.equal(await pb.evaluate(()=>allCards()[0].note_id),api.notes[0].noteId);assert.equal(await pb.evaluate(()=>candidateStatus(candidate('101'))),'processed');
 const writesBefore=api.writes;await sync(pb,false);assert.equal(api.writes,writesBefore);assert.ok(api.rawReads>4);
 // New workflow: private template on desktop, continue/finish on mobile without Anki.
 await nav(pa,'Einstellungen');
 await pa.locator('summary').filter({hasText:'Notion / flexibel · ohne AnkiConnect'}).click();
 await pa.getByLabel('Startprompt · notion',{exact:true}).fill('Meine private Testregel: Sprint oder Time-Sektor aktualisieren. {{COUNT}} Highlights.\\n{{HIGHLIGHTS_JSON_OR_MARKDOWN}}');
 await pa.getByLabel('Handoff-Zusatz · notion',{exact:true}).fill('Meine Verbindungen unter extra dokumentieren. {{HANDOFF_SCHEMA}}');
 await pa.getByRole('button',{name:'Vorlagen speichern · notion',exact:true}).click();await idle(pa);
 await pa.locator('summary').filter({hasText:'Notion / flexibel · ohne AnkiConnect'}).click();
 await pa.screenshot({path:path.join(outDir,'desktop-templates.png'),fullPage:true});
 await nav(pa,'Verlauf');await pa.getByRole('button',{name:'Bewusst wieder aufgreifen',exact:true}).last().click();await confirm(pa);
 assert.equal(await pa.evaluate(()=>processingLog().length),2);
 await nav(pa,'Eingang');await pa.getByLabel('Workflow für neue Session').selectOption('notion');
 await pa.getByRole('button',{name:'1',exact:true}).click();await pa.getByRole('button',{name:'Verarbeitung beginnen →',exact:true}).click();await idle(pa);
 const notionSession=await pa.evaluate(()=>S.sessions.at(-1).id);
 assert.match(await pa.evaluate(()=>buildStartPrompt(S.sessions.at(-1))),/private Testregel/);
 await pa.getByLabel('Zwischenstand / bisheriger Dialog').fill('Nur initiale Verwendung: Sprintnotiz ergänzen und Aufgabe anlegen; später separat lernen.');
 await pa.getByRole('button',{name:'Zwischenstand speichern',exact:true}).click();await idle(pa);
 await sync(pa);await sync(pb);
 assert.equal(await pb.evaluate(id=>S.sessions.some(s=>s.id===id),notionSession),true);
 assert.match(await pb.evaluate(()=>S.workflows.find(w=>w.id==='notion').start_template),/private Testregel/);
 assert.equal(api.remote.includes('private Testregel'),false);
 await nav(pb,'Sessions');await pb.getByRole('button',{name:'Fortsetzen →',exact:true}).click();
 const flexible=await pb.evaluate(()=>{
   var s=session(UI.sessionId),items=s.items.map(i=>({highlight_id:i.highlight_id,outcome:'processed',route:'sprint_and_time_sector',decision:'Sprint ergänzen und nächste Handlung festhalten',processed_at:null,user_processing:{},actions:[
     {description:'Sprintnotiz ergänzt',status:'completed',details:{connections:['Plan','Quelle']}},
     {description:'Aufgabe im Time-Sektor angelegt',status:'completed',target:'Diese Woche',extra:{priority_reason:null}}
   ],artifacts:[{system:'notion',target:'Sprintnotiz',action:'updated',url:'https://www.notion.so/12345678901234567890123456789012',id:null,extra:{section:'Nächster Schritt'}}],anki:null,notes:'Synthetischer Test, kein echter Notion-Write.',extra:{reflection:{ideas:['später auswerten'],nested:[true,null]}}}));
   return {type:'readwise-workbench-handoff-v2',version:'2.1',session:{session_id:s.id,input_count:items.length,completed_at:null},items,summary:summarizeHandoff(items),errors:[],extra:{arbitrary_future_field:{values:[1,2,3]}}};
 });
 await pb.getByLabel('JSON-Handoff aus dem Chat').fill(JSON.stringify(flexible));
 await pb.getByRole('button',{name:'Prüfen & übernehmen',exact:true}).click();await confirm(pb);
 assert.equal(await pb.evaluate(()=>sessionDone(S.sessions.find(s=>s.workflow.id==='notion'))),true);assert.equal(api.adds,1);
 await nav(pb,'Verlauf');assert.match(await pb.locator('#app').innerText(),/Sprintnotiz ergänzt/);
 assert.equal(await pb.evaluate(()=>processingLog().length),3);
 assert.equal(await pb.evaluate(()=>document.documentElement.scrollWidth<=390),true);
 await pb.screenshot({path:path.join(outDir,'mobile-flexible-log.png'),fullPage:true});
 const downloaded=pb.waitForEvent('download');await pb.getByRole('button',{name:'Protokoll als JSON exportieren',exact:true}).click();const download=await downloaded;await download.saveAs(path.join(outDir,'processing-log.json'));
 const log=JSON.parse(fs.readFileSync(path.join(outDir,'processing-log.json')));
 assert.equal(log.events.length,3);assert.deepEqual(log.events.find(e=>e.session_id===notionSession).handoff_context.extra,flexible.extra);
 await sync(pb);await sync(pa);assert.equal(await pa.evaluate(()=>processingLog().length),3);
 const current=await pa.evaluate(()=>JSON.parse(JSON.stringify(S)));
 const c=await browser.newContext();await intercept(c,origin);const pc=await c.newPage();pc.on('pageerror',e=>errors.push(e.message));
 // Seed a real old-shaped IndexedDB state and reload through production migration.
 const legacy=JSON.parse(JSON.stringify(current));delete legacy.workflows;legacy.sessions=legacy.sessions.filter(s=>s.workflow.id==='anki');legacy.sessions.forEach(s=>{delete s.workflow;delete s.handoff_imported_at;});legacy.candidates.forEach(x=>{x.generation=0;});
 await pc.goto(appUrl);await pc.getByRole('heading',{name:'Was bleibt hängen?'}).waitFor();
 await pc.evaluate(async data=>{await writeLocal(data,data);},legacy);await pc.reload();await pc.getByRole('heading',{name:'Was bleibt hängen?'}).waitFor();
 assert.equal(await pc.evaluate(()=>S.sessions[0].workflow.id),'anki');assert.equal(await pc.evaluate(()=>S.sessions[0].handoff_imported_at),null);assert.equal(await pc.evaluate(()=>allCards()[0].note_id),api.notes[0].noteId);
 assert.deepEqual(await pc.evaluate(()=>S.sessions[0].handoff),legacy.sessions[0].handoff);
 await c.close();
 // Read-only second tab protection, actual IDB persistence, shell offline.
 const second=await a.newPage();await second.goto(appUrl);await second.waitForFunction(()=>typeof LOCKED!=='undefined'&&LOCKED&&document.getElementById('app').disabled);assert.ok(await second.evaluate(()=>document.getElementById('app').disabled));await second.close();
 await pa.reload();await pa.getByRole('heading',{name:'Einstellungen',exact:true}).waitFor();assert.equal(await pa.evaluate(()=>allCards()[0].status),'synced');
 await pa.evaluate(async()=>{await navigator.serviceWorker.ready;});await pa.reload();await pa.waitForFunction(()=>!!navigator.serviceWorker.controller);await a.setOffline(true);await pa.reload();await pa.getByRole('heading',{name:'Einstellungen',exact:true}).waitFor();assert.equal(await pa.evaluate(()=>S.sessions.length),2);await a.setOffline(false);
 await nav(pa,'Verlauf');await pa.screenshot({path:path.join(outDir,'desktop-history.png'),fullPage:true});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,browser:await browser.version(),scenarios:['two-device checkpoints and handoff','encrypted truncated Gist pull + no-op','Anki review and confirmed note ID','discarded rerouting','no duplicate handoff import','IndexedDB reload','second-tab lock','PWA offline shell','390px no overflow','private templates and frozen session prompts','mobile Notion workflow without Anki','flexible nested log and JSON export','legacy IndexedDB migration'],gistWrites:api.writes,ankiAdds:api.adds,screenshots:outDir},null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
