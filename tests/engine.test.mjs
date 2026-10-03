import test from 'node:test';
import assert from 'node:assert/strict';
import {SOLUTIONS,EXTRA_GUESSES} from '../dist/words.js';
import {VERSION,CUSTOM_VERSION,attemptOptions,createCustomConfig,validateConfig,setWordValidator,normalizeWord,berlinDate,dailyConfig,codeFor,parseCode,targetsFor,scoreGuess,keyboardStates,newGame,outcome,guessError,restoreGame,hardError,shareText,challengeURL,SPRINT_MS} from '../dist/engine.js';
const custom=(extra={})=>({...dailyConfig(),daily:false,seed:'KAFFEEPAUSE',...extra});
test('German normalization keeps umlauts and sharp S as one tile',()=>{assert.equal(normalizeWord('größer'),'GRÖẞER');assert.equal(normalizeWord('gru\u0308ße'),'GRÜẞE');});
test('solution pools are sorted, unique and restricted to requested lengths',()=>{for(const [n,words] of Object.entries(SOLUTIONS)){assert.ok(words.length>=70);assert.equal(new Set(words).size,words.length);for(const w of words){assert.equal([...w].length,Number(n));assert.match(w,/^[A-ZÄÖÜẞ]+$/);}assert.deepEqual(words,[...words].sort());}assert.ok(EXTRA_GUESSES.length>100);});
test('repeated letters consume only the remaining target inventory',()=>{assert.deepEqual(scoreGuess('LALL','BALL'),['absent','correct','correct','correct']);assert.deepEqual(scoreGuess('ALLEEN','BALLET'),['present','present','correct','absent','correct','absent']);assert.deepEqual(scoreGuess('AAAA','BALL'),['absent','correct','absent','absent']);});
test('scoring invariant over every curated target',()=>{for(const word of Object.values(SOLUTIONS).flat()){assert.ok(scoreGuess(word,word).every(x=>x==='correct'));for(const letter of new Set(word)){const guess=letter.repeat(word.length),score=scoreGuess(guess,word);assert.equal(score.filter(s=>s!=='absent').length,[...word].filter(c=>c===letter).length);}}});
test('Berlin rollover is consistent through daylight saving time',()=>{assert.equal(berlinDate(new Date('2026-10-02T21:59:59Z')),'2026-10-02');assert.equal(berlinDate(new Date('2026-10-02T22:00:00Z')),'2026-10-03');assert.equal(berlinDate(new Date('2026-12-01T23:00:00Z')),'2026-12-02');});
test('daily deck has no repeated target until every word was used',()=>{for(let length=4;length<=8;length++){const seen=new Set();for(let d=0;d<SOLUTIONS[length].length;d++){const seed=new Date(Date.UTC(2026,0,1+d)).toISOString().slice(0,10);seen.add(targetsFor({...dailyConfig(),length,seed})[0]);}assert.equal(seen.size,SOLUTIONS[length].length);}});
test('all modes roundtrip with rules and distinct duet targets',()=>{for(const mode of ['classic','duet','sprint'])for(let length=4;length<=8;length++){const c=custom({mode,length,attempts:mode==='duet'?8:6});assert.deepEqual(parseCode(codeFor(c)),c);assert.deepEqual(targetsFor(c),targetsFor(parseCode(codeFor(c))));if(mode==='duet')assert.equal(new Set(targetsFor(c)).size,2);}});
test('reject malformed versions, modes, dates, seeds and conflicting rules',()=>{for(const bad of ['2~classic~6~6~0~f~X','1~x~6~6~0~f~X','1~classic~3~6~0~f~X','1~classic~6~6~0~d~2026-02-31','1~duet~6~8~1~f~X','1~classic~6~6~0~f~<script>','1~classic~6~6~wat~f~X',''])assert.throws(()=>parseCode(bad));});
test('invalid and repeated guesses never qualify as legal submissions',()=>{const c=custom(),g=newGame(c);assert.match(guessError('A',g,c),/6 Buchstaben/);assert.match(guessError('ZZZZZZ',g,c),/Wörterbuch/);const w=SOLUTIONS[6].find(w=>w!==targetsFor(c)[0]);g.guesses.push(w);assert.match(guessError(w,g,c),/schon ausprobiert/);});
test('Knobelmodus checks exact previous feedback, including repeated letters',()=>{const g={guesses:['LALL']};assert.equal(hardError('BALL',g,'BALL'),null);assert.ok(hardError('LALL',g,'BALL'));assert.ok(hardError('BALD',g,'BALL'));});
test('duet requires both words, and each board solves independently',()=>{const c=custom({mode:'duet',attempts:8}),g=newGame(c),t=targetsFor(c);g.guesses.push(t[0]);assert.equal(outcome(g,c),'playing');g.guesses.push(t[1]);assert.equal(outcome(g,c),'won');});
test('sprint deadline survives restore and expires exactly at120 seconds',()=>{const c=custom({mode:'sprint'}),g=newGame(c),now=10_000_000;g.startedAt=now;assert.equal(outcome(g,c,now+SPRINT_MS-1),'playing');assert.equal(outcome(g,c,now+SPRINT_MS),'lost');const r=restoreGame(g,c,now+60_000);assert.equal(r.startedAt,now);assert.equal(outcome(r,c,now+SPRINT_MS),'lost');assert.match(guessError(targetsFor(c)[0],g,c,now+SPRINT_MS),/beendet/);});
test('won sprint remains won after deadline; corrupt saves reset safely',()=>{const c=custom({mode:'sprint'}),g=newGame(c);g.startedAt=1000;g.finishedAt=2000;g.guesses=[targetsFor(c)[0]];assert.equal(outcome(g,c,999999),'won');assert.deepEqual(restoreGame({code:g.code,guesses:['garbage']},c),newGame(c));assert.deepEqual(restoreGame({code:'wrong',guesses:[]},c),newGame(c));});
test('shared links preserve repository paths and results contain no answer',()=>{const c=custom(),g=newGame(c),target=targetsFor(c)[0];g.guesses=[target];g.startedAt=1000;g.finishedAt=4000;const base='https://example.github.io/wortwerk/?old=1#old',url=challengeURL(c,base);assert.equal(new URL(url).pathname,'/wortwerk/');assert.equal(new URL(url).search,'');assert.deepEqual(parseCode(new URLSearchParams(new URL(url).hash.slice(1)).get('spiel')),c);const text=shareText(g,c,base);assert.ok(text.includes('🟩'.repeat(c.length)));assert.ok(!text.includes(target));assert.ok(text.includes(url));});
test('completed sprint losses retain their reason after deadline',()=>{const c=custom({mode:'sprint'}),g=newGame(c),target=targetsFor(c)[0];g.startedAt=1000;g.finishedAt=20_000;g.reason='attempts';g.guesses=SOLUTIONS[6].filter(w=>w!==target).slice(0,c.attempts);const r=restoreGame(g,c,200_000);assert.equal(r.reason,'attempts');assert.equal(r.finishedAt,20_000);});

test('version 1 links keep their exact known targets and code bytes',()=>{
  assert.equal(VERSION,1);
  const fixtures=[
    ['1~classic~6~6~0~d~2026-10-02',['LÖSUNG']],
    ['1~classic~6~6~0~d~2026-10-03',['IRREAL']],
    ['1~classic~4~5~0~f~KAFFEEPAUSE',['PILZ']],
    ['1~classic~8~7~1~f~GRÜẞE',['REPORTER']],
    ['1~duet~6~8~0~f~KAFFEEPAUSE',['KREIDE','SCHATZ']],
    ['1~sprint~7~6~0~f~START',['LORBEER']],
  ];
  for(const [code,targets] of fixtures){
    assert.equal(codeFor(parseCode(code)),code);
    assert.deepEqual(targetsFor(parseCode(code)),targets);
  }
});

test('all attempt counts from one to fifteen work, with at least two for duet',()=>{
  for(const mode of ['classic','sprint','duet']){
    const min=mode==='duet'?2:1;
    assert.deepEqual(attemptOptions(mode),Array.from({length:16-min},(_,i)=>min+i));
    for(let attempts=min;attempts<=15;attempts++){
      const c=custom({mode,attempts});
      assert.deepEqual(parseCode(codeFor(c)),c);
      assert.deepEqual(targetsFor(c),targetsFor(custom({mode,attempts:mode==='duet'?8:6})));
    }
    for(const attempts of [0,-1,16,100,1.5,NaN,Infinity,'6',null,...(mode==='duet'?[1]:[])]){
      assert.throws(()=>validateConfig(custom({mode,attempts})));
    }
  }
  assert.throws(()=>attemptOptions('unknown'));
});

test('attempt extremes determine wins and losses at the correct guess',()=>{
  const one=custom({attempts:1}),first=newGame(one),target=targetsFor(one)[0];
  first.guesses.push(SOLUTIONS[6].find(w=>w!==target));
  assert.equal(outcome(first,one),'lost');
  first.guesses=[target];
  assert.equal(outcome(first,one),'won');
  const fifteen=custom({attempts:15}),long=newGame(fifteen);
  long.guesses=SOLUTIONS[6].filter(w=>w!==targetsFor(fifteen)[0]).slice(0,14);
  assert.equal(outcome(long,fifteen),'playing');
  long.guesses.push(targetsFor(fifteen)[0]);
  assert.equal(outcome(long,fifteen),'won');
  assert.equal(restoreGame(long,fifteen).guesses.length,15);
});

test('custom words normalize whitespace, umlauts and sharp S into canonical v2 rules',()=>{
  const c=createCustomConfig({mode:'classic',attempts:15,hard:true,seed:' schöne runde ',words:[' gru\u0308ße ']});
  assert.deepEqual(c,{version:CUSTOM_VERSION,mode:'classic',length:5,attempts:15,hard:true,daily:false,seed:'SCHÖNE-RUNDE',customTargets:['GRÜẞE']});
  assert.equal(CUSTOM_VERSION,2);
  assert.deepEqual(targetsFor(c),['GRÜẞE']);
  for(const mode of ['classic','sprint','duet']){
    const words=mode==='duet'?[' jörg ',' müßt ']:[' straße '];
    const config=createCustomConfig({mode,attempts:mode==='duet'?2:1,words});
    assert.deepEqual(parseCode(codeFor(config)),config);
    assert.deepEqual(targetsFor(parseCode(codeFor(config))),config.customTargets);
    assert.equal(codeFor(config).split('~')[5],'w');
    for(const word of config.customTargets) assert.ok(!codeFor(config).includes(word));
  }
});

test('custom configuration rejects invalid letters, lengths and mismatched boards',()=>{
  for(const words of [undefined,null,'HAUS',[],[null],['ABC'],['NEUNZEICHEN'],['HA US'],['HA-US'],['HAU1'],['HAU😀'],['<svg>'],['HAUS','BAUM']]){
    assert.throws(()=>createCustomConfig({words}),String(words));
  }
  for(const words of [['HAUS'],['HAUS','BÄUME'],['haus',' HAUS '],['HAUS','BAUM','MAUS']]){
    assert.throws(()=>createCustomConfig({mode:'duet',words}),String(words));
  }
  const c=createCustomConfig({words:['HAUS']});
  assert.throws(()=>validateConfig({...c,daily:true,seed:'2026-10-03'}));
  assert.throws(()=>validateConfig({...c,customTargets:['haus']}));
  assert.throws(()=>validateConfig({...c,customTargets:['HAUS','BAUM']}));
  assert.throws(()=>createCustomConfig({mode:'duet',hard:true,words:['HAUS','BAUM']}));
});

test('custom creator explains empty, short, long and invalid-letter input',()=>{
  assert.throws(()=>createCustomConfig({words:['   ']}),/Bitte gib ein eigenes Wort ein/);
  assert.throws(()=>createCustomConfig({words:['ABC']}),/Dein Wort braucht 4–8 Buchstaben/);
  assert.throws(()=>createCustomConfig({words:['ABCDEFGHI']}),/Dein Wort braucht 4–8 Buchstaben/);
  for(const word of ['HA US','HAUS1','HAU😀']) assert.throws(()=>createCustomConfig({words:[word]}),/Dein Wort darf nur Buchstaben enthalten/);
  assert.throws(()=>createCustomConfig({mode:'duet',words:['HAUS','']}),/Bitte gib Wort 2 ein/);
  assert.throws(()=>createCustomConfig({mode:'duet',words:['HAUS','ABC']}),/Wort 2 braucht 4–8 Buchstaben/);
  assert.throws(()=>createCustomConfig({mode:'duet',words:['HAUS','BAU1']}),/Wort 2 darf nur Buchstaben enthalten/);
  assert.throws(()=>validateConfig({version:2,mode:'classic',length:3,attempts:6,hard:false,daily:false,seed:'TEST',customTargets:['ABC']}),/Spiel-Link ist ungültig/);
});

test('v2 payloads reject malformed UTF-8, noncanonical encodings and invalid structure',()=>{
  const encode=text=>Buffer.from(text,'utf8').toString('base64url');
  const prefix='2~classic~4~6~0~w~EIGENES-WORT~';
  const badPayloads=['','!','_w','A',encode('AAAA')+'=',encode('AAAA').slice(0,-1)+'R',encode('aaaA'),encode('AAAA.BBBB'),encode('AAA'),encode('AA.A'),encode('AAAA\u0000'),'A'.repeat(67)];
  for(const payload of badPayloads) assert.throws(()=>parseCode(prefix+payload),payload);
  const valid=codeFor(createCustomConfig({words:['HAUS']}));
  for(const malformed of [valid.replace(/^2~/,'02~'),valid.replace('~4~6~','~04~6~'),valid.replace('~4~6~','~4~6.0~'),valid.replace('~w~','~f~'),valid+'~extra',valid.replace(/^2~/,'3~'),valid.replace('~0~w~','~2~w~')]){
    assert.throws(()=>parseCode(malformed),malformed);
  }
  const maximum=createCustomConfig({mode:'duet',attempts:15,seed:'ẞ'.repeat(32),words:['ẞ'.repeat(8),'ẞ'.repeat(7)+'Ü']});
  assert.ok(codeFor(maximum).length<=120);
  assert.deepEqual(parseCode(codeFor(maximum)),maximum);
});

test('custom targets stay guessable and restorable even outside the dictionary',()=>{
  setWordValidator(()=>false);
  try{
    const c=createCustomConfig({mode:'duet',attempts:2,words:['QXÄẞ','ZYÖẞ']}),g=newGame(c);
    assert.match(guessError('XXXX',g,c),/Wörterbuch/);
    assert.equal(guessError('HAUS',g,c),null);
    assert.equal(guessError('QXÄẞ',g,c),null);
    g.guesses.push('QXÄẞ');g.startedAt=1000;
    const restored=restoreGame(g,c,2000);
    assert.deepEqual(restored.guesses,['QXÄẞ']);
    assert.equal(outcome(restored,c,2000),'playing');
    assert.equal(guessError('ZYÖẞ',restored,c,2000),null);
    restored.guesses.push('ZYÖẞ');restored.finishedAt=2500;restored.reason='solved';
    assert.equal(outcome(restoreGame(restored,c,3000),c,3000),'won');
    const strict=createCustomConfig({hard:true,words:['QXÄẞ']}),h=newGame(strict);
    h.guesses.push('HAUS');
    assert.equal(guessError('QXÄẞ',h,strict),null);
  }finally{setWordValidator(null);}
});

test('custom targets are copied and included in challenge identity',()=>{
  const c=createCustomConfig({words:['HAUS']});
  const validated=validateConfig(c),targets=targetsFor(c);
  validated.customTargets[0]='BAUM';targets[0]='MAUS';
  assert.deepEqual(c.customTargets,['HAUS']);
  const other=createCustomConfig({words:['BAUM']});
  assert.notEqual(codeFor(c),codeFor(other));
  const g=newGame(c);g.guesses=['HAUS'];
  assert.deepEqual(restoreGame(g,other),newGame(other));
});

test('custom shares hide literal targets and label each duet board',()=>{
  const c=createCustomConfig({mode:'duet',seed:'PRIVATE-NOTE',words:['QXÄẞ','ZYÖẞ']}),g=newGame(c);
  g.guesses=[...c.customTargets];g.startedAt=1000;g.finishedAt=2000;
  const base='https://example.github.io/woerdel/?old=1',text=shareText(g,c,base);
  assert.ok(text.startsWith('WÖRDEL · Eigene Wörter\n'));
  assert.ok(!text.split('\n\n')[0].includes(c.seed));
  assert.ok(text.includes('Wort 1\n🟩🟩🟩🟩'));
  assert.ok(text.includes('Wort 2\n'));
  for(const word of c.customTargets) assert.ok(!text.includes(word));
  const url=new URL(challengeURL(c,base));
  assert.equal(url.pathname,'/woerdel/');
  assert.deepEqual(parseCode(new URLSearchParams(url.hash.slice(1)).get('spiel')),c);
  const single=createCustomConfig({words:['HAUS']});
  assert.ok(shareText(newGame(single),single,base).startsWith('WÖRDEL · Eigenes Wort\n'));
});

test('keyboard keeps both duet meanings when a letter is absent in one and correct in the other',()=>{
  const c=createCustomConfig({mode:'duet',words:['HAUS','BAUM']}),g=newGame(c);
  assert.deepEqual(keyboardStates(g,c),[{},{}]);
  g.guesses=['HAUS'];
  const [first,second]=keyboardStates(g,c);
  assert.equal(first.H,'correct');
  assert.equal(second.H,'absent');
  assert.equal(first.A,'correct');
  assert.equal(second.A,'correct');
  assert.equal(first.B,undefined);
  assert.equal(second.B,undefined);
});

test('keyboard duplicate letters retain strongest evidence within and across guesses',()=>{
  const c=createCustomConfig({words:['KANONE']}),g=newGame(c);
  g.guesses=['ANANAS'];
  // One A is present, later extra copies are absent.
  assert.equal(keyboardStates(g,c)[0].A,'present');
  g.guesses=['BANANE'];
  // A is correct in column two and absent in column four.
  assert.equal(keyboardStates(g,c)[0].A,'correct');
  g.guesses.push('ANANAS');
  const letters=keyboardStates(g,c)[0];
  assert.equal(letters.A,'correct');
  assert.equal(letters.N,'correct');
  assert.equal(letters.S,'absent');
});

test('keyboard freezes each solved board while the other board continues learning',()=>{
  const c=createCustomConfig({mode:'duet',words:['BALL','HAUS']}),g=newGame(c);
  g.guesses=['BALL'];
  const solved=keyboardStates(g,c)[0];
  g.guesses.push('MAUS');
  const midway=keyboardStates(g,c);
  assert.deepEqual(midway[0],solved);
  assert.equal(midway[0].M,undefined);
  assert.equal(midway[1].M,'absent');
  assert.equal(midway[1].U,'correct');
  g.guesses.push('HAUS');
  const finished=keyboardStates(g,c);
  assert.deepEqual(finished[0],solved);
  assert.equal(finished[1].H,'correct');
  assert.equal(finished[1].M,'absent');
});
