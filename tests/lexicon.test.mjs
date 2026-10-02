import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
// The shipped WASM is compiled for browsers; this minimal environment exercises
// the exact same bundled runtime without a network or browser-only test runner.
globalThis.window={};globalThis.document={currentScript:null};
const {createSpellchecker}=await import('../dist/lexicon.js');
test('full German dictionary accepts inflections, compounds and sharp S',async()=>{
  const spell=await createSpellchecker(await readFile(new URL('../dist/dictionary/de.aff',import.meta.url)),await readFile(new URL('../dist/dictionary/de.dic',import.meta.url)));
  try{
    for(const word of ['SPIELERN','HÄUSERN','LAUFEND','GESPIELT','BRÖTCHEN','GEFÜHLE','STRAẞE','HEIẞ','FLIEẞEN','WALDSEE','NORDWIND','HAUSEN','KALBE','STÖẞEN','GÄRTNERN','LESENDE','LÄUFERS','ÖFFNETE'])assert.equal(spell.accepts(word),true,word);
    for(const word of ['XXXXXX','ZZZZZZ','QWERTZ','ÄÖÜẞÄÖ','HAUSXX','<SCRIPT>'])assert.equal(spell.accepts(word),false,word);
  }finally{spell.dispose();}
});
