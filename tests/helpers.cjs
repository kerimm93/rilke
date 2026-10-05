const fs = require('node:fs');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script, {filename: 'index.html'});
function app() {
  const elements = new Map(), store = new Map();
  const ctx = vm.createContext({console, crypto:webcrypto, TextEncoder, TextDecoder, URL, Blob, AbortController, btoa, atob, setTimeout, clearTimeout,
    location:{protocol:'https:',origin:'https://test.example'}, navigator:{},
    document:{addEventListener(){},getElementById(id){if(!elements.has(id))elements.set(id,{style:{},textContent:'',innerHTML:'',value:'',disabled:false});return elements.get(id);},documentElement:{dataset:{}},body:{dataset:{},classList:{remove(){}}}},
    window:{addEventListener(){},scrollTo(){}},
    localStorage:{setItem(k,v){store.set(k,v);},getItem(k){return store.get(k)||null;}}
  });
  vm.runInContext(script, ctx);ctx.C=ctx.defaultConfig();ctx.S=ctx.defaultState();ctx.S.intake.start_at='2026-09-01T00:00:00.000Z';ctx.tell=()=>{};ctx.render=()=>{};ctx.renderBusy=()=>{};ctx.ask=async()=>true;
  return ctx;
}
function source(id='101', changes={}) {return {id,text:'Ein Gedanke wird klarer, wenn ich ihn selbst erkläre.',note:'Meine erste Verbindung',title:'Testquelle',author:'Testautor',category:'books',source_url:'https://example.org/book',cover_url:'',readwise_url:'https://readwise.io/open/'+id,reader_document_id:null,readwise_book_id:'42',tags:[],created_at:'2026-09-22T12:00:00.000Z',highlighted_at:'2026-09-22T12:00:00.000Z',updated_at:'2026-09-22T12:00:00.000Z',deleted:false,...changes};}
function seed(a, sources=[source()]) {a.S=a.ingest(a.S,sources,'2026-09-24T10:00:00.000Z',true).state;return a.S;}
function session(a, ids=a.S.candidates.map(c=>c.id), workflow='anki'){const r=a.newSession(a.S,ids,workflow);a.S=r.state;return a.S.sessions.at(-1);}
function payload(){return {target_deck:null,target_model:null,core_fields:{Frage:'Wie kann ich mein Verständnis eines Gedankens prüfen?',Antwort:'Indem ich ihn in eigenen Worten erkläre und an einem Beispiel anwende.',Zitat:'Ein Gedanke wird klarer, wenn ich ihn selbst erkläre.',Notizen:'',Medien:'',Tags:'lernen metakognition'},learning_fields:{feynman_explanation:'Wenn mir Worte oder Beispiele fehlen, sehe ich meine Lücke.',mnemonic:null}};}
function handoff(a,s,mode='anki') {
 const items=s.items.map(i=>({highlight_id:i.highlight_id,outcome:mode==='discard'?'discarded':mode==='defer'?'deferred':'processed',route:mode,user_processing:{own_words:'Ich kann es erst, wenn ich es erklären kann.',key_distinction:null,open_question:null,possible_intermediate_packet_use:null},artifacts:mode==='reading_journal'?[{system:'notion',target:'Reading Journal',action:'created',url:'https://www.notion.so/12345678901234567890123456789012',id:null}]:[],anki:mode==='anki'?{status:'ready_for_sync',...payload()}:null,notes:''}));
 return {type:'readwise-workbench-handoff-v2',version:'2.0',session:{session_id:s.id,input_count:items.length,completed_at:null},items,summary:a.summarizeHandoff(items),errors:[]};
}
module.exports={app,source,seed,session,payload,handoff,html,script};
