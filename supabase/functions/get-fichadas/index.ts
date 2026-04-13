// ═══════════════════════════════════════════════════════════════
// Supabase Edge Function: get-fichadas
// Endpoint REST para consultar fichadas (entrada/salida) de
// colaboradores por sector. Consumido por el sistema de
// Contact Center para cruzar actividad digital vs presencia.
// ═══════════════════════════════════════════════════════════════
//
// POST /functions/v1/get-fichadas
//
// Request body (fecha individual):
//   { "fecha": "2026-03-15", "sector": "CONTACT CENTER" }
//
// Request body (rango de fechas):
//   { "fecha_desde": "2026-03-01", "fecha_hasta": "2026-03-31", "sector": "CONTACT CENTER" }
//
// Variables de entorno requeridas (Supabase Secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ═══════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── CORS headers ───
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

Deno.serve(async (req) => {
  // ─── Preflight CORS ───
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // ─── Solo POST ───
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método no permitido. Usar POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // ─── Init Supabase client ───
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ─── Parse body ───
    const body = await req.json();
    const { fecha, fecha_desde, fecha_hasta, sector } = body;

    if (!sector) {
      return new Response(
        JSON.stringify({ error: 'El campo "sector" es requerido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar que se envíe fecha individual o rango, pero no ninguno
    const isSingleDate = !!fecha;
    const isRange = !!fecha_desde && !!fecha_hasta;

    if (!isSingleDate && !isRange) {
      return new Response(
        JSON.stringify({
          error: 'Enviar "fecha" para consulta individual o "fecha_desde" + "fecha_hasta" para rango.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── 1. Obtener colaboradores del sector ───
    const { data: colaboradores, error: colabError } = await supabase
      .from('fichadas_colaboradores')
      .select('id, nombre_completo')
      .ilike('sector', sector)
      .eq('activo', true);

    if (colabError) throw colabError;

    if (!colaboradores || colaboradores.length === 0) {
      return new Response(
        JSON.stringify({
          error: `No se encontraron colaboradores activos en el sector "${sector}".`,
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const colaboradorIds = colaboradores.map((c) => c.id);
    // Map id → nombre_completo para lookup rápido
    const nombreMap = new Map(colaboradores.map((c) => [c.id, c.nombre_completo]));

    // ─── 2A. Consulta por fecha individual ───
    if (isSingleDate) {
      const { data: registros, error: regError } = await supabase
        .from('fichadas_registros')
        .select('colaborador_id, fichada_entrada, fichada_salida, horas_trabajadas_min, tarde')
        .in('colaborador_id', colaboradorIds)
        .eq('fecha', fecha)
        .order('fichada_entrada', { ascending: true });

      if (regError) throw regError;

      // Formatear respuesta — solo incluir colaboradores con fichada
      const colaboradoresResponse = (registros || []).map((r) => ({
        nombre_completo: nombreMap.get(r.colaborador_id) || 'Desconocido',
        fichada_entrada: r.fichada_entrada,
        fichada_salida: r.fichada_salida,
        horas_trabajadas_min: r.horas_trabajadas_min,
        tarde: r.tarde,
      }));

      return new Response(
        JSON.stringify({
          fecha,
          sector,
          colaboradores: colaboradoresResponse,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── 2B. Consulta por rango de fechas ───
    if (isRange) {
      const { data: registros, error: regError } = await supabase
        .from('fichadas_registros')
        .select('colaborador_id, fecha, fichada_entrada, fichada_salida, horas_trabajadas_min, tarde')
        .in('colaborador_id', colaboradorIds)
        .gte('fecha', fecha_desde)
        .lte('fecha', fecha_hasta)
        .order('fecha', { ascending: true })
        .order('fichada_entrada', { ascending: true });

      if (regError) throw regError;

      // Agrupar registros por colaborador
      const registrosPorColaborador = new Map<string, Array<{
        fecha: string;
        fichada_entrada: string | null;
        fichada_salida: string | null;
        horas_trabajadas_min: number;
        tarde: boolean;
      }>>();

      for (const r of registros || []) {
        const nombre = nombreMap.get(r.colaborador_id) || 'Desconocido';
        if (!registrosPorColaborador.has(nombre)) {
          registrosPorColaborador.set(nombre, []);
        }
        registrosPorColaborador.get(nombre)!.push({
          fecha: r.fecha,
          fichada_entrada: r.fichada_entrada,
          fichada_salida: r.fichada_salida,
          horas_trabajadas_min: r.horas_trabajadas_min,
          tarde: r.tarde,
        });
      }

      // Solo incluir colaboradores que tienen al menos un registro
      const colaboradoresResponse = Array.from(registrosPorColaborador.entries()).map(
        ([nombre, regs]) => ({
          nombre_completo: nombre,
          total_registros: regs.length,
          total_minutos: regs.reduce((sum, r) => sum + (r.horas_trabajadas_min || 0), 0),
          dias_tarde: regs.filter((r) => r.tarde).length,
          registros: regs,
        })
      );

      return new Response(
        JSON.stringify({
          fecha_desde,
          fecha_hasta,
          sector,
          colaboradores: colaboradoresResponse,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (err) {
    console.error('get-fichadas error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Error interno del servidor.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
