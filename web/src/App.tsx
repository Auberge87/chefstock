import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './features/auth/AuthProvider'
import { SignIn } from './features/auth/SignIn'
import { SignUp } from './features/auth/SignUp'
import { ProtectedRoute } from './app/ProtectedRoute'
import { Layout } from './app/Layout'
import { Home } from './app/Home'
import { ComingSoon } from './app/ComingSoon'
import { SuppliersPage } from './features/suppliers/SuppliersPage'
import { ProductsManagePage } from './features/products/ProductsManagePage'
import { OnboardingPage } from './features/onboarding/OnboardingPage'
import { CartProvider } from './features/cart/CartContext'
import { OrderingPage } from './features/cart/OrderingPage'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<SignIn />} />
              <Route path="/signup" element={<SignUp />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/products" element={<OrderingPage />} />
                  <Route path="/manage" element={<ProductsManagePage />} />
                  <Route path="/orders" element={<ComingSoon title="Commandes préparées" />} />
                  <Route path="/history" element={<ComingSoon title="Historique" />} />
                  <Route path="/delivery" element={<ComingSoon title="Réceptionner une livraison" />} />
                  <Route path="/suppliers" element={<SuppliersPage />} />
                  <Route path="/analytics" element={<ComingSoon title="Analyses" />} />
                  <Route path="/alerts" element={<ComingSoon title="Alertes" />} />
                  <Route path="/inventory" element={<ComingSoon title="Stocks" />} />
                  <Route path="/settings" element={<ComingSoon title="Réglages" />} />
                  <Route path="/onboarding" element={<OnboardingPage />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
