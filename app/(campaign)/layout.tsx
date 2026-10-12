/**
 * Campaign landing pages, in the public shell but outside `(rift)`.
 *
 * Only because of `(rift)/loading.tsx`. That boundary starts streaming a 200
 * before the page runs, so an unpublished or mistyped `/c/<slug>` answered
 * "That page does not exist." with status 200, which a crawler or a link
 * checker reads as a live page. Out here nothing streams before `notFound()`,
 * and the status is the 404 the page says it is. The shell, the error page
 * and the share card are the public ones, not copies.
 */
export { default, metadata } from "../(rift)/layout";
