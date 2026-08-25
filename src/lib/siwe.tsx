/**
 * EIP-4361 (Sign-In with Ethereum) message builder (client-side).
 *
 * Produces a fully-compliant EIP-4361 message that hardware wallets (Ledger,
 * Trezor) and WC-connected wallets can parse correctly. The server's
 * `parseSiweMessage` (src/lib/auth.ts) extracts the fields it needs; any
 * extra EIP-4361 fields (URI, Version, Chain ID, Expiration Time) are
 * gracefully ignored if not explicitly parsed.
 *
 * Format:
 *   <domain> wants you to sign in with your Ethereum account:
 *   <address>
 *
 *   <statement>
 *
 *   URI: <uri>
 *   Version: 1
 *   Chain ID: <chainId>
 *   Nonce: <nonce>
 *   Issued At: <iso>
 *   Expiration Time: <iso+5min>
 */

export interface BuildSiweParams {
  address: string;
  nonce: string;
  issuedAt?: string;
  statement?: string;
  /** Expiration time in ISO format. Defaults to issuedAt + 5 minutes. */
  expirationTime?: string;
}

export const DEFAULT_SIWE_STATEMENT =
  "Sign in to $OMNOM DAO to verify your snapshot holdings. This request will not trigger a blockchain transaction or cost any gas fees.";

/** SIWE message expiration window (5 minutes, matching server-side skew check). */
const SIWE_EXPIRATION_MINUTES = 5;

/**
 * Build a fully-compliant EIP-4361 SIWE message.
 *
 * All fields required by EIP-4361 are included so that hardware wallets
 * (which validate the message structure) and WalletConnect bridges can
 * parse and display the signing request correctly.
 */
export function buildSiweMessage({
  address,
  nonce,
  issuedAt,
  statement = DEFAULT_SIWE_STATEMENT,
  expirationTime,
}: BuildSiweParams): string {
  const domain =
    typeof window !== "undefined" ? window.location.hostname : "localhost";
  const issued = issuedAt ?? new Date().toISOString();

  // URI: the full origin that requested signing (required by EIP-4361).
  const uri =
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000";

  // Expiration: issuedAt + 5 minutes (matches server-side skew tolerance).
  const issuedDate = new Date(issued);
  issuedDate.setMinutes(issuedDate.getMinutes() + SIWE_EXPIRATION_MINUTES);
  const expiration = expirationTime ?? issuedDate.toISOString();

  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    "",
    statement,
    "",
    `URI: ${uri}`,
    "Version: 1",
    "Chain ID: 1",
    `Nonce: ${nonce}`,
    `Issued At: ${issued}`,
    `Expiration Time: ${expiration}`,
  ].join("\n");
}
