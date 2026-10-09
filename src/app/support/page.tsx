import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine } from "@/components/ContactLine";

export const metadata: Metadata = {
  title: "Support · QuizRival",
  description: "How to make a room, how scan works, and why this is practice.",
};

export default function SupportPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-lime-300">
          Help
        </p>
        <h1 className="font-display text-4xl">Support</h1>
        <p className="text-sm leading-relaxed text-white/70">
          Short answers for playing QuizRival.
        </p>
      </header>

      <section className="card space-y-2">
        <h2 className="font-display text-2xl">How do I create a room?</h2>
        <p className="text-sm leading-relaxed text-white/75">
          Type a display name, then tap Create room. When two phones can
          connect, you get a 4-letter code. The other person types that code and taps Join
          room. The host taps Start. Each question has 25 seconds.
        </p>
        <p className="text-sm leading-relaxed text-white/75">
          If the room cannot connect, stay on one phone. Take turns (pass and play) or play
          a tiny path by yourself.
        </p>
      </section>

      <section className="card space-y-2">
        <h2 className="font-display text-2xl">How does scan work?</h2>
        <p className="text-sm leading-relaxed text-white/75">
          At the top of the home screen, add a homework photo, a PDF, or paste the page. You can also
          open a demo worksheet. The quiz starts on this phone. Nothing asks you to edit
          or approve topics. Create room, and its name field, stay separate from that.
        </p>
      </section>

      <section className="card space-y-2">
        <h2 className="font-display text-2xl">Does this help me cheat?</h2>
        <p className="text-sm leading-relaxed text-white/75">
          No. QuizRival is for practice. It does not write your homework for you, and it
          does not hand you the worksheet answers. Students never see answer keys during
          play. Keys stay on the parent screen.
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="font-display text-2xl">Still stuck?</h2>
        <ContactLine />
      </section>

      <Link className="pb-2 text-center text-sm text-white/45 underline underline-offset-4" href="/">
        Back home
      </Link>
    </main>
  );
}
