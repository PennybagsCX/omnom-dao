"use client";

import { memo, type ComponentPropsWithoutRef, type ElementType } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

interface MarkdownProps {
  /** Raw Markdown source. */
  children: string;
  className?: string;
}

/**
 * Dark-theme styled Markdown renderer.
 * Applies OMNOM typography to headings, lists, tables, code, blockquotes, and
 * links so proposal bodies and previews read consistently across the app.
 *
 * Memoized — re-render only fires when the source string identity changes.
 */
export const Markdown = memo(function Markdown({ children, className }: MarkdownProps) {
  return (
    <div
      className={cn(
        "max-w-none text-sm leading-relaxed text-muted-foreground",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={RENDERERS}
        urlTransform={safeUrlTransform}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});

/* ── Element renderers (theme-aligned) ──────────────────────────
 * Each factory forwards the standard HTML props react-markdown supplies to the
 * given intrinsic tag while merging in the theme classes (consumer className
 * still wins via `cn`). The renderers are gathered in a single object and
 * asserted to `Components` once — `Components` is a mapped type keyed by
 * specific tag names, so a per-key declaration would be noisier.
 */
type MdProps = ComponentPropsWithoutRef<"div">;

/**
 * Defense-in-depth URL sanitizer for markdown links/images. react-markdown
 * applies a safe default `urlTransform`, but we make the policy explicit so a
 * future config change cannot regress it. Only http(s), mailto, tel, and
 * relative URLs are permitted; `javascript:`, `data:`, `vbscript:`, etc. are
 * dropped.
 */
const SAFE_URL_RE = /^(https?:|mailto:|tel:|\/|\.\/|\.\.\/|#)/i;

function safeUrlTransform(url: string): string {
  const trimmed = (url ?? "").trim();
  if (trimmed === "") return "";
  return SAFE_URL_RE.test(trimmed) ? trimmed : "";
}

function make(tag: ElementType, classes: string) {
  const Tag = tag;
  return function RenderTag({ className, children, ...rest }: MdProps) {
    return (
      <Tag className={cn(classes, className)} {...rest}>
        {children}
      </Tag>
    );
  };
}

const RENDERERS = {
  h1: make("h1", "mt-6 mb-3 text-2xl font-bold text-foreground"),
  h2: make("h2", "mt-5 mb-2 text-xl font-bold text-foreground"),
  h3: make("h3", "mt-4 mb-2 text-lg font-semibold text-foreground"),
  h4: make("h4", "mt-3 mb-1.5 text-base font-semibold text-foreground"),
  p: make("p", "my-3 leading-relaxed"),
  a: make("a", "text-gold underline decoration-gold/40 underline-offset-2 hover:decoration-gold"),
  ul: make("ul", "my-3 list-disc space-y-1 pl-6 marker:text-gold"),
  ol: make("ol", "my-3 list-decimal space-y-1 pl-6 marker:text-gold"),
  li: make("li", "leading-relaxed"),
  blockquote: make("blockquote", "my-4 border-l-2 border-gold/40 bg-gold/5 px-4 py-2 italic text-muted-foreground"),
  hr: make("hr", "my-6 border-border"),
  code: make("code", "rounded bg-bg-elevated px-1.5 py-0.5 font-mono text-[0.85em] text-gold"),
  pre: make("pre", "my-4 overflow-x-auto rounded-lg border border-border bg-bg-deep p-4 text-xs"),
  table: make("table", "my-4 w-full border-collapse text-sm"),
  th: make("th", "border border-border bg-bg-elevated px-3 py-1.5 text-left font-semibold text-foreground"),
  td: make("td", "border border-border px-3 py-1.5"),
  strong: make("strong", "font-semibold text-foreground"),
} as unknown as Components;
