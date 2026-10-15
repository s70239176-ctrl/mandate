// Print the evidence commitment for a public evidence page, using the SAME code the web app and the contract's rules use.
//   npm run fingerprint -- https://example.org/my-evidence page.md
// Paste the printed sha256 into the "Evidence fingerprint" box (or pass it as the third argument of propose).
import { fingerprintUrl } from "../src/lib/fingerprint.ts";

const url = process.argv[2];
if (!url || !/^https:\/\//.test(url)) {
  console.error("usage: npm run fingerprint -- https://<public evidence page url>");
  process.exit(2);
}
try {
  const fp = await fingerprintUrl(url);
  console.log(fp.hash);
  console.error(`(${fp.chars} characters of cleaned text committed; markup is stripped only from real HTML)`);
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
