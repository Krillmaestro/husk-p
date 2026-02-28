'use client';
import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';

const STATUS_OPTIONS = [
  { value: 'intressant', label: 'Intressant', color: '#3b82f6', icon: '👀' },
  { value: 'kontaktad', label: 'Kontaktad', color: '#a855f7', icon: '📞' },
  { value: 'visning', label: 'Visning bokad', color: '#f97316', icon: '📅' },
  { value: 'besökt', label: 'Besökt', color: '#22c55e', icon: '✅' },
  { value: 'budgivning', label: 'Budgivning', color: '#ef4444', icon: '🔥' },
  { value: 'avslag', label: 'Nej tack', color: '#64748b', icon: '✗' },
];

function getStatus(val) {
  return STATUS_OPTIONS.find(s => s.value === val) || STATUS_OPTIONS[0];
}

function formatPrice(p) {
  if (!p) return '—';
  if (p >= 1000000) return (p / 1000000).toFixed(1).replace('.0', '') + ' mkr';
  if (p >= 1000) return (p / 1000).toFixed(0) + ' tkr';
  return p + ' kr';
}

function kvmPrice(p, s) {
  if (!p || !s) return null;
  return Math.round(p / s);
}

function kvmColor(v) {
  if (!v) return 'var(--text2)';
  if (v < 50000) return 'var(--green)';
  if (v < 65000) return 'var(--yellow)';
  return 'var(--red)';
}

const EMPTY_FORM = {
  addr: '', area: '', price: '', sqm: '', rooms: '', floor: '',
  fee: '', hiss: 0, status: 'intressant', note: '', url: '',
};

/* ─── Main component ─── */
export default function Tracker() {
  const [apartments, setApartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingNote, setEditingNote] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [sort, setSort] = useState('newest');
  const [statusFilter, setStatusFilter] = useState('all');
  const [saving, setSaving] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(() => {
    fetch('/api/apartments')
      .then(r => r.json())
      .then(d => { setApartments(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateApt = useCallback(async (id, fields) => {
    setSaving(s => ({ ...s, [id]: true }));
    try {
      const res = await fetch(`/api/apartments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const updated = await res.json();
      setApartments(prev => prev.map(a => a.id === id ? updated : a));
    } catch (e) { console.error(e); }
    setSaving(s => ({ ...s, [id]: false }));
  }, []);

  const deleteApt = useCallback(async (id) => {
    try {
      await fetch(`/api/apartments/${id}`, { method: 'DELETE' });
      setApartments(prev => prev.filter(a => a.id !== id));
      setExpanded(null);
      setConfirmDelete(null);
    } catch (e) { console.error(e); }
  }, []);

  const addApt = useCallback(async () => {
    if (!form.addr.trim()) return;
    try {
      const body = {
        ...form,
        price: form.price ? Number(form.price) : null,
        sqm: form.sqm ? Number(form.sqm) : null,
        rooms: form.rooms ? Number(form.rooms) : null,
        fee: form.fee ? Number(form.fee) : null,
        hiss: form.hiss ? 1 : 0,
      };
      const res = await fetch('/api/apartments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const apt = await res.json();
      setApartments(prev => [apt, ...prev]);
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
    } catch (e) { console.error(e); }
  }, [form]);

  const filtered = useMemo(() => {
    let list = [...apartments];
    if (statusFilter !== 'all') list = list.filter(a => a.status === statusFilter);

    list.sort((a, b) => {
      switch (sort) {
        case 'newest': return new Date(b.created_at) - new Date(a.created_at);
        case 'price_asc': return (a.price || 9e9) - (b.price || 9e9);
        case 'price_desc': return (b.price || 0) - (a.price || 0);
        case 'sqm_desc': return (b.sqm || 0) - (a.sqm || 0);
        case 'kvm': {
          const ka = kvmPrice(a.price, a.sqm) || 9e9;
          const kb = kvmPrice(b.price, b.sqm) || 9e9;
          return ka - kb;
        }
        default: return 0;
      }
    });
    return list;
  }, [apartments, sort, statusFilter]);

  const stats = useMemo(() => {
    const total = apartments.length;
    const visningar = apartments.filter(a => a.status === 'visning' || a.status === 'besökt').length;
    const withPrice = apartments.filter(a => a.price && a.sqm);
    const avgKvm = withPrice.length
      ? Math.round(withPrice.reduce((s, a) => s + a.price / a.sqm, 0) / withPrice.length)
      : 0;
    const favoriter = apartments.filter(a => a.favorit).length;
    return { total, visningar, avgKvm, favoriter };
  }, [apartments]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text2)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏠</div>
          <div>Laddar...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 26, letterSpacing: '-0.5px' }}>
            🏠 Lägenhetsjakten
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: 14, marginTop: 4 }}>
            Håll koll på objekt, visningar & intryck
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{
          background: showForm ? 'var(--border)' : 'var(--accent)',
          color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px',
          fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
          transition: 'all 0.2s',
        }}>
          {showForm ? '✕ Stäng' : '+ Lägg till'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12,
          padding: 24, marginBottom: 24, animation: 'fadeIn 0.2s ease',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Ny lägenhet</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Adress *" value={form.addr} onChange={v => setForm(f => ({ ...f, addr: v }))} placeholder="T.ex. Storgatan 5, 3tr" span={2} />
            <Input label="Område" value={form.area} onChange={v => setForm(f => ({ ...f, area: v }))} placeholder="T.ex. Södermalm" />
            <Input label="Pris (kr)" value={form.price} onChange={v => setForm(f => ({ ...f, price: v }))} placeholder="3500000" type="number" />
            <Input label="Yta (m²)" value={form.sqm} onChange={v => setForm(f => ({ ...f, sqm: v }))} placeholder="75" type="number" />
            <Input label="Rum" value={form.rooms} onChange={v => setForm(f => ({ ...f, rooms: v }))} placeholder="3" type="number" />
            <Input label="Våning" value={form.floor} onChange={v => setForm(f => ({ ...f, floor: v }))} placeholder="2" />
            <Input label="Avgift (kr/mån)" value={form.fee} onChange={v => setForm(f => ({ ...f, fee: v }))} placeholder="4500" type="number" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form.hiss}
                  onChange={() => setForm(f => ({ ...f, hiss: f.hiss ? 0 : 1 }))}
                  style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
                🛗 Hiss
              </label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                style={{
                  background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)',
                  borderRadius: 6, padding: '6px 10px', fontSize: 13,
                }}>
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.icon} {s.label}</option>
                ))}
              </select>
            </div>
            <Input label="Länk (Hemnet, Booli, etc.)" value={form.url} onChange={v => setForm(f => ({ ...f, url: v }))} placeholder="https://..." span={2} />
            <Input label="Anteckning" value={form.note} onChange={v => setForm(f => ({ ...f, note: v }))} placeholder="Första intryck, tankar..." span={2} textarea />
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button onClick={addApt} disabled={!form.addr.trim()} style={{
              background: form.addr.trim() ? 'var(--accent)' : 'var(--border)',
              color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px',
              fontSize: 14, fontWeight: 600, cursor: form.addr.trim() ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font-sans)', opacity: form.addr.trim() ? 1 : 0.5,
            }}>
              Spara
            </button>
            <button onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); }} style={{
              background: 'transparent', color: 'var(--text2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}>
              Avbryt
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Sparade', value: stats.total, color: 'var(--accent)' },
          { label: 'Visningar', value: stats.visningar, color: 'var(--orange)' },
          { label: 'Snitt kr/m²', value: stats.avgKvm ? stats.avgKvm.toLocaleString('sv') : '—', color: 'var(--yellow)' },
          { label: 'Favoriter', value: stats.favoriter, color: 'var(--red)' },
        ].map((s, i) => (
          <div key={i} style={{
            background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
            padding: '14px 16px',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <select value={sort} onChange={e => setSort(e.target.value)} style={selectStyle}>
          <option value="newest">Senast tillagd</option>
          <option value="price_asc">Pris ↑</option>
          <option value="price_desc">Pris ↓</option>
          <option value="sqm_desc">Yta ↓</option>
          <option value="kvm">Kr/m² ↑</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="all">Alla statusar</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s.value} value={s.value}>{s.icon} {s.label}</option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text2)', marginLeft: 'auto' }}>
          {filtered.length} av {apartments.length}
        </span>
      </div>

      {/* Empty state */}
      {apartments.length === 0 && !showForm && (
        <div style={{
          textAlign: 'center', padding: '60px 20px', color: 'var(--text2)',
          background: 'var(--bg2)', borderRadius: 12, border: '1px dashed var(--border)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏠</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
            Inga lägenheter ännu
          </div>
          <div style={{ fontSize: 14, marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' }}>
            Börja med att lägga till lägenheter ni hittar på Hemnet, Booli eller via mäklare.
          </div>
          <button onClick={() => setShowForm(true)} style={{
            background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8,
            padding: '12px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}>
            + Lägg till första lägenheten
          </button>
        </div>
      )}

      {/* Apartment cards */}
      {filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(apt => {
            const kvm = kvmPrice(apt.price, apt.sqm);
            const isExpanded = expanded === apt.id;
            const st = getStatus(apt.status);

            return (
              <div key={apt.id} style={{
                background: isExpanded ? 'var(--bg3)' : 'var(--bg2)',
                border: `1px solid ${apt.favorit ? 'var(--red)' : 'var(--border)'}`,
                borderRadius: 10, overflow: 'hidden',
                transition: 'all 0.2s',
              }}>
                {/* Card header row */}
                <div
                  onClick={() => setExpanded(isExpanded ? null : apt.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {apt.favorit ? <span style={{ fontSize: 14 }}>❤️</span> : null}
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{apt.addr}</span>
                      {apt.area ? <span style={{ fontSize: 12, color: 'var(--text2)' }}>· {apt.area}</span> : null}
                      {apt.hiss ? <span style={{ fontSize: 11 }} title="Hiss">🛗</span> : null}
                      {apt.prissankt ? <span style={{
                        background: 'var(--red)', color: '#fff', fontSize: 9,
                        padding: '1px 5px', borderRadius: 3, fontWeight: 700,
                      }}>SÄNKT</span> : null}
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 13, color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
                      {apt.price ? <span>{formatPrice(apt.price)}</span> : null}
                      {apt.sqm ? <span>{apt.sqm} m²</span> : null}
                      {apt.rooms ? <span>{apt.rooms} rum</span> : null}
                      {apt.floor ? <span>vån {apt.floor}</span> : null}
                      {apt.fee ? <span>{apt.fee.toLocaleString('sv')} kr/mån</span> : null}
                      {kvm ? <span style={{ color: kvmColor(kvm), fontWeight: 600 }}>{kvm.toLocaleString('sv')} kr/m²</span> : null}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      background: st.color + '18', color: st.color, padding: '4px 10px',
                      borderRadius: 6, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                    }}>
                      {st.icon} {st.label}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text2)', transform: isExpanded ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }}>▼</span>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, paddingTop: 16 }}>

                      {/* Left: info */}
                      <div>
                        {/* Status changer */}
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {STATUS_OPTIONS.map(s => (
                              <button key={s.value}
                                onClick={(e) => { e.stopPropagation(); updateApt(apt.id, { status: s.value }); }}
                                style={{
                                  background: apt.status === s.value ? s.color + '22' : 'var(--bg)',
                                  color: apt.status === s.value ? s.color : 'var(--text2)',
                                  border: `1px solid ${apt.status === s.value ? s.color + '44' : 'var(--border)'}`,
                                  borderRadius: 6, padding: '4px 10px', fontSize: 11,
                                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                                }}>
                                {s.icon} {s.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Visning */}
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Visning</div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input type="date" value={apt.visning_date || ''}
                              onChange={e => { e.stopPropagation(); updateApt(apt.id, { visning_date: e.target.value }); }}
                              style={inputMiniStyle} />
                            <input type="time" value={apt.visning_time || ''}
                              onChange={e => { e.stopPropagation(); updateApt(apt.id, { visning_time: e.target.value }); }}
                              style={inputMiniStyle} />
                          </div>
                          {apt.visning_date && (
                            <div style={{ marginTop: 6 }}>
                              <textarea
                                placeholder="Intryck efter visning..."
                                value={apt.visning_intryck || ''}
                                onChange={e => setApartments(prev => prev.map(a => a.id === apt.id ? { ...a, visning_intryck: e.target.value } : a))}
                                onBlur={e => updateApt(apt.id, { visning_intryck: e.target.value })}
                                onClick={e => e.stopPropagation()}
                                rows={2}
                                style={{ ...textareaStyle, width: '100%' }}
                              />
                            </div>
                          )}
                        </div>

                        {apt.note && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mäklarinfo</div>
                            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{apt.note}</div>
                          </div>
                        )}

                        {apt.url && (
                          <a href={apt.url} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ color: 'var(--accent)', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            🔗 Visa annons ↗
                          </a>
                        )}
                      </div>

                      {/* Right: notes & actions */}
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Våra anteckningar</div>
                        {editingNote === apt.id ? (
                          <div>
                            <textarea
                              value={noteText}
                              onChange={e => setNoteText(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  updateApt(apt.id, { user_notes: noteText });
                                  setEditingNote(null);
                                }
                                if (e.key === 'Escape') setEditingNote(null);
                              }}
                              onClick={e => e.stopPropagation()}
                              autoFocus
                              rows={3}
                              style={{ ...textareaStyle, width: '100%', borderColor: 'var(--accent)' }}
                            />
                            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>Enter = spara · Esc = avbryt</div>
                          </div>
                        ) : (
                          <div
                            onClick={e => { e.stopPropagation(); setEditingNote(apt.id); setNoteText(apt.user_notes || ''); }}
                            style={{
                              fontSize: 13, color: apt.user_notes ? 'var(--text)' : 'var(--text2)',
                              cursor: 'pointer', padding: 10, background: 'var(--bg)', borderRadius: 8,
                              minHeight: 60, border: '1px dashed var(--border)', lineHeight: 1.5,
                            }}>
                            {apt.user_notes || 'Klicka för att skriva anteckningar...'}
                          </div>
                        )}

                        {/* Action buttons */}
                        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            onClick={e => { e.stopPropagation(); updateApt(apt.id, { favorit: apt.favorit ? 0 : 1 }); }}
                            style={{
                              ...btnStyle,
                              background: apt.favorit ? '#ef444422' : 'var(--bg)',
                              color: apt.favorit ? 'var(--red)' : 'var(--text2)',
                              borderColor: apt.favorit ? '#ef444444' : 'var(--border)',
                            }}>
                            {apt.favorit ? '❤️ Favorit' : '🤍 Favorit'}
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); updateApt(apt.id, { prissankt: apt.prissankt ? 0 : 1 }); }}
                            style={{
                              ...btnStyle,
                              background: apt.prissankt ? '#ef444422' : 'var(--bg)',
                              color: apt.prissankt ? 'var(--red)' : 'var(--text2)',
                              borderColor: apt.prissankt ? '#ef444444' : 'var(--border)',
                            }}>
                            {apt.prissankt ? '🏷️ Prissänkt' : '🏷️ Prissänkt?'}
                          </button>
                          {confirmDelete === apt.id ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <span style={{ fontSize: 12, color: 'var(--red)' }}>Säker?</span>
                              <button onClick={e => { e.stopPropagation(); deleteApt(apt.id); }}
                                style={{ ...btnStyle, color: 'var(--red)', borderColor: '#ef444444' }}>Ja, ta bort</button>
                              <button onClick={e => { e.stopPropagation(); setConfirmDelete(null); }}
                                style={btnStyle}>Avbryt</button>
                            </div>
                          ) : (
                            <button onClick={e => { e.stopPropagation(); setConfirmDelete(apt.id); }}
                              style={{ ...btnStyle, marginLeft: 'auto' }}>
                              🗑️
                            </button>
                          )}
                        </div>
                        {saving[apt.id] && <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6 }}>Sparar...</div>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div style={{ marginTop: 28, padding: 16, background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text2)' }}>
          <span><span style={{ color: 'var(--green)' }}>●</span> &lt;50k kr/m²</span>
          <span><span style={{ color: 'var(--yellow)' }}>●</span> 50-65k kr/m²</span>
          <span><span style={{ color: 'var(--red)' }}>●</span> &gt;65k kr/m²</span>
          <span>🛗 Hiss</span>
          <span>❤️ Favorit</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Reusable Input ─── */
function Input({ label, value, onChange, placeholder = '', type = 'text', span = 1, textarea = false }) {
  const Tag = textarea ? 'textarea' : 'input';
  return (
    <div style={{ gridColumn: span > 1 ? `span ${span}` : undefined }}>
      <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{label}</label>
      <Tag
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={textarea ? 2 : undefined}
        style={{
          width: '100%', background: 'var(--bg)', color: 'var(--text)',
          border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px',
          fontSize: 14, fontFamily: 'var(--font-sans)',
          ...(textarea ? { resize: 'vertical' } : {}),
        }}
      />
    </div>
  );
}

/* ─── Shared styles ─── */
const selectStyle = {
  background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '6px 10px', fontSize: 13, fontFamily: 'var(--font-sans)',
};

const inputMiniStyle = {
  background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '6px 8px', fontSize: 13, fontFamily: 'var(--font-mono)',
};

const textareaStyle = {
  background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 6, padding: 8, fontSize: 13, fontFamily: 'var(--font-sans)', resize: 'vertical',
};

const btnStyle = {
  background: 'var(--bg)', color: 'var(--text2)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};
