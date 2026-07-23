import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAgencyId() {
  return useQuery({
    queryKey: ["agency-id"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("agency_id")
        .eq("id", userRes.user.id)
        .maybeSingle();
      return data?.agency_id ?? null;
    },
    staleTime: 5 * 60_000,
  });
}
