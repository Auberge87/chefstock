import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './features/auth/AuthProvider'
import { SignIn } from './features/auth/SignIn'
import { SignUp } from './features/auth/SignUp'
import { ProtectedRoute } from './app/ProtectedRoute'
import { Layout } from './app/Layout'
import { Home } from './app/Home'
import { SuppliersPage } from './features/suppliers/SuppliersPage'
import { ProductsManagePage } from './features/products/ProductsManagePage'
import { OnboardingPage } from './features/onboarding/OnboardingPage'
import { CartProvider } from './features/cart/CartContext'
import { OrderingPage } from './features/cart/OrderingPage'
import { CommandesPage } from './features/orders/CommandesPage'
import { HistoriquePage } from './features/orders/HistoriquePage'
import { SettingsPage } from './features/settings/SettingsPage'
import { InventoryPage } from './features/inventory/InventoryPage'
import { AlertsPage } from './features/alerts/AlertsPage'
import { AnalyticsPage } from './features/analytics/AnalyticsPage'
import { ReceptionPage } from './features/delivery/ReceptionPage'

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
                  <Route path="/orders" element={<CommandesPage />} />
                  <Route path="/history" element={<HistoriquePage />} />
                  <Route path="/delivery" element={<ReceptionPage />} />
                  <Route path="/suppliers" element={<SuppliersPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/alerts" element={<AlertsPage />} />
                  <Route path="/inventory" element={<InventoryPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
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
