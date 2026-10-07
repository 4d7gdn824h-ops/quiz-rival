import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-md px-4 py-6 text-center text-sm text-white/45">
      <Link className="underline decoration-white/30 underline-offset-4" href="/privacy">
        Privacy
      </Link>
      <span aria-hidden="true"> · </span>
      <Link className="underline decoration-white/30 underline-offset-4" href="/support">
        Support
      </Link>
    </footer>
  );
}
