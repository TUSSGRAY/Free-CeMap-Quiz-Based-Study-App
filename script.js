// ====== CONFIG ======
const QUESTIONS_URL = './questions.json'; // keep next to index.html

// ====== UTIL ======
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

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

// ====== STATE ======
let allQuestions = [];
const run = { questions: [], index: 0, correct: 0, answers: [] };

// ====== HELPERS ======
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function getSelectedIndex() {
  const picked = optionsFormEl.querySelector('input[name="choice"]:checked');
  return picked ? Number(picked.value) : null;
}
function showToast(msg) { window.showToast ? window.showToast(msg) : alert(msg); }

// ====== RENDERING ======
function renderCurrent() {
  const total = run.questions.length;
  const i = run.index;
  const q = run.questions[i];
  if (!q) return;

  questionTextEl.textContent = q.question;

  optionsFormEl.innerHTML = q.options.map((opt, idx) => `
    <label class="choice">
      <input type="radio" name="choice" value="${idx}">
      <span>${esc(opt)}</span>
    </label>
  `).join('');

  const pct = Math.round((i / total) * 100);
  progressBarEl.style.width = pct + '%';
  progressTxtEl.textContent = `${i + 1} / ${total}`;

  nextBtn.disabled = true;
  optionsFormEl.addEventListener('change', () => {
    nextBtn.disabled = (getSelectedIndex() === null);
  }, { once: true });

  toggleReviewBtn.textContent = 'Review answers';
  reviewEl.classList.add('hidden');
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
    console.warn('Empty pool — section:', selectedSection, 'mode:', mode, 'allQuestions:', allQuestions.length);
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
  const chosen = getSelectedIndex();
  if (chosen === null) {
    showToast('Pick an answer to continue');
    return;
  }
  const correctIndex = q.answer;
  run.answers.push({ chosen, correctIndex });
  if (chosen === correctIndex) run.correct++;

  run.index++;
  if (run.index < run.questions.length) renderCurrent();
  else showResult();
}

function showResult() {
  const total = run.questions.length;
  const passMark = (total >= 100) ? 70 : 8;
  $('resultTitle').textContent = (run.correct >= passMark) ? 'Pass 🎉' : 'Keep going 💪';
  $('resultStats').textContent = `You scored ${run.correct} / ${total}. Pass mark: ${passMark}.`;
  quizEl.classList.add('hidden');
  resultEl.classList.remove('hidden');
}

// ====== REVIEW ======
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
        ${q.explanation ? `<div style="margin-top:6px; color:#a9b2d6;">💡 ${esc(q.explanation)}</div>` : ''}
        <div style="margin-top:6px; ${isCorrect ? 'color:#6be38f' : 'color:#ff9b9b'};">
          ${isCorrect ? 'Correct' : 'Incorrect'}
        </div>
      </div>
    `;
  }).join('');
}

// ====== EVENTS ======
if (startBtn)  startBtn.addEventListener('click', startQuiz);
if (nextBtn)   nextBtn.addEventListener('click', handleNext);
if (restartBtn) restartBtn.addEventListener('click', () => {
  quizEl.classList.add('hidden');
  resultEl.classList.add('hidden');
  setupEl.classList.remove('hidden');
  reviewEl.classList.add('hidden');
  toggleReviewBtn.textContent = 'Review answers';
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

// ====== LOAD + VALIDATE QUESTIONS ======
(async () => {
  try {
    const res = await fetch(QUESTIONS_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} — can't fetch questions.json (wrong path/name?)`);
    const raw = await res.text();

    let data;
    try { data = JSON.parse(raw); }
    catch (e) { throw new Error(`JSON parse error: ${e.message}`); }
    if (!Array.isArray(data)) throw new Error('questions.json must be a JSON array [ ... ].');

    const issues = [];
    const valid = [];

    data.forEach((q, i) => {
      const path = `#${i + 1}`;
      if (!q || typeof q !== 'object') { issues.push(`${path} not an object`); return; }
      if (typeof q.question !== 'string' || !q.question.trim()) { issues.push(`${path} missing "question"`); return; }
      if (!Array.isArray(q.options) || q.options.length < 2) { issues.push(`${path} "options" must be 2+`); return; }

      let ans = (typeof q.answer === 'string') ? Number(q.answer) : q.answer;
      if (!Number.isInteger(ans)) { issues.push(`${path} "answer" must be an integer index`); return; }
      if (ans < 0 || ans >= q.options.length) { issues.push(`${path} "answer" index ${ans} out of range`); return; }

      let section = (q.section ?? '').toString().trim();
      if (!section) section = 'Unspecified';

      valid.push({ section, question: q.question, options: q.options, answer: ans, explanation: q.explanation || '' });
    });

    allQuestions = valid;

    const sectionSet = new Map();
    allQuestions.forEach(q => {
      const key = q.section.trim().toLowerCase();
      if (!sectionSet.has(key)) sectionSet.set(key, q.section);
    });
    const sections = ['All', ...Array.from(sectionSet.values()).sort((a,b)=>a.localeCompare(b))];
    sectionSelectEl.innerHTML = sections.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');

    const msgParts = [];
    msgParts.push(`Found ${data.length} item(s); using ${allQuestions.length} valid.`);
    if (issues.length) {
      const top = issues.slice(0, 3).join(' • ');
      msgParts.push(`Ignored ${issues.length} invalid item(s): ${top}${issues.length > 3 ? ' …' : ''}`);
    }
    dataNoteEl.textContent = msgParts.join('  ');
    startBtn.disabled = allQuestions.length === 0;

  } catch (err) {
    console.error(err);
    startBtn.disabled = true;
    dataNoteEl.textContent =
      `Error loading questions: ${err.message}. ` +
      `Checklist: 1) questions.json next to index.html, 2) exact file name, 3) valid JSON.`;
  }
})();
