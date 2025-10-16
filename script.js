/* ===========================
   CeMAP Quiz App — Grouped Topics + AdSense Popup
   =========================== */

const CANDIDATE_URLS = [
  "data/cemap_topics_1_24_combined.json",
  "./data/cemap_topics_1_24_combined.json",
  "data/questions.json",
  "./data/questions.json",
  "questions.json",
  "./questions.json"
];

const SECTION_SIZE = 10;
const PRACTICE_SIZE = 100;
const PASS_SECTION = 8;
const PASS_PRACTICE = 70;

const QUIZ_GROUPS = [
  { label: "Quiz 1: Topics 1–5", range: [1, 5] },
  { label: "Quiz 2: Topics 6–10", range: [6, 10] },
  { label: "Quiz 3: Topics 11–15", range: [11, 15] },
  { label: "Quiz 4: Topics 16–20", range: [16, 20] },
  { label: "Quiz 5: Topics 21–24", range: [21, 24] }
];

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
  resultTitle: document.getElementById("resultTitle"),
  resultStats: document.getElementById("resultStats"),
  restartBtn: document.getElementById("restartBtn"),
  adModal: document.getElementById("adModal"),
  adCountdown: document.getElementById("adCountdown")
};

/* ===========================
   INIT
   =========================== */
bootstrap();

async function bootstrap() {
  els.modeRadios.forEach(r =>
    r.addEventListener("change", () => {
      mode = document.querySelector('input[name="mode"]:checked').value;
      updateModeChip();
      toggleDropdownForMode();
    })
  );

  els.startBtn.addEventListener("click", startQuiz);
  els.nextBtn.addEventListener("click", onNext);
  els.restartBtn.addEventListener("click", resetToSetup);

  QUESTIONS = await loadQuestionsRobust();
  if ((!QUESTIONS || QUESTIONS.length === 0) && Array.isArray(window.QUESTIONS)) {
    QUESTIONS = normalizeBank(window.QUESTIONS);
  }

  populateQuizDropdown();
  toggleDropdownForMode();

  if (els.dataNote) els.dataNote.textContent = `Loaded ${QUESTIONS.length} questions`;
}

/* ===========================
   LOAD + NORMALIZE QUESTIONS
   =========================== */
async function loadQuestionsRobust() {
  for (const url of CANDIDATE_URLS) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.trim()) continue;

      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        continue;
      }

      const bank = extractQuestions(payload);
      if (bank.length) return bank;
    } catch (e) {
      console.warn(`[quiz] Fetch failed for ${url}:`, e);
    }
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
  return arr
    .map(x => {
      const section = (x.section || x.topic || "").toString();
      const question = (x.question || x.q || "").toString();
      const options = (x.options || x.choices || []).map(o => o.toString());
      let answer = Number.isInteger(x.answer) ? x.answer : x.answerIndex;
      if (!Number.isInteger(answer) && typeof x.correct === "string") {
        const i = options.findIndex(
          o => o.trim().toLowerCase() === x.correct.trim().toLowerCase()
        );
        if (i >= 0) answer = i;
      }
      const explanation = (x.explanation || x.explain || "").toString();
      return { section, question, options, answer, explanation };
    })
    .filter(
      q =>
        q.section &&
        q.question &&
        Array.isArray(q.options) &&
        q.options.length > 1 &&
        Number.isInteger(q.answer)
    );
}

/* ===========================
   DROPDOWN
   =========================== */
function populateQuizDropdown() {
  const sel = els.sectionSelect;
  if (!sel) return;

  sel.innerHTML = "";
  QUIZ_GROUPS.forEach((group, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = group.label;
    sel.appendChild(opt);
  });
}

function toggleDropdownForMode() {
  els.sectionSelect.disabled = mode === "practice";
  els.sectionSelect.style.opacity = mode === "practice" ? "0.5" : "1";
}

/* ===========================
   START QUIZ
   =========================== */
function startQuiz() {
  let pool = [];

  if (mode === "practice") {
    pool = QUESTIONS;
    ACTIVE = sampleN(pool, PRACTICE_SIZE);
    els.modeLabel.textContent = "Full Practice Exam • 100 Questions";
  } else {
    const selectedIndex = parseInt(els.sectionSelect.value);
    const selectedGroup = QUIZ_GROUPS[selectedIndex];
    if (!selectedGroup) {
      toast("Please select a quiz group.");
      return;
    }
    const [start, end] = selectedGroup.range;
    pool = QUESTIONS.filter(q => {
      const m = q.section.match(/^Topic\s+(\d+)/i);
      const topicNum = m ? parseInt(m[1]) : 0;
      return topicNum >= start && topicNum <= end;
    });
    if (pool.length === 0) {
      toast("No questions found for this quiz range.");
      return;
    }
    ACTIVE = sampleN(pool, SECTION_SIZE);
    els.modeLabel.textContent = `${selectedGroup.label} • ${SECTION_SIZE} Questions`;
  }

  USER = new Array(ACTIVE.length).fill(null);
  idx = 0;

  els.setup.classList.add("hidden");
  els.result.classList.add("hidden");
  els.quiz.classList.remove("hidden");

  renderQuestion();
  updateProgress();
}

/* ===========================
   RENDER + ANSWER
   =========================== */
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
  els.nextBtn.textContent = idx === ACTIVE.length - 1 ? "Submit" : "Next";
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

  toast(selected === q.answer ? "✅ Correct!" : `❌ Incorrect. Correct: ${q.options[q.answer]}`);
}

/* ===========================
   AD POPUP + NAVIGATION
   =========================== */
function showAdvert(callback) {
  const modal = els.adModal;
  const countdownEl = els.adCountdown;
  if (!modal || !countdownEl) {
    if (callback) callback();
    return;
  }

  // Inject AdSense if not already done
  if (!modal.querySelector(".adsbygoogle")) {
    const ad = document.createElement("div");
    ad.innerHTML = `
      <ins class="adsbygoogle"
           style="display:block"
           data-ad-client="ca-pub-XXXXXXXXXXXX"
           data-ad-slot="YYYYYYYYYY"
           data-ad-format="auto"
           data-full-width-responsive="true"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    `;
    modal.querySelector("div").appendChild(ad);
  }

  let counter = 5;
  modal.classList.remove("hidden");
  countdownEl.textContent = `Ad ends in ${counter}s...`;

  const timer = setInterval(() => {
    counter--;
    countdownEl.textContent = `Ad ends in ${counter}s...`;
    if (counter <= 0) {
      clearInterval(timer);
      modal.classList.add("hidden");
      if (callback) callback();
    }
  }, 1000);
}

function onNext() {
  // Show ad every 9th question (except last)
  if ((idx + 1) % 9 === 0 && idx < ACTIVE.length - 1) {
    showAdvert(() => nextStep());
  } else {
    nextStep();
  }
}

function nextStep() {
  if (idx < ACTIVE.length - 1) {
    idx++;
    renderQuestion();
    updateProgress();
  } else {
    submitQuiz();
  }
}

/* ===========================
   SCORING + RESET
   =========================== */
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
    if (USER[i] === q.answer) correct++;
  });

  const total = ACTIVE.length;
  const pct = Math.round((correct / total) * 100);
  const passReq = mode === "practice" ? PASS_PRACTICE : PASS_SECTION;
  const passed = correct >= passReq;

  els.quiz.classList.add("hidden");
  els.result.classList.remove("hidden");
  els.resultTitle.textContent = passed ? "Pass 🎉" : "Try again 💪";
  els.resultStats.textContent = `Score: ${correct}/${total} (${pct}%) — pass mark ${passReq}`;
  els.progressBar.style.width = "100%";
  toast(`You scored ${correct}/${total}`);
}

function resetToSetup() {
  els.quiz.classList.add("hidden");
  els.result.classList.add("hidden");
  els.setup.classList.remove("hidden");
  idx = 0;
  USER = [];
  ACTIVE = [];
}

/* ===========================
   HELPERS
   =========================== */
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
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function toast(msg) {
  if (window.showToast) window.showToast(msg);
}

function updateModeChip() {
  const val = (document.querySelector('input[name="mode"]:checked') || {}).value || "section";
  mode = val;
  els.modeLabel.textContent =
    mode === "practice" ? "Practice exam (100 Q • pass 70)" : "Section quiz (10 Q • pass 8)";
}
