// Fuzzy match sederhana untuk "Maksud Anda X?" — dipakai backend (parser
// perintah AI) dan client (pencarian kelas/mapel). Levenshtein distance,
// bukan NLP penuh — jujur soal keterbatasannya lewat threshold ketat, supaya
// tidak asal menyarankan sesuatu yang sebenarnya tidak mirip (§36).

export function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

/** Cari kandidat paling mirip dari daftar nama asli, dengan jarak relatif
 * terhadap panjang kata — supaya "informatik" bisa cocok ke "Informatika"
 * tapi "matematika" tidak salah nyasar ke "bahasa indonesia". */
export function findClosestMatch(input: string, candidates: string[], maxRelativeDistance = 0.35): string | null {
  const a = normalizeForMatch(input);
  if (!a) return null;
  let best: { name: string; distance: number } | null = null;
  for (const candidate of candidates) {
    const b = normalizeForMatch(candidate);
    const distance = levenshtein(a, b);
    const maxLen = Math.max(a.length, b.length);
    const relativeDistance = maxLen > 0 ? distance / maxLen : 1;
    if (relativeDistance <= maxRelativeDistance && (!best || distance < best.distance)) {
      best = { name: candidate, distance };
    }
  }
  return best?.name ?? null;
}
