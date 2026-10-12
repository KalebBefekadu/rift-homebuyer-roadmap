/**
 * Switzer and Zodiak, the product's two faces, in one place.
 *
 * The same Fontshare <link> was copied into five layouts, so changing the
 * weights, or self-hosting (the next step: it removes a third-party,
 * render-blocking request from every page), meant five edits that had to
 * agree. Switzer and Zodiak are not on Google Fonts, so next/font/google
 * cannot fetch them at build time the way it does Ethiopic.
 *
 * `preconnect` buys back the DNS lookup and TLS handshake on a cold
 * connection; it is only worth it on the public pages, where a stranger's
 * first impression is waiting on it.
 */
const HREF = "https://api.fontshare.com/v2/css?f%5B%5D=switzer@400,500,600,700&f%5B%5D=zodiak@300,400,500&display=swap";

export function Fonts({ preconnect = false }: { preconnect?: boolean }) {
  return (
    <>
      {preconnect ? (
        <>
          <link rel="preconnect" href="https://api.fontshare.com" />
          <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="" />
        </>
      ) : null}
      <link rel="stylesheet" href={HREF} />
    </>
  );
}
