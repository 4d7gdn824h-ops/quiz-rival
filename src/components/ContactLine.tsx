import { CONTACT_EMAIL_PLACEHOLDER, OPERATOR_NAME_PLACEHOLDER } from "@/lib/site";

export function ContactLine() {
  return (
    <p className="text-sm leading-relaxed text-white/80">
      Contact {OPERATOR_NAME_PLACEHOLDER} at {CONTACT_EMAIL_PLACEHOLDER}.
    </p>
  );
}
