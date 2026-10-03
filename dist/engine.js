import { SOLUTIONS, EXTRA_GUESSES } from './words.js';
export const VERSION = 1;
export const CUSTOM_VERSION = 2;
export const MODES = { classic: 'Klassik', duet: 'Doppelpack', sprint: 'Sprint' };
export const SPRINT_MS = 120_000;
export const normalizeWord = value => String(value).normalize('NFC').replace(/ß/g, 'ẞ').toLocaleUpperCase('de-DE');
export const normalizeSeed = value => normalizeWord(value).trim().replace(/\s+/g, '-');
const alphabet = /^[A-ZÄÖÜẞ]+$/;
const accepted = new Set([...Object.values(SOLUTIONS).flat(), ...EXTRA_GUESSES]);
let externalWordValidator=null;
export function setWordValidator(validator) { externalWordValidator=validator; }
export const isWord = word => accepted.has(word)||Boolean(externalWordValidator?.(word));
export function berlinDate(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone:'Europe/Berlin', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(now).map(p => [p.type, p.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function dailyConfig(now = new Date()) { return { version:VERSION, mode:'classic', length:6, attempts:6, hard:false, daily:true, seed:berlinDate(now) }; }
export function attemptOptions(mode) {
  if (!Object.hasOwn(MODES,mode)) throw new Error('Dieser Spielmodus ist ungültig.');
  const min=mode==='duet'?2:1;
  return Array.from({length:16-min},(_,i)=>min+i);
}
export function validateConfig(c) {
  if (!c || ![VERSION,CUSTOM_VERSION].includes(c.version) || !Object.hasOwn(MODES,c.mode) || !Number.isInteger(c.length) || c.length<4 || c.length>8 || !Number.isInteger(c.attempts) || c.attempts<(c.mode==='duet'?2:1) || c.attempts>15 || typeof c.hard!=='boolean' || typeof c.daily!=='boolean' || typeof c.seed!=='string' || !/^[A-Z0-9ÄÖÜẞ-]{1,32}$/.test(c.seed)) throw new Error('Dieser Spiel-Link ist ungültig oder gehört zu einer anderen Version.');
  if (c.mode==='duet' && c.hard) throw new Error('Diese Spielregeln passen nicht zusammen.');
  if (c.daily && (!/^\d{4}-\d{2}-\d{2}$/.test(c.seed) || !Number.isFinite(Date.parse(c.seed)) || new Date(c.seed).toISOString().slice(0,10)!==c.seed)) throw new Error('Das Datum in diesem Spiel-Link ist ungültig.');
  const clean={ version:c.version, mode:c.mode, length:c.length, attempts:c.attempts, hard:c.hard, daily:c.daily, seed:c.seed };
  if(c.version===CUSTOM_VERSION){
    if(c.daily || !Array.isArray(c.customTargets) || c.customTargets.length!==(c.mode==='duet'?2:1) || c.customTargets.some(w=>typeof w!=='string'||w.length!==c.length||!alphabet.test(w)||normalizeWord(w)!==w) || new Set(c.customTargets).size!==c.customTargets.length) throw new Error('Eigene Wörter müssen 4–8 Buchstaben haben und im Doppelpack verschieden und gleich lang sein.');
    clean.customTargets=[...c.customTargets];
  }
  return clean;
}
export function createCustomConfig({mode='classic',attempts=6,hard=false,seed='EIGENES-WORT',words}={}) {
  if(!Array.isArray(words)||words.some(w=>typeof w!=='string')) throw new Error('Bitte gib deine eigenen Wörter ein.');
  if(words.length!==(mode==='duet'?2:1)) throw new Error(mode==='duet'?'Bitte gib zwei eigene Wörter ein.':'Bitte gib ein eigenes Wort ein.');
  const customTargets=words.map(w=>normalizeWord(w.trim()));
  customTargets.forEach((word,i)=>{
    const label=mode==='duet'?`Wort ${i+1}`:'Dein Wort';
    if(!word.length) throw new Error(mode==='duet'?`Bitte gib Wort ${i+1} ein.`:'Bitte gib ein eigenes Wort ein.');
    if(!alphabet.test(word)) throw new Error(`${label} darf nur Buchstaben enthalten (A–Z, Ä, Ö, Ü und ẞ).`);
    if(word.length<4||word.length>8) throw new Error(`${label} braucht 4–8 Buchstaben.`);
  });
  return validateConfig({version:CUSTOM_VERSION,mode,length:customTargets[0]?.length,attempts,hard,daily:false,seed:normalizeSeed(seed),customTargets});
}
// Encoding keeps targets out of plain sight. It does not encrypt or secure them.
function encodeTargets(targets) {
  const bytes=new TextEncoder().encode(targets.join('.'));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decodeTargets(payload) {
  if(typeof payload!=='string'||payload.length>66||!/^[A-Za-z0-9_-]+$/.test(payload)) throw new Error('Die eigenen Wörter in diesem Spiel-Link sind ungültig.');
  try{
    const binary=atob(payload.replace(/-/g,'+').replace(/_/g,'/'));
    const text=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(binary,c=>c.charCodeAt(0)));
    const targets=text.split('.');
    if(encodeTargets(targets)!==payload) throw new Error();
    return targets;
  }catch{throw new Error('Die eigenen Wörter in diesem Spiel-Link sind ungültig.');}
}
export function codeFor(config) {
  const c = validateConfig(config);
  if(c.version===CUSTOM_VERSION) return [c.version,c.mode,c.length,c.attempts,Number(c.hard),'w',c.seed,encodeTargets(c.customTargets)].join('~');
  return [c.version,c.mode,c.length,c.attempts,Number(c.hard),c.daily?'d':'f',c.seed].join('~');
}
export function parseCode(code) {
  if (typeof code!=='string'||code.length>120) throw new Error('Dieser Spiel-Link ist zu lang.');
  const a=code.split('~');
  if(a[0]===String(CUSTOM_VERSION)){
    if(a.length!==8||!['0','1'].includes(a[4])||a[5]!=='w') throw new Error('Dieser Spiel-Link ist ungültig.');
    const c=validateConfig({version:CUSTOM_VERSION,mode:a[1],length:Number(a[2]),attempts:Number(a[3]),hard:a[4]==='1',daily:false,seed:a[6],customTargets:decodeTargets(a[7])});
    if(codeFor(c)!==code) throw new Error('Dieser Spiel-Link ist nicht eindeutig formatiert.');
    return c;
  }
  if(a.length!==7 || !['0','1'].includes(a[4]) || !['d','f'].includes(a[5])) throw new Error('Dieser Spiel-Link ist ungültig.');
  if(Number(a[0])!==VERSION) throw new Error('Dieser Spiel-Link gehört zu einer anderen Version.');
  return validateConfig({version:Number(a[0]),mode:a[1],length:Number(a[2]),attempts:Number(a[3]),hard:a[4]==='1',daily:a[5]==='d',seed:a[6]});
}
export function challengeURL(config, base) {
  const url = new URL(base);
  url.search=''; url.hash=new URLSearchParams({spiel:codeFor(config)}).toString();
  return url.href;
}
export function hash(text) { let h=2166136261; for(const c of text) { h^=c.codePointAt(0); h=Math.imul(h,16777619); } return h>>>0; }
function rng(seed) { let a=seed; return () => { a+=0x6D2B79F5; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
function deck(length, mode) {
  const words=[...SOLUTIONS[length]];
  const random=rng(hash(`WORTWERK-v1:${length}:${mode}`));
  for(let i=words.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[words[i],words[j]]=[words[j],words[i]];}
  return words;
}
export function targetsFor(config) {
  const c=validateConfig(config);
  if(c.version===CUSTOM_VERSION) return [...c.customTargets];
  const words=deck(c.length,c.mode), count=words.length;
  // A frozen deck guarantees a new daily word until every word has appeared once.
  const day=Math.floor(Date.parse(c.seed)/86400000);
  const index=c.daily ? ((day%count)+count)%count : hash(`1:${c.mode}:${c.length}:${c.seed}`)%count;
  const indices=c.mode==='duet'?[index,(index+Math.max(1,Math.floor(count/2)))%count]:[index];
  return indices.map(i=>words[i]);
}
export function scoreGuess(guess,target) {
  if(guess.length!==target.length) throw new Error('Wortlängen stimmen nicht überein.');
  const result=Array(guess.length).fill('absent'), left={};
  for(let i=0;i<target.length;i++) { if(guess[i]===target[i]) result[i]='correct'; else left[target[i]]=(left[target[i]]||0)+1; }
  for(let i=0;i<guess.length;i++) if(result[i]!=='correct'&&left[guess[i]]>0){result[i]='present';left[guess[i]]--;}
  return result;
}
export function newGame(config) { return { code:codeFor(config), guesses:[], input:'', startedAt:null, finishedAt:null, reason:null }; }
export function solvedAt(game,targets) { return targets.map(t=>game.guesses.indexOf(t)); }
export function keyboardStates(game,config) {
  const rank={absent:1,present:2,correct:3};
  return targetsFor(config).map(target=>{
    const letters={},solved=game.guesses.indexOf(target);
    const guesses=game.guesses.slice(0,solved<0?undefined:solved+1);
    for(const guess of guesses) scoreGuess(guess,target).forEach((state,i)=>{
      if((rank[letters[guess[i]]]||0)<rank[state]) letters[guess[i]]=state;
    });
    return letters;
  });
}
export function outcome(game,config,now=Date.now()) {
  const targets=targetsFor(config);
  if(targets.every(t=>game.guesses.includes(t))) return 'won';
  if(game.reason==='time' || (config.mode==='sprint'&&game.startedAt!==null&&now>=game.startedAt+SPRINT_MS)) return 'lost';
  return game.guesses.length>=config.attempts?'lost':'playing';
}
export function hardError(guess, game, target) {
  // Knobelmodus deliberately requires full consistency, including ruled-out copies.
  for(const previous of game.guesses){
    const known=scoreGuess(previous,target), candidate=scoreGuess(previous,guess);
    if(known.some((s,i)=>s!==candidate[i])) return 'Knobelmodus: Dein Wort muss zu allen bisherigen Hinweisen passen.';
  }
  return null;
}
export function guessError(guess, game, config, now=Date.now()) {
  if(outcome(game,config,now)!=='playing') return 'Dieses Spiel ist schon beendet.';
  if(guess.length!==config.length) return `Dein Wort braucht ${config.length} Buchstaben.`;
  if(!alphabet.test(guess)||(!targetsFor(config).includes(guess)&&!isWord(guess))) return 'Unser deutsches Wörterbuch kennt dieses Wort nicht.';
  if(game.guesses.includes(guess)) return 'Dieses Wort hast du schon ausprobiert.';
  if(config.hard) return hardError(guess,game,targetsFor(config)[0]);
  return null;
}
export function restoreGame(raw,config,now=Date.now()) {
  const clean=newGame(config);
  if(!raw||raw.code!==clean.code||!Array.isArray(raw.guesses)||raw.guesses.length>config.attempts) return clean;
  for(const guess of raw.guesses){
    if(typeof guess!=='string'||guessError(guess,clean,config,0)) return newGame(config);
    clean.guesses.push(guess);
  }
  clean.input=typeof raw.input==='string'&&raw.input.length<=config.length&&/^[A-ZÄÖÜẞ]*$/.test(raw.input)?raw.input:'';
  clean.startedAt=Number.isFinite(raw.startedAt)&&raw.startedAt>0?Math.min(raw.startedAt,now):null;
  if(clean.guesses.length&&clean.startedAt===null) clean.startedAt=now-SPRINT_MS;
  clean.finishedAt=Number.isFinite(raw.finishedAt)&&raw.finishedAt>=clean.startedAt?Math.min(raw.finishedAt,now):null;
  clean.reason=['time','attempts','solved'].includes(raw.reason)?raw.reason:null;
  if(outcome(clean,config,now)!=='playing') { clean.finishedAt??=now; clean.reason??=targetsFor(config).every(t=>clean.guesses.includes(t))?'solved':clean.guesses.length>=config.attempts?'attempts':'time'; clean.input=''; }
  return clean;
}
export function shareText(game,config,base) {
  const targets=targetsFor(config), state=outcome(game,config), solved=solvedAt(game,targets);
  const score=state==='won'?`${game.guesses.length}/${config.attempts}`:`X/${config.attempts}`;
  const label=config.version===CUSTOM_VERSION?(targets.length===2?'· Eigene Wörter':'· Eigenes Wort'):config.daily?'· Tageswort '+config.seed:'· #'+config.seed;
  const header=`WÖRDEL ${label}\n${MODES[config.mode]} · ${config.length} Buchstaben · ${score}${config.hard?' · Knobelmodus':''}`;
  const emojis={correct:'🟩',present:'🟨',absent:'⬛'};
  const grids=targets.map((t,n)=>game.guesses.slice(0,solved[n]<0?undefined:solved[n]+1).map(g=>scoreGuess(g,t).map(s=>emojis[s]).join('')).join('\n'));
  const time=config.mode==='sprint'?`\n${state==='won'?Math.max(0,Math.min(120,Math.ceil(((game.finishedAt??Date.now())-game.startedAt)/1000)))+' Sekunden':'Zeit oder Versuche aufgebraucht'}`:'';
  const labeledGrids=grids.map((grid,i)=>targets.length===2?`Wort ${i+1}\n${grid}`:grid);
  return `${header}${time}\n\n${labeledGrids.join('\n\n')}\n\nSchaffst du’s mit weniger Versuchen?\n${challengeURL(config,base)}`;
}
