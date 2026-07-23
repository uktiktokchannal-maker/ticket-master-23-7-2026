import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2, AlertCircle, Info, AlertTriangle, Loader2, CheckCheck, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAgencyId } from "@/hooks/use-agency-id";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

type Notification = {
  id: string;
  type: "info" | "success" | "warning" | "alert";
  title: string;
  description: string | null;
  read: boolean;
  created_at: string;
};

const TYPE_CONFIG: Record<string, { icon: typeof Bell; cls: string }> = {
  alert: { icon: AlertCircle, cls: "text-destructive bg-destructive/10" },
  warning: { icon: AlertTriangle, cls: "text-warning-foreground bg-warning/15" },
  success: { icon: CheckCircle2, cls: "text-success bg-success/10" },
  info: { icon: Info, cls: "text-primary bg-primary/10" },
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "الآن";
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} ساعة`;
  if (diff < 604800) return `قبل ${Math.floor(diff / 86400)} يوم`;
  return new Date(dateStr).toLocaleDateString("ar", { month: "short", day: "numeric" });
}

function NotificationsPage() {
  const qc = useQueryClient();
  const { data: agencyId } = useAgencyId();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Notification[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("realtime_notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => {
          qc.invalidateQueries({ queryKey: ["notifications"] });
          qc.invalidateQueries({ queryKey: ["unread-notifications-count"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!agencyId) throw new Error("لم يتم تحديد الوكالة");
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["unread-notifications-count"] });
      toast.success("تم تعيين الكل كمقروء");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markOneRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["unread-notifications-count"] });
    },
  });

  const deleteNotification = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["unread-notifications-count"] });
      toast.success("تم حذف التنبيه");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unreadCount = (notifications ?? []).filter((n) => !n.read).length;

  return (
    <div className="flex h-[calc(100vh-theme(spacing.20))] flex-col gap-6 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">النظام</p>
          <h1 className="font-display text-2xl font-extrabold text-foreground lg:text-3xl">
            التنبيهات
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            تابع آخر الإشعارات وتنبيهات النظام الخاصة بوكالتك.
            {unreadCount > 0 && (
              <span className="ms-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                {unreadCount} غير مقروء
              </span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending || unreadCount === 0}
        >
          <CheckCheck className="me-2 h-4 w-4" />
          تعيين الكل كمقروء
        </Button>
      </div>

      <div className="flex-1 overflow-auto rounded-2xl border border-border bg-card p-4 shadow-card lg:p-6">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !notifications || notifications.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Bell className="h-7 w-7" />
            </div>
            <p className="font-bold text-foreground">لا توجد تنبيهات</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              ستظهر هنا التنبيهات والإشعارات المتعلقة بنشاط وكالتك.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-3">
            <AnimatePresence>
              {notifications.map((note, idx) => {
                const config = TYPE_CONFIG[note.type] ?? TYPE_CONFIG.info;
                const Icon = config.icon;
                return (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20, height: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={note.id}
                    onClick={() => {
                      if (!note.read) markOneRead.mutate(note.id);
                    }}
                    className={`group flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-colors ${
                      !note.read
                        ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                        : "border-border bg-background hover:bg-muted/50"
                    }`}
                  >
                    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${config.cls}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3
                            className={`font-bold ${
                              !note.read ? "text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            {note.title}
                          </h3>
                          {note.description && (
                            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                              {note.description}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {timeAgo(note.created_at)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification.mutate(note.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      {!note.read && (
                        <div className="mt-2">
                          <span className="inline-flex h-2 w-2 rounded-full bg-primary" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
