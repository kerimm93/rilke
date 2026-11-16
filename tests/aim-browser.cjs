const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try {
 const context=await browser.newContext(); const page=await context.newPage(); const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 let acceptDialogs = true;
 page.on('dialog',d=>acceptDialogs ? d.accept() : d.dismiss());
 await page.goto(process.env.RILKE_TEST_URL || 'http://127.0.0.1:8000/'); await page.waitForFunction(()=>_persistenceReady);
 await page.evaluate(async()=>{ for(let i=0;i<24;i++) createCardInMemory('Der Wind trägt einen Schatten '+i,'',null); clearTimeout(_saveTimer); await save(); });
 await page.getByRole('button',{name:'Brainstorm',exact:true}).click();
 await page.getByRole('button',{name:'AIM · Schreiben',exact:true}).click();
 await page.getByRole('button',{name:'Neue AIM-Session',exact:true}).click();
 await page.waitForFunction(()=>!!aimSession() && !_aimSaving);
 assert.equal(await page.evaluate(()=>S.pairRelations.length),0);
 const order=await page.evaluate(()=>aimSession().cardUids);
 for(const parent of [0,1]){
   const pair=await page.evaluate(()=>aimPairs(aimSession().cardUids)[aimSession().position]);
   const text=parent===0?'Im Schatten des Windes erwacht ein zweiter Morgen.':'Der Morgen faltet seinen Wind zu Papier.';
   await page.locator('#aim-text').fill(text);
   await page.getByRole('button',{name:parent===0?'Unter A speichern':'Unter B speichern',exact:true}).click();
   await page.waitForFunction(p=>aimSession().position===p && !_aimSaving,parent+1);
   const data=await page.evaluate(text=>{const c=S.cards.find(c=>c.text===text);return {c,parent:findCard(c.parentUid),r:manualOutgoingRelationsForCard(c.uid)}},text);
   assert.equal(data.c.parentUid,pair[parent]); assert.equal(data.r.length,1); assert.equal(data.r[0].toCardUid,pair[1-parent]);
   assert.equal(data.r[0].origin,'manual'); assert.equal(data.c.order,0); assert.equal(data.c.sid,data.parent.sid+'.a');
   await page.getByRole('button',{name:'Karten',exact:true}).click();
   await page.evaluate(id=>focusCard(id),data.c.uid);
   assert(await page.locator('#cards-detail').innerText().then(t=>t.includes(text)));
   await page.getByRole('button',{name:'Brainstorm',exact:true}).click();
   assert.equal(await page.locator('#aim-text').evaluate(e=>e.value),'');
 }
 await page.getByRole('button',{name:'Überspringen',exact:true}).click(); await page.waitForFunction(()=>aimSession().position===3 && !_aimSaving);
 await page.locator('#aim-text').fill('Ein unvollendeter Entwurf');
 await page.reload(); await page.waitForFunction(()=>_persistenceReady);
 await page.getByRole('button',{name:'Brainstorm',exact:true}).click(); await page.getByRole('button',{name:'AIM · Schreiben',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>aimSession().cardUids),order);
 assert.equal(await page.evaluate(()=>aimSession().position),3); assert.equal(await page.locator('#aim-text').inputValue(),'Ein unvollendeter Entwurf');
 // Failure must preserve full state and draft, then retry once without duplicate.
 const before=await page.evaluate(()=>JSON.stringify(S));
 await page.evaluate(()=>{window.originalIdb=idbSetState; idbSetState=async()=>{throw Error('injected IDB failure')};});
 await page.getByRole('button',{name:'Unter A speichern',exact:true}).click(); await page.waitForFunction(()=>!_aimSaving);
 assert.equal(await page.evaluate(()=>JSON.stringify(S)),before);
 assert.equal(await page.evaluate(async()=>JSON.stringify(await idbGetState())),before);
 assert.equal(await page.locator('#aim-text').inputValue(),'Ein unvollendeter Entwurf');
 await page.evaluate(()=>{idbSetState=window.originalIdb;});
 await page.getByRole('button',{name:'Unter A speichern',exact:true}).click(); await page.waitForFunction(()=>aimSession().position===4 && !_aimSaving);
 assert.equal(await page.evaluate(()=>S.cards.filter(c=>c.text==='Ein unvollendeter Entwurf').length),1);
 // Archived source cannot be parent, explicit skip only.
 await page.evaluate(()=>{findCard(aimPairs(aimSession().cardUids)[4][0]).status='archived';renderAim();});
 assert(await page.getByRole('button',{name:'Unter A speichern',exact:true}).isDisabled());
 await page.getByRole('button',{name:'Überspringen',exact:true}).click(); await page.waitForFunction(()=>aimSession().position===5 && !_aimSaving);
 assert.equal(await page.evaluate(()=>aimSession().results[4].status),'unavailable');
 await page.evaluate(()=>{S.cards.forEach(c=>{if(c.status==='archived') c.status='draft'});renderAim();});
 // Mobile and keyboard: width, tab to action, native activation, editor focus after success.
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'/tmp/rilke-aim-mobile.png',fullPage:true});
 await page.locator('#aim-text').fill('Die Nacht bewahrt das ungefaltete Licht.');
 await page.locator('#aim-text').press('Tab'); assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Unter A speichern');
 await page.keyboard.press('Enter'); await page.waitForFunction(()=>aimSession().position===6 && !_aimSaving);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'aim-text');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 // Whitespace, cancelled skip, missing parent and SID conflict leave no entities or progress.
 const stable = await page.evaluate(()=>JSON.stringify(S));
 await page.locator('#aim-text').fill('   \n ');
 await page.getByRole('button',{name:'Unter A speichern',exact:true}).click();
 assert.equal(await page.evaluate(()=>JSON.stringify(S)),stable);
 await page.locator('#aim-text').fill('Ein behüteter Entwurf'); acceptDialogs=false;
 await page.getByRole('button',{name:'Überspringen',exact:true}).click();
 assert.equal(await page.evaluate(()=>JSON.stringify(S)),stable); acceptDialogs=true;
 for(const defect of ['missing','cycle','collision','gap']) {
   await page.evaluate(({stable,defect})=>{
     S=JSON.parse(stable); const pair=aimPairs(aimSession().cardUids)[aimSession().position];
     const parent=findCard(pair[0]);
     if(defect==='missing') parent.parentUid='not-present';
     if(defect==='cycle') parent.parentUid=parent.uid;
     if(defect==='collision') {
       const children=childrenOf(parent.uid), plan=buildSiblingInsertPlan(parent.uid,children,children.length-1);
       S.cards.push({uid:'collision',sid:plan.newSid,status:'archived'});
     }
     if(defect==='gap') {S.cards=S.cards.filter(c=>c.parentUid!==parent.uid);parent.childUids=[];createCardInMemory('existing child','',parent.uid,9,parent.sid+'.c');}
     window.beforeDefect=JSON.stringify(S); renderAim();
   },{stable,defect});
   await page.locator('#aim-text').fill('Neuer Satz');
   await page.getByRole('button',{name:'Unter A speichern',exact:true}).click();
   await page.waitForFunction(()=>!_aimSaving);
   if(defect!=='gap') assert.equal(await page.evaluate(()=>JSON.stringify(S)),await page.evaluate(()=>window.beforeDefect));
   else assert(await page.evaluate(()=>{const p=aimPairs(aimSession().cardUids)[6][0]; const children=childrenOf(p);return children.length===2 && children[0].order===0 && children[1].order===1 && children[1].sid===findCard(p).sid+'.b';}));
 }
 // A source removed by a later state replacement is never silently reassigned.
 await page.evaluate(stable=>{
   S=JSON.parse(stable); const other=aimPairs(aimSession().cardUids)[6][1];
   S.cards=S.cards.filter(c=>c.uid!==other);renderAim();
 },stable);
 assert(await page.getByRole('button',{name:'Unter B speichern',exact:true}).isDisabled());
 const missingState=await page.evaluate(()=>JSON.stringify(S));
 await page.evaluate(()=>advanceAim(0));
 assert.equal(await page.evaluate(()=>JSON.stringify(S)),missingState);
 await page.getByRole('button',{name:'Überspringen',exact:true}).click();
 await page.waitForFunction(()=>aimSession().position===7 && !_aimSaving);
 assert.equal(await page.evaluate(()=>aimSession().results[6].status),'unavailable');
 // In-flight double save and other mutation/sync attempts cannot race the transaction.
 await page.evaluate(stable=>{S=JSON.parse(stable);renderAim();},stable);
 await page.locator('#aim-text').fill('Nur ein Fragment trotz Doppelklick.');
 await page.evaluate(()=>{
   window.writeCount=0; window.realWrite=idbSetState;
   idbSetState=async snapshot=>{window.writeCount++;await new Promise(r=>window.releaseAim=r);return window.realWrite(snapshot);};
   window.pendingAim=advanceAim(0); advanceAim(0);
 });
 await page.waitForFunction(()=>typeof window.releaseAim==='function');
 assert.equal(await page.evaluate(()=>JSON.stringify(S)),stable);
 assert.equal(await page.evaluate(()=>updateCard(S.cards[0].uid,{text:'should not change'})),false);
 await page.evaluate(()=>gistSyncManual());
 assert.equal(await page.evaluate(()=>_syncInProgress),false);
 await page.evaluate(async()=>{window.releaseAim();await window.pendingAim;idbSetState=window.realWrite;});
 assert.equal(await page.evaluate(()=>window.writeCount),1);
 assert.equal(await page.evaluate(()=>S.cards.filter(c=>c.text==='Nur ein Fragment trotz Doppelklick.').length),1);
 assert(await page.evaluate(()=>{
   const backup=buildBackupSnapshotFromState(S), sync=buildRilkeSyncState(S), restored=materializeLocalStateFromSyncState(S,sync,{});
   return backup.matrixSessions[0].position===7 && !('matrixSessions' in sync) && restored.matrixSessions[0].position===7 && sync.pairRelations.every(r=>r.origin==='manual');
 }));
 // The actual recovery ZIP carries the local session in state/S.json.
 await page.evaluate(async()=>{
   await ensureJsZipLoaded(); window.backupPromise = new Promise(resolve=>{
     window.realDownload=downloadBlob; downloadBlob=(name,blob)=>resolve(blob);
   }); exportZipBackup();
 });
 assert.equal(await page.evaluate(async()=>{
   const blob=await window.backupPromise; downloadBlob=window.realDownload;
   const zip=await JSZip.loadAsync(await blob.arrayBuffer());
   const state=JSON.parse(await zip.file('state/S.json').async('string'));
   return state.matrixSessions[0].position;
 }),7);
 // Local writing and session persistence also work with the active PWA shell offline.
 await page.evaluate(()=>navigator.serviceWorker.ready); await page.reload();
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller && _persistenceReady);
 await context.setOffline(true); await page.reload(); await page.waitForFunction(()=>_persistenceReady);
 await page.getByRole('button',{name:'Brainstorm',exact:true}).click();
 await page.getByRole('button',{name:'AIM · Schreiben',exact:true}).click();
 await page.locator('#aim-text').fill('Auch ohne Netz hält das Papier den Wind.');
 await page.getByRole('button',{name:'Unter B speichern',exact:true}).click();
 await page.waitForFunction(()=>aimSession().position===8 && !_aimSaving);
 await page.reload(); await page.waitForFunction(()=>_persistenceReady);
 assert(await page.evaluate(()=>aimSession().position===8 && S.cards.some(c=>c.text==='Auch ohne Netz hält das Papier den Wind.')));
 await context.setOffline(false);
 await page.getByRole('button',{name:'Brainstorm',exact:true}).click();
 await page.getByRole('button',{name:'AIM · Schreiben',exact:true}).click();
 // Complete the remaining prompts without creating any additional content.
 await page.evaluate(async()=>{while(aimSession().position<80) await advanceAim(null);});
 assert(await page.locator('#aim-progress').innerText().then(t=>t.includes('AIM abgeschlossen')));
 assert.equal(await page.evaluate(()=>aimSession().results.length),80);
 await page.evaluate(()=>{S.cards=S.cards.slice(0,19);});
 await page.getByRole('button',{name:'Neue AIM-Session',exact:true}).click();
 assert.equal(await page.evaluate(()=>aimSession().position),80);
 // The original board still uses its four directed orthogonal brainstorm relations.
 await page.evaluate(stable=>{S=JSON.parse(stable);},stable);
 await page.getByRole('button',{name:'Kartenboard',exact:true}).click();
 const boardState=await page.evaluate(()=>JSON.stringify(S));
 await page.getByRole('button',{name:'AIM · Schreiben',exact:true}).click();
 assert.equal(await page.evaluate(()=>JSON.stringify(S)),boardState);
 await page.getByRole('button',{name:'Kartenboard',exact:true}).click();
 await page.evaluate(()=>brainstormSelectCard(brainstormOrder[0]));
 assert.equal(await page.evaluate(()=>brainstormRelationsForCard(brainstormOrder[0]).length),4);
 // A failed AIM transaction must not swallow a pending ordinary card save.
 for (const action of ['start','advance']) {
   const isolated=await browser.newContext(); const regression=await isolated.newPage();
   try {
     await regression.goto(process.env.RILKE_TEST_URL || 'http://127.0.0.1:8000/');
     await regression.waitForFunction(()=>_persistenceReady);
     const outcome=await regression.evaluate(async action=>{
       for(let i=0;i<20;i++) createCardInMemory('Pending-save fixture '+i,'',null);
       await save();
       if(action==='advance') await startAimSession();
       window.baseSession=JSON.stringify(S.matrixSessions);
       window.baseRelations=JSON.stringify(S.pairRelations);
       window.baselineCount=S.cards.length;
       window.regressionRealWrite=idbSetState; window.aimFailures=0; window.ordinarySaved=false;
       idbSetState=async snapshot=>{
         if(JSON.stringify(snapshot.matrixSessions)!==window.baseSession) {
           window.aimFailures++; throw Error('AIM-only write failure');
         }
         await window.regressionRealWrite(snapshot); window.ordinarySaved=true;
       };
       const edited=S.cards[0];
       updateCard(edited.uid,{text:'Ordinary edit survives failed AIM '+action});
       if(action==='advance') {
         // The editor is intentionally absent here; advance reads the retained draft.
         rememberAimDraft('AIM fragment must not be committed');
         await advanceAim(0);
       } else await startAimSession();
       return {uid:edited.uid,text:edited.text};
     },action);
     await regression.waitForFunction(()=>window.ordinarySaved, null, {timeout:5000});
     assert.equal(await regression.evaluate(async uid=>(await idbGetState()).cards.find(c=>c.uid===uid).text,outcome.uid),outcome.text);
     assert.equal(await regression.evaluate(()=>window.aimFailures),1);
     assert(await regression.evaluate(async()=>{
       const disk=await idbGetState();
       return disk.cards.length===window.baselineCount && JSON.stringify(disk.pairRelations)===window.baseRelations && JSON.stringify(disk.matrixSessions)===window.baseSession;
     }));
     await regression.reload(); await regression.waitForFunction(()=>_persistenceReady);
     assert.equal(await regression.evaluate(uid=>findCard(uid).text,outcome.uid),outcome.text);
     assert.equal(await regression.evaluate(()=>_storageWriteError),false);
   } finally {await isolated.close();}
 }
 // Supported root SID reuse after archiving must not block an unrelated AIM insertion.
 const reusedContext=await browser.newContext(); const reusedPage=await reusedContext.newPage();
 try {
   await reusedPage.goto(process.env.RILKE_TEST_URL || 'http://127.0.0.1:8000/');
   await reusedPage.waitForFunction(()=>_persistenceReady);
   const result=await reusedPage.evaluate(async()=>{
     for(let i=0;i<21;i++) createCard('Root '+i,'',null);
     const archived=S.cards[S.cards.length-1]; deleteCard(archived.uid);
     const replacement=createCard('Replacement root','',null);
     clearTimeout(_saveTimer); _saveTimer=null; await save();
     const priorCount=S.cards.length;
     await startAimSession();
     const pair=aimPairs(aimSession().cardUids)[0];
     rememberAimDraft('Ein neuer Satz neben alten Nummern.');
     await advanceAim(0);
     const card=S.cards.find(c=>c.text==='Ein neuer Satz neben alten Nummern.');
     return {archivedSid:archived.sid,replacementSid:replacement.sid,position:aimSession().position,
       count:S.cards.length,priorCount,parent:card && card.parentUid,expectedParent:pair[0],
       relation:card && manualRelationBetweenCards(card.uid,pair[1]),sid:card && card.sid};
   });
   assert.equal(result.archivedSid,'21'); assert.equal(result.replacementSid,'21');
   assert.equal(result.position,1); assert.equal(result.count,result.priorCount+1);
   assert.equal(result.parent,result.expectedParent); assert.equal(result.relation.origin,'manual');
   await reusedPage.reload(); await reusedPage.waitForFunction(()=>_persistenceReady);
   assert(await reusedPage.evaluate(()=>aimSession().position===1 && S.cards.some(c=>c.text==='Ein neuer Satz neben alten Nummern.')));
 } finally {await reusedContext.close();}
 assert.deepEqual(errors,[]);
 console.log('PASS browser (also whitespace, skip cancellation, parent/cycle/SID guards, order gaps, in-flight duplicates, backup/sync isolation, completion, insufficient cards): create under A/B, card view and manual relations, skip, reload/order/draft recovery, IDB failure and retry, archived card, mobile width, keyboard/focus.');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
