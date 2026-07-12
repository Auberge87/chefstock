// Ported from Chef_Stock_V7_3.html — fuzzy name matching used for duplicate
// product detection and matching historical order item names back to products.

const COMBINING_DIACRITICS = new RegExp(
  '[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']',
  'g',
)

function singular(w: string): string {
  if (w.length > 4 && /aux$/.test(w)) return w.slice(0, -3) + 'al'
  if (w.length > 3 && /(s|x)$/.test(w)) return w.slice(0, -1)
  return w
}

export function normName(s: string | null | undefined): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(singular)
    .join(' ')
}

export function nameTokens(s: string | null | undefined): string[] {
  return normName(s).split(' ').filter(Boolean)
}

function levenshtein(a: string, b: string): number {
  a = a || ''
  b = b || ''
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  let cur = new Array<number>(n + 1)
  for (let i = 1; i <= m; i++) {
    cur[0] = i
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    ;[prev, cur] = [cur, prev]
  }
  return prev[n]
}

/** Returns a 0..1 similarity score combining token-overlap (Jaccard) and Levenshtein distance. */
export function similarity(a: string | null | undefined, b: string | null | undefined): number {
  const na = normName(a)
  const nb = normName(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const ta = new Set(nameTokens(a))
  const tb = new Set(nameTokens(b))
  const inter = [...ta].filter((x) => tb.has(x)).length
  const uni = new Set([...ta, ...tb]).size
  const jac = uni ? inter / uni : 0
  const L = Math.max(na.length, nb.length)
  const d = levenshtein(na, nb)
  const levSim = L ? 1 - d / L : 0
  return Math.max(jac, levSim)
}

export const SIM_KNOWN = 0.86
export const SIM_MAYBE = 0.66
export const SIM_ORDER = 0.8
export const SIM_SUPPLIER = 0.7
