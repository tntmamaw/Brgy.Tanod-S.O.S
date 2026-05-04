import { useState } from 'react';
import { AuditLogArchive } from '../../types/auditLog';
import { mockArchives } from '../../data/mock/auditLogArchives';
import { User } from '../../types';
import { supabase } from '../../lib/supabase';

export function ReviewArchivedLogsDrawer({ profile }: { profile: User | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [archives, setArchives] = useState<AuditLogArchive[]>([]);
  const [selectedArchive, setSelectedArchive] = useState<AuditLogArchive | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // GUARD: Admin only — fully unmounted for non-admin roles
  if (profile?.role !== 'admin') return null;

  const fetchArchives = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_log_archives')
        .select('*')
        .order('archived_at', { ascending: false });
      
      if (error) throw error;
      setArchives(data || []);
    } catch (err) {
      console.error('Failed to fetch archives from Supabase:', err);
      // Fallback to mock for development if Supabase fails
      setArchives(mockArchives);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    fetchArchives();
  };

  const exportAsJSON = (archive: AuditLogArchive) => {
    const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${archive.session_date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* TRIGGER BUTTON */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-4 py-2 bg-[#0F172A] border border-amber-500
                   text-amber-400 text-sm font-semibold rounded-lg
                   hover:bg-amber-500 hover:text-[#0F172A] transition-all
                   min-h-[48px] active:scale-95"
      >
        📁 Review Archived Logs
      </button>

      {/* SLIDE-IN DRAWER */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => { setIsOpen(false); setSelectedArchive(null); }}
          />
          <div className="relative w-full max-w-md h-full bg-[#0F172A] border-l border-amber-500/30
                          flex flex-col overflow-hidden shadow-2xl">

            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div>
                <h2 className="text-amber-400 font-bold text-base tracking-wide uppercase">
                  Archived Audit Logs
                </h2>
                <p className="text-white/40 text-xs mt-0.5">Admin access only · Auto-saved daily at 07:00 AM</p>
              </div>
              <button
                onClick={() => { setIsOpen(false); setSelectedArchive(null); }}
                className="text-white/50 hover:text-white text-xl min-w-[44px] min-h-[44px]
                           flex items-center justify-center"
              >✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {isLoading && (
                <div className="space-y-3">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
                  ))}
                </div>
              )}

              {!isLoading && archives.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-white/30">
                  <span className="text-3xl mb-2">🗂️</span>
                  <p className="text-sm font-medium">No archived logs found</p>
                </div>
              )}

              {!isLoading && archives.map(archive => (
                <div key={archive.id} className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-white font-semibold text-sm">{archive.session_date}</p>
                      <p className="text-white/40 text-xs">
                        Archived {new Date(archive.archived_at).toLocaleTimeString()} · {archive.log_count} entries
                      </p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-green-400 text-xs">✔ {archive.resolved_count} resolved</span>
                        <span className="text-red-400 text-xs">⚠ {archive.unresolved_count} open</span>
                      </div>
                    </div>
                    <span className="text-xs text-white/30 bg-white/5 px-2 py-1 rounded-full shrink-0">
                      {archive.archived_by === 'system' ? '🤖 Auto' : '👤 Manual'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedArchive(archive)}
                      className="flex-1 py-2 text-xs font-semibold bg-amber-500/10 text-amber-400
                                 border border-amber-500/30 rounded-lg hover:bg-amber-500/20
                                 transition-all min-h-[40px]"
                    >👁 Preview</button>
                    <button
                      onClick={() => exportAsJSON(archive)}
                      className="flex-1 py-2 text-xs font-semibold bg-blue-500/10 text-blue-400
                                 border border-blue-500/30 rounded-lg hover:bg-blue-500/20
                                 transition-all min-h-[40px]"
                    >⬇ Export JSON</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {selectedArchive && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => setSelectedArchive(null)} />
          <div className="relative w-full max-w-lg max-h-[80vh] bg-[#0F172A]
                          border border-amber-500/40 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h3 className="text-amber-400 font-bold text-sm uppercase tracking-wide">
                Log Preview — {selectedArchive.session_date}
              </h3>
              <button
                onClick={() => setSelectedArchive(null)}
                className="text-white/50 hover:text-white min-w-[44px] min-h-[44px]
                           flex items-center justify-center text-lg"
              >✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {selectedArchive.log_entries.map(entry => (
                <div key={entry.id} className="bg-white/5 border border-white/10 rounded-lg p-3 text-xs">
                  <div className="flex justify-between items-start mb-1">
                    <span className={`font-bold ${
                      entry.type === 'Medical' ? 'text-blue-400' :
                      entry.type === 'Fire' ? 'text-orange-400' :
                      entry.type === 'Crime' ? 'text-red-400' : 'text-amber-400'
                    }`}>
                      {entry.type === 'Medical' ? '🏥' :
                       entry.type === 'Fire' ? '🔥' :
                       entry.type === 'Crime' ? '🚨' : '⚠️'} {entry.type}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full font-medium ${
                      entry.status === 'Resolved'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>{entry.status}</span>
                  </div>
                  <p className="text-white/50">Tanod: {entry.tanod_assigned ?? 'Unassigned'}</p>
                  <p className="text-white/30">{new Date(entry.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
