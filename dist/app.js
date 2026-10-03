import {loadLexicon} from './lexicon.js';
import {whatsappURL, resultImage} from './sharing.js';
import { VERSION, CUSTOM_VERSION, attemptOptions, createCustomConfig, keyboardStates, MODES, SPRINT_MS, setWordValidator, normalizeWord, normalizeSeed, berlinDate, dailyConfig, validateConfig, codeFor, parseCode, challengeURL, targetsFor, scoreGuess, newGame, solvedAt, outcome, guessError, restoreGame, shareText } from './engine.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const states={correct:'richtiger Platz',present:'falscher Platz',absent:'nicht enthalten'}, symbols={correct:'✓',present:'↔',absent:'×'};
let storageWarning=false;
function load(key){try{return JSON.parse(localStorage.getItem(key));}catch{return null;}}
function save(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{if(!storageWarning){storageWarning=true;toast('Dein Browser kann dieses Spiel nicht dauerhaft speichern.');}}}
let prefs={theme:'dark',sound:false,symbols:false,motion:matchMedia('(prefers-reduced-motion: reduce)').matches,...load('wortwerk:preferences')};
if(!['light','dark'].includes(prefs.theme))prefs.theme=prefs.theme==='paper'?'light':'dark';
let lexiconState='loading';
let config=dailyConfig(),game,targets,draft,activeBoard=0,locked=false,pending=null,toastTimeout,animationTimeout,resultTimeout,audioContext;
let draftKind='daily',draftWords=['',''],shareImageFile=null,shareImageURL=null,shareImageToken=0;
let initialError='';
try{const encoded=new URLSearchParams(location.hash.slice(1)).get('spiel');if(encoded)config=parseCode(encoded);}catch(error){initialError=error.message;}
function currentKey(){return 'wortwerk:game:'+codeFor(config);}
function persist(){if(lexiconState==='ready')save(currentKey(),game);}
function toast(message){clearTimeout(toastTimeout);$('#toast').textContent=message;$('#toast').classList.add('visible');toastTimeout=setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
function message(text,kind=''){const el=$('#game-message');el.textContent=text;el.className='game-message'+(kind?' '+kind:'');}
function closeDialogs(){$$('dialog[open]').forEach(d=>d.close());}
function openDialog(id){const el=$(id);if(!el.open)el.showModal();}
function applyPrefs(){document.documentElement.dataset.theme=prefs.theme;document.documentElement.classList.toggle('symbols',prefs.symbols);document.documentElement.classList.toggle('reduced-motion',prefs.motion);$('#sound-setting').checked=prefs.sound;$('#contrast-setting').checked=prefs.symbols;$('#motion-setting').checked=prefs.motion;$$('[data-theme-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themeChoice===prefs.theme)));$('meta[name=theme-color]').content={dark:'#101e17',light:'#f5f3e9'}[prefs.theme];}
function sound(type){if(!prefs.sound)return;try{audioContext??=new (window.AudioContext||window.webkitAudioContext)();audioContext.resume();const osc=audioContext.createOscillator(),gain=audioContext.createGain(),now=audioContext.currentTime;osc.type='sine';osc.frequency.setValueAtTime(type==='win'?523:type==='submit'?330:220,now);if(type==='win')osc.frequency.exponentialRampToValueAtTime(1046,now+.22);gain.gain.setValueAtTime(.025,now);gain.gain.exponentialRampToValueAtTime(.0001,now+.22);osc.connect(gain);gain.connect(audioContext.destination);osc.start(now);osc.stop(now+.24);}catch{}}
function randomSeed(){const bytes=new Uint8Array(8);crypto.getRandomValues(bytes);return [...bytes].map(v=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[v%32]).join('');}
function restoreDraft(){
  const own=config.version===CUSTOM_VERSION;
  draft={version:VERSION,mode:config.mode,length:config.length,attempts:config.attempts,hard:config.hard,daily:config.daily,seed:own?randomSeed():config.seed};
  draftKind=own?'own':config.daily?'daily':'seed';draftWords=['',''];renderConfig();
}
function renderConfig(){
  const own=draftKind==='own';
  for(const [id,kind] of [['daily-mode','daily'],['custom-mode','seed'],['own-mode','own']]){const button=$('#'+id);button.classList.toggle('active',draftKind===kind);button.setAttribute('aria-pressed',String(draftKind===kind));}
  $('#game-type').value=draft.mode;
  $('#mode-description').textContent={classic:'Ein Wort. Jeder Versuch bringt dich näher.',duet:'Zwei Wörter. Jeder Versuch zählt für beide.',sprint:'120 Sekunden. Die Uhr startet mit dem ersten Buchstaben.'}[draft.mode];
  $('#length-field').hidden=own;
  $$('[data-length]').forEach(b=>{b.classList.toggle('selected',Number(b.dataset.length)===draft.length);b.setAttribute('aria-pressed',String(Number(b.dataset.length)===draft.length));});
  const options=attemptOptions(draft.mode);
  if(!options.includes(draft.attempts))draft.attempts=draft.mode==='duet'?8:6;
  $('#attempt-control').replaceChildren(...options.map(n=>new Option(String(n)+(n===(draft.mode==='duet'?8:6)?' · Standard':''),String(n),false,n===draft.attempts)));
  $('#attempt-hint').textContent=(draft.mode==='duet'?'2':'1')+' bis 15 Versuche · Standard: '+(draft.mode==='duet'?'8':'6');
  if(draft.mode==='duet')draft.hard=false;
  $('#hard-mode').disabled=draft.mode==='duet';$('#hard-mode').checked=draft.hard;
  $('#hard-mode').closest('label').querySelector('small').textContent=draft.mode==='duet'?'Im Doppelpack nicht kombinierbar':'Alle Hinweise weiterverwenden';
  $('#seed-fields').hidden=own;$('#own-word-fields').hidden=!own;$('#second-word-field').hidden=draft.mode!=='duet';
  $('#target-word').value=draftWords[0];$('#target-word-2').value=draftWords[1];
  $('#target-hint').textContent=draft.mode==='duet'?'Zwei verschiedene Wörter mit jeweils 4–8 Buchstaben und gleicher Länge. Auch Namen sind möglich.':'4–8 Buchstaben, auch Namen. Ä, Ö, Ü und ẞ zählen einzeln.';
  $('#seed-input').value=draft.seed;$('#seed-input').readOnly=draft.daily;
  $('#seed-caption').textContent=draft.daily?'NEU UM 00:00 UHR':'DASSELBE WORT FÜR ALLE';
  $('#config-footnote').textContent=own?'Erstelle das Rätsel und teile den Spiel-Link.':draft.daily?'Täglich neu. Nach deutscher Zeit.':'Seed + Regeln = dasselbe Rätsel.';
  let same=false;try{same=!own&&codeFor(draft)===codeFor(config);}catch{}
  $('#start-game').lastChild.textContent=own?'Rätsel erstellen':same?'Spiel läuft':'Spiel starten';
  $('#seed-error').textContent='';
}
function keepCurrentRowVisible(){
  const viewport=$('#boards-scroll');
  if(config.attempts<=8){viewport.scrollTop=0;return;}
  const rows=viewport.querySelectorAll('.board-unit')[activeBoard]?.querySelectorAll('.board-row');
  const row=rows?.[Math.min(game.guesses.length,config.attempts-1)];if(!row)return;
  const box=viewport.getBoundingClientRect(),rect=row.getBoundingClientRect();
  if(rect.bottom>box.bottom)viewport.scrollTop+=rect.bottom-box.bottom+8;
  else if(rect.top<box.top)viewport.scrollTop-=box.top-rect.top+8;
}
function renderBoards(reveal=false,pop=false){
  const solved=solvedAt(game,targets), ended=outcome(game,config)!=='playing';
  const html=targets.map((target,n)=>{
    const stop=solved[n],done=stop>=0;
    let rows='';
    for(let r=0;r<config.attempts;r++){
      const previous=r<game.guesses.length&&(!done||r<=stop), current=r===game.guesses.length&&!done&&!ended;
      const word=previous?game.guesses[r]:current?game.input:'';
      const colors=previous?scoreGuess(word,target):[];
      rows+=`<div class="board-row${current?' current':''}" role="group" aria-label="Versuch ${r+1}${done&&r>stop?', Wort bereits gelöst':''}">`+Array.from({length:config.length},(_,i)=>{
        const state=colors[i],letter=word[i]||'',label=letter?`${letter}${state?', '+states[state]:''}`:'leer';
        return `<div class="tile${state?' '+state:letter?' filled':''}${reveal&&r===game.guesses.length-1&&previous?' reveal':''}${pop&&current&&i===word.length-1?' pop':''}" style="--i:${i}" aria-label="${label}">${letter}${state?`<span class="status-symbol" aria-hidden="true">${symbols[state]}</span>`:''}</div>`;
      }).join('')+'</div>';
    }
    return `<div class="board-unit">${config.mode==='duet'?`<div class="board-label${done?' solved':''}"><span>WORT ${n+1}${done?' ✓':''}</span><span class="board-key-side">${n===0?'LINKS':'RECHTS'}</span></div>`:''}<div class="board" style="--letters:${config.length}" role="group" aria-label="Wort ${n+1}">${rows}</div></div>`;
  }).join('');
  $('#boards').className=config.mode==='duet'?'duet-boards':'';$('#boards').innerHTML=html;
  $('#spiel').classList.toggle('duet',config.mode==='duet');$('#spiel').classList.toggle('long-word',config.length>=7);
  $('#attempt-count').textContent=ended?`${game.guesses.length} / ${config.attempts} VERSUCHE`:`VERSUCH ${game.guesses.length+1} / ${config.attempts}`;
  $('#active-rules').textContent=`${config.length} Buchstaben · ${config.attempts} Versuche${config.hard?' · Knobelmodus':''}`;
  $('#game-mode').textContent=(config.version===CUSTOM_VERSION?'EIGENES RÄTSEL':config.daily?'TAGESWORT':'FREIES SPIEL')+' · '+MODES[config.mode].toUpperCase();
  $('#result-reopen').hidden=!ended;$('#spiel').classList.toggle('finished',ended);
  $('#keyboard-note').hidden=config.mode!=='duet';$('#keyboard-note').textContent='Jede Taste: links Wort 1 · rechts Wort 2';
  $('#timer').hidden=config.mode!=='sprint';$('#timer-track').hidden=config.mode!=='sprint';
  $('#spiel').classList.toggle('extended-game',config.attempts>8);$('#board-scroll-hint').hidden=config.attempts<=8;$('#boards-scroll').tabIndex=config.attempts>8?0:-1;
  updateKeyboard();updateTimer();keepCurrentRowVisible();
}
function buildKeyboard(){const rows=['QWERTZUIOPÜ','ASDFGHJKLÖÄ','YXCVBNMẞ'];$('#keyboard').innerHTML=rows.map((row,i)=>`<div class="key-row">${i===2?'<button class="key wide submit" data-key="Enter" aria-label="Wort prüfen">Prüfen</button>':''}${[...row].map(c=>`<button class="key letter-key" data-key="${c}" aria-label="${c}"><span class="key-letter">${c}</span><span class="key-excluded" aria-hidden="true">×</span><span class="key-duet-mark left" aria-hidden="true"></span><span class="key-duet-mark right" aria-hidden="true"></span></button>`).join('')}${i===2?'<button class="key wide" data-key="Backspace" aria-label="Buchstaben löschen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5-6 7 6 7h13V5Z M11 9l6 6m0-6-6 6"/></svg></button>':''}</div>`).join('');}
function updateKeyboard(){
  const maps=keyboardStates(game,config),duet=config.mode==='duet',ended=outcome(game,config)!=='playing';
  $$('.key').forEach(b=>{
    b.classList.remove('correct','present','absent','excluded-both');const key=b.dataset.key;
    if(key.length===1){
      const first=maps[0][key],second=maps[1]?.[key];
      if(duet){
        b.dataset.state1=first||'unknown';b.dataset.state2=second||'unknown';
        b.classList.toggle('excluded-both',first==='absent'&&second==='absent');
        b.querySelector('.key-duet-mark.left').textContent=symbols[first]||'';b.querySelector('.key-duet-mark.right').textContent=symbols[second]||'';
        b.setAttribute('aria-label',key+', Wort 1: '+(states[first]||'noch nicht geprüft')+', Wort 2: '+(states[second]||'noch nicht geprüft'));
      }else{
        delete b.dataset.state1;delete b.dataset.state2;
        if(first)b.classList.add(first);b.setAttribute('aria-label',key+(first?', '+states[first]:''));
      }
      b.title=b.getAttribute('aria-label');
    }
    b.disabled=lexiconState!=='ready'||ended;
  });
}
function initialMessage(){if(outcome(game,config)==='won')message('Wort für Wort. Geschafft.','success');else if(outcome(game,config)==='lost')message(game.reason==='time'?'Die Zeit ist um. Dein nächstes Aha wartet.':'Für heute ausgeknobelt. Das nächste Wort wartet.');else if(config.mode==='sprint'&&game.startedAt===null)message('Bereit? Mit dem ersten Buchstaben läuft die Uhr.');else if(game.guesses.length)message('Dein Spiel ist gespeichert. Knoble weiter.');else message(config.mode==='duet'?'Zwei Wörter. Ein erster Gedanke.':'Ein guter Anfang? Dein erstes Wort.');}
function activate(c,{changeURL=true}={}){
  clearTimeout(animationTimeout);clearTimeout(resultTimeout);locked=false;shareImageFile=null;shareImageToken++;if(shareImageURL)URL.revokeObjectURL(shareImageURL);shareImageURL=null;$('#result-download').hidden=true;$('#result-download').removeAttribute('href');config=validateConfig(c);targets=targetsFor(config);activeBoard=0;
  game=lexiconState==='ready'?restoreGame(load(currentKey()),config):newGame(config);
  if(config.mode==='duet'&&game.guesses.includes(targets[0])&&!game.guesses.includes(targets[1]))activeBoard=1;
  if(changeURL)history.replaceState(null,'',challengeURL(config,location.href));
  if(lexiconState==='ready')persist();restoreDraft();renderBoards();initialMessage();closeDialogs();
}
function requestStart(c){
  if(codeFor(c)===codeFor(config)){toast(outcome(game,config)==='playing'?'Dieses Rätsel läuft schon. Viel Spaß beim Knobeln!':'Dieses Rätsel hast du bereits gespielt.');if(outcome(game,config)!=='playing')showResult();else closeDialogs();return;}
  if(outcome(game,config)==='playing'&&(game.guesses.length||game.input||game.startedAt)){pending=c;openDialog('#confirm-dialog');return;}
  activate(c);focusGame();
}
function focusGame(){$('#spiel').focus({preventScroll:true});$('#spiel').scrollIntoView({behavior:prefs.motion?'instant':'smooth',block:'nearest'});}
function startClock(){if(game.startedAt===null){game.startedAt=Date.now();persist();}}
function expire(){if(config.mode==='sprint'&&game.startedAt!==null&&!game.finishedAt&&Date.now()>=game.startedAt+SPRINT_MS){game.reason='time';game.finishedAt=game.startedAt+SPRINT_MS;game.input='';persist();locked=false;clearTimeout(animationTimeout);renderBoards();message('Die Zeit ist um. Dein nächstes Aha wartet.');showResult();return true;}return false;}
function updateTimer(){if(config.mode!=='sprint')return;const left=game.startedAt===null?120:Math.max(0,Math.ceil((game.startedAt+SPRINT_MS-(game.finishedAt??Date.now()))/1000));$('#timer').textContent=`${Math.floor(left/60).toString().padStart(2,'0')}:${(left%60).toString().padStart(2,'0')}`;$('#timer').classList.toggle('urgent',left<=20);$('#timer').setAttribute('aria-label',`${left} Sekunden verbleiben`);$('#timer-fill').style.width=`${left/120*100}%`;}
function inputKey(raw){
  if(lexiconState!=='ready'){message('Das deutsche Wörterbuch wird noch vorbereitet.');return;}
  if(locked||$$('dialog[open]').length||expire()||outcome(game,config)!=='playing')return;
  if(raw==='Enter'){submitGuess();return;}
  if(raw==='Backspace'){game.input=game.input.slice(0,-1);persist();renderBoards();return;}
  const key=normalizeWord(raw);
  if(!/^[A-ZÄÖÜẞ]$/.test(key)||game.input.length>=config.length)return;
  startClock();game.input+=key;persist();renderBoards(false,true);sound('type');message(config.mode==='sprint'?'Die Uhr läuft. Vertrau deinem Wortgefühl.':'Mit Enter prüfen. Mit ⌫ korrigieren.');
}
function submitGuess(){
  if(lexiconState!=='ready'){message('Bitte warte, bis das Wörterbuch bereit ist.');return;}
  if(expire())return;
  const error=guessError(game.input,game,config);
  if(error){message(error,'error');$$('.board-row.current').forEach(r=>{r.classList.remove('shake');void r.offsetWidth;r.classList.add('shake');});return;}
  startClock();const word=game.input;game.guesses.push(word);game.input='';
  const state=outcome(game,config);if(state!=='playing'){game.finishedAt=Date.now();game.reason=state==='won'?'solved':'attempts';}
  if(config.mode==='duet'&&word===targets[activeBoard]){const unsolved=targets.findIndex(t=>!game.guesses.includes(t));if(unsolved>=0)activeBoard=unsolved;}
  persist();locked=true;renderBoards(true);sound(state==='won'?'win':'submit');
  const descriptions=targets.map((t,i)=>{const colors=scoreGuess(word,t);return `${config.mode==='duet'?'Wort '+(i+1)+': ':''}${colors.filter(c=>c==='correct').length} am richtigen Platz, ${colors.filter(c=>c==='present').length} am falschen Platz.`;}).join(' ');
  message(state==='won'?'Das sitzt. Dein Aha-Moment!':descriptions,state==='won'?'success':'');
  const delay=prefs.motion?50:config.length*80+420;
  animationTimeout=setTimeout(()=>{locked=false;if(state!=='playing')showResult();},delay);
}
function showResult(){
  const state=outcome(game,config);if(state==='playing')return;
  clearTimeout(resultTimeout);closeDialogs();
  const won=state==='won',solved=solvedAt(game,targets);
  $('#result-eyebrow').textContent=won?(config.mode==='duet'?'BEIDE WÖRTER GEFUNDEN':'WORT GEFUNDEN'):(game.reason==='time'?'ZEIT ABGELAUFEN':'GUT GEKNOBELT');
  $('#result-title').textContent=won?(game.guesses.length<=2?'Gedanken gelesen.':game.guesses.length<=4?'Das sitzt.':'Punktlandung.'):config.mode==='duet'&&solved.some(i=>i>=0)?'Halb gelöst. Voll dabei.':'Neues Wort. Neues Glück.';
  $('#result-description').textContent=won?`${targets.length===2?'Beide Wörter':'Dein Wort'} in ${game.guesses.length} ${game.guesses.length===1?'Versuch':'Versuchen'}. ${config.mode==='sprint'?'Und die Uhr hat das Nachsehen.':'Zeit für eine kleine Siegerpause.'}`:game.reason==='time'?'120 Sekunden sind um. Das nächste Wort gehört dir.':'Manche Wörter verstecken sich einfach gut. Weiter geht’s beim nächsten.';
  $('#result-answer').textContent=won?targets.join(' · '):'';$('#result-answer').hidden=!won;$('.answer-label').hidden=!won;
  $('#result-grid').innerHTML=targets.map((t,n)=>`<div class="mini-board" aria-label="Wort ${n+1}">${game.guesses.slice(0,solved[n]<0?undefined:solved[n]+1).map(g=>`<div class="mini-row">${scoreGuess(g,t).map(s=>`<i class="mini-tile ${s}" aria-label="${states[s]}"></i>`).join('')}</div>`).join('')}</div>`).join('');
  $('#result-meta').textContent=`${MODES[config.mode]} · ${config.length} Buchstaben · ${config.hard?'Knobelmodus · ':''}${config.version===CUSTOM_VERSION?'Eigenes Rätsel':'#'+config.seed}`;
  $('#whatsapp-share').href=whatsappURL(game,config,location.href);
  prepareResultImage();
  openDialog('#result-dialog');
}
async function prepareResultImage(){
  const token=++shareImageToken,button=$('#result-image');shareImageFile=null;button.disabled=true;button.textContent='Bild wird vorbereitet …';$('#result-download').hidden=true;if(shareImageURL)URL.revokeObjectURL(shareImageURL);shareImageURL=null;
  try{
    const blob=await resultImage(game,config,location.href);if(token!==shareImageToken)return;
    shareImageFile=new File([blob],'woerdel-ergebnis.png',{type:'image/png'});
    shareImageURL=URL.createObjectURL(blob);$('#result-download').href=shareImageURL;$('#result-download').hidden=!navigator.canShare?.({files:[shareImageFile]});
    button.textContent=navigator.canShare?.({files:[shareImageFile]})?'Raster als Bild teilen':'Raster als Bild speichern';
  }catch{if(token===shareImageToken)button.textContent='Bild erneut vorbereiten';}
  finally{if(token===shareImageToken)button.disabled=false;}
}
async function shareResultImage(){
  if(!shareImageFile){await prepareResultImage();return;}
  if(navigator.canShare?.({files:[shareImageFile]})){
    try{await navigator.share({files:[shareImageFile],title:'Wördel',text:shareText(game,config,location.href)});}
    catch(error){if(error.name!=='AbortError')toast('Das Bild konnte nicht geteilt werden. Bitte versuche es erneut.');}
  }else{
    $('#result-download').click();toast('Das Raster wurde als Bild gespeichert.');
  }
}
async function copy(text,success){try{if(!navigator.clipboard?.writeText)throw new Error();await navigator.clipboard.writeText(text);toast(success);}catch{closeDialogs();$('#copy-text').value=text;openDialog('#copy-dialog');$('#copy-text').focus();$('#copy-text').select();}}
function sharingNote(){if(['localhost','127.0.0.1','[::1]'].includes(location.hostname))toast('Lokal kopiert. Für Freunde wird der Link nach Veröffentlichung erreichbar.');}
$('#spiel').tabIndex=-1;
$('.skip-link').addEventListener('click',e=>{e.preventDefault();focusGame();});
buildKeyboard();applyPrefs();activate(config);if(initialError)toast(initialError+' Das Tageswort ist bereit.');
$('#keyboard').addEventListener('click',e=>{const key=e.target.closest('[data-key]');if(key){inputKey(key.dataset.key);$('#spiel').focus({preventScroll:true});}});
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.isComposing||e.target.closest('input,textarea,select,dialog'))return;if(['Enter',' '].includes(e.key)&&e.target.closest('button,a'))return;if(e.key==='Enter'||e.key==='Backspace'||/^[a-zA-ZäöüÄÖÜßẞ]$/.test(e.key)){e.preventDefault();inputKey(e.key);$('#spiel').focus({preventScroll:true});}});
document.addEventListener('paste',e=>{if(e.target.closest('input,textarea,dialog'))return;const word=normalizeWord(e.clipboardData.getData('text').trim());if(/^[A-ZÄÖÜẞ]+$/.test(word)){e.preventDefault();[...word].forEach(inputKey);}});
$('#length-control').addEventListener('click',e=>{const b=e.target.closest('[data-length]');if(b){draft.length=Number(b.dataset.length);renderConfig();}});
$('#attempt-control').addEventListener('change',e=>{draft.attempts=Number(e.target.value);renderConfig();});
$('#game-type').addEventListener('change',e=>{draft.mode=e.target.value;renderConfig();});
$('#hard-mode').addEventListener('change',e=>{draft.hard=e.target.checked;renderConfig();});
$('#daily-mode').addEventListener('click',()=>{draftKind='daily';draft.daily=true;draft.seed=berlinDate();renderConfig();});
$('#custom-mode').addEventListener('click',()=>{if(draftKind!=='seed')draft.seed=randomSeed();draftKind='seed';draft.daily=false;renderConfig();});
$('#own-mode').addEventListener('click',()=>{if(draftKind!=='own')draft.seed=randomSeed();draftKind='own';draft.daily=false;renderConfig();});
for(const [i,id] of ['target-word','target-word-2'].entries())$('#'+id).addEventListener('input',e=>{draftWords[i]=e.target.value;$('#seed-error').textContent='';});
$('#random-seed').addEventListener('click',()=>{draftKind='seed';draft.daily=false;draft.seed=randomSeed();renderConfig();});
$('#seed-input').addEventListener('input',e=>{draft.seed=normalizeSeed(e.target.value);$('#seed-error').textContent='';$('#start-game').lastChild.textContent='Spiel starten';});
$('#config-form').addEventListener('submit',e=>{
  e.preventDefault();
  try{
    const own=draftKind==='own';
    if(!own)draft.seed=normalizeSeed($('#seed-input').value);
    const c=own?createCustomConfig({mode:draft.mode,attempts:draft.attempts,hard:draft.hard,seed:draft.seed,words:draftWords.slice(0,draft.mode==='duet'?2:1)}):validateConfig(draft);
    requestStart(c);
  }catch(error){$('#seed-error').textContent=draftKind==='own'?error.message:'Bitte 1–32 Buchstaben, Zahlen oder Bindestriche eingeben.';$(draftKind==='own'?'#target-word':'#seed-input').focus();}
});
$('#confirm-new').addEventListener('click',()=>{if(pending){const c=pending;pending=null;activate(c);focusGame();}});
$('#config-open').addEventListener('click',()=>{restoreDraft();openDialog('#config-dialog');});
for(const name of ['help','settings','privacy'])$(`#${name}-open`).addEventListener('click',()=>openDialog(`#${name}-dialog`));
$('#confirm-cancel').addEventListener('click',()=>{pending=null;closeDialogs();focusGame();});
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
$$('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}}));
$$('[data-theme-choice]').forEach(b=>b.addEventListener('click',()=>{prefs.theme=b.dataset.themeChoice;applyPrefs();save('wortwerk:preferences',prefs);}));
for(const [id,key] of [['sound-setting','sound'],['contrast-setting','symbols'],['motion-setting','motion']])$('#'+id).addEventListener('change',e=>{prefs[key]=e.target.checked;applyPrefs();save('wortwerk:preferences',prefs);if(key==='sound')sound('submit');});
$('#invite-copy').addEventListener('click',async()=>{await copy(challengeURL(config,location.href),'Spiel-Link kopiert. Fordere jemanden heraus!');sharingNote();});
$('#result-image').addEventListener('click',shareResultImage);
$('#result-copy').addEventListener('click',()=>copy(shareText(game,config,location.href),'Ergebnis kopiert. Ohne Lösungswort.'));
$('#result-reopen').addEventListener('click',showResult);
$('#next-game').addEventListener('click',()=>{activate({version:VERSION,mode:config.mode,length:config.length,attempts:config.attempts,hard:config.hard,daily:false,seed:randomSeed()});focusGame();});
window.addEventListener('hashchange',()=>{try{const code=new URLSearchParams(location.hash.slice(1)).get('spiel');if(code&&code!==codeFor(config)){persist();activate(parseCode(code));}}catch(e){toast(e.message);history.replaceState(null,'',challengeURL(config,location.href));}});
window.addEventListener('storage',e=>{if(lexiconState==='ready'&&e.key===currentKey()&&e.newValue){let raw;try{raw=JSON.parse(e.newValue);}catch{return;}const incoming=restoreGame(raw,config);if(incoming.guesses.length>=game.guesses.length){game=incoming;renderBoards();initialMessage();}}});
setInterval(()=>{expire();updateTimer();},250);
let lastDay=berlinDate();setInterval(()=>{const day=berlinDate();if(day!==lastDay){lastDay=day;toast('Ein neuer Tag, ein neues Wort! Wähle „Tageswort“ für das neue Rätsel.');$('#config-footnote').textContent='Ein neues Tageswort ist verfügbar.';}},30_000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){expire();updateTimer();}});
$('#dictionary-attribution').textContent='Wortprüfung: Hunspell mit dem deutschen LibreOffice-Wörterbuch de_DE_frami (258.200 Einträge sowie Beugungs- und Zusammensetzungsregeln). Lösungswörter: kuratierte Zusammenstellung, Version 1. Schriften: DM Sans und Space Grotesk, lokal unter SIL OFL.';
// Optional browser-agent access: the visible actions remain the single source of truth.
if(document.modelContext?.registerTool){
  const tools=[
    {name:'wortwerk_read_game',title:'Spielstand lesen',description:'Liest den sichtbaren Spielstand ohne die noch geheimen Zielwörter.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:async()=>({mode:MODES[config.mode],length:config.length,attempts:config.attempts,seed:config.seed,guesses:game.guesses,feedback:targets.map(t=>game.guesses.map(g=>scoreGuess(g,t))),status:outcome(game,config),input:game.input})},
    {name:'wortwerk_submit_guess',title:'Wort prüfen',description:'Gibt einen deutschen Wortversuch im laufenden Rätsel ab. Verbraucht bei einem gültigen Wort einen Versuch.',inputSchema:{type:'object',properties:{word:{type:'string',minLength:4,maxLength:8}},required:['word'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async input=>{if(!input||typeof input.word!=='string')throw new Error('Ein Wort wird benötigt.');if(lexiconState!=='ready')throw new Error('Das Wörterbuch wird noch geladen.');if(locked||$$('dialog[open]').length)throw new Error('Bitte schließe den Dialog oder warte die Aufdeckung ab.');const word=normalizeWord(input.word),error=guessError(word,game,config);if(error)throw new Error(error);game.input=word;submitGuess();return{guesses:game.guesses.length,status:outcome(game,config)};}}
  ];
  for(const tool of tools)try{Promise.resolve(document.modelContext.registerTool(tool)).catch(()=>{});}catch{}
}

async function prepareDictionary(){
  lexiconState='loading';$('#dictionary-loading').hidden=false;$('#dictionary-loading-text').textContent='Deutsches Wörterbuch wird vorbereitet …';$('#dictionary-retry').hidden=true;updateKeyboard();
  try{
    const dictionary=await loadLexicon();setWordValidator(word=>dictionary.accepts(word));lexiconState='ready';$('#dictionary-loading').hidden=true;
    const saved=load(currentKey());if(saved){game=restoreGame(saved,config);if(config.mode==='duet'&&game.guesses.includes(targets[0])&&!game.guesses.includes(targets[1]))activeBoard=1;}
    persist();renderBoards();initialMessage();
  }catch{lexiconState='error';$('#dictionary-loading-text').textContent='Das Wörterbuch konnte nicht geladen werden.';$('#dictionary-retry').hidden=false;message('Bitte lade das Wörterbuch erneut. Deine Versuche bleiben erhalten.','error');updateKeyboard();}
}
$('#dictionary-retry').addEventListener('click',prepareDictionary);
prepareDictionary();
