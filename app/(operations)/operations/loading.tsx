import s from "./loading.module.css";

/**
 * Operations' loading state, for every page under it.
 *
 * Today makes seventeen database reads before it can render anything. Without
 * this, the agent gets a blank screen for that whole time and no way to tell a
 * slow query from a broken one, and the instinct on a blank screen is to
 * reload, which starts the reads again.
 *
 * It draws the shape of a page (title, a row of figures, a card) so the screen
 * does not jump when the page arrives, says in words that it is loading for a
 * screen reader, and holds still for anyone who asked for less motion.
 */
export default function OperationsLoading() {
  return (
    <main className="shell-w" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Loading this page</span>
      <span className={`${s.bar} ${s.title}`} />
      <span className={`${s.bar} ${s.lede}`} />
      <div className={s.stats} aria-hidden>
        {[0, 1, 2, 3].map((i) => <div key={i} className={s.stat}><span className={`${s.bar} ${s.line}`} style={{ width: "60%" }} /><span className={`${s.bar} ${s.line}`} style={{ width: 40, height: 22, marginTop: 14 }} /></div>)}
      </div>
      <div className={s.card} aria-hidden>
        {[90, 70, 80, 55].map((w, i) => <span key={i} className={`${s.bar} ${s.line}`} style={{ width: `${w}%` }} />)}
      </div>
    </main>
  );
}
