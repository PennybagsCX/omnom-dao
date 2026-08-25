import { type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { apiSuccess } from "@/lib/api-response";

/**
 * GET /api/v1/tags
 *
 * Returns the most popular tags extracted from all proposals' metadata,
 * sorted by usage count (descending). Optionally filter by `?q=` for
 * autocomplete suggestions.
 *
 * Response: { tags: { name: string; count: number }[] }
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const query = url.searchParams.get("q")?.toLowerCase().trim() ?? "";

  // Fetch all proposal metadata to aggregate tags.
  const res = await db.execute({
    sql: "SELECT metadata FROM proposals",
    args: [],
  });

  const tagCounts = new Map<string, number>();

  for (const row of res.rows) {
    try {
      const meta = JSON.parse((row.metadata as string) || "{}");
      const tags: string[] = Array.isArray(meta.tags) ? meta.tags : [];
      for (const tag of tags) {
        const normalized = tag.toLowerCase().trim();
        if (!normalized) continue;
        tagCounts.set(normalized, (tagCounts.get(normalized) ?? 0) + 1);
      }
    } catch {
      // skip unparseable metadata
    }
  }

  let tags = Array.from(tagCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Filter by query if provided.
  if (query) {
    tags = tags.filter((t) => t.name.includes(query));
  }

  return apiSuccess<{ tags: { name: string; count: number }[] }>({ tags });
}
