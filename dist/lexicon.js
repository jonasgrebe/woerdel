import createRuntime from './vendor/hunspell.js';

// Genuine Hunspell, with its dictionary and WASM entirely hosted alongside the app.
// The small local adapter avoids unrelated package-loader and ID dependencies.
export async function createSpellchecker(affBytes, dicBytes) {
  const { runtime } = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Wörterbuchstart dauert zu lange.')), 15000);
    const options = {
      onRuntimeInitialized() { clearTimeout(timeout); resolve({ runtime: options }); },
      onAbort(reason) { clearTimeout(timeout); reject(new Error(String(reason))); },
      print() {},
      printErr() {},
    };
    try { createRuntime(options); } catch (error) { clearTimeout(timeout); reject(error); }
  });
  runtime.FS.writeFile('/de.aff', affBytes);
  runtime.FS.writeFile('/de.dic', dicBytes);
  const create = runtime.cwrap('Hunspell_create', 'number', ['string', 'string']);
  const spell = runtime.cwrap('Hunspell_spell', 'number', ['number', 'string']);
  const destroy = runtime.cwrap('Hunspell_destroy', null, ['number']);
  const pointer = create('/de.aff', '/de.dic');
  if (!pointer) throw new Error('Das deutsche Wörterbuch konnte nicht geöffnet werden.');
  const cache = new Map();
  return {
    accepts(tiles) {
      if (!/^[A-ZÄÖÜẞ]{4,8}$/.test(tiles)) return false;
      if (cache.has(tiles)) return cache.get(tiles);
      const lower = tiles.normalize('NFC').replace(/ẞ/g, 'ß').toLocaleLowerCase('de-DE');
      const title = lower[0].toLocaleUpperCase('de-DE') + lower.slice(1);
      const accepted = Boolean(spell(pointer, lower) || spell(pointer, title) || spell(pointer, tiles));
      if (cache.size > 2000) cache.clear();
      cache.set(tiles, accepted);
      return accepted;
    },
    dispose() { destroy(pointer); cache.clear(); },
  };
}

let pending;
export function loadLexicon() {
  if (pending) return pending;
  const get = async path => {
    const response = await fetch(new URL(path, import.meta.url), { signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw new Error('Wörterbuch konnte nicht geladen werden.');
    return new Uint8Array(await response.arrayBuffer());
  };
  pending = Promise.all([get('./dictionary/de.aff'), get('./dictionary/de.dic')])
    .then(([aff,dic]) => createSpellchecker(aff,dic))
    .catch(error => { pending = null; throw error; });
  return pending;
}
