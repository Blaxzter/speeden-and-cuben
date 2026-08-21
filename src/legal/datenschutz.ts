/*
 * Datenschutzerklärung (privacy policy) — Art. 13 GDPR / DSGVO.
 *
 * The text lives in `datenschutz.generated.html` (imported raw) so the output
 * of datenschutz-generator.de can be pasted straight in instead of being ported
 * to markup by hand. Personal data is NOT baked into that file — it uses
 * {{NAME}} / {{STREET}} / {{CITY}} / {{COUNTRY}} / {{EMAIL}} / {{PHONE}} tokens
 * filled at build time from the VITE_LEGAL_* env vars (see legal-info.ts and
 * .env.example), so the address stays out of the public repo.
 *
 * The HTML is our own authored content and no user input is involved, so
 * assigning it as innerHTML is safe here.
 */
import "../style.css";
import "./legal.css";
import { draftNotice, fillLegalTokens } from "./legal-info";
import rawHtml from "./datenschutz.generated.html?raw";

/** If a full HTML document was pasted, keep only the <body> contents. */
function bodyOf(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : html;
}

document.querySelector<HTMLElement>("#legal")!.innerHTML =
  fillLegalTokens(bodyOf(rawHtml)) + draftNotice();
