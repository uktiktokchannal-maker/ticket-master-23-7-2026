import { Building2, Check, ChevronDown } from "lucide-react";
import { useActiveBranch } from "@/hooks/use-active-branch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function BranchSwitcher() {
  const { branches, activeBranch, activeBranchId, setActiveBranchId, canSwitch, isLoading } =
    useActiveBranch();

  if (isLoading || branches.length === 0) return null;

  const label = activeBranch?.name ?? "—";
  const badge = (
    <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground">
      <Building2 className="h-3.5 w-3.5 text-primary" />
      <span className="hidden sm:inline text-muted-foreground">الفرع:</span>
      <span className="max-w-[10rem] truncate">{label}</span>
    </span>
  );

  if (!canSwitch) return badge;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition"
          aria-label="تبديل الفرع"
        >
          <Building2 className="h-3.5 w-3.5 text-primary" />
          <span className="hidden sm:inline text-muted-foreground">الفرع:</span>
          <span className="max-w-[10rem] truncate">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel>اختر الفرع النشط</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {branches.map((b) => (
          <DropdownMenuItem
            key={b.id}
            onSelect={() => setActiveBranchId(b.id)}
            className="flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 opacity-70" />
              <span className="font-semibold">{b.name}</span>
              {b.is_main && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                  رئيسي
                </span>
              )}
            </span>
            {b.id === activeBranchId && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
