import Logo from "@/components/Logo";

// `main` carries the side gutter; `.section` resets it to 0, so the section has to sit inside, as on the home page.
export default function NotFound() {
  return (
    <main id="top">
      <section className="section">
        <Logo size={32} />
        <h1>Page not found</h1>
        <p className="lede">There is nothing at this address. The demo, the scope and limits, and my contact details are on the home page.</p>
        <p>
          <a className="btn btn-primary" href="/">
            Back to Foundry
          </a>
        </p>
      </section>
    </main>
  );
}
