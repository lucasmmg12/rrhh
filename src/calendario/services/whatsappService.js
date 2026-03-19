import { supabase } from '../../supabaseClient';

// ============================================
// WHATSAPP NOTIFICATION SERVICE — BuilderBot Cloud (V2)
// Smart Messaging with Role-based Notifications
// ============================================

const BUILDERBOT_API_URL = 'https://app.builderbot.cloud/api/v2/7937f7e0-742b-4f8c-aa74-31ac3b459ac3/messages';
const BUILDERBOT_API_KEY = 'bb-9dfe1149-b634-42e5-aa2e-2ed6b256fbe3';

// ===== MESSAGE TEMPLATES BY ROLE =====

const formatGeneralMessage = (event) => {
  const startTime = new Date(event.start_time);
  const hora = startTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  
  let msg = `🏥 *Sanatorio Argentino — Aviso de Sala*\n\n`;
  msg += `📋 *${event.title}*\n`;
  msg += `📅 Hoy a las *${hora}*\n`;
  msg += `📍 *${event.location || 'Sin ubicación'}*\n`;
  
  if (event.attendees_count > 0) {
    msg += `👥 ${event.attendees_count} personas\n`;
  }
  
  if (event.requires_coffee) {
    msg += `☕ *Coffee: Sí*\n`;
  }
  
  if (event.requires_tys) {
    msg += `🖥️ *TyS: Requiere asistencia técnica*\n`;
  }
  
  msg += `\n🧹 Por favor chequear limpieza y preparación de la sala.`;
  
  return msg;
};

const formatCocinaMessage = (event) => {
  const startTime = new Date(event.start_time);
  const hora = startTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  
  let msg = `🏥 *Sanatorio Argentino — Aviso de Cocina*\n\n`;
  msg += `☕ *Se requiere Coffee Break*\n\n`;
  msg += `📋 Evento: *${event.title}*\n`;
  msg += `📅 Hoy a las *${hora}*\n`;
  msg += `📍 *${event.location || 'Sin ubicación'}*\n`;
  
  if (event.attendees_count > 0) {
    msg += `👥 Para *${event.attendees_count} personas*\n`;
  }
  
  msg += `\n☕ *Preparar mesa de Coffee* — Café, agua, servicio completo.`;
  msg += `\n⏰ Todo debe estar listo *15 minutos antes* de la hora indicada.`;
  
  return msg;
};

const formatTySMessage = (event) => {
  const startTime = new Date(event.start_time);
  const hora = startTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  
  let msg = `🏥 *Sanatorio Argentino — Aviso de TyS*\n\n`;
  msg += `🖥️ *Se requiere soporte técnico*\n\n`;
  msg += `📋 Evento: *${event.title}*\n`;
  msg += `📅 Hoy a las *${hora}*\n`;
  msg += `📍 *${event.location || 'Sin ubicación'}*\n`;
  
  if (event.attendees_count > 0) {
    msg += `👥 ${event.attendees_count} personas\n`;
  }
  
  msg += `\n🖥️ *Verificar equipamiento técnico:*`;
  msg += `\n• Proyector / Pantalla`;
  msg += `\n• Audio / Micrófono`;
  msg += `\n• Conectividad / WiFi`;
  msg += `\n⏰ Todo debe estar configurado y probado *15 minutos antes*.`;
  
  return msg;
};

const formatCancelMessage = (event) => {
  const startTime = new Date(event.start_time);
  const hora = startTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

  let msg = `🏥 *Sanatorio Argentino — EVENTO CANCELADO*\n\n`;
  msg += `❌ *Se ha cancelado el siguiente evento:*\n\n`;
  msg += `📋 *${event.title}*\n`;
  msg += `📅 Previsto para hoy a las *${hora}*\n`;
  msg += `📍 *${event.location || 'Sin ubicación'}*\n`;
  msg += `\n⚠️ Este evento ha sido cancelado. No es necesario preparar la sala.`;
  
  return msg;
};

// Get message formatted by role
const getMessageForRole = (event, role) => {
  switch (role) {
    case 'cocina': return formatCocinaMessage(event);
    case 'tys': return formatTySMessage(event);
    default: return formatGeneralMessage(event);
  }
};

// ===== SEND MESSAGE =====

const sendWhatsAppMessage = async (phone, content) => {
  try {
    const response = await fetch(BUILDERBOT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-builderbot': BUILDERBOT_API_KEY,
      },
      body: JSON.stringify({
        messages: {
          content: content,
        },
        number: phone,
        checkIfExists: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`BuilderBot API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ WA message sent to ${phone}`, result);
    return { success: true, result };
  } catch (error) {
    console.error(`❌ WA message failed to ${phone}:`, error);
    return { success: false, error: error.message };
  }
};

// ===== CONTACTS =====

const getActiveContacts = async () => {
  const { data, error } = await supabase
    .from('notification_contacts')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data || [];
};

// Get active contacts grouped by role
const getContactsByRole = async () => {
  const contacts = await getActiveContacts();
  return {
    general: contacts.filter(c => (c.role || 'general') === 'general'),
    cocina: contacts.filter(c => c.role === 'cocina'),
    tys: contacts.filter(c => c.role === 'tys'),
  };
};

// ===== SMART NOTIFICATION =====

// Send notifications to selected contacts with role-specific messages
export const notifySelectedContacts = async (event, selectedContactIds) => {
  if (!selectedContactIds || selectedContactIds.length === 0) {
    console.log('No contacts selected for notification');
    return { sent: 0, failed: 0, results: [] };
  }

  // Fetch the selected contacts
  const { data: contacts, error } = await supabase
    .from('notification_contacts')
    .select('*')
    .in('id', selectedContactIds)
    .eq('is_active', true);
  
  if (error) throw error;
  if (!contacts || contacts.length === 0) {
    return { sent: 0, failed: 0, results: [] };
  }

  const results = [];

  for (const contact of contacts) {
    const role = contact.role || 'general';
    const message = getMessageForRole(event, role);
    const result = await sendWhatsAppMessage(contact.phone, message);
    results.push({
      contact: contact.name,
      phone: contact.phone,
      role,
      ...result,
    });
    // Small delay between messages to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const sent = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`Notification complete: ${sent} sent, ${failed} failed`);
  return { sent, failed, results };
};

// Send cancellation notification to selected contacts
export const notifyCancellation = async (event, selectedContactIds) => {
  if (!selectedContactIds || selectedContactIds.length === 0) {
    return { sent: 0, failed: 0, results: [] };
  }

  const { data: contacts, error } = await supabase
    .from('notification_contacts')
    .select('*')
    .in('id', selectedContactIds)
    .eq('is_active', true);
  
  if (error) throw error;
  if (!contacts || contacts.length === 0) {
    return { sent: 0, failed: 0, results: [] };
  }

  const message = formatCancelMessage(event);
  const results = [];

  for (const contact of contacts) {
    const result = await sendWhatsAppMessage(contact.phone, message);
    results.push({
      contact: contact.name,
      phone: contact.phone,
      ...result,
    });
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const sent = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return { sent, failed, results };
};

// Legacy: Send notification for a specific event to all active contacts
export const notifyEventToContacts = async (event) => {
  const contacts = await getActiveContacts();
  if (contacts.length === 0) {
    console.log('No active contacts to notify');
    return { sent: 0, failed: 0, results: [] };
  }

  const results = [];

  for (const contact of contacts) {
    const role = contact.role || 'general';
    const message = getMessageForRole(event, role);
    const result = await sendWhatsAppMessage(contact.phone, message);
    results.push({
      contact: contact.name,
      phone: contact.phone,
      role,
      ...result,
    });
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const sent = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`Notification complete: ${sent} sent, ${failed} failed`);
  return { sent, failed, results };
};

// Send a test message to a specific number
export const sendTestMessage = async (phone) => {
  const testContent = `🏥 *Sanatorio Argentino — Mensaje de Prueba*\n\n✅ Este es un mensaje de prueba del sistema de notificaciones de la Agenda de Salas.\n\nSi recibiste este mensaje, el sistema funciona correctamente. 🎉`;
  return sendWhatsAppMessage(phone, testContent);
};

// Export for use
export const whatsappService = {
  sendWhatsAppMessage,
  formatGeneralMessage,
  formatCocinaMessage,
  formatTySMessage,
  formatCancelMessage,
  getMessageForRole,
  getActiveContacts,
  getContactsByRole,
  notifySelectedContacts,
  notifyCancellation,
  notifyEventToContacts,
  sendTestMessage,
};
