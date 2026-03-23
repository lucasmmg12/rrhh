/**
 * Hub Session Tracker — RRHH / Recursos Humanos
 * 
 * Usa un cliente Supabase dedicado al Hub (NO el de RRHH)
 * porque hub_logs_sesion vive en el proyecto Supabase del Hub.
 */
import { createClient } from '@supabase/supabase-js'

const RRHH_SISTEMA_ID = '6046063c-f071-4b98-9646-920b34b748db'

// Cliente dedicado al Hub
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
    await hub.from('hub_logs_sesion').insert({
      user_id: userId, evento: 'login', sistema_id: RRHH_SISTEMA_ID,
      ip_address: ip, user_agent: navigator.userAgent,
      latitud: geo?.lat || null, longitud: geo?.lng || null,
      metadata: { source: 'rrhh' },
    })
  } catch (e) { console.warn('[HubTracker]', e) }
}

export async function trackLogout(supabase, userId) {
  try {
    const hub = getHubClient()
    if (!hub) return

    await hub.from('hub_logs_sesion').insert({
      user_id: userId, evento: 'logout', sistema_id: RRHH_SISTEMA_ID,
      user_agent: navigator.userAgent, metadata: { source: 'rrhh' },
    })
  } catch (e) { console.warn('[HubTracker]', e) }
}
