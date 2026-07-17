// Supabase Edge Function: create-employee
//
// Called by the employer portal to create a new employee login + profile.
// Runs server-side so the service-role key never reaches the browser.
// Deploy with: npx supabase functions deploy create-employee
//
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    // Confirm the caller is a signed-in employer.
    const { data: { user }, error: userErr } = await callerClient.auth.getUser()
    if (userErr || !user) {
      return json({ error: 'Not authenticated' }, 401)
    }
    const { data: callerProfile } = await callerClient.from('profiles').select('role').eq('id', user.id).single()
    if (callerProfile?.role !== 'employer') {
      return json({ error: 'Only employers can add employees' }, 403)
    }

    const body = await req.json()
    const { email, full_name, phone, home_address, position, yearly_vacation_hours } = body
    if (!email || !full_name) {
      return json({ error: 'email and full_name are required' }, 400)
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Creates the auth user and emails them an invite to set their own password.
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email)
    if (inviteErr) return json({ error: inviteErr.message }, 400)

    const { error: profileErr } = await admin.from('profiles').insert({
      id: invited.user.id,
      role: 'employee',
      full_name,
      email,
      phone: phone || null,
      home_address: home_address || null,
      position: position || null,
      yearly_vacation_hours: yearly_vacation_hours || 0,
    })
    if (profileErr) return json({ error: profileErr.message }, 400)

    return json({ ok: true, id: invited.user.id })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
