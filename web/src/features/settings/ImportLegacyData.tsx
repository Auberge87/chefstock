import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useOrganization } from '../auth/useOrganization'
import { useSuppliers } from '../suppliers/useSuppliers'
import { useProducts } from '../products/useProducts'
import { parseLegacyExport, summarizeLegacyExport, importLegacyData, type LegacyExport, type ImportResult } from './legacyImport'

type Step = 'idle' | 'preview' | 'importing' | 'done' | 'error'

export function ImportLegacyData() {
  const { data: org } = useOrganization()
  const { data: suppliers } = useSuppliers()
  const { data: products } = useProducts()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('idle')
  const [pending, setPending] = useState<LegacyExport | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const data = parseLegacyExport(text)
      setPending(data)
      setError(null)
      setStep('preview')
    } catch (err) {
      setError((err as Error).message)
      setStep('error')
    }
  }

  async function handleConfirm() {
    if (!org || !pending) return
    setStep('importing')
    try {
      const res = await importLegacyData(org.id, pending, suppliers ?? [], products ?? [])
      setResult(res)
      await queryClient.invalidateQueries()
      setStep('done')
    } catch (err) {
      setError((err as Error).message)
      setStep('error')
    }
  }

  function reset() {
    setStep('idle')
    setPending(null)
    setResult(null)
    setError(null)
  }

  const summary = pending ? summarizeLegacyExport(pending) : null

  return (
    <div className="box" style={{ marginTop: 14 }}>
      <h3 style={{ marginTop: 0 }}>Migration depuis l'ancienne version</h3>
      <p className="small">
        Importe tes fournisseurs, produits, historique de commandes, brouillons et stocks depuis un fichier exporté par
        l'ancienne version (bouton "💾 Exporter mes données" dans ses Réglages).
      </p>

      {step === 'idle' && (
        <div className="actionrow">
          <button className="btn secondary" onClick={() => fileInputRef.current?.click()}>
            📂 Choisir un fichier d'export
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleFile} />
        </div>
      )}

      {step === 'preview' && summary && (
        <div>
          <div className="small" style={{ marginBottom: 10 }}>
            Trouvé dans ce fichier : <strong>{summary.suppliers}</strong> fournisseurs, <strong>{summary.products}</strong>{' '}
            produits, <strong>{summary.orders}</strong> commandes, <strong>{summary.drafts}</strong> brouillons,{' '}
            <strong>{summary.inventoryRows}</strong> lignes de stock.
          </div>
          <p className="small">
            Les fournisseurs et produits déjà présents dans ton compte (même nom) ne seront pas dupliqués — seuls les
            éléments manquants seront créés.
          </p>
          <div className="actionrow">
            <button className="btn primary" onClick={handleConfirm}>
              ✅ Importer maintenant
            </button>
            <button className="btn secondary" onClick={reset}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {step === 'importing' && <div className="small">Import en cours…</div>}

      {step === 'done' && result && (
        <div>
          <div className="small" style={{ marginBottom: 10 }}>
            ✅ Import terminé : {result.suppliersCreated} fournisseurs créés ({result.suppliersMatched} déjà existants),{' '}
            {result.productsCreated} produits créés ({result.productsMatched} déjà existants), {result.ordersImported}{' '}
            commandes et {result.orderItemsImported} lignes de commande importées, {result.draftsImported} brouillons,{' '}
            {result.inventoryRowsImported} lignes de stock.
          </div>
          <button className="btn secondary" onClick={reset}>
            Importer un autre fichier
          </button>
        </div>
      )}

      {step === 'error' && (
        <div>
          <div className="small" style={{ color: 'var(--danger)', marginBottom: 10 }}>
            ❌ Erreur : {error}
          </div>
          <button className="btn secondary" onClick={reset}>
            Réessayer
          </button>
        </div>
      )}
    </div>
  )
}
