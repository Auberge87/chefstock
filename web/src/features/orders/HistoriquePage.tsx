import { useSuppliers } from '../suppliers/useSuppliers'
import { useOrdersHistory, useDeleteOrder } from './useOrdersHistory'

const STATUS_LABEL: Record<string, string> = { sent: 'Envoyée', received: 'Réceptionnée' }

export function HistoriquePage() {
  const { data: orders, isLoading } = useOrdersHistory()
  const { data: suppliers } = useSuppliers()
  const deleteOrder = useDeleteOrder()

  return (
    <div>
      <div className="top">
        <h2>Historique</h2>
      </div>
      {isLoading && <div className="small">Chargement…</div>}
      {!isLoading && !orders?.length && <div className="box">Aucune commande enregistrée.</div>}
      <div className="list">
        {orders?.map((o) => {
          const supplier = suppliers?.find((s) => s.id === o.supplier_id)
          return (
            <div className="order" key={o.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
                <h3 style={{ margin: 0 }}>
                  {supplier?.icon} {supplier?.name ?? 'Fournisseur'}
                </h3>
                <button
                  type="button"
                  className="icobtn d"
                  title="Supprimer la commande"
                  onClick={() => {
                    if (confirm(`Supprimer définitivement la commande ${supplier?.name ?? ''} du ${new Date(o.sent_at).toLocaleDateString('fr-FR')} ? Cette action est irréversible.`)) {
                      deleteOrder.mutate(o.id)
                    }
                  }}
                >
                  🗑
                </button>
              </div>
              <div className="small">
                {new Date(o.sent_at).toLocaleString('fr-FR')} · {o.delivery_label ?? ''}
              </div>
              <span className="pill">{STATUS_LABEL[o.status] ?? o.status}</span>
              <div className="ordertext">
                {o.order_items
                  .map(
                    (i) =>
                      `${i.name_snapshot}${i.packaging ? ' (' + i.packaging + ')' : ''} : ${i.qty} ${i.unit ?? ''}`,
                  )
                  .join('\n')}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
