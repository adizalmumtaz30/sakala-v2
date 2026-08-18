import { NextResponse } from "next/server";

type Column = { key: string; label: string };
type Row = Record<string, string | number | null | undefined>;

const esc = (value: unknown) => String(value ?? "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[\r\n]+/g, " ");
const textWidth = (value: string) => value.length * 5.2;

function makePdf(title: string, context: string, columns: Column[], rows: Row[], landscape: boolean) {
  const pageW = landscape ? 841.89 : 595.28;
  const pageH = landscape ? 595.28 : 841.89;
  const margin = 36;
  const usableW = pageW - margin * 2;
  const colW = usableW / Math.max(columns.length, 1);
  const lines: string[] = [];
  lines.push(title);
  if (context) lines.push(context);
  lines.push(rows.length ? "" : "Belum ada data — laporan tetap dibuat dengan struktur yang dipilih.");

  const maxChars = Math.max(12, Math.floor(colW / 5.2) - 2);
  const wrap = (v: unknown) => {
    const s = String(v ?? "");
    if (s.length <= maxChars) return [s];
    const out: string[] = [];
    for (let i = 0; i < s.length; i += maxChars) out.push(s.slice(i, i + maxChars));
    return out;
  };

  const table = [columns.map((c) => c.label), ...rows.map((r) => columns.map((c) => r[c.key] ?? ""))];
  for (const row of table) {
    const wrapped = row.map(wrap);
    const height = Math.max(...wrapped.map((x) => x.length));
    for (let line = 0; line < height; line++) lines.push(row.map((_, i) => wrapped[i][line] ?? "").join(" | "));
  }

  const pageLines = Math.max(1, Math.floor((pageH - 110) / 14));
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += pageLines) pages.push(lines.slice(i, i + pageLines));
  if (!pages.length) pages.push([]);

  const objects: string[] = [];
  const pageRefs: number[] = [];
  const fontRef = 3;
  const pagesRef = 2;
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  pages.forEach((page, index) => {
    const pageRef = 4 + index * 2;
    const contentRef = pageRef + 1;
    pageRefs.push(pageRef);
    const content: string[] = ["BT", "/F1 9 Tf", `${margin} ${pageH - margin - 18} Td`, "14 TL"];
    page.forEach((line, lineIndex) => {
      if (lineIndex > 0) content.push("T*");
      const fontSize = lineIndex === 0 ? 15 : lineIndex === 1 && context ? 9 : 8.5;
      content.push(`/F1 ${fontSize} Tf (${esc(line)}) Tj`);
    });
    content.push("ET");
    const stream = content.join("\n");
    objects.push(`<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 ${fontRef} 0 R >> >> /Contents ${contentRef} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`);
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = String(body.title ?? "Laporan SAKALA");
    const context = String(body.context ?? "");
    const columns = Array.isArray(body.columns) ? body.columns : [];
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const pdf = makePdf(title, context, columns, rows, Boolean(body.landscape));
    return new NextResponse(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${title.replace(/[^a-z0-9]+/gi, "-")}.pdf"` } });
  } catch {
    return NextResponse.json({ error: "PDF gagal dibuat" }, { status: 400 });
  }
}
