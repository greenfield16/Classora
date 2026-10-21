/** Shared four-statement scoring used by online submissions and scanned sheets. */
export function scoreTrueFalse(
  studentAnswers: boolean[],
  correctAnswers: boolean[],
  scoring: { correct1: number; correct2: number; correct3: number; correct4: number },
): number {
  const correct = studentAnswers.filter((a, i) => a === correctAnswers[i]).length
  if (correct === 4) return scoring.correct4
  if (correct === 3) return scoring.correct3
  if (correct === 2) return scoring.correct2
  if (correct === 1) return scoring.correct1
  return 0
}
