export type MainTab = 'home' | 'movements' | 'plan' | 'goals' | 'analysis'

const ITEMS: ReadonlyArray<{ id: MainTab; label: string; icon: string }> = [
  { id: 'home', label: 'Inicio', icon: '⌂' },
  { id: 'movements', label: 'Movimientos', icon: '↕' },
  { id: 'plan', label: 'Plan', icon: '▦' },
  { id: 'goals', label: 'Objetivos', icon: '◎' },
  { id: 'analysis', label: 'Análisis', icon: '⌁' },
]

export function BottomNavigation({ active, onSelect }: { active: MainTab; onSelect(tab: MainTab): void }) {
  return <nav className="bottom-nav" aria-label="Navegación principal">{ITEMS.map((item) => <button key={item.id}
    aria-current={active === item.id ? 'page' : undefined} onClick={() => onSelect(item.id)}>
    <span aria-hidden="true">{item.icon}</span><small>{item.label}</small>
  </button>)}</nav>
}
