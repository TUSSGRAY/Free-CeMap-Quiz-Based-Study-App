// ====== CONFIG ======
const QUESTIONS_URL = './questions.json'; // keep next to index.html

// Interstitial ad settings
const AD_EVERY_N   = 9;              // show ad after every 9th answered question
const AD_SECONDS   = 5;              // gate for 5 seconds
const AD_VIDEO_SRC = './ad-5s.mp4';  // put this MP4 next to index.html

// ====== UTIL ======
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

// Simple array shuffle
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function showToast(msg) { window.showToast ? window.showToast(msg) : alert(msg); }

// ====== CACHE DOM ======
const setupEl = $('setup');
const quizEl = $('quiz');
const resultEl = $('result');

const sectionPickerEl = $('sectionPicker');
const sectionSelectEl = $('sectionSelect');
const dataNoteEl = $('dataNote');

const startBtn = $('startBtn');
const nextBtn = $('nextBtn');
const restartBtn = $('restartBtn');

const modeLabelEl = $('modeLabel');
const progressBarEl = $('progressBar');
const progressTxtEl = $('progress');
const questionTextEl = $('questionText');
const optionsFormEl = $('optionsForm');

const toggleReviewBtn = $('toggleReviewBtn');
const reviewEl = $('review');
const reviewListEl = $('reviewList');

// Interstitial ad elements
const adModal = $('adModal');
const adVideo = $('adVideo');
const adSkipBtn = $('adSkipBtn');

// ====== STATE ======
let allQuestions = [];
const run = { questions: [], index: 0, correct: 0, answers: [], revealed: false };

// ====== RENDERING ======
function renderCurrent() {
  const total = run.questions.length;
  const i = run.index;
  const q = run.questions[i];
  if (!q) return;

  if (!q._view) {
    const base = q.options.map((_, idx) => idx);
    q._view = shuffle(base);
  }
  const viewOrder = q._view;

  questionTextEl.textContent = q.question;
  optionsFormEl.innerHTML = viewOrder.map((origIdx, idxInView) => `
    <label class="choice" data-idx="${origIdx}">
      <input type="radio" name="choice" value="${idxInView}">
      <span>${esc(q.options[origIdx])}</span>
    </label>
  `).join('');

  const pct = Math.round((i / total) * 100);
  progressBarEl.style.width = pct + '%';
  progressTxtEl.textContent = `${i + 1} / ${total}`;

  nextBtn.disabled = true;
  nextBtn.textContent = 'Reveal answer';
  optionsFormEl.addEventListener('change', () => {
    nextBtn.disabled = (getSelectedIndex() === null);
  }, { once: true });

  if (toggleReviewBtn && reviewEl) {
    toggleReviewBtn.textContent = 'Review answers';
    reviewEl.classList.add('hidden');
  }

  run.revealed = false;
}

function getSelectedIndex() {
  const picked = optionsFormEl.querySelector('input[name="choice"]:checked');
  return picked ? Number(picked.value) : null;
}

function revealAnswer(q, chosenOriginal) {
  const labels = optionsFormEl.querySelectorAll('label.choice');
  labels.forEach(l => l.classList.add('choice-disabled'));
  optionsFormEl.querySelectorAll('input[type="radio"]').forEach(i => i.disabled = true);

  const correctLabel = optionsFormEl.querySelector(`label.choice[data-idx="${q.answer}"]`);
  if (correctLabel) correctLabel.classList.add('choice-correct');

  if (chosenOriginal !== q.answer) {
    const chosenLabel = optionsFormEl.querySelector(`label.choice[data-idx="${chosenOriginal}"]`);
    if (chosenLabel) chosenLabel.classList.add('choice-wrong');
  }
}

// ====== FLOW ======
function startQuiz() {
  const mode = document.querySelector('input[name="mode"]:checked')?.value || 'section';
  let selectedSection = sectionSelectEl?.value || 'All';

  let pool = allQuestions;
  if (mode === 'section' && selectedSection !== 'All') {
    const needle = selectedSection.trim().toLowerCase();
    pool = pool.filter(q => (q.section || '').trim().toLowerCase() === needle);
  }

  if (!pool.length) {
    showToast('No questions available for this selection.');
    return;
  }

  run.questions = shuffle(pool).slice(0, mode === 'section' ? 10 : 100);
  run.index = 0;
  run.correct = 0;
  run.answers = [];

  modeLabelEl.textContent = (mode === 'section')
    ? `${selectedSection} • ${run.questions.length}Q`
    : `Practice • ${run.questions.length}Q`;

  setupEl.classList.add('hidden');
  resultEl.classList.add('hidden');
  quizEl.classList.remove('hidden');

  renderCurrent();
}

function handleNext() {
  const q = run.questions[run.index];

  if (!run.revealed) {
    const chosenInView = getSelectedIndex();
    if (chosenInView === null) { showToast('Pick an answer'); return; }
    const chosenOriginal = (q._view ? q._view[chosenInView] : chosenInView);

    run.answers.push({ chosen: chosenOriginal, correctIndex: q.answer });
    if (chosenOriginal === q.answer) run.correct++;

    revealAnswer(q, chosenOriginal);
    run.revealed = true;
    nextBtn.textContent = 'Next question';
    nextBtn.disabled = false;
    return;
  }

  run.index++;
  if (run.index < run.questions.length) {
    maybeShowAd().then(() => renderCurrent());
  } else {
    showResult();
  }
}

function showResult() {
  const total = run.questions.length;
  const passMark = (total >= 100) ? 70 : 8;
  $('resultTitle').textContent = (run.correct >= passMark) ? 'Pass 🎉' : 'Keep going 💪';
  $('resultStats').textContent = `You scored ${run.correct} / ${total}. Pass mark: ${passMark}.`;
  quizEl.classList.add('hidden');
  resultEl.classList.remove('hidden');
}

// ====== REVIEW PANEL ======
function renderReview() {
  if (!run.questions.length) { reviewListEl.innerHTML = ''; return; }

  reviewListEl.innerHTML = run.questions.map((q, i) => {
    const a = run.answers[i];
    const chosen = a ? a.chosen : null;
    const correct = q.answer;
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

    const optionsHtml = q.options.map((opt, idx) => {
      const cls =
        (idx === correct) ? 'review-opt correct' :
        (idx === chosen && chosen !== correct) ? 'review-opt wrong' :
        'review-opt';
      const letter = letters[idx] || String.fromCharCode(65 + idx);
      return `<div class="${cls}"><strong>${letter}.</strong> ${esc(opt)}</div>`;
    }).join('');

    const outcome = (chosen === correct) ? '✅ Correct' : '❌ Incorrect';

    return `
      <div class="review-q card">
        <div class="review-title">Q${i + 1}. ${esc(q.question)}</div>
        ${optionsHtml}
        <div class="review-expl">${outcome}${q.explanation ? ` — 💡 ${esc(q.explanation)}` : ''}</div>
      </div>
    `;
  }).join('');
}

// ====== INTERSTITIAL AD ======
const LS_AD = 'cemapAdStatsV1';
function adStats() {
  try { return JSON.parse(localStorage.getItem(LS_AD)) || { plays:0, clicks:0 }; }
  catch { return { plays:0, clicks:0 }; }
}
function saveAdStats(s) { localStorage.setItem(LS_AD, JSON.stringify(s)); }

function playInterstitialAd() {
  return new Promise((resolve) => {
    if (!adModal || !adVideo || !adSkipBtn) { resolve(); return; }

    document.body.classList.add('modal-open');
    const a = adStats(); a.plays++; saveAdStats(a);

    adVideo.src = AD_VIDEO_SRC;
    adModal.classList.remove('hidden');

    let seconds = AD_SECONDS;
    adSkipBtn.disabled = true;
    adSkipBtn.textContent = `Continue in ${seconds}`;

    const timer = setInterval(() => {
      seconds--;
      if (seconds > 0) adSkipBtn.textContent = `Continue in ${seconds}`;
      else { clearInterval(timer); adSkipBtn.disabled = false; adSkipBtn.textContent = 'Continue'; }
    }, 1000);

    adVideo.play().catch(()=>{});
    const closeAd = (countClick=false) => {
      if (countClick) { const b = adStats(); b.clicks++; saveAdStats(b); }
      adVideo.pause(); adVideo.currentTime = 0; adVideo.src = '';
      adModal.classList.add('hidden');
      document.body.classList.remove('modal-open');
      adSkipBtn.onclick = null; adVideo.onended = null;
      resolve();
    };
    adSkipBtn.onclick = () => { if (!adSkipBtn.disabled) closeAd(true); };
    adVideo.onended = () => closeAd(false);
  });
}

function maybeShowAd() {
  const answeredCount = run.index;
  if (answeredCount > 0 && answeredCount % AD_EVERY_N === 0 && run.index < run.questions.length) {
    return playInterstitialAd();
  }
  return Promise.resolve();
}

// ====== EVENTS ======
if (startBtn) startBtn.addEventListener('click', startQuiz);
if (nextBtn) nextBtn.addEventListener('click', handleNext);
if (restartBtn) restartBtn.addEventListener('click', () => {
  quizEl.classList.add('hidden');
  resultEl.classList.add('hidden');
  setupEl.classList.remove('hidden');
  if (reviewEl) reviewEl.classList.add('hidden');
  if (toggleReviewBtn) toggleReviewBtn.textContent = 'Review answers';
});
if (toggleReviewBtn && reviewEl) {
  toggleReviewBtn.addEventListener('click', () => {
    renderReview();
    const isHidden = reviewEl.classList.contains('hidden');
    reviewEl.classList.toggle('hidden', !isHidden);
    toggleReviewBtn.textContent = isHidden ? 'Hide review' : 'Review answers';
  });
}
document.querySelectorAll('input[name="mode"]').forEach(r => {
  r.addEventListener('change', (e) => {
    sectionPickerEl.style.display = (e.target.value === 'section') ? 'block' : 'none';
  });
});

// ====== LOAD QUESTIONS ======
(async () => {
  try {
    const res = await fetch(QUESTIONS_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error('questions.json must be an array');

    const valid = [];
    const issues = [];
    data.forEach((q, i) => {
      if (!q || typeof q !== 'object') return;
      if (!q.question || !Array.isArray(q.options)) return;
      const ans = Number(q.answer);
      if (isNaN(ans) || ans < 0 || ans >= q.options.length) return;
      valid.push({
        section: q.section || 'General',
        question: q.question,
        options: q.options,
        answer: ans,
        explanation: q.explanation || ''
      });
    });
    allQuestions = valid;

    const sections = ['All', ...[...new Set(allQuestions.map(q => q.section))]];
    sectionSelectEl.innerHTML = sections.map(s => `<option>${esc(s)}</option>`).join('');
    dataNoteEl.textContent = `Loaded ${allQuestions.length} valid questions.`;
    startBtn.disabled = allQuestions.length === 0;
  } catch (err) {
    dataNoteEl.textContent = `Error: ${err.message}`;
    startBtn.disabled = true;
  }
})();
