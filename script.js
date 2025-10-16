/* ===========================
   CeMAP Quiz App (no review button)
   =========================== */

const CANDIDATE_URLS = [
  "data/cemap_topics_1_24_combined.json",
  "./data/cemap_topics_1_24_combined.json",
  "cemap_topics_1_24_combined.json",
  "./cemap_topics_1_24_combined.json",
  "data/questions.json",
  "./data/questions.json",
  "questions.json",
  "./questions.json"
];

const SECTION_SIZE = 10;
const PRACTICE_SIZE = 100;
const PASS_SECTION = 8;
const PASS_PRACTICE = 70;

let QUESTIONS = [];
let ACTIVE = [];
let USER = [];
let idx = 0;
let mode = "section";

const els = {
  modeRadios: [...document.querySelectorAll('input[name="mode"]')],
  sectionSelect: document.getElementById("sectionSelect"),
  startBtn: document.getElementById("startBtn"),
  dataNote: document.getElementById("dataNote"),
  setup: document.getElementById("setup"),
  quiz: document.getElementById("quiz"),
  result: document.getElementById("result"),
  questionText: document.getElementById("questionText"),
  optionsForm: document.getElementById("optionsForm"),
  nextBtn: document.getElementById("nextBtn"),
  modeLabel: document.getElementById("modeLabel"),
  progressBar: document.getElementById("progressBar"),
  progressTxt: document.getElementById("progress"),
  review: document.getElementById("review"),
  reviewList: document.getElementById("reviewList"),
  resultTitle: document.getElementById("resultTitle"),
  resultStats: document.getElementById("resultStats"),
  restartBtn: document.getElementById("restartBtn"),
};

bootstrap();

async function bootstrap() {
  els.modeRadios.forEach(r => r.addEventListener("change", () => {
    mode = document.querySelector('input[name="mode"]:checked').value;
    updateModeChip();
  }));
  updateModeChip();

  els.startBtn.addEventListener("click", startQuiz);
  els.nextBtn.addEventListener("click", onNext);
  els.restartBtn.addEventListener("click", resetToSetup);

  QUESTIONS = await loadQuestionsRobust();
  if ((!QUESTIONS || QUESTIONS.length === 0) && Array.isArray(window.QUESTIONS)) {
    QUESTIONS = normalizeBank(window.QUESTIONS);
  }

  populateTopicDropdown(QUESTIONS);
  if (els.dataNote) els.dataNote.textContent = `Loaded ${QUESTIONS.length} questions`;
}

/* ----------------
   Robust loader
------------------*/
async function loadQuestionsRobust() {
  for (const url of CANDIDATE_URLS) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.trim()) continue;

      let payload;
      try { payload = JSON.parse(text); } catch { continue; }

      const bank = extractQuestions(payload);
      if (bank.length) return bank;
    } catch (e) { console.warn(`[quiz] Fetch failed for ${url}:`, e); }
  }
  toast("Could not load topics JSON.");
  return [];
}

function extractQuestions(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return normalizeBank(payload);
  if (Array.isArray(payload.questions)) return normalizeBank(payload.questions);
  return [];
}

function normalizeBank(arr) {
  return arr.map(x => {
    const section = (x.section || x.topic || "").toString();
    const question = (x.question || x.q || "").toString();
    const options = (x.options || x.choices || []).map(o => o.toString());
    let answer = Number.isInteger(x.answer) ? x.answer : x.answerIndex;
    if (!Number.isInteger(answer) && typeof x.correct === "string") {
      const i = options.findIndex(o => o.trim().toLowerCase() === x.correct.trim().toLowerCase());
      if (i >= 0) answer = i;
    }
    const explanation = (x.explanation || x.explain || "").toString();
    return { section, question, options, answer, explanation };
  }).filter(q =>
    q.section && q.question && Array.isArray(q.options) &&
    q.options.length > 1 && Number.isInteger(q.answer)
  );
}

/* ----------------
   Topic dropdown
------------------*/
function populateTopicDropdown(bank) {
  const sel = els.sectionSelect;
  if (!sel) return;
  const topics = buildTopicIndex(bank);
  sel.innerHTML = "";
  sel.appendChild(new Option("All topics", "__ALL__"));
  topics.forEach(t => {
    const label = `Topic ${t.num}: ${t.title} (${t.count})`;
    sel.appendChild(new Option(label, String(t.num)));
  });
  sel.value = "__ALL__";
}

function buildTopicIndex(bank) {
  const map = new Map();
  const re = /^Topic\s*(\d{1,2})\s*:\s*(.+)$/i;
  for (const q of bank) {
    const sec = (q.section || "").trim();
    const m = sec.match(re);
    if (!m) continue;
    const num = Number(m[1]);
    const title = m[2].trim();
    const item = map.get(num) || { num, title, count: 0 };
    item.count += 1;
    map.set(num, item);
  }
  return [...map.values()].sort((a, b) => a.num - b.num);
}

/* ----------------
   Start Quiz
------------------*/
function startQuiz() {
  const selected = els.sectionSelect.value || "__ALL__";
  const isAll = selected === "__ALL__";
  let pool = QUESTIONS;

  if (!isAll) {
    const prefix = `Topic ${selected}:`;
    pool = QUESTIONS.filter(q => (q.section || "").startsWith(prefix));
  }

  if (pool.length === 0) {
    toast("No questions found for this topic.");
    return;
  }

  const size = (mode === "practice") ? PRACTICE_SIZE : SECTION_SIZE;
  ACTIVE = sampleN(pool, size);
  USER = new Array(ACTIVE.length).fill(null);
  idx = 0;

  els.setup.classList.add("hidden");
  els.result.classList.add("hidden");
  els.quiz.classList.remove("hidden");
  els.review.classList.add("hidden"); // never shown now

  updateModeChip();
  renderQuestion();
  updateProgress();
}

/* ----------------
   Render Question + Feedback
------------------*/
function renderQuestion() {
  const q = ACTIVE[idx];
  els.questionText.textContent = q.question;
  els.optionsForm.innerHTML = "";

  q.options.forEach((opt, i) => {
    const id = `opt_${idx}_${i}`;
    const label = document.createElement("label");
    label.className = "choice";
    label.htmlFor = id;
    label.innerHTML = `
      <input type="radio" name="q_${idx}" id="${id}" value="${i}">
      <span>${escapeHtml(opt)}</span>`;
    els.optionsForm.appendChild(label);
  });

  els.optionsForm.addEventListener("change", handleAnswerSelection, { once: true });
  els.nextBtn.textContent = (idx === ACTIVE.length - 1) ? "Submit" : "Next";
}

function handleAnswerSelection(e) {
  const selected = parseInt(e.target.value);
  const q = ACTIVE[idx];
  USER[idx] = selected;

  const labels = [...els.optionsForm.querySelectorAll("label")];
  labels.forEach((lbl, i) => {
    lbl.classList.add("disabled");
    if (i === q.answer) lbl.classList.add("correct");
    if (i === selected && selected !== q.answer) lbl.classList.add("wrong");
    lbl.querySelector("input").disabled = true;
  });

  const expl = document.createElement("p");
  expl.className = "explanation";
  expl.textContent = q.explanation || "No explanation provided.";
  els.optionsForm.appendChild(expl);

  if (selected === q.answer) {
    toast("✅ Correct!");
  } else {
    toast(`❌ Incorrect. Correct: ${q.options[q.answer]}`);
  }
}

/* ----------------
   Navigation
------------------*/
function onNext() {
  if (idx < ACTIVE.length - 1) {
    idx++;
    renderQuestion();
    updateProgress();
  } else {
    submitQuiz();
  }
}

/* ----------------
   Progress & Score
------------------*/
function updateProgress() {
  const total = ACTIVE.length;
  const current = idx + 1;
  els.progressTxt.textContent = `Question ${current} of ${total}`;
  const pct = Math.round((current - 1) / total * 100);
  els.progressBar.style.width = `${pct}%`;
}

function submitQuiz() {
  let correct = 0;
  ACTIVE.forEach((q, i) => {
    const user = USER[i];
    if (user === q.answer) correct++;
  });

  const total = ACTIVE.length;
  const pct = Math.round((correct / total) * 100);
  const passReq = (mode === "practice") ? PASS_PRACTICE : PASS_SECTION;
  const passed = correct >= passReq;

  els.quiz.classList.add("hidden");
  els.result.classList.remove("hidden");
  els.resultTitle.textContent = passed ? "Pass 🎉" : "Try again 💪";
  els.resultStats.textContent = `Score: ${correct}/${total} (${pct}%) — required pass ${passReq}`;
  els.progressBar.style.width = "100%";
  toast(`You scored ${correct}/${total}`);
}

/* ----------------
   Helpers
------------------*/
function resetToSetup() {
  els.quiz.classList.add("hidden");
  els.result.classList.add("hidden");
  els.setup.classList.remove("hidden");
  idx = 0; USER = []; ACTIVE = [];
}

function sampleN(arr, n) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(n, a.length));
}

function escapeHtml(s) {
  return (s || "").toString().replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function toast(msg) { if (window.showToast) window.showToast(msg); }

function updateModeChip() {
  const val = (document.querySelector('input[name="mode"]:checked') || {}).value || "section";
  mode = val;
  els.modeLabel.textContent = (mode === "practice")
    ? "Practice exam (100 Q • pass 70)"
    : "Section quiz (10 Q • pass 8)";
}
