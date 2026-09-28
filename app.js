const KEY = 'whist-scorer-v1', HKEY = 'whist-scorer-history-v1';
const TRUMPS = [['♥','Hearts',1],['♣','Clubs',0],['♦','Diamonds',1],['♠','Spades',0],['','No trumps',0]];
let S = load() || fresh();
if(!S.id) S.id = newId();
let H = loadHistory();       // past games, newest first
let view = null, sheet = null; // screen and open dialog; not saved
let reveal = false;            // peeking at hidden scores; hides again after the next round

function fresh(){
  return {players:['',''], phase:'setup', rounds:[], cur:null,
    settings:{maxCards:13, pattern:'down', bonus:10, perTrick:1, onlyIfMade:false, hook:true, trumps:true}};
}
function load(){ try{ const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null; }catch(e){ return null; } }
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} }
function loadHistory(){ try{ return JSON.parse(localStorage.getItem(HKEY)) || []; }catch(e){ return []; } }
function saveHistory(){ try{ localStorage.setItem(HKEY, JSON.stringify(H)); }catch(e){} }
function newId(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// Save the current game to past games, replacing any earlier copy of it
function archive(){
  if(!S.rounds.length) return;
  const g = {id:S.id, date:new Date().toISOString(), players:[...S.players], settings:{...S.settings},
    rounds:S.rounds.map(r => ({...r})), total:seq().length};
  H = [g, ...H.filter(x => x.id !== S.id)].slice(0, 200);
  saveHistory();
}
function unarchive(){ H = H.filter(x => x.id !== S.id); saveHistory(); }
function endGame(){ S.rounds = []; S.cur = null; S.phase = 'setup'; view = null; }
const names = a => a.length > 1 ? `${a.slice(0,-1).join(', ')} and ${a[a.length-1]}` : a[0];
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function seq(){
  const m = S.settings.maxCards, p = S.settings.pattern;
  const down = []; for(let i=m;i>=1;i--) down.push(i);
  const up = [...down].reverse();
  if(p==='down') return down;
  if(p==='up') return up;
  if(p==='downup') return down.concat(up.slice(1));
  return up.concat(down.slice(1));
}
function score(r, i, s = S.settings){
  const b = r.bids[i], t = r.tricks[i], made = b===t;
  return (made ? s.bonus : 0) + ((s.onlyIfMade && !made) ? 0 : t * s.perTrick);
}
// Competition ranking, so tied players share a place (1, 1, 3)
const places = arr => arr.map(v => 1 + arr.filter(x => x > v).length);
const ORD = ['','1st','2nd','3rd'];
function totals(players = S.players, rounds = S.rounds, s = S.settings){
  return players.map((_,i) => rounds.reduce((a,r) => a + score(r,i,s), 0));
}
function newCur(){ const n = S.players.length; return {bids:Array(n).fill(0), tricks:Array(n).fill(0)}; }
const DECK = 52, MAX_CARDS = 26;
function capCards(){ return Math.floor(DECK / Math.max(S.players.length, 2)); }
function deckWarning(){
  const n = S.players.length, m = S.settings.maxCards, need = n * m;
  if(need <= DECK) return '';
  return `<p class="alert">${n} players × ${m} cards needs ${need} cards, more than a standard ${DECK}-card deck. Use ${Math.ceil(need/DECK)} decks, or deal at most ${capCards()}.</p>`;
}

const initial = (i, players = S.players) => esc((players[i] || '').trim().charAt(0).toUpperCase()) || i + 1;
// Each player keeps a colour (by seat) so they're easy to find across the whole screen
const av = (i, players) => `<span class="av pc${i % 7}" aria-hidden="true">${initial(i, players)}</span>`;

function stepper(key, val, lo, hi){
  return `<div class="step"><button data-act="dec" data-k="${key}" aria-label="Decrease" ${val<=lo?'disabled':''}>−</button><output>${val}</output><button data-act="inc" data-k="${key}" aria-label="Increase" ${val>=hi?'disabled':''}>+</button></div>`;
}
function toggle(k, label, on, note){
  return `<label class="tog"><span>${label}${note ? `<small>${note}</small>` : ''}</span><input type="checkbox" data-set="${k}" ${on?'checked':''}></label>`;
}

function setupHTML(){
  const s = S.settings, n = S.players.length, sq = seq();
  return `<div class="titlebar"><h1>Whist</h1>${H.length ? `<button class="secondary" data-act="history">Past games · ${H.length}</button>` : ''}</div>
  <div class="setup">
  <section class="card"><h2>Players</h2>
    <p class="hint">In seating order, clockwise. The first player deals first.</p>
    ${S.players.map((p,i)=>`<div class="row">${av(i)}<input class="name" data-i="${i}" value="${esc(p)}" placeholder="Player ${i+1}" autocomplete="off" autocapitalize="words"><button class="icon" data-act="rm" data-i="${i}" ${n<=2?'disabled':''} aria-label="Remove player">✕</button></div>`).join('')}
    ${n<7?`<button class="ghost" data-act="add">Add player</button>`:''}
  </section>
  <section class="card"><h2>Rounds</h2>
    <div class="field"><span>Most cards dealt</span>${stepper('max', s.maxCards, 1, MAX_CARDS)}</div>
    ${deckWarning()}
    <div class="field col"><span>Order</span><div class="seg">
      ${[['down','Down'],['downup','Down, up'],['updown','Up, down'],['up','Up']].map(([k,l])=>`<button data-act="pat" data-k="${k}" class="${s.pattern===k?'on':''}">${l}</button>`).join('')}
    </div></div>
    <p class="hint">${sq.length} rounds: ${sq.join(', ')}</p>
  </section>
  <section class="card"><h2>Scoring</h2>
    <div class="field"><span>Bonus for making your bid</span>${stepper('bonus', s.bonus, 0, 50)}</div>
    <div class="field"><span>Points per trick</span>${stepper('per', s.perTrick, 0, 10)}</div>
    ${toggle('onlyIfMade','Tricks only score if the bid is made', s.onlyIfMade)}
    ${toggle('hook',"Dealer can't make bids add up to the cards", s.hook)}
  </section>
  <section class="card"><h2>Display</h2>
    ${toggle('trumps','Show trump suit each round', s.trumps)}
    ${toggle('hideScores','Hide scores until revealed', s.hideScores, 'Totals stay secret until someone taps Reveal. Always shown at the end.')}
  </section>
  </div>
  <button class="primary start" data-act="start">Start game</button>`;
}

function gameHTML(){
  const sq = seq(), n = S.players.length, ri = S.rounds.length, done = ri >= sq.length, tot = totals();
  const nm = i => esc(S.players[i]);
  // Hidden scores: conceal anything that gives away the standings until someone reveals them
  const hidden = S.settings.hideScores && !reveal && !done;
  let top = '';

  if(done){
    const best = Math.max(...tot), winners = S.players.filter((_,i)=>tot[i]===best).map(esc);
    top = `<section class="card over"><div class="eyebrow">Game over</div><div class="w">${names(winners)} ${winners.length>1?'win':'wins'}</div><div class="hint">${best} points</div></section>`;
  } else {
    const cards = sq[ri], dealer = ri % n, c = S.cur;
    const order = [...Array(n)].map((_,k)=>(dealer+1+k)%n);
    const sumB = c.bids.reduce((a,b)=>a+b,0), sumT = c.tricks.reduce((a,b)=>a+b,0);
    const tr = TRUMPS[ri % TRUMPS.length];
    top = `<section class="round">
      <div><div class="eyebrow">Round ${ri+1} of ${sq.length} · ${nm(dealer)} deals</div>
      <div class="big">${cards} card${cards>1?'s':''}</div></div>
      ${S.settings.trumps ? `<div class="trump ${tr[2]?'red':''}">${tr[0] ? `<span class="sym">${tr[0]}</span>` : ''}${tr[1]}</div>` : ''}
    </section>`;

    if(S.phase==='bid'){
      let banned = null, violated = false;
      if(S.settings.hook){
        const b = cards - (sumB - c.bids[dealer]);
        if(b >= 0 && b <= cards){ banned = b; violated = c.bids[dealer] === b; }
      }
      const diff = sumB - cards;
      top += `<section class="card"><h2>Bids</h2>
        ${order.map(i=>`<div class="prow"><div class="pname">${av(i)}<div><b>${nm(i)}${i===dealer?'<span class="tag">Dealer</span>':''}</b>${(()=>{ const bits = [hidden ? '' : `${tot[i]} pts`, i===dealer&&banned!==null ? `can't bid ${banned}` : ''].filter(Boolean); return bits.length ? `<small>${bits.join(' · ')}</small>` : ''; })()}</div></div>${stepper('bid:'+i, c.bids[i], 0, cards)}</div>`).join('')}
        <div class="status"><span>Total bid <strong>${sumB}</strong> of ${cards}</span>
          <span class="${violated?'warn':''}">${violated ? `Dealer can't bid ${banned}` : diff===0 ? 'Even' : diff>0 ? `${diff} over` : `${-diff} under`}</span></div>
        <button class="primary" data-act="lock" ${violated?'disabled':''}>Lock in bids</button>
      </section>`;
    } else {
      const ok = sumT === cards;
      top += `<section class="card"><h2>Tricks won</h2>
        ${order.map(i=>{const made=c.tricks[i]===c.bids[i];return `<div class="prow ${made?'made':''}"><div class="pname">${av(i)}<div><b>${nm(i)}${i===dealer?'<span class="tag">Dealer</span>':''}</b><small>Bid ${c.bids[i]} · <span class="${made?'ok':''}">${made?'made':'missed'}</span></small></div></div>${stepper('trk:'+i, c.tricks[i], 0, cards)}</div>`}).join('')}
        <div class="status"><span>Tricks <strong>${sumT}</strong> of ${cards}</span>
          <span class="${ok?'ok':'warn'}">${ok?'Adds up':sumT>cards?`${sumT-cards} too many`:`${cards-sumT} missing`}</span></div>
        <div class="actions"><button class="secondary" data-act="back">Edit bids</button><button class="primary" data-act="score" ${ok?'':'disabled'}>Score round</button></div>
      </section>`;
    }
  }

  const ranked = S.players.map((_,i)=>i);
  if(!hidden) ranked.sort((a,b)=>tot[b]-tot[a]);   // seat order while hidden, so the order doesn't leak
  const best = Math.max(...tot), place = places(tot);
  const peek = S.settings.hideScores && !done && ri > 0
    ? `<button class="link" data-act="reveal">${reveal ? 'Hide' : 'Reveal'}</button>` : '';
  const standings = `<section class="card"><div class="cardhead"><h2>Scores</h2>${peek}</div>
    ${hidden && ri ? `<p class="hint">Scores are hidden. Tap Reveal to take a look.</p>` : ''}
    ${ranked.map((i,k)=>hidden
      ? `<div class="stand"><span class="pos"></span>${av(i)}<span class="nm">${nm(i)}</span><span class="pts masked" aria-label="Hidden">•••</span></div>`
      : `<div class="stand ${tot[i]===best&&ri>0?'lead':''}"><span class="pos">${place[i]}</span>${av(i)}<span class="nm">${nm(i)}</span><span class="pts">${tot[i]}</span></div>`).join('')}
  </section>`;

  const history = ri ? `<section class="card hist"><h2>Rounds</h2><div class="scroll">${scoreTable(S.players, S.rounds, S.settings, hidden)}</div>
    <p class="hint">${hidden ? 'Showing bid / tricks won. Green: made the bid.' : 'Small figures are bid / tricks won. Highlighted: top score that round.'}</p></section>` : '';

  const foot = `<div class="foot">
    <button class="secondary" data-act="undo" ${ri===0&&S.phase==='bid'?'disabled':''}>${undoLabel()}</button>
    <button class="secondary" data-act="newgame">New game</button>
  </div>`;

  // Once the game is over there's nothing to enter, so scores join the result and history gets a column to itself
  const [a, b] = done ? [top + standings, history + foot] : [top, standings + history + foot];
  return `<div class="game"><div class="col">${a}</div><div class="col">${b}</div></div>`;
}

// Say exactly what Undo will do: step back from tricks to bids, or reopen the last scored round
function undoLabel(){
  if(S.phase === 'tricks') return 'Undo bids';
  return S.rounds.length ? `Undo round ${S.rounds.length}` : 'Undo';
}

function scoreTable(players, rounds, s, hideTotals){
  const tot = totals(players, rounds, s), place = places(tot);
  return `<table>
    <thead><tr><th>Round</th>${players.map((p,i)=>`<th class="pc${i % 7}">${esc(p)}</th>`).join('')}</tr></thead>
    <tbody>${rounds.map((r,k)=>{
      const pts = players.map((_,i)=>score(r,i,s)), top = Math.max(...pts), tr = TRUMPS[k % TRUMPS.length];
      const suit = s.trumps ? `<span class="suit ${tr[2]?'red':''}">${tr[0] || 'NT'}</span>` : '';
      return `<tr><td>${r.cards}${suit}</td>${pts.map((p,i)=>hideTotals
        ? `<td class="${r.bids[i]===r.tricks[i]?'made':''}"><span class="s">${r.bids[i]}/${r.tricks[i]}</span></td>`
        : `<td class="${r.bids[i]===r.tricks[i]?'made':''} ${p===top&&top>0?'top':''}"><span class="s">${p}</span><span class="bt">${r.bids[i]}/${r.tricks[i]}</span></td>`).join('')}</tr>`;
    }).join('')}</tbody>
    <tfoot><tr><td>Total</td>${tot.map((t,i)=>hideTotals
      ? `<td><span class="place"></span><span class="t masked">•••</span></td>`
      : `<td class="${place[i]<=3?'p'+place[i]:''}"><span class="place">${ORD[place[i]] || ''}</span><span class="t">${t}</span></td>`).join('')}</tr></tfoot>
  </table>`;
}

function historyHTML(){
  const date = iso => new Date(iso).toLocaleDateString(undefined, {weekday:'short', day:'numeric', month:'short', year:'numeric'});
  const games = H.map(g => {
    const tot = totals(g.players, g.rounds, g.settings), place = places(tot), best = Math.max(...tot);
    const ranked = g.players.map((_,i)=>i).sort((a,b)=>tot[b]-tot[a]);
    const winners = g.players.filter((_,i)=>tot[i]===best).map(esc);
    const done = g.rounds.length >= g.total;
    return `<section class="card rec">
      <div class="rec-head"><div><div class="eyebrow">${date(g.date)}</div>
        <div class="rec-w">${names(winners)} ${winners.length>1?'win':'wins'}</div>
        <div class="hint">${done ? `${g.rounds.length} rounds` : `Ended after ${g.rounds.length} of ${g.total} rounds`}</div></div>
        <button class="link danger" data-act="del" data-id="${g.id}">Delete</button></div>
      ${ranked.map(i=>`<div class="stand ${tot[i]===best?'lead':''}"><span class="pos">${place[i]}</span>${av(i, g.players)}<span class="nm">${esc(g.players[i])}</span><span class="pts">${tot[i]}</span></div>`).join('')}
      <details><summary>Show rounds</summary><div class="scroll">${scoreTable(g.players, g.rounds, g.settings)}</div></details>
    </section>`;
  }).join('');
  return `<div class="titlebar"><h1>Past games</h1><button class="secondary" data-act="setup">Done</button></div>
    ${H.length ? `<div class="past">${games}</div>` : `<section class="card"><p class="hint">Finished games will appear here.</p></section>`}`;
}

function sheetHTML(){
  if(!sheet) return '';
  let title, body, btns, cancel = 'Cancel';
  if(sheet.kind === 'end'){
    const n = S.rounds.length, total = seq().length;
    cancel = 'Keep playing';
    if(n >= total){
      title = 'Start a new game?'; cancel = 'Cancel';
      body = 'This game is saved in past games.';
      btns = `<button class="primary" data-act="end-discard">Start new game</button>`;
    } else {
      title = 'End this game?';
      body = n ? `You've played ${n} of ${total} rounds.` : 'No rounds have been scored yet.';
      btns = n ? `<button class="primary" data-act="end-save">Save to past games</button><button class="sbtn danger" data-act="end-discard">End without saving</button>`
               : `<button class="sbtn danger" data-act="end-discard">Back to setup</button>`;
    }
  } else if(sheet.kind === 'undo'){
    const ri = S.rounds.length;
    if(S.phase === 'tricks'){
      title = 'Undo bids?';
      body = "You'll go back to bidding for this round. The bids you entered stay filled in.";
    } else {
      title = `Undo round ${ri}?`;
      body = `Round ${ri} (${S.rounds[ri-1].cards} card${S.rounds[ri-1].cards>1?'s':''}) will be reopened so you can correct the tricks. Its scores are removed until you score it again.`;
    }
    btns = `<button class="sbtn danger" data-act="undo-yes">${undoLabel()}</button>`;
  } else {
    title = 'Delete this game?'; body = "It will be removed from past games. This can't be undone.";
    btns = `<button class="sbtn danger" data-act="del-yes">Delete game</button>`;
  }
  return `<div class="scrim" data-act="cancel"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-t"><h2 id="sheet-t">${title}</h2><p class="hint">${body}</p>${btns}<button class="sbtn" data-act="cancel">${cancel}</button></div>`;
}

function render(){
  document.getElementById('app').innerHTML = view==='history' ? historyHTML() : S.phase==='setup' ? setupHTML() : gameHTML();
  document.getElementById('sheet').innerHTML = sheetHTML();
  fit();
  save();
  const first = document.querySelector('.sheet button');
  if(first) first.focus();
}

// On tablets and desktops, keep everything on one screen: the round history scrolls
// inside its card, and if that isn't enough the whole UI shrinks until it fits.
const FIT = matchMedia('(min-width:700px) and (min-height:560px)');
const MIN_FS = 14;
function fit(){
  const root = document.documentElement, main = document.getElementById('app');
  root.classList.toggle('fit', FIT.matches);
  root.style.removeProperty('--fs');
  if(FIT.matches && view !== 'history'){
    const fits = () => main.scrollHeight <= main.clientHeight + 1;
    if(!fits()){
      let lo = MIN_FS, hi = parseFloat(getComputedStyle(root).fontSize);
      while(hi - lo > 0.25){
        const m = (lo + hi) / 2;
        root.style.setProperty('--fs', m + 'px');
        if(fits()) lo = m; else hi = m;
      }
      root.style.setProperty('--fs', lo + 'px');
    }
  }
  const sc = main.querySelector('.hist .scroll');
  if(sc) sc.scrollTop = sc.scrollHeight;
}

function bump(k, d){
  const s = S.settings;
  if(k==='max') s.maxCards = clamp(s.maxCards + d, 1, MAX_CARDS);
  else if(k==='bonus') s.bonus = clamp(s.bonus + d, 0, 50);
  else if(k==='per') s.perTrick = clamp(s.perTrick + d, 0, 10);
  else {
    const [t, i] = k.split(':'), cards = seq()[S.rounds.length];
    const arr = t==='bid' ? S.cur.bids : S.cur.tricks;
    arr[+i] = clamp(arr[+i] + d, 0, cards);
  }
}

function act(a, d){
  switch(a){
    case 'add': S.players.push(''); break;
    case 'rm': S.players.splice(+d.i,1); break;
    case 'pat': S.settings.pattern = d.k; break;
    case 'inc': bump(d.k, 1); break;
    case 'dec': bump(d.k, -1); break;
    case 'start':
      S.players = S.players.map((p,i)=>p.trim() || `Player ${i+1}`);
      S.id = newId(); reveal = false; S.rounds = []; S.cur = newCur(); S.phase = 'bid'; window.scrollTo(0,0); break;
    case 'lock': S.cur.tricks = [...S.cur.bids]; S.phase = 'tricks'; break;
    case 'back': S.phase = 'bid'; break;
    case 'score':
      S.rounds.push({cards: seq()[S.rounds.length], bids:[...S.cur.bids], tricks:[...S.cur.tricks]});
      S.cur = newCur(); S.phase = 'bid'; reveal = false;
      if(S.rounds.length >= seq().length) archive();
      window.scrollTo(0,0); break;
    case 'undo': sheet = {kind:'undo'}; break;
    case 'undo-yes':
      sheet = null;
      if(S.phase==='tricks'){ S.phase = 'bid'; }
      else if(S.rounds.length){
        if(S.rounds.length >= seq().length) unarchive();   // reopening a finished game
        const r = S.rounds.pop(); S.cur = {bids:r.bids, tricks:r.tricks}; S.phase = 'tricks';
      }
      break;
    case 'newgame': sheet = {kind:'end'}; break;
    case 'end-save': archive(); endGame(); sheet = null; break;
    case 'end-discard': endGame(); sheet = null; break;
    case 'cancel': sheet = null; break;
    case 'reveal': reveal = !reveal; break;
    case 'history': view = 'history'; window.scrollTo(0,0); break;
    case 'setup': view = null; break;
    case 'del': sheet = {kind:'del', id:d.id}; break;
    case 'del-yes': H = H.filter(g => g.id !== sheet.id); saveHistory(); sheet = null; if(!H.length) view = null; break;
  }
  render();
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if(!b || b.disabled) return;
  act(b.dataset.act, b.dataset);
});
document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && sheet){ sheet = null; render(); }
});
document.addEventListener('input', e => {
  if(e.target.classList.contains('name')){
    const i = +e.target.dataset.i;
    S.players[i] = e.target.value; save();
    e.target.previousElementSibling.textContent = e.target.value.trim().charAt(0).toUpperCase() || i + 1;
  }
});
document.addEventListener('change', e => {
  const k = e.target.dataset && e.target.dataset.set;
  if(k){ S.settings[k] = e.target.checked; render(); }
});

addEventListener('resize', fit);
FIT.addEventListener('change', fit);
if(document.fonts) document.fonts.ready.then(fit);

render();
