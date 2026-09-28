# Whist Scorer

Mobile-first scorekeeper for bidding whist (Oh Hell / nomination whist). Static HTML, CSS and JS with no build step or dependencies.

## Run locally

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

## Deploy to GitHub Pages

Push to a repo, then go to Settings → Pages and choose "Deploy from a branch", `main`, `/ (root)`.

## Rules supported

- Configurable max cards and round order (down, up, down-then-up, up-then-down)
- Score = bonus for exact bid + points per trick (optionally only when the bid is made)
- Optional dealer "hook" rule: bids can't total the cards dealt
- Optional trump rotation: ♥ ♣ ♦ ♠, then no trumps

Game state persists in `localStorage` under the key `whist-scorer-v1`.
