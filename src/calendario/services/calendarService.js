import { supabase } from '../../supabaseClient';

// ============================================
// CALENDAR SERVICE — Supabase CRUD (V2.1)
// Features: Cancel, TyS, Smart Messaging, Audit Log
// ============================================

// --- AUDIT LOG HELPER ---
async function logAction(eventId, action, userEmail, details = {}) {
  try {
    await supabase.from('calendar_event_logs').insert({
      event_id: eventId,
      action,
      user_email: userEmail || 'unknown',
      details,
    });
  } catch (e) {
    console.error('Audit log failed:', e);
  }
}

export const calendarService = {

  // --- EVENTS ---
  async getEvents(startDate, endDate) {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .gte('start_time', startDate)
      .lte('start_time', endDate)
      .order('start_time', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async getEventById(id) {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async createEvent(event, userEmail) {
    const payload = {
      title: event.title,
      description: event.description || '',
      start_time: event.start_time,
      end_time: event.end_time,
      event_type: event.event_type || 'meeting',
      color: event.color || '#0284c7',
      location: event.location || 'Sala de Ateneo',
      attendees_count: event.attendees_count || 0,
      requires_coffee: event.requires_coffee || false,
      requires_tys: event.requires_tys || false,
      notify_whatsapp: event.notify_whatsapp ?? true,
      is_recurring: event.is_recurring || false,
      recurrence_rule: event.recurrence_rule || null,
      recurrence_parent_id: event.recurrence_parent_id || null,
      links: event.links || [],
      status: 'active',
      created_by: userEmail || null,
    };

    const { data, error } = await supabase
      .from('calendar_events')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    await logAction(data.id, 'created', userEmail, { title: data.title });
    return data;
  },

  async updateEvent(id, updates, userEmail) {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    delete payload.id;
    delete payload.created_at;
    delete payload.selectedContacts;

    const { data, error } = await supabase
      .from('calendar_events')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await logAction(id, 'updated', userEmail, { title: data.title });
    return data;
  },

  // --- CANCEL EVENT (soft delete) ---
  async cancelEvent(id, userEmail) {
    const { data, error } = await supabase
      .from('calendar_events')
      .update({ status: 'cancelled', updated_at: new Date().toISOString(), cancelled_by: userEmail || null, cancelled_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await logAction(id, 'cancelled', userEmail, { title: data.title });
    return data;
  },

  // Cancel all events in a recurrence group
  async cancelRecurrenceGroup(eventId, userEmail) {
    const { data: event, error: fetchError } = await supabase
      .from('calendar_events')
      .select('id, recurrence_parent_id')
      .eq('id', eventId)
      .single();
    if (fetchError) throw fetchError;

    const parentId = event.recurrence_parent_id || event.id;
    const cancelPayload = { status: 'cancelled', updated_at: new Date().toISOString(), cancelled_by: userEmail || null, cancelled_at: new Date().toISOString() };

    const { error: childError } = await supabase
      .from('calendar_events')
      .update(cancelPayload)
      .eq('recurrence_parent_id', parentId);
    if (childError) throw childError;

    const { error: parentError } = await supabase
      .from('calendar_events')
      .update(cancelPayload)
      .eq('id', parentId);
    if (parentError) throw parentError;

    await logAction(parentId, 'cancelled_group', userEmail, { eventId });
  },

  async deleteEvent(id, userEmail) {
    await logAction(id, 'deleted', userEmail);
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // Delete all events in a recurrence group (from any member)
  async deleteRecurrenceGroup(eventId) {
    // First, get the event to find the parent
    const { data: event, error: fetchError } = await supabase
      .from('calendar_events')
      .select('id, recurrence_parent_id')
      .eq('id', eventId)
      .single();
    if (fetchError) throw fetchError;

    const parentId = event.recurrence_parent_id || event.id;

    // Delete all children
    const { error: childError } = await supabase
      .from('calendar_events')
      .delete()
      .eq('recurrence_parent_id', parentId);
    if (childError) throw childError;

    // Delete the parent itself  
    const { error: parentError } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', parentId);
    if (parentError) throw parentError;
  },

  // --- RECURRENCE GENERATION ---
  async generateRecurringEvents(parentEvent) {
    const rule = parentEvent.recurrence_rule;
    if (!rule) return;

    const events = [];
    const startDate = new Date(parentEvent.start_time);
    const endDate = new Date(parentEvent.end_time);
    const duration = endDate - startDate; // ms

    const until = rule.until ? new Date(rule.until) : new Date('2026-12-31');
    const daysOfWeek = rule.days || []; // 0=Sun, 1=Mon...6=Sat

    let current = new Date(startDate);
    current.setDate(current.getDate() + 7); // Start from next week

    while (current <= until) {
      const dayOfWeek = current.getDay();
      if (daysOfWeek.includes(dayOfWeek)) {
        const evStart = new Date(current);
        evStart.setHours(startDate.getHours(), startDate.getMinutes(), 0, 0);
        const evEnd = new Date(evStart.getTime() + duration);

        events.push({
          title: parentEvent.title,
          description: parentEvent.description,
          start_time: evStart.toISOString(),
          end_time: evEnd.toISOString(),
          event_type: parentEvent.event_type,
          color: parentEvent.color,
          location: parentEvent.location,
          attendees_count: parentEvent.attendees_count || 0,
          requires_coffee: parentEvent.requires_coffee || false,
          requires_tys: parentEvent.requires_tys || false,
          notify_whatsapp: parentEvent.notify_whatsapp ?? true,
          is_recurring: true,
          recurrence_rule: parentEvent.recurrence_rule,
          recurrence_parent_id: parentEvent.id,
          links: parentEvent.links || [],
          status: 'active',
        });
      }
      current.setDate(current.getDate() + 1);
    }

    if (events.length > 0) {
      // Batch insert in chunks of 50
      for (let i = 0; i < events.length; i += 50) {
        const chunk = events.slice(i, i + 50);
        const { error } = await supabase
          .from('calendar_events')
          .insert(chunk);
        if (error) throw error;
      }
    }

    return events.length;
  },

  // --- CONTACTS (with roles) ---
  async getContacts() {
    const { data, error } = await supabase
      .from('notification_contacts')
      .select('*')
      .order('role')
      .order('name');
    if (error) throw error;
    return data || [];
  },

  async getActiveContacts() {
    const { data, error } = await supabase
      .from('notification_contacts')
      .select('*')
      .eq('is_active', true)
      .order('role')
      .order('name');
    if (error) throw error;
    return data || [];
  },

  async getContactsByRole(role) {
    const { data, error } = await supabase
      .from('notification_contacts')
      .select('*')
      .eq('role', role)
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return data || [];
  },

  async updateContactRole(contactId, role) {
    const { error } = await supabase
      .from('notification_contacts')
      .update({ role })
      .eq('id', contactId);
    if (error) throw error;
  },

  // --- ATTACHMENTS ---
  async getAttachments(eventId) {
    const { data, error } = await supabase
      .from('calendar_attachments')
      .select('*')
      .eq('event_id', eventId)
      .order('uploaded_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async uploadAttachment(eventId, file) {
    const filePath = `events/${eventId}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from('calendar-attachments')
      .upload(filePath, file);
    if (uploadError) throw uploadError;

    const { data: meta, error: metaError } = await supabase
      .from('calendar_attachments')
      .insert({
        event_id: eventId,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: filePath,
      })
      .select()
      .single();
    if (metaError) throw metaError;
    return meta;
  },

  async deleteAttachment(attachment) {
    await supabase.storage
      .from('calendar-attachments')
      .remove([attachment.storage_path]);

    const { error } = await supabase
      .from('calendar_attachments')
      .delete()
      .eq('id', attachment.id);
    if (error) throw error;
  },

  getAttachmentUrl(storagePath) {
    const { data } = supabase.storage
      .from('calendar-attachments')
      .getPublicUrl(storagePath, {
        download: true,
      });
    return data?.publicUrl;
  },

  // Get a signed URL for downloading with the original file name
  async getSignedDownloadUrl(storagePath, fileName) {
    const { data, error } = await supabase.storage
      .from('calendar-attachments')
      .createSignedUrl(storagePath, 3600, {
        download: fileName || true,
      });
    if (error) throw error;
    return data?.signedUrl;
  },

  // --- SEED HOLIDAYS ---
  async seedHolidays(holidays) {
    // Check if holidays already exist
    const { data: existing } = await supabase
      .from('calendar_events')
      .select('id')
      .eq('event_type', 'holiday')
      .limit(1);
    
    if (existing && existing.length > 0) {
      console.log('Holidays already seeded');
      return 0;
    }

    const events = holidays.map(h => ({
      title: h.title,
      description: h.description || '',
      start_time: h.date + 'T00:00:00-03:00',
      end_time: h.date + 'T23:59:59-03:00',
      event_type: 'holiday',
      color: h.color || '#dc2626',
      location: '',
      is_recurring: false,
      status: 'active',
    }));

    const { error } = await supabase
      .from('calendar_events')
      .insert(events);
    if (error) throw error;
    return events.length;
  },
};
