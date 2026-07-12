import { createContext, useContext, useState, type ReactNode } from 'react'

interface CartContextValue {
  quantities: Record<string, number>
  supplierChoice: Record<string, string>
  setQty: (productId: string, qty: number) => void
  setSupplierChoice: (productId: string, supplierId: string) => void
  clearCart: () => void
  itemCount: number
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [supplierChoice, setSupplierChoiceState] = useState<Record<string, string>>({})

  function setQty(productId: string, qty: number) {
    setQuantities((q) => {
      const next = { ...q }
      if (qty > 0) next[productId] = qty
      else delete next[productId]
      return next
    })
  }

  function setSupplierChoice(productId: string, supplierId: string) {
    setSupplierChoiceState((s) => ({ ...s, [productId]: supplierId }))
  }

  function clearCart() {
    setQuantities({})
    setSupplierChoiceState({})
  }

  const itemCount = Object.keys(quantities).length

  return (
    <CartContext.Provider value={{ quantities, supplierChoice, setQty, setSupplierChoice, clearCart, itemCount }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
