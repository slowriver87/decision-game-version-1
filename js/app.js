import { makeRng, newSeed } from './core/rng.js';
import { load, save, exportJson, importJson, defaultState } from './core/storage.js';
import { planSession, ROUNDS } from './core/session.js';
import { updateRating, levelOf } from './core/difficulty.js';
import { updateStreak, liveStreak, dayKey, recentAccuracy, accuracySeries, mostCommonBias, sessionBreakdown } from './core/stats.js';
import { BIASES, tallyBiases } from './core/bias.js';
import { calibrationTable } from './core/calibration.js';
import { money, pct } from './core/format.js';
import { TYPES, TYPE_IDS, LIMITS } from './scenarios/index.js';
import { h, toast, confirmDialog } from './ui/dom.js';
import { QUESTION, VISUAL } from './ui/views.js';
import { sparkline } from './ui/charts.js';

const CURRENT_KEY = 'decision-making.current';
const app = document.getElementById('app');

let state = load();
let current = loadCurrent();   // in-progress session (survives reloads)
let lastSummary = null;

/* ---------------- Persistence ---------------- */

function persist() { save(state); }
function loadCurrent() {
  try { return JSON.parse(localStorage.getItem(CURRENT_KEY)) || null; } catch { return null; }
}
function persistCurrent() {
  try {
    if (current) localStorage.setItem(CURRENT_KEY, JSON.stringify(current));
    else localStorage.removeItem(CURRENT_KEY);
  } catch { /* storage unavailable: play still works, just won't resume */ }
}

/* ---------------- Theme ---------------- */

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', state.theme === 'light' ? '#f6f5f1' : '#121211');
}

/* ---------------- Helpers ---------------- */

const rating = type => state.skills[type]?.rating ?? 1;
const levelFor = type => levelOf(rating(type));
const typeName = id => TYPES[id]?.meta.name ?? id;

function screen({ title, back = true, onBack, progress, content, actions }) {
  const top = h('div', { class: 'topbar' },
    back ? h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: onBack || (() => go('/')) }, '←') : null,
    progress || h('div', { class: 'title' }, title || ''));
  return h('section', { class: 'screen' },
    top,
    h('div', { class: 'content' }, content),
    actions ? h('div', { class: 'actions' + (actions.length === 2 && !actions.wide ? ' two' : '') }, actions) : null);
}

function mount(el) {
  app.replaceChildren(el);
  window.scrollTo(0, 0);
}

/* ---------------- Routing ---------------- */

function go(path) {
  if (location.hash === '#' + path) route();
  else location.hash = path;
}

function route() {
  const path = location.hash.slice(1) || '/';
  if (path === '/play' && current) return renderPlay();
  if (path === '/summary' && lastSummary) return renderSummary();
  if (path === '/stats') return renderStats();
  if (path === '/settings') return renderSettings();
  return renderHome();
}
window.addEventListener('hashchange', route);

/* ---------------- Home ---------------- */

function renderHome() {
  const today = dayKey();
  const streak = liveStreak(state.streak, today);
  const playedToday = state.sessions.some(s => s.day === today);
  const top = mostCommonBias(state.sessions);
  const content = [
    h('div', { class: 'home-hero' },
      h('div', { class: 'eyebrow' }, 'Probability trainer'),
      h('h1', {}, 'Decision Making'),
      h('p', {}, `${ROUNDS} rounds, about five minutes. Make the call, then see the math behind it.`)),
    h('div', { class: 'stat-row' },
      h('div', { class: 'tile' }, h('div', { class: 'k' }, 'Streak'), h('div', { class: 'v' }, String(streak), h('small', {}, streak === 1 ? ' day' : ' days'))),
      h('div', { class: 'tile' }, h('div', { class: 'k' }, 'Sessions'), h('div', { class: 'v' }, String(state.sessions.length))),
      h('div', { class: 'tile' }, h('div', { class: 'k' }, 'Today'), h('div', { class: 'v' }, playedToday ? '✓' : '–'))),
    top ? h('div', { class: 'card tight' },
      h('div', { class: 'eyebrow' }, 'Watch out for'),
      h('div', { style: 'font-weight:650' }, BIASES[top.id]?.name ?? top.id),
      h('div', { class: 'small sub' }, BIASES[top.id]?.fix ?? '')) : null,
    h('h3', {}, 'Your levels'),
    h('div', { class: 'card tight' }, TYPE_IDS.map(id => h('div', { class: 'type-row' },
      h('span', { class: 'name' }, typeName(id)),
      h('span', { class: 'val' }, `Level ${levelFor(id)}`)))),
    h('div', { class: 'nav-row' },
      h('button', { class: 'btn ghost', onclick: () => go('/stats') }, 'Stats'),
      h('button', { class: 'btn ghost', onclick: () => go('/settings') }, 'Settings')),
  ];
  const actions = current
    ? Object.assign([
        h('button', { class: 'btn primary', onclick: () => go('/play') }, `Resume session (${current.idx + 1} of ${ROUNDS})`),
        h('button', { class: 'btn ghost', onclick: abandon }, 'Abandon it'),
      ], { wide: true })
    : [h('button', { class: 'btn primary', onclick: startSession }, playedToday ? 'Start another session' : 'Start today\'s session')];
  mount(screen({ back: false, content, actions }));
}

async function abandon() {
  const ok = await confirmDialog({ title: 'Abandon this session?', body: 'It won\'t be saved to your history. (Levels already earned in it are kept.)', yes: 'Abandon', danger: true });
  if (!ok) return;
  current = null; persistCurrent(); renderHome();
}

/* ---------------- Session ---------------- */

function startSession() {
  const rng = makeRng(newSeed());
  const weakness = Object.fromEntries(TYPE_IDS.map(id => {
    const acc = recentAccuracy(state.sessions, id);
    return [id, acc == null ? 0.5 : 1 - acc];
  }));
  const plan = planSession(rng, TYPE_IDS, weakness, LIMITS);
  current = {
    plan,
    seeds: plan.map(() => newSeed()),
    levels: [],
    startRatings: Object.fromEntries(TYPE_IDS.map(id => [id, rating(id)])),
    idx: 0,
    rounds: [],
    answers: [],
  };
  persistCurrent();
  go('/play');
}

function scenarioAt(i) {
  const type = current.plan[i];
  current.levels[i] ??= levelFor(type);
  return TYPES[type].generate(makeRng(current.seeds[i]), current.levels[i]);
}

function progressBar() {
  return h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': ROUNDS, 'aria-valuenow': current.idx + 1 },
    current.plan.map((_, i) => h('span', { class: i < current.idx ? 'done' : i === current.idx ? 'now' : '' })));
}

async function quit() {
  const ok = await confirmDialog({ title: 'Leave this session?', body: 'You can resume it from the home screen.', yes: 'Leave' });
  if (ok) go('/');
}

function renderPlay() {
  const i = current.idx;
  const type = current.plan[i];
  const mod = TYPES[type];
  const sc = scenarioAt(i);
  persistCurrent();
  const answered = current.answers[i] !== undefined;
  if (answered) return renderFeedback(sc, mod.grade(sc, current.answers[i]));

  const firstTime = !state.seenPrimers[type];
  const view = QUESTION[type](sc, ans => answer(sc, ans));
  const content = [
    h('div', { class: 'round-meta' },
      h('span', { class: 'chip' }, `${i + 1} / ${ROUNDS} · ${mod.meta.name}`),
      h('span', { class: 'chip' }, `Level ${current.levels[i]}`)),
    h('details', { class: 'primer', open: firstTime },
      h('summary', {}, firstTime ? `New: ${mod.meta.name}` : 'How this works'),
      mod.meta.primer.map(p => h('p', { html: p }))),
    view.body,
  ];
  if (firstTime) { state.seenPrimers[type] = true; persist(); }
  mount(screen({ onBack: quit, progress: progressBar(), content, actions: [view.actions] }));
}

function answer(sc, ans) {
  const i = current.idx;
  if (current.answers[i] !== undefined) return;
  const type = current.plan[i];
  const result = TYPES[type].grade(sc, ans);
  current.answers[i] = ans;
  current.rounds[i] = {
    type, level: current.levels[i], score: result.score, correct: result.correct,
    biasTags: result.biasTags, evLost: result.evLost || 0,
    ...(typeof result.conf === 'number' ? { conf: result.conf } : {}),
  };
  state.skills[type] = { rating: updateRating(rating(type), result.score) };
  persist();
  persistCurrent();
  renderFeedback(sc, result);
}

function renderFeedback(sc, r) {
  const i = current.idx;
  const type = current.plan[i];
  const last = i === ROUNDS - 1;
  const content = [
    h('div', { class: 'round-meta' }, h('span', { class: 'chip' }, `${i + 1} / ${ROUNDS} · ${TYPES[type].meta.name}`)),
    h('div', { class: `verdict ${r.correct ? 'good' : 'bad'}`, role: 'status' },
      h('span', { class: 'icon', 'aria-hidden': 'true' }, r.correct ? '✓' : '✗'),
      h('div', {}, h('div', { class: 'h' }, r.headline), h('div', { class: 's' }, r.sub))),
    VISUAL[type](sc, r),
    h('h3', {}, 'The math'),
    h('ol', { class: 'steps' }, r.steps.map(st => h('li', { html: st }))),
    h('p', { class: 'takeaway' }, r.takeaway),
    h('div', { class: 'card realworld' }, h('span', { class: 'eyebrow' }, 'In the wild'), r.realWorld),
  ];
  mount(screen({
    onBack: quit, progress: progressBar(), content,
    actions: [h('button', { class: 'btn primary', onclick: next }, last ? 'See summary' : 'Next')],
  }));
}

function next() {
  if (current.idx < ROUNDS - 1) {
    current.idx++;
    persistCurrent();
    renderPlay();
  } else finish();
}

function finish() {
  const day = dayKey();
  const rounds = current.rounds;
  state.sessions.push({ ts: Date.now(), day, rounds });
  state.streak = updateStreak(state.streak, day);
  persist();
  lastSummary = { rounds, startRatings: current.startRatings };
  current = null;
  persistCurrent();
  go('/summary');
}

/* ---------------- Summary ---------------- */

function gutInsight(rounds) {
  const top = tallyBiases(rounds)[0];
  if (!top) {
    return rounds.every(r => r.correct)
      ? { name: 'Nothing. Clean sweep.', insight: 'Your gut matched the math on every round.', fix: 'Levels will rise, so expect tighter calls next time.' }
      : { name: 'No single pattern', insight: 'Your misses were near-misses rather than one consistent bias.', fix: 'Keep reading the "math" steps on close calls.' };
  }
  return BIASES[top.id];
}

function renderSummary() {
  const { rounds, startRatings } = lastSummary;
  const score = Math.round(rounds.reduce((a, r) => a + r.score, 0) * 100);
  const right = rounds.filter(r => r.correct).length;
  const evLost = rounds.reduce((a, r) => a + (r.evLost || 0), 0);
  const gut = gutInsight(rounds);
  const breakdown = sessionBreakdown(rounds);
  const nailed = breakdown.filter(b => b.avg >= 0.75).map(b => typeName(b.type));
  const missed = breakdown.filter(b => b.avg < 0.5).map(b => typeName(b.type));

  const content = [
    h('div', { class: 'home-hero' },
      h('div', { class: 'eyebrow' }, 'Session complete'),
      h('div', { class: 'score-big' }, String(score), h('small', {}, ` / ${ROUNDS * 100}`)),
      h('p', { class: 'sub', style: 'margin-top:8px' }, `${right} of ${ROUNDS} right.` +
        (nailed.length ? ` Nailed: ${nailed.join(', ')}.` : '') + (missed.length ? ` Missed: ${missed.join(', ')}.` : ''))),
    h('div', { class: 'card insight' },
      h('span', { class: 'eyebrow' }, 'Where your gut was off'),
      h('div', { class: 'name' }, gut.name),
      h('p', { class: 'sub' }, gut.insight),
      h('p', { class: 'small', style: 'margin:0' }, h('b', {}, 'Next time: '), gut.fix)),
    evLost > 0 ? h('div', { class: 'card tight' },
      h('div', { class: 'eyebrow' }, 'EV left on the table'),
      h('div', { style: 'font-size:24px;font-weight:700' }, money(evLost)),
      h('div', { class: 'small sub' }, 'The average money your wrong calls gave up, compared with the best choice. You might have got lucky this time, but over many repeats this is what those calls would cost.')) : null,
    h('h3', {}, 'By type'),
    h('div', { class: 'card tight' }, breakdown.map(b => {
      const before = levelOf(startRatings?.[b.type] ?? 1), after = levelFor(b.type);
      return h('div', { class: 'type-row' },
        h('span', { class: 'name' }, typeName(b.type),
          after > before ? h('span', { class: 'badge-up' }, `  ▲ Level ${after}`) : null),
        h('span', { class: 'val' }, `${b.correct} / ${b.n} right`),
        h('div', { class: 'bar' }, h('span', { style: `width:${Math.round(b.avg * 100)}%` })));
    })),
    h('p', { class: 'note', style: 'text-align:center;margin-top:20px' }, 'That\'s it for this session. Come back tomorrow to keep your streak.'),
  ];
  mount(screen({ back: false, content, actions: [h('button', { class: 'btn primary', onclick: () => { lastSummary = null; go('/'); } }, 'Done')] }));
}

/* ---------------- Stats ---------------- */

function renderStats() {
  const today = dayKey();
  const top = mostCommonBias(state.sessions);
  const totalRounds = state.sessions.reduce((a, s) => a + s.rounds.length, 0);
  const shortDate = d => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const content = [
    h('div', { class: 'stat-row' },
      h('div', { class: 'tile' }, h('div', { class: 'k' }, 'Streak'), h('div', { class: 'v' }, String(liveStreak(state.streak, today)))),
      h('div', { class: 'tile' }, h('div', { class: 'k' }, 'Best'), h('div', { class: 'v' }, String(state.streak.best || 0))),
      h('div', { class: 'tile' }, h('div', { class: 'k' }, 'Rounds'), h('div', { class: 'v' }, String(totalRounds)))),
    h('div', { class: 'card insight' },
      h('span', { class: 'eyebrow' }, 'Your most common bias'),
      top
        ? [h('div', { class: 'name' }, BIASES[top.id]?.name ?? top.id),
           h('p', { class: 'sub' }, BIASES[top.id]?.insight ?? ''),
           h('p', { class: 'small', style: 'margin:0' }, h('b', {}, 'Fix: '), BIASES[top.id]?.fix ?? ''),
           h('p', { class: 'note', style: 'margin:8px 0 0' }, `Showed up ${top.count}× in your last ${Math.min(20, state.sessions.length)} session${Math.min(20, state.sessions.length) === 1 ? '' : 's'}.`)]
        : h('p', { class: 'sub', style: 'margin:0' }, 'Play a few sessions and patterns will show up here.')),
    calibrationCard(),
    h('h3', {}, 'Accuracy by type'),
    h('p', { class: 'note' }, 'Average score per session, oldest to newest. Tap the line to see a session.'),
    TYPE_IDS.map(id => {
      const series = accuracySeries(state.sessions, id)
        .map((v, i) => (v == null ? null : { value: v, label: shortDate(state.sessions[i].day) }))
        .filter(Boolean)
        .slice(-20);
      const recent = recentAccuracy(state.sessions, id);
      return h('div', { class: 'card tight' },
        h('div', { class: 'type-row', style: 'border:0;padding:0' },
          h('span', { class: 'name' }, typeName(id)),
          h('span', { class: 'val' }, recent == null ? `Level ${levelFor(id)}` : `${pct(recent, 0)} recent · Level ${levelFor(id)}`)),
        sparkline(series));
    }),
  ];
  mount(screen({ title: 'Stats', content }));
}

function calibrationCard() {
  const rows = calibrationTable(state.sessions);
  if (!rows.length) return null;
  return h('div', { class: 'card' },
    h('span', { class: 'eyebrow' }, 'Confidence calibration'),
    h('p', { class: 'small sub', style: 'margin:4px 0 8px' }, 'When you say you\'re X% sure, are you right X% of the time? Well calibrated means the two columns match.'),
    h('div', { class: 'calib' },
      h('span', { class: 'k' }, 'You said'), h('span', { class: 'k' }, 'You were right'), h('span', { class: 'k' }, ''),
      rows.map(r => [
        h('span', {}, pct(r.conf, 0)),
        h('span', {}, `${pct(r.rate, 0)} `, h('span', { class: 'muted' }, `(${r.right}/${r.n})`)),
        h('span', { class: 'muted small' }, r.n < 5 ? 'few rounds' : r.rate < r.conf - 0.15 ? 'overconfident' : r.rate > r.conf + 0.15 ? 'underconfident' : 'on target'),
      ])));
}

/* ---------------- Settings ---------------- */

function renderSettings() {
  const themeBtn = (val, label) => h('button', {
    'aria-pressed': String(state.theme === val),
    onclick: () => { state.theme = val; persist(); applyTheme(); renderSettings(); },
  }, label);
  const paste = h('textarea', { placeholder: 'Or paste backup JSON here', 'aria-label': 'Backup JSON' });
  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (f) await doImport(await f.text());
    file.value = '';
  });

  const content = [
    h('h3', {}, 'Appearance'),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Theme' }, themeBtn('dark', 'Dark'), themeBtn('light', 'Light')),
    h('h3', {}, 'Backup'),
    h('p', { class: 'note' }, 'Your progress lives only on this device. Export a backup to move it to another phone or keep it safe.'),
    h('div', { class: 'stack' },
      h('button', { class: 'btn', onclick: download }, 'Download backup file'),
      h('button', { class: 'btn', onclick: copyBackup }, 'Copy backup to clipboard'),
      h('button', { class: 'btn', onclick: () => file.click() }, 'Import from file…'),
      file,
      paste,
      h('button', { class: 'btn', onclick: () => paste.value.trim() && doImport(paste.value) }, 'Import pasted backup')),
    h('h3', {}, 'Danger zone'),
    h('button', { class: 'btn danger', style: 'width:100%', onclick: resetAll }, 'Erase all progress…'),
    h('h3', {}, 'About'),
    h('p', { class: 'note' }, 'Works fully offline. No accounts, no tracking, nothing leaves your phone. Every scenario is generated fresh and every answer is computed by code.'),
  ];
  mount(screen({ title: 'Settings', content }));
}

function download() {
  const blob = new Blob([exportJson(state)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `decision-making-backup-${dayKey()}.json` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function copyBackup() {
  try { await navigator.clipboard.writeText(exportJson(state)); toast('Backup copied'); }
  catch { toast('Couldn\'t access the clipboard. Use download instead.'); }
}

async function doImport(text) {
  let next;
  try { next = importJson(text); } catch (e) { toast(`Import failed: ${e.message}`, 3500); return; }
  const ok = await confirmDialog({
    title: 'Replace your progress?',
    body: `This backup has ${next.sessions.length} sessions. It will replace everything currently on this device.`,
    yes: 'Replace',
  });
  if (!ok) return;
  state = next; persist(); applyTheme(); toast('Backup restored'); renderSettings();
}

async function resetAll() {
  const ok = await confirmDialog({
    title: 'Erase everything?',
    body: `This deletes ${state.sessions.length} sessions, your levels and your streak. It can't be undone unless you have a backup.`,
    yes: 'Erase', danger: true,
  });
  if (!ok) return;
  const theme = state.theme;
  state = { ...defaultState(), theme }; persist();
  current = null; persistCurrent();
  toast('Progress erased'); go('/');
}

/* ---------------- Boot ---------------- */

applyTheme();
route();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
