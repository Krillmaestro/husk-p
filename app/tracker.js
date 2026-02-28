'use client';
import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';

const STATUS_LABELS = {
  active: { label: 'Till salu', color: '#22c55e' },
  coming: { label: 'Kommande', color: '#f97316' },
  bidding: { label: 'Budgivning', color: '#ef4444' },
  uncertain: { label: 'Verifiera', color: '#a855f7' },
};

function formatPrice(p) {
  if (!p) return '—';
  if (p >= 1000000) return (p / 1000000).toFixed(1).replace('.0', '') + ' M';
  return (p / 1000).toFixed(0) + ' k';
}

function kvm(p, s) {
  if (!p || !s) return null;
  return Math.round(p / s);
}

function kvmColor(v) {
  if (!v) return '#94a3b8';
  if (v < 50000) return '#22c55e';
  if (v < 65000) return '#eab308';
  return '#ef4444';
}

export default function Tracker() {
  const [apartments, setApartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [sort, setSort] = useState('kvm');
  const [filters, setFilters] = useState({ hiss: false, min75: false, hideContacted: false });
  const [saving, setSaving] = useState({});

  useEffect(() => {
    fetch('/api/apartments')
      .then(r => r.json())
      .then(d => { setApartments(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

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
    } catch (e) {
      console.error('Update failed:', e);
    }
    setSaving(s => ({ ...s, [id]: false }));
  }, []);

  const filtered = useMemo(() => {
    let list = [...apartments];
    if (filters.hiss) list = list.filter(a => a.hiss === 1);
    if (filters.min75) list = list.filter(a => a.sqm >= 75);
    if (filters.hideContacted) list = list.filter(a => !a.contacted);

    list.sort((a, b) => {
      const ka = kvm(a.price, a.sqm), kb = kvm(b.price, b.sqm);
      switch (sort) {
        case 'kvm': return (ka || 999999) - (kb || 999999);
        case 'price_asc': return (a.price || 999999999) - (b.price || 999999999);
        case 'sqm_desc': return b.sqm - a.sqm;
        case 'rooms_desc': return b.rooms - a.rooms;
        default: return 0;
      }
    });
    return list;
  }, [apartments, sort, filters]);

  const stats = useMemo(() => {
    const total = apartments.length;
    const qualified = apartments.filter(a => a.sqm >= 75 && a.hiss === 1).length;
    const contacted = apartments.filter(a => a.contacted).length;
    const withPrice = apartments.filter(a => a.price && a.sqm);
    const avgKvm = withPrice.length > 0
      ? Math.round(withPrice.reduce((s, a) => s + a.price / a.sqm, 0) / withPrice.length)
      : 0;
    return { total, qualified, contacted, avgKvm };
  }, [apartments]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>
        Laddar bostäder...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 28, marginBottom: 4 }}>
          🏠 Näsby Park Tracker
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 14 }}>Interaktiv bostadsbevakning – Täby kommun</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Objekt', value: stats.total, color: '#3b82f6' },
          { label: '≥75m² + Hiss', value: stats.qualified, color: '#22c55e' },
          { label: 'Snitt kr/m²', value: stats.avgKvm ? stats.avgKvm.toLocaleString('sv') : '—', color: '#eab308' },
          { label: 'Kontaktade', value: stats.contacted, color: '#a855f7' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#111827', border: '1px solid #2a3548', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <select value={sort} onChange={e => setSort(e.target.value)}
          style={{ background: '#1a2234', color: '#e2e8f0', border: '1px solid #2a3548', borderRadius: 6, padding: '6px 10px', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
          <option value="kvm">Kr/m² ↑</option>
          <option value="price_asc">Pris ↑</option>
          <option value="sqm_desc">Yta ↓</option>
          <option value="rooms_desc">Rum ↓</option>
        </select>
        {[
          { key: 'hiss', label: 'Bara hiss' },
          { key: 'min75', label: '≥75 m²' },
          { key: 'hideContacted', label: 'Dölj kontaktade' },
        ].map(f => (
          <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#94a3b8', cursor: 'pointer' }}>
            <input type="checkbox" checked={filters[f.key]}
              onChange={() => setFilters(p => ({ ...p, [f.key]: !p[f.key] }))}
              style={{ accentColor: '#3b82f6' }} />
            {f.label}
          </label>
        ))}
        <span style={{ fontSize: 12, color: '#64748b', marginLeft: 'auto' }}>
          {filtered.length} visas
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #2a3548' }}>
              {['✓', 'Adress', 'Pris', 'Yta', 'Rum', 'Vån', 'Avgift', 'Kr/m²', 'Status'].map(h => (
                <th key={h} style={{ padding: '8px 6px', textAlign: 'left', color: '#64748b', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(apt => {
              const kvmVal = kvm(apt.price, apt.sqm);
              const isExpanded = expanded === apt.id;
              const statusInfo = STATUS_LABELS[apt.status] || STATUS_LABELS.active;

              return (
                <Fragment key={apt.id}>
                  <tr
                    onClick={() => setExpanded(isExpanded ? null : apt.id)}
                    style={{
                      borderBottom: '1px solid #1e293b',
                      cursor: 'pointer',
                      opacity: apt.contacted ? 0.45 : 1,
                      textDecoration: apt.contacted ? 'line-through' : 'none',
                      transition: 'background 0.15s',
                      background: isExpanded ? '#1a2234' : 'transparent',
                    }}
                    onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#111827'; }}
                    onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '10px 6px', width: 36 }}>
                      <input type="checkbox" checked={!!apt.contacted}
                        onChange={e => { e.stopPropagation(); updateApt(apt.id, { contacted: apt.contacted ? 0 : 1 }); }}
                        style={{ accentColor: '#22c55e', cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '10px 6px', fontWeight: 500, maxWidth: 280 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{apt.addr}</span>
                        {apt.prissankt ? <span style={{ background: '#ef4444', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>SÄNKT</span> : null}
                        {apt.hiss === 1 ? <span style={{ fontSize: 10, color: '#22c55e' }} title="Hiss">🛗</span> : null}
                        {apt.hiss === null ? <span style={{ fontSize: 10, color: '#eab308' }} title="Hiss oklar">❓</span> : null}
                      </div>
                    </td>
                    <td style={{ padding: '10px 6px' }}>{formatPrice(apt.price)}</td>
                    <td style={{ padding: '10px 6px' }}>{apt.sqm}</td>
                    <td style={{ padding: '10px 6px' }}>{apt.rooms}</td>
                    <td style={{ padding: '10px 6px', color: '#94a3b8' }}>{apt.floor || '—'}</td>
                    <td style={{ padding: '10px 6px', color: '#94a3b8' }}>{apt.fee ? apt.fee.toLocaleString('sv') : '—'}</td>
                    <td style={{ padding: '10px 6px', fontWeight: 700, color: kvmColor(kvmVal) }}>
                      {kvmVal ? kvmVal.toLocaleString('sv') : '—'}
                    </td>
                    <td style={{ padding: '10px 6px' }}>
                      <span style={{
                        background: statusInfo.color + '22',
                        color: statusInfo.color,
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                      }}>{statusInfo.label}</span>
                    </td>
                  </tr>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={9} style={{ padding: '0 6px 12px', background: '#1a2234' }}>
                        <div style={{ padding: '12px 16px', borderRadius: '0 0 8px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                          <div>
                            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' }}>Mäklarnot</div>
                            <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5 }}>{apt.note || '—'}</div>
                            {apt.fee && (
                              <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
                                Avgift: <strong>{apt.fee.toLocaleString('sv')} kr/mån</strong>
                              </div>
                            )}
                            {apt.url && (
                              <div style={{ marginTop: 8 }}>
                                <a href={apt.url} target="_blank" rel="noopener noreferrer"
                                  style={{ color: '#3b82f6', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  🔗 Visa annons ↗
                                </a>
                              </div>
                            )}
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' }}>Dina anteckningar</div>
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
                                  autoFocus
                                  rows={3}
                                  style={{
                                    width: '100%', background: '#0b0f19', color: '#e2e8f0', border: '1px solid #3b82f6',
                                    borderRadius: 6, padding: 8, fontSize: 13, fontFamily: 'var(--font-sans)', resize: 'vertical',
                                  }}
                                />
                                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Enter = spara · Esc = avbryt</div>
                              </div>
                            ) : (
                              <div
                                onClick={e => { e.stopPropagation(); setEditingNote(apt.id); setNoteText(apt.user_notes || ''); }}
                                style={{
                                  fontSize: 13, color: apt.user_notes ? '#cbd5e1' : '#4a5568',
                                  cursor: 'pointer', padding: 8, background: '#111827', borderRadius: 6,
                                  minHeight: 48, border: '1px dashed #2a3548',
                                }}>
                                {apt.user_notes || 'Klicka för att lägga till anteckningar...'}
                              </div>
                            )}
                            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                              <button
                                onClick={e => { e.stopPropagation(); updateApt(apt.id, { contacted: apt.contacted ? 0 : 1 }); }}
                                style={{
                                  background: apt.contacted ? '#22c55e22' : '#1e293b',
                                  color: apt.contacted ? '#22c55e' : '#94a3b8',
                                  border: '1px solid ' + (apt.contacted ? '#22c55e44' : '#2a3548'),
                                  borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer',
                                  fontFamily: 'var(--font-sans)',
                                }}>
                                {apt.contacted ? '✓ Kontaktad' : 'Markera kontaktad'}
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); updateApt(apt.id, { hidden: apt.hidden ? 0 : 1 }); }}
                                style={{
                                  background: '#1e293b', color: '#94a3b8',
                                  border: '1px solid #2a3548', borderRadius: 6, padding: '6px 12px',
                                  fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                                }}>
                                {apt.hidden ? 'Visa igen' : 'Göm objekt'}
                              </button>
                            </div>
                            {saving[apt.id] && <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 4 }}>Sparar...</div>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ marginTop: 24, padding: 16, background: '#111827', borderRadius: 8, border: '1px solid #2a3548' }}>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>LEGEND</div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12 }}>
          <span><span style={{ color: '#22c55e' }}>■</span> &lt;50k kr/m²</span>
          <span><span style={{ color: '#eab308' }}>■</span> 50-65k kr/m²</span>
          <span><span style={{ color: '#ef4444' }}>■</span> &gt;65k kr/m²</span>
          <span>🛗 Hiss bekräftad</span>
          <span>❓ Hiss oklar</span>
          <span style={{ color: '#94a3b8' }}>Data: Hemnet/Booli feb 2026</span>
        </div>
      </div>
    </div>
  );
}


