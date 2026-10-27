// T2: authored in-memory values. Executes the actual client module with every
// platform/provider import mocked; no browser, device, account or network calls.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require(process.env.DEARWEEK_TYPESCRIPT_PATH || 'typescript');
const sourcePath = process.env.DEARWEEK_PHOTO_API_SOURCE || fileURLToPath(new URL('../../src/lib/api.ts', import.meta.url));
const compiled = ts.transpileModule(readFileSync(sourcePath, 'utf8'), {
  fileName: 'api.ts', reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
});
assert.equal((compiled.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error).length, 0);

const photo = { id: 'authored-photo', memory_id: 'authored-memory', uploader_id: 'authored-user',
  storage_path: 'authored-family/authored-memory/authored-photo.jpg', content_type: 'image/jpeg',
  byte_size: 4, state: 'ready', created_at: '2026-10-27T00:00:00Z' };
const signedIn = () => ({ data: { user: { id: 'authored-user' } }, error: null });
const downloaded = () => ({ data: { authored: true }, error: null });
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
async function until(predicate) {
  for (let attempt = 0; attempt < 20; attempt++) {
    if (predicate()) return;
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.ok(predicate(), 'The controlled operation must reach its expected boundary.');
}

function harness() {
  const calls = { auth: 0, downloads: [], created: [], revoked: [] };
  let auth = async () => signedIn();
  let download = async () => downloaded();
  const client = {
    auth: { getUser: () => { calls.auth++; return auth(); } },
    storage: { from: bucket => {
      assert.equal(bucket, 'memory-photos');
      return { download: path => { calls.downloads.push(path); return download(path); } };
    } },
  };
  const forbidden = () => { throw new Error('Unexpected platform, network or mutation call in a pure cache test.'); };
  const imports = {
    'react-native-url-polyfill/auto': {},
    '@react-native-async-storage/async-storage': {},
    '@supabase/supabase-js': { createClient: () => client, processLock: forbidden },
    'react-native': { Platform: { OS: 'web' }, AppState: { addEventListener: forbidden } },
    'expo-linking': { createURL: forbidden },
    'expo-image-picker': { launchImageLibraryAsync: forbidden },
    'expo-image-manipulator': { ImageManipulator: { manipulate: forbidden }, SaveFormat: { JPEG: 'jpeg' } },
    'expo-file-system': { File: class { constructor() { forbidden(); } } },
    '../../supabase/functions/_shared/project': { publicProject: {
      url: 'https://authored-cache-test.supabase.co', publishableKey: 'sb_publishable_authored_cache_test_only',
      siteUrl: 'https://dearweek.example.invalid', emailDeliveryVerified: false,
    } },
  };
  class AuthoredURL extends URL {
    static createObjectURL() {
      const uri = `blob:authored-${calls.created.length + 1}`;
      calls.created.push(uri);
      return uri;
    }
    static revokeObjectURL(uri) { calls.revoked.push(uri); }
  }
  const exported = {};
  const context = vm.createContext({
    module: { exports: exported }, exports: exported, URL: AuthoredURL, fetch: forbidden,
    process: { env: {} },
    require: name => {
      assert.ok(Object.hasOwn(imports, name), `Unreviewed import: ${name}`);
      return imports[name];
    },
  });
  new vm.Script(compiled.outputText, { filename: 'dearweek-client-api.mocked.cjs' }).runInContext(context);
  return { api: exported, calls, setAuth: handler => { auth = handler; }, setDownload: handler => { download = handler; } };
}

test('ordinary loads recheck Auth, reuse one cached URI and revoke it on clear', async () => {
  const h = harness();
  const first = await h.api.loadPhoto(photo);
  assert.equal(await h.api.loadPhoto(photo), first);
  assert.equal(h.calls.auth, 2);
  assert.deepEqual(h.calls.downloads, [photo.storage_path]);
  h.api.clearPhotoCache();
  assert.deepEqual(h.calls.revoked, [first]);
});

test('pending photos and signed-out users never download image bytes', async () => {
  const h = harness();
  await assert.rejects(h.api.loadPhoto({ ...photo, state: 'pending' }), /not finished uploading/);
  assert.equal(h.calls.auth, 0);
  h.setAuth(async () => ({ data: { user: null }, error: null }));
  await assert.rejects(h.api.loadPhoto(photo), /Sign in again/);
  assert.equal(h.calls.downloads.length, 0);
});

test('clearing while Auth is pending rejects the old load before any download', async () => {
  const h = harness(), auth = deferred();
  h.setAuth(() => auth.promise);
  const loading = h.api.loadPhoto(photo);
  const rejected = assert.rejects(loading, /family view changed/);
  h.api.clearPhotoCache();
  auth.resolve(signedIn());
  await rejected;
  assert.deepEqual(h.calls.downloads, []);
  assert.deepEqual(h.calls.created, []);
});

test('clearing during download revokes the stale result and never caches it', async () => {
  const h = harness(), download = deferred();
  h.setDownload(() => download.promise);
  const loading = h.api.loadPhoto(photo);
  const rejected = assert.rejects(loading, /family view changed/);
  await until(() => h.calls.downloads.length === 1);
  h.api.clearPhotoCache();
  download.resolve(downloaded());
  await rejected;
  assert.deepEqual(h.calls.revoked, h.calls.created);
  h.setDownload(async () => downloaded());
  await h.api.loadPhoto(photo);
  assert.equal(h.calls.downloads.length, 2);
});

test('a stale force request cannot revoke or replace the new view cache', async () => {
  const h = harness();
  await h.api.loadPhoto(photo);
  const auth = deferred();
  h.setAuth(() => auth.promise);
  const stale = h.api.loadPhoto(photo, { force: true });
  const rejected = assert.rejects(stale, /family view changed/);
  h.api.clearPhotoCache();
  h.setAuth(async () => signedIn());
  const current = await h.api.loadPhoto(photo);
  const revocationsBefore = [...h.calls.revoked];
  auth.resolve(signedIn());
  await rejected;
  assert.deepEqual(h.calls.revoked, revocationsBefore);
  assert.equal(await h.api.loadPhoto(photo), current);
  assert.equal(h.calls.downloads.length, 2);
});

for (const order of [[0, 1], [1, 0]]) {
  test(`overlapping downloads share one owned URI when request ${order[0] + 1} completes first`, async () => {
    const h = harness(), downloads = [deferred(), deferred()];
    let index = 0;
    h.setDownload(() => downloads[index++].promise);
    const requests = [h.api.loadPhoto(photo), h.api.loadPhoto(photo)];
    await until(() => h.calls.downloads.length === 2);
    downloads[order[0]].resolve(downloaded());
    const first = await requests[order[0]];
    downloads[order[1]].resolve(downloaded());
    const second = await requests[order[1]];
    assert.equal(second, first);
    assert.equal(await h.api.loadPhoto(photo), first);
    h.api.clearPhotoCache();
    assert.deepEqual([...h.calls.revoked].sort(), [...h.calls.created].sort());
    assert.equal(new Set(h.calls.revoked).size, h.calls.revoked.length);
  });
}

test('an Auth error cannot return an otherwise cached private image', async () => {
  const h = harness();
  await h.api.loadPhoto(photo);
  h.setAuth(async () => ({ data: { user: null }, error: { message: 'Authored Auth failure' } }));
  await assert.rejects(h.api.loadPhoto(photo), /Sign in again/);
  assert.equal(h.calls.downloads.length, 1);
});

test('a current force refresh evicts the old URI and surfaces download failure', async () => {
  const h = harness();
  const first = await h.api.loadPhoto(photo);
  h.setDownload(async () => ({ data: null, error: { message: 'Authored download failure' } }));
  await assert.rejects(h.api.loadPhoto(photo, { force: true }), /Authored download failure/);
  assert.deepEqual(h.calls.revoked, [first]);
  h.setDownload(async () => downloaded());
  const next = await h.api.loadPhoto(photo);
  assert.notEqual(next, first);
  assert.equal(h.calls.downloads.length, 3);
});
