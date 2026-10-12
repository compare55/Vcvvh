// ========================
// AVIATOR GAME
// ========================
const aviator = {
  state: 'idle',
  multiplier: 1.00,
  crashPoint: 0,
  betPlaced: false,
  betAmount: 0,
  cashedOut: false,
  cashedAt: 0,
  balance: parseInt(localStorage.getItem('demoBalance')) || 1000,
  history: JSON.parse(localStorage.getItem('aviatorHistory')) || [],
  countdown: 5,
  planeX: 0,
  planeY: 0,
  flightPath: [],
  animationId: null
};

const canvas = document.getElementById('aviatorCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ========================
// CRASH POINT (RNG)
// ========================
function generateCrashPoint() {
  const r = Math.random();
  if (r < 0.03) return 1.00;
  const crash = 0.99 / (1 - Math.random());
  return Math.min(Math.max(1.01, crash), 200);
}

// ========================
// GAME LOOP
// ========================
function startRound() {
  aviator.state = 'countdown';
  aviator.multiplier = 1.00;
  aviator.crashPoint = generateCrashPoint();
  aviator.betPlaced = false;
  aviator.cashedOut = false;
  aviator.countdown = 5;
  aviator.flightPath = [];
  aviator.planeX = 0;
  aviator.planeY = canvas.height;
  updateMultiplierDisplay(1.00);
  updateStatus('Waiting for bets...');
  updateActionButton();

  const countdownInterval = setInterval(() => {
    aviator.countdown--;
    if (aviator.countdown === 1) playAviatorCue('preflight');
    updateStatus(`Starting in ${aviator.countdown}s`);
    if (aviator.countdown <= 0) {
      clearInterval(countdownInterval);
      startFlight();
    }
  }, 1000);
}

function startFlight() {
  aviator.state = 'flying';
  updateStatus('Flying...');
  updateActionButton();
  const startTime = performance.now();

  function flightLoop(now) {
    if (aviator.state !== 'flying') return;
    const elapsed = (now - startTime) / 1000;
    aviator.multiplier = 1.00 + Math.pow(elapsed, 1.6) * 0.5;
    aviator.multiplier = Math.round(aviator.multiplier * 100) / 100;
    updateMultiplierDisplay(aviator.multiplier);
    updatePlanePosition(elapsed);
    drawCanvas();

    const autoVal = parseFloat(document.getElementById('autoCashout').value);
    if (aviator.betPlaced && !aviator.cashedOut && aviator.multiplier >= autoVal) {
      cashOut();
    }

    if (aviator.multiplier >= aviator.crashPoint) {
      crash();
      return;
    }

    aviator.animationId = requestAnimationFrame(flightLoop);
  }
  aviator.animationId = requestAnimationFrame(flightLoop);
}

function crash() {
  playAviatorCue('crash');
  aviator.state = 'crashed';
  aviator.multiplier = aviator.crashPoint;
  updateMultiplierDisplay(aviator.crashPoint);
  updateStatus(`Flew away at ${aviator.crashPoint.toFixed(2)}x!`);

  aviator.history.unshift(aviator.crashPoint.toFixed(2));
  aviator.history = aviator.history.slice(0, 20);
  localStorage.setItem('aviatorHistory', JSON.stringify(aviator.history));
  renderHistory();

  if (aviator.betPlaced && !aviator.cashedOut) {
    addTx('bet', aviator.betAmount, 'Aviator Lost');
    showToast(`💥 Crashed! Lost ${aviator.betAmount} coins`);
  }

  updateAllBalances();
  updateActionButton();
  setTimeout(() => startRound(), 3000);
}

function cashOut() {
  if (!aviator.betPlaced || aviator.cashedOut) return;
  aviator.cashedOut = true;
  aviator.cashedAt = aviator.multiplier;
  const winAmount = Math.floor(aviator.betAmount * aviator.multiplier);
  aviator.balance += winAmount;
  updateAllBalances();
  addTx('win', winAmount, `Aviator @ ${aviator.multiplier.toFixed(2)}x`);
  showToast(`✈️ Cashed out at ${aviator.multiplier.toFixed(2)}x! +${winAmount}`);
  updateActionButton();
}

// ========================
// CANVAS
// ========================
function updatePlanePosition(elapsed) {
  const progress = Math.min(elapsed / 10, 1);
  aviator.planeX = 34 + progress * (canvas.width - 100);
  const rise = Math.pow(progress, 1.32) * (canvas.height - 92);
  aviator.planeY = canvas.height - 28 - rise + Math.sin(progress * Math.PI) * 8;
  aviator.flightPath.push({ x: aviator.planeX, y: aviator.planeY });
  if (aviator.flightPath.length > 300) aviator.flightPath.shift();
}

function drawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const w = canvas.width, h = canvas.height;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#17191d');
  bg.addColorStop(1, '#08090b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle dark grid, like the reference game's flight field.
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 42) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 42) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  if (aviator.flightPath.length > 1) {
    // Soft glow beneath the red flight trail.
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(aviator.flightPath[0].x, aviator.flightPath[0].y);
    for (let i = 1; i < aviator.flightPath.length; i++) ctx.lineTo(aviator.flightPath[i].x, aviator.flightPath[i].y);
    ctx.strokeStyle = 'rgba(255,35,55,0.18)'; ctx.lineWidth = 14; ctx.shadowColor = '#ff2438'; ctx.shadowBlur = 18; ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#f3263c'; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(243,38,60,0.18)';
    ctx.beginPath(); ctx.moveTo(aviator.flightPath[0].x, h);
    for (let i = 0; i < aviator.flightPath.length; i++) ctx.lineTo(aviator.flightPath[i].x, aviator.flightPath[i].y);
    ctx.lineTo(aviator.flightPath[aviator.flightPath.length - 1].x, h); ctx.closePath(); ctx.fill();
  }

  if (aviator.state === 'flying' || aviator.state === 'crashed') {
    ctx.save();
    ctx.translate(aviator.planeX, aviator.planeY);
    ctx.rotate(-0.22);
    ctx.shadowColor = '#ff2438'; ctx.shadowBlur = 16;
    ctx.fillStyle = '#f5f5f5';
    // Compact white/red plane silhouette instead of an emoji glyph.
    ctx.beginPath(); ctx.moveTo(-22, 1); ctx.lineTo(9, -3); ctx.lineTo(24, 0); ctx.lineTo(9, 4); ctx.lineTo(-22, 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f3263c';
    ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-13, -13); ctx.lineTo(4, -3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-6, 2); ctx.lineTo(-15, 10); ctx.lineTo(2, 4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-24, -5); ctx.lineTo(-21, 2); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// ========================
// UI UPDATES
// ========================
function updateMultiplierDisplay(val) {
  const el = document.getElementById('multiplierDisplay');
  el.textContent = val.toFixed(2) + 'x';
  if (aviator.state === 'crashed') el.style.color = '#e94560';
  else if (aviator.cashedOut) el.style.color = '#2ecc71';
  else el.style.color = '#f1c40f';
}

function updateStatus(msg) {
  document.getElementById('statusText').textContent = msg;
}

function updateActionButton() {
  const btn = document.getElementById('aviatorActionBtn');

  if (aviator.state === 'idle' || aviator.state === 'countdown') {
    if (aviator.betPlaced) {
      btn.textContent = 'BET PLACED ✓';
      btn.className = 'aviator-action-btn placed';
      btn.disabled = true;
    } else {
      btn.textContent = 'PLACE BET';
      btn.className = 'aviator-action-btn';
      btn.disabled = false;
    }
  } else if (aviator.state === 'flying') {
    if (aviator.cashedOut) {
      btn.textContent = `CASHED OUT @ ${aviator.cashedAt.toFixed(2)}x`;
      btn.className = 'aviator-action-btn cashed';
      btn.disabled = true;
    } else if (aviator.betPlaced) {
      btn.textContent = `CASH OUT (${aviator.multiplier.toFixed(2)}x)`;
      btn.className = 'aviator-action-btn cashout';
      btn.disabled = false;
    } else {
      btn.textContent = 'WAITING...';
      btn.className = 'aviator-action-btn';
      btn.disabled = true;
    }
  } else {
    btn.textContent = 'CRASHED 💥';
    btn.className = 'aviator-action-btn crashed';
    btn.disabled = true;
  }
}

document.getElementById('aviatorActionBtn').addEventListener('click', () => {
  if (aviator.state === 'idle' || aviator.state === 'countdown') {
    placeBet();
  } else if (aviator.state === 'flying' && aviator.betPlaced && !aviator.cashedOut) {
    cashOut();
  }
});

function placeBet() {
  const bet = parseInt(document.getElementById('aviatorBet').value);
  if (bet < 10) { showToast('Minimum bet is 10 coins'); return; }
  if (aviator.balance < bet) { showToast('Insufficient coins!'); return; }
  aviator.betAmount = bet;
  aviator.betPlaced = true;
  aviator.balance -= bet;
  updateAllBalances();
  addTx('bet', bet, 'Aviator Bet');
  updateActionButton();
  showToast(`Bet placed: ${bet} coins`);
}

function adjustBet(amount) {
  const input = document.getElementById('aviatorBet');
  let val = parseInt(input.value) + amount;
  if (val < 10) val = 10;
  input.value = val;
}
function setBet(amount) {
  document.getElementById('aviatorBet').value = amount;
}

// ========================
// HISTORY
// ========================
function renderHistory() {
  const bar = document.getElementById('historyBar');
  if (!bar) return;
  bar.innerHTML = aviator.history.map(h => {
    const val = parseFloat(h);
    const color = val < 2 ? '#e94560' : val < 5 ? '#f39c12' : '#2ecc71';
    return `<span style="color:${color}">${h}x</span>`;
  }).join('');
}

// ========================
// WALLET
// ========================
function updateAllBalances() {
  const navBal = document.getElementById('navBalance');
  if (navBal) navBal.textContent = aviator.balance;
  const walletBal = document.getElementById('walletBalance');
  if (walletBal) walletBal.textContent = aviator.balance;
  localStorage.setItem('demoBalance', aviator.balance);
}

function addTx(type, amount, note = '') {
  const tx = JSON.parse(localStorage.getItem('demoTx')) || [];
  tx.unshift({ type, amount, note, time: new Date().toLocaleTimeString() });
  localStorage.setItem('demoTx', JSON.stringify(tx.slice(0, 30)));
}

function openWallet() {
  document.getElementById('walletModal').classList.remove('hidden');
  updateAllBalances();
  renderTx();
}
function closeWallet() {
  document.getElementById('walletModal').classList.add('hidden');
}
function addCoins() {
  aviator.balance += 1000;
  updateAllBalances();
  addTx('add', 1000, 'Coins Added');
  showToast('+1000 Coins added! 🪙');
}
function withdrawCoins() {
  if (aviator.balance <= 0) { showToast('No coins to withdraw!'); return; }
  const amount = Math.min(aviator.balance, 500);
  aviator.balance -= amount;
  updateAllBalances();
  addTx('withdraw', amount, 'Withdrawn to Vault');
  showToast(`${amount} coins moved to Vault 🔒`);
}

function renderTx() {
  const box = document.getElementById('txHistory');
  if (!box) return;
  const tx = JSON.parse(localStorage.getItem('demoTx')) || [];
  if (tx.length === 0) {
    box.innerHTML = '<div style="padding:0.5rem;color:#666;text-align:center;">No transactions yet</div>';
    return;
  }
  box.innerHTML = tx.map(t => {
    const sign = (t.type === 'add' || t.type === 'win') ? '+' : '-';
    return `<div class="tx-item"><span>${t.note}</span><span class="tx-${t.type}">${sign}${t.amount}</span></div>`;
  }).join('');
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2500);
}


// Sound cues sampled from the user's own reference recording.
// Browser audio is enabled only after the player taps SOUND ON (autoplay policy).
const aviatorAudio = document.getElementById('aviatorOriginalAudio');
const aviatorSoundToggle = document.getElementById('aviatorSoundToggle');
let aviatorSoundEnabled = false;
let aviatorCueStopTimer = null;
const AVIATOR_CUES = {
  // Short tone immediately before the flight begins, and the sharp cue at fly-away.
  // Both use sections of the supplied video audio, not replacement stock sounds.
  preflight: { start: 0.00, end: 0.48 },
  crash: { start: 9.30, end: 10.35 }
};
function playAviatorCue(name) {
  if (!aviatorAudio || !aviatorSoundEnabled) return;
  const cue = AVIATOR_CUES[name];
  if (!cue) return;
  clearTimeout(aviatorCueStopTimer);
  try {
    aviatorAudio.pause();
    aviatorAudio.currentTime = cue.start;
    const playback = aviatorAudio.play();
    if (playback && playback.catch) playback.catch(() => {});
    aviatorCueStopTimer = setTimeout(() => {
      aviatorAudio.pause();
    }, (cue.end - cue.start) * 1000);
  } catch (err) { /* keep the game playable if audio is unavailable */ }
}
if (aviatorAudio && aviatorSoundToggle) {
  aviatorAudio.loop = false;
  aviatorAudio.volume = 0.95;
  aviatorSoundToggle.addEventListener('click', async () => {
    aviatorSoundEnabled = !aviatorSoundEnabled;
    if (aviatorSoundEnabled) {
      aviatorSoundToggle.textContent = '🔊 SOUND ON';
      aviatorSoundToggle.setAttribute('aria-pressed', 'true');
      // Unlock audio from the user's direct tap; don't play the whole recording.
      try {
        aviatorAudio.currentTime = 0;
        await aviatorAudio.play();
        aviatorAudio.pause();
        aviatorAudio.currentTime = 0;
        showToast('Aviator sound enabled');
      } catch (err) {
        aviatorSoundEnabled = false;
        aviatorSoundToggle.textContent = '🔇 SOUND OFF';
        aviatorSoundToggle.setAttribute('aria-pressed', 'false');
        showToast('Tap SOUND ON again to allow audio');
      }
    } else {
      clearTimeout(aviatorCueStopTimer);
      aviatorAudio.pause();
      aviatorSoundToggle.textContent = '🔇 SOUND OFF';
      aviatorSoundToggle.setAttribute('aria-pressed', 'false');
    }
  });
}

// ========================
// INIT
// ========================
renderHistory();
updateAllBalances();
startRound();
