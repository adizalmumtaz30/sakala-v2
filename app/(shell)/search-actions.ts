"use server";

import { createClient } from "@/lib/supabase/server";
import { globalSearch, type GlobalSearchResult } from "@/lib/application/globalSearch.usecases";

export async function globalSearchAction(query: string): Promise<GlobalSearchResult[]> {
  try {
    const supabase = await createClient();
    return await globalSearch(supabase, query);
  } catch {
    return [];
  }
}
