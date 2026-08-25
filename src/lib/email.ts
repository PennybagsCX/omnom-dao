import { Resend } from "resend";

import { NotificationType } from "@/types";

/**
 * Email delivery via the Resend API (GOVERNANCE_MECHANICS.md §14,
 * TECHNICAL_ARCHITECTURE.md §4).
 *
 * CRITICAL: All email operations are best-effort. Failures are caught and
 * logged — they MUST NEVER propagate to break a core governance operation.
 * Resend is an optional channel; if RESEND_API_KEY is unset, this module
 * is a silent no-op.
 */

let client: Resend | null | undefined;

/** Lazily build the Resend client, or null if unconfigured. */
function getResend(): Resend | null {
  if (client !== undefined) return client;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    client = null;
    return null;
  }
  client = new Resend(apiKey);
  return client;
}

/** Whether email delivery is configured. */
export function isEmailConfigured(): boolean {
  return getResend() !== null;
}

/** Sender address for transactional governance emails. */
function getFromAddress(): string {
  return (
    process.env.RESEND_FROM_ADDRESS ??
    "OMNOM DAO <governance@omnom-dao.example>"
  );
}

/** Render an HTML email body for a notification type. */
export function renderEmailBody(
  type: NotificationType,
  title: string,
  body: string,
): string {
  const accent = accentColor(type);
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
  <h2 style="margin:0 0 8px;color:${accent}">${escapeHtml(title)}</h2>
  <p style="margin:0 0 16px;line-height:1.6;font-size:15px">${escapeHtml(body)}</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
  <p style="font-size:12px;color:#71717a">
    You received this email because email notifications are enabled in your OMNOM DAO settings.
    Visit the governance dashboard to manage your preferences.
  </p>
</div>`;
}

function accentColor(type: NotificationType): string {
  switch (type) {
    case NotificationType.PROPOSAL_CREATED:
      return "#6366f1";
    case NotificationType.VOTING_STARTED:
      return "#10b981";
    case NotificationType.VOTING_ENDING_SOON:
      return "#f59e0b";
    case NotificationType.PROPOSAL_RESULT:
      return "#0ea5e9";
    case NotificationType.MENTION:
      return "#8b5cf6";
    default:
      return "#0f172a";
  }
}

/** Send a transactional notification email. Best-effort, never throws. */
export async function sendNotificationEmail(
  to: string,
  type: NotificationType,
  title: string,
  body: string,
): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;

  try {
    const { error } = await resend.emails.send({
      from: getFromAddress(),
      to,
      subject: title,
      html: renderEmailBody(type, title, body),
    });
    if (error) {
      console.error(`[email] Resend returned error for ${to}:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(
      `[email] sendNotificationEmail threw for ${to}:`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

function escapeHtml(s: string): string {
  // Build HTML entities via concatenation so literal entity tokens are never
  // misinterpreted/stripped. Proper escaping prevents HTML injection (C3.1).
  const amp = "&" + "amp;";
  const lt = "&" + "lt;";
  const gt = "&" + "gt;";
  const quot = "&" + "quot;";
  const apos = "&" + "#39;";
  return s
    .replace(/&/g, amp)
    .replace(/</g, lt)
    .replace(/>/g, gt)
    .replace(/"/g, quot)
    .replace(/'/g, apos);
}
