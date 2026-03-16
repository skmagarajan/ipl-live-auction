# 🏏 IPL Live Auction

> Because shouting "TWO CRORE!" across a WhatsApp group just isn't dramatic enough.

A real-time fantasy IPL auction app where friendships are tested, budgets are blown, and someone always overpays for a middle-order batsman from a team that finished last.

---

## What is this?

You and your friends each manage a ₹100 Cr budget and bid live against each other for IPL players. One person is the Auctioneer (the one who enjoys power a little too much). Everyone else scrambles to build the best squad without going broke in the first five minutes.

Built with Angular + Firebase so every bid, every "SOLD!", and every moment of budget regret happens in real-time across all devices.

---

## Features

- 🔨 **Live bidding** — bids sync instantly across all tabs and devices
- ⚡ **Quick bid buttons** — +0.1, +0.5, +1 Cr for when you need to outbid your friend by the smallest possible margin
- 💸 **Budget tracker** — watch your ₹100 Cr disappear in real time
- 🧤🏏⭐🎳 **Role badges** — WK, BAT, AR, BOWL counts per team so you know who bought five batters and zero bowlers (you know who you are)
- 🎲 **Randomised picks** — auctioneer can enable chaos mode
- ↩ **Undo last sale** — for when the auctioneer has a change of heart (or was bribed)
- 🌙 **Dark mode** — for auctions that go past midnight, which they always do
- 📊 **Export to Excel** — proof of the disaster you built

---

## How to play

1. One person opens the app and clicks **Create Auction Room**
2. Share the invite link with everyone else
3. Everyone joins with their team name
4. The auctioneer sets the player order, picks a victim, and clicks **Start Auction**
5. Players get auctioned off one by one — highest bid wins
6. When it's all over, the **Export Excel** button delivers the receipts

---

## Tech stack

| Thing | Why |
|---|---|
| Angular 21 | Because we like our frameworks like we like our auctions — fast and reactive |
| Firebase Firestore | Real-time database so everyone sees the same chaos simultaneously |
| Angular Material | Pre-built components so we could spend time on auction logic instead of button design (we still spent time on button design) |
| XLSX | For the post-auction blame spreadsheet |

---

## Running locally

```bash
cd auction-app
npm install
npm start
```

App runs at `http://localhost:4200`. You'll need a Firebase project with Firestore enabled — see `src/environments/environment.development.ts`.

## Deploying

```bash
npm run deploy        # build + push to Firebase Hosting
npm run deploy:rules  # update Firestore security rules only
npm run deploy:all    # build + deploy everything
```

---

## Known issues

- The auctioneer has too much power and will abuse it
- Someone will always spend ₹40 Cr on an uncapped player in round one
- The "just one more bid" phenomenon has no technical fix

---

*Built by fans, for fans, to settle once and for all who among your friends is the worst cricket team manager.*
