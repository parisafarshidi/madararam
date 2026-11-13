import { useEffect, useMemo, useState } from 'react';
import './content-manager.css';

const clone = (value) => JSON.parse(JSON.stringify(value));

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: options.body ? { 'Content-Type': 'application/json', ...options.headers } : options.headers,
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'ذخیره یا دریافت اطلاعات انجام نشد.');
  return data;
}

export function ContentAdmin({ onBack }) {
  const [authorized, setAuthorized] = useState(null);
  const [tab, setTab] = useState('care');
  const [careItems, setCareItems] = useState([]);
  const [selectedCare, setSelectedCare] = useState('');
  const [careDraft, setCareDraft] = useState(null);
  const [booklets, setBooklets] = useState([]);
  const [selectedBooklet, setSelectedBooklet] = useState('');
  const [bookletDraft, setBookletDraft] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedCareItem = useMemo(() => careItems.find((item) => item.key === selectedCare), [careItems, selectedCare]);
  const selectedBookletItem = useMemo(() => booklets.find((item) => item.slug === selectedBooklet), [booklets, selectedBooklet]);

  const loadData = async () => {
    const [careData, bookletData] = await Promise.all([request('/api/admin/content/care'), request('/api/admin/content/booklets')]);
    setCareItems(careData.care || []);
    setBooklets(bookletData.booklets || []);
    setSelectedCare((current) => current || careData.care?.[0]?.key || '');
    setSelectedBooklet((current) => current || bookletData.booklets?.[0]?.slug || '');
  };

  useEffect(() => {
    request('/api/admin/session').then(async () => { setAuthorized(true); await loadData(); }).catch(() => setAuthorized(false));
  }, []);

  useEffect(() => {
    if (selectedCareItem) setCareDraft({ ...clone(selectedCareItem), tasksText: selectedCareItem.tasks.join('\n'), testsText: selectedCareItem.tests.join('\n') });
  }, [selectedCareItem]);

  useEffect(() => {
    if (selectedBookletItem) setBookletDraft(clone(selectedBookletItem));
    else if (selectedBooklet === '__new') setBookletDraft({ slug: '', title: '', subtitle: '', description: '', source: '', reviewedAt: '', published: false, sections: [{ heading: '', body: '', bullets: [] }] });
    else setBookletDraft(null);
  }, [selectedBookletItem, selectedBooklet]);

  const saveCare = async (event) => {
    event.preventDefault(); if (!selectedCare || !careDraft) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const payload = { ...careDraft, tasks: careDraft.tasksText.split(/\r?\n/), tests: careDraft.testsText.split(/\r?\n/) };
      delete payload.tasksText; delete payload.testsText;
      const data = await request(`/api/admin/content/care/${selectedCare}`, { method: 'PUT', body: JSON.stringify(payload) });
      setCareItems((items) => items.map((item) => item.key === selectedCare ? data.content : item));
      setMessage('مراقبت ذخیره شد و در سایت نمایش داده می‌شود.');
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const resetCare = async () => {
    if (!selectedCare) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const data = await request(`/api/admin/content/care/${selectedCare}`, { method: 'DELETE' });
      setCareItems((items) => items.map((item) => item.key === selectedCare ? data.content : item));
      setMessage('متن پیش‌فرض این مراقبت برگردانده شد.');
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const saveBooklet = async (event) => {
    event.preventDefault(); if (!bookletDraft) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const slug = selectedBooklet === '__new' ? bookletDraft.slug.trim() : selectedBooklet;
      const data = await request(`/api/admin/content/booklets/${encodeURIComponent(slug)}`, { method: 'PUT', body: JSON.stringify({ ...bookletDraft, slug }) });
      setBooklets((items) => [...items.filter((item) => item.slug !== slug), data.booklet].sort((a, b) => a.title.localeCompare(b.title, 'fa')));
      setSelectedBooklet(slug);
      setMessage(data.booklet.published ? 'کتابچه ذخیره و منتشر شد.' : 'پیش‌نویس کتابچه ذخیره شد و در سایت نمایش داده نمی‌شود.');
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const hideBooklet = async () => {
    if (!selectedBookletItem || !window.confirm('این کتابچه از سایت برداشته شود؟ متنش در پنل می‌ماند و هر زمان خواستی می‌توانی دوباره منتشرش کنی.')) return;
    setSaving(true); setError(''); setMessage('');
    try {
      await request(`/api/admin/content/booklets/${encodeURIComponent(selectedBooklet)}`, { method: 'DELETE' });
      setBooklets((items) => items.map((item) => item.slug === selectedBooklet ? { ...item, published: false } : item));
      setMessage('کتابچه از سایت برداشته شد و در پنل باقی ماند.');
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const updateSection = (index, field, value) => setBookletDraft((draft) => ({ ...draft, sections: draft.sections.map((section, sectionIndex) => sectionIndex === index ? { ...section, [field]: value } : section) }));
  const addSection = () => setBookletDraft((draft) => ({ ...draft, sections: [...draft.sections, { heading: '', body: '', bullets: [] }] }));
  const removeSection = (index) => setBookletDraft((draft) => ({ ...draft, sections: draft.sections.filter((_, sectionIndex) => sectionIndex !== index) }));

  return <div className="content-admin" dir="rtl">
    <header className="content-admin-header"><a className="brand" href="/admin" onClick={(event) => { event.preventDefault(); onBack(); }}><span className="brand-mark">م</span><span>مادرآرام<small>مدیریت محتوای سایت</small></span></a><div><a className="chat-quiet-button" href="/admin">پنل گفت‌وگوها</a><a className="chat-quiet-button" href="/">نمایش سایت</a></div></header>
    {authorized === false ? <main className="content-locked"><h1>برای مدیریت محتوا وارد شو</h1><p>ابتدا با رمز مدیر وارد پنل شو، سپس از این بخش مراقبت‌ها و کتابچه‌ها را ویرایش کن.</p><a className="button primary" href="/admin">رفتن به ورود مدیر</a></main> : authorized === null ? <main className="content-locked">در حال بررسی دسترسی…</main> : <main className="content-admin-main">
      <div className="content-admin-title"><div><span className="eyebrow">ویرایش و انتشار</span><h1>محتوای مادرآرام</h1><p>تغییرات کتابچه تا زمان انتشار در سایت نمایش داده نمی‌شوند.</p></div></div>
      <div className="content-tabs"><button className={tab === 'care' ? 'active' : ''} onClick={() => { setTab('care'); setError(''); setMessage(''); }}>ویرایش مراقبت‌ها</button><button className={tab === 'booklets' ? 'active' : ''} onClick={() => { setTab('booklets'); setError(''); setMessage(''); }}>ویرایش کتابچه‌ها</button></div>
      {error && <p className="content-feedback error" role="alert">{error}</p>}{message && <p className="content-feedback success" role="status">{message}</p>}
      {tab === 'care' ? <div className="content-editor-layout"><aside className="content-index"><h2>بازه‌های مراقبت</h2>{careItems.map((item) => <button key={item.key} className={selectedCare === item.key ? 'active' : ''} onClick={() => { setSelectedCare(item.key); setError(''); setMessage(''); }}>{item.label}{item.reviewedAt && <small>بازبینی: {item.reviewedAt}</small>}</button>)}</aside><form className="content-editor" onSubmit={saveCare}>{careDraft && <><div className="content-form-heading"><div><span className="eyebrow">{selectedCareItem?.label}</span><h2>ویرایش یادآور مراقبت</h2></div><button className="text-button" type="button" onClick={resetCare} disabled={saving}>بازگردانی نسخهٔ پیش‌فرض</button></div><label>عنوان نمایش‌داده‌شده<input maxLength="160" required value={careDraft.title} onChange={(event) => setCareDraft({ ...careDraft, title: event.target.value })} /></label><label>کارهایی که مادر می‌بیند<small>هر مورد را در یک خط بنویس؛ افزودن یا حذف خط‌ها، موارد را اضافه یا کم می‌کند.</small><textarea rows="7" value={careDraft.tasksText} onChange={(event) => setCareDraft({ ...careDraft, tasksText: event.target.value })} /></label><label>بررسی‌ها و آزمایش‌ها<small>هر مورد در یک خط. اگر این بخش لازم نیست، متن را خالی بگذار.</small><textarea rows="4" value={careDraft.testsText} onChange={(event) => setCareDraft({ ...careDraft, testsText: event.target.value })} /></label><label>علائم هشدار<textarea rows="3" value={careDraft.alerts} onChange={(event) => setCareDraft({ ...careDraft, alerts: event.target.value })} /></label><div className="content-form-row"><label>منبع<textarea rows="2" value={careDraft.source} onChange={(event) => setCareDraft({ ...careDraft, source: event.target.value })} /></label><label>تاریخ بازبینی<input maxLength="40" placeholder="مثلاً ۱۴۰۵/۰۸/۱۸" value={careDraft.reviewedAt || ''} onChange={(event) => setCareDraft({ ...careDraft, reviewedAt: event.target.value })} /></label></div><p className="content-clinical-note">پس از هر تغییر در توصیهٔ سلامت، منبع و تاریخ بازبینی را هم به‌روز کن. محتوا پس از ذخیره فوراً در صفحهٔ مادر و نوزاد نمایش داده می‌شود.</p><button className="button primary" disabled={saving}>{saving ? 'در حال ذخیره…' : 'ذخیرهٔ مراقبت'}</button></>}</form></div> : <div className="content-editor-layout booklet-editor-layout"><aside className="content-index"><div className="content-index-heading"><h2>کتابچه‌ها</h2><button className="button primary" onClick={() => { setSelectedBooklet('__new'); setError(''); setMessage(''); }}>افزودن کتابچه</button></div>{booklets.map((item) => <button key={item.slug} className={selectedBooklet === item.slug ? 'active' : ''} onClick={() => { setSelectedBooklet(item.slug); setError(''); setMessage(''); }}><span>{item.title}</span><small>{item.published ? 'منتشرشده' : 'پیش‌نویس / برداشته‌شده'}</small></button>)}</aside><form className="content-editor" onSubmit={saveBooklet}>{bookletDraft && <><div className="content-form-heading"><div><span className="eyebrow">{selectedBooklet === '__new' ? 'کتابچهٔ تازه' : selectedBookletItem?.published ? 'در حال انتشار' : 'پیش‌نویس'}</span><h2>{selectedBooklet === '__new' ? 'ساخت کتابچه' : 'ویرایش کتابچه'}</h2></div>{selectedBookletItem && <a className="text-button" href={`/booklets/${selectedBooklet}`} target="_blank" rel="noreferrer">پیش‌نمایش</a>}</div>{selectedBooklet === '__new' && <label>نشانی انگلیسی کتابچه<input required maxLength="48" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="مثلاً newborn-sleep" value={bookletDraft.slug} onChange={(event) => setBookletDraft({ ...bookletDraft, slug: event.target.value })} /><small>با حروف انگلیسی کوچک، عدد و خط تیره؛ بعد از انتشار بهتر است تغییرش ندهی.</small></label>}<label>عنوان کتابچه<input required maxLength="160" value={bookletDraft.title} onChange={(event) => setBookletDraft({ ...bookletDraft, title: event.target.value })} /></label><label>عنوان روی جلد<input maxLength="180" value={bookletDraft.subtitle} onChange={(event) => setBookletDraft({ ...bookletDraft, subtitle: event.target.value })} /></label><label>توضیح کوتاه<textarea rows="2" maxLength="500" value={bookletDraft.description} onChange={(event) => setBookletDraft({ ...bookletDraft, description: event.target.value })} /></label><label>منبع<textarea rows="2" maxLength="1000" value={bookletDraft.source} onChange={(event) => setBookletDraft({ ...bookletDraft, source: event.target.value })} /></label><label>تاریخ بازبینی<input maxLength="40" placeholder="مثلاً ۱۴۰۵/۰۸/۱۸" value={bookletDraft.reviewedAt || ''} onChange={(event) => setBookletDraft({ ...bookletDraft, reviewedAt: event.target.value })} /></label><div className="content-section-editor-head"><h3>بخش‌های کتابچه</h3><button className="text-button" type="button" onClick={addSection}>+ افزودن بخش</button></div>{bookletDraft.sections.map((section, index) => <fieldset className="booklet-section-editor" key={`${selectedBooklet}-${index}`}><legend>بخش {index + 1}</legend><button type="button" className="remove-section" onClick={() => removeSection(index)}>حذف بخش</button><label>عنوان بخش<input required maxLength="160" value={section.heading} onChange={(event) => updateSection(index, 'heading', event.target.value)} /></label><label>متن<textarea rows="4" maxLength="6000" value={section.body} onChange={(event) => updateSection(index, 'body', event.target.value)} /></label><label>فهرست نکته‌ها<small>هر مورد را در یک خط بنویس.</small><textarea rows="4" value={section.bullets.join('\n')} onChange={(event) => updateSection(index, 'bullets', event.target.value.split(/\r?\n/))} /></label></fieldset>)}<label className="publish-toggle"><input type="checkbox" checked={bookletDraft.published} onChange={(event) => setBookletDraft({ ...bookletDraft, published: event.target.checked })} /><span>این کتابچه در سایت منتشر شود</span></label><div className="content-actions"><button className="button primary" disabled={saving}>{saving ? 'در حال ذخیره…' : bookletDraft.published ? 'ذخیره و انتشار' : 'ذخیرهٔ پیش‌نویس'}</button>{selectedBookletItem?.published && <button type="button" className="text-button danger" onClick={hideBooklet} disabled={saving}>برداشتن از سایت</button>}</div></>}</form></div>}
      <p className="content-bottom-note">ذخیرهٔ مراقبت‌ها بلافاصله متن سایت را تغییر می‌دهد. کتابچه‌ها را می‌توانی پیش‌نویس نگه داری، منتشر کنی یا از سایت برداری و بعداً دوباره منتشر کنی.</p>
    </main>}
  </div>;
}

export function BookletPage({ slug, onBack }) {
  const [booklet, setBooklet] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    fetch(`/api/content/booklets/${encodeURIComponent(slug)}`).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'کتابچه پیدا نشد.');
      if (alive) setBooklet(data.booklet);
    }).catch((err) => { if (alive) setError(err.message); });
    return () => { alive = false; };
  }, [slug]);
  useEffect(() => {
    if (!booklet) return;
    const previousTitle = document.title;
    document.title = `${booklet.title} | مادرآرام`;
    return () => { document.title = previousTitle; };
  }, [booklet]);
  return <main className="booklet-reader" dir="rtl"><nav className="booklet-reader-actions"><button onClick={onBack}>← بازگشت به مادرآرام</button><div><button onClick={() => window.print()}>چاپ / ذخیره PDF</button></div></nav>{error ? <section className="booklet-reader-error"><h1>کتابچه در دسترس نیست</h1><p>{error}</p><button onClick={onBack}>بازگشت به مادرآرام</button></section> : !booklet ? <p className="booklet-reader-loading">در حال بازکردن کتابچه…</p> : <><header className="booklet-reader-cover"><span>مادرآرام · راهنمای آموزشی</span><h1>{booklet.title}</h1><p>{booklet.subtitle}</p><small>{booklet.description}</small></header><article className="booklet-reader-body">{booklet.sections.map((section, index) => <section className="booklet-reader-section" key={`${section.heading}-${index}`}><span className="booklet-section-number">{String(index + 1).padStart(2, '۰')}</span><h2>{section.heading}</h2>{section.body && <p>{section.body}</p>}{section.bullets?.length > 0 && <ul>{section.bullets.map((bullet, bulletIndex) => <li key={`${index}-${bulletIndex}`}>{bullet}</li>)}</ul>}</section>)}<section className="booklet-reader-source"><b>منابع و بازبینی</b><p>{booklet.source}</p>{booklet.reviewedAt && <small>آخرین بازبینی: {booklet.reviewedAt}</small>}<p>این کتابچه آموزشی عمومی است و جایگزین ارزیابی یا برنامهٔ مراقبتی فردی نیست. در موارد فوری با مرکز درمانی تماس بگیر.</p></section></article></>}</main>;
}
