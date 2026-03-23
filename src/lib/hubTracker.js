/**
 * Hub Session Tracker — RRHH / Recursos Humanos
 * 
 * Usa RPC hub_log_external_event vía el cliente del Hub.
 * Todos los sistemas externos usan RPC porque no tienen
 * sesión autenticada en el Supabase del Hub (RLS bloquea inserts).
 */
import { createClient } from '@supabase/supabase-js'

const RRHH_SISTEMA_ID = '6046063c-f071-4b98-9646-920b34b748db'

const HUB_SUPABASE_URL = import.meta.env.VITE_HUB_SUPABASE_URL
const HUB_SUPABASE_ANON_KEY = import.meta.env.VITE_HUB_SUPABASE_ANON_KEY

let hubClient = null
function getHubClient() {
  if (!HUB_SUPABASE_URL || !HUB_SUPABASE_ANON_KEY) {
    console.warn('[HubTracker] Missing VITE_HUB_SUPABASE_URL or VITE_HUB_SUPABASE_ANON_KEY')
    return null
  }
  if (!hubClient) {
    hubClient = createClient(HUB_SUPABASE_URL, HUB_SUPABASE_ANON_KEY)
  }
  return hubClient
}

async function getPublicIP() {
  try {
    const res = await fetch('https://api.ipify.org?format=json')
    return (await res.json()).ip || null
  } catch { return null }
}

function getGeo() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
    )
  })
}

export async function trackLogin(supabase, userId) {
  try {
    const hub = getHubClient()
    if (!hub) return

    const [ip, geo] = await Promise.all([getPublicIP(), getGeo()])
    await hub.rpc('hub_log_external_event', {
      p_user_identifier: userId,
      p_evento: 'login',
      p_sistema_id: RRHH_SISTEMA_ID,
      p_ip: ip,
      p_user_agent: navigator.userAgent,
      p_latitud: geo?.lat || null,
      p_longitud: geo?.lng || null,
      p_metadata: { source: 'rrhh' },
    })
  } catch (e) { console.warn('[HubTracker]', e) }
}

export async function trackLogout(supabase, userId) {
  try {
    const hub = getHubClient()
    if (!hub) return

    await hub.rpc('hub_log_external_event', {
      p_user_identifier: userId,
      p_evento: 'logout',
      p_sistema_id: RRHH_SISTEMA_ID,
      p_ip: null,
      p_user_agent: navigator.userAgent,
      p_latitud: null,
      p_longitud: null,
      p_metadata: { source: 'rrhh' },
    })
  } catch (e) { console.warn('[HubTracker]', e) }
}
