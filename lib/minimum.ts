/**
 * The "bad-day minimum": DSA block (when the day has one) + exercise + enough total study minutes.
 * A day counts toward the streak when this is met.
 */
export type MinimumInput = {
  requiresDsa: boolean
  dsaDone: boolean
  exerciseDone: boolean
  studyMinutes: number
  minStudyMinutes: number
}
export function computeMinimum(i: MinimumInput) {
  const dsa = !i.requiresDsa || i.dsaDone
  const exercise = i.exerciseDone
  const hours = i.studyMinutes >= i.minStudyMinutes
  return { dsa, exercise, hours, met: dsa && exercise && hours }
}
