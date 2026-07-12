import { useState } from 'react'
import { useSuppliers } from '../suppliers/useSuppliers'
import { useOpenOrders, useDeleteOrder, type OrderWithItems } from '../orders/useOrdersHistory'
import { useReconcileOrder } from './useReconcileOrder'
import { useProducts } from '../products/useProducts'
import { DEFAULT_CATEGORIES, allUnits } from '../products/useProducts'
import { useOrganization } from '../auth/useOrganization'
import { scanInvoiceImages, fileToBase64, type ScanResult } from '../../lib/aiScan'
import { similarity, SIM_ORDER } from '../../lib/similarity'

export function ReceptionPage() {
  const { data: openOrders } = useOpenOrders()
  const { data: suppliers } = useSuppliers()
  const { data: products } = useProducts()
  const { data: org } = useOrganization()
  const deleteOrder = useDeleteOrder()
  const reconcile = useReconcileOrder()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [delivered, setDelivered] = useState<Record<string, string>>({})
  const [showManual, setShowManual] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const selected = openOrders?.find((o) => o.id === selectedId) ?? null

  function selectOrder(o: OrderWithItems) {
    setSelectedId(o.id)
    setShowManual(false)
    setScanResult(null)
    setScanError(null)
    const initial: Record<string, string> = {}
    o.order_items.forEach((i) => (initial[i.id] = String(i.qty)))
    setDelivered(initial)
  }

  async function handleAnalyze(files: FileList | null) {
    if (!files?.length || !selected) return
    setScanning(true)
    setScanError(null)
    try {
      const images = await Promise.all([...files].map(fileToBase64))
      const units = allUnits(products, org?.units)
      const result = await scanInvoiceImages(images, { categories: DEFAULT_CATEGORIES, units })
      setScanResult(result)
      const next = { ...delivered }
      for (const item of selected.order_items) {
        const match = result.products.find((p) => similarity(p.name, item.name_snapshot) >= SIM_ORDER)
        if (match && match.quantity) next[item.id] = String(match.quantity)
      }
      setDelivered(next)
      setShowManual(true)
    } catch (err) {
      setScanError((err as Error).message)
    } finally {
      setScanning(false)
    }
  }

  async function handleValidate() {
    if (!selected) return
    setSaving(true)
    try {
      const deliveredByItemId: Record<string, number> = {}
      for (const [id, v] of Object.entries(delivered)) deliveredByItemId[id] = Number(v) || 0
      await reconcile.mutateAsync({ orderId: selected.id, deliveredByItemId, via: 'reconciled' })
      setSelectedId(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="top">
        <h2>Réceptionner une livraison</h2>
      </div>
      <div className="info">
        📸 Le fournisseur arrive ? Prenez une photo du bon de livraison ou de la facture : Chef Stock la compare à
        votre commande.
      </div>

      <div className="box">
        <div className="field">
          <label>Commande reçue</label>
          <div className="rowline" style={{ gap: 10, alignItems: 'stretch' }}>
            {openOrders?.length ? (
              openOrders.map((o) => {
                const supplier = suppliers?.find((s) => s.id === o.supplier_id)
                const active = selectedId === o.id
                return (
                  <div style={{ position: 'relative' }} key={o.id}>
                    <button
                      type="button"
                      className="btn secondary"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                        padding: '10px 14px',
                        borderRadius: 16,
                        minWidth: 78,
                        ...(active ? { borderColor: 'var(--g)', background: '#eaf3ef' } : {}),
                      }}
                      onClick={() => selectOrder(o)}
                    >
                      <span style={{ fontSize: 26, lineHeight: 1 }}>{supplier?.icon}</span>
                      <span style={{ fontWeight: 600, fontSize: 13, marginTop: 2 }}>{supplier?.name}</span>
                      <span className="small" style={{ fontSize: 11 }}>
                        {new Date(o.sent_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                      </span>
                    </button>
                    <button
                      type="button"
                      title="Supprimer cette commande"
                      style={{
                        position: 'absolute', top: -6, left: -6, background: '#fdf2f2', border: '1px solid #f0d3d3',
                        color: 'var(--danger)', borderRadius: '50%', width: 20, height: 20, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 'bold', padding: 0,
                      }}
                      onClick={() => {
                        if (confirm('Supprimer définitivement cette commande ?')) {
                          deleteOrder.mutate(o.id)
                          if (selectedId === o.id) setSelectedId(null)
                        }
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )
              })
            ) : (
              <div className="small">Aucune commande en attente de réception 🎉</div>
            )}
          </div>
        </div>

        {selected && (
          <>
            <div className="dropzone">
              <div className="big">📄</div>
              <div className="small" style={{ marginTop: 2 }}>Photo du bon de livraison ou de la facture</div>
              <input
                type="file"
                accept="image/*"
                multiple
                id="recepPhotoInput"
                className="vhide"
                onChange={(e) => handleAnalyze(e.target.files)}
              />
              <label htmlFor="recepPhotoInput" className="upload" style={{ marginTop: 8, display: 'inline-block' }}>
                {scanning ? 'Lecture en cours…' : '📁 Choisir une photo'}
              </label>
            </div>
            {scanError && <div className="notice">{scanError}</div>}
            {scanResult && (
              <div className="doccard">
                <div>
                  <b>{scanResult.supplierName ?? 'Bon de livraison'}</b>
                  <div className="small">{scanResult.products.length} ligne(s) lue(s)</div>
                </div>
                <span className="pill okp">✓ lu</span>
              </div>
            )}
            <div className="actionrow">
              <button className="btn secondary" onClick={() => setShowManual(true)}>
                ✍️ Saisir sans photo
              </button>
            </div>
          </>
        )}
      </div>

      {selected && showManual && (
        <div className="box" style={{ marginTop: 14 }}>
          <h3 style={{ marginTop: 0 }}>Quantités reçues</h3>
          <table className="comparetable">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Commandé</th>
                <th>Reçu</th>
              </tr>
            </thead>
            <tbody>
              {selected.order_items.map((item) => {
                const delta = Number(delivered[item.id]) !== item.qty
                return (
                  <tr key={item.id}>
                    <td>{item.name_snapshot}</td>
                    <td>
                      {item.qty} {item.unit}
                    </td>
                    <td>
                      <input
                        value={delivered[item.id] ?? ''}
                        onChange={(e) => setDelivered((d) => ({ ...d, [item.id]: e.target.value }))}
                        className={delta ? 'pending' : ''}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="actionrow">
            <button className="btn primary" onClick={handleValidate} disabled={saving}>
              {saving ? '…' : '✅ Valider la réception'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
