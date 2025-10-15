// Robust CeMAP quiz script — validates JSON and explains what's wrong
document.addEventListener('DOMContentLoaded', () => {
  const QUESTIONS_URL = './questions.json';

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
  const explainEl = document.getElementById('explain');
  const nextBtn = document.getElementById('nextBtn');
  const progressBar = document.getElementById('progressBar');

  const resultEl = document.getElementById('result');
  const resultTitleEl = document.getElementById('resultTitle');
  const resultStatsEl = document.getElementById('resultStats');
  const reviewEl = document.getElementById('review');
  const toggleReviewBtn = document.getElementById('toggleReviewBtn');
  const restartBtn = document.getElementById('restartBtn');

  // State
  let allQuestions = [];
  let quizQuestions = [];
  let idx = 0;
  let score = 0;
  let mode = 'section';
  let passMark = 8;
  let revealed = false;
  let reviewLog = [];

  // Utils
  const shuffle = arr => arr.sort(() => Math.random() - 0.5);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]) );
  const uniqueSections = qs => [...new Set(qs.map(q => q.section || 'Unspecified'))].sort();
  const pickRandom = (arr, n) => { const copy=[...arr]; shuffle(copy); return copy.slice(0, n); };
  const showToast = window.showToast || (m => alert(m));

  function setView(view){
    setupEl.classList.toggle('hidden', view !== 'setup');
    quizEl.classList.toggle('hidden', view !== 'quiz');
    resultEl.classList.toggle('hidden', view !== 'result');
  }
  function updateProgressBar(){
    const pct = Math.round((idx / Math.max(1, quizQuestions.length)) * 100);
    if (progressBar) progressBar.style.width = pct + '%';
  }

  function renderQuestion(){
    const q = quizQuestions[idx];
    revealed = false;
    nextBtn.textContent = 'Check answer';
    explainEl.classList.add('hidden');
    explainEl.innerHTML = '';

    questionTextEl.textContent = q.question;
    optionsFormEl.innerHTML = '';

    (q.options || []).forEach((opt, i) => {
      const id = `opt-${idx}-${i}`;
      const label = document.createElement('label');
      label.setAttribute('for', id);
      label.innerHTML = `<input type="radio" name="answer" id="${id}" value="${i}"> ${esc(opt)}`;
      optionsFormEl.appendChild(label);
    });

    progressEl.textContent = `Question ${idx + 1} of ${quizQuestions.length}`;
    updateProgressBar();
  }

  function startQuiz(){
    if (!allQuestions.length) {
      dataNoteEl.textContent = 'No questions loaded. Ensure questions.json is next to index.html and contains valid items.';
      return;
    }

    const chosen = [...document.querySelectorAll('input[name="mode"]')].find(r => r.checked)?.value || 'section';
    mode = chosen;

    if (mode === 'section') {
      passMark = 8;
      const sel = sectionSelectEl.value;
      const pool = allQuestions.filter(q => (q.section || 'Unspecified') === sel);
      const need = 10;
      const take = Math.min(need, pool.length);
      quizQuestions = pickRandom(pool, take);
      dataNoteEl.textContent = (take < need)
        ? `Note: Only ${take} question(s) found in "${sel}". Add more to reach 10.`
        : '';
      modeLabelEl.textContent = `Section: ${sel} · Pass: ${passMark}/${need}`;
    } else {
      passMark = 70;
      const need = 100;
      const take = Math.min(need, allQuestions.length);
      quizQuestions = pickRandom(allQuestions, take);
      dataNoteEl.textContent = (take < need)
        ? `Note: Only ${take} total question(s). Add more to reach 100.`
        : '';
      modeLabelEl.textContent = `Practice Exam · Pass: ${passMark}/100`;
    }

    if (!quizQuestions.length) {
      dataNoteEl.textContent = 'No questions available for this selection.';
      return;
    }

    idx = 0;
    score = 0;
    reviewLog = [];
    setView('quiz');
    renderQuestion();
  }

  function revealAnswer(){
    const q = quizQuestions[idx];
    const selected = optionsFormEl.querySelector('input[name="answer"]:checked');
    const chosenIdx = selected ? Number(selected.value) : null;

    const correct = (chosenIdx !== null && chosenIdx === q.answer);
    if (correct) score += 1;

    const labels = [...optionsFormEl.querySelectorAll('label')];
    labels.forEach((label, i) => {
      label.classList.add('choice-disabled');
      if (i === q.answer) label.classList.add('choice-correct');
    });
    if (chosenIdx !== null && chosenIdx !== q.answer) {
      labels[chosenIdx]?.classList.add('choice-wrong');
    }

    [...optionsFormEl.querySelectorAll('input')].forEach(inp => inp.disabled = true);

    const exp = q.explanation ? esc(q.explanation) : 'No explanation provided.';
    explainEl.innerHTML = `<strong>Why:</strong> ${exp}`;
    explainEl.classList.remove('hidden');

    reviewLog.push({
      idx,
      section: q.section || 'Unspecified',
      question: q.question,
      options: q.options || [],
      correct: q.answer,
      chosen: (chosenIdx !== null ? chosenIdx : undefined),
      explanation: q.explanation || ''
    });

    nextBtn.textContent = (idx + 1 >= quizQuestions.length) ? 'See result' : 'Next question';
    revealed = true;
  }

  function finishQuiz(){
    const total = quizQuestions.length;
    const passed = score >= passMark;
    resultTitleEl.textContent = passed ? '✅ Pass' : '❌ Not Yet';
    const pct = total ? Math.round((score / total) * 100) : 0;
    resultStatsEl.textContent = `Score: ${score}/${total} (${pct}%) — Pass mark: ${passMark}/${mode === 'section' ? 10 : 100}`;
    if (progressBar) progressBar.style.width = '100%';

    reviewEl.innerHTML = reviewLog.map((r, n) => {
      const your = (r.chosen !== undefined) ? r.chosen : null;
      const yourText = (your !== null && r.options[your] !== undefined) ? r.options[your] : '—';
      const correctText = r.options[r.correct] ?? '—';
      const badge = (your === r.correct) ? `<span class="badge-correct">Correct</span>` : `<span class="badge-wrong">Review</span>`;
      return `
        <div class="review-item">
          <h4>Q${n+1}. ${esc(r.question)} ${badge}</h4>
          <div class="answer-row">
            <div><strong>Your answer:</strong> <code>${esc(yourText)}</code></div>
            <div><strong>Correct:</strong> <code>${esc(correctText)}</code></div>
            <div><strong>Section:</strong> <code>${esc(r.section)}</code></div>
          </div>
          <details>
            <summary>Explanation</summary>
            <p>${esc(r.explanation || 'No explanation provided.')}</p>
          </details>
        </div>
      `;
    }).join('');

    reviewEl.classList.add('hidden');
    toggleReviewBtn.textContent = 'Review answers';

    setView('result');
  }

  function handleNext(){
    const selected = optionsFormEl.querySelector('input[name="answer"]:checked');

    if (!revealed) {
      if (!selected) { showToast('Select an answer to continue'); return; }
      revealAnswer();
      return;
    }

    idx += 1;
    if (idx >= quizQuestions.length) finishQuiz();
    else renderQuestion();
  }

  // Events
  startBtn.addEventListener('click', startQuiz);
  nextBtn.addEventListener('click', handleNext);
  restartBtn.addEventListener('click', () => setView('setup'));
  toggleReviewBtn.addEventListener('click', () => {
    const isHidden = reviewEl.classList.contains('hidden');
    reviewEl.classList.toggle('hidden', !isHidden);
    toggleReviewBtn.textContent = isHidden ? 'Hide review' : 'Review answers';
  });
  document.querySelectorAll('input[name="mode"]').forEach(r => {
    r.addEventListener('change', (e) => {
      sectionPickerEl.style.display = (e.target.value === 'section') ? 'block' : 'none';
    });
  });

  // ===== LOAD QUESTIONS with validation and helpful messages =====
  (async () => {
    try {
      const res = await fetch(QUESTIONS_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status} — can't fetch questions.json (wrong path/name?)`);
      const raw = await res.text();

      // Try to parse; if it fails, show parse error (often due to trailing commas)
      let data;
      try { data = JSON.parse(raw); }
      catch (e) {
        throw new Error(`JSON parse error in questions.json: ${e.message}. Tip: remove trailing commas and ensure it starts with [ and ends with ].`);
      }

      if (!Array.isArray(data)) throw new Error('questions.json must be a JSON array [ ... ].');

      const issues = []; // collect reasons for invalid items
      const valid = [];

      data.forEach((q, i) => {
        const path = `#${i+1}`;
        if (!q || typeof q !== 'object') { issues.push(`${path} not an object`); return; }
        if (typeof q.question !== 'string' || !q.question.trim()) { issues.push(`${path} missing "question" text`); return; }
        if (!Array.isArray(q.options) || q.options.length < 2) { issues.push(`${path} "options" must be array of 2+`); return; }

        // Accept numeric or numeric string for answer; coerce to number
        let ans = (typeof q.answer === 'string') ? Number(q.answer) : q.answer;
        if (!Number.isInteger(ans)) { issues.push(`${path} "answer" must be an integer index`); return; }
        if (ans < 0 || ans >= q.options.length) { issues.push(`${path} "answer" index ${ans} out of range (0..${q.options.length-1})`); return; }

        valid.push({
          section: q.section || 'Unspecified',
          question: q.question,
          options: q.options,
          answer: ans,
          explanation: q.explanation || ''
        });
      });

      allQuestions = valid;

      // Fill sections if we have any
      if (allQuestions.length > 0) {
        const sections = uniqueSections(allQuestions);
        sectionSelectEl.innerHTML = sections.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
      } else {
        sectionSelectEl.innerHTML = '';
      }

      // Build helpful status message
      const msgParts = [];
      msgParts.push(`Found ${data.length} item(s); using ${allQuestions.length} valid.`);
      if (issues.length) {
        const top = issues.slice(0, 3).join(' • ');
        msgParts.push(`Ignored ${issues.length} invalid item(s): ${top}${issues.length > 3 ? ' …' : ''}`);
      }
      dataNoteEl.textContent = msgParts.join('  ');

      // Enable/disable Start
      startBtn.disabled = allQuestions.length === 0;

    } catch (err) {
      console.error(err);
      startBtn.disabled = true;
      dataNoteEl.textContent =
        `Error loading questions: ${err.message}. ` +
        `Checklist: 1) questions.json sits next to index.html, 2) name matches exactly, 3) valid JSON array.`;
    }
  })();
});
