const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');

function functionSource(name) {
  const pattern = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
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

const names = [
  'isCompositionStatus', 'compositionStatus', 'compositionNote', 'createDefaultState', 'cloneState', 'stableStringify', 'normalizedStateCloneForComparison', 'stateComparableSnapshot', 'getComparableStateString', 'fingerprintComparableState', 'isCredentialKey', 'getObjectFreshness', 'mergeObjects', 'entityMap', 'mergeDeletedIds', 'chooseArchivedRecoveryVersion', 'applyMergedTombstone', 'mergeEntityArray', 'normalizeStateObject', 'syncFail', 'buildRilkeSyncState',
  'buildRilkeSyncComparableState', 'uniqueFingerprintList',
  'boundedAncestorFingerprints', 'buildSyncMetaForState',
  'buildRilkeSyncPayload', 'validateSyncMeta', 'assertNoCredentialKeys',
  'validIso', 'validateSyncPayload', 'validateLocalSyncPayload',
  'makeWriteResult', 'writeWithVerify'
];

let encrypted = 0;
let patched = 0;
const context = {
  console,
  SYNC_PAYLOAD_FORMAT:'rilke-sync',
  SYNC_VERSION:1,
  normalizeSid:value=>value,
  getDeviceId:()=> 'test-device',
  getDeviceName:()=> 'Test',
  now:()=> '2026-09-29T00:00:00.000Z',
  encryptSyncPayload:async()=>{ encrypted++; return {}; },
  patchRemote:async()=>{ patched++; return {revision:'unexpected'}; }
};
vm.createContext(context);
new vm.Script(names.map(functionSource).join('\n'), {filename:'index.html:composition-sync-smoke'}).runInContext(context);

function stateWith(compositions) {
  return {cards:[], pairRelations:[], compositions, matrixSessions:[], deletedIds:{}, config:{}};
}

const historical = {uid:'comp_old', title:'Alt', createdAt:'2026-01-01T00:00:00.000Z'};
const missingState = stateWith([historical]);
assert.equal(context.normalizeStateObject(missingState, {silent:true}), true);
assert.deepEqual(Array.from(historical.cardUids), []);
assert.equal(historical.uid, 'comp_old');
assert.equal(historical.createdAt, '2026-01-01T00:00:00.000Z');
assert.equal(Object.prototype.hasOwnProperty.call(historical, 'updatedAt'), false);

const nullComposition = {uid:'comp_null', title:'Alt', cardUids:null, createdAt:'2026-01-02T00:00:00.000Z'};
context.normalizeStateObject(stateWith([nullComposition]), {silent:true});
assert.deepEqual(Array.from(nullComposition.cardUids), []);
assert.equal(Object.prototype.hasOwnProperty.call(nullComposition, 'updatedAt'), false);

const invalidTypeComposition = {uid:'comp_string', title:'Alt', cardUids:'legacy-unknown'};
context.normalizeStateObject(stateWith([invalidTypeComposition]), {silent:true});
assert.deepEqual(Array.from(invalidTypeComposition.cardUids), []);

const valid = {
  uid:'comp_valid', title:'Gedicht', cardUids:['a', 'b', 'c'],
  createdAt:'2026-01-03T00:00:00.000Z', updatedAt:'2026-01-04T00:00:00.000Z', historicalField:'keep'
};
const validBefore = context.cloneState(valid);
const validArray = valid.cardUids;
context.normalizeStateObject(stateWith([valid]), {silent:true});
assert.deepEqual(valid, validBefore);
assert.strictEqual(valid.cardUids, validArray);

const validPayload = context.buildRilkeSyncPayload(stateWith([valid]), context.now(), {});
const materialized = context.validateSyncPayload(validPayload);
assert.deepEqual(Array.from(materialized.compositions[0].cardUids), ['a', 'b', 'c']);

(async function() {
  const duplicateUidState = stateWith([
    {uid:'duplicate', title:'A', cardUids:[]},
    {uid:'duplicate', title:'B', cardUids:[]}
  ]);
  await assert.rejects(
    context.writeWithVerify(duplicateUidState, {initialized:false}, 'gist', 'token', 'passphrase', {}),
    error => error.phase === 'Lokaler Sync-State ungültig' && /Doppelte UID in compositions/.test(error.message)
  );
  assert.equal(encrypted, 0, 'invalid local payload must fail before encryption');
  assert.equal(patched, 0, 'invalid local payload must not reach patchRemote');

  const note = '  Übergang prüfen.\n\n<script>alert("test")</script>  ';
  for (const status of ['draft','finished','published']) {
    const entity = {...valid, note, status};
    const payload = context.buildRilkeSyncPayload(stateWith([entity]), context.now(), {});
    const checked = context.validateSyncPayload(payload);
    assert.equal(checked.compositions[0].note, note);
    assert.equal(checked.compositions[0].status, status);
    assert.equal(checked.compositions[0].historicalField, 'keep');
  }
  const legacyPayload = context.buildRilkeSyncPayload(stateWith([valid]), context.now(), {});
  const legacy = context.validateSyncPayload(legacyPayload).compositions[0];
  assert(!Object.hasOwn(legacy,'note'));
  assert(!Object.hasOwn(legacy,'status'));
  const legacyBefore = JSON.stringify(legacy);
  assert.equal(context.compositionNote(legacy),'');
  assert.equal(context.compositionStatus(legacy),'draft');
  assert.equal(JSON.stringify(legacy),legacyBefore);
  for (const [field, values] of [['note',[null,42,[],{}]],['status',[null,42,[],{},'active','archived','invalid']]]) {
    for (const value of values) {
      const state = stateWith([{...valid,[field]:value}]);
      const payload = context.buildRilkeSyncPayload(state, context.now(), {});
      assert.throws(()=>context.validateSyncPayload(payload), e=>e.phase==='Payload-Validierung');
      await assert.rejects(context.writeWithVerify(state,{initialized:false},'gist','token','passphrase',{}),e=>e.phase==='Lokaler Sync-State ungültig');
      assert.equal(encrypted,0);
      assert.equal(patched,0);
    }
  }
  const original = stateWith([valid]);
  const noted = stateWith([{...valid,note}]);
  const published = stateWith([{...valid,status:'published'}]);
  for (const modified of [noted,published]) {
    assert.notEqual(context.stableStringify(context.buildRilkeSyncComparableState(original)),context.stableStringify(context.buildRilkeSyncComparableState(modified)));
    assert.notEqual(context.fingerprintComparableState(original),context.fingerprintComparableState(modified));
  }
  assert.notEqual(context.fingerprintComparableState(original),context.fingerprintComparableState(stateWith([{...valid,status:'draft'}])));
  const newer = {...valid,note,status:'published',updatedAt:'2026-02-01T00:00:00.000Z'};
  for(const pair of [[valid,newer],[newer,valid]]) {
    const merged = context.mergeEntityArray([pair[0]],[pair[1]],{},'compositions');
    assert.equal(merged[0].note,note);
    assert.equal(merged[0].status,'published');
  }
  assert.throws(()=>context.mergeObjects(valid,{...valid,note},'compositions'),/Freshness/);
  assert.equal(context.mergeEntityArray([valid],[newer],{[valid.uid]:'2026-03-01T00:00:00.000Z'},'compositions').length,0);
  assert.throws(()=>context.mergeEntityArray([valid],[newer],{[valid.uid]:'2026-01-15T00:00:00.000Z'},'compositions'),/Delete-vs-Edit/);
  const result = await context.writeWithVerify(noted,{initialized:true,state:context.cloneState(noted),revision:'same'},'gist','token','passphrase',{});
  assert.equal(result.kind,'noop');
  assert.equal(encrypted,0); assert.equal(patched,0);
  console.log('composition sync smoke tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
