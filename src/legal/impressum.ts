/*
 * Impressum (legal notice) — required under § 5 DDG for German operators.
 *
 * The operator details are injected at build time from the VITE_LEGAL_* env
 * vars (see legal-info.ts and .env.example) so the real address never lands in
 * the public repo. A ladungsfähige Anschrift — a real postal address where
 * legal mail can be served, no P.O. box — is mandatory; when the env vars are
 * unset the page renders obvious placeholders plus a draft notice.
 */
import "../style.css";
import "./legal.css";
import { draftNotice, esc, legalInfo } from "./legal-info";

const { name, street, city, country, email, phone } = legalInfo;

document.querySelector<HTMLElement>("#legal")!.innerHTML = `
  <h1>Impressum</h1>
  <p class="lead">Legal notice in accordance with § 5 DDG (Digitale-Dienste-Gesetz).</p>

  <h2>Angaben gemäß § 5 DDG</h2>
  <address>
    ${esc(name)}<br />
    ${esc(street)}<br />
    ${esc(city)}<br />
    ${esc(country)}
  </address>

  <h2>Kontakt / Contact</h2>
  <p>
    Email: <a href="mailto:${esc(email)}">${esc(email)}</a>
    ${phone ? `<br />Phone: ${esc(phone)}` : ""}
  </p>

  <h2>Verantwortlich für den Inhalt / Responsible for content</h2>
  <p>${esc(name)}, address as above.</p>

  <h2>Consumer dispute resolution</h2>
  <p>
    The EU Commission provides a platform for online dispute resolution (ODR):
    <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noreferrer">https://ec.europa.eu/consumers/odr</a>.
    We are neither obligated nor willing to participate in dispute resolution
    proceedings before a consumer arbitration board (§ 36 VSBG).
  </p>

  <hr />

  <h2>Liability for content</h2>
  <p>
    As a service provider we are responsible for our own content on these pages under the
    general laws (§ 7 (1) DDG). Under §§ 8 to 10 DDG, however, we are not obligated to monitor
    transmitted or stored third-party information, or to investigate circumstances that indicate
    illegal activity. Obligations to remove or block the use of information under the general
    laws remain unaffected. Liability in this regard is only possible from the point in time at
    which a concrete infringement of the law becomes known. Upon notification of such
    violations, we will remove the content immediately.
  </p>

  <h2>Liability for links</h2>
  <p>
    Our offer contains links to external third-party websites over whose content we have no
    influence. Therefore we cannot assume any liability for this external content. The
    respective provider or operator of the linked pages is always responsible for their content.
    The linked pages were checked for possible legal violations at the time of linking; no
    illegal content was discernible at that time. Should we become aware of any infringements,
    we will remove such links immediately.
  </p>

  <h2>Copyright</h2>
  <p>
    The content created by the operator on these pages is subject to German copyright law.
    Speed Cuben itself is open-source software, released under the MIT License; see the
    <a href="https://github.com/Blaxzter/speeden-and-cuben" target="_blank" rel="noreferrer">GitHub repository</a>
    for the licence terms. The cube rendering and algorithm engine are provided by
    <a href="https://js.cubing.net/cubing/" target="_blank" rel="noreferrer">cubing.js</a>,
    which runs entirely in your browser.
  </p>

  ${draftNotice()}
`;
