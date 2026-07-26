import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const USERNAME_EMAIL_DOMAIN = "users.ticketty.local";

export type AppRole =
  | "owner"
  | "manager"
  | "cashier"
  | "accountant"
  | "supervisor"
  | "broker"
  | "inspector";

type CreateEmployeeInput = {
  username: string;
  password: string;
  full_name: string;
  phone?: string | null;
  branch_id: string;
  role: AppRole;
};

function validate(input: unknown): CreateEmployeeInput {
  const v = input as Partial<CreateEmployeeInput>;
  if (!v || typeof v !== "object") throw new Error("Invalid input");
  const username = String(v.username ?? "").trim().toLowerCase();
  const password = String(v.password ?? "");
  const full_name = String(v.full_name ?? "").trim();
  const branch_id = String(v.branch_id ?? "");
  const role = String(v.role ?? "") as AppRole;
  if (!/^[a-z0-9._-]{3,32}$/.test(username))
    throw new Error("اسم المستخدم يجب أن يكون 3-32 حرفاً (أحرف إنجليزية/أرقام/._-)");
  if (password.length < 6) throw new Error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
  if (!full_name) throw new Error("الاسم الكامل مطلوب");
  if (!branch_id) throw new Error("الفرع مطلوب");
  const allowed: AppRole[] = ["manager", "cashier", "accountant", "supervisor", "broker", "inspector"];
  if (!allowed.includes(role)) throw new Error("الدور غير صالح");
  return { username, password, full_name, phone: v.phone ? String(v.phone) : null, branch_id, role };
}

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Caller must be an owner (or manager) of an agency
    const { data: callerProfile, error: cpErr } = await supabase
      .from("profiles")
      .select("agency_id")
      .eq("id", userId)
      .maybeSingle();
    if (cpErr || !callerProfile?.agency_id) throw new Error("لا توجد وكالة مرتبطة بحسابك");
    const agencyId = callerProfile.agency_id;

    const { data: isOwner } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
    const { data: isManager } = await supabase.rpc("has_role", { _user_id: userId, _role: "manager" });
    if (!isOwner && !isManager) throw new Error("ليس لديك صلاحية لإضافة موظفين");

    // Verify branch belongs to agency
    const { data: branch, error: brErr } = await supabase
      .from("branches")
      .select("id, agency_id")
      .eq("id", data.branch_id)
      .maybeSingle();
    if (brErr || !branch || branch.agency_id !== agencyId) throw new Error("الفرع غير صالح");

    const email = `${data.username}@${USERNAME_EMAIL_DOMAIN}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Create the auth user (auto-confirmed so they can log in immediately)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, username: data.username },
    });
    if (createErr || !created?.user) {
      const msg = createErr?.message ?? "";
      if (msg.toLowerCase().includes("already")) throw new Error("اسم المستخدم مستخدم بالفعل");
      throw new Error(createErr?.message ?? "تعذّر إنشاء الحساب");
    }
    const newUserId = created.user.id;

    // The handle_new_user trigger may auto-create a profile/agency for this user.
    // Override to attach them to the caller's agency and branch.
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: newUserId,
          full_name: data.full_name,
          phone: data.phone,
          username: data.username,
          agency_id: agencyId,
          branch_id: data.branch_id,
        },
        { onConflict: "id" },
      );
    if (upErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error(upErr.message);
    }

    // Remove any auto-created "owner" role from the trigger and any auto-created empty agency
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    await supabaseAdmin.from("agencies").delete().eq("owner_id", newUserId);

    // Assign the requested role, scoped to the branch
    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: newUserId,
      role: data.role,
      agency_id: agencyId,
      branch_id: data.branch_id,
    });
    if (roleErr) throw new Error(roleErr.message);

    return { id: newUserId, username: data.username };
  });
