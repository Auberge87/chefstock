import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProducts } from '../products/useProducts'
import { useSuppliers } from '../suppliers/useSuppliers'
import { useCart } from '../cart/CartContext'
import { pickSupplierFor } from '../cart/pickSupplier'
import { unitPrice } from '../../lib/pricing'
import { useOrderMutations, type CartLine } from './useOrderMutations'
import { useSavedDrafts, useSavedDraftMutations } from './useSavedDrafts'

export function CommandesPage() {
  const { data: products } = useProducts()
  const { data: suppliers } = useSuppliers()
  const { quantities, supplierChoice, clearCart, setQty, itemCount } = useCart()
  const { sendOrder } = useOrderMutations()
  const { data: drafts } = useSavedDrafts()
  const { create: createDraft, remove: removeDraft } = useSavedDraftMutations()
  const navigate = useNavigate()
  const [sendingSupplier, setSendingSupplier] = useState<string | null>(null)

  const groups = useMemo(() => {
    if (!products) return []
    const bySupplier = new Map<string, CartLine[]>()
    for (const [productId, qty] of Object.entries(quantities)) {
      if (qty <= 0) continue
      const product = products.find((p) => p.id === productId)
      if (!product) continue
      const supplierId = pickSupplierFor(product, supplierChoice)
      if (!supplierId) continue
      const line: CartLine = { product, qty, supplierId }
      if (!bySupplier.has(supplierId)) bySupplier.set(supplierId, [])
      bySupplier.get(supplierId)!.push(line)
    }
    return [...bySupplier.entries()].map(([supplierId, lines]) => ({
      supplier: suppliers?.find((s) => s.id === supplierId),
      supplierId,
      lines,
      total: lines.reduce((sum, l) => sum + l.qty * unitPrice(l.product), 0),
    }))
  }, [products, suppliers, quantities, supplierChoice])

  async function handleSend(supplierId: string, lines: CartLine[]) {
    setSendingSupplier(supplierId)
    try {
      await sendOrder.mutateAsync({ supplierId, lines })
      lines.forEach((l) => setQty(l.product.id, 0))
    } finally {
      setSendingSupplier(null)
    }
  }

  function handleDeleteCart() {
    if (!itemCount) {
      alert('Aucune commande en cours.')
      return
    }
    if (confirm('Êtes-vous sûr de vouloir supprimer cette commande ?')) clearCart()
  }

  function handleSaveDraft() {
    if (!itemCount) {
      alert('Aucune commande à enregistrer.')
      return
    }
    const def = 'Brouillon ' + new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    const name = prompt('Nom du brouillon :', def)
    if (name === null) return
    createDraft.mutate({ name: name.trim() || def, cart: { q: quantities, supplier: supplierChoice } })
    clearCart()
  }

  function handleResumeDraft(draftId: string) {
    const draft = drafts?.find((d) => d.id === draftId)
    if (!draft) return
    if (itemCount && !confirm('Une commande est déjà en cours. La remplacer par ce brouillon ?')) return
    clearCart()
    Object.entries(draft.cart.q ?? {}).forEach(([productId, qty]) => setQty(productId, qty))
    removeDraft.mutate(draftId)
    navigate('/products')
  }

  return (
    <div>
      <div className="top">
        <h2>Commandes préparées</h2>
      </div>

      {!!drafts?.length && (
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 17 }}>📝 Brouillons enregistrés</h3>
          <div className="list" style={{ marginBottom: 14 }}>
            {drafts.map((dr) => (
              <div className="order" key={dr.id} style={{ padding: 12 }}>
                <div className="rowline" style={{ justifyContent: 'space-between' }}>
                  <b>{dr.name}</b>
                  <span className="small">{new Date(dr.created_at).toLocaleString('fr-FR')}</span>
                </div>
                <div className="actionrow">
                  <button className="btn primary sm" onClick={() => handleResumeDraft(dr.id)}>
                    Reprendre
                  </button>
                  <button
                    className="btn secondary sm"
                    onClick={() => {
                      if (confirm(`Supprimer le brouillon « ${dr.name} » ?`)) removeDraft.mutate(dr.id)
                    }}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!groups.length && <div className="box">Aucune quantité sélectionnée pour le moment.</div>}

      {!!groups.length && (
        <>
          <div className="actionrow" style={{ marginBottom: 10 }}>
            <button className="btn secondary" onClick={handleSaveDraft}>
              💾 Enregistrer brouillon
            </button>
            <button className="btn danger" onClick={handleDeleteCart}>
              🗑 Supprimer la commande en cours
            </button>
          </div>
          {groups.map((g) => (
            <div className="order" key={g.supplierId}>
              <h3>
                {g.supplier?.icon} {g.supplier?.name}
              </h3>
              {g.supplier && g.supplier.min_order_amount > 0 && (
                <span className="pill">
                  {g.total >= g.supplier.min_order_amount ? '🟢' : '🔴'} {g.total.toFixed(2)}€ / {g.supplier.min_order_amount}€
                </span>
              )}
              <div className="ordertext">
                {g.lines.map((l) => `${l.product.name} : ${l.qty} ${l.product.unit}`).join('\n')}
              </div>
              <div className="actionrow">
                <button
                  className="btn primary"
                  disabled={sendingSupplier === g.supplierId}
                  onClick={() => handleSend(g.supplierId, g.lines)}
                >
                  {sendingSupplier === g.supplierId ? '…' : 'Envoyer'}
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
