import { supabase } from "../supabase.js"

export async function getFinanceData(schoolId) {
  const [schedulesResult, accountsResult, classesResult, termsResult] =
    await Promise.all([
      supabase
        .from("school_fee_items")
        .select("id,academic_term_id,class_id,name,amount,currency,due_on,created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("student_fee_accounts")
        .select("id,fee_item_id,student_id,amount_due,created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("school_classes")
        .select("id,name")
        .eq("school_id", schoolId),
      supabase
        .from("academic_terms")
        .select("id,name")
        .eq("school_id", schoolId),
    ])
  for (const result of [schedulesResult, accountsResult, classesResult, termsResult]) {
    if (result.error) throw result.error
  }

  const accountRows = accountsResult.data
  const accountIds = accountRows.map((account) => String(account.id))
  const studentIds = [...new Set(accountRows.map((account) => String(account.student_id)))]
  const feeItemIds = [...new Set(accountRows.map((account) => String(account.fee_item_id)))]
  const [paymentsResult, studentsResult, feeItemsResult] = await Promise.all([
    accountIds.length
      ? supabase
          .from("student_fee_payments")
          .select("id,fee_account_id,amount,method,reference,payment_date,created_at")
          .eq("school_id", schoolId)
          .in("fee_account_id", accountIds)
          .order("payment_date", { ascending: false })
          .limit(5000)
      : Promise.resolve({ data: [], error: null }),
    studentIds.length
      ? supabase
          .from("enrollments")
          .select("id,full_name")
          .eq("school_id", schoolId)
          .eq("role", "student")
          .in("id", studentIds)
      : Promise.resolve({ data: [], error: null }),
    feeItemIds.length
      ? supabase
          .from("school_fee_items")
          .select("id,name,currency,due_on,class_id,academic_term_id")
          .eq("school_id", schoolId)
          .in("id", feeItemIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  for (const result of [paymentsResult, studentsResult, feeItemsResult]) {
    if (result.error) throw result.error
  }

  const students = new Map(
    studentsResult.data.map((student) => [
      String(student.id),
      { id: String(student.id), fullName: student.full_name },
    ]),
  )
  const classes = new Map(classesResult.data.map((item) => [String(item.id), item.name]))
  const terms = new Map(termsResult.data.map((item) => [String(item.id), item.name]))
  const feeItems = new Map(feeItemsResult.data.map((item) => [String(item.id), item]))
  const paymentsByAccount = new Map()
  for (const row of paymentsResult.data) {
    const accountId = String(row.fee_account_id)
    const payments = paymentsByAccount.get(accountId) || []
    payments.push({
      id: String(row.id),
      amount: Number(row.amount),
      method: row.method,
      reference: row.reference,
      paidOn: row.payment_date,
      createdAt: row.created_at,
    })
    paymentsByAccount.set(accountId, payments)
  }

  return {
    schedules: schedulesResult.data.map((row) => ({
      id: String(row.id),
      name: row.name,
      amount: Number(row.amount),
      currency: row.currency,
      dueOn: row.due_on,
      active: true,
      classId: String(row.class_id),
      className: classes.get(String(row.class_id)) || "Class",
      termId: String(row.academic_term_id),
      termName: terms.get(String(row.academic_term_id)) || "Term",
      createdAt: row.created_at,
    })),
    invoices: accountRows.map((row) => {
      const feeItem = feeItems.get(String(row.fee_item_id))
      const payments = paymentsByAccount.get(String(row.id)) || []
      const paid = payments.reduce((sum, payment) => sum + payment.amount, 0)
      return {
        id: String(row.id),
        feeScheduleId: String(row.fee_item_id),
        feeName: feeItem?.name || "Fee",
        studentId: String(row.student_id),
        studentName: students.get(String(row.student_id))?.fullName || "Student record unavailable",
        amount: Number(row.amount_due),
        currency: feeItem?.currency || "NGN",
        dueOn: feeItem?.due_on || null,
        issuedAt: row.created_at,
        payments,
        paid,
        balance: Math.max(0, Number(row.amount_due) - paid),
      }
    }),
  }
}

export async function createFeeSchedule(schoolId, values) {
  const [classResult, termResult] = await Promise.all([
    supabase
      .from("school_classes")
      .select("id,academic_year_id")
      .eq("school_id", schoolId)
      .eq("id", values.classId)
      .maybeSingle(),
    supabase
      .from("academic_terms")
      .select("id,academic_year_id")
      .eq("school_id", schoolId)
      .eq("id", values.academicTermId)
      .maybeSingle(),
  ])
  if (classResult.error) throw classResult.error
  if (termResult.error) throw termResult.error
  if (!classResult.data || !termResult.data) return { error: "CLASS_OR_TERM_NOT_FOUND" }
  if (classResult.data.academic_year_id !== termResult.data.academic_year_id) {
    return { error: "CLASS_TERM_YEAR_MISMATCH" }
  }

  const { data, error } = await supabase
    .from("school_fee_items")
    .insert({
      school_id: schoolId,
      name: values.name,
      amount: values.amount,
      currency: values.currency,
      due_on: values.dueOn,
      class_id: values.classId,
      academic_term_id: values.academicTermId,
    })
    .select("id,name,amount,currency,due_on,class_id,academic_term_id,created_at")
    .single()
  if (error) throw error
  return {
    id: String(data.id),
    name: data.name,
    amount: Number(data.amount),
    currency: data.currency,
    dueOn: data.due_on,
    active: true,
    classId: String(data.class_id),
    termId: String(data.academic_term_id),
    createdAt: data.created_at,
  }
}

export async function createFeeInvoice(schoolId, feeScheduleId, studentId) {
  const [scheduleResult, studentResult] = await Promise.all([
    supabase
      .from("school_fee_items")
      .select("id,amount,class_id")
      .eq("school_id", schoolId)
      .eq("id", feeScheduleId)
      .maybeSingle(),
    supabase
      .from("enrollments")
      .select("id")
      .eq("school_id", schoolId)
      .eq("id", studentId)
      .eq("role", "student")
      .eq("status", "Active")
      .maybeSingle(),
  ])
  if (scheduleResult.error) throw scheduleResult.error
  if (studentResult.error) throw studentResult.error
  if (!scheduleResult.data) return { error: "FEE_SCHEDULE_NOT_FOUND" }
  if (!studentResult.data) return { error: "STUDENT_NOT_FOUND" }

  const { data: rosterEntry, error: rosterError } = await supabase
    .from("school_class_students")
    .select("student_id")
    .eq("school_id", schoolId)
    .eq("class_id", scheduleResult.data.class_id)
    .eq("student_id", studentId)
    .eq("is_active", true)
    .maybeSingle()
  if (rosterError) throw rosterError
  if (!rosterEntry) return { error: "STUDENT_NOT_IN_CLASS" }

  const { data, error } = await supabase
    .from("student_fee_accounts")
    .insert({
      school_id: schoolId,
      fee_item_id: scheduleResult.data.id,
      student_id: studentResult.data.id,
      amount_due: scheduleResult.data.amount,
    })
    .select("id,fee_item_id,student_id,amount_due,created_at")
    .single()
  if (error) throw error
  return {
    invoice: {
      id: String(data.id),
      feeScheduleId: String(data.fee_item_id),
      studentId: String(data.student_id),
      amount: Number(data.amount_due),
      issuedAt: data.created_at,
    },
  }
}

export async function recordFeePayment(schoolId, invoiceId, values) {
  const { data, error } = await supabase.rpc("record_school_fee_payment", {
    target_school_id: schoolId,
    target_fee_account_id: invoiceId,
    payment_amount: values.amount,
    payment_type: values.method,
    payment_reference: values.reference,
    payment_date: values.paidOn,
  })
  if (error) throw error
  return data
}
