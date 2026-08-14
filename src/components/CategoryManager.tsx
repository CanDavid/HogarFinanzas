import { useState, type FormEvent } from 'react'
import type { Category, CategoryInput, CategoryKind } from '../domain/types'

export function CategoryManager({ categories, onCreate, onUpdate, onArchive, onRestore }: {
  categories: Category[]; onCreate(input: CategoryInput): Promise<void>; onUpdate(id: string, input: CategoryInput): Promise<void>; onArchive(id: string): Promise<void>; onRestore(id: string): Promise<void>
}) {
  const [editing, setEditing] = useState<Category | null>(null)
  return <section className="management"><div className="section-title"><h2>Categorías</h2><span>{categories.filter((item) => !item.archivedAt).length}</span></div>
    <CategoryForm key={editing?.id ?? 'new'} category={editing} onSave={async (input) => { if (editing) await onUpdate(editing.id, input); else await onCreate(input); setEditing(null) }} onCancel={editing ? () => setEditing(null) : undefined} />
    <ul>{categories.map((category) => <li key={category.id} className={category.archivedAt ? 'archived' : ''}>
      <button className="management-main" onClick={() => setEditing(category)}><strong>{category.icon} {category.name}</strong><small>{category.kind === 'expense' ? 'Gasto' : 'Ingreso'}</small></button>
      <button className={category.archivedAt ? 'restore' : 'delete'} onClick={() => void (category.archivedAt ? onRestore(category.id) : onArchive(category.id))}>{category.archivedAt ? 'Desarchivar' : 'Archivar'}</button>
    </li>)}</ul></section>
}

function CategoryForm({ category, onSave, onCancel }: { category: Category | null; onSave(input: CategoryInput): Promise<void>; onCancel?(): void }) {
  const [name, setName] = useState(category?.name ?? '')
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? 'expense')
  const [icon, setIcon] = useState(category?.icon ?? '●')
  const [error, setError] = useState('')
  async function submit(event: FormEvent) { event.preventDefault(); setError(''); try { await onSave({ name: name.trim(), kind, icon: icon.trim() }); if (!category) setName('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar.') } }
  return <form className="card compact-form" onSubmit={submit}><h2>{category ? 'Editar categoría' : 'Nueva categoría'}</h2>
    <div className="field-grid"><label>Icono<input value={icon} onChange={(event) => setIcon(event.target.value)} required maxLength={8} /></label><label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} /></label></div>
    <div className="segmented"><button type="button" aria-pressed={kind === 'expense'} onClick={() => setKind('expense')}>Gasto</button><button type="button" aria-pressed={kind === 'income'} onClick={() => setKind('income')}>Ingreso</button></div>
    {error && <p className="error">{error}</p>}<div className="form-actions">{onCancel && <button type="button" className="secondary" onClick={onCancel}>Cancelar</button>}<button>Guardar categoría</button></div>
  </form>
}
