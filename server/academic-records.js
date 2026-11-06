export function summarizeAttendance(records) {
  const totals = { present: 0, absent: 0, late: 0, excused: 0 }

  for (const record of records) totals[record.status] += 1

  const marked = totals.present + totals.absent + totals.late

  return {
    ...totals,

    marked,

    rate: marked
      ? Math.round(((totals.present + totals.late) / marked) * 1000) / 10
      : null,
  }
}

export function bestExamAttempts(exams, attempts) {
  const examsById = new Map(exams.map((exam) => [String(exam.id), exam]))
  const bestByStudentExam = new Map()

  for (const attempt of attempts) {
    const exam = examsById.get(String(attempt.exam_id))
    const maximumScore = Array.isArray(exam?.questions)
      ? exam.questions.length
      : 0
    const score = Number(attempt.score)

    if (
      attempt.status !== "submitted" ||
      !Number.isFinite(score) ||
      maximumScore <= 0
    ) {
      continue
    }

    const key = `${attempt.exam_id}:${attempt.student_id}`
    const current = bestByStudentExam.get(key)
    const higherScore =
      !current || score * current.maximumScore > current.score * maximumScore
    const sameScore =
      current && score * current.maximumScore === current.score * maximumScore
    const isLaterAttempt =
      sameScore &&
      String(attempt.end_time || "").localeCompare(
        String(current.submittedAt || ""),
      ) > 0

    if (higherScore || isLaterAttempt) {
      bestByStudentExam.set(key, {
        examId: String(attempt.exam_id),
        studentId: String(attempt.student_id),
        score,
        maximumScore,
        submittedAt: attempt.end_time,
      })
    }
  }

  return [...bestByStudentExam.values()]
}

export function rankStudents(students) {
  const ranked = students

    .filter(
      (student) =>
        (student.rankingPercentage ?? student.averagePercentage) !== null,
    )

    .sort(
      (a, b) =>
        (b.rankingPercentage ?? b.averagePercentage) -
          (a.rankingPercentage ?? a.averagePercentage) ||
        a.fullName.localeCompare(b.fullName),
    )

  let previousAverage = null

  let previousRank = 0

  for (let index = 0; index < ranked.length; index += 1) {
    const student = ranked[index]

    const rankingValue = student.rankingPercentage ?? student.averagePercentage

    if (rankingValue !== previousAverage) {
      previousRank = index + 1

      previousAverage = rankingValue
    }

    student.rank = previousRank
  }

  return students.sort((a, b) => {
    if (a.rank && b.rank)
      return a.rank - b.rank || a.fullName.localeCompare(b.fullName)

    if (a.rank) return -1

    if (b.rank) return 1

    return a.fullName.localeCompare(b.fullName)
  })
}
