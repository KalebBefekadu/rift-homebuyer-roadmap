/**
 * Operations' loading state, for every page under it.
 *
 * The page makes six database reads before it can render anything. Without
 * this, the agent gets a blank screen for that whole time and no way to tell a
 * slow query from a broken one, and the instinct on a blank screen is to
 * reload, which starts the six reads again.
 */
export default function StudioLoading() {
  return (
    <main className="shell-w">
      <p className="t-sm c-4">Loading…</p>
    </main>
  );
}
