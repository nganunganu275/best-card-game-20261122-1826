// Ember Duel — an original turn-based card battler.
// You are the Emberkeeper; the Gloom Warden wants your flame out. First to 0 life loses.
// No network, no libraries: plain DOM + a small state machine.
'use strict';

const CARDS = [
  { name: 'Cinder Imp',   cost: 1, atk: 2, hp: 1, art: '👹', text: 'A spark with attitude.', type: 'creature' },
  { name: 'Ember Hound',  cost: 2, atk: 3, hp: 2, art: '🐺', text: 'It hunts by the smell of smoke.', type: 'creature' },
  { name: 'Phoenix Chick', cost: 2, atk: 2, hp: 3, art: '🐣', text: 'Small now. Give it a minute.', type: 'creature' },
  { name: 'Ash Knight',   cost: 3, atk: 3, hp: 4, art: '🛡️', text: 'His armour never cools.', type: 'creature' },
  { name: 'Flame Herald', cost: 4, atk: 5, hp: 3, art: '🎺', text: 'Her trumpet is a bonfire.', type: 'creature' },
  { name: 'Coal Golem',   cost: 5, atk: 4, hp: 7, art: '🗿', text: 'Slow. Very slow. Very heavy.', type: 'creature' },
  { name: 'Cinder Burst', cost: 2, art: '💥', text: 'Deal 3 damage to the Warden.', type: 'spell', effect: 'burst' },
  { name: 'Kindle',       cost: 1, art: '🕯️', text: 'Restore 4 life to yourself.', type: 'spell', effect: 'heal' },
  { name: 'Wildfire',     cost: 4, art: '🔥', text: 'Deal 2 damage to all enemy creatures.', type: 'spell', effect: 'wildfire' },
];

const $ = (id) => document.getElementById(id);
const clone = (c) => ({ ...c, hpNow: c.hp, canAttack: false });
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const buildDeck = () => shuffle([...CARDS, ...CARDS, ...CARDS].slice(0, 20).map(clone));

let S = null; // game state
let selected = null; // index of selected attacker on player's field

function newState() {
  return {
    playerLife: 20, enemyLife: 20,
    ember: 1, emberMax: 1, round: 1,
    playerDeck: buildDeck(), enemyDeck: buildDeck(),
    playerHand: [], enemyHand: [],
    playerField: [], enemyField: [],
    turn: 'player', over: false, aiBusy: false,
  };
}

function log(msg) { $('log').textContent = msg; }

function drawCard(who) {
  const deck = who === 'player' ? S.playerDeck : S.enemyDeck;
  const hand = who === 'player' ? S.playerHand : S.enemyHand;
  if (!deck.length) { // fatigue: no cards left hurts
    if (who === 'player') S.playerLife -= 1; else S.enemyLife -= 1;
    log((who === 'player' ? 'You are' : 'The Warden is') + ' out of cards and takes 1 fatigue damage!');
    return;
  }
  if (hand.length < 7) hand.push(deck.pop());
}

function startGame() {
  S = newState(); selected = null;
  for (let i = 0; i < 3; i++) { drawCard('player'); drawCard('enemy'); }
  show('table');
  log('Your move, duelist.');
  render();
}

function show(which) {
  for (const id of ['titleScreen', 'table', 'endScreen']) $(id).classList.remove('active');
  $(which).classList.add('active');
}

function endGame(won) {
  S.over = true;
  $('endTitle').textContent = won ? 'VICTORY' : 'DEFEAT';
  $('endTitle').className = 'end-title ' + (won ? 'win' : 'loss');
  $('endSub').textContent = won
    ? "The Warden's gloom is scattered. The ember burns on."
    : 'Your flame gutters out… but embers always return.';
  $('endStats').textContent = `Rounds played: ${S.round} · Your life: ${Math.max(0, S.playerLife)} · Warden's life: ${Math.max(0, S.enemyLife)}`;
  show('endScreen');
}

function checkEnd() {
  if (S.over) return true;
  if (S.enemyLife <= 0) { endGame(true); return true; }
  if (S.playerLife <= 0) { endGame(false); return true; }
  return false;
}

function playCard(i) {
  if (S.over || S.turn !== 'player' || S.aiBusy) return;
  const card = S.playerHand[i];
  if (!card || card.cost > S.ember) return;
  S.ember -= card.cost;
  S.playerHand.splice(i, 1);
  if (card.type === 'creature') {
    S.playerField.push(card);
    log(`You summon ${card.name}.`);
  } else if (card.effect === 'burst') {
    S.enemyLife -= 3;
    log(`Cinder Burst! The Warden takes 3 damage.`);
  } else if (card.effect === 'heal') {
    S.playerLife = Math.min(20, S.playerLife + 4);
    log('Kindle! You restore 4 life.');
  } else if (card.effect === 'wildfire') {
    S.enemyField.forEach((c) => { c.hpNow -= 2; });
    S.enemyField = S.enemyField.filter((c) => c.hpNow > 0);
    log('Wildfire sweeps the Warden\u2019s field!');
  }
  selected = null;
  render();
  checkEnd();
}

function attackWith(i) {
  if (S.over || S.turn !== 'player' || S.aiBusy) return;
  const c = S.playerField[i];
  if (!c || !c.canAttack) return;
  selected = selected === i ? null : i;
  if (selected !== null) log(`${c.name} is ready — click a target.`);
  render();
}

function strike(target) {
  // target: 'hero' or enemy field index
  if (selected === null) return;
  const atk = S.playerField[selected];
  if (!atk) { selected = null; render(); return; }
  atk.canAttack = false;
  if (target === 'hero') {
    S.enemyLife -= atk.atk;
    log(`${atk.name} hits the Warden for ${atk.atk}!`);
  } else {
    const def = S.enemyField[target];
    if (!def) { selected = null; render(); return; }
    def.hpNow -= atk.atk;
    atk.hpNow -= def.atk;
    log(`${atk.name} trades blows with ${def.name}.`);
    S.enemyField = S.enemyField.filter((c) => c.hpNow > 0);
    S.playerField = S.playerField.filter((c) => c.hpNow > 0);
  }
  selected = null;
  render();
  checkEnd();
}

function endTurn() {
  if (S.over || S.turn !== 'player' || S.aiBusy) return;
  S.turn = 'ai'; S.aiBusy = true; selected = null;
  $('turnLabel').textContent = "Warden's turn";
  render();
  setTimeout(aiTurn, 700);
}

function aiTurn() {
  // Warden's turn: gain ember, draw, play what it can, attack with everything ready.
  S.emberMax = Math.min(10, S.emberMax + 1);
  let aiEmber = S.emberMax;
  drawCard('enemy');
  if (checkEnd()) { S.aiBusy = false; return; }
  // Play creatures greedily, cheapest first.
  S.enemyHand.sort((a, b) => a.cost - b.cost);
  for (let i = S.enemyHand.length - 1; i >= 0; i--) {
    const c = S.enemyHand[i];
    if (c.type === 'creature' && c.cost <= aiEmber && S.enemyField.length < 5) {
      aiEmber -= c.cost;
      S.enemyField.push(c);
      S.enemyHand.splice(i, 1);
    } else if (c.type === 'spell' && c.effect === 'burst' && c.cost <= aiEmber) {
      aiEmber -= c.cost;
      S.playerLife -= 3;
      S.enemyHand.splice(i, 1);
      log('The Warden hurls a Cinder Burst at you!');
    }
  }
  if (checkEnd()) { S.aiBusy = false; return; }
  // Attack with every ready creature: face if lethal, else trade up.
  let dealt = 0;
  for (const c of S.enemyField) {
    if (!c.canAttack) continue;
    c.canAttack = false;
    const target = S.playerField.find((p) => p.atk >= c.hpNow) || null;
    if (target) {
      target.hpNow -= c.atk;
      c.hpNow -= target.atk;
      dealt += c.atk;
    } else {
      S.playerLife -= c.atk;
      dealt += c.atk;
    }
  }
  S.enemyField = S.enemyField.filter((c) => c.hpNow > 0);
  S.playerField = S.playerField.filter((c) => c.hpNow > 0);
  if (dealt) log(`The Warden's creatures deal ${dealt} damage!`);
  if (checkEnd()) { S.aiBusy = false; return; }
  // Back to the player.
  S.round += 1;
  S.emberMax = Math.min(10, S.emberMax + 1);
  S.ember = S.emberMax;
  S.playerField.forEach((c) => { c.canAttack = true; });
  S.enemyField.forEach((c) => { c.canAttack = true; });
  S.turn = 'player'; S.aiBusy = false;
  $('turnLabel').textContent = 'Your turn';
  drawCard('player');
  log(`Round ${S.round} — your move, duelist.`);
  render();
  checkEnd();
}

function cardEl(card, opts = {}) {
  const d = document.createElement('div');
  d.className = 'card' + (opts.enemy ? ' enemy-card' : '') + (opts.field ? ' on-field' : '')
    + (opts.ready ? ' ready' : '') + (opts.unplayable ? ' unplayable' : '') + (opts.selected ? ' selected' : '');
  d.innerHTML =
    `<div class="cost">${card.cost}</div><div class="type">${card.type}</div>` +
    `<div class="name">${card.name}</div><div class="art">${card.art}</div>` +
    `<div class="text">${card.text}</div>` +
    (card.type === 'creature'
      ? `<div class="stats"><span class="atk">⚔️ ${card.atk}</span><span class="hp">♥ ${card.hpNow}</span></div>`
      : `<div class="stats"><span class="atk">✨ spell</span></div>`);
  if (opts.onClick) d.addEventListener('click', opts.onClick);
  return d;
}

function render() {
  if (!S) return;
  $('playerLife').textContent = Math.max(0, S.playerLife);
  $('enemyLife').textContent = Math.max(0, S.enemyLife);
  $('emberNow').textContent = S.ember;
  $('emberMax').textContent = S.emberMax;
  $('playerDeck').textContent = S.playerDeck.length;
  $('enemyDeck').textContent = S.enemyDeck.length;
  $('roundLabel').textContent = 'Round ' + S.round;
  $('endTurn').disabled = S.turn !== 'player' || S.over;

  const eh = $('enemyHand'); eh.innerHTML = '';
  for (let i = 0; i < S.enemyHand.length; i++) {
    const b = document.createElement('div');
    b.className = 'card-back'; b.textContent = '🌑';
    eh.appendChild(b);
  }

  const ef = $('enemyField'); ef.innerHTML = '';
  S.enemyField.forEach((c, i) => {
    ef.appendChild(cardEl(c, {
      enemy: true, field: true,
      onClick: () => { if (selected !== null) strike(i); },
    }));
  });

  const pf = $('playerField'); pf.innerHTML = '';
  S.playerField.forEach((c, i) => {
    pf.appendChild(cardEl(c, {
      field: true, ready: c.canAttack && S.turn === 'player',
      selected: selected === i,
      onClick: () => attackWith(i),
    }));
  });

  const hand = $('hand'); hand.innerHTML = '';
  S.playerHand.forEach((c, i) => {
    hand.appendChild(cardEl(c, {
      unplayable: c.cost > S.ember || S.turn !== 'player',
      onClick: () => playCard(i),
    }));
  });

  $('enemyPortrait').classList.toggle('targetable', selected !== null);
}

// ---- screenshot setups (?shot=start|play|win|loss) ----
function demoState() {
  S = newState();
  S.round = 4; S.ember = 5; S.emberMax = 6;
  S.playerLife = 14; S.enemyLife = 17;
  S.playerDeck = buildDeck().slice(0, 12);
  S.enemyDeck = buildDeck().slice(0, 13);
  const byName = (n) => clone(CARDS.find((c) => c.name === n));
  S.playerField = [byName('Ash Knight'), byName('Ember Hound')];
  S.playerField.forEach((c) => { c.canAttack = true; });
  S.enemyField = [byName('Coal Golem'), byName('Cinder Imp')];
  S.playerHand = [byName('Flame Herald'), byName('Cinder Burst'), byName('Phoenix Chick'), byName('Kindle')];
  S.enemyHand = [byName('Cinder Imp'), byName('Ember Hound'), byName('Ash Knight')];
  selected = null;
  log('Round 4 — your move, duelist.');
}

function boot() {
  const shot = new URLSearchParams(location.search).get('shot');
  $('playBtn').addEventListener('click', startGame);
  $('againBtn').addEventListener('click', startGame);
  $('endTurn').addEventListener('click', endTurn);
  $('enemyPortrait').addEventListener('click', () => { if (selected !== null) strike('hero'); });
  document.addEventListener('keydown', (e) => {
    if (!S || S.over) return;
    if (e.code === 'Space') { e.preventDefault(); endTurn(); }
    const n = Number(e.key);
    if (n >= 1 && n <= 5) playCard(n - 1);
  });
  if (shot === 'play') { demoState(); show('table'); render(); }
  else if (shot === 'win') { demoState(); S.enemyLife = 0; render(); endGame(true); }
  else if (shot === 'loss') { demoState(); S.playerLife = 0; render(); endGame(false); }
  // shot=start (or none): title screen is already visible.
}

boot();
