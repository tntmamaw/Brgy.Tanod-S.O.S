// /supabase/functions/archive-logs/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async () => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Fetch current active reports
    const { data: logs, error: fetchError } = await supabase
      .from('report_logs')
      .select('*');

    if (fetchError) throw fetchError;

    // 2. Prepare Archive
    const archive = {
      id: crypto.randomUUID(),
      session_date: today,
      archived_at: new Date().toISOString(),
      archived_by: 'system',
      log_count: logs?.length || 0,
      log_entries: logs || [],
      total_incidents: logs?.length || 0,
      resolved_count: logs?.filter((l: any) => l.status === 'Resolved').length || 0,
      unresolved_count: logs?.filter((l: any) => l.status !== 'Resolved').length || 0,
    };

    // 3. Insert into Archives
    const { error: archiveError } = await supabase
      .from('audit_log_archives')
      .insert(archive);

    if (archiveError) throw archiveError;

    // 4. Clear Active Logs
    const { error: deleteError } = await supabase
      .from('report_logs')
      .delete()
      .neq('id', 'placeholder'); // Delete all

    if (deleteError) throw deleteError;

    // 5. Broadcast Reset Event to all active Admin/Tanod sessions
    await supabase.channel('system-events').send({
      type: 'broadcast',
      event: 'logs_reset',
      payload: { timestamp: new Date().toISOString(), session_date: today }
    });

    console.log(`[SCHEDULER] Audit logs archived & reset at 07:00 AM — ${today}`);
    return new Response(JSON.stringify({ status: 'success', date: today }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    console.error('Archive Error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
