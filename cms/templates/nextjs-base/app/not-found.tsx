import Link from "next/link";

export default function NotFound() {
  return <div className="not-found-page">
    <section className="inner-hero"><div className="container not-found-content"><p className="eyebrow">Page not found</p><h1>Looks like this path led somewhere else.</h1><p>The page may have moved or the address may be incomplete. Let’s get you back to the help you were looking for.</p><div className="hero-actions"><Link className="button" href="/">Go to homepage <span aria-hidden="true">↗</span></Link><Link className="button button-outline" href="/services">Browse services</Link></div><Link className="text-link" href="/contact">Still need help? Contact our team <span aria-hidden="true">→</span></Link></div></section>
  </div>;
}
