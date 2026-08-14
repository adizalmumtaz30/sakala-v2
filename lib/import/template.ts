// Generator template import resmi SAKALA (Bagian 19-21, 76): setiap template punya
// sheet DATA (tempat isi data), PETUNJUK (penjelasan kolom), REFERENSI (nilai valid).
// Server-only — dipakai oleh route.ts di masing-masing modul (Guru, Mapel, dst).

import * as XLSX from "xlsx";

export interface TemplateColumn {
  key: string;
  required: boolean;
  format: string;
  example: string;
}

export function buildTemplateWorkbook(
  columns: TemplateColumn[],
  referensiRows: string[][] = []
): Buffer {
  const workbook = XLSX.utils.book_new();

  // Sheet DATA — header + satu baris contoh yang boleh dihapus user.
  const dataHeader = columns.map((c) => c.key);
  const dataExample = columns.map((c) => c.example);
  const dataSheet = XLSX.utils.aoa_to_sheet([dataHeader, dataExample]);
  dataSheet["!cols"] = columns.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(workbook, dataSheet, "DATA");

  // Sheet PETUNJUK — nama kolom, wajib/opsional, format, contoh (Bagian 21).
  const petunjukRows = [
    ["Kolom", "Wajib / Opsional", "Format", "Contoh"],
    ...columns.map((c) => [c.key, c.required ? "Wajib" : "Opsional", c.format, c.example]),
  ];
  const petunjukSheet = XLSX.utils.aoa_to_sheet(petunjukRows);
  petunjukSheet["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 36 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(workbook, petunjukSheet, "PETUNJUK");

  // Sheet REFERENSI — data referensi untuk dropdown/validasi (Bagian 21).
  const referensiSheet = XLSX.utils.aoa_to_sheet(
    referensiRows.length > 0 ? referensiRows : [["Tidak ada referensi tambahan untuk template ini."]]
  );
  XLSX.utils.book_append_sheet(workbook, referensiSheet, "REFERENSI");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
