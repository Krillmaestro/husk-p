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

function formatVisningDate(dateStr, timeStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const day = d.getDate();
  const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  const days = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'];
  const dayName = days[d.getDay()];
  const monthName = months[d.getMonth()];
  const diffDays = Math.ceil((d - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  let label = `${dayName} ${day} ${monthName}`;
  if (diffDays === 0) label = 'Idag';
  else if (diffDays === 1) label = 'Imorgon';
  else if (diffDays < 0) label = `${day} ${monthName} (passerad)`;
  if (timeStr) label += ` kl ${timeStr.slice(0, 5)}`;
  return { label, diffDays };
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
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState('');
  const [showPasteFallback, setShowPasteFallback] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [hoveredCard, setHoveredCard] = useState(null);

  const load = useCallback(() => {
    fetch('/api/apartments')
      .then(r => r.json())
      .then(d => { setApartments(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateApt = useCallback(async (id, fields) => {
    setSaving(s => ({ ...s, [id]: 'saving' }));
    try {
      const res = await fetch(`/api/apartments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const updated = await res.json();
      setApartments(prev => prev.map(a => a.id === id ? updated : a));
      setSaving(s => ({ ...s, [id]: 'saved' }));
      setTimeout(() => setSaving(s => ({ ...s, [id]: false })), 1500);
    } catch (e) {
      console.error(e);
      setSaving(s => ({ ...s, [id]: 'error' }));
      setTimeout(() => setSaving(s => ({ ...s, [id]: false })), 3000);
    }
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

  const applyScrapedData = useCallback((data) => {
    setForm(f => ({
      ...f,
      addr: data.addr || f.addr,
      area: data.area || f.area,
      price: data.price || f.price,
      sqm: data.sqm || f.sqm,
      rooms: data.rooms || f.rooms,
      floor: data.floor || f.floor,
      fee: data.fee || f.fee,
      hiss: data.hiss ?? f.hiss,
      note: data.note || f.note,
      url: data.url || f.url,
    }));
  }, []);

  const scrapeBooli = useCallback(async () => {
    if (!scrapeUrl.trim()) return;
    setScraping(true);
    setScrapeError('');
    setShowPasteFallback(false);
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScrapeError(data.error || 'Kunde inte hämta info');
        if (data.showPasteFallback) setShowPasteFallback(true);
        return;
      }
      applyScrapedData(data);
      setShowPasteFallback(false);
    } catch (e) {
      setScrapeError('Nätverksfel — kunde inte nå servern');
    } finally {
      setScraping(false);
    }
  }, [scrapeUrl, applyScrapedData]);

  const scrapeFromPaste = useCallback(async () => {
    if (!pasteText.trim()) return;
    setScraping(true);
    setScrapeError('');
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pastedText: pasteText.trim(), url: scrapeUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScrapeError(data.error || 'Kunde inte tolka texten');
        return;
      }
      applyScrapedData(data);
      setShowPasteFallback(false);
      setPasteText('');
    } catch (e) {
      setScrapeError('Nätverksfel — kunde inte nå servern');
    } finally {
      setScraping(false);
    }
  }, [pasteText, scrapeUrl, applyScrapedData]);

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

  const upcomingVisningar = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return apartments
      .filter(a => a.visning_date && new Date(a.visning_date + 'T00:00:00') >= now)
      .sort((a, b) => new Date(a.visning_date) - new Date(b.visning_date))
      .slice(0, 5);
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

          {/* Auto-fetch from Booli */}
          <div style={{
            display: 'flex', gap: 8, marginBottom: 16, alignItems: 'flex-end',
          }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
                Klistra in Booli- eller Hemnet-länk för att fylla i automatiskt
              </label>
              <input
                type="url"
                value={scrapeUrl}
                onChange={e => { setScrapeUrl(e.target.value); setScrapeError(''); }}
                placeholder="https://www.booli.se/annons/... eller https://www.hemnet.se/..."
                disabled={scraping}
                style={{
                  width: '100%', background: 'var(--bg)', color: 'var(--text)',
                  border: `1px solid ${scrapeError ? 'var(--red)' : 'var(--border)'}`, borderRadius: 6,
                  padding: '8px 10px', fontSize: 14, fontFamily: 'var(--font-sans)',
                }}
              />
            </div>
            <button
              onClick={scrapeBooli}
              disabled={scraping || !scrapeUrl.trim()}
              style={{
                background: scraping ? 'var(--border)' : 'var(--accent)',
                color: '#fff', border: 'none', borderRadius: 6,
                padding: '8px 16px', fontSize: 13, fontWeight: 600,
                cursor: scraping || !scrapeUrl.trim() ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
                opacity: scraping || !scrapeUrl.trim() ? 0.5 : 1,
                height: 38,
              }}>
              {scraping ? '⏳ Hämtar...' : '🔍 Hämta info'}
            </button>
          </div>
          {scrapeError && (
            <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 12, marginTop: -8 }}>
              {scrapeError}
            </div>
          )}
          {showPasteFallback && (
            <div style={{
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
              padding: 12, marginBottom: 16,
            }}>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>
                Sidan blockerade hämtningen. Kopiera annonstexten och klistra in den här istället:
              </div>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder="Klistra in annonstext här (adress, pris, storlek, rum, avgift osv.)..."
                rows={4}
                style={{
                  width: '100%', background: 'var(--bg2)', color: 'var(--text)',
                  border: '1px solid var(--border)', borderRadius: 6, padding: 8,
                  fontSize: 13, fontFamily: 'var(--font-sans)', resize: 'vertical',
                  marginBottom: 8,
                }}
              />
              <button
                onClick={scrapeFromPaste}
                disabled={scraping || !pasteText.trim()}
                style={{
                  background: pasteText.trim() ? 'var(--accent)' : 'var(--border)',
                  color: '#fff', border: 'none', borderRadius: 6,
                  padding: '8px 16px', fontSize: 13, fontWeight: 600,
                  cursor: pasteText.trim() ? 'pointer' : 'not-allowed',
                  fontFamily: 'var(--font-sans)',
                  opacity: pasteText.trim() ? 1 : 0.5,
                }}>
                {scraping ? '⏳ Tolkar...' : '✨ Fyll i från text'}
              </button>
            </div>
          )}

          <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
            <button onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); setScrapeUrl(''); setScrapeError(''); setShowPasteFallback(false); setPasteText(''); }} style={{
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
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
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

      {/* Upcoming visningar */}
      {upcomingVisningar.length > 0 && (
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
          padding: 16, marginBottom: 20,
        }}>
          <div style={{
            fontSize: 12, color: 'var(--orange)', marginBottom: 10,
            textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700,
          }}>
            Kommande visningar
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {upcomingVisningar.map(apt => {
              const v = formatVisningDate(apt.visning_date, apt.visning_time);
              return (
                <div key={apt.id}
                  onClick={() => setExpanded(apt.id)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', background: 'var(--bg)', borderRadius: 8,
                    cursor: 'pointer', border: '1px solid var(--border)',
                  }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{apt.addr}</span>
                    {apt.area ? <span style={{ fontSize: 12, color: 'var(--text2)', marginLeft: 6 }}>{apt.area}</span> : null}
                  </div>
                  <div style={{
                    fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)',
                    color: v && v.diffDays <= 2 ? 'var(--red)' : 'var(--orange)',
                  }}>
                    {v ? v.label : apt.visning_date}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
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
              <div key={apt.id}
                onMouseEnter={() => setHoveredCard(apt.id)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  background: isExpanded ? 'var(--bg3)'
                    : apt.status === 'budgivning' ? '#ef44440a'
                    : hoveredCard === apt.id ? 'var(--bg3)' : 'var(--bg2)',
                  border: apt.status === 'budgivning'
                    ? '1px solid #ef444433'
                    : `1px solid ${apt.favorit ? 'var(--red)' : 'var(--border)'}`,
                  borderLeft: `3px solid ${st.color}`,
                  borderRadius: 10, overflow: 'hidden',
                  transition: 'all 0.15s',
                  transform: hoveredCard === apt.id && !isExpanded ? 'translateX(2px)' : 'none',
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
                      {apt.bud_hogsta ? (
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>
                          🔥 {formatPrice(apt.bud_hogsta)}
                        </span>
                      ) : null}
                      {apt.bud_vart ? (
                        <span style={{
                          background: '#22c55e22', color: 'var(--green)', fontSize: 9,
                          padding: '1px 6px', borderRadius: 3, fontWeight: 700,
                        }}>VÅRT BUD</span>
                      ) : null}
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap', alignItems: 'baseline' }}>
                      {apt.price ? (
                        <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.5px' }}>
                          {formatPrice(apt.price)}
                        </span>
                      ) : null}
                      {kvm ? (
                        <span style={{ fontSize: 12, fontWeight: 600, color: kvmColor(kvm), fontFamily: 'var(--font-mono)' }}>
                          {kvm.toLocaleString('sv')} kr/m²
                        </span>
                      ) : null}
                      <span style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
                        {[
                          apt.sqm ? `${apt.sqm} m²` : null,
                          apt.rooms ? `${apt.rooms} rum` : null,
                          apt.floor ? `vån ${apt.floor}` : null,
                          apt.fee ? `${apt.fee.toLocaleString('sv')} kr/mån` : null,
                        ].filter(Boolean).join(' · ')}
                      </span>
                      {apt.visning_date ? (() => { const v = formatVisningDate(apt.visning_date, apt.visning_time); return v ? <span style={{ color: v.diffDays >= 0 && v.diffDays <= 2 ? 'var(--red)' : v.diffDays < 0 ? 'var(--text2)' : 'var(--orange)', fontWeight: 600, fontSize: 12 }}>📅 {v.label}</span> : null; })() : null}
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
                    <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, paddingTop: 16 }}>

                      {/* Left: info */}
                      <div>
                        {/* Status changer */}
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</div>
                          <div className="status-buttons" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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

                        {/* Redigera uppgifter */}
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Uppgifter</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                            {[
                              { key: 'price', label: 'Pris (kr)', type: 'number' },
                              { key: 'sqm', label: 'Yta (m²)', type: 'number' },
                              { key: 'rooms', label: 'Rum', type: 'number' },
                              { key: 'fee', label: 'Avgift (kr/mån)', type: 'number' },
                            ].map(f => (
                              <div key={f.key}>
                                <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 2 }}>{f.label}</div>
                                <input
                                  type={f.type}
                                  value={apt[f.key] || ''}
                                  onChange={e => setApartments(prev => prev.map(a => a.id === apt.id ? { ...a, [f.key]: e.target.value ? Number(e.target.value) : null } : a))}
                                  onBlur={e => updateApt(apt.id, { [f.key]: e.target.value ? Number(e.target.value) : null })}
                                  onClick={e => e.stopPropagation()}
                                  style={{ ...inputMiniStyle, width: '100%' }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Visning */}
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Visning</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            {(() => {
                              const today = new Date();
                              const quickDates = [];
                              for (let i = 0; i < 7; i++) {
                                const d = new Date(today);
                                d.setDate(d.getDate() + i);
                                const iso = d.toISOString().split('T')[0];
                                const days = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'];
                                const label = i === 0 ? 'Idag' : i === 1 ? 'Imorgon' : days[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1);
                                quickDates.push({ iso, label });
                              }
                              return quickDates.map(qd => (
                                <button key={qd.iso}
                                  onClick={e => { e.stopPropagation(); updateApt(apt.id, { visning_date: qd.iso }); }}
                                  style={{
                                    ...btnStyle, fontSize: 11, padding: '4px 8px',
                                    background: apt.visning_date === qd.iso ? '#f9731622' : 'var(--bg)',
                                    color: apt.visning_date === qd.iso ? 'var(--orange)' : 'var(--text2)',
                                    borderColor: apt.visning_date === qd.iso ? '#f9731644' : 'var(--border)',
                                    fontWeight: apt.visning_date === qd.iso ? 700 : 400,
                                  }}>
                                  {qd.label}
                                </button>
                              ));
                            })()}
                            <input type="date" value={apt.visning_date || ''}
                              onChange={e => { e.stopPropagation(); updateApt(apt.id, { visning_date: e.target.value }); }}
                              onClick={e => e.stopPropagation()}
                              title="Välj annat datum"
                              style={{ ...inputMiniStyle, width: 40, padding: '4px', opacity: 0.6, cursor: 'pointer' }} />
                          </div>
                          {apt.visning_date && (
                            <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <span style={{ fontSize: 12, color: 'var(--text2)' }}>Tid:</span>
                                {['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'].map(t => (
                                  <button key={t}
                                    onClick={e => { e.stopPropagation(); updateApt(apt.id, { visning_time: t }); }}
                                    style={{
                                      ...btnStyle, fontSize: 10, padding: '2px 6px',
                                      background: apt.visning_time === t ? '#f9731622' : 'var(--bg)',
                                      color: apt.visning_time === t ? 'var(--orange)' : 'var(--text2)',
                                      borderColor: apt.visning_time === t ? '#f9731644' : 'var(--border)',
                                      fontWeight: apt.visning_time === t ? 700 : 400,
                                    }}>
                                    {t}
                                  </button>
                                ))}
                              </div>
                              {apt.visning_date && (() => {
                                const v = formatVisningDate(apt.visning_date, apt.visning_time);
                                return v ? <span style={{ fontSize: 12, color: 'var(--orange)', fontWeight: 600 }}>📅 {v.label}</span> : null;
                              })()}
                              {apt.visning_date && (
                                <button onClick={e => { e.stopPropagation(); updateApt(apt.id, { visning_date: '', visning_time: '' }); }}
                                  style={{ ...btnStyle, fontSize: 10, padding: '2px 6px', color: 'var(--red)' }}>
                                  Rensa
                                </button>
                              )}
                            </div>
                          )}
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

                        {/* Budgivning */}
                        <div style={{
                          marginBottom: 12,
                          background: apt.status === 'budgivning' ? '#ef444410' : 'transparent',
                          border: apt.status === 'budgivning' ? '1px solid #ef444433' : 'none',
                          borderRadius: 8, padding: apt.status === 'budgivning' ? 12 : 0,
                        }}>
                          <div style={{
                            fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px',
                            color: apt.status === 'budgivning' ? 'var(--red)' : 'var(--text2)',
                            fontWeight: apt.status === 'budgivning' ? 700 : 400,
                          }}>
                            {apt.status === 'budgivning' ? 'Budgivning pågående' : 'Budgivning'}
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                              type="number"
                              placeholder="Högsta bud (kr)"
                              value={apt.bud_hogsta || ''}
                              onChange={e => setApartments(prev => prev.map(a => a.id === apt.id ? { ...a, bud_hogsta: e.target.value ? Number(e.target.value) : null } : a))}
                              onBlur={e => updateApt(apt.id, { bud_hogsta: e.target.value ? Number(e.target.value) : null })}
                              onClick={e => e.stopPropagation()}
                              style={{ ...inputMiniStyle, flex: 1 }}
                            />
                            <button
                              onClick={e => { e.stopPropagation(); updateApt(apt.id, { bud_vart: apt.bud_vart ? 0 : 1 }); }}
                              style={{
                                ...btnStyle,
                                background: apt.bud_vart ? '#22c55e22' : 'var(--bg)',
                                color: apt.bud_vart ? 'var(--green)' : 'var(--text2)',
                                borderColor: apt.bud_vart ? '#22c55e44' : 'var(--border)',
                                fontWeight: apt.bud_vart ? 700 : 400,
                              }}>
                              {apt.bud_vart ? '✓ Vi leder' : 'Vårt bud?'}
                            </button>
                          </div>
                          {apt.bud_hogsta && apt.price ? (
                            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                              <span>Utgångspris: {formatPrice(apt.price)}</span>
                              <span style={{ color: 'var(--red)', fontWeight: 600 }}>
                                +{formatPrice(apt.bud_hogsta - apt.price)} ({Math.round((apt.bud_hogsta - apt.price) / apt.price * 100)}%)
                              </span>
                              {apt.bud_vart ? <span style={{ color: 'var(--green)', fontWeight: 700 }}>Vi leder</span> : null}
                            </div>
                          ) : apt.bud_hogsta ? (
                            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                              Högsta bud: <strong style={{ color: 'var(--red)' }}>{formatPrice(apt.bud_hogsta)}</strong>
                              {apt.bud_vart ? <span style={{ color: 'var(--green)', marginLeft: 6 }}>(vårt)</span> : null}
                            </div>
                          ) : null}
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
                        {saving[apt.id] && (
                          <div style={{
                            fontSize: 12, marginTop: 8, padding: '4px 10px', borderRadius: 6, display: 'inline-block',
                            background: saving[apt.id] === 'saving' ? '#3b82f618' : saving[apt.id] === 'error' ? '#ef444418' : '#22c55e18',
                            color: saving[apt.id] === 'saving' ? 'var(--accent)' : saving[apt.id] === 'error' ? 'var(--red)' : 'var(--green)',
                            fontWeight: 600,
                          }}>
                            {saving[apt.id] === 'saving' ? 'Sparar...' : saving[apt.id] === 'error' ? 'Kunde inte spara' : '✓ Sparat'}
                          </div>
                        )}
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
