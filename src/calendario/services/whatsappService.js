import { supabase } from '../../supabaseClient';

// ============================================
// WHATSAPP NOTIFICATION SERVICE — BuilderBot Cloud
// ============================================

const BUILDERBOT_API_URL = 'https://app.builderbot.cloud/api/v2/7937f7e0-742b-4f8c-aa74-31ac3b459ac3/messages';
const BUILDERBOT_API_KEY = 'bb-9dfe1149-b634-42e5-aa2e-2ed6b256fbe3';

// Format event into WhatsApp message
const formatEventMessage = (event) => {
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
    msg += `☕ *Coffee: Sí* — Cocina debe preparar la mesa\n`;
  }
  
  msg += `\n🧹 Por favor chequear limpieza y preparación de la sala.`;
  
  return msg;
};

// Send a single WhatsApp message via BuilderBot
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

// Get all active notification contacts
const getActiveContacts = async () => {
  const { data, error } = await supabase
    .from('notification_contacts')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data || [];
};

// Send notification for a specific event to all active contacts
export const notifyEventToContacts = async (event) => {
  const contacts = await getActiveContacts();
  if (contacts.length === 0) {
    console.log('No active contacts to notify');
    return { sent: 0, failed: 0, results: [] };
  }

  const message = formatEventMessage(event);
  const results = [];

  for (const contact of contacts) {
    const result = await sendWhatsAppMessage(contact.phone, message);
    results.push({
      contact: contact.name,
      phone: contact.phone,
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

// Send a test message to a specific number
export const sendTestMessage = async (phone) => {
  const testContent = `🏥 *Sanatorio Argentino — Mensaje de Prueba*\n\n✅ Este es un mensaje de prueba del sistema de notificaciones de la Agenda de Salas.\n\nSi recibiste este mensaje, el sistema funciona correctamente. 🎉`;
  return sendWhatsAppMessage(phone, testContent);
};

// Export for use
export const whatsappService = {
  sendWhatsAppMessage,
  formatEventMessage,
  getActiveContacts,
  notifyEventToContacts,
  sendTestMessage,
};
