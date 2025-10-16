/* ===========================
   CeMAP Quiz App (robust topic loader)
   =========================== */

/* 1) EDIT THIS LIST to include the exact path to your JSON if you know it.
      The script will try each, in order, until one works. */
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

let QUESTIONS = [];   // full bank
let ACTIVE = [];      // current quiz set
let USER = [];        // user answers
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
  toggleReviewBtn: document.getElementById("toggleReviewBtn"),

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
  els.toggleReviewBtn.addEventListener("click", () => els.review.classList.toggle("hidden"));
  els.restartBtn.addEventListener("click", resetToSetup);

  QUESTIONS = await loadQuestionsRobust();

  // If some other script already loaded a bank into window.QUESTIONS, use it
  if ((!QUESTIONS || QUESTIONS.length === 0) && Array.isArray(window.QUESTIONS)) {
    console.warn("[quiz] Falling back to window.QUESTIONS");
    QUESTIONS = normalizeBank(window.QUESTIONS);
  }

  populateTopicDropdown(QUESTIONS);
  if (els.dataNote) els.dataNote.textContent = `Loaded ${QUESTIONS.length} questions`;
}

/* ----------------
   Robust loader with diagnostics
------------------*/
async function loadQuestionsRobust() {
  for (const url of CANDIDATE_URLS) {
    try {
      console.log(`[quiz] Trying ${url}`);
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        console.warn(`[quiz] ${url} -> HTTP ${res.status}`);
        continue;
      }
      const text = await res.text();
      // quick sanity: empty file?
      if (!text || !text.trim()) {
        console.warn(`[quiz] ${url} -> empty file`);
        continue;
      }
      // Try parse JSON
      let payload;
      try {
        payload = JSON.parse(text);
      } catch (e) {
        console.error(`[quiz] ${url} -> JSON parse error:`, e);
        console.error(`[quiz] First 200 chars:\n${text.slice(0,200)}…`);
        continue;
      }
      const bank = extractQuestions(payload);
      if (bank.length) {
        console.log(`[quiz] Loaded ${bank.length} questions from ${url}`);
        // show a quick “open data” link for debugging
        addDataLink(url);
        return bank;
      } else {
        console.warn(`[quiz] ${url} parsed, but did not contain questions[] or an array`);
      }
    } catch (e) {
      console.warn(`[quiz] Fetch failed for ${url}:`, e);
    }
  }
  toast("Could not load topics JSON. Check the file path/name and JSON shape.");
  return [];
}

function addDataLink(url) {
  const note = els.dataNote;
  if (!note) return;
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener";
  a.style.marginLeft = "6px";
  a.textContent = "(view data)";
  note.appendChild(a);
}

/* Accepts {questions:[...]} or raw [...] */
function extractQuestions(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return normalizeBank(payload);
  if (Array.isArray(payload.questions)) return normalizeBank(payload.questions);
  return [];
}

/* Normalize to {section, question, options, answer, explanation} */
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
    q.section && q.question && Array.isArray(q.options) && q.options.length > 1 && Number.isInteger(q.answer)
  );
}

/* ----------------
   Topic dropdown from QUESTIONS
------------------*/
function populateTopicDropdown(bank) {
  const sel = els.sectionSelect;
  if (!sel) return;

  const topics = buildTopicIndex(bank); // [{num, title, count}]
  sel.innerHTML = ""; // wipe any Unit options
  sel.appendChild(new Option("All topics", "__ALL__"));

  topics.forEach(t => {
    // Strictly 1..24? uncomment next line:
    // if (t.num < 1 || t.num > 24) return;
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
    if (!item.title && title) item.title = title;
    map.set(num, item);
  }
  return [...map.values()].sort((a, b) => a.num - b.num);
}

/* ----------------
   Start a quiz
------------------*/
function startQuiz() {
  const selected = els.sectionSelect.value || "__ALL__";
  const isAll = (selected === "__ALL__");
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
  els.review.classList.add("hidden");
  els.quiz.classList.remove("hidden");

  updateModeChip();
  renderQuestion();
  updateProgress();
}

/* ----------------
   Render Q / Next
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

  if (USER[idx] !== null) {
    const prev = els.optionsForm.querySelector(`input[value="${USER[idx]}"]`);
    if (prev) prev.checked = true;
  }

  els.nextBtn.textContent = (idx === ACTIVE.length - 1) ? "Submit" : "Next";
}

function onNext() {
  const chosen = els.optionsForm.querySelector("input[type=radio]:checked");
  USER[idx] = chosen ? Number(chosen.value) : null;

  if (idx < ACTIVE.length - 1) {
    idx++;
    renderQuestion();
    updateProgress();
  } else {
    submitQuiz();
  }
}

/* ----------------
   Progress / Score
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
  const rows = [];

  ACTIVE.forEach((q, i) => {
    const user = USER[i];
    const ok = (user === q.answer);
    if (ok) correct++;
    rows.push({
      section: q.section,
      question: q.question,
      correctText: q.options[q.answer],
      userText: user !== null ? q.options[user] : "—",
      ok,
      explanation: q.explanation || ""
    });
  });

  const total = ACTIVE.length;
  const pct = Math.round(100 * correct / total);
  const passReq = (mode === "practice") ? PASS_PRACTICE : PASS_SECTION;
  const passed = correct >= passReq;

  els.reviewList.innerHTML = "";
  rows.forEach(r => {
    const div = document.createElement("div");
    div.className = "review-item";
    div.innerHTML = `
      <div class="review-q"><strong>${escapeHtml(r.section)}</strong><br>${escapeHtml(r.question)}</div>
      <div class="review-a">Correct: <strong>${escapeHtml(r.correctText)}</strong></div>
      <div class="review-u">Your answer: ${escapeHtml(r.userText)} ${r.ok ? "✅" : "❌"}</div>
      ${r.explanation ? `<div class="review-expl">${escapeHtml(r.explanation)}</div>` : ""}`;
    els.reviewList.appendChild(div);
  });

  els.quiz.classList.add("hidden");
  els.review.classList.remove("hidden");
  els.result.classList.remove("hidden");

  els.resultTitle.textContent = passed ? "Pass 🎉" : "Try again 💪";
  els.resultStats.textContent = `Score: ${correct}/${total} (${pct}%) — required pass ${passReq}`;
  els.progressBar.style.width = "100%";
  toast(`You scored ${correct}/${total}`);
}
function resetToSetup() {
  els.quiz.classList.add("hidden");
  els.result.classList.add("hidden");
  els.setup.classList.remove("hidden");
  els.review.classList.add("hidden");
  idx = 0;
  USER = [];
  ACTIVE = [];
}

/* ----------------
   Helpers
------------------*/
function sampleN(arr, n) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(n, a.length));
}
function escapeHtml(s){
  return (s || "").toString().replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
function toast(msg){ if (window.showToast) window.showToast(msg); }
function updateModeChip(){
  const val = (document.querySelector('input[name="mode"]:checked') || {}).value || "section";
  mode = val;
  els.modeLabel.textContent = (mode === "practice")
    ? "Practice exam (100 Q • pass 70)"
    : "Section quiz (10 Q • pass 8)";
}
