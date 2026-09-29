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
  'normalizeStateObject', 'syncFail', 'buildRilkeSyncState',
  'buildRilkeSyncComparableState', 'uniqueFingerprintList',
  'boundedAncestorFingerprints', 'buildSyncMetaForState',
  'buildRilkeSyncPayload', 'validateSyncMeta', 'assertNoCredentialKeys',
  'validIso', 'validateSyncPayload', 'validateLocalSyncPayload',
  'writeWithVerify'
];

let encrypted = 0;
let patched = 0;
const cloneState = value => JSON.parse(JSON.stringify(value));
const stableStringify = value => JSON.stringify(value);
const fingerprintComparableState = value => JSON.stringify(value);
const createDefaultState = () => ({cards:[], pairRelations:[], compositions:[], matrixSessions:[], deletedIds:{}, config:{}});
const context = {
  console,
  SYNC_PAYLOAD_FORMAT:'rilke-sync',
  SYNC_VERSION:1,
  cloneState,
  stableStringify,
  fingerprintComparableState,
  createDefaultState,
  normalizeSid:value=>value,
  isCredentialKey:()=>false,
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
const validBefore = cloneState(valid);
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
  console.log('composition sync smoke tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
