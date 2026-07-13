-- ═══════════════════════════════════════════════════════════════
-- EFEMÉRIDES SANATORIO ARGENTINO 2025 + SALUD ARGENTINA
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- Enero
  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Administrativo' AND fecha = '2025-01-20') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Administrativo', '2025-01-20', 'dia_mundial', true, true, '#3b82f6', '🗂️', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día Mundial contra la Lepra' AND fecha = '2025-01-29') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día Mundial contra la Lepra', '2025-01-29', 'dia_mundial', true, false, '#0284c7', '🩺', false);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día Mundial de las Enfermedades Tropicales Desatendidas' AND fecha = '2025-01-30') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día Mundial de las Enfermedades Tropicales Desatendidas', '2025-01-30', 'dia_mundial', true, false, '#0284c7', '🩺', false);
  END IF;

  -- Marzo
  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día de Trabajadores de Mantenimiento' AND fecha = '2025-03-04') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día de Trabajadores de Mantenimiento', '2025-03-04', 'dia_mundial', true, true, '#64748b', '🔧', true);
  END IF;

  -- Abril
  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día Mundial de la Salud' AND fecha = '2025-04-07') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día Mundial de la Salud', '2025-04-07', 'dia_mundial', true, false, '#10b981', '🌍', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Kinesiólogo' AND fecha = '2025-04-13') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Kinesiólogo', '2025-04-13', 'dia_mundial', true, false, '#06b6d4', '🦴', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día Mundial de la Enfermedad de Chagas' AND fecha = '2025-04-14') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día Mundial de la Enfermedad de Chagas', '2025-04-14', 'dia_mundial', true, false, '#0284c7', '🩺', false);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día de la Higiene y Seguridad en el Trabajo' AND fecha = '2025-04-21') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día de la Higiene y Seguridad en el Trabajo', '2025-04-21', 'dia_mundial', true, false, '#f97316', '⚠️', true);
  END IF;

  -- Mayo
  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Trabajador' AND fecha = '2025-05-01') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Trabajador', '2025-05-01', 'feriado', true, false, '#f59e0b', '💪', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día Mundial de la Higiene de Manos' AND fecha = '2025-05-05') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día Mundial de la Higiene de Manos', '2025-05-05', 'dia_mundial', true, false, '#0284c7', '👐', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día Internacional de la Enfermería' AND fecha = '2025-05-12') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día Internacional de la Enfermería', '2025-05-12', 'dia_mundial', true, true, '#ec4899', '👩‍⚕️', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Aniversario de Terapia Pediátrica' AND fecha = '2025-05-27') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Aniversario de Terapia Pediátrica', '2025-05-27', 'institucional', true, false, '#7c3aed', '👶', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Lic. en Bioimágenes' AND fecha = '2025-05-29') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Lic. en Bioimágenes', '2025-05-29', 'dia_mundial', true, true, '#8b5cf6', '📡', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día Mundial Sin Tabaco' AND fecha = '2025-05-31') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día Mundial Sin Tabaco', '2025-05-31', 'dia_mundial', true, false, '#0284c7', '🚭', false);
  END IF;

  -- Junio
  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Profesional de Recursos Humanos' AND fecha = '2025-06-03') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Profesional de Recursos Humanos', '2025-06-03', 'dia_mundial', true, false, '#0ea5e9', '🤝', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Periodista' AND fecha = '2025-06-07') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Periodista', '2025-06-07', 'dia_mundial', true, false, '#64748b', '📰', false);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día Mundial del Donante de Sangre' AND fecha = '2025-06-14') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día Mundial del Donante de Sangre', '2025-06-14', 'dia_mundial', true, false, '#dc2626', '🩸', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Bioquímico' AND fecha = '2025-06-15') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Bioquímico', '2025-06-15', 'dia_mundial', true, false, '#8b5cf6', '🔬', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día Nacional del Uso de Antimicrobianos' AND fecha = '2025-06-21') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día Nacional del Uso de Antimicrobianos', '2025-06-21', 'dia_mundial', true, false, '#0284c7', '💊', false);
  END IF;

  -- Julio
  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Facturador en Salud' AND fecha = '2025-07-01') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Facturador en Salud', '2025-07-01', 'dia_mundial', true, true, '#0284c7', '🧾', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Bioingeniero' AND fecha = '2025-07-03') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Bioingeniero', '2025-07-03', 'dia_mundial', true, false, '#06b6d4', '⚙️', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Amigo' AND fecha = '2025-07-20') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Amigo', '2025-07-20', 'dia_mundial', true, false, '#e11d48', '🫂', true);
  END IF;

  -- Agosto
  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Nutricionista' AND fecha = '2025-08-11') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Nutricionista', '2025-08-11', 'dia_mundial', true, true, '#10b981', '🥗', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día Nacional del Vacunador' AND fecha = '2025-08-26') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día Nacional del Vacunador', '2025-08-26', 'dia_mundial', true, true, '#dc2626', '💉', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Licenciado en Enfermería' AND fecha = '2025-08-29') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Licenciado en Enfermería', '2025-08-29', 'dia_mundial', true, false, '#ec4899', '🩺', true);
  END IF;

  -- Septiembre
  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día de la Secretaria' AND fecha = '2025-09-04') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día de la Secretaria', '2025-09-04', 'dia_mundial', true, true, '#e11d48', '💐', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día Mundial para la Prevención del Suicidio' AND fecha = '2025-09-10') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día Mundial para la Prevención del Suicidio', '2025-09-10', 'dia_mundial', true, false, '#7c3aed', '🎗️', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Programador Informático' AND fecha = '2025-09-13') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Programador Informático', '2025-09-13', 'dia_mundial', true, true, '#6366f1', '💻', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Instrumentador Quirúrgico' AND fecha = '2025-09-19') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Instrumentador Quirúrgico', '2025-09-19', 'dia_mundial', true, true, '#14b8a6', '🏥', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Estudiante' AND fecha = '2025-09-21') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Estudiante', '2025-09-21', 'dia_mundial', true, false, '#f59e0b', '📚', false);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día Mundial del Alzheimer' AND fecha = '2025-09-21') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día Mundial del Alzheimer', '2025-09-21', 'dia_mundial', true, false, '#0284c7', '🧠', false);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Residente' AND fecha = '2025-09-23') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Residente', '2025-09-23', 'institucional', true, true, '#7c3aed', '🩻', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Farmacéutico' AND fecha = '2025-09-25') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Farmacéutico', '2025-09-25', 'dia_mundial', true, true, '#10b981', '💊', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Cirujano' AND fecha = '2025-09-26') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Cirujano', '2025-09-26', 'dia_mundial', true, false, '#0284c7', '🔪', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Profesional de Compras' AND fecha = '2025-09-30') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Profesional de Compras', '2025-09-30', 'dia_mundial', true, false, '#64748b', '🛒', true);
  END IF;

  -- Octubre
  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día de los Auxiliares de Hotelería' AND fecha = '2025-10-04') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día de los Auxiliares de Hotelería', '2025-10-04', 'dia_mundial', true, true, '#f97316', '🛏️', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Técnico de Laboratorio' AND fecha = '2025-10-09') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Técnico de Laboratorio', '2025-10-09', 'dia_mundial', true, false, '#8b5cf6', '🧪', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Psicólogo' AND fecha = '2025-10-13') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Psicólogo', '2025-10-13', 'dia_mundial', true, false, '#7c3aed', '🧠', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Anestesiólogo' AND fecha = '2025-10-16') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Anestesiólogo', '2025-10-16', 'dia_mundial', true, false, '#0284c7', '😷', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Auxiliar de Farmacia' AND fecha = '2025-10-17') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Auxiliar de Farmacia', '2025-10-17', 'dia_mundial', true, true, '#10b981', '💊', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día Internacional del Chef' AND fecha = '2025-10-20') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día Internacional del Chef', '2025-10-20', 'dia_mundial', true, true, '#f97316', '👨‍🍳', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Pediatra' AND fecha = '2025-10-20') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Pediatra', '2025-10-20', 'dia_mundial', true, false, '#0ea5e9', '👶', true);
  END IF;

  -- Noviembre
  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Camillero' AND fecha = '2025-11-05') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Camillero', '2025-11-05', 'dia_mundial', true, true, '#64748b', '🏥', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Técnico Radiólogo' AND fecha = '2025-11-08') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Técnico Radiólogo', '2025-11-08', 'dia_mundial', true, true, '#6366f1', '☢️', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día Nacional del Donante Voluntario de Sangre' AND fecha = '2025-11-09') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día Nacional del Donante Voluntario de Sangre', '2025-11-09', 'dia_mundial', true, false, '#dc2626', '🩸', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día Nacional de la Prevención de las Infecciones' AND fecha = '2025-11-09') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día Nacional de la Prevención de las Infecciones', '2025-11-09', 'dia_mundial', true, false, '#0284c7', '🧼', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día Mundial de la Calidad' AND fecha = '2025-11-10') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día Mundial de la Calidad', '2025-11-10', 'institucional', true, false, '#f59e0b', '⭐', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día de la Sanidad' AND fecha = '2025-11-21') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día de la Sanidad', '2025-11-21', 'dia_mundial', true, false, '#dc2626', '🏥', true);
  END IF;

  -- Diciembre
  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día Mundial del SIDA' AND fecha = '2025-12-01') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día Mundial del SIDA', '2025-12-01', 'dia_mundial', true, false, '#dc2626', '🎗️', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Médico' AND fecha = '2025-12-03') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Médico', '2025-12-03', 'dia_mundial', true, false, '#0ea5e9', '🩺', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Contador' AND fecha = '2025-12-17') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Contador', '2025-12-17', 'dia_mundial', true, true, '#3b82f6', '📊', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rrhh_efemerides WHERE titulo = 'Día del Técnico de Anestesia' AND fecha = '2025-12-21') THEN
    INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) 
    VALUES ('Día del Técnico de Anestesia', '2025-12-21', 'dia_mundial', true, true, '#0284c7', '😷', true);
  END IF;

END $$;
