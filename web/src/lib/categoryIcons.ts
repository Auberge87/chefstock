// Emoji icons for product categories and misc. domain concepts — gives Chef Stock
// visual identity without needing uploaded images/logos.

const CATEGORY_ICONS: Record<string, string> = {
  'Légumes': '🥬',
  'Fruits': '🍎',
  'Herbes': '🌿',
  'Fromages': '🧀',
  'Crèmerie': '🥛',
  'Épicerie': '🫙',
  'Viandes': '🥩',
  'Poissons': '🐟',
  'Boissons': '🍷',
  'Boulangerie': '🥖',
  'Surgelés': '🧊',
  'Desserts': '🍰',
  'Divers': '📦',
}

// Keyword fallback for custom categories that don't exactly match the defaults above.
const KEYWORD_ICONS: [RegExp, string][] = [
  [/l[ée]gum/i, '🥬'],
  [/fruit/i, '🍎'],
  [/herbe|aromate/i, '🌿'],
  [/from/i, '🧀'],
  [/cr[eè]m|lait|yaourt|beurre/i, '🥛'],
  [/[ée]pic/i, '🫙'],
  [/viand|boucherie|volaille/i, '🥩'],
  [/poisson|marée|fruits de mer/i, '🐟'],
  [/boisson|vin|bière|cave/i, '🍷'],
  [/boulang|pain|pâtisserie/i, '🥖'],
  [/surgel/i, '🧊'],
  [/dessert|sucr/i, '🍰'],
  [/épice|condiment/i, '🧂'],
  [/huile/i, '🫒'],
]

export function categoryIcon(category: string | null | undefined): string {
  if (!category) return '📦'
  if (CATEGORY_ICONS[category]) return CATEGORY_ICONS[category]
  for (const [re, icon] of KEYWORD_ICONS) {
    if (re.test(category)) return icon
  }
  return '📦'
}

export const DOMAIN_ICONS = {
  supplier: '🚚',
  delivery: '📬',
  invoice: '📸',
  stats: '📊',
  alert: '🔔',
  priceUp: '📈',
  priceDown: '📉',
  stock: '📦',
  order: '📝',
  insight: '💡',
  money: '💶',
}
