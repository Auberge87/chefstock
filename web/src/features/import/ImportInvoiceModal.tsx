import { useState } from 'react'
import { useSuppliers, useSupplierMutations } from '../suppliers/useSuppliers'
import { useProducts, useProductMutations, DEFAULT_CATEGORIES, allUnits } from '../products/useProducts'
import { useOrganization } from '../auth/useOrganization'
import { scanInvoiceImages, fileToBase64, type ScanResult } from '../../lib/aiScan'
import { similarity, SIM_KNOWN, SIM_SUPPLIER } from '../../lib/similarity'

const COMMON_ICONS = ['📦', '🥬', '🧀', '🥩', '🐟', '🍞', '🍷', '🧊']

interface ProductRow {
  selected: boolean
  name: string
  category: string
  unit: string
  packaging: string
  duplicateOf: string | null
}

export function ImportInvoiceModal({ onClose }: { onClose: () => void }) {
  const { data: org } = useOrganization()
  const { data: suppliers } = useSuppliers()
  const { data: products } = useProducts()
  const { create: createSupplier } = useSupplierMutations()
  const { create: createProduct } = useProductMutations()

  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)

  const [supplierMode, setSupplierMode] = useState<'existing' | 'new'>('new')
  const [existingSupplierId, setExistingSupplierId] = useState('')
  const [newSupplierName, setNewSupplierName] = useState('')
  const [newSupplierIcon, setNewSupplierIcon] = useState('📦')

  const [rows, setRows] = useState<ProductRow[]>([])
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ supplier: string; count: number } | null>(null)

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setScanning(true)
    setScanError(null)
    try {
      const images = await Promise.all([...files].map(fileToBase64))
      const units = allUnits(products, org?.units)
      const scan = await scanInvoiceImages(images, { categories: DEFAULT_CATEGORIES, units })
      setScanResult(scan)

      if (scan.supplierName && suppliers?.length) {
        const best = suppliers
          .map((s) => ({ s, sim: similarity(scan.supplierName, s.name) }))
          .sort((a, b) => b.sim - a.sim)[0]
        if (best && best.sim >= SIM_SUPPLIER) {
          setSupplierMode('existing')
          setExistingSupplierId(best.s.id)
        } else {
          setSupplierMode('new')
          setNewSupplierName(scan.supplierName)
        }
      } else if (scan.supplierName) {
        setSupplierMode('new')
        setNewSupplierName(scan.supplierName)
      }

      setRows(
        scan.products.map((p) => {
          const bestMatch = products
            ?.map((existing) => ({ existing, sim: similarity(p.name, existing.name) }))
            .sort((a, b) => b.sim - a.sim)[0]
          const isDup = !!bestMatch && bestMatch.sim >= SIM_KNOWN
          return {
            selected: !isDup,
            name: p.name,
            category: p.category || 'Divers',
            unit: p.unit || 'pièce',
            packaging: p.packaging || '',
            duplicateOf: isDup ? bestMatch!.existing.name : null,
          }
        }),
      )
    } catch (err) {
      setScanError((err as Error).message)
    } finally {
      setScanning(false)
    }
  }

  function updateRow(i: number, patch: Partial<ProductRow>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }

  async function handleConfirm() {
    setSaving(true)
    try {
      let supplierId = existingSupplierId
      let supplierLabel = suppliers?.find((s) => s.id === existingSupplierId)?.name ?? ''
      if (supplierMode === 'new') {
        if (!newSupplierName.trim()) {
          alert('Donnez un nom au fournisseur.')
          setSaving(false)
          return
        }
        supplierId = await createSupplier.mutateAsync({
          name: newSupplierName.trim(),
          icon: newSupplierIcon,
          ordering_method: 'email',
          min_order_amount: 100,
          delivery_days: [],
        })
        supplierLabel = newSupplierName.trim()
      }
      if (!supplierId) {
        alert('Choisissez un fournisseur.')
        setSaving(false)
        return
      }

      const toCreate = rows.filter((r) => r.selected)
      for (const row of toCreate) {
        await createProduct.mutateAsync({
          name: row.name,
          category: row.category,
          unit: row.unit,
          packaging: row.packaging || null,
          quick_quantities: [],
          estimated_price: 0,
          price_basis: 'unit',
          unit_weight_kg: 0,
          pieces_per_unit: 0,
          supplierIds: [supplierId],
        })
      }
      setResult({ supplier: supplierLabel, count: toCreate.length })
    } catch (err) {
      alert("Erreur lors de l'import : " + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (result) {
    return (
      <div className="modalbg show" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal">
          <h3>Import terminé ✓</h3>
          <p>
            Fournisseur : <b>{result.supplier}</b>
            <br />
            {result.count} produit(s) ajouté(s).
          </p>
          <div className="actionrow">
            <button className="btn primary" onClick={onClose}>
              Fermer
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modalbg show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>📸 Importer une facture / fournisseur</h3>
        <p className="small">
          Prenez une photo d'une facture, d'un bon de livraison ou d'un catalogue fournisseur : Chef Stock identifie
          le fournisseur et les produits, et vous n'avez plus qu'à valider.
        </p>

        {!scanResult && (
          <div className="dropzone">
            <div className="big">📄</div>
            <input
              type="file"
              accept="image/*"
              multiple
              id="importPhotoInput"
              className="vhide"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <label htmlFor="importPhotoInput" className="upload" style={{ marginTop: 8, display: 'inline-block' }}>
              {scanning ? 'Lecture en cours…' : '📁 Choisir une ou plusieurs photos'}
            </label>
          </div>
        )}
        {scanError && <div className="notice">{scanError}</div>}

        {scanResult && (
          <>
            <div className="field">
              <label>Fournisseur</label>
              <div className="segmented">
                <button className={supplierMode === 'existing' ? 'active' : ''} onClick={() => setSupplierMode('existing')}>
                  Fournisseur existant
                </button>
                <button className={supplierMode === 'new' ? 'active' : ''} onClick={() => setSupplierMode('new')}>
                  Nouveau fournisseur
                </button>
              </div>
              {supplierMode === 'existing' ? (
                <select value={existingSupplierId} onChange={(e) => setExistingSupplierId(e.target.value)}>
                  <option value="">Choisir…</option>
                  {suppliers?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.icon} {s.name}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <div className="choices" style={{ marginBottom: 8 }}>
                    {COMMON_ICONS.map((ic) => (
                      <button type="button" key={ic} className={newSupplierIcon === ic ? 'active' : ''} onClick={() => setNewSupplierIcon(ic)}>
                        {ic}
                      </button>
                    ))}
                  </div>
                  <input value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} placeholder="Nom du fournisseur" />
                </>
              )}
            </div>

            <div className="field">
              <label>Produits détectés ({rows.filter((r) => r.selected).length} sélectionné(s))</label>
              <div className="list" style={{ gap: 8 }}>
                {rows.map((row, i) => (
                  <div className="item" key={i} style={{ opacity: row.duplicateOf ? 0.7 : 1 }}>
                    <div className="mrow">
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                        <input type="checkbox" checked={row.selected} onChange={(e) => updateRow(i, { selected: e.target.checked })} />
                        <input
                          value={row.name}
                          onChange={(e) => updateRow(i, { name: e.target.value })}
                          style={{ fontWeight: 600, border: 'none', background: 'transparent', flex: 1, minWidth: 0 }}
                        />
                      </label>
                    </div>
                    {row.duplicateOf && (
                      <div className="small" style={{ color: 'var(--warn)' }}>
                        ⚠ Ressemble à « {row.duplicateOf} » — déjà dans votre catalogue
                      </div>
                    )}
                    <div className="prow">
                      <input value={row.category} onChange={(e) => updateRow(i, { category: e.target.value })} placeholder="Catégorie" />
                      <input value={row.unit} onChange={(e) => updateRow(i, { unit: e.target.value })} placeholder="Unité" />
                      <input value={row.packaging} onChange={(e) => updateRow(i, { packaging: e.target.value })} placeholder="Conditionnement" />
                    </div>
                  </div>
                ))}
                {!rows.length && <div className="small">Aucun produit détecté sur cette photo.</div>}
              </div>
            </div>
          </>
        )}

        <div className="actionrow">
          {scanResult && (
            <button className="btn primary" onClick={handleConfirm} disabled={saving}>
              {saving ? '…' : "✅ Confirmer l'import"}
            </button>
          )}
          <button className="btn secondary" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}
