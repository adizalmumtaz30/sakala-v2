import { redirect } from "next/navigation";

/**
 * Jadwal Cerdas remains an implementation capability, but its standalone
 * destination is consolidated into the unified /jadwal workspace.
 * The redirect preserves old bookmarks and existing navigation links.
 */
export default function JadwalCerdasPage() {
  redirect("/jadwal");
}
