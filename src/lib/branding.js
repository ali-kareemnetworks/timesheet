import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// No auth required to read this — company_settings allows public SELECT
// so the logo shows up on the sign-in page before anyone's logged in.
export function useCompanyLogo() {
  const [logoUrl, setLogoUrl] = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    supabase.from('company_settings').select('logo_url').eq('id', 1).maybeSingle()
      .then(({ data }) => {
        if (!active) return
        setLogoUrl(data?.logo_url || null)
        setLoaded(true)
      })
    return () => { active = false }
  }, [])

  return { logoUrl, loaded }
}

// Pulls the storage object path back out of a public URL so the old
// logo file can be cleaned up when a new one is uploaded.
export function pathFromPublicUrl(url) {
  if (!url) return null
  const marker = '/branding/'
  const idx = url.indexOf(marker)
  return idx === -1 ? null : url.slice(idx + marker.length)
}
