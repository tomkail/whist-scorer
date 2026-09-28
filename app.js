const KEY = 'whist-scorer-v1';
const TRUMPS = [['♥','Hearts',1],['♣','Clubs',0],['♦','Diamonds',1],['♠','Spades',0],['','No trumps',0]];
let S = load() || fresh();

function fresh(){
  return {players:['',''], phase:'setup', rounds:[], cur:null,
    settings:{maxCards:7, pattern:'downup', bonus:10, perTrick:1, onlyIfMade:false, hook:true, trumps:true}};
}
function load(){ try{ const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null; }catch(e){ return null; } }
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} }
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
function score(r,i){
  const s = S.settings, b = r.bids[i], t = r.tricks[i], made = b===t;
  return (made ? s.bonus : 0) + ((s.onlyIfMade && !made) ? 0 : t * s.perTrick);
}
function totals(){ return S.players.map((_,i) => S.rounds.reduce((a,r) => a + score(r,i), 0)); }
function newCur(){ const n = S.players.length; return {bids:Array(n).fill(0), tricks:Array(n).fill(0)}; }
function capCards(){ return Math.floor(52 / Math.max(S.players.length, 2)); }

function stepper(key, val, lo, hi){
  return `<div class="step"><button data-act="dec" data-k="${key}" aria-label="Decrease" ${val<=lo?'disabled':''}>−</button><output>${val}</output><button data-act="inc" data-k="${key}" aria-label="Increase" ${val>=hi?'disabled':''}>+</button></div>`;
}
function toggle(k, label, on){
  return `<label class="tog"><span>${label}</span><input type="checkbox" data-set="${k}" ${on?'checked':''}></label>`;
}

function setupHTML(){
  const s = S.settings, n = S.players.length, sq = seq();
  return `<h1>Whist</h1>
  <section class="card"><h2>Players</h2>
    <p class="hint">In seating order, clockwise. The first player deals first.</p>
    ${S.players.map((p,i)=>`<div class="row"><input class="name" data-i="${i}" value="${esc(p)}" placeholder="Player ${i+1}" autocomplete="off" autocapitalize="words"><button class="icon" data-act="rm" data-i="${i}" ${n<=2?'disabled':''} aria-label="Remove player">✕</button></div>`).join('')}
    ${n<7?`<button class="ghost" data-act="add">Add player</button>`:''}
  </section>
  <section class="card"><h2>Rounds</h2>
    <div class="field"><span>Most cards dealt</span>${stepper('max', s.maxCards, 1, capCards())}</div>
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
    ${toggle('trumps','Show trump suit each round', s.trumps)}
  </section>
  <button class="primary" data-act="start">Start game</button>`;
}

function gameHTML(){
  const sq = seq(), n = S.players.length, ri = S.rounds.length, done = ri >= sq.length, tot = totals();
  const nm = i => esc(S.players[i]);
  let top = '';

  if(done){
    const best = Math.max(...tot), winners = S.players.filter((_,i)=>tot[i]===best).map(esc);
    top = `<section class="card over"><div class="hint">Game over</div><div class="w">${winners.join(' & ')}</div><div>${best} points</div></section>`;
  } else {
    const cards = sq[ri], dealer = ri % n, c = S.cur;
    const order = [...Array(n)].map((_,k)=>(dealer+1+k)%n);
    const sumB = c.bids.reduce((a,b)=>a+b,0), sumT = c.tricks.reduce((a,b)=>a+b,0);
    const tr = TRUMPS[ri % TRUMPS.length];
    top = `<section class="table">
      <div class="big">${cards}<small>card${cards>1?'s':''}</small></div>
      <div class="meta">Round ${ri+1} of ${sq.length} · ${nm(dealer)} deals</div>
      ${S.settings.trumps ? `<div class="trump ${tr[2]?'red':''}">${tr[0]} ${tr[1]}</div>` : `<div class="trump">${S.phase==='bid'?'Bidding':'Tricks'}</div>`}
    </section>`;

    if(S.phase==='bid'){
      let banned = null, violated = false;
      if(S.settings.hook){
        const b = cards - (sumB - c.bids[dealer]);
        if(b >= 0 && b <= cards){ banned = b; violated = c.bids[dealer] === b; }
      }
      const diff = sumB - cards;
      top += `<section class="card"><h2>Bids</h2>
        ${order.map(i=>`<div class="prow"><div class="pname"><b>${nm(i)}${i===dealer?'<span class="tag">Dealer</span>':''}</b><small>${tot[i]} pts${i===dealer&&banned!==null?` · can't bid ${banned}`:''}</small></div>${stepper('bid:'+i, c.bids[i], 0, cards)}</div>`).join('')}
        <div class="status"><span>Total bid <strong>${sumB}</strong> of ${cards}</span>
          <span class="${violated?'warn':''}">${violated ? `Dealer can't bid ${banned}` : diff===0 ? 'Even' : diff>0 ? `${diff} over` : `${-diff} under`}</span></div>
        <button class="primary" data-act="lock" ${violated?'disabled':''}>Lock in bids</button>
      </section>`;
    } else {
      const ok = sumT === cards;
      top += `<section class="card"><h2>Tricks won</h2>
        ${order.map(i=>{const made=c.tricks[i]===c.bids[i];return `<div class="prow ${made?'made':''}"><div class="pname"><b>${nm(i)}${i===dealer?'<span class="tag">Dealer</span>':''}</b><small>Bid ${c.bids[i]} · <span class="${made?'ok':''}">${made?'made':'missed'}</span></small></div>${stepper('trk:'+i, c.tricks[i], 0, cards)}</div>`}).join('')}
        <div class="status"><span>Tricks <strong>${sumT}</strong> of ${cards}</span>
          <span class="${ok?'ok':'warn'}">${ok?'Adds up':sumT>cards?`${sumT-cards} too many`:`${cards-sumT} missing`}</span></div>
        <div class="actions"><button class="secondary" data-act="back">Edit bids</button><button class="primary" data-act="score" ${ok?'':'disabled'}>Score round</button></div>
      </section>`;
    }
  }

  const ranked = S.players.map((_,i)=>i).sort((a,b)=>tot[b]-tot[a]);
  const best = Math.max(...tot);
  const standings = `<section class="card"><h2>Scores</h2>
    ${ranked.map((i,k)=>`<div class="stand ${tot[i]===best&&ri>0?'lead':''}"><span class="pos">${k+1}</span><span class="nm">${nm(i)}</span><span class="pts">${tot[i]}</span></div>`).join('')}
  </section>`;

  const history = ri ? `<section class="card"><h2>Rounds</h2><div class="scroll"><table>
    <thead><tr><th>Cards</th>${S.players.map((_,i)=>`<th>${nm(i)}</th>`).join('')}</tr></thead>
    <tbody>${S.rounds.map(r=>`<tr><td>${r.cards}</td>${S.players.map((_,i)=>`<td class="${r.bids[i]===r.tricks[i]?'made':''}"><span class="s">${score(r,i)}</span><span class="bt">${r.bids[i]}/${r.tricks[i]}</span></td>`).join('')}</tr>`).join('')}</tbody>
    <tfoot><tr><td>Total</td>${tot.map(t=>`<td>${t}</td>`).join('')}</tr></tfoot>
  </table></div><p class="hint">Small figures are bid / tricks won.</p></section>` : '';

  const foot = `<div class="foot">
    <button class="secondary" data-act="undo" ${ri===0&&S.phase==='bid'?'disabled':''}>Undo</button>
    <button class="secondary" data-act="newgame">New game</button>
  </div>`;

  return top + standings + history + foot;
}

function render(){
  document.getElementById('app').innerHTML = S.phase==='setup' ? setupHTML() : gameHTML();
  save();
}

function bump(k, d){
  const s = S.settings;
  if(k==='max') s.maxCards = clamp(s.maxCards + d, 1, capCards());
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
    case 'add': S.players.push(''); S.settings.maxCards = clamp(S.settings.maxCards,1,capCards()); break;
    case 'rm': S.players.splice(+d.i,1); break;
    case 'pat': S.settings.pattern = d.k; break;
    case 'inc': bump(d.k, 1); break;
    case 'dec': bump(d.k, -1); break;
    case 'start':
      S.players = S.players.map((p,i)=>p.trim() || `Player ${i+1}`);
      S.settings.maxCards = clamp(S.settings.maxCards,1,capCards());
      S.rounds = []; S.cur = newCur(); S.phase = 'bid'; window.scrollTo(0,0); break;
    case 'lock': S.cur.tricks = [...S.cur.bids]; S.phase = 'tricks'; break;
    case 'back': S.phase = 'bid'; break;
    case 'score':
      S.rounds.push({cards: seq()[S.rounds.length], bids:[...S.cur.bids], tricks:[...S.cur.tricks]});
      S.cur = newCur(); S.phase = 'bid'; window.scrollTo(0,0); break;
    case 'undo':
      if(S.phase==='tricks'){ S.phase = 'bid'; }
      else if(S.rounds.length){ const r = S.rounds.pop(); S.cur = {bids:r.bids, tricks:r.tricks}; S.phase = 'tricks'; }
      break;
    case 'newgame':
      if(!confirm('End this game and go back to setup? Scores will be cleared.')) return;
      S.rounds = []; S.cur = null; S.phase = 'setup'; break;
  }
  render();
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if(!b || b.disabled) return;
  act(b.dataset.act, b.dataset);
});
document.addEventListener('input', e => {
  if(e.target.classList.contains('name')){ S.players[+e.target.dataset.i] = e.target.value; save(); }
});
document.addEventListener('change', e => {
  const k = e.target.dataset && e.target.dataset.set;
  if(k){ S.settings[k] = e.target.checked; render(); }
});

render();
