import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "owner"
  | "manager"
  | "cashier"
  | "accountant"
  | "supervisor"
  | "broker"
  | "inspector";

// Which top-level routes each role can see. Owner/manager see everything.
export const ROLE_ALLOWED_PATHS: Record<AppRole, string[] | "*"> = {
  owner: "*",
  manager: "*",
  cashier: ["/dashboard", "/pos", "/bookings", "/trips", "/manifest", "/shifts", "/notifications"],
  accountant: ["/dashboard", "/bookings", "/accounting", "/shifts", "/reports", "/branch-reports", "/notifications"],
  supervisor: ["/dashboard", "/bookings", "/trips", "/manifest", "/reports", "/branch-reports", "/notifications"],
  broker: ["/dashboard", "/pos", "/bookings", "/notifications"],
  inspector: ["/dashboard", "/manifest", "/bookings", "/trips", "/notifications"],
};

export function useMyRoles() {
  return useQuery({
    queryKey: ["my-roles"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return [] as AppRole[];
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userRes.user.id);
      return ((data ?? []).map((r) => r.role as AppRole));
    },
    staleTime: 5 * 60_000,
  });
}

export function useAllowedPaths() {
  const { data: roles = [], isLoading } = useMyRoles();
  if (isLoading) return { allowed: null as Set<string> | null, isLoading: true, roles };
  if (roles.length === 0) {
    // No role assigned — assume owner defaults will kick in via profile; allow all.
    return { allowed: null as Set<string> | null, isLoading: false, roles };
  }
  const set = new Set<string>();
  let all = false;
  for (const r of roles) {
    const rules = ROLE_ALLOWED_PATHS[r];
    if (rules === "*") { all = true; break; }
    if (rules) rules.forEach((p) => set.add(p));
  }
  return { allowed: all ? null : set, isLoading: false, roles };
}
