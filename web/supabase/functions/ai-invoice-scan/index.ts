// Chef Stock — AI invoice/delivery-note scanner.
//
// Replaces the legacy prototype's direct browser -> Anthropic call (which stored
// the API key in plaintext localStorage and sent it from the client). This
// function holds the key as a server-side secret; the client only ever talks
// to this endpoint.
//
// Deploy via the Supabase Dashboard: Edge Functions -> Create function ->
// name it "ai-invoice-scan" -> paste this file's contents -> Deploy.
// Then set the secret once: Project Settings -> Edge Functions -> Secrets ->
// add ANTHROPIC_API_KEY with your key from console.anthropic.com/settings/keys.

const DEFAULT_MODEL = 'claude-sonnet-5'
const DEFAULT_CATEGORIES = [
  'Légumes', 'Fruits', 'Herbes', 'Fromages', 'Crèmerie', 'Épicerie', 'Viandes', 'Poissons', 'Boissons', 'Boulangerie', 'Divers',
]
const DEFAULT_UNITS = [
  'kg', 'g', 'L', 'ml', 'pièce', 'sachet', 'colis', 'carton', 'boîte', 'pot', 'bouteille', 'barquette', 'plateau', 'pack',
]

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ScanImage {
  mediaType: string
  data: string
}

interface ScanRequest {
  images: ScanImage[]
  categories?: string[]
  units?: string[]
  model?: string
}

function buildPrompt(categories: string[], units: string[]) {
  return `Tu analyses la photo d'une facture, d'un bon de livraison ou d'une commande d'un fournisseur alimentaire, pour un restaurant.
Identifie le FOURNISSEUR et extrais chaque LIGNE DE PRODUIT.

IMPORTANT — format des nombres : ces factures françaises utilisent la VIRGULE comme séparateur décimal, pas le point.
"11,790" signifie 11,79 (onze euros soixante-dix-neuf), PAS onze mille sept cent quatre-vingt-dix. Convertis toujours vers un nombre décimal standard (point) dans le JSON, ex. 11.79.

Ignore : en-têtes, adresses, mentions légales, lignes de sous-total/total par rayon (ex. "*** CAVE Total : 70,74", "*** EPICERIE SECHE Total : ..."), TVA, et toute ligne de continuation sous un produit qui ne fait que préciser un code GTIN/lot/date de péremption (ce n'est pas un nouveau produit).
La colonne "Qté" (ou "Quantité") est la quantité commandée à utiliser — ne la confonds pas avec une colonne "Colisage" (nombre de colis/unités par carton) si les deux sont présentes.

Réponds STRICTEMENT en JSON sans texte ni balises :
{"supplierName":"nom du fournisseur ou null","products":[{"name":"nom court et propre en français","packaging":"conditionnement lu (ex. \\"Colis 5 kg\\") ou \\"\\"","unit":"unité de commande parmi (${units.join(', ')})","quantity": nombre ou 0,"unitPrice": prix unitaire HT (par unité de commande) en euros, nombre décimal (point) ou null si illisible,"category":"parmi (${categories.join(', ')})"}]}
Pour le prix : si seul un total de ligne est visible, calcule unitPrice = total ÷ quantity. N'invente jamais un prix non présent sur le document (mets null).
Nettoie les noms (ex. "TOMATE GRAPPE COLIS 5KG" -> name:"Tomates grappe", packaging:"Colis 5 kg", unit:"colis"). N'invente rien.`
}

function extractJson(text: string) {
  const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  const jsonStr = start >= 0 && end > start ? clean.slice(start, end + 1) : clean
  return JSON.parse(jsonStr)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Clé Anthropic non configurée côté serveur (secret ANTHROPIC_API_KEY manquant)." }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const body: ScanRequest = await req.json()
    if (!body.images || !body.images.length) {
      return new Response(JSON.stringify({ error: 'Aucune image envoyée.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const categories = body.categories?.length ? body.categories : DEFAULT_CATEGORIES
    const units = body.units?.length ? body.units : DEFAULT_UNITS
    const model = body.model || DEFAULT_MODEL

    const content = body.images.map((im) => ({
      type: 'image',
      source: { type: 'base64', media_type: im.mediaType, data: im.data },
    }))
    content.push({ type: 'text', text: buildPrompt(categories, units) } as unknown as (typeof content)[number])

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, max_tokens: 3000, messages: [{ role: 'user', content }] }),
    })

    if (!anthropicRes.ok) {
      let message = `HTTP ${anthropicRes.status}`
      try {
        const errBody = await anthropicRes.json()
        message = errBody?.error?.message || message
      } catch {
        // ignore parse failure, keep default message
      }
      return new Response(JSON.stringify({ error: message }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await anthropicRes.json()
    const text = (data.content || []).map((c: { type: string; text?: string }) => (c.type === 'text' ? c.text : '')).join('\n')

    let parsed: { supplierName?: string | null; products?: unknown[] } | unknown[]
    try {
      parsed = extractJson(text)
    } catch {
      return new Response(JSON.stringify({ error: "Réponse de l'IA illisible (JSON invalide)." }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const result = Array.isArray(parsed)
      ? { supplierName: null, products: parsed }
      : { supplierName: parsed.supplierName ?? null, products: parsed.products ?? [] }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
