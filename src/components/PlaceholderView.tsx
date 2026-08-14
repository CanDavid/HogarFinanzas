export function PlaceholderView({ area, phase, description }: { area: string; phase: number; description: string }) {
  return <section className="placeholder-view card"><span className="placeholder-icon" aria-hidden="true">◇</span><h2>{area}</h2><p>{description}</p><small>Funcionalidad prevista para la Fase {phase}. La navegación ya está preparada, sin anticipar datos ni cálculos.</small></section>
}
