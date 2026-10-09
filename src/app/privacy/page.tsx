import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine } from "@/components/ContactLine";

export const metadata: Metadata = {
  title: "Privacy · QuizRival",
  description: "What QuizRival does with homework photos, PDFs, and pasted text.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-lime-300">
          For kids and grown-ups
        </p>
        <h1 className="font-display text-4xl">Privacy</h1>
        <p className="text-sm leading-relaxed text-white/70">
          This page uses plain words. It is written so a kid under 13 can read it with a
          parent.
        </p>
      </header>

      <section className="card space-y-3">
        <h2 className="font-display text-2xl">What you can send</h2>
        <p className="text-sm leading-relaxed text-white/75">
          You can send a homework photo, a PDF, or words you paste from the page. A display
          name is only for a room you choose to host, not for the scan.
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="font-display text-2xl">Who reads it</h2>
        <p className="text-sm leading-relaxed text-white/75">
          Our server sends that photo, PDF, or pasted text to an AI model from xAI. The
          model reads the worksheet so we can make a practice quiz. The reading happens on
          our server. Your phone does not talk to xAI by itself.
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="font-display text-2xl">We do not keep the upload</h2>
        <p className="text-sm leading-relaxed text-white/75">
          After we finish reading it, we do not save the photo, the PDF, or the pasted text.
          We do not put the file in a database. We do not keep a copy for later. This phone
          can hold the quiz until you close the tab, so you can still practice. Closing the
          tab clears that.
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="font-display text-2xl">No ads and no trackers</h2>
        <p className="text-sm leading-relaxed text-white/75">
          QuizRival does not show ads. We do not use other companies to track how you play.
          There is no third-party analytics.
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="font-display text-2xl">Questions</h2>
        <ContactLine />
      </section>

      <Link className="pb-2 text-center text-sm text-white/45 underline underline-offset-4" href="/">
        Back home
      </Link>
    </main>
  );
}
