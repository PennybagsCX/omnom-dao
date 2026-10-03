"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { HelpCircle, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQ_SECTIONS } from "@/lib/faq-data";

const EASE = [0.22, 1, 0.36, 1] as const;


export default function FAQPage() {
  const [search, setSearch] = useState("");

  const filtered = FAQ_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        item.q.toLowerCase().includes(search.toLowerCase()) ||
        item.a.toLowerCase().includes(search.toLowerCase()),
    ),
  })).filter((section) => section.items.length > 0);

  const totalQuestions = FAQ_SECTIONS.reduce(
    (sum, s) => sum + s.items.length,
    0,
  );

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-20 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-gold/10 blur-[120px]"
      />

      <section className="mx-auto flex max-w-3xl flex-col items-center px-4 pt-16 pb-10 text-center sm:px-6 sm:pt-24 lg:px-8">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-bg-surface/80 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur"
        >
          <HelpCircle className="h-3.5 w-3.5 text-gold" aria-hidden />
          {totalQuestions} questions answered
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: EASE }}
          className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl"
        >
          Governance Guide & FAQ
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5, ease: EASE }}
          className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg"
        >
          Everything you need to know about $OMNOM DAO — how verification works,
          voting mechanics, thresholds, security measures, and known limitations.
          The complete, transparent guide to how governance operates.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
          className="mt-8 w-full max-w-md"
        >
          <input
            type="search"
            placeholder="Search questions..."
            aria-label="Search FAQ questions"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-surface/60 px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/50"
          />
        </motion.div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 pb-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {FAQ_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-surface/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
            >
              <section.icon className="h-3.5 w-3.5" aria-hidden />
              {section.title}
            </a>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 pb-20 sm:px-6 lg:px-8">
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <HelpCircle className="mx-auto h-12 w-12 text-text-dim" aria-hidden />
            <p className="mt-4 text-sm text-muted-foreground">
              No questions match &ldquo;{search}&rdquo;.
            </p>
          </div>
        ) : (
          filtered.map((section, sectionIdx) => (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: sectionIdx * 0.05, duration: 0.4, ease: EASE }}
              className="scroll-mt-24 border-t border-border/60 py-10 first:border-t-0"
              id={section.id}
            >
              <div className="mb-6 flex items-center justify-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold">
                  <section.icon className="h-5 w-5" aria-hidden />
                </span>
                <h2 className="text-xl font-bold text-foreground sm:text-2xl">
                  {section.title}
                </h2>
              </div>

              <Accordion type="single" collapsible className="space-y-3">
                {section.items.map((item, idx) => (
                  <AccordionItem
                    key={`${section.id}-${idx}`}
                    value={`${section.id}-${idx}`}
                    className="overflow-hidden rounded-lg border border-border bg-bg-surface/40"
                  >
                    <AccordionTrigger className="px-5 py-4 text-left text-sm font-semibold text-foreground hover:no-underline hover:text-gold [&[data-state=open]]:text-gold">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="whitespace-pre-line px-5 pb-4 pt-0 text-sm leading-relaxed text-muted-foreground">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>
          ))
        )}
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 pb-24 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl border border-border bg-bg-surface p-8 text-center sm:p-12"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/10 blur-3xl"
          />
          <h2 className="text-2xl font-bold sm:text-3xl">Still have questions?</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Join the community on Telegram, or connect your wallet to start
            participating in governance.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/proposals">Browse Proposals</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a
                href="https://t.me/omnomtoken_dc"
                target="_blank"
                rel="noopener noreferrer"
              >
                Join Telegram
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            </Button>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
