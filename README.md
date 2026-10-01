# Decision Making

A five-minute probability and decision-making trainer for your phone. Each session is 8 rounds with a clear end. You make a call, then see whether it was right, the math in plain English, a one-line takeaway, and where the idea shows up in markets and real life.

It works fully offline once installed. There are no accounts, no tracking, and no network calls during play.

## Scenario types

| Type | You decide | You learn |
|---|---|---|
| **Expected value** | Sure thing vs gamble (gains, losses, coin flips, longshots) | EV, how much EV a wrong pick gave up, loss aversion, longshot bias |
| **Bayesian updating** | Drag a slider to estimate a probability (metal detectors, lost historical letters, rookie scouts, stock screeners, urns, recession signals, poker tells) | Base rates, shown on a 1,000-dot frequency grid |
| **Poker pot odds** | Call or fold vs a face-up all-in | Outs, the rule of 2 and 4, pot odds vs exact equity |
| **Bridge builder** | Pick which of 4 drawn bridges holds the most, then how sure you are (25/50/75/95%) | Depth, tension vs compression, buckling, and confidence calibration |
| *Kelly bet sizing* | *Phase 2* | |
| *Optimal stopping* | *Phase 2* | |
| *Push your luck* | *Phase 2* | |

Difficulty is tracked separately for each type, on levels 1–5. About four strong answers in a row moves you up a level, and bad answers move you down slowly. Sessions lean toward the types you're weakest at.

## How scenarios are generated

Nothing is hardcoded. Every round starts from a random seed, and the generator builds a fresh scenario from it:

- **EV:** picks a frame, probability and payoff, then sets the sure amount a set distance above or below the gamble's EV. That distance shrinks at higher levels.
- **Bayes:** picks a base rate (rarer at higher levels), a hit rate and a false-alarm rate. The answer is computed with Bayes' rule, and level 5 adds two positive tests in a row.
- **Bridges:** picks four designs (plank, I-beam, truss, arch, suspension) at different depths, all with the same steel. Capacity comes from real statics: beam bending (PL/4 = σS), member forces in the triangle frames, and Euler buckling for squeezed members. The winner must beat the runner-up by a clear margin, which shrinks at higher levels. Confidence is scored with a proper scoring rule, so honest confidence earns the most over time.
- **Poker:** deals random hands until you're behind with 4–15 outs. Exact equity is computed by checking every possible runout (44 on the turn, 990 on the flop). Then it picks a bet size so the right answer clears a minimum margin, and call and fold are each right about half the time.

Because the seed is saved, a half-finished session resumes exactly where you left it, even after your phone kills the browser.

## Project layout

```
index.html               app shell
manifest.webmanifest     PWA manifest
sw.js                    service worker (offline cache)
css/app.css              all styles, dark + light themes
icons/                   app icons (regenerate: npm run icons)
js/app.js                screens, routing, session flow
js/core/                 pure logic, no DOM (all unit-tested)
  rng.js                 seeded random numbers
  format.js              $ and % formatting
  ev.js                  expected value, standard deviation
  bayes.js               posterior, natural frequencies, estimate scoring
  cards.js               card model + 5–7 card hand evaluator
  poker.js               equity, outs, rule of 2/4, pot odds, call EV
  difficulty.js          per-type rating → level
  session.js             which 8 types go in a session, and in what order
  stats.js               streaks, accuracy over time, most common bias
  bias.js                the "where your gut was off" catalog
  storage.js             localStorage + backup import/export validation
js/scenarios/            one file per scenario type: generate(), grade(), meta
js/ui/                   DOM helpers, frequency grid, sparkline, per-type views
tests/                   node:test unit tests
```

### Saved data

Everything is saved in your browser's `localStorage` under `decision-making.v1`:

```js
{
  v: 1,
  theme: 'dark' | 'light',
  skills: { ev: { rating: 1.75 }, ... },           // level = floor(rating)
  sessions: [{ ts, day: '2026-10-01', rounds: [
    { type, level, score /* 0..1 */, correct, biasTags: ['baseRateNeglect'], evLost }
  ]}],
  streak: { current, best, last: '2026-10-01' },
  seenPrimers: { ev: true, ... }
}
```

**Settings → Backup** lets you download this as a JSON file, copy it, or import it again. Imports are checked and cleaned before anything is replaced.

## Running it on your computer

You need [Node.js](https://nodejs.org) only for the tests. The app itself has no build step.

```bash
npm test          # runs every math and generator test
npm run serve     # then open http://localhost:8080
```

Use a local server like this one. Opening `index.html` by double-clicking won't work, because browsers block JavaScript modules on `file://` pages.

## Deploy it free with GitHub Pages (step by step)

You only do this once. After that, every change you push goes live automatically within a minute or two.

1. **Put the code on GitHub.** If you're reading this on github.com, it's already there.
2. On the repository page, click **Settings** (the gear tab along the top).
3. In the left sidebar, click **Pages**.
4. Under **Build and deployment → Source**, choose **Deploy from a branch**.
5. Under **Branch**, choose **main** and the folder **/ (root)**, then click **Save**.
6. Wait 1–2 minutes and refresh the page. A box appears at the top saying **"Your site is live at …"**. The address looks like `https://YOUR-USERNAME.github.io/decision-game-version-1/`.
7. Open that address on your phone to check it loads.

> **Private repo?** GitHub Pages on a free account needs the repository to be **public**. You can change that under Settings → General → Danger Zone → Change visibility. Nothing personal is stored in the code; your progress lives only on your phone. If you'd rather keep the repo private, use Netlify instead (below).

### Alternative: Netlify (works with private repos)

1. Go to [netlify.com](https://www.netlify.com) and sign up with your GitHub account.
2. Click **Add new site → Import an existing project → GitHub**, then pick this repository.
3. Leave **Build command** empty and set **Publish directory** to `/` (or leave it blank).
4. Click **Deploy**. You'll get an address like `https://something-random.netlify.app`. You can rename it under **Site configuration → Change site name**.

## Add it to your phone's home screen

**iPhone (Safari; this must be Safari, not Chrome):**
1. Open your site address in Safari.
2. Tap the **Share** button (the square with an arrow pointing up).
3. Scroll down and tap **Add to Home Screen**, then **Add**.
4. Open it from the new icon. It runs full-screen like an app.
5. Do one full session while you're online so everything gets cached. After that it works in airplane mode.

**Android (Chrome):**
1. Open your site address in Chrome.
2. Tap the **⋮** menu (top right), then **Add to Home screen** or **Install app**.
3. Confirm. The icon appears on your home screen and in your app drawer.

## Updating the app later

When you change any file, also bump the version line at the top of `sw.js` (for example `dm-v1` → `dm-v2`). Then push. Phones pick up the new version the next time you open the app with a connection; close it and open it again to see the update.
