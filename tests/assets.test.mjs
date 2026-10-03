import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {versionAssets} from '../scripts/version-assets.mjs';

async function fixture(t){
  const dir=await mkdtemp(join(tmpdir(),'woerdel-assets-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const files={
    'index.html':'<script type="module" src="./app.js"></script><link href="style.css"><link href="./favicon.svg?v=2"><a href="./">Home</a><a href="#spiel=1~classic">Seed</a><a href="./about.html">About</a><a href="https://example.org/icon.svg?v=keep">External</a>',
    'app.js':"import {value} from './engine.js'; import './sharing.js'; fetch(new URL('./dictionary/de.aff',import.meta.url)); fetch(new URL('./dictionary/de.dic',import.meta.url));",
    'sharing.js':"import {value} from './engine.js'; export {value};",
    'engine.js':'export const value=1;',
    'style.css':'@import "./assets/fonts/fonts.css"; .logo{background:url(./favicon.svg#mark)} .external{background:url(https://example.org/icon.svg?v=keep)}',
    'assets/fonts/fonts.css':"@font-face{src:url(./font.woff2) format('woff2')} .icon{background:url('../../favicon.svg?mode=small&v=old#glyph')}",
    'assets/fonts/font.woff2':Buffer.from([0,1,2,255]),
    'favicon.svg':'<svg xmlns="http://www.w3.org/2000/svg"/>',
    'dictionary/de.aff':'SET UTF-8\n',
    'dictionary/de.dic':'1\nWORT\n',
    'words.js':'export const words=["HAUS","BAUM"]; const data="./do-not-change.js";',
    'licenses/NOTICE.txt':'Do not rewrite ./app.js?v=original',
    'licenses/source.zip':Buffer.from([80,75,3,4,0,255]),
  };
  for(const [path,content]of Object.entries(files)){
    await mkdir(dirname(join(dir,path)),{recursive:true});
    await writeFile(join(dir,path),content);
  }
  return {dir,files};
}

test('versions the entire local graph with one module identity and preserves repository paths',async t=>{
  const {dir,files}=await fixture(t);
  const {version,filesChanged}=await versionAssets(dir);
  assert.match(version,/^[a-f0-9]{12}$/);
  assert.equal(filesChanged,5);
  const html=await readFile(join(dir,'index.html'),'utf8');
  assert.ok(html.includes(`src="./app.js?v=${version}"`));
  assert.ok(html.includes(`href="style.css?v=${version}"`));
  assert.ok(html.includes(`href="./favicon.svg?v=${version}"`));
  for(const original of ['href="./"','href="#spiel=1~classic"','href="./about.html"','href="https://example.org/icon.svg?v=keep"'])assert.ok(html.includes(original));
  const app=await readFile(join(dir,'app.js'),'utf8');
  const sharing=await readFile(join(dir,'sharing.js'),'utf8');
  const engineURL=`./engine.js?v=${version}`;
  assert.ok(app.includes(`'${engineURL}'`));
  assert.ok(sharing.includes(`'${engineURL}'`));
  assert.equal(new URL(engineURL,'https://example.github.io/woerdel/app.js').href,new URL(engineURL,'https://example.github.io/woerdel/sharing.js').href);
  assert.equal(new URL(`./app.js?v=${version}`,'https://example.github.io/woerdel/').pathname,'/woerdel/app.js');
  for(const extension of ['aff','dic'])assert.ok(app.includes(`'./dictionary/de.${extension}?v=${version}'`));
  const css=await readFile(join(dir,'style.css'),'utf8');
  assert.ok(css.includes(`"./assets/fonts/fonts.css?v=${version}"`));
  assert.ok(css.includes(`url(./favicon.svg?v=${version}#mark)`));
  assert.ok(css.includes('url(https://example.org/icon.svg?v=keep)'));
  const fonts=await readFile(join(dir,'assets/fonts/fonts.css'),'utf8');
  assert.ok(fonts.includes(`url(./font.woff2?v=${version})`));
  assert.ok(fonts.includes(`'../../favicon.svg?mode=small&v=${version}#glyph'`));
  for(const path of ['words.js','favicon.svg','dictionary/de.aff','dictionary/de.dic','licenses/NOTICE.txt','licenses/source.zip','assets/fonts/font.woff2']){
    assert.deepEqual(await readFile(join(dir,path)),Buffer.from(files[path]));
  }
});

test('running twice is byte-stable and content changes produce a new global version',async t=>{
  const {dir,files}=await fixture(t);
  const first=await versionAssets(dir);
  const snapshots=await Promise.all(Object.keys(files).map(async path=>[path,await readFile(join(dir,path))]));
  const second=await versionAssets(dir);
  assert.equal(second.version,first.version);
  assert.equal(second.filesChanged,0);
  for(const [path,bytes]of snapshots)assert.deepEqual(await readFile(join(dir,path)),bytes);
  await writeFile(join(dir,'engine.js'),'export const value=2;');
  const changed=await versionAssets(dir);
  assert.notEqual(changed.version,first.version);
  for(const path of ['index.html','app.js','sharing.js','style.css','assets/fonts/fonts.css']){
    const text=await readFile(join(dir,path),'utf8');
    assert.ok(text.includes('v='+changed.version));
    assert.ok(!text.includes('v='+first.version));
  }
  await writeFile(join(dir,'dictionary/de.dic'),'2\nWORT\nHAUS\n');
  assert.notEqual((await versionAssets(dir)).version,changed.version);
});

test('canonical version ignores the target directory and previously stamped versions',async t=>{
  const first=await fixture(t),second=await fixture(t);
  await writeFile(join(second.dir,'app.js'),first.files['app.js'].replace("'./engine.js'","'./engine.js?v=previous-release'"));
  const [a,b]=await Promise.all([versionAssets(first.dir),versionAssets(second.dir)]);
  assert.equal(a.version,b.version);
});
