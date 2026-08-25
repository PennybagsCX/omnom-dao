import { type NextRequest, NextResponse } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAuth, UnauthorizedError } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAdminAddress } from "@/lib/constants";
import {
  ELECTION_CHOICES,
  ELECTION_CHOICE_LABELS,
  ELECTION_KEY,
  electionPhase,
  percentage,
  type ElectionChoice,
} from "@/lib/election";
import { ErrorCode } from "@/types";

/**
 * GET /api/v1/admin/election?export=eligibility|ballots
 *
 * Admin-only election operations dashboard feed.
 *
 * Default: status, turnout, and choice tallies.
 * `export=eligibility`: every eligible ever-held wallet address and rank.
 * `export=ballots`: immutable ballot audit trail.
 */
export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return apiError(err.code, undefined, err.statusCode);
    }
    throw err;
  }
  if (!isAdminAddress(session.sub)) {
    return apiError(ErrorCode.NOT_VERIFIED, "Admin access required.", 403);
  }

  const exportMode = request.nextUrl.searchParams.get("export");

  const electionRes = await db.execute({
    sql: `SELECT election_key, title, voting_starts_at, voting_ends_at,
                 snapshot_commit, snapshot_file, snapshot_file_sha256,
                 eligible_wallet_count, created_at
          FROM governance_election WHERE election_key = ?`,
    args: [ELECTION_KEY],
  });
  const election = electionRes.rows[0];
  if (!election) {
    return apiError(ErrorCode.PROPOSAL_NOT_FOUND, "Election not configured.", 404);
  }

  if (exportMode === "eligibility" || exportMode === "ballots" || exportMode === "events") {
    const filename =
      exportMode === "eligibility"
        ? "omnomdao-election-eligibility.csv"
        : exportMode === "events"
          ? "omnomdao-election-ballot-events.csv"
          : "omnomdao-election-ballots.csv";
    const header =
      exportMode === "eligibility"
        ? "address,rank\n"
        : exportMode === "events"
          ? "voter_address,choice,event,recorded_at\n"
          : "voter_address,choice,cast_at\n";
    const res =
      exportMode === "eligibility"
        ? await db.execute({
            sql: "SELECT 1",
            args: [],
          })
        : exportMode === "events"
          ? await db.execute({
              sql: `SELECT voter_address, choice, event, recorded_at
                    FROM governance_election_ballot_events
                    WHERE election_key = ? ORDER BY recorded_at ASC`,
              args: [ELECTION_KEY],
            })
          : await db.execute({
              sql: `SELECT voter_address, choice, cast_at FROM governance_election_ballots
                    WHERE election_key = ? ORDER BY cast_at ASC`,
              args: [ELECTION_KEY],
            });

    // Eligibility comes from the immutable snapshot artifact rather than the
    // relational database, so the export is generated from the public file.
    if (exportMode === "eligibility") {
      const { readFile } = await import("node:fs/promises");
      const path = await import("node:path");
      const file = await readFile(
        path.join(process.cwd(), "public", "data", "holders.json"),
        "utf-8",
      );
      const artifact = JSON.parse(file) as {
        holders: Record<string, { rank: number }>;
      };
      const rows = Object.entries(artifact.holders)
        .map(([address, holder]) => `${address},${holder.rank}`)
        .sort((a, b) => Number(a.split(",")[1]) - Number(b.split(",")[1]));
      const csv = header + rows.join("\n") + "\n";
      return new NextResponse(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    const rows = res.rows.map((r) =>
      exportMode === "events"
        ? `${r.voter_address},${r.choice},${r.event},${r.recorded_at}`
        : `${r.voter_address},${r.choice},${r.cast_at}`,
    );
    const csv = header + rows.join("\n") + (rows.length ? "\n" : "");
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const countsRes = await db.execute({
    sql: `SELECT choice, COUNT(*) AS cnt FROM governance_election_ballots
          WHERE election_key = ? GROUP BY choice`,
    args: [ELECTION_KEY],
  });
  const counts = new Map<ElectionChoice, number>();
  for (const choice of ELECTION_CHOICES) counts.set(choice, 0);
  for (const row of countsRes.rows) {
    const choice = row.choice as ElectionChoice;
    if ((ELECTION_CHOICES as readonly string[]).includes(choice)) {
      counts.set(choice, Number(row.cnt ?? 0));
    }
  }
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  const eligible = Number(election.eligible_wallet_count ?? 0);

  const phase = electionPhase(
    new Date(),
    new Date(election.voting_starts_at as string),
    new Date(election.voting_ends_at as string),
  );

  return apiSuccess({
    electionKey: election.election_key,
    title: election.title,
    phase,
    startsAt: election.voting_starts_at,
    endsAt: election.voting_ends_at,
    snapshotCommit: election.snapshot_commit,
    snapshotFile: election.snapshot_file,
    snapshotFileSha256: election.snapshot_file_sha256,
    eligibleWalletCount: eligible,
    totalBallots: total,
    turnoutPercentage: percentage(total, eligible),
    results: ELECTION_CHOICES.map((choice) => ({
      choice,
      label: ELECTION_CHOICE_LABELS[choice],
      count: counts.get(choice) ?? 0,
      percentage: percentage(counts.get(choice) ?? 0, total),
    })),
    auditReport: "/docs/ELECTION-SNAPSHOT-AUDIT.md",
    limitations: [
      "Balance snapshots cannot prove common ownership or intent.",
      "MEXC off-chain holdings are outside the repository corpus.",
      "Identical balances and exact offsetting changes are review flags, not findings of manipulation.",
    ],
  });
}
