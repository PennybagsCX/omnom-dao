/** Community-facing explanatory material for the governance framework choices. */

export interface WorkedExample {
  label: string;
  calc: string;
  power: string;
}

export interface ElectionExplanation {
  id: "QUADRATIC" | "ONE_WALLET_ONE_VOTE" | "TIERED" | "LINEAR";
  title: string;
  summary: string;
  mathFormula: string;
  howItWorks: string[];
  workedExamples: WorkedExample[];
  advantages: string[];
  disadvantages: string[];
  bestFor: string;
}

export const ELECTION_EXPLANATIONS = [
  {
    id: "QUADRATIC",
    title: "Quadratic voting",
    summary:
      "Your vote weight is the square root of your snapshot balance. Larger holders still get more influence, but much less than one-for-one.",
    mathFormula: "vote weight = √(token balance)",
    howItWorks: [
      "Take your verified snapshot token balance.",
      "Take its square root.",
      "That square root becomes your vote weight.",
    ],
    workedExamples: [
      { label: "100 tokens", calc: "√100 = 10", power: "10 vote weight" },
      { label: "10,000 tokens", calc: "√10,000 = 100", power: "100 vote weight" },
      { label: "1,000,000 tokens", calc: "√1,000,000 = 1,000", power: "1,000 vote weight" },
      {
        label: "100,000,000 tokens",
        calc: "√100,000,000 = 10,000",
        power: "10,000 vote weight",
      },
    ],
    advantages: [
      "Rewards larger holdings, but with rapidly diminishing returns.",
      "Makes expensive vote-buying much less efficient.",
      "Commonly used by public-goods funding DAOs such as Gitcoin.",
    ],
    disadvantages: [
      "Still gives larger holders more influence than smaller holders.",
      "The math may feel less intuitive to new voters.",
      "Wallet-splitting before the snapshot could reduce its effectiveness; the audit found repeated-balance patterns that warrant review.",
    ],
    bestFor:
      "A compromise that recognizes economic exposure while preventing pure whale control.",
  },
  {
    id: "ONE_WALLET_ONE_VOTE",
    title: "One wallet, one vote",
    summary:
      "Every eligible snapshot wallet casts one equal vote, regardless of whether it holds one token or billions.",
    mathFormula: "vote weight = 1",
    howItWorks: [
      "Verify that your wallet appears in the pinned ever-held snapshot.",
      "Cast one ballot.",
      "Every ballot is counted equally.",
    ],
    workedExamples: [
      { label: "Wallet with 1 token", calc: "fixed weight", power: "1 vote" },
      { label: "Wallet with 1,000 tokens", calc: "fixed weight", power: "1 vote" },
      { label: "Wallet with 10,000,000 tokens", calc: "fixed weight", power: "1 vote" },
      { label: "Wallet with 10,000,000,000 tokens", calc: "fixed weight", power: "1 vote" },
    ],
    advantages: [
      "Simple and transparent.",
      "Maximum protection against token-weight concentration.",
      "The same rule already being used for this foundational election.",
    ],
    disadvantages: [
      "Does not distinguish economic exposure: a 1-token wallet equals a billion-token wallet.",
      "If one person controls many snapshot wallets, they can receive many votes.",
    ],
    bestFor:
      "Communities that prioritize equal participant representation over proportional economic ownership.",
  },
  {
    id: "TIERED",
    title: "Tiered voting",
    summary:
      "Wallets are grouped into seven cohorts (kraken through seahorse) by their share of supply, and each cohort receives a fixed share of total voting power.",
    mathFormula: "total voting power = 100%, split across cohort tiers",
    howItWorks: [
      "Classify each wallet by its share of supply (kraken, whale, dolphin, shark, octopus, crab, seahorse).",
      "Assign each tier a fixed voting block (for example, equal shares across all seven tiers).",
      "Distribute that block among the wallets inside the tier.",
    ],
    workedExamples: [
      {
        label: "Krakens (1 wallet, ~14.3% block)",
        calc: "14.28% ÷ 1 wallet",
        power: "≈ 14.28% per wallet",
      },
      {
        label: "Dolphins (30 wallets, ~14.3% block)",
        calc: "14.28% ÷ 30 wallets",
        power: "≈ 0.476% per wallet",
      },
      {
        label: "Seahorses (22,547 wallets, ~14.3% block)",
        calc: "14.28% ÷ 22,547 wallets",
        power: "≈ 0.000633% per wallet",
      },
    ],
    advantages: [
      "Prevents any one cohort from dominating every result.",
      "Encourages cross-cohort consensus.",
      "Can adjust block percentages without changing the snapshot.",
    ],
    disadvantages: [
      "Tier cutoffs are policy choices and can feel arbitrary at the boundary.",
      "A tiny cohort can have outsized per-wallet influence.",
      "More complex to explain and audit than one-wallet-one-vote.",
    ],
    bestFor:
      "A structured compromise when stakeholders want guaranteed cohort representation.",
  },
  {
    id: "LINEAR",
    title: "Linear token voting",
    summary:
      "One token equals one vote. Vote weight is exactly proportional to snapshot balance.",
    mathFormula: "vote weight = token balance",
    howItWorks: [
      "Read your snapshot token balance.",
      "Use that exact balance as your vote weight.",
    ],
    workedExamples: [
      { label: "1 token", calc: "1 × 1", power: "1 vote weight" },
      { label: "1,000 tokens", calc: "1,000 × 1", power: "1,000 vote weight" },
      { label: "1,000,000 tokens", calc: "1,000,000 × 1", power: "1,000,000 vote weight" },
      {
        label: "1,000,000,000 tokens",
        calc: "1,000,000,000 × 1",
        power: "1,000,000,000 vote weight",
      },
    ],
    advantages: [
      "Easiest rule to understand and calculate.",
      "Perfectly proportional to economic ownership.",
      "Standard model in many token-weighted DAO systems.",
    ],
    disadvantages: [
      "The final-snapshot audit found the top wallet controls 68.900% and the top four control 83.529%.",
      "A small group can determine outcomes without broader participation.",
      "Weakest protection against concentration and multi-wallet accumulation.",
    ],
    bestFor:
      "Communities that want governance to track economic ownership as directly as possible.",
  },
] as const satisfies readonly ElectionExplanation[];

export const ELECTION_FAQ = [
  {
    q: "Can I change my vote?",
    a: "Yes. You may change your ballot as many times as you want before voting closes. Your latest ballot is the one counted. After the election closes, ballots are locked.",
  },
  {
    q: "How is my wallet eligible?",
    a: "Your wallet address must appear in the pinned ever-held snapshot corpus published at DBOT-DC/omnom-snapshot. That corpus is the union of the pre-announcement snapshot and ten later weekly snapshots through August 8, 2026.",
  },
  {
    q: "Why can I verify at all if my current balance is lower?",
    a: "Ever-held eligibility means the platform recognizes that the wallet held $OMNOM at some point during the snapshot window. Your current balance at the end of the window is not the eligibility test.",
  },
  {
    q: "Does this election use the same rule it is voting on?",
    a: "No. This foundational election uses one wallet, one vote so the current token-weighted concentration cannot predetermine the future voting framework.",
  },
  {
    q: "What happens if two people control wallets with identical historical balances?",
    a: "They each receive one ballot in this election. The audit found repeated round-number balances across hundreds of wallets; that is a reason for scrutiny and future identity work, but the snapshot alone cannot prove common ownership.",
  },
  {
    q: "What is the source data and can I verify it?",
    a: "The source is commit 2c38af77ba37e67328347cc44bcabbd07551ec42 of DBOT-DC/omnom-snapshot. The ever-held CSV has SHA-256 1f64a663549ca717c6b612dc71a5cf673ab58badee58f876474c0fc6e551c128. You can independently download and hash the file.",
  },
  {
    q: "Does voting cost gas?",
    a: "No. Verification uses a read-only Ethereum message signature. The platform never requests a transaction and never moves tokens.",
  },
  {
    q: "Can an admin change my ballot?",
    a: "No. Admins can view and export results and audit data, but no admin interface can alter your ballot.",
  },
  {
    q: "How are results calculated while voting is open?",
    a: "Results count each voter's latest active ballot. The ballot-event audit trail preserves every cast and change for review.",
  },
  {
    q: "What happens after voting closes?",
    a: "Ballot changes are rejected. The final tally is calculated from the latest ballots, exported, and published with the audit report.",
  },
] as const;
