# OMNOM DAO — Wave 1 Referendum Launch Pack

**Status**: READY TO PUBLISH — the referendum is already live (opened Oct 1, 2026; owner approval came in ahead of schedule). Publish the launch posts as soon as you've reviewed them.
**Author**: OMNOM DAO core team
**Domain**: https://dao.omnom.dog
**Companions**: [REFERENDUM-WAVE1.md](../REFERENDUM-WAVE1.md) (decision record) · `scripts/seed-referendum.ts` (the exact ballot bodies) · `npm run verify:referendum` is green (verified 2026-10-01).

---

## What is live

One ~30-day window (**live now — Oct 1, 2026 → Nov 1, 00:00 UTC**), three separate FOR/AGAINST/ABSTAIN ballots at **dao.omnom.dog/vote**, one per rulebook question:

| Q | Ballot | The plain question | FOR means |
|---|---|---|---|
| 1 | Wave 1 Referendum · Question 1 | How many people need to vote for a result to count? | Adopt 5% as the ratified global default quorum |
| 2 | Wave 1 Referendum · Question 2 | How many "yes" votes does it take to win? | Ratify today's split — simple majority for everyday proposals, 60% supermajority for chain / tokenomics / technical |
| 3 | Wave 1 Referendum · Question 3 | Should big decisions need more voters than small ones? | Adopt the graded schedule (General 5% · standard 10% · chain & tokenomics 25%) |

- **Eligibility:** every wallet that ever held ≥1 $OMNOM in the frozen snapshot — **25,686 eligible wallets**.
- **Mechanics:** gasless ballots, SIWE sign-in, changeable until close. Voting power is quadratic (√balance) — whales are loud, not dictators.
- **The 5% quorum is KEPT — not lowered.** 5% = 29,098,690 power ≈ 1,284 average-power wallets.
- **The consensus fallback, disclosed up front:** if 5% is not reached, the most-voted outcome is still adopted as the community's working consensus — recorded openly as a quorum-missed decision (`adoptedAs: consensus-fallback`) and re-confirmed in a later ratification vote. **This clause must appear in EVERY variant below.**

### The honest turnout math (verbatim-ish, in every launch variant)

> Total voting power = **581,973,790**. Record turnout: the Foundational Governance Election — **35 voters = 2.73%**. Last vote: **27 voters = 1.73%** (expired Sep 30). The 5% bar ≈ **47× last turnout** and ~**2× the all-time record**.

We do not hide these numbers — we lead with them. The pitch is: keep the bar, lengthen the window (30 days, not 7), vote on everything at once, and tell you the fallback rule before you vote.

---

## (a) X — long-form Premium post (≤ 2000 chars; this draft = ~1,585)

> 🗳️ **THE $OMNOM RULEBOOK VOTE IS LIVE. Three questions. One window. 30 days.**
>
> The Wave 1 Referendum is open **right now** at dao.omnom.dog/vote — and it closes **Nov 1, 00:00 UTC**. Every wallet that ever held ≥1 $OMNOM — **25,686 wallets** — is eligible. Gasless ballots, SIWE sign-in, changeable until close.
>
> **The three questions (one FOR/AGAINST ballot each):**
> 1️⃣ Global default quorum — how many people need to vote for a result to count?
> 2️⃣ Pass threshold — how many "yes" votes does it take to win?
> 3️⃣ Per-type quorum schedule — should big decisions need more voters than small ones?
>
> **The honest turnout math:**
> Total voting power = **581,973,790**. The **5% quorum is KEPT** — not lowered. 5% = 29,098,690 power ≈ **1,284 average-power wallets**.
> • Record: the Foundational Governance Election — **35 voters = 2.73%**
> • Last vote: **27 voters = 1.73%** (expired Sep 30)
> • The 5% bar ≈ **47× last turnout**, ~**2× the all-time record**
>
> We keep the bar anyway — and we tell you the rule up front:
>
> **⚖️ THE CONSENSUS FALLBACK:** if 5% is not reached, the **most-voted outcome is still adopted** as the community's working consensus — recorded openly as a quorum-missed decision and **re-confirmed in a later ratification vote** as turnout grows. Your vote counts either way. Nothing about this window is decorative.
>
> **Why vote:** chain migration, tokenomics, treasury — everything after this is decided by the rulebook you ratify now.
>
> 👉 Read & vote: https://dao.omnom.dog/vote?utm_campaign=wave1-referendum&utm_source=x
>
> $OMNOM #DAO #Governance 🐕🧡

---

## (b) X — short post (≤ 280 chars; this draft = 274 raw, fits under any counting method)

> 🗳️ $OMNOM rulebook vote LIVE — 3 questions, 30 days.
>
> Record 2.73% (35 voters) · last 1.73% (27) · the 5% bar ≈ 47× that. Miss it and the most-voted outcome still sets our working consensus — disclosed up front.
>
> dao.omnom.dog/vote?utm_campaign=wave1-referendum&utm_source=x

Roomier variant with the eligibility line (310 raw chars — fits X's counter, where any URL counts as 23; over 280 if counted raw):

> 🗳️ $OMNOM rulebook vote LIVE — 3 questions, 30 days.
>
> Record 2.73% (35 voters) · last 1.73% (27) · the 5% bar ≈ 47× that. Miss it and the most-voted outcome still sets our working consensus — disclosed up front.
>
> Ever held $OMNOM? You're eligible.
>
> dao.omnom.dog/vote?utm_campaign=wave1-referendum&utm_source=x

---

## (c) Telegram — long post (copy-paste ready)

🗳️ **$OMNOM DAO — THE RULEBOOK VOTE IS LIVE. Three questions. One window. 30 days.**

The Wave 1 Referendum is open **right now** and runs to **Nov 1, 00:00 UTC**. Every wallet that ever held $OMNOM is eligible — **25,686 wallets**. Connect, sign, vote. No gas. Change your ballot any time before close.

**The three questions — one FOR/AGAINST ballot each:**

1️⃣ **Global default quorum** — how many people need to vote for a result to count?
🟢 FOR = ratify one simple 5% bar for everything · 🔴 AGAINST = keep the old 10–15% defaults nobody ever voted on

2️⃣ **Pass threshold** — how many "yes" votes does it take to win?
🟢 FOR = ratify today's split (everyday proposals: simple majority; chain / tokenomics / technical: 60%) · 🔴 AGAINST = simple majority for everything

3️⃣ **Per-type quorum schedule** — should big decisions need more voters than small ones?
🟢 FOR = graded bars (General 5% · standard 10% · chain & tokenomics 25%) · 🔴 AGAINST = keep the flat 10–15%

**Real talk, in numbers** (from the pinned snapshot):

• Total voting power = **581,973,790**
• The **5% quorum is KEPT — not lowered.** 5% = 29,098,690 power ≈ **1,284 average-power wallets voting**
• Our record: the leadership election — **35 voters = 2.73%**
• Last vote: **27 voters = 1.73%**, expired Sep 30
• So the 5% bar ≈ **47× last turnout** and ~**2× our all-time record**

We're keeping the bar anyway — a rulebook ratified at a lower bar would always carry an asterisk. What changes is everything else: **30 days instead of 7**, all three questions at once (one campaign, not three), and the biggest promotion push this DAO has attempted.

**⚖️ And the fallback, stated up front:** if 5% is not reached, the **most-voted outcome is still adopted** as the community's working consensus — recorded openly in the proposal record as a quorum-missed decision, and **re-confirmed in a later ratification vote** once turnout has grown. Your vote counts either way: under quorum it is binding; under the fallback it sets the working consensus. Nothing about this window is decorative.

**Why bother?** Chain migration, tokenomics, treasury — everything that comes next is decided by the rulebook you ratify now. The community that shows up in the next 30 days decides how all of that gets decided later.

👉 Read & vote: **dao.omnom.dog/vote?utm_campaign=wave1-referendum&utm_source=telegram** — all three ballots are right on the page.

Show up once and you're a founding voter of this DAO. 🐕🧡

Your voice. Your $OMNOM. Your DAO.

---

## (d) Telegram — short caption

🗳️ **$OMNOM rulebook vote is LIVE — 3 questions, 30 days, one window.**

Quorum bar · pass threshold · per-type bars. Ever held $OMNOM? You're eligible.

The honest math: record turnout **2.73%** (35 voters), last vote **1.73%** (27). The 5% bar ≈ **47× that**. And if 5% isn't reached, the **most-voted outcome still becomes our working consensus** — disclosed up front, re-confirmed later. Your vote counts either way.

👉 **dao.omnom.dog/vote?utm_campaign=wave1-referendum&utm_source=telegram**

🐕🧡

---

## (e) Mid-window update templates

Fill every bracket, re-verify numbers against the live site before posting, and keep the fallback clause in every update. Leading-positions lines describe the current FOR/AGAINST split **of for+against power** (abstain excluded) — always name the option, never just a percentage.

### T+7 (Oct 9)

🗳️ **$OMNOM rulebook vote — 7 days in, 23 to go.**

Turnout so far: **[N] ballots = [X]% of the 5% bar** (bar = 29,098,690 power).

Leading positions right now:
1️⃣ Global default quorum: **[FOR/AGAINST]** at [X]%
2️⃣ Pass threshold: **[FOR/AGAINST]** at [X]%
3️⃣ Per-type schedule: **[FOR/AGAINST]** at [X]%

Reminder of the honest math: record turnout is 2.73% (35 voters); last vote was 1.73% (27). And the rule we disclosed on day one still stands: **if 5% isn't reached, the most-voted outcome still becomes our working consensus** — recorded openly, re-confirmed later. Your vote counts either way.

Change your ballot any time until Nov 1, 00:00 UTC.

👉 dao.omnom.dog/vote?utm_campaign=wave1-referendum&utm_source=x

$OMNOM #DAO #Governance 🐕🧡

### T+14 (Oct 16) — halfway

🗳️ **Halfway through the $OMNOM rulebook vote.**

**[N] ballots = [X]% of the 5% bar** (for scale: record turnout 2.73%, last vote 1.73%). Fifteen days left.

Leading positions:
1️⃣ Global default quorum: **[FOR/AGAINST]** at [X]%
2️⃣ Pass threshold: **[FOR/AGAINST]** at [X]%
3️⃣ Per-type schedule: **[FOR/AGAINST]** at [X]%

Biggest movement this week: [one line on swing / new voters / discussion].

Same disclosure as day one: **if 5% isn't reached, the most-voted outcome still becomes our working consensus** — recorded openly as quorum-missed, re-confirmed in a later ratification vote. No surprises, ever.

Ballots are changeable until Nov 1, 00:00 UTC.

👉 dao.omnom.dog/vote?utm_campaign=wave1-referendum&utm_source=x

$OMNOM #DAO #Governance 🐕🧡

### T+21 (Oct 23) — final stretch begins

🗳️ **One week left on the $OMNOM rulebook vote.**

**[N] ballots = [X]% of the 5% bar** (for scale: record turnout 2.73%, last vote 1.73%). Closes **Nov 1, 00:00 UTC** (8 PM local Oct 31).

Leading positions:
1️⃣ Global default quorum: **[FOR/AGAINST]** at [X]%
2️⃣ Pass threshold: **[FOR/AGAINST]** at [X]%
3️⃣ Per-type schedule: **[FOR/AGAINST]** at [X]%

If you've been meaning to vote: this is the week. Gasless, ~90 seconds, changeable until close. And as disclosed from day one: **if 5% isn't reached, the most-voted outcome still becomes our working consensus** — recorded openly, re-confirmed later. But a real quorum makes it binding. Help us get there.

👉 dao.omnom.dog/vote?utm_campaign=wave1-referendum&utm_source=x

$OMNOM #DAO #Governance 🐕🧡

---

## (f) Last-48h post (from Oct 30, 00:00 UTC)

🗳️ **FINAL 48 HOURS — $OMNOM rulebook vote closes Nov 1, 00:00 UTC** (8 PM local Oct 31).

**[N] ballots = [X]% of the 5% bar** (for scale: record turnout 2.73%, last vote 1.73%). Leading positions:
1️⃣ Quorum: **[FOR/AGAINST]** [X]% · 2️⃣ Threshold: **[FOR/AGAINST]** [X]% · 3️⃣ Schedule: **[FOR/AGAINST]** [X]%

Three rulebook questions, one ballot each, ~90 seconds, no gas. Ever held $OMNOM? You're eligible — all 25,686 of you.

And the promise we made on day one: **if 5% isn't reached, the most-voted outcome still becomes our working consensus** — recorded openly, re-confirmed in a later ratification vote. Your vote counts either way. But binding needs quorum.

👉 dao.omnom.dog/vote?utm_campaign=wave1-referendum&utm_source=x

$OMNOM #DAO #Governance 🐕🧡

---

## (g) Results posts — TWO variants, decide by the final numbers only

**Never post results until the finalize run has completed and the numbers are verified** (cross-check `/results` and the proposal pages; the 30-min cron closes the window). Post exactly one of these. Telegram runs of either variant swap `utm_source=x` → `utm_source=telegram`.

### (g1) Quorum reached

📊 **$OMNOM rulebook vote CLOSED — QUORUM MET.**

You didn't just vote — you cleared the bar. **[N] ballots = [X]% of total voting power** (5% needed = 29,098,690).

Final results:
1️⃣ Global default quorum: **[FOR/AGAINST/ABSTAIN]** — [X]% of for+against power
2️⃣ Pass threshold: **[FOR/AGAINST/ABSTAIN]** — [X]%
3️⃣ Per-type schedule: **[FOR/AGAINST/ABSTAIN]** — [X]%

These are **binding, quorum-backed decisions**: the winning outcomes are being recorded on each proposal and applied to the platform. For the first time, the rules this DAO runs on were ratified by the people who hold it. (The rule we disclosed on day one — if 5% isn't reached, the most-voted outcome still becomes the working consensus — never came into play: you cleared the bar, so these results are binding outright, no asterisk.)

From record 2.73% (35 voters) and last vote's 1.73% (27) to **[X]%** — that's what showing up does.

Full numbers: dao.omnom.dog/results?utm_campaign=wave1-referendum&utm_source=x

$OMNOM #DAO #Governance 🐕🧡

### (g2) Consensus fallback (quorum missed)

📊 **$OMNOM rulebook vote CLOSED. We missed the 5% quorum — and we're doing exactly what we said we would.**

Final turnout: **[N] ballots = [X]%** of total voting power (5% bar = 29,098,690). For scale: our record was 2.73% (35 voters); last vote was 1.73% (27).

**The disclosed consensus fallback, applied openly:** the most-voted outcome on each question **is adopted as the community's working consensus** — recorded in each proposal as a quorum-missed decision (`adoptedAs: consensus-fallback`, final turnout attached) and **re-confirmed in a later ratification vote** as turnout grows. Process, in the open: we announce the adoption intent (this post is that announcement), let **24 hours** of public cooling-off run, then record the adoptions — every step lands in the public audit log.

Outcomes adopted as working consensus:
1️⃣ Global default quorum: **[FOR/AGAINST/ABSTAIN]** — [X]% of for+against power
2️⃣ Pass threshold: **[FOR/AGAINST/ABSTAIN]** — [X]%
3️⃣ Per-type schedule: **[FOR/AGAINST/ABSTAIN]** — [X]%

No backroom, no asterisk discovered later — the rule was in the first post, in every update, and inside every ballot. Your votes set the working consensus either way, and every holder can read the record.

Next: the ratification re-confirm vote gets scheduled and announced. Turnout is now the project's #1 governance problem, openly stated.

Full record: dao.omnom.dog/results?utm_campaign=wave1-referendum&utm_source=x

$OMNOM #DAO #Governance 🐕🧡

---

## Optional teaser line (owner's call — use sparingly)

If you want to seed what comes after the rulebook, append ONE line to the Telegram long post or an X reply (never the main post — don't dilute the CTA):

> 👀 And after the rulebook: the community decides where $OMNOM lives next. DogeOS just opened its public testnet — a Dogecoin L2 with DOGE gas. Early eyes are watching.

Rules for this line: frame DogeOS as a *candidate the community will vote on*, never a promise or an announcement; no dates, no commitments; link stays dao.omnom.dog/vote.

---

## Posting cadence

| When (UTC) | Post | Notes |
|---|---|---|
| **NOW — the vote is live** (opened Oct 1) | (a) X long + (b) X short, (c) Telegram long + (d) caption | `verify:referendum` is green and all three proposals are ACTIVE ✓ — publish tonight |
| T+7 — Oct 8/9 | (e) T+7 update | Fill brackets from live tallies |
| T+14 — Oct 15/16 | (e) T+14 update (halfway) | Same |
| T+21 — Oct 22/23 | (e) T+21 update | Same |
| T-2 — Oct 30, 00:00 | (f) last-48h | Pin on X + Telegram |
| **Close — Nov 1, 00:00** | — | Finalize runs via the 30-min cron |
| Within 24h of close | (g1) or (g2) results | Only after final numbers are verified on /results |

In-app T-72h / T-24h reminder waves (shown to signed-in holders by the site bell) complement these — there are **no emails**; social posts should not duplicate their copy.

---

## Image prompts & visual assets (optimized)

Brand palette (from [BRAND_STANDARDS.md](../BRAND_STANDARDS.md)): gold `#FFD700`, purple `#8B5CF6`, black layers `#000000`/`#0A0A0A`/`#141414`, text `#FAFAFA`. Voice: playful dog mascot, serious mechanics.

> ⚠️ **Two rules before generating:**
> 1. **Never let the AI render text or numbers** — generators mangle spelling and will invent tallies (violating the "numbers must match" guardrail). Generate **art with empty space**, then add the exact overlay strings below in Canva/Figma/Photopea.
> 2. **Anything with real numbers gets screenshotted or built, not generated** — the OG card and the turnout chart come from the app / a chart tool.

### 1. Launch hero banner — AI background + text overlay (posts a & c)

**Prompt (image generator — Midjourney/Flux/Ideogram style):**

> flat vector illustration, a cute confident pomeranian dog wearing a golden laurel wreath, holding a glowing golden ballot, deep black background #000000 with subtle gold particle glow and a soft purple #8B5CF6 nebula gradient in the lower right, minimalist governance theme, thin gold border frame, large empty space on the left half for text, high contrast, clean edges, no text, no letters, no watermark --ar 3:2

**Overlay text (add manually):**
- Headline: `WAVE 1 REFERENDUM` (gold→purple gradient, bold)
- Sub: `3 questions · 30 days · closes Nov 1`
- CTA: `dao.omnom.dog/vote`

### 2. Turnout "real talk" graphic — BUILD, don't generate

Three horizontal bars on the dark surface `#0A0A0A`, left-aligned labels, gold bars, values at bar ends:

- `Last vote (Sep 30)` — **1.73%** (bar at ~35% width)
- `Record (Foundational Election)` — **2.73%** (bar at ~55% width)
- `The 5% bar` — outlined/hollow bar at 100% width, label `what we're asking for`

Caption strip under the bars: `5% ≈ 1,284 average wallets · 25,686 eligible`. Build in Canva/Figma (10 minutes) — the numbers are the message, so they must be exact. Ages well: reuse for T+7/T+14 with a "we're here →" marker added.

### 3. Results card — screenshot first, decorate second

Once finalize completes: screenshot the `/results` section per question (real numbers, real badge), or the `/vote` page's results block. Optional AI frame around the screenshot:

> minimal ornamental frame, flat vector gold laurel corners on black #000000, subtle purple #8B5CF6 glow, empty center, no text, no watermark --ar 4:3

### 4. Last-48h urgency variant — AI art + overlay

**Prompt:**

> flat vector illustration, close-up of a pomeranian dog checking a golden pocket watch, warm gold #FFD700 rim light on black #000000, falling golden confetti particles, urgent but friendly mood, deep space for a text block on the right half, minimalist, clean edges, no text, no letters, no watermark --ar 3:2

**Overlay text:** `FINAL 48 HOURS` (large) · `closes Nov 1, 00:00 UTC` · `dao.omnom.dog/vote`

### 5. Live OG card — screenshot, never generate

The site generates its own dynamic referendum card: open `dao.omnom.dog/vote` fresh on posting day and screenshot the preview, or fetch `dao.omnom.dog/vote/opengraph-image` directly. Real countdown, real questions — zero effort, always accurate.

**Recommended pairing:** #1 (or #4 near the close) for launch posts · #2 for T+7/T+14 · #3 + #5 for results.

---

## Posting cadence

---

## Hashtag strategy

Primary (every X post): `$OMNOM` `#DAO` `#Governance`
Optional rotation: `#Web3` `#DeFi` `#CryptoTwitter` `#DAOVoting`
Telegram: 0–2 hashtags max — captions carry the CTA, tags are noise there.

---

## Guardrails (from the FGE pack, carried over)

- **Never round 25,686** — the eligible-wallet figure is verified in the snapshot; "over 25K" is not acceptable.
- **Production domain only** — `dao.omnom.dog`. No localhost, preview, or shortener URLs.
- **The admin wallet address is public and citable verbatim**: `0x22F4194F6706E70aBaA14AB352D0baA6C7ceD24a` (for skeptics' threads).
- **Never call the quorum "lowered"** — 5% is the platform floor and it is KEPT; the lever is the 30-day window + one combined campaign.
- **The consensus fallback appears in every single post** — worded as a disclosure, never spun as low expectations or hedged after the fact.
- **Numbers must match the live ballot bodies**: 581,973,790 total power · 29,098,690 bar · ≈1,284 avg wallets · 2.73% record (35) · 1.73% last (27, expired Sep 30). If a number ever disagrees with `scripts/seed-referendum.ts`, the script wins.
- **Every link carries `utm_campaign=wave1-referendum`** with `utm_source=x` or `utm_source=telegram` — the traffic tracker attributes the campaign by it.
- **No on-chain execution or payment promises** — advisory governance with recorded, public outcomes; chain migration is a later, separate decision.
- **Results are never posted early or from partial tallies** — wait for finalize + verification, then post exactly one results variant.
