/** Always visible. Not dismissable. Colors come from --banner-* in globals.css. */
export function PracticeBanner() {
  return (
    <p className="practice-banner" role="note" data-practice-banner="true">
      Practice mode: for studying and review, not for submitting as homework.
    </p>
  );
}
