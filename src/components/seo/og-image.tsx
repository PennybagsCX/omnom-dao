import { ImageResponse } from "next/og";

import { SNAPSHOT } from "@/lib/constants";
import { listProposals } from "@/lib/proposal-service";
import { ProposalStatus, type Proposal } from "@/types";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png" as const;

/**
 * Social-share card builders (1200×630, brand system per DOCS/BRAND_STANDARDS.md).
 *
 * Note: font support in @vercel/og has been unreliable in recent Vercel
 * regions (returns 0-byte responses). We render with the system sans-serif
 * stack — every platform's default sans (SF Pro on Apple, Segoe UI on
 * Windows, Inter / Cantarell / Noto on Linux) renders close enough to Inter
 * to be visually indistinguishable on social previews.
 *
 * The cards are DATA-DRIVEN: whatever is ACTIVE in the DB decides whether a
 * route renders the referendum card, a generic live-vote card, or the brand
 * fallback. No dates or week numbers are ever hardcoded here.
 */

/** Metadata tag (written by the referendum seed) marking Wave 1 referendum rows. */
const REFERENDUM_TAG = "wave1-2026";

const OG_FONT_STACK =
  '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';

/** Shared card shell: true-black gradient + generous padding (brand §2/§4). */
const cardShell: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "space-between",
  backgroundColor: "#000000",
  backgroundImage:
    "linear-gradient(135deg, #000000 0%, #0f0f0f 50%, #000000 100%)",
  fontFamily: OG_FONT_STACK,
  padding: "56px 80px",
  position: "relative",
};

/** Soft gold ambient glow behind the headline (brand §4 "Ambient Effects"). */
function GoldGlow({ top, width, height }: { top: string; width: number; height: number }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top,
        left: "50%",
        transform: "translate(-50%, -50%)",
        width,
        height,
        background:
          "radial-gradient(ellipse at center, rgba(255, 215, 0, 0.12) 0%, rgba(255, 215, 0, 0) 70%)",
        display: "flex",
      }}
    />
  );
}

function BrandMark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, zIndex: 1 }}>
      <span style={{ fontSize: 40, fontWeight: 800, color: "#FFD700", letterSpacing: -0.8 }}>OMNOM</span>
      <span style={{ fontSize: 40, fontWeight: 800, color: "#FAFAFA", letterSpacing: -0.8 }}>DAO</span>
    </div>
  );
}

/** "Oct 2, 2026" — UTC so every crawler sees the same window (page convention). */
function formatOgDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Human window line derived from the ACTIVE rows — never a hardcoded date. */
function windowLine(startsAt: string | null, endsAt: string | null): string {
  if (startsAt && endsAt) return `${formatOgDay(startsAt)} → ${formatOgDay(endsAt)}`;
  if (endsAt) return `Closes ${formatOgDay(endsAt)}`;
  if (startsAt) return `Opened ${formatOgDay(startsAt)}`;
  return "Voting open now";
}

/** JS-side truncation — satori does not ellipsize overflowing text. */
function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Split "Wave 1 Referendum · Question 2: How many wallets…?" into the
 * referendum name and the bare question label. Falls back to the raw title
 * when the seeded "Name · Question N:" shape is absent.
 */
function splitReferendumTitle(title: string): { name: string; question: string } {
  const sep = title.indexOf("·");
  if (sep === -1) return { name: title.trim(), question: "" };
  const name = title.slice(0, sep).trim();
  const rest = title.slice(sep + 1).trim();
  const question = rest.replace(/^question\s*\d+\s*[:\-–—]\s*/i, "").trim();
  return { name, question: question || rest };
}

function referendumTagOf(p: Proposal): string | undefined {
  // Referendum marker rides in the metadata JSON (same cast convention as the
  // pausedAt admin marker in proposal-service).
  return (p.metadata as { referendum?: string }).referendum;
}

function referendumQuestionNo(p: Proposal): number {
  const n = (p.metadata as { referendumQuestion?: unknown }).referendumQuestion;
  return typeof n === "number" ? n : Number.MAX_SAFE_INTEGER;
}

/** Earliest non-null start / latest non-null end across the given rows. */
function windowBounds(proposals: Proposal[]): { startsAt: string | null; endsAt: string | null } {
  const starts = proposals
    .map((p) => p.votingStartsAt)
    .filter((v): v is string => Boolean(v))
    .sort();
  const ends = proposals
    .map((p) => p.votingEndsAt)
    .filter((v): v is string => Boolean(v))
    .sort();
  return { startsAt: starts[0] ?? null, endsAt: ends[ends.length - 1] ?? null };
}

/* ── Referendum card ─────────────────────────────────────────── */

export interface ReferendumOgData {
  /** e.g. "Wave 1 Referendum" — derived from the ACTIVE rows' shared title prefix. */
  name: string;
  /** Bare question labels, one per ACTIVE referendum proposal, in question order. */
  questions: string[];
  startsAt: string | null;
  endsAt: string | null;
  /** CTA line at the bottom, e.g. "dao.omnom.dog/vote". */
  ctaUrl: string;
}

/** Card for an ACTIVE referendum: name, its question labels, live window, CTA. */
export function buildReferendumOgCard(data: ReferendumOgData): ImageResponse {
  const name = truncate(data.name, 60);
  const questions = data.questions.slice(0, 3);
  return new ImageResponse(
    (
      <div style={cardShell}>
        <GoldGlow top="44%" width={820} height={280} />

        <BrandMark />

        {/* Referendum headline + question labels */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, zIndex: 1 }}>
          <span
            style={{
              fontSize: 24,
              fontWeight: 500,
              color: "#A1A1AA",
              letterSpacing: 4,
              textTransform: "uppercase",
            }}
          >
            {name}
          </span>
          <span style={{ fontSize: 84, fontWeight: 800, color: "#FFD700", letterSpacing: -2, lineHeight: 1.05 }}>
            🐕 Voting Is Live
          </span>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12, marginTop: 4 }}>
            {questions.map((label, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: "#FFD700" }}>Q{i + 1}</span>
                <span style={{ fontSize: 28, color: "#FAFAFA", fontWeight: 400 }}>
                  {truncate(label, 72)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Window + CTA */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, zIndex: 1 }}>
          <span style={{ fontSize: 24, color: "#A1A1AA", fontWeight: 400 }}>
            {windowLine(data.startsAt, data.endsAt)} ·{" "}
            {new Intl.NumberFormat("en-US").format(SNAPSHOT.totalHolders)} eligible wallets
          </span>
          <span style={{ fontSize: 22, color: "#FFD700", fontWeight: 600, letterSpacing: -0.3 }}>
            {data.ctaUrl}
          </span>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}

/* ── Generic live-vote card ──────────────────────────────────── */

export interface LiveProposalOgData {
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  ctaUrl: string;
}

/** Card for any other ACTIVE proposal: its title + live window + CTA. */
export function buildLiveProposalOgCard(data: LiveProposalOgData): ImageResponse {
  // Shrink long titles instead of clipping mid-word at one fixed size.
  const titleLength = data.title.length;
  const titleSize = titleLength <= 42 ? 68 : titleLength <= 90 ? 54 : 44;
  return new ImageResponse(
    (
      <div style={cardShell}>
        <GoldGlow top="42%" width={760} height={220} />

        <BrandMark />

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, zIndex: 1 }}>
          <span
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: "#A1A1AA",
              letterSpacing: 4,
              textTransform: "uppercase",
            }}
          >
            Governance Vote · Live Now
          </span>
          <span
            style={{
              fontSize: titleSize,
              fontWeight: 800,
              color: "#FFD700",
              letterSpacing: -1.5,
              lineHeight: 1.12,
              maxWidth: 1000,
              textAlign: "center",
            }}
          >
            {truncate(data.title, 110)}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, zIndex: 1 }}>
          <span style={{ fontSize: 24, color: "#A1A1AA", fontWeight: 400 }}>
            {windowLine(data.startsAt, data.endsAt)} ·{" "}
            {new Intl.NumberFormat("en-US").format(SNAPSHOT.totalHolders)} eligible wallets
          </span>
          <span style={{ fontSize: 22, color: "#FFD700", fontWeight: 600, letterSpacing: -0.3 }}>
            {data.ctaUrl}
          </span>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}

/* ── Brand fallback ──────────────────────────────────────────── */

/**
 * Evergreen brand statement — shown when nothing is ACTIVE. Replaces the
 * retired Foundational Governance Election card (that election closed in
 * Sep 2026; advertising it on live shares was stale content).
 */
export function buildBrandOgCard(ctaUrl: string): ImageResponse {
  return new ImageResponse(
    (
      <div style={cardShell}>
        <GoldGlow top="46%" width={720} height={200} />

        <BrandMark />

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, zIndex: 1 }}>
          <span
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: "#A1A1AA",
              letterSpacing: 4,
              textTransform: "uppercase",
            }}
          >
            Community Governance
          </span>
          <span style={{ fontSize: 76, fontWeight: 800, color: "#FFD700", letterSpacing: -2, lineHeight: 1.08 }}>
            Governance for{" "}
            {new Intl.NumberFormat("en-US").format(SNAPSHOT.totalHolders)} holders
          </span>
          <span style={{ fontSize: 30, color: "#FAFAFA", marginTop: 2, fontWeight: 400 }}>
            Off-chain, quadratic voting for $OMNOM holders
          </span>
        </div>

        <span style={{ fontSize: 22, color: "#FFD700", fontWeight: 600, letterSpacing: -0.3, zIndex: 1 }}>
          {ctaUrl}
        </span>
      </div>
    ),
    OG_SIZE,
  );
}

/* ── Shared ACTIVE-proposal loader ───────────────────────────── */

export interface ActiveVoteCardOptions {
  /** CTA on live-vote cards, e.g. "dao.omnom.dog/vote". */
  voteCtaUrl: string;
  /** CTA on the brand fallback, e.g. "dao.omnom.dog". */
  siteCtaUrl: string;
}

/**
 * Pick the share card from whatever is ACTIVE right now:
 *
 * 1. ACTIVE referendum rows (metadata.referendum === "wave1-2026") →
 *    {@link buildReferendumOgCard} with the rows' own window + question labels.
 * 2. Any other ACTIVE proposal → {@link buildLiveProposalOgCard}.
 * 3. Nothing ACTIVE → {@link buildBrandOgCard}.
 *
 * Lives beside the builders (not in each route) so the /vote and root image
 * routes cannot drift. Reads through the same `listProposals` helper the /vote
 * page uses; a DB failure degrades to the brand card instead of a 500, so a
 * snapshot/database problem can never break social previews.
 */
export async function loadActiveVoteCard(options: ActiveVoteCardOptions): Promise<ImageResponse> {
  let active: Proposal[] = [];
  try {
    const { proposals } = await listProposals({
      status: ProposalStatus.ACTIVE,
      sortBy: "votingStartsAt",
      sortOrder: "desc",
      limit: 12,
      offset: 0,
    });
    active = proposals;
  } catch {
    return buildBrandOgCard(options.siteCtaUrl);
  }

  const referendum = active
    .filter((p) => referendumTagOf(p) === REFERENDUM_TAG)
    .sort((a, b) => referendumQuestionNo(a) - referendumQuestionNo(b));

  const firstReferendum = referendum[0];
  if (firstReferendum) {
    const { name } = splitReferendumTitle(firstReferendum.title);
    const { startsAt, endsAt } = windowBounds(referendum);
    return buildReferendumOgCard({
      name,
      questions: referendum.map((p) => splitReferendumTitle(p.title).question || p.title),
      startsAt,
      endsAt,
      ctaUrl: options.voteCtaUrl,
    });
  }

  const current = active[0];
  if (current) {
    return buildLiveProposalOgCard({
      title: current.title,
      startsAt: current.votingStartsAt,
      endsAt: current.votingEndsAt,
      ctaUrl: options.voteCtaUrl,
    });
  }

  return buildBrandOgCard(options.siteCtaUrl);
}
