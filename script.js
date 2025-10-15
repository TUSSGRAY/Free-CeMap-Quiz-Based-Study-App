// Simple CeMAP quiz engine
const QUESTIONS_URL = './questions.json'; // keep in repo root next to these files

// DOM
const setupEl = document.getElementById('setup');
const sectionPickerEl = document.getElementById('sectionPicker');
const sectionSelectEl = document.getElementById('sectionSelect');
const startBtn = document.getElementById('startBtn');
const dataNoteEl = document.getElementById('dataNote');

const quizEl = document.getElementById('quiz');
const modeLabelEl = document.getElementById('modeLabel');
const progressEl = document.getElementById('progress');
const questionTextEl = document.getElementById('questionText');
const optionsFormEl = document.getElementById('optionsForm');
const nextBtn = document.getElementById('nextBtn');

const resultEl = document.getElementById('result');
const resultTitleEl = document.getElementById('resultTitle');
const resultStatsEl = document.getElementById('resultStats');
const restartBtn = document.getElementById('restartBtn');

let allQuestions = [];
let quizQuestions = [];
let idx = 0;
let score = 0;
let mode = 'section'; // 'section' | 'practice'
let passMark = 8;     // default for section

// Helpers
const shuffle = arr => arr.sort(() => Math.random() - 0.5);

function uniqueSections(qs) {
  return [...new Set(qs.map(q => q.section || 'Unspecified'))].sort();
}

function pickRandom(arr, n) {
  const copy = [...arr];
  shuffle(copy);
  return copy.slice(0, n);
}

function setView(view) {
  // view: 'setup' | 'quiz' | 'result'
  setupEl.classList.toggle('hidden', view !== 'setup');
  quizEl.classList.toggle('hidden', view !== 'quiz');
  resultEl.classList.toggle('hidden', view !== 'result');
}

function renderQuestion() {
  const q = quizQuestions[idx];
  questionTextEl.textContent = q.question;
  optionsFormEl.innerHTML = '';

  (q.options || []).forEach((opt, i) => {
    const id = `opt-${idx}-${i}`;
    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.innerHTML = `<input type="radio" name="answer" id="${id}" value="${i}"> ${opt}`;
    optionsFormEl.appendChild(label);
  });

  progressEl.textContent = `Question ${idx + 1} of ${quizQuestions.length}`;
}

function startQuiz() {
  // Determine mode
  const chosen = [...document.querySelectorAll('input[name="mode"]')]
    .find(r => r.checked)?.value || 'section';
  mode = chosen;

  if (mode === 'section') {
    passMark = 8;
    const sel = sectionSelectEl.value;
    const pool = allQuestions.filter(q => (q.section || 'Unspecified') === sel);
    const need = 10;
    const take = Math.min(need, pool.length);
    quizQuestions = pickRandom(pool, take);
    if (take < need) {
      dataNoteEl.textContent = `Note: Only ${take} question(s) found in "${sel}". Add more to reach 10.`;
    } else {
      dataNoteEl.textContent = '';
    }
    modeLabelEl.textContent = `Section: ${sel} · Pass: ${passMark}/${need}`;
  } else {
    passMark = 70;
    const need = 100;
    const take = Math.min(need, allQuestions.length);
    quizQuestions = pickRandom(allQuestions, take);
    if (take < need) {
      dataNoteEl.textContent = `Note: Only ${take} total question(s) found. Add more to reach 100.`;
    } else {
      dataNoteEl.textContent = '';
    }
    modeLabelEl.textContent = `Practice Exam · Pass: ${passMark}/100`;
  }

  // Reset state
  idx = 0;
  score = 0;
  setView('quiz');
  renderQuestion();
}

function finishQuiz() {
  const total = quizQuestions.length;
  const passed = score >= passMark;
  resultTitleEl.textContent = passed ? '✅ Pass' : '❌ Not Yet';
  const pct = total ? Math.round((score / total) * 100) : 0;
  resultStatsEl.textContent = `Score: ${score}/${total} (${pct}%) — Pass mark: ${passMark}/${mode === 'section' ? 10 : 100}`;
  setView('result');
}

function handleNext() {
  const selected = optionsFormEl.querySelector('input[name="answer"]:checked');
  if (!selected) {
    alert('Please select an answer before continuing.');
    return;
  }
  const chosenIdx = Number(selected.value);
  const correctIdx = quizQuestions[idx].answer; // 0-based index
  if (chosenIdx === correctIdx) score += 1;

  idx += 1;
  if (idx >= quizQuestions.length) finishQuiz();
  else renderQuestion();
}

// Wire up events
startBtn.addEventListener('click', startQuiz);
nextBtn.addEventListener('click', handleNext);
restartBtn.addEventListener('click', () => setView('setup'));

// Show/hide section picker based on mode
document.querySelectorAll('input[name="mode"]').forEach(r => {
  r.addEventListener('change', (e) => {
    sectionPickerEl.style.display = (e.target.value === 'section') ? 'block' : 'none';
  });
});

// Load questions.json
fetch(QUESTIONS_URL)
  .then(res => {
    if (!res.ok) throw new Error('Could not load questions.json');
    return res.json();
  })
  .then(data => {
    allQuestions = Array.isArray(data) ? data : [];
    // Build section dropdown
    const sections = uniqueSections(allQuestions);
    sectionSelectEl.innerHTML = sections.map(s => `<option value="${s}">${s}</option>`).join('');
    document.getElementById('dataNote').textContent =
      `Loaded ${allQuestions.length} question(s) across ${sections.length} section(s).`;
  })
  .catch(err => {
    console.error(err);
    document.getElementById('dataNote').textContent =
      'Error: questions.json not found or invalid. Add it to your repo root.';
  });
