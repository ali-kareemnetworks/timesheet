import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useCompanyLogo, pathFromPublicUrl } from '../../lib/branding.js'
import { Upload, Trash2 } from 'lucide-react'

const MAX_BYTES = 2 * 1024 * 1024 // 2MB

export default function Settings() {
  const { logoUrl, loaded } = useCompanyLogo()
  const [currentLogo, setCurrentLogo] = useState(null)
  const [preview, setPreview] = useState(null)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const displayed = preview || currentLogo || (loaded ? logoUrl : null)

  function handlePick(e) {
    const f = e.target.files?.[0]
    setError('')
    setMessage('')
    if (!f) return
    if (!f.type.startsWith('image/')) { setError('Please choose an image file.'); return }
    if (f.size > MAX_BYTES) { setError('Image must be smaller than 2MB.'); return }
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function handleUpload() {
    if (!file) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const ext = file.name.split('.').pop() || 'png'
      const path = `logo-${Date.now()}.${ext}`

      const { error: uploadErr } = await supabase.storage.from('branding').upload(path, file, {
        cacheControl: '3600',
      })
      if (uploadErr) throw uploadErr

      const { data: pub } = supabase.storage.from('branding').getPublicUrl(path)
      const newUrl = pub.publicUrl

      const oldUrl = currentLogo || logoUrl
      const { error: settingsErr } = await supabase.from('company_settings')
        .update({ logo_url: newUrl, updated_at: new Date().toISOString() }).eq('id', 1)
      if (settingsErr) throw settingsErr

      // Best-effort cleanup of the previous file.
      const oldPath = pathFromPublicUrl(oldUrl)
      if (oldPath) await supabase.storage.from('branding').remove([oldPath])

      setCurrentLogo(newUrl)
      setFile(null)
      setPreview(null)
      setMessage('Logo updated.')
    } catch (e) {
      setError('Could not upload logo: ' + e.message)
    }
    setBusy(false)
  }

  async function handleRemove() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const oldUrl = currentLogo || logoUrl
      const { error: settingsErr } = await supabase.from('company_settings')
        .update({ logo_url: null, updated_at: new Date().toISOString() }).eq('id', 1)
      if (settingsErr) throw settingsErr
      const oldPath = pathFromPublicUrl(oldUrl)
      if (oldPath) await supabase.storage.from('branding').remove([oldPath])
      setCurrentLogo(null)
      setFile(null)
      setPreview(null)
      setMessage('Logo removed.')
    } catch (e) {
      setError('Could not remove logo: ' + e.message)
    }
    setBusy(false)
  }

  return (
    <div className="space-y-5 max-w-lg">
      <h1 className="font-display text-2xl font-semibold text-navy">Company Branding</h1>
      <p className="text-sm text-slate">
        Upload your company logo. It'll appear on the sign-in page and in the top-left of the app for everyone.
      </p>

      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-center h-28 bg-paper rounded-md border border-line">
          {displayed ? (
            <img src={displayed} alt="Company logo" className="max-h-24 max-w-[80%] object-contain" />
          ) : (
            <span className="text-xs text-slate">No logo uploaded yet</span>
          )}
        </div>

        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handlePick} />

        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={() => inputRef.current?.click()}>
            Choose image
          </button>
          <button className="btn-primary flex-1" disabled={!file || busy} onClick={handleUpload}>
            <Upload size={16} /> {busy ? 'Uploading…' : 'Upload'}
          </button>
        </div>

        {(currentLogo || logoUrl) && (
          <button className="text-xs text-rust underline flex items-center gap-1" disabled={busy} onClick={handleRemove}>
            <Trash2 size={13} /> Remove current logo
          </button>
        )}

        {error && <p className="text-rust text-sm">{error}</p>}
        {message && <p className="text-leaf text-sm">{message}</p>}

        <p className="text-xs text-slate">PNG, JPG, or SVG. Under 2MB. A wide, transparent-background logo works best.</p>
      </div>
    </div>
  )
}
