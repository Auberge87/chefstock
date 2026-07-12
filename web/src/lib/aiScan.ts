import { supabase } from './supabaseClient'

export interface ScannedProduct {
  name: string
  packaging?: string
  unit?: string
  quantity?: number
  unitPrice?: number | null
  category?: string
}

export interface ScanResult {
  supplierName: string | null
  products: ScannedProduct[]
}

export async function scanInvoiceImages(
  images: { mediaType: string; data: string }[],
  opts?: { categories?: string[]; units?: string[] },
): Promise<ScanResult> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Non authentifié.')

  const functionsUrl = (import.meta.env.VITE_SUPABASE_URL as string).replace('.supabase.co', '.supabase.co/functions/v1')
  const res = await fetch(`${functionsUrl}/ai-invoice-scan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ images, categories: opts?.categories, units: opts?.units }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
  return body as ScanResult
}

export function fileToBase64(file: File): Promise<{ mediaType: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ mediaType: file.type || 'image/jpeg', data: String(reader.result).split(',')[1] })
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
