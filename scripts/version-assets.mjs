import {createHash} from 'node:crypto';
import {readdir, readFile, writeFile} from 'node:fs/promises';
import {extname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const textExtensions=new Set(['.html','.js','.css']);
const assetExtension=/\.(?:js|css|svg|woff2|aff|dic)$/i;

function assetURL(value,version){
  // Keep navigation, absolute paths, external URLs and dynamic expressions intact.
  if(!value||/^(?:[a-z][a-z0-9+.-]*:|\/|#|\?)/i.test(value)||/[\s\\<>{}]/.test(value))return value;
  const hashIndex=value.indexOf('#');
  const fragment=hashIndex<0?'':value.slice(hashIndex);
  const beforeHash=hashIndex<0?value:value.slice(0,hashIndex);
  const queryIndex=beforeHash.indexOf('?');
  const path=queryIndex<0?beforeHash:beforeHash.slice(0,queryIndex);
  if(!assetExtension.test(path))return value;
  const params=queryIndex<0?[]:beforeHash.slice(queryIndex+1).split('&').filter(p=>!/^v(?:=|$)/.test(p));
  if(version!==null)params.push('v='+version);
  const query=params.length?'?'+params.join('&'):'';
  return path+query+fragment;
}

function rewriteReferences(source,version){
  return source
    .replace(/(["'])([^"'\\\s<>]+)\1/g,(_,quote,url)=>quote+assetURL(url,version)+quote)
    // CSS font URLs and @imports can use unquoted url(...).
    .replace(/\burl\(\s*([^\s"'()]+)\s*\)/gi,(match,url)=>match.replace(url,assetURL(url,version)));
}

async function filesUnder(dir,prefix=''){
  const files=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const relative=prefix+entry.name;
    if(entry.isSymbolicLink())throw new Error('Asset directory contains a symbolic link: '+relative);
    if(entry.isDirectory())files.push(...await filesUnder(join(dir,entry.name),relative+'/'));
    else if(entry.isFile())files.push(relative);
  }
  return files.sort();
}

export async function versionAssets(dir='dist'){
  const root=resolve(dir);
  const files=await filesUnder(root);
  const entries=await Promise.all(files.map(async relative=>{
    const bytes=await readFile(join(root,relative));
    const rewrite=textExtensions.has(extname(relative).toLowerCase())&&relative!=='words.js'&&!relative.startsWith('licenses/');
    const canonical=rewrite?Buffer.from(rewriteReferences(bytes.toString('utf8'),null)):bytes;
    return {relative,bytes,canonical,rewrite};
  }));
  const hash=createHash('sha256').update('woerdel-assets-v1\0');
  for(const {relative,canonical} of entries){
    hash.update(relative+'\0'+canonical.length+'\0');
    hash.update(canonical);
  }
  const version=hash.digest('hex').slice(0,12);
  let filesChanged=0;
  for(const entry of entries){
    if(!entry.rewrite)continue;
    const result=Buffer.from(rewriteReferences(entry.canonical.toString('utf8'),version));
    if(result.equals(entry.bytes))continue;
    await writeFile(join(root,entry.relative),result);
    filesChanged++;
  }
  return {version,filesChanged};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  try{
    const result=await versionAssets(process.argv[2]||'dist');
    console.log(`Asset version ${result.version}; ${result.filesChanged} files updated.`);
  }catch(error){
    console.error(error.message);
    process.exitCode=1;
  }
}
