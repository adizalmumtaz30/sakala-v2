import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "app", "(shell)", "akademik", "AkademikWorkspace.tsx");
const source = fs.readFileSync(file, "utf8");

const fixes = [
  ["{/* Bagian 8.1 / 78 — School Profile */", "{/* Bagian 8.1 / 78 — School Profile */}"],
  ["{/* Bagian 8.2 / 77 — Active Academic Context */", "{/* Bagian 8.2 / 77 — Active Academic Context */}"],
];

let next = source;
for (const [broken, fixed] of fixes) next = next.split(broken).join(fixed);

if (next === source) {
  console.log("B-03 source check: no repair needed");
} else {
  fs.writeFileSync(file, next, "utf8");
  console.log("B-03 source repair: fixed malformed JSX comments in AkademikWorkspace.tsx");
}

const verify = fs.readFileSync(file, "utf8");
for (const [, fixed] of fixes) {
  if (!verify.includes(fixed)) throw new Error(`B-03 verification failed: ${fixed}`);
}
console.log("B-03 source verification: PASS");
