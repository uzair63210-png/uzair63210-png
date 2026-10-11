# 🐍 Snake Game

A smooth, animated snake game playable in the browser. Arrow keys / WASD to move,
Space to pause, Enter to restart. Works on mobile with swipe and on-screen buttons.

## Run locally

Just open `index.html` in a browser — no build step, no dependencies.

Or serve it:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page structure |
| `css/style.css` | Dark GitHub-style theme, scoreboard, overlays |
| `js/game.js` | Game engine — interpolated animation, particles, effects |

## Deploy to GitHub Pages

**Option A — profile site (root URL):**

```bash
git checkout -b gh-pages
git add .
git commit -m "Add snake game"
git push origin gh-pages
```

Then: repo **Settings → Pages → Source → Deploy from branch → gh-pages → /(root)**.

Live at `https://uzair63210-png.github.io/`

**Option B — project site:** push these files to a repo named e.g. `snake-game`,
enable Pages on its `main` branch. Live at `https://uzair63210-png.github.io/snake-game/`

## Link from your profile README

```markdown
[![Play Snake](https://img.shields.io/badge/PLAY_SNAKE-238636?style=for-the-badge&logo=github)](https://uzair63210-png.github.io/)
```
