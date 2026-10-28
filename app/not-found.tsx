import Logo from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="section" id="top">
      <Logo size={32} />
      <h1>Page not found</h1>
      <p className="lede">There is nothing at this address. The demo, the scope and limits, and my contact details are on the home page.</p>
      <p>
        <a className="btn btn-primary" href="/">
          Back to Foundry
        </a>
      </p>
    </main>
  );
}
