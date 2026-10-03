import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SOLUTIONS} from '../dist/words.js';
// The shipped WASM is compiled for browsers; this minimal environment exercises
// the exact same bundled runtime without a network or browser-only test runner.
globalThis.window={};globalThis.document={currentScript:null};
const {createSpellchecker}=await import('../dist/lexicon.js');
test('full German dictionary accepts inflections, compounds and sharp S',async()=>{
  const spell=await createSpellchecker(await readFile(new URL('../dist/dictionary/de.aff',import.meta.url)),await readFile(new URL('../dist/dictionary/de.dic',import.meta.url)));
  try{
    for(const word of ['SPIELERN','HÄUSERN','LAUFEND','GESPIELT','BRÖTCHEN','GEFÜHLE','STRAẞE','HEIẞ','FLIEẞEN','WALDSEE','NORDWIND','HAUSEN','KALBE','STÖẞEN','GÄRTNERN','LESENDE','LÄUFERS','ÖFFNETE','ABENTEUER','SONNENBLUME','BLUMENSTRAUẞ','KAFFEEPAUSE','KÜCHENTISCH','SPAZIERGANG'])assert.equal(spell.accepts(word),true,word);
    for(const word of ['XXXXXX','ZZZZZZ','QWERTZ','ÄÖÜẞÄÖ','HAUSXX','<SCRIPT>','HAU','ABCDEFGHIJKLM','DAMPFMASCHINE'])assert.equal(spell.accepts(word),false,word);
    for(let length=9;length<=12;length++)for(const word of SOLUTIONS[length]||[])assert.equal(spell.accepts(word),true,word);
  }finally{spell.dispose();}
});
