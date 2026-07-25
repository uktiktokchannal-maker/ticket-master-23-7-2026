import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAgencyId } from "@/hooks/use-agency-id";

export type Branch = {
  id: string;
  agency_id: string;
  name: string;
  state: string | null;
  address: string | null;
  phone: string | null;
  is_main: boolean;
};

const STORAGE_KEY = "ticketty:active-branch";

function readStored(agencyId: string | null | undefined): string | null {
  if (!agencyId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed?.[agencyId] ?? null;
  } catch {
    return null;
  }
}

function writeStored(agencyId: string, branchId: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    parsed[agencyId] = branchId;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

export function useBranches() {
  const { data: agencyId } = useAgencyId();
  return useQuery({
    queryKey: ["branches", agencyId],
    queryFn: async () => {
      if (!agencyId) return [] as Branch[];
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .eq("agency_id", agencyId)
        .order("is_main", { ascending: false })
        .order("name");
      if (error) throw error;
      return (data ?? []) as Branch[];
    },
    enabled: !!agencyId,
    staleTime: 5 * 60_000,
  });
}

export function useActiveBranch() {
  const { data: agencyId } = useAgencyId();
  const { data: branches = [], isLoading } = useBranches();

  const { data: profile } = useQuery({
    queryKey: ["profile-branch"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, branch_id")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    staleTime: 5 * 60_000,
  });

  const { data: isOwner = false } = useQuery({
    queryKey: ["is-owner"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "owner")
        .maybeSingle();
      return !!data;
    },
    staleTime: 5 * 60_000,
  });

  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(null);

  // Resolve initial active branch:
  //  - non-owners: locked to profile.branch_id (or main branch as fallback)
  //  - owners: stored preference, else main branch, else first branch
  useEffect(() => {
    if (!agencyId || branches.length === 0) return;
    const main = branches.find((b) => b.is_main) ?? branches[0];
    if (!isOwner) {
      const locked = profile?.branch_id ?? main.id;
      setActiveBranchIdState(locked);
      return;
    }
    const stored = readStored(agencyId);
    const initial = stored && branches.some((b) => b.id === stored)
      ? stored
      : (profile?.branch_id && branches.some((b) => b.id === profile.branch_id)
          ? profile.branch_id
          : main.id);
    setActiveBranchIdState(initial);
  }, [agencyId, branches, isOwner, profile?.branch_id]);

  const setActiveBranchId = useCallback((id: string) => {
    if (!isOwner) return; // non-owners cannot switch
    if (!agencyId) return;
    writeStored(agencyId, id);
    setActiveBranchIdState(id);
  }, [agencyId, isOwner]);

  const activeBranch = branches.find((b) => b.id === activeBranchId) ?? null;

  return {
    branches,
    activeBranchId,
    activeBranch,
    setActiveBranchId,
    isOwner,
    isLoading,
    canSwitch: isOwner,
  };
}
