// Presentation layer (dipanggil dari API route, render server-side lewat @react-pdf/renderer).
// Bagian requirement "Export Universal" — PDF A4 siap cetak: header SAKALA + nama sekolah +
// periode + filter + timestamp + nomor halaman, footer, grid tidak terpotong, repeat header
// tiap halaman lanjutan, print-safe, empty-state tetap profesional (bukan error/disabled).

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export type PdfColumn = { key: string; label: string; width?: number };
export type PdfRow = Record<string, string | number | null | undefined>;

export interface ReportDocumentProps {
  title: string;
  schoolName?: string;
  periodLabel?: string;
  filterLabel?: string;
  generatedAt: string;
  landscape?: boolean;
  columns: PdfColumn[];
  rows: PdfRow[];
  emptyMessage?: string;
}

const BRAND = "#166534";
const INK = "#1f2937";
const MUTED = "#6b7280";
const BORDER = "#d1d5db";
const HEADER_BG = "#f3f4f6";

const styles = StyleSheet.create({
  page: {
    paddingTop: 118,
    paddingBottom: 44,
    paddingHorizontal: 28,
    fontSize: 8.5,
    fontFamily: "Helvetica",
    color: INK,
  },
  fixedHeader: {
    position: "absolute",
    top: 0,
    left: 28,
    right: 28,
  },
  brandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 1.5,
    borderBottomColor: BRAND,
    paddingBottom: 4,
    marginTop: 20,
  },
  brandText: { fontSize: 11, fontWeight: 700, color: BRAND },
  schoolText: { fontSize: 10, color: INK },
  titleText: { fontSize: 13, fontWeight: 700, marginTop: 6 },
  metaRow: { flexDirection: "row", marginTop: 3 },
  metaText: { fontSize: 8, color: MUTED },
  metaSep: { fontSize: 8, color: MUTED, marginHorizontal: 4 },
  timestampText: { fontSize: 7, color: MUTED, marginTop: 2 },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: HEADER_BG,
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 8,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontWeight: 700,
    color: INK,
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderRightWidth: 1,
    borderRightColor: BORDER,
  },
  bodyRow: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
  },
  bodyCell: {
    fontSize: 8,
    paddingVertical: 3.5,
    paddingHorizontal: 5,
    borderRightWidth: 1,
    borderRightColor: BORDER,
  },
  emptyBox: {
    borderWidth: 1,
    borderColor: BORDER,
    borderTopWidth: 0,
    paddingVertical: 22,
    alignItems: "center",
  },
  emptyText: { fontSize: 9, color: MUTED, fontStyle: "italic" },
  fixedFooter: {
    position: "absolute",
    bottom: 16,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 4,
  },
  footerText: { fontSize: 7, color: MUTED },
});

function widths(columns: PdfColumn[]) {
  const total = columns.reduce((sum, c) => sum + (c.width ?? 1), 0);
  return columns.map((c) => `${((c.width ?? 1) / total) * 100}%` as const);
}

export default function ReportDocument({
  title,
  schoolName,
  periodLabel,
  filterLabel,
  generatedAt,
  landscape = true,
  columns,
  rows,
  emptyMessage = "Belum ada data — dokumen tetap dibuat sesuai periode dan filter yang dipilih.",
}: ReportDocumentProps) {
  const colWidths = widths(columns);
  return (
    <Document title={title}>
      <Page size="A4" orientation={landscape ? "landscape" : "portrait"} style={styles.page} wrap>
        <View style={styles.fixedHeader} fixed>
          <View style={styles.brandRow}>
            <Text style={styles.brandText}>SAKALA</Text>
            {schoolName ? <Text style={styles.schoolText}>{schoolName}</Text> : null}
          </View>
          <Text style={styles.titleText}>{title}</Text>
          {(periodLabel || filterLabel) && (
            <View style={styles.metaRow}>
              {periodLabel ? <Text style={styles.metaText}>{periodLabel}</Text> : null}
              {periodLabel && filterLabel ? <Text style={styles.metaSep}>•</Text> : null}
              {filterLabel ? <Text style={styles.metaText}>{filterLabel}</Text> : null}
            </View>
          )}
          <Text style={styles.timestampText}>Dibuat {generatedAt}</Text>
          <View style={styles.tableHeaderRow}>
            {columns.map((c, i) => (
              <Text key={c.key} style={[styles.tableHeaderCell, { width: colWidths[i] }, i === columns.length - 1 ? { borderRightWidth: 0 } : {}]}>
                {c.label}
              </Text>
            ))}
          </View>
        </View>

        {rows.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{emptyMessage}</Text>
          </View>
        ) : (
          rows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.bodyRow} wrap={false}>
              {columns.map((c, i) => (
                <Text key={c.key} style={[styles.bodyCell, { width: colWidths[i] }, i === columns.length - 1 ? { borderRightWidth: 0 } : {}]}>
                  {String(row[c.key] ?? "-")}
                </Text>
              ))}
            </View>
          ))
        )}

        <View style={styles.fixedFooter} fixed>
          <Text style={styles.footerText}>SAKALA — Professional Academic Operating Workspace</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Halaman ${pageNumber} dari ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
