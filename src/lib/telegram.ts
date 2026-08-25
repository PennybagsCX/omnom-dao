/**
 * Telegram bot integration (GOVERNANCE_MECHANICS.md §14, TECHNICAL_ARCHITECTURE.md §4).
 *
 * Sends messages through the @DBOT_DC_BOT Telegram bot using the Bot API.
 * Bot token is read from NEXT_PUBLIC_TELEGRAM_BOT_TOKEN.
 *
 * CRITICAL: All Telegram operations are best-effort. Failures are caught and
 * logged — they MUST NEVER propagate to break a core governance operation
 * (proposal creation, voting, etc.). This is the "graceful degradation" rule.
 */

/** Telegram chat destination + message payload. */
export interface TelegramPayload {
  chatId: string;
  text: string;
  /** Optional: disable web page preview in the message. */
  disablePreview?: boolean;
}

/** Resolve the configured bot token (returns null if not configured). */
export function getTelegramBotToken(): string | null {
  return (
    process.env.TELEGRAM_BOT_TOKEN ??
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN ??
    null
  );
}

/** Whether Telegram delivery is configured at all. */
export function isTelegramConfigured(): boolean {
  return getTelegramBotToken() !== null;
}

/**
 * Send a message via the Telegram Bot API.
 *
 * Returns true on success, false on any failure. Never throws — callers can
 * invoke without try/catch and rely on the boolean return for logging.
 */
export async function sendTelegramMessage(payload: TelegramPayload): Promise<boolean> {
  const token = getTelegramBotToken();
  if (!token) {
    // Not configured — silently no-op (e.g. local dev without a bot).
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: payload.chatId,
        text: payload.text,
        parse_mode: "HTML",
        disable_web_page_preview: payload.disablePreview ?? true,
      }),
      // Telegram API is an external dependency — bound it.
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "<unreadable>");
      console.error(
        `[telegram] sendMessage failed (${res.status}) for chat ${payload.chatId}: ${body}`,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error(
      `[telegram] sendMessage threw for chat ${payload.chatId}:`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

/**
 * Send a notification to a single user identified by their Telegram chat id.
 * Best-effort: logs failures but never throws.
 */
export async function notifyUserTelegram(
  chatId: string,
  title: string,
  body: string,
): Promise<void> {
  const text = `<b>${escapeHtml(title)}</b>\n\n${escapeHtml(body)}`;
  await sendTelegramMessage({ chatId, text });
}

/** Minimal HTML escaper for Telegram messages (parse_mode = HTML). */
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
