const CENTS_PATTERN = /^(\d+)(?:[,.](\d{0,2}))?$/

export function parseEuroToCents(value: string): number {
  const normalized = value.trim().replace(/\s/g, '')
  const match = CENTS_PATTERN.exec(normalized)
  if (!match) throw new Error('Introduce un importe válido con hasta dos decimales.')

  const euros = Number(match[1])
  const fraction = (match[2] ?? '').padEnd(2, '0')
  const cents = euros * 100 + Number(fraction)
  assertMoneyCents(cents)
  if (cents <= 0) throw new Error('El importe debe ser mayor que cero.')
  return cents
}

export function assertMoneyCents(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error('El importe debe representarse en céntimos enteros seguros.')
  }
}

export function formatEuro(cents: number): string {
  assertMoneyCents(cents)
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}
