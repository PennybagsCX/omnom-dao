/**
 * Emoji reactions — constants and types.
 *
 * Discord-style set of 8 emoji reactions available on proposals and comments.
 * Stored as canonical snake_case tokens (not raw Unicode glyphs) so that SQL
 * CHECK constraints, API payloads, and code paths all share a single source of
 * truth. The visible glyph mapping lives in `EMOJI_REACTIONS` below.
 */

export type EmojiKey =
  | "thumbs_up"
  | "heart"
  | "tada"
  | "smile"
  | "open_mouth"
  | "cry"
  | "thinking"
  | "thumbs_down";

export const EMOJI_KEYS: readonly EmojiKey[] = [
  "thumbs_up",
  "heart",
  "tada",
  "smile",
  "open_mouth",
  "cry",
  "thinking",
  "thumbs_down",
] as const;

export interface EmojiMeta {
  key: EmojiKey;
  glyph: string;
  label: string;
  ariaLabel: string;
}

export const EMOJI_REACTIONS: readonly EmojiMeta[] = [
  { key: "thumbs_up", glyph: "👍", label: "Thumbs up", ariaLabel: "React with thumbs up" },
  { key: "heart", glyph: "❤", label: "Heart", ariaLabel: "React with heart" },
  { key: "tada", glyph: "🎉", label: "Tada", ariaLabel: "React with tada" },
  { key: "smile", glyph: "😄", label: "Smile", ariaLabel: "React with smile" },
  { key: "open_mouth", glyph: "😮", label: "Open mouth", ariaLabel: "React with open mouth" },
  { key: "cry", glyph: "😢", label: "Cry", ariaLabel: "React with cry" },
  { key: "thinking", glyph: "🤔", label: "Thinking", ariaLabel: "React with thinking" },
  { key: "thumbs_down", glyph: "👎", label: "Thumbs down", ariaLabel: "React with thumbs down" },
] as const;

export const EMOJI_REACTIONS_MAP: Record<EmojiKey, EmojiMeta> = Object.fromEntries(
  EMOJI_REACTIONS.map((e) => [e.key, e]),
) as Record<EmojiKey, EmojiMeta>;

/** Per-emoji counts — always fully populated (zeros for unused emojis). */
export type EmojiReactionCounts = Record<EmojiKey, number>;

/** Returns a fresh zero-defaults counts object. */
export function emptyEmojiCounts(): EmojiReactionCounts {
  return {
    thumbs_up: 0,
    heart: 0,
    tada: 0,
    smile: 0,
    open_mouth: 0,
    cry: 0,
    thinking: 0,
    thumbs_down: 0,
  };
}

/** Returns true if the given string is a valid EmojiKey. */
export function isEmojiKey(value: unknown): value is EmojiKey {
  return typeof value === "string" && (EMOJI_KEYS as readonly string[]).includes(value);
}

/** Set used by SQL CHECK constraints and any DB validation logic. */
export const EMOJI_TOKENS_FOR_SQL = EMOJI_KEYS.map((k) => `'${k}'`).join(", ");