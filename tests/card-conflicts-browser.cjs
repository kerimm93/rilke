const { chromium } = require('playwright');
const assert = require('node:assert/strict');

// Two isolated IndexedDB/localStorage instances, real crypto and sync pipeline,
// backed by a deterministic in-process Gist HTTP fixture. No GitHub credentials.
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const pages = [];
    let revision = 0;
    let fileName;
    let writes = 0;
    const history = [];
    const revisions = new Map();
    let failPatch = false;
    function publish(text) {
      const version = 'revision-' + (++revision);
      const gist = { files: { [fileName]: { content: text } }, history: [{ version }] };
      revisions.set(version, gist);
      history.unshift({ version });
      return gist;
    }
    for (let i = 0; i < 2; i++) {
      const context = await browser.newContext();
      await context.route('https://api.github.com/**', async route => {
        const request = route.request();
        if (request.method() === 'PATCH') {
          if (failPatch) return route.fulfill({ status: 500, body: '{}' });
          writes++;
          const files = request.postDataJSON().files;
          return route.fulfill({ json: publish(Object.values(files)[0].content) });
        }
        const path = new URL(request.url()).pathname.split('/').pop();
        const gist = path === 'commits' ? history : revisions.get(path) || revisions.get('revision-' + revision);
        await route.fulfill({ json: gist, headers: { ETag: String(revision) } });
      });
      const page = await context.newPage();
      page.on('dialog', dialog => dialog.accept());
      await page.goto(process.env.RILKE_TEST_URL || 'http://127.0.0.1:8000/');
      await page.waitForFunction(() => _persistenceReady);
      pages.push(page);
    }
    const [a, b] = pages;
    fileName = await a.evaluate(() => GIST_FILE);
    // Adapt the fixture to the repository's actual file contract.
    const base = await a.evaluate(() => {
      const state = createDefaultState();
      state.cards = [{ uid:'poem', sid:'2', text:'Die Füße schwer in ihren Schuhen.', comment:'Ausgang', parentUid:null, childUids:[], order:0, status:'active', createdAt:'2026-01-01T00:00:00.000Z' }];
      return state;
    });
    async function envelope(state, parent) {
      return a.evaluate(async ({ state, parent }) => JSON.stringify(await encryptSyncPayload(buildRilkeSyncPayload(state, now(), { ancestorFingerprints:parent ? [parent] : [], parentFingerprints:parent ? [parent] : [] }), 'test-passphrase')), { state, parent });
    }
    const baseFp = await a.evaluate(state => fingerprintComparableState(buildRilkeSyncComparableState(state)), base);
    const baseGist = publish(await envelope(base));
    async function prepare(page, text, comment = 'Ausgang') {
      await page.evaluate(async ({ base, text, comment, baseFp, rev }) => {
        closeModal();
        S = cloneState(base); S.cards[0].text = text; S.cards[0].comment = comment;
        await persistCandidateState(S, 'test');
        localStorage.setItem(GIST_ID_KEY, 'test-gist'); localStorage.setItem(GIST_TOKEN_KEY, 'fixture-token');
        _syncPassphraseSession = 'test-passphrase';
        rememberConfirmedSyncBaseline(baseFp, rev);
      }, { base, text, comment, baseFp, rev:baseGist.history[0].version });
    }
    async function start(page) { await page.evaluate(() => { window.testSync = gistSyncManual(); }); }
    async function finish(page) { await page.evaluate(() => window.testSync); }
    async function choose(page, mode) {
      await page.getByLabel('Entscheidung Karte 0', { exact:true }).selectOption(mode);
    }
    async function apply(page) { await page.getByRole('button', { name:'Entscheidungen prüfen und synchronisieren' }).click(); await finish(page); }
    async function remoteVersion(text = 'Gist-Fassung') {
      const state = structuredClone(base); state.cards[0].text = text; state.cards[0].comment = 'Gist-Kommentar';
      return publish(await envelope(state, baseFp));
    }
    await prepare(a, 'Lokale Fassung');
    await remoteVersion();
    await start(a);
    const dialog = a.locator('dialog');
    await dialog.waitFor();
    const appearance = await dialog.evaluate(element => {
      const style = getComputedStyle(element);
      return { background:style.backgroundColor, left:element.getBoundingClientRect().left };
    });
    assert.notEqual(appearance.background, 'rgba(0, 0, 0, 0)');
    assert.ok(appearance.left > 0);
    if (process.env.RILKE_CONFLICT_SCREENSHOT) await a.screenshot({ path:process.env.RILKE_CONFLICT_SCREENSHOT });
    assert.match(await dialog.innerText(), /Lokale Fassung/);
    assert.match(await dialog.innerText(), /Gist-Fassung/);
    assert.match(await dialog.innerText(), /Die Füße schwer/);
    await a.getByRole('button', { name:'Entscheidungen prüfen und synchronisieren' }).click();
    assert.equal(await dialog.isVisible(), true);
    assert.equal(writes, 0);
    await choose(a, 'merge');
    await a.getByLabel('Text Karte 0', { exact:true }).fill('Vereinter Text\n  mit Leerraum');
    await a.getByLabel('Kommentar Karte 0', { exact:true }).fill('Beide Kommentare');
    await a.getByRole('button', { name:'Abbrechen', exact:true }).click(); await finish(a);
    await a.reload(); await a.waitForFunction(() => _persistenceReady);
    await a.evaluate(() => { _syncPassphraseSession = 'test-passphrase'; });
    await start(a); await dialog.waitFor();
    assert.equal(await a.getByLabel('Text Karte 0', { exact:true }).inputValue(), 'Vereinter Text\n  mit Leerraum');
    // A local change while the comparison is open invalidates the decision.
    await a.evaluate(() => { S.cards[0].comment = 'Zwischenzeitlich lokal'; });
    await apply(a);
    assert.equal(writes, 0);
    assert.match(await a.locator('#modal-body').innerText(), /haben sich geändert/);
    assert.equal(await a.evaluate(() => S.cards[0].comment), 'Zwischenzeitlich lokal');
    await prepare(a, 'Lokale Fassung');
    await start(a); await dialog.waitFor(); await choose(a, 'local');
    await remoteVersion('Neue Gist-Fassung');
    await apply(a); assert.equal(writes, 0);
    assert.match(await a.locator('#modal-body').innerText(), /haben sich geändert/);
    // IndexedDB failure leaves local data and the saved conflict draft intact.
    await prepare(a, 'Lokale Fassung'); await start(a); await dialog.waitFor(); await choose(a, 'remote');
    await a.evaluate(() => { window.originalEnqueue = enqueueStateWrite; enqueueStateWrite = async () => { throw new Error('Injected write failure'); }; });
    await apply(a); assert.equal(writes, 0);
    assert.equal(await a.evaluate(() => S.cards[0].text), 'Lokale Fassung');
    await a.evaluate(() => { enqueueStateWrite = window.originalEnqueue; });
    // A write through another database connection also invalidates the decision.
    await prepare(a, 'Lokale Fassung'); await start(a); await dialog.waitFor(); await choose(a, 'local');
    await a.evaluate(async () => {
      const changed = await idbGetState(); changed.cards[0].text = 'Anderer Tab';
      await idbSetState(changed);
    });
    await apply(a); assert.equal(writes, 0);
    assert.equal(await a.evaluate(async () => (await idbGetState()).cards[0].text), 'Anderer Tab');
    // A racing write after validation is caught atomically by the IDB transaction.
    await prepare(a, 'Lokale Fassung'); await start(a); await dialog.waitFor(); await choose(a, 'local');
    await a.evaluate(() => {
      window.originalEnqueue = enqueueStateWrite;
      let inject = true;
      enqueueStateWrite = async function(state, expected) {
        if (inject && expected) {
          inject = false;
          const newer = await idbGetState(); newer.cards[0].text = 'Schreibrennen';
          await idbSetState(newer);
        }
        return window.originalEnqueue(state, expected);
      };
    });
    await apply(a); assert.equal(writes, 0);
    assert.equal(await a.evaluate(async () => (await idbGetState()).cards[0].text), 'Schreibrennen');
    await a.evaluate(() => { enqueueStateWrite = window.originalEnqueue; });
    // Remote write failure rolls the local candidate back, preserving the draft.
    await prepare(a, 'Lokale Fassung'); await start(a); await dialog.waitFor(); await choose(a, 'merge');
    await a.getByLabel('Text Karte 0', { exact:true }).fill('Endfassung');
    failPatch = true; await apply(a); failPatch = false;
    assert.equal(await a.evaluate(() => S.cards[0].text), 'Lokale Fassung');
    await start(a); await dialog.waitFor();
    assert.equal(await a.getByLabel('Text Karte 0', { exact:true }).inputValue(), 'Endfassung');
    await apply(a);
    assert.equal(await a.evaluate(() => S.cards[0].text), 'Endfassung');
    assert.equal(await a.evaluate(() => _syncUiState.status), 'success');
    // Instance B adopts the result, then both independently prove no-op convergence.
    await prepare(b, base.cards[0].text);
    await start(b); await finish(b);
    assert.equal(await b.evaluate(() => S.cards[0].text), 'Endfassung');
    const writesBeforeNoop = writes;
    for (const page of pages) {
      await start(page); await finish(page);
      assert.equal(await page.evaluate(() => _syncUiState.resultKind), 'noop');
    }
    assert.equal(writes, writesBeforeNoop);
    assert.equal(await a.evaluate(() => getComparableStateString(S)), await b.evaluate(() => getComparableStateString(S)));
    // Each whole-version choice also completes through the actual sync entry point.
    for (const mode of ['local', 'remote']) {
      await prepare(a, 'Lokale Fassung'); await remoteVersion('Gist-Auswahl');
      await start(a); await dialog.waitFor(); await choose(a, mode); await apply(a);
      assert.equal(await a.evaluate(() => S.cards[0].text), mode === 'local' ? 'Lokale Fassung' : 'Gist-Auswahl');
      assert.equal(await a.evaluate(() => _syncUiState.status), 'success');
      await start(a); await finish(a);
      assert.equal(await a.evaluate(() => _syncUiState.resultKind), 'noop');
    }
    // Conflict draft storage failure blocks adoption while retaining the typed memory draft.
    await prepare(a, 'Lokale Fassung'); await remoteVersion(); await start(a); await dialog.waitFor();
    await choose(a, 'merge');
    await a.evaluate(() => {
      window.originalStorageSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === CARD_CONFLICT_DRAFT_KEY) throw new Error('Injected quota failure');
        return window.originalStorageSet.call(this, key, value);
      };
    });
    await a.getByLabel('Text Karte 0', { exact:true }).fill('Speicherentwurf');
    await a.getByRole('button', { name:'Entscheidungen prüfen und synchronisieren' }).click();
    assert.equal(await dialog.isVisible(), true);
    assert.equal(await a.evaluate(() => S.cards[0].text), 'Lokale Fassung');
    await a.evaluate(() => { Storage.prototype.setItem = window.originalStorageSet; });
    await a.getByRole('button', { name:'Abbrechen', exact:true }).click(); await finish(a);
    await start(a); await dialog.waitFor();
    assert.equal(await a.getByLabel('Text Karte 0', { exact:true }).inputValue(), 'Speicherentwurf');
    await a.getByRole('button', { name:'Abbrechen', exact:true }).click(); await finish(a);
    // An initialized first sync without a baseline still requires an explicit choice.
    await prepare(a, 'Erstsync lokal'); await remoteVersion('Erstsync Gist');
    await a.evaluate(() => clearConfirmedSyncBaselineVerified());
    await start(a); await dialog.waitFor();
    assert.match(await dialog.innerText(), /kein gemeinsamer Ausgangsstand verifiziert/);
    await choose(a, 'local'); await apply(a);
    assert.equal(await a.evaluate(() => S.cards[0].text), 'Erstsync lokal');
    assert.equal(await a.evaluate(() => _syncUiState.status), 'success');
    await start(a); await finish(a);
    assert.equal(await a.evaluate(() => _syncUiState.resultKind), 'noop');
    // Structural conflicts show human-readable references and reject cycles.
    const validation = await a.evaluate(() => {
      const local = cloneState(S), remote = cloneState(S);
      remote.cards[0].order = 3;
      const conflicts = collectCardConflicts(local, remote);
      const fields = cardConflictFields(conflicts[0].local, conflicts[0].remote, local.cards[0]);
      const reference = conflictFieldValue({parentUid:'poem'}, 'parentUid', local);
      remote.cards[0].parentUid = 'poem';
      let rejected = false;
      try { validateConflictHierarchy(remote); } catch (e) { rejected = true; }
      return { fields, reference, rejected };
    });
    assert.deepEqual(validation.fields, ['order']);
    assert.match(validation.reference, /2 · Erstsync lokal/); assert.equal(validation.rejected, true);
    console.log('PASS card conflicts: comparison/baseline, structural fields, merge draft/reload, cancellation, stale local/remote decisions, IndexedDB/PATCH failures, retry, two isolated instances and bilateral no-op convergence (mock Gist HTTP, real crypto).');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
