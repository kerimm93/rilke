const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const begin = html.indexOf('function aimNeighbors(');
const end = html.indexOf('function aimDraftKey(', begin);
const context = {S:{matrixSessions:[]}};
vm.createContext(context);
new vm.Script(html.slice(begin,end)).runInContext(context);
const order = Array.from({length:20},(_,i)=>'card-'+i);
for(let i=0;i<20;i++) {
  const neighbors=Array.from(context.aimNeighbors(i));
  assert.equal(neighbors.length,8); assert.equal(new Set(neighbors).size,8);
  assert(!neighbors.includes(i));
  for(const n of neighbors) assert(context.aimNeighbors(n).includes(i));
}
assert.deepEqual(Array.from(context.aimNeighbors(0)),[19,15,16,4,1,9,5,6]);
const pairs=JSON.parse(JSON.stringify(context.aimPairs(order)));
assert.equal(pairs.length,80);
assert.equal(new Set(pairs.map(p=>JSON.stringify(p.slice().sort()))).size,80);
assert(pairs.every(([a,b])=>a!==b));
for(const u of order) assert.equal(pairs.filter(p=>p.includes(u)).length,8);
assert.deepEqual(JSON.parse(JSON.stringify(context.aimPairs(JSON.parse(JSON.stringify(order))))),pairs);
for(const invalid of [[],order.slice(1),[...order.slice(1),order[1]],null]) assert.equal(context.aimPairs(invalid).length,0);
context.S.matrixSessions=[{uid:'session',kind:'aim',version:1,cardUids:order,position:1,results:[{status:'saved',cardUid:'new'}]}];
assert.equal(context.aimSession().uid,'session');
context.S.matrixSessions[0].position=2;
assert.equal(context.aimSession(),undefined);
context.S.matrixSessions[0].position=1; context.S.matrixSessions[0].version=2;
assert.equal(context.aimSession(),undefined);
console.log('AIM matrix smoke passed: torus, diagonals, 80 unique pairs, degree eight, stable order, invalid sessions');

// Only new or actually rebased SIDs participate in insertion collision checks.
const a={uid:'a',sid:'1.a'}, b={uid:'b',sid:'1.b'};
context.S.cards=[a,b,{uid:'archived',sid:'21',status:'archived'},{uid:'replacement',sid:'21',status:'draft'}];
assert.equal(context.aimInsertionHasSidConflict({newSid:'1.c',changes:[]}),false);
// An unchanged SID in the insertion plan must not turn an existing duplicate into a blocker.
context.S.cards.push({uid:'old-child',sid:'1.a',status:'archived'});
assert.equal(context.aimInsertionHasSidConflict({newSid:'1.c',changes:[{card:a,sid:'1.a'}]}),false);
assert.equal(context.aimInsertionHasSidConflict({newSid:'1.a',changes:[]}),true);
assert.equal(context.aimInsertionHasSidConflict({newSid:'1.c',changes:[{card:a,sid:'1.b'}]}),true);
assert.equal(context.aimInsertionHasSidConflict({newSid:'1.c',changes:[{card:a,sid:'1.d'},{card:b,sid:'1.d'}]}),true);
context.S.cards=[a,b];
assert.equal(context.aimInsertionHasSidConflict({newSid:'1.c',changes:[{card:a,sid:'1.c'}]}),true);
assert.equal(context.aimInsertionHasSidConflict({newSid:'1.c',changes:[{card:a,sid:'1.b'},{card:b,sid:'1.a'}]}),false);
console.log('AIM insertion SID smoke passed: unrelated reuse allowed, new/rebased collisions rejected');
