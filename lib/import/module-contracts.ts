export type ImportModule =
  | "guru"
  | "kelas"
  | "mata-pelajaran"
  | "ruang"
  | "jam-pelajaran"
  | "target-jp"
  | "jadwal"
  | "pembagian-mengajar";

export interface ImportModuleContract {
  key: ImportModule;
  label: string;
  templateFilename: string;
  requiredOnly: string[];
}

export const IMPORT_MODULE_CONTRACTS: Record<ImportModule, ImportModuleContract> = {
  guru: { key: "guru", label: "Guru", templateFilename: "Template_Guru_SAKALA_V2.3.xlsx", requiredOnly: ["NamaLengkap"] },
  kelas: { key: "kelas", label: "Kelas", templateFilename: "Template_Kelas_SAKALA_V2.3.xlsx", requiredOnly: ["NamaKelas", "Tingkat"] },
  "mata-pelajaran": { key: "mata-pelajaran", label: "Mata Pelajaran", templateFilename: "Template_Mata_Pelajaran_SAKALA_V2.3.xlsx", requiredOnly: ["NamaMataPelajaran"] },
  ruang: { key: "ruang", label: "Ruang", templateFilename: "Template_Ruang_SAKALA_V2.3.xlsx", requiredOnly: ["NamaRuang"] },
  "jam-pelajaran": { key: "jam-pelajaran", label: "Jam Pelajaran", templateFilename: "Template_Jam_Pelajaran_SAKALA_V2.3.xlsx", requiredOnly: ["AcademicContext", "Hari", "JamKe", "JamMulai", "JamSelesai"] },
  "target-jp": { key: "target-jp", label: "Target JP", templateFilename: "Template_Target_JP_SAKALA_V2.3.xlsx", requiredOnly: ["AcademicContext", "Kelas", "KodeMapel", "TargetJP"] },
  jadwal: { key: "jadwal", label: "Jadwal", templateFilename: "Template_Jadwal_SAKALA_V2.3.xlsx", requiredOnly: ["AcademicContext", "Hari", "JamKe", "Kelas", "MataPelajaran", "Guru", "Ruang"] },
  "pembagian-mengajar": { key: "pembagian-mengajar", label: "Pembagian Mengajar", templateFilename: "Template_Pembagian_Mengajar_SAKALA_V2.3.xlsx", requiredOnly: ["AcademicContext", "Guru", "Kelas", "MataPelajaran"] },
};

export function getImportModuleContract(module: ImportModule): ImportModuleContract {
  return IMPORT_MODULE_CONTRACTS[module];
}

export function isImportModule(value: string): value is ImportModule {
  return value in IMPORT_MODULE_CONTRACTS;
}
