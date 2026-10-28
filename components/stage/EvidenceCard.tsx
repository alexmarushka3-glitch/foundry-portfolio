import type { Evidence } from "@/lib/evidence";

/** What a real run left behind: test results, the files written and one picture from the real browser. */
export default function EvidenceCard({ evidence, prNumber }: { evidence: Evidence; prNumber?: number }) {
  return (
    <section className="evidence" aria-label="What the real run produced">
      <h3>What the real run produced</h3>
      <dl>
        {evidence.unit && (
          <div>
            <dt>Sample app&apos;s unit tests</dt>
            <dd>{evidence.unit}</dd>
          </div>
        )}
        {evidence.browser && (
          <div>
            <dt>Real browser test</dt>
            <dd>{evidence.browser}</dd>
          </div>
        )}
        {evidence.files.length > 0 && (
          <div>
            <dt>Files written</dt>
            <dd>
              <ul>
                {evidence.files.map((f) => (
                  <li key={f}>
                    <code>{f}</code>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
      </dl>
      {evidence.shot && (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/png;base64,${evidence.shot.png}`} alt={`Real browser picture: ${evidence.shot.label}`} loading="lazy" />
          <figcaption>From the real browser: {evidence.shot.label}</figcaption>
        </figure>
      )}
      <p className="fine">
        Click any agent in the drawing to see its work.
        {prNumber === undefined && (
          <>
            {" "}
            <a href="https://github.com/alexmarushka3-glitch/taskly-sample/pull/8" target="_blank" rel="noreferrer">
              A real draft pull request from a live run
            </a>
            .
          </>
        )}
      </p>
    </section>
  );
}
