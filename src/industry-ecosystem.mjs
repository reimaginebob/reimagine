// Industry Insider ecosystem view (2026-09-10) -- Category -> Role -> Company
// exploration that replaces P.p4's role-suggestion step for the Industry
// Insider lane only. See Output/handoff/2026-09-10_industry-ecosystem-view.md.
//
// This module holds the two things that do not need App.jsx's JSX or its
// prompt builders: the fixed category list (single source of truth for both
// the prompt instructions and the render) and client-side, signature-keyed
// localStorage caches, modeled directly on job-search-resources.mjs's
// "Groups for This Path" cache (groupsSignatureFor / putGroups / getGroups):
// held in localStorage rather than profile_state on purpose (that store has
// both a known whole-blob clobber path and a 1MB cap that has already
// silently broken saves for an account), capped and evicted oldest-first.

// Fixed 7-category set, unchanged across every industry. An empty category
// still renders -- "not a factor in this industry" -- so this list is never
// filtered by what a given generation returns.
export const ECOSYSTEM_CATEGORIES = [
  { key: 'primary', label: 'Primary players' },
  { key: 'customers', label: 'Customers & channels' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'data', label: 'Data & measurement' },
  { key: 'consulting', label: 'Consulting & advisory' },
  { key: 'distribution', label: 'Distribution & brokers' },
  { key: 'adjacent', label: 'Adjacent industries' },
]
export const ECOSYSTEM_CATEGORY_KEYS = ECOSYSTEM_CATEGORIES.map(c => c.key)

// Cheap, deterministic fingerprint (djb2) of the personal brand text the
// categorization prompt is built from. Not a security hash -- just short and
// stable, so a rebuilt Personal Brand yields a different signature (fresh
// categories) and an unchanged one reuses the cache. Geography/role are
// irrelevant here (unlike Groups' signature) because the categorization runs
// before any role is picked.
export function ecosystemSignatureFor(o3) {
  const s = String(o3 || '')
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0
  return `${s.length}-${h.toString(36)}`
}

export const ECOSYSTEM_CATEGORY_STORAGE_KEY = 'reimagine_industry_ecosystem_categories_v1'
export const ECOSYSTEM_CATEGORY_MAX_SIGNATURES = 6

export function putEcosystemCategories(store, signature, categories) {
  const base = store && typeof store === 'object' ? { ...store } : {}
  base[signature] = { categories: categories && typeof categories === 'object' ? categories : {}, savedAt: new Date().toISOString() }
  const keys = Object.keys(base)
  if (keys.length > ECOSYSTEM_CATEGORY_MAX_SIGNATURES) {
    keys
      .sort((a, b) => String(base[a].savedAt || '').localeCompare(String(base[b].savedAt || '')))
      .slice(0, keys.length - ECOSYSTEM_CATEGORY_MAX_SIGNATURES)
      .forEach(k => { delete base[k] })
  }
  return base
}

export function getEcosystemCategories(store, signature) {
  if (!store || typeof store !== 'object' || !signature) return null
  const hit = store[signature]
  if (!hit || !hit.categories || typeof hit.categories !== 'object') return null
  return { categories: hit.categories, savedAt: typeof hit.savedAt === 'string' ? hit.savedAt : '' }
}

// Role-list cache, one signature per (ecosystem signature, category, refine
// text) triple -- a changed refine note is a deliberately different key, not
// an invalidation of the old one, so "Explore" on a category already viewed
// under a different refine still has its prior list available instantly.
export function ecosystemRoleSignatureFor(baseSignature, categoryKey, refine) {
  const norm = String(refine || '').toLowerCase().trim().replace(/\s+/g, ' ')
  return `${baseSignature || ''}|${categoryKey || ''}|${norm}`
}

export const ECOSYSTEM_ROLES_STORAGE_KEY = 'reimagine_industry_ecosystem_roles_v1'
export const ECOSYSTEM_ROLES_MAX_SIGNATURES = 18

export function putEcosystemRoles(store, signature, roles) {
  const base = store && typeof store === 'object' ? { ...store } : {}
  base[signature] = { roles: Array.isArray(roles) ? roles : [], savedAt: new Date().toISOString() }
  const keys = Object.keys(base)
  if (keys.length > ECOSYSTEM_ROLES_MAX_SIGNATURES) {
    keys
      .sort((a, b) => String(base[a].savedAt || '').localeCompare(String(base[b].savedAt || '')))
      .slice(0, keys.length - ECOSYSTEM_ROLES_MAX_SIGNATURES)
      .forEach(k => { delete base[k] })
  }
  return base
}

export function getEcosystemRoles(store, signature) {
  if (!store || typeof store !== 'object' || !signature) return null
  const hit = store[signature]
  if (!hit || !Array.isArray(hit.roles)) return null
  return { roles: hit.roles, savedAt: typeof hit.savedAt === 'string' ? hit.savedAt : '' }
}
