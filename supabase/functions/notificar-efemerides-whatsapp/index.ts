// ═══════════════════════════════════════════════════════════════
// Supabase Edge Function: notificar-efemerides-whatsapp
// Se ejecuta diariamente a las 7:00 AM (cron) y envía mensaje
// a Romina Marún sobre las efemérides del día siguiente.
// ═══════════════════════════════════════════════════════════════
//
// Configurar como cron en Supabase Dashboard > Edge Functions > Schedules:
//   Cron: 0 10 * * *   (10:00 UTC = 7:00 AM Argentina UTC-3)
//   Function: notificar-efemerides-whatsapp
//
// Variables de entorno requeridas (Supabase Secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   WHATSAPP_API_URL  (ej: https://graph.facebook.com/v18.0/{phone_number_id}/messages)
//   WHATSAPP_TOKEN    (Bearer token de la API de WhatsApp Business)
// ═══════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ROMINA_PHONE = '5492645840068';

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const waApiUrl = Deno.env.get('WHATSAPP_API_URL');
    const waToken = Deno.env.get('WHATSAPP_TOKEN');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ─── Calcular fecha de mañana (Argentina UTC-3) ───
    const now = new Date();
    const argentinaOffset = -3 * 60;
    const argentinaTime = new Date(now.getTime() + (argentinaOffset + now.getTimezoneOffset()) * 60000);
    const tomorrow = new Date(argentinaTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD

    const tomorrowFormatted = tomorrow.toLocaleDateString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long'
    });

    // ─── Buscar efemérides de mañana ───
    const { data: efemerides, error } = await supabase
      .from('rrhh_efemerides')
      .select('id, titulo, tipo, obsequio, descripcion')
      .eq('fecha', tomorrowStr);

    if (error) throw error;

    if (!efemerides || efemerides.length === 0) {
      return new Response(JSON.stringify({
        status: 'ok',
        message: `No hay efemérides para mañana ${tomorrowStr}. No se envió mensaje.`
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // ─── Para cada efeméride, buscar destinatarios ───
    let mensajeParts = [];
    mensajeParts.push(`📅 *Efemérides para mañana ${tomorrowFormatted}*\n`);

    for (const ef of efemerides) {
      const tipoEmoji = {
        cumpleaños: '🎂',
        dia_mundial: '🌍',
        feriado: '🏛️',
        institucional: '🏥',
        otro: '📌',
      };
      const emoji = tipoEmoji[ef.tipo] || '📌';

      mensajeParts.push(`${emoji} *${ef.titulo}*`);
      if (ef.descripcion) mensajeParts.push(`   ${ef.descripcion}`);

      // Buscar destinatarios
      const { data: destinatarios } = await supabase
        .from('rrhh_efemerides_destinatarios')
        .select('*, colaborador:fichadas_colaboradores(nombre_completo, area)')
        .eq('efemeride_id', ef.id);

      if (destinatarios && destinatarios.length > 0) {
        mensajeParts.push(`   👥 *${destinatarios.length} destinatarios:*`);

        // Listar los primeros 10
        const listed = destinatarios.slice(0, 10);
        listed.forEach(d => {
          const nombre = d.colaborador?.nombre_completo || 'Sin nombre';
          const area = d.colaborador?.area ? ` (${d.colaborador.area})` : '';
          mensajeParts.push(`   • ${nombre}${area}`);
        });
        if (destinatarios.length > 10) {
          mensajeParts.push(`   ... y ${destinatarios.length - 10} más`);
        }

        if (ef.obsequio) {
          const pendientes = destinatarios.filter(d => !d.obsequio_entregado).length;
          mensajeParts.push(`\n   🎁 *Obsequios pendientes: ${pendientes}/${destinatarios.length}*`);
          if (pendientes > 0) {
            mensajeParts.push(`   ⚠️ Recordar preparar ${pendientes} obsequios`);
          }
        }
      } else {
        mensajeParts.push(`   👥 Sin destinatarios asignados`);
      }

      if (ef.obsequio && (!destinatarios || destinatarios.length === 0)) {
        mensajeParts.push(`   🎁 Tiene obsequio marcado — verificar a quién corresponde`);
      }

      mensajeParts.push(''); // línea en blanco
    }

    mensajeParts.push(`📋 *Acciones sugeridas:*`);
    mensajeParts.push(`• Verificar si hay colaboradores a los que hacer obsequio`);
    mensajeParts.push(`• Preparar flyer/comunicado si corresponde`);
    mensajeParts.push(`• Coordinar con RRHH para la entrega\n`);
    mensajeParts.push(`_Mensaje automático — Sistema RRHH Sanatorio Argentino_`);

    const mensajeCompleto = mensajeParts.join('\n');

    // ─── Enviar por WhatsApp ───
    if (waApiUrl && waToken) {
      const waResponse = await fetch(waApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${waToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: ROMINA_PHONE,
          type: 'text',
          text: { body: mensajeCompleto },
        }),
      });

      const waResult = await waResponse.json();

      return new Response(JSON.stringify({
        status: 'ok',
        fecha_mañana: tomorrowStr,
        efemerides_count: efemerides.length,
        mensaje_enviado: true,
        whatsapp_response: waResult,
      }), { headers: { 'Content-Type': 'application/json' } });
    } else {
      // Si no hay config de WA, solo loguear el mensaje
      console.log('WhatsApp no configurado. Mensaje generado:');
      console.log(mensajeCompleto);

      return new Response(JSON.stringify({
        status: 'ok',
        fecha_mañana: tomorrowStr,
        efemerides_count: efemerides.length,
        mensaje_enviado: false,
        mensaje_preview: mensajeCompleto,
        nota: 'WHATSAPP_API_URL o WHATSAPP_TOKEN no configurados. Mensaje no enviado.'
      }), { headers: { 'Content-Type': 'application/json' } });
    }

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
