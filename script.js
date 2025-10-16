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

// Simple array shuffle (in-place copy)
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
const setupEl         = $('setup');
const quizEl          = $('quiz');
const resultEl        = $('result');

const sectionPickerEl = $('sectionPicker');
const sectionSelectEl = $('sectionSelect');
const dataNoteEl      = $('dataNote');

const startBtn        = $('startBtn');
const nextBtn         = $('nextBtn');
const restartBtn      = $('restartBtn');

const modeLabelEl     = $('modeLabel');
const progressBarEl   = $('progressBar');
const progressTxtEl   = $('progress');
const questionTextEl  = $('questionText');
const optionsFormEl   = $('optionsForm');

const toggleReviewBtn = $('toggleReviewBtn');
const reviewEl        = $('review');
const reviewListEl    = $('reviewList');

// Interstitial ad elements
const adModal   = $('adModal');
const adVideo   = $('adVideo');
const adSkipBtn = $('adSkipBtn');

// ====== STATE ======
let allQuestions = [];   // validated questions from JSON
const run = {
  questions: [],
  index: 0,        // 0-based
  correct: 0,
  answers: [],     // { chosen, correctIndex }
  revealed: false, // has the current question been revealed?
};

// ====== RENDERING ======
function renderCurrent() {
  const total = run.questions.length;
  const i = run.index;
  const q = run.questions[i];
  if (!q) return;

  // Build & cache a shuffled view order ONCE per question
  if (!q._view) {
    const base = q.options.map((_, idx) => idx); // [0,1,2,3...]
    q._view = shuffle(base);                     // shuffled original indices
  }
  const viewOrder = q._view;

  // Question text
  questionTextEl.textContent = q.question;

  // Render options as labels with a data-idx that points to ORIGINAL option index
  optionsFormEl.innerHTML = viewOrder.map((origIdx, idxInView) => `
    <label class="choice" data-idx="${origIdx}">
      <input type="radio" name="choice" value="${idxInView}">
      <span>${esc(q.options[origIdx])}</span>
    </label>
  `).join('');

  // Progress
  const pct = Math.round((i / total) * 100);
  progressBarEl.style.width = pct + '%';
  progressTxtEl.textContent = `${i + 1} / ${total}`;

  // Ensure Next is disabled until a choice is made
  nextBtn.disabled = true;
  nextBtn.textContent = 'Reveal answer';
  optionsFormEl.addEventListener('change', () => {
    nextBtn.disabled = (getSelectedIndex() === null);
  }, { once: true });

  // Close review panel if open
  if (toggleReviewBtn && reviewEl) {
    toggleReviewBtn.textContent = 'Review answers';
    reviewEl.classList.add('hidden');
  }

  // Mark current question as not yet revealed
  run.revealed = false;
}

function getSelectedIndex() {
  const picked = optionsFormEl.querySelector('input[name="choice"]:checked');
  return picked ? Number(picked.value) : null; // index in VIEW space
}

function revealAnswer(q, chosenOriginal) {
  // Disable all choices
  const labels = optionsFormEl.querySelectorAll('label.choice');
  labels.forEach(l => l.classList.add('choice-disabled'));
  optionsFormEl.querySelectorAll('input[type="radio"]').forEach(i => i.disabled = true);

  // Highlight correct in green
  const correctLabel = optionsFormEl.querySelector(`label.choice[data-idx="${q.answer}"]`);
  if (correctLabel) correctLabel.classList.add('choice-correct');

  // If wrong, mark chosen in red
  if (chosenOriginal !== q.answer) {
    const chosenLabel = optionsFormEl.querySelector(`label.choice[data-idx="${chosenOriginal}"]`);
    if (chosenLabel) chosenLabel.classList.add('choice-wrong');
  }
}

// ====== FLOW ======
function startQuiz() {
  const mode = document.querySelector('input[name="mode"]:checked')?.value || 'section';
  let selectedSection = sectionSelectEl?.value || 'All';

  // Build pool
  let pool = allQuestions;
  if (mode === 'section' && selectedSection !== 'All') {
    const needle = selectedSection.trim().toLowerCase();
    pool = pool.filter(q => (q.section || '').trim().toLowerCase() === needle);
  }

  if (!pool.length) {
    showToast('No questions available for this selection.');
    console.warn('Empty pool — section:', selectedSection, 'mode:', mode, 'allQuestions:', allQuestions.length);
    return;
  }

  // 10 for section, up to 100 for practice
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

  // First click after a selection -> reveal
  if (!run.revealed) {
    const chosenInView = getSelectedIndex();
    if (chosenInView === null) {
      showToast('Pick an answer to continue');
      return;
    }

    // Translate from view index to original option index
    const chosenOriginal = (q._view ? q._view[chosenInView] : chosenInView);

    // Record result once
    run.answers.push({ chosen: chosenOriginal, correctIndex: q.answer });
    if (chosenOriginal === q.answer) run.correct++;

    // Reveal highlights; stay on question
    revealAnswer(q, chosenOriginal);
    run.revealed = true;
    nextBtn.textContent = 'Next question';
    nextBtn.disabled = false; // ensure enabled after reveal
    return;
  }

  // Second click -> advance (and maybe show ad)
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
    const isCorrect = chosen === correct;
    return `
      <div class="card" style="margin:8px 0; padding:10px;">
        <div><strong>Q${i + 1}.</strong> ${esc(q.question)}</div>
        <div style="margin-top:6px;">
          ${q.options.map((opt, idx) => {
            const mark = (idx === correct) ? '✅' : (idx === chosen ? '❌' : '•');
            return `<div>${mark} ${esc(opt)}</div>`;
          }).join('')}
        </div>
        ${q.explanation ? `<div style="margin-top:6px; color:#475569;">💡 ${esc(q.explanation)}</div>` : ''}
        <div style="margin-top:6px; ${isCorrect ? 'color:#16a34a' : 'color:#ef4444'};">
          ${isCorrect ? 'Correct' : 'Incorrect'}
        </div>
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

    // lock background scroll
    document.body.classList.add('modal-open');

    // count a play
    const a = adStats(); a.plays++; saveAdStats(a);

    adVideo.src = AD_VIDEO_SRC;
    adModal.classList.remove('hidden');

    let seconds = AD_SECONDS;
    adSkipBtn.disabled = true;
    adSkipBtn.textContent = `Continue in ${seconds}`;

    const timer = setInterval(() => {
      seconds--;
      if (seconds > 0) {
        adSkipBtn.textContent = `Continue in ${seconds}`;
      } else {
        clearInterval(timer);
        adSkipBtn.disabled = false;
        adSkipBtn.textContent = 'Continue';
      }
    }, 1000);

    // Try autoplay
    adVideo.play().catch(() => { /* countdown still runs if blocked */ });

    const closeAd = (countClick=false) => {
      if (countClick) { const b = adStats(); b.clicks++; saveAdStats(b); }
      adVideo.pause(); adVideo.currentTime = 0; adVideo.src = '';
      adModal.classList.add('hidden');
      document.body.classList.remove('modal-open'); // unlock
      adSkipBtn.onclick = null; adVideo.onended = null;
      resolve();
    };

    adSkipBtn.onclick = () => { if (!adSkipBtn.disabled) closeAd(true); };
    adVideo.onended = () => closeAd(false);
  });
}

function maybeShowAd() {
  // After Q9, Q18, Q27... (i.e., after incrementing index), but not when finished
  const answeredCount = run.index;
  if (answeredCount > 0 && answeredCount % AD_EVERY_N === 0 && run.index < run.questions.length) {
    return playInterstitialAd();
  }
  return Promise.resolve();
}

// ====== EVENTS ======
if (startBtn)  startBtn.addEventListener('click', startQuiz);
if (nextBtn)   nextBtn.addEventListener('click', handleNext);
if (restartBtn) restartBtn.addEventListener('click', () => {
  quizEl.classList.add('hidden');
  resultEl.classList.add('hidden');
  setupEl.classList.remove('hidden');
  if (reviewEl) reviewEl.classList.add('hidden');
  if (toggleReviewBtn) toggleReviewBtn.textContent = 'Review answers';
});

// Review toggle
if (toggleReviewBtn && reviewEl) {
  toggleReviewBtn.addEventListener('click', () => {
    renderReview();
    const isHidden = reviewEl.classList.contains('hidden');
    reviewEl.classList.toggle('hidden', !isHidden);
    toggleReviewBtn.textContent = isHidden ? 'Hide review' : 'Review answers';
  });
}

// Mode switch shows/hides section picker
document.querySelectorAll('input[name="mode"]').forEach(r => {
  r.addEventListener('change', (e) => {
    sectionPickerEl.style.display = (e.target.value === 'section') ? 'block' : 'none';
  });
});

// ====== LOAD + VALIDATE QUESTIONS ======
(async () => {
  try {
    console.log('Fetching questions from', QUESTIONS_URL);
    const res = await fetch(QUESTIONS_URL, { cache: 'no-store' });
    console.log('Fetch status:', res.status, res.statusText, 'content-type:', res.headers.get('content-type'));
    if (!res.ok) throw new Error(`HTTP ${res.status} — can't fetch questions.json (wrong path/name?)`);
    const raw = await res.text();
    console.log('First 200 chars of response:\n', raw.slice(0, 200));

    let data;
    try { data = JSON.parse(raw); }
    catch (e) { throw new Error(`JSON parse error: ${e.message}`); }
    if (!Array.isArray(data)) throw new Error('questions.json must be a JSON array [ ... ].');

    const issues = [];
    const valid = [];

    data.forEach((q, i) => {
      const path = `#${i+1}`;
      if (!q || typeof q !== 'object') { issues.push(`${path} not an object`); return; }
      if (typeof q.question !== 'string' || !q.question.trim()) { issues.push(`${path} missing "question" text`); return; }
      if (!Array.isArray(q.options) || q.options.length < 2) { issues.push(`${path} "options" must be array of 2+`); return; }

      // coerce answer
      let ans = (typeof q.answer === 'string') ? Number(q.answer) : q.answer;
      if (!Number.isInteger(ans)) { issues.push(`${path} "answer" must be an integer index`); return; }
      if (ans < 0 || ans >= q.options.length) { issues.push(`${path} "answer" index ${ans} out of range (0..${q.options.length-1})`); return; }

      // normalise section
      let section = (q.section ?? '').toString().trim();
      if (!section) section = 'Unspecified';

      valid.push({
        section,
        question: q.question,
        options: q.options,
        answer: ans,
        explanation: q.explanation || ''
      });
    });

    allQuestions = valid;
    console.log('Validated questions:', allQuestions.length, allQuestions);

    // Build sections (case-insensitive unique), with “All” first
    const sectionSet = new Map(); // lowercased -> display
    allQuestions.forEach(q => {
      const key = q.section.trim().toLowerCase();
      if (!sectionSet.has(key)) sectionSet.set(key, q.section);
    });
    const sections = ['All', ...Array.from(sectionSet.values()).sort((a,b)=>a.localeCompare(b))];

    sectionSelectEl.innerHTML = sections
      .map(s => `<option value="${esc(s)}">${esc(s)}</option>`)
      .join('');

    // Status note
    const msgParts = [];
    msgParts.push(`Found ${data.length} item(s); using ${allQuestions.length} valid.`);
    if (issues.length) {
      const top = issues.slice(0, 3).join(' • ');
      msgParts.push(`Ignored ${issues.length} invalid item(s): ${top}${issues.length > 3 ? ' …' : ''}`);
    }
    dataNoteEl.textContent = msgParts.join('  ');

    // Enable start if any valid
    startBtn.disabled = allQuestions.length === 0;

  } catch (err) {
    console.error(err);
    startBtn.disabled = true;
    dataNoteEl.textContent =
      `Error loading questions: ${err.message}. ` +
      `Checklist: 1) questions.json next to index.html, 2) exact file name, 3) valid JSON array.`;
  }
})();
