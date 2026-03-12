-- ============================================
-- SISTEMA DE NOTIFICACIÓN AUTOMÁTICA WhatsApp
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Función que chequea eventos próximos y envía notificaciones
CREATE OR REPLACE FUNCTION check_and_send_notifications()
RETURNS void AS $$
DECLARE
  event_record RECORD;
  contact_record RECORD;
  msg_content TEXT;
  hora_evento TEXT;
  api_url TEXT := 'https://app.builderbot.cloud/api/v2/7937f7e0-742b-4f8c-aa74-31ac3b459ac3/messages';
  api_key TEXT := 'bb-9dfe1149-b634-42e5-aa2e-2ed6b256fbe3';
  request_body JSONB;
BEGIN
  -- Buscar eventos que empiezan en los próximos 25 minutos
  -- y que tienen notify_whatsapp = true y notified = false
  FOR event_record IN
    SELECT *
    FROM calendar_events
    WHERE notify_whatsapp = true
      AND notified = false
      AND event_type != 'holiday'
      AND start_time > NOW()
      AND start_time <= NOW() + INTERVAL '25 minutes'
  LOOP
    -- Formatear hora del evento
    hora_evento := TO_CHAR(event_record.start_time AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH24:MI');
    
    -- Construir mensaje
    msg_content := E'🏥 *Sanatorio Argentino — Aviso de Sala*\n\n';
    msg_content := msg_content || E'📋 *' || event_record.title || E'*\n';
    msg_content := msg_content || E'📅 Hoy a las *' || hora_evento || E'*\n';
    msg_content := msg_content || E'📍 *' || COALESCE(event_record.location, 'Sin ubicación') || E'*\n';
    
    IF event_record.attendees_count > 0 THEN
      msg_content := msg_content || E'👥 ' || event_record.attendees_count || E' personas\n';
    END IF;
    
    IF event_record.requires_coffee THEN
      msg_content := msg_content || E'☕ *Coffee: Sí* — Cocina debe preparar la mesa\n';
    END IF;
    
    msg_content := msg_content || E'\n🧹 Por favor chequear limpieza y preparación de la sala.';

    -- Enviar a cada contacto activo
    FOR contact_record IN
      SELECT * FROM notification_contacts WHERE is_active = true
    LOOP
      -- Construir body del request
      request_body := jsonb_build_object(
        'messages', jsonb_build_object('content', msg_content),
        'number', contact_record.phone,
        'checkIfExists', false
      );

      -- Enviar via pg_net
      PERFORM net.http_post(
        url := api_url,
        body := request_body,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-api-builderbot', api_key
        )
      );

      RAISE NOTICE 'Notificación enviada a % (%) para evento: %', 
        contact_record.name, contact_record.phone, event_record.title;
    END LOOP;

    -- Marcar evento como notificado
    UPDATE calendar_events SET notified = true WHERE id = event_record.id;
    
    RAISE NOTICE 'Evento "%" marcado como notificado', event_record.title;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. Programar el cron job cada 5 minutos
SELECT cron.schedule(
  'check-calendar-notifications',  -- nombre del job
  '*/5 * * * *',                   -- cada 5 minutos
  'SELECT check_and_send_notifications()'
);

-- 4. Verificar que el job se creó
SELECT * FROM cron.job;
