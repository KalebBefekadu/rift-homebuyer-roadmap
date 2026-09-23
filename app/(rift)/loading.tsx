/**
 * The public funnel's loading state.
 *
 * Studio had one of these; the side a stranger uses did not. `/buy/results`,
 * `/sell/results` and `/abroad/results` are server-rendered on demand and read
 * the rate, the programme registry and the lead record before they can print
 * anything, each on a two-second deadline. Without this the reader gets a
 * blank page at precisely the moment the product is supposed to be delivering
 *, and a blank page is indistinguishable from a broken one, so the instinct
 * is to reload, which starts every read again.
 *
 * Deliberately a sentence rather than a spinner: it says what is happening,
 * which is the part a spinner leaves out.
 */
export default function RiftLoading() {
  return (
    <main className="shell-w sec">
      <p className="t-sm c-4">Working out your numbers…</p>
    </main>
  );
}
