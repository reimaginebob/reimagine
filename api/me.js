import { getSessionUser } from './_lib/session.js'

export default async function handler(req, res) {
  const user = await getSessionUser(req)
  if (!user) return res.status(401).json({ user: null })
  return res.status(200).json({ user })
}
