-- ═══════════════════════════════════════════════════════════
-- MÉTRICAS SANTA FE — Server-Side Aggregation Functions
-- Fixes: uses fecha_visita for DOW calc, filters OS by number prefix
-- ═══════════════════════════════════════════════════════════

-- ─── KPIs ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION metricas_kpis()
RETURNS json LANGUAGE sql STABLE AS $$
  SELECT json_build_object(
    'totalVisitas', COUNT(*),
    'especialidades', COUNT(DISTINCT especialidad),
    'medicos', COUNT(DISTINCT responsable),
    'obrasSociales', COUNT(DISTINCT cliente) FILTER (WHERE cliente ~ '^\d')
  )
  FROM metricas_visitas_sf;
$$;

-- ─── Heatmap: Días (calc from fecha_visita) ─────────────
CREATE OR REPLACE FUNCTION metricas_heatmap_dias()
RETURNS json LANGUAGE sql STABLE AS $$
  SELECT json_agg(row_to_json(t) ORDER BY t.dow)
  FROM (
    SELECT EXTRACT(DOW FROM fecha_visita)::int AS dow, COUNT(*) AS value
    FROM metricas_visitas_sf
    WHERE fecha_visita IS NOT NULL
    GROUP BY dow
  ) t;
$$;

-- ─── Heatmap: Horas ─────────────────────────────────────
CREATE OR REPLACE FUNCTION metricas_heatmap_horas()
RETURNS json LANGUAGE sql STABLE AS $$
  SELECT json_agg(row_to_json(t) ORDER BY t.hora_numero)
  FROM (
    SELECT hora_numero, COUNT(*) AS value
    FROM metricas_visitas_sf
    WHERE hora_numero IS NOT NULL AND hora_numero >= 0 AND hora_numero < 24
    GROUP BY hora_numero
  ) t;
$$;

-- ─── Heatmap Matrix: Día × Hora ─────────────────────────
CREATE OR REPLACE FUNCTION metricas_heatmap_matrix()
RETURNS json LANGUAGE sql STABLE AS $$
  SELECT json_agg(row_to_json(t))
  FROM (
    SELECT EXTRACT(DOW FROM fecha_visita)::int AS dow, hora_numero, COUNT(*) AS value
    FROM metricas_visitas_sf
    WHERE fecha_visita IS NOT NULL AND hora_numero IS NOT NULL
      AND hora_numero >= 0 AND hora_numero < 24
    GROUP BY dow, hora_numero
    ORDER BY dow, hora_numero
  ) t;
$$;

-- ─── Obras Sociales (solo las que empiezan con número) ──
CREATE OR REPLACE FUNCTION metricas_obras_sociales(top_n int DEFAULT 10)
RETURNS json LANGUAGE sql STABLE AS $$
  WITH ranked AS (
    SELECT 
      TRIM(regexp_replace(cliente, '^\d+\s*-\s*', '')) AS name,
      COUNT(*) AS value
    FROM metricas_visitas_sf
    WHERE cliente IS NOT NULL AND cliente ~ '^\d'
    GROUP BY 1
    ORDER BY value DESC
  ),
  top AS (
    SELECT name, value, ROW_NUMBER() OVER () AS rn
    FROM ranked
    LIMIT top_n
  ),
  otros AS (
    SELECT 'Otros' AS name, SUM(value) AS value
    FROM ranked
    WHERE name NOT IN (SELECT name FROM top)
  )
  SELECT json_agg(row_to_json(t))
  FROM (
    SELECT name, value FROM top
    UNION ALL
    SELECT name, value FROM otros WHERE value > 0
  ) t;
$$;

-- ─── Ranking genérico (reutilizable) ────────────────────
CREATE OR REPLACE FUNCTION metricas_ranking(campo text, top_n int DEFAULT 15)
RETURNS json LANGUAGE plpgsql STABLE AS $$
DECLARE
  result json;
BEGIN
  EXECUTE format(
    'SELECT json_agg(row_to_json(t))
     FROM (
       SELECT %I AS name, COUNT(*) AS value
       FROM metricas_visitas_sf
       WHERE %I IS NOT NULL
       GROUP BY %I
       ORDER BY value DESC
       LIMIT %s
     ) t',
    campo, campo, campo, top_n
  ) INTO result;
  RETURN result;
END;
$$;

-- ─── Ranking filtrado por especialidad ──────────────────
CREATE OR REPLACE FUNCTION metricas_ranking_filtered(campo text, esp text, top_n int DEFAULT 15)
RETURNS json LANGUAGE plpgsql STABLE AS $$
DECLARE
  result json;
BEGIN
  IF esp IS NULL OR esp = '' THEN
    RETURN metricas_ranking(campo, top_n);
  END IF;
  EXECUTE format(
    'SELECT json_agg(row_to_json(t))
     FROM (
       SELECT %I AS name, COUNT(*) AS value
       FROM metricas_visitas_sf
       WHERE %I IS NOT NULL AND especialidad = $1
       GROUP BY %I
       ORDER BY value DESC
       LIMIT %s
     ) t',
    campo, campo, campo, top_n
  ) INTO result USING esp;
  RETURN result;
END;
$$;

-- ─── Visitas por Mes ────────────────────────────────────
CREATE OR REPLACE FUNCTION metricas_visitas_por_mes(esp text DEFAULT NULL)
RETURNS json LANGUAGE sql STABLE AS $$
  SELECT json_agg(row_to_json(t) ORDER BY t.mes_key)
  FROM (
    SELECT 
      TO_CHAR(fecha_visita, 'YYYY-MM') AS mes_key,
      COUNT(*) AS value
    FROM metricas_visitas_sf
    WHERE fecha_visita IS NOT NULL
      AND (esp IS NULL OR especialidad = esp)
    GROUP BY mes_key
  ) t;
$$;

-- ─── Heatmap Días filtrado ──────────────────────────────
CREATE OR REPLACE FUNCTION metricas_heatmap_dias_filtered(esp text DEFAULT NULL)
RETURNS json LANGUAGE sql STABLE AS $$
  SELECT json_agg(row_to_json(t) ORDER BY t.dow)
  FROM (
    SELECT EXTRACT(DOW FROM fecha_visita)::int AS dow, COUNT(*) AS value
    FROM metricas_visitas_sf
    WHERE fecha_visita IS NOT NULL
      AND (esp IS NULL OR especialidad = esp)
    GROUP BY dow
  ) t;
$$;

-- ─── Obras Sociales filtrado ────────────────────────────
CREATE OR REPLACE FUNCTION metricas_obras_sociales_filtered(esp text DEFAULT NULL, top_n int DEFAULT 10)
RETURNS json LANGUAGE sql STABLE AS $$
  WITH ranked AS (
    SELECT 
      TRIM(regexp_replace(cliente, '^\d+\s*-\s*', '')) AS name,
      COUNT(*) AS value
    FROM metricas_visitas_sf
    WHERE cliente IS NOT NULL AND cliente ~ '^\d'
      AND (esp IS NULL OR especialidad = esp)
    GROUP BY 1
    ORDER BY value DESC
  ),
  top AS (
    SELECT name, value, ROW_NUMBER() OVER () AS rn
    FROM ranked
    LIMIT top_n
  ),
  otros AS (
    SELECT 'Otros' AS name, SUM(value) AS value
    FROM ranked
    WHERE name NOT IN (SELECT name FROM top)
  )
  SELECT json_agg(row_to_json(t))
  FROM (
    SELECT name, value FROM top
    UNION ALL
    SELECT name, value FROM otros WHERE value > 0
  ) t;
$$;

-- ─── Ausentismo: Breakdown general ──────────────────────
CREATE OR REPLACE FUNCTION metricas_ausentismo_breakdown()
RETURNS json LANGUAGE sql STABLE AS $$
  SELECT json_build_object(
    'total', (SELECT COUNT(*) FROM metricas_visitas_sf WHERE asistencia IS NOT NULL),
    'breakdown', (
      SELECT json_agg(row_to_json(t) ORDER BY t.count DESC)
      FROM (
        SELECT asistencia AS status, COUNT(*) AS count
        FROM metricas_visitas_sf
        WHERE asistencia IS NOT NULL
        GROUP BY asistencia
      ) t
    )
  );
$$;

-- ─── Ausentismo por Especialidad ────────────────────────
CREATE OR REPLACE FUNCTION metricas_ausentismo_por_especialidad(min_turnos int DEFAULT 20)
RETURNS json LANGUAGE sql STABLE AS $$
  SELECT json_agg(row_to_json(t) ORDER BY t.rate DESC)
  FROM (
    SELECT
      especialidad AS name,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE LOWER(asistencia) LIKE '%ausente%' 
                        OR LOWER(asistencia) LIKE '%no asist%'
                        OR LOWER(asistencia) LIKE '%cancelad%') AS no_show,
      ROUND(
        100.0 * COUNT(*) FILTER (WHERE LOWER(asistencia) LIKE '%ausente%' 
                                   OR LOWER(asistencia) LIKE '%no asist%'
                                   OR LOWER(asistencia) LIKE '%cancelad%') / COUNT(*),
        1
      ) AS rate
    FROM metricas_visitas_sf
    WHERE especialidad IS NOT NULL AND asistencia IS NOT NULL
    GROUP BY especialidad
    HAVING COUNT(*) >= min_turnos
  ) t
  LIMIT 15;
$$;

-- ─── Pacientes Recurrentes ──────────────────────────────
CREATE OR REPLACE FUNCTION metricas_pacientes_recurrentes(top_n int DEFAULT 15)
RETURNS json LANGUAGE sql STABLE AS $$
  SELECT json_agg(row_to_json(t))
  FROM (
    SELECT paciente AS name, COUNT(*) AS value
    FROM metricas_visitas_sf
    WHERE paciente IS NOT NULL
    GROUP BY paciente
    ORDER BY value DESC
    LIMIT top_n
  ) t;
$$;
