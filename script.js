:root { --primary:#2442A2; --bg:#0e1222; --card:#161b2e; --text:#e9edff; --muted:#a9b2d6; }

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: var(--text); background: linear-gradient(180deg, #0d1120, #0b0f1b); }
.wrap { max-width: 960px; margin: 0 auto; padding: 0 16px; }

.topbar { position: sticky; top: 0; background: rgba(10,14,30,.7); backdrop-filter: blur(8px); border-bottom: 1px solid #222944; z-index: 10; }
.topbar .wrap { display: flex; align-items: center; justify-content: space-between; height: 56px; }
.brand { display:flex; align-items:center; gap:10px; font-weight: 700; }
.i { width: 20px; height: 20px; color: var(--text); }
.i.big { width: 36px; height: 36px; }

.nav a { color: var(--muted); text-decoration: none; margin-left: 16px; }
.nav a:hover { color: var(--text); }

.hero { padding: 48px 0 24px; background: radial-gradient(1200px 400px at 50% -80px, rgba(36,66,162,.25), transparent); }
.hero-inner { display:flex; align-items:center; justify-content: space-between; gap: 24px; }
.hero-copy h1 { margin: 0 0 8px; }
.hero-copy p { color: var(--muted); margin: 0 0 16px; }
.hero-art { display:grid; grid-template-columns: repeat(2, minmax(120px, 1fr)); gap: 12px; }
.hero .tile { background: #151a2d; border: 1px solid #20274a; border-radius: 10px; padding: 12px; display:flex; align-items:center; gap: 10px; }

.app { padding: 24px 0 64px; }
.stack { margin: 32px 0; }
.cards { display:grid; grid-template-columns: 2fr 1fr; gap: 16px; }
.card { background: var(--card); border: 1px solid #20274a; border-radius: 12px; padding: 16px; }
.card-head { display:flex; align-items:center; gap: 10px; margin-bottom: 12px; }

.field { margin: 12px 0; }
.field label { display:block; margin-bottom: 6px; color: var(--muted); }
select { background: #0f1430; color: var(--text); border: 1px solid #2a315a; border-radius: 8px; padding: 10px; width: 100%; }

.options-grid { display:grid; grid-template-columns: repeat(2,1fr); gap: 10px; margin: 12px 0 8px; }
.option { display:flex; gap: 10px; align-items:center; padding: 10px; border: 1px solid #283058; border-radius: 10px; cursor: pointer; }
.option input { accent-color: var(--primary); }

.actions { display:flex; align-items:center; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
.btn { border: 1px solid #2a315a; background: #141a33; color: var(--text); padding: 10px 14px; border-radius: 10px; cursor: pointer; }
.btn-primary { background: var(--primary); border-color: #2f50bf; }
.btn-secondary { background: #202955; }
.btn:disabled { opacity: .6; cursor: not-allowed; }
.btn-link { background: transparent; border: none; color: var(--primary); text-decoration: underline; cursor: pointer; }

.note { color: #9fb0ff; font-size: .9rem; }

.quiz-top { display:flex; align-items:center; gap: 10px; }
.chip { background: #202955; padding: 6px 10px; border-radius: 999px; }
.progress-wrap { background: #0f1430; border: 1px solid #2a315a; border-radius: 999px; height: 10px; flex: 1; overflow: hidden; }
.progress-bar { background: var(--primary); height: 100%; width: 0%; transition: width .2s ease; }
.progress-txt { min-width: 64px; text-align: right; color: var(--muted); }

.question { margin: 16px 0 10px; }
.choices { display:grid; gap: 10px; }
.choice { display:flex; gap: 10px; align-items:flex-start; padding: 10px; border: 1px solid #283058; border-radius: 10px; cursor: pointer; }
.choice input { margin-top: 4px; accent-color: var(--primary); }

.result .lead { color: var(--muted); }

.footer { border-top: 1px solid #222944; padding: 16px 0; color: var(--muted); }

.toast { position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); background: #111735; border: 1px solid #2a315a; color: #e9edff; padding: 10px 14px; border-radius: 999px; opacity: 0; pointer-events: none; transition: opacity .2s ease; }
.toast.show { opacity: 1; }

.badges { display:flex; gap: 8px; flex-wrap: wrap; }
.badge { background:#1a1f3a; border:1px solid #293262; padding:4px 8px; border-radius:999px; color:#a9b2d6; font-size:.85rem; }

.hidden { display: none !important; }

@media (max-width: 900px) {
  .cards { grid-template-columns: 1fr; }
  .hero-inner { flex-direction: column; align-items: flex-start; }
}




