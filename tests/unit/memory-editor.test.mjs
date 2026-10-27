// T2: executes the actual MemoryEditor TSX function and its returned handlers.
// React hooks, platform elements, UI and APIs are authored in-memory boundaries.
// No React renderer, native picker, browser, Auth, Storage or network executes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require(process.env.DEARWEEK_TYPESCRIPT_PATH || 'typescript');
const sourcePath = process.env.DEARWEEK_MEMORY_EDITOR_SOURCE
  || fileURLToPath(new URL('../../src/components/MemoryEditor.tsx', import.meta.url));
const compiled = ts.transpileModule(readFileSync(sourcePath, 'utf8'), {
  fileName: 'MemoryEditor.tsx', reportDiagnostics: true,
  compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.React, esModuleInterop: true,
  },
});
assert.equal((compiled.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error).length, 0);

const family = { id: 'authored-family', name: 'Authored family', timezone: 'Europe/Madrid',
  owner_id: 'authored-author', created_at: '2026-10-27T10:00:00Z' };
const members = [
  { family_id: family.id, user_id: 'authored-author', role: 'owner', display_name: 'Ari', joined_at: family.created_at },
  { family_id: family.id, user_id: 'authored-recipient', role: 'member', display_name: 'Sam', joined_at: family.created_at },
];
const photo = name => ({ uri: `authored://${name}`, mimeType: 'image/jpeg', fileName: name, fileSize: 4 });
const savedPhoto = photo('already-uploaded.jpg');
const retryPhoto = photo('retry-this.jpg');
const initialStory = 'Authored story before the partial photo failure.';
const editedStory = 'Authored unsaved edit made after the story was saved.';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

async function flush() {
  for (let turn = 0; turn < 20; turn++) await Promise.resolve();
}

async function until(predicate, description) {
  for (let turn = 0; turn < 50; turn++) {
    if (predicate()) return;
    await Promise.resolve();
  }
  assert.ok(predicate(), `The controlled component must reach: ${description}`);
}

function harness() {
  const markers = Object.fromEntries(['Button', 'Confirmation', 'Dialog', 'Field', 'Notice', 'Pill', 'Image', 'Text', 'View']
    .map(name => [name, Symbol(name)]));
  const cells = [];
  let cursor = 0;
  let rendering = false;
  let tree;
  const calls = { saves: [], uploads: [], picks: 0, refreshed: [], closed: 0 };
  let save = async () => 'authored-memory';
  let upload = async () => undefined;
  let pick = async () => null;
  let refreshed = async () => undefined;

  function cell(kind, initialize) {
    assert.ok(rendering, 'Hooks only run while the actual component renders.');
    const index = cursor++;
    if (!cells[index]) cells[index] = { kind, value: initialize() };
    assert.equal(cells[index].kind, kind, 'Hook order must remain stable.');
    return cells[index];
  }
  const react = {
    createElement(type, properties, ...children) {
      return { type, props: { ...(properties || {}), children: children.length === 1 ? children[0] : children } };
    },
    useState(initial) {
      const state = cell('state', () => typeof initial === 'function' ? initial() : initial);
      return [state.value, value => { state.value = typeof value === 'function' ? value(state.value) : value; }];
    },
    useRef(initial) { return cell('ref', () => ({ current: initial })).value; },
  };
  const forbidden = () => { throw new Error('Unexpected import, platform, network or provider call in a pure editor test.'); };
  const imports = {
    react: { __esModule: true, default: react, useState: react.useState, useRef: react.useRef },
    'react-native': { Image: markers.Image, Text: markers.Text, View: markers.View, StyleSheet: { create: value => value } },
    '../lib/api': {
      saveMemory: async (familyID, draft) => {
        calls.saves.push({ familyID, draft: structuredClone(draft) });
        return save(familyID, draft);
      },
      uploadPhoto: async (memoryID, selected) => {
        calls.uploads.push({ memoryID, photo: structuredClone(selected) });
        return upload(memoryID, selected);
      },
      pickPhoto: async () => { calls.picks++; return pick(); },
    },
    '../theme': {
      colors: { danger: 'authored-danger', line: 'authored-line', pale: 'authored-pale', ink: 'authored-ink' },
      common: { row: {}, muted: {}, body: {} },
    },
    './ui': {
      ...Object.fromEntries(['Button', 'Confirmation', 'Dialog', 'Field', 'Notice', 'Pill'].map(name => [name, markers[name]])),
      errorMessage: error => error instanceof Error ? error.message : 'Authored unexpected error',
    },
  };
  const exported = {};
  const context = vm.createContext({
    module: { exports: exported }, exports: exported, Error, fetch: forbidden,
    process: { env: {} },
    require: name => {
      assert.ok(Object.hasOwn(imports, name), `Unreviewed import: ${name}`);
      return imports[name];
    },
  });
  new vm.Script(compiled.outputText, { filename: 'dearweek-memory-editor.mocked.cjs' }).runInContext(context);
  assert.equal(typeof exported.MemoryEditor, 'function');
  const props = {
    memory: null, family: structuredClone(family), members: structuredClone(members), userId: 'authored-author', role: 'owner',
    onClose: () => { calls.closed++; },
    onSaved: async id => { calls.refreshed.push(id); return refreshed(id); },
  };

  function render() {
    if (calls.closed) return null; // App.tsx removes the editor only on onClose.
    cursor = 0;
    rendering = true;
    try { tree = exported.MemoryEditor(props); }
    finally { rendering = false; }
    assert.equal(cursor, cells.length, 'Every render must use the same hook cells.');
    return tree;
  }
  function nodes(kind) {
    const result = [];
    function visit(value) {
      if (Array.isArray(value)) { value.forEach(visit); return; }
      if (!value || typeof value !== 'object' || !Object.hasOwn(value, 'type')) return;
      if (value.type === markers[kind]) result.push(value);
      visit(value.props.children);
    }
    visit(render());
    return result;
  }
  function one(kind, predicate, label) {
    const found = nodes(kind).filter(node => predicate(node.props));
    assert.equal(found.length, 1, `Expected one current ${kind}: ${label}`);
    return found[0].props;
  }
  function field(label) { return one('Field', props => props.label === label, label); }
  function button(title) { return one('Button', props => props.title === title, title); }
  function pill(label) { return one('Pill', props => props.label === label, label); }
  function press(title) {
    const current = button(title);
    // Mirrors the reviewed ui.tsx Button boundary, rather than executing it.
    if (current.disabled || current.busy) return false;
    assert.equal(typeof current.onPress, 'function');
    current.onPress();
    render();
    return true;
  }
  function edit(label, value) {
    const current = field(label);
    assert.notEqual(current.editable, false, `Field must be editable: ${label}`);
    current.onChangeText(value);
    render();
  }
  function choose(label) {
    const current = pill(label);
    assert.equal(typeof current.onPress, 'function', `Pill must be interactive: ${label}`);
    current.onPress();
    render();
  }
  function hasSavedClaim() {
    return nodes('Notice').some(node => /\b(?:the memory|your memory|your story) is saved\b/i.test(node.props.text));
  }
  function checkDirtyClose() {
    one('Dialog', () => true, 'memory editor').onClose();
    assert.equal(calls.closed, 0, 'Closing a dirty draft must request confirmation.');
    const confirmation = one('Confirmation', () => true, 'discard unsaved changes');
    assert.match(confirmation.description, /unsaved|not been saved/i);
    confirmation.onCancel();
    render();
  }
  render();
  return {
    calls, render, nodes, field, button, pill, press, edit, choose, hasSavedClaim, checkDirtyClose,
    setSave: handler => { save = handler; }, setUpload: handler => { upload = handler; },
    setPick: handler => { pick = handler; }, setRefreshed: handler => { refreshed = handler; },
    async pickPhoto(value) {
      pick = async () => value;
      assert.ok(press('Add a photo'));
      await until(() => !button('Add a photo').busy, 'photo selection to settle');
    },
    async idle() {
      await until(() => calls.closed || !one('Button', props => props.title === 'Save memory' || props.title === 'Save changes',
        'current save action').busy, 'the editor operation to settle');
    },
  };
}

function fill(h) {
  h.edit('Give this memory a title', 'Authored family memory');
  h.edit('The story', initialStory);
  h.edit('Memory date', '2026-10-27');
}

async function partialFailure({ selected = false } = {}) {
  const h = harness();
  fill(h);
  if (selected) { h.choose('Choose people'); h.choose('Sam'); }
  await h.pickPhoto(savedPhoto);
  await h.pickPhoto(retryPhoto);
  h.setUpload(async (_id, selectedPhoto) => {
    if (selectedPhoto.fileName === retryPhoto.fileName) throw new Error('Authored photo upload failure');
  });
  assert.ok(h.press('Save memory'));
  await h.idle();
  assert.equal(h.calls.closed, 0);
  assert.equal(h.calls.saves.length, 1);
  assert.deepEqual(h.calls.uploads.map(call => call.photo.fileName), [savedPhoto.fileName, retryPhoto.fileName]);
  assert.deepEqual(h.calls.refreshed, ['authored-memory']);
  assert.ok(h.hasSavedClaim(), 'The initial saved story is acknowledged before later edits.');
  h.setUpload(async () => undefined);
  return h;
}

test('photo-only retry retains a later story edit without saving it or closing the editor', async () => {
  const h = await partialFailure();
  h.edit('The story', editedStory);
  const uploading = deferred();
  h.setUpload(() => uploading.promise);
  assert.ok(h.press('Retry unfinished photos'));
  await until(() => h.calls.uploads.length === 3, 'the controlled photo retry to start');
  assert.equal(h.button('Save changes').busy, true);
  assert.equal(h.field('The story').editable, false);
  assert.equal(h.calls.closed, 0);
  uploading.resolve();
  await h.idle();
  assert.equal(h.calls.closed, 0, 'Successful photo-only retry must not discard unsaved story edits.');
  assert.equal(h.field('The story').value, editedStory);
  assert.equal(h.calls.saves.length, 1, 'Photo retry must not silently save the edited story.');
  assert.deepEqual(h.calls.uploads.map(call => call.photo.fileName), [savedPhoto.fileName, retryPhoto.fileName, retryPhoto.fileName]);
  assert.ok(!h.hasSavedClaim(), 'The current dirty draft must not be labelled saved.');
  h.checkDirtyClose();
});

test('explicit Save changes persists the retained edit and does not upload completed photos again', async () => {
  const h = await partialFailure();
  h.edit('The story', editedStory);
  h.press('Retry unfinished photos');
  await h.idle();
  assert.equal(h.calls.closed, 0, 'The editor must remain available for an explicit Save changes.');
  const refresh = deferred();
  h.setRefreshed(() => refresh.promise);
  h.press('Save changes');
  await until(() => h.calls.saves.length === 2 && h.calls.refreshed.length === 3, 'saved edit waiting for the parent refresh');
  assert.equal(h.calls.saves[1].familyID, family.id);
  assert.equal(h.calls.saves[1].draft.id, 'authored-memory');
  assert.equal(h.calls.saves[1].draft.story, editedStory);
  assert.equal(h.calls.closed, 0, 'The editor waits for its parent refresh.');
  assert.equal(h.calls.uploads.length, 3, 'Both completed photos stay completed.');
  refresh.resolve();
  await h.idle();
  assert.equal(h.calls.closed, 1);
});

for (const mutation of [
  { name: 'visibility', selected: false, change: h => h.choose('Only me'), check: h => assert.equal(h.pill('Only me').active, true) },
  { name: 'recipient', selected: true, change: h => h.choose('✓ Sam'), check: h => assert.equal(h.pill('Sam').active, false) },
  { name: 'recipient edit grant', selected: true, change: h => h.choose('Can view'), check: h => assert.ok(h.pill('Can edit')) },
]) {
  test(`changing ${mutation.name} clears the saved claim and photo retry retains the dirty audience`, async () => {
    const h = await partialFailure({ selected: mutation.selected });
    mutation.change(h);
    assert.ok(!h.hasSavedClaim(), `Unsaved ${mutation.name} must clear the previous saved notice.`);
    h.checkDirtyClose();
    h.press('Retry unfinished photos');
    await h.idle();
    assert.equal(h.calls.closed, 0, `Photo-only retry must retain the unsaved ${mutation.name}.`);
    assert.equal(h.calls.saves.length, 1, 'Audience changes require an explicit save.');
    mutation.check(h);
    h.checkDirtyClose();
  });
}

test('a clean photo-only retry refreshes and closes without saving or reuploading successful photos', async () => {
  const h = await partialFailure();
  h.press('Retry unfinished photos');
  await h.idle();
  assert.equal(h.calls.closed, 1);
  assert.equal(h.calls.saves.length, 1);
  assert.equal(h.calls.refreshed.length, 2);
  assert.deepEqual(h.calls.uploads.map(call => call.photo.fileName), [savedPhoto.fileName, retryPhoto.fileName, retryPhoto.fileName]);
});

test('another failed photo-only retry does not claim the later unsaved story is saved', async () => {
  const h = await partialFailure();
  h.edit('The story', editedStory);
  h.setUpload(async () => { throw new Error('Authored retry failure'); });
  h.press('Retry unfinished photos');
  await h.idle();
  assert.equal(h.calls.closed, 0);
  assert.equal(h.calls.saves.length, 1);
  assert.equal(h.field('The story').value, editedStory);
  assert.ok(!h.hasSavedClaim(), 'Partial-photo error copy must not call the current dirty story saved.');
  assert.ok(h.nodes('Notice').some(node => node.props.error), 'The unfinished photo failure remains visible.');
});

test('invalid title and impossible date preserve the draft without any API mutation', async () => {
  for (const invalid of [{ label: 'Give this memory a title', value: '   ' }, { label: 'Memory date', value: '2026-02-31' }]) {
    const h = harness(); fill(h); h.edit(invalid.label, invalid.value);
    h.press('Save memory');
    await flush();
    assert.equal(h.calls.closed, 0);
    assert.equal(h.calls.saves.length, 0);
    assert.equal(h.calls.uploads.length, 0);
    assert.equal(h.calls.refreshed.length, 0);
    assert.equal(h.field(invalid.label).value, invalid.value);
    assert.ok(h.nodes('Notice').some(node => node.props.error));
    h.checkDirtyClose();
  }
});

test('a failed story save retains text and selected photos without uploading or closing', async () => {
  const h = harness(); fill(h);
  await h.pickPhoto(retryPhoto);
  const saving = deferred();
  h.setSave(() => saving.promise);
  h.press('Save memory');
  await until(() => h.calls.saves.length === 1, 'the controlled save to start');
  assert.equal(h.button('Save memory').busy, true);
  assert.equal(h.calls.uploads.length, 0);
  saving.resolve(Promise.reject(new Error('Authored story save failure')));
  await h.idle();
  assert.equal(h.calls.closed, 0);
  assert.equal(h.calls.uploads.length, 0);
  assert.equal(h.calls.refreshed.length, 0);
  assert.equal(h.field('The story').value, initialStory);
  assert.ok(h.nodes('Image').some(node => node.props.source.uri === retryPhoto.uri));
  assert.ok(!h.hasSavedClaim());
  assert.ok(h.nodes('Notice').some(node => /Authored story save failure/.test(node.props.text)));
  h.checkDirtyClose();
});

test('an outstanding picker prevents a new save, photo retry or second picker call', async () => {
  const h = await partialFailure();
  const choosing = deferred();
  h.setPick(() => choosing.promise);
  const before = { saves: h.calls.saves.length, uploads: h.calls.uploads.length, picks: h.calls.picks };
  h.press('Add a photo');
  assert.equal(h.button('Add a photo').busy, true);
  h.press('Save changes');
  h.press('Retry unfinished photos');
  // A render may already have closed the baseline editor, so only attempt the
  // second pick while it is still actually mounted.
  if (!h.calls.closed) h.press('Add a photo');
  await flush();
  choosing.resolve(null);
  await flush();
  assert.equal(h.calls.saves.length, before.saves);
  assert.equal(h.calls.uploads.length, before.uploads, 'Photo retry must not run under an outstanding picker.');
  assert.equal(h.calls.picks, before.picks + 1);
  assert.equal(h.calls.closed, 0);
});

test('a visible discard confirmation cannot close during a picker, save or parent refresh', async () => {
  for (const scenario of ['picker', 'save and refresh']) {
    const h = harness(); fill(h);
    h.nodes('Dialog')[0].props.onClose();
    assert.equal(h.nodes('Confirmation').length, 1, 'The discard confirmation is open before work begins.');
    assert.equal(h.calls.closed, 0);
    const pending = deferred();
    const refresh = deferred();
    try {
      if (scenario === 'picker') {
        h.setPick(() => pending.promise);
        h.press('Add a photo');
        assert.equal(h.calls.picks, 1);
      } else {
        h.setSave(() => pending.promise);
        h.setRefreshed(() => refresh.promise);
        h.press('Save memory');
        await until(() => h.calls.saves.length === 1, 'the save with an already-visible confirmation');
      }
      let confirmation = h.nodes('Confirmation')[0].props;
      assert.equal(confirmation.busy, true, `Discard controls must be busy during ${scenario}.`);
      // Exercise the component's confirmation callback itself, including its
      // defensive guard, independently of the mocked UI Button's disabled gate.
      confirmation.onConfirm();
      assert.equal(h.calls.closed, 0, `The confirmation must not bypass pending ${scenario}.`);
      if (scenario === 'picker') {
        pending.resolve(null);
        await until(() => !h.button('Add a photo').busy, 'the outstanding picker to finish');
        confirmation = h.nodes('Confirmation')[0].props;
        assert.notEqual(confirmation.busy, true);
        confirmation.onConfirm();
        assert.equal(h.calls.closed, 1, 'An explicit discard works once the picker has settled.');
      } else {
        pending.resolve('authored-memory');
        await until(() => h.calls.refreshed.length === 1, 'the saved memory waiting for parent refresh');
        confirmation = h.nodes('Confirmation')[0].props;
        assert.equal(confirmation.busy, true, 'Discard remains blocked until the parent refresh settles.');
        confirmation.onConfirm();
        assert.equal(h.calls.closed, 0);
        refresh.resolve();
        await h.idle();
        assert.equal(h.calls.closed, 1, 'The successful save closes through its normal completion.');
        assert.equal(h.calls.saves.length, 1);
        assert.equal(h.calls.refreshed.length, 1);
        assert.equal(h.calls.uploads.length, 0);
      }
    } finally {
      // Release authored promises even when the baseline fails an assertion.
      pending.resolve(scenario === 'picker' ? null : 'authored-memory');
      refresh.resolve();
      await flush();
    }
  }
});
