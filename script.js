/* ===========================
   CeMAP Quiz App (Topics 1–24)
   =========================== */

/* ---- Settings ---- */
const DATA_URL = "data/cemap_topics_1_24_combined.json"; // change if your file path/name differs
const SECTION_SIZE = 10;   // Section Quiz
const PRACTICE_SIZE = 100; // Practice Exam
const PASS_SECTION = 8;    // pass mark for 10Q section
const PASS_PRACTICE = 70;  // pass mark for 100Q practice

/* ---- State ---- */
let QUESTIONS = [];        // full bank
let ACTIVE = [];           // current quiz set
let USER = [];             // user answers (indexes)
let idx = 0;               // current question index
let mode = "section";      // "section" | "practice"

/* ---- Elements ---- */
const els = {
  modeRadios: [...document.querySelectorAll('input[name="mode"]')],
  sectionSelect: document.getElementById("sectionSelect"),
  startBtn: document.getElementById("startBtn"),
  dataNote: document.getElementById("dataNote"),

  quiz: document.getElementById("quiz"),
  questionText: document.getElementById("questionText"),
  optionsForm: document.getElementById("optionsForm"),
  nextBtn: document.getElementById("nextBtn"),
  toggleReviewBtn: document.getElementById("toggleReviewBtn"),

  modeLabel: document.getElementById("modeLabel"),
  progressBar: document.getElementById("progressBar"),
  progressTxt: document.getElementById("progress"),

  review: document.getElementById("review"),
  reviewList: document.getElementById("reviewList"),

  result: document.getElementById("result"),
  resultTitle: document.getElementById("resultTitle"),
  resultStats: document.getElementById("resultStats"),
  restartBtn: document.getElementById("restartBtn"),
};

/* ---- Init ---- */
bootstrap();

async function bootstrap() {
  // Mode switch
  els.modeRadios.forEach(r => r.addEventListener("change", () => {
    mode = document.querySelector('input[name="mode"]:checked').value;
    updateModeChip();
  }));
  updateModeChip();

  // Start button
  els.startBtn.addEventListener("click", startQuiz);

  // Next / Review / Restart
  els.nextBtn.addEventListener("click", onNext);
  els.toggleReviewBtn.addEventListener("click", toggleReview);
  els.restartBtn.addEventListener("click", resetToSetup);

  // Load questions (note: index.html already overrides dropdown; we just load the bank)
  try {
    const res = await fetch(DATA_URL);
    const payload = await res.json();
    QUESTIONS = payload.questions || [];
    if (els.dataNote) {
      els.dataNote.textContent = `Loaded ${QUESTIONS.length} questions`;
    }
  } catch (e) {
    console.error("Failed to load questions:", e);
    if (els.dataNote) els.dataNote.textContent = "Could not load questions.";
  }
}

/* ---- Start a quiz based on selection ---- */
function startQuiz() {
  // Determine topic selection. Value is "__ALL__" or "1".."24"
  const selected = els.sectionSelect.value || "__ALL__";
  const isAll = (selected === "__ALL__");

  // Filter pool by Topic if a specific Topic chosen
  let pool = QUESTIONS;
  if (!isAll) {
    const prefix = `Topic ${selected}:`;
    pool = QUESTIONS.filter(q => (q.section || "").startsWith(prefix));
  }

  // Choose size + pass mark by mode
  const size = (mode === "practice") ? PRACTICE_SIZE : SECTION_SIZE;
  const passMark = (mode === "practice") ? PASS_PRACTICE : PASS_SECTION;

  if (pool.length === 0) {
    toast("No questions for this topic yet.");
    return;
  }

  ACTIVE = sampleN(pool, size);
  USER = new Array(ACTIVE.length).fill(null);
  idx = 0;

  // Show quiz UI
  document.getElementById("setup").classList.add("hidden");
  els.result.classList.add("hidden");
  els.review.classList.add("hidden");
  els.quiz.classList.remove("hidden");

  els.modeLabel.textContent = (mode === "practice")
    ? "Practice exam (100 Q • pass 70)"
    : "Section quiz (10 Q • pass 8)";
  els.modeLabel.className = "chip"; // reset class

  renderQuestion();
  updateProgress();
}

/* ---- Render current question ---- */
function renderQuestion() {
  const q = ACTIVE[idx];
  els.questionText.textContent = q.question;

  // options
  els.optionsForm.innerHTML = "";
  q.options.forEach((opt, i) => {
    const id = `opt_${idx}_${i}`;
    const wrapper = document.createElement("label");
    wrapper.className = "choice";
    wrapper.htmlFor = id;
    wrapper.innerHTML = `
      <input type="radio" name="q_${idx}" id="${id}" value="${i}">
      <span>${escapeHtml(opt)}</span>
    `;
    els.optionsForm.appendChild(wrapper);
  });

  // restore previous selection if any
  if (USER[idx] !== null) {
    const prev = els.optionsForm.querySelector(`input[value="${USER[idx]}"]`);
    if (prev) prev.checked = true;
  }

  // Next button text
  els.nextBtn.textContent = (idx === ACTIVE.length - 1) ? "Submit" : "Next";
}

/* ---- Next / Submit handler ---- */
function onNext() {
  // Save selection if chosen
  const chosen = els.optionsForm.querySelector("input[type=radio]:checked");
  USER[idx] = chosen ? Number(chosen.value) : null;

  if (idx < ACTIVE.length - 1) {
    idx++;
    renderQuestion();
    updateProgress();
    return;
  }

  // Submit
  submitQuiz();
}

/* ---- Progress bar & text ---- */
function updateProgress() {
  const total = ACTIVE.length;
  const current = idx + 1;
  els.progressTxt.textContent = `Question ${current} of ${total}`;
  const pct = Math.round((current - 1) / total * 100);
  els.progressBar.style.width = `${pct}%`;
}

/* ---- Submit, Score, Review, Results ---- */
function submitQuiz() {
  // Tally
  let correct = 0;
  const details = [];

  ACTIVE.forEach((q, i) => {
    const user = USER[i];
    const ok = (user === q.answer);
    if (ok) correct++;
    details.push({
      i,
      section: q.section,
      question: q.question,
      correctText: q.options[q.answer],
      userText: (user !== null ? q.options[user] : "—"),
      ok,
      explanation: q.explanation || ""
    });
  });

  // Decide pass mark
  const passMark = (mode === "practice") ? PASS_PRACTICE : PASS_SECTION;
  const total = ACTIVE.length;
  const pct = Math.round(100 * correct / total);
  const passed = correct >= passMark;

  // Build review list
  els.reviewList.innerHTML = "";
  details.forEach(d => {
    const row = document.createElement("div");
    row.className = "review-item";
    row.innerHTML = `
      <div class="review-q"><strong>${escapeHtml(d.section)}</strong><br>${escapeHtml(d.question)}</div>
      <div class="review-a">Correct: <strong>${escapeHtml(d.correctText)}</strong></div>
      <div class="review-u">Your answer: ${escapeHtml(d.userText)} ${d.ok ? "✅" : "❌"}</div>
      ${d.explanation ? `<div class="review-expl">${escapeHtml(d.explanation)}</div>` : ""}
    `;
    els.reviewList.appendChild(row);
  });

  // Show results UI
  els.quiz.classList.add("hidden");
  els.review.classList.remove("hidden");
  els.result.classList.remove("hidden");

  els.resultTitle.textContent = passed ? "Pass 🎉" : "Try again 💪";
  const passText = (mode === "practice") ? `pass ${PASS_PRACTICE}` : `pass ${PASS_SECTION}`;
  els.resultStats.textContent = `Score: ${correct}/${total} (${pct}%) — required ${passText}`;
  toast(`You scored ${correct}/${total}`);

  // Fill the bar to 100%
  els.progressBar.style.width = "100%";
}

/* ---- Review panel toggle ---- */
function toggleReview() {
  els.review.classList.toggle("hidden");
}

/* ---- Restart ---- */
function resetToSetup() {
  els.result.classList.add("hidden");
  els.quiz.classList.add("hidden");
  els.review.classList.add("hidden");
  document.getElementById("setup").classList.remove("hidden");
  window.scrollTo({ top: document.getElementById("setup").offsetTop, behavior: "smooth" });
}

/* ---- Helpers ---- */
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

function toast(msg){
  if (window.showToast) window.showToast(msg);
}

/* ---- Mode chip label ---- */
function updateModeChip(){
  const label = (document.querySelector('input[name="mode"]:checked') || {}).value || "section";
  mode = label;
  if (els.modeLabel) {
    els.modeLabel.textContent = (mode === "practice")
      ? "Practice exam (100 Q • pass 70)"
      : "Section quiz (10 Q • pass 8)";
  }
}
