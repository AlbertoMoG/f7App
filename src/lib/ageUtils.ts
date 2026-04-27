/**
 * Calcula la edad de una persona basándose en su fecha de nacimiento y una fecha de referencia.
 * @param birthDate Fecha de nacimiento en formato string.
 * @param referenceDate Fecha de referencia para el cálculo (por defecto hoy).
 * @returns Edad en años.
 */
export function calculateAge(birthDate: string, referenceDate: Date = new Date()): number {
  if (!birthDate) return 25;
  const birth = new Date(birthDate);
  let age = referenceDate.getFullYear() - birth.getFullYear();
  const m = referenceDate.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && referenceDate.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}
