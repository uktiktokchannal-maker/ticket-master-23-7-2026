/**
 * ترجمة أخطاء قاعدة البيانات إلى رسائل عربية مفهومة للمستخدم.
 */
const UNIQUE_MESSAGES: Array<[string, string]> = [
  ["bookings_active_seat_uniq", "هذا المقعد محجوز بالفعل في هذه الرحلة"],
  ["routes_agency_origin_dest_uniq", "هذا المسار مُسجّل مسبقاً"],
  ["drivers_agency_license_uniq", "رقم الرخصة مُسجّل لسائق آخر"],
  ["cashier_shifts_one_open_uniq", "لديك وردية مفتوحة بالفعل — أغلقها أولاً"],
  ["buses_agency_id_plate_number_key", "رقم اللوحة مُسجّل لحافلة أخرى"],
  ["buses_seat_count_positive", "عدد المقاعد يجب أن يكون 1 على الأقل"],
  ["profiles_username", "اسم المستخدم مستخدم بالفعل"],
];

export function dbErrorMessage(e: unknown): string {
  const raw =
    (e as { message?: string } | null)?.message ??
    (typeof e === "string" ? e : "") ??
    "";

  for (const [needle, msg] of UNIQUE_MESSAGES) {
    if (raw.includes(needle)) return msg;
  }

  if (raw.includes("violates foreign key constraint")) {
    return "لا يمكن إتمام العملية لارتباط هذا العنصر ببيانات أخرى";
  }
  if (raw.includes("duplicate key value")) {
    return "هذه البيانات مُسجّلة مسبقاً";
  }
  if (raw.includes("violates row-level security")) {
    return "ليست لديك صلاحية لتنفيذ هذه العملية";
  }
  if (raw.includes("violates check constraint")) {
    return "القيم المدخلة غير صالحة";
  }

  return raw || "حدث خطأ غير متوقع";
}
