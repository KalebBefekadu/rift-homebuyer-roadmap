import { notFound, redirect } from "next/navigation";
import { internalHidden } from "@/lib/core/internal";

/**
 * The layout above this refuses in production too, but layout and page render
 * together and the order between them is not contracted. Without this check a
 * production visitor gets a 307 to `/prototype/kaleb` and only then the 404 —
 * which still ends in the right place, but advertises a route on the way.
 */
export default function Index() {
  if (internalHidden(process.env)) notFound();
  redirect("/prototype/kaleb");
}
