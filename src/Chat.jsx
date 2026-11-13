import { useCallback, useEffect, useState } from 'react';
import './chat.css';

const topics = ['شیردهی', 'بارداری', 'مراقبت نوزاد', 'پس از زایمان', 'موضوع دیگر'];

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: options.body ? { 'Content-Type': 'application/json', ...options.headers } : options.headers,
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'ارتباط با سایت برقرار نشد.');
  return data;
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(timestamp);
}

function MessageList({ messages, role = 'visitor' }) {
  if (!messages.length) return <div className="chat-empty-messages">هنوز پیامی در این گفت‌وگو نیست.</div>;
  return <div className="chat-messages" aria-live="polite">{messages.map((message) => <article key={message.id} className={`chat-message ${message.sender === role ? 'mine' : 'theirs'}`}><span>{message.sender === 'admin' ? 'پریسا' : 'مادر'}</span><p>{message.body}</p><time>{formatTime(message.createdAt)}</time></article>)}</div>;
}

export function VisitorChat() {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [accessCode, setAccessCode] = useState('');
  const [accessInput, setAccessInput] = useState('');
  const [form, setForm] = useState({ name: '', contact: '', topic: topics[0], question: '' });
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    const data = await api('/api/chat/session');
    setConversation(data.conversation);
    setMessages(data.messages || []);
  }, []);

  useEffect(() => {
    let alive = true;
    api('/api/chat/session').then((data) => {
      if (!alive) return;
      setConversation(data.conversation);
      setMessages(data.messages || []);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!conversation) return undefined;
    const timer = window.setInterval(() => { refresh().catch(() => {}); }, 5000);
    return () => window.clearInterval(timer);
  }, [conversation?.id, refresh]);

  const startConversation = async (event) => {
    event.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await api('/api/chat/conversations', { method: 'POST', body: JSON.stringify(form) });
      setConversation(data.conversation);
      setMessages(data.messages || []);
      setAccessCode(data.accessCode);
      setForm({ name: '', contact: '', topic: topics[0], question: '' });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const openWithCode = async (event) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      await api('/api/chat/access', { method: 'POST', body: JSON.stringify({ accessCode: accessInput }) });
      setAccessInput(''); setAccessCode(''); await refresh();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!reply.trim()) return;
    setError(''); setLoading(true);
    try {
      await api('/api/chat/messages', { method: 'POST', body: JSON.stringify({ body: reply }) });
      setReply(''); await refresh();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const leaveConversation = async () => {
    try { await api('/api/chat/logout', { method: 'POST' }); } catch {}
    setConversation(null); setMessages([]); setAccessCode(''); setError('');
  };

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(accessCode); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
  };

  return <div className="chat-widget">
    {!conversation ? <>
      <form className="question-form chat-start-form" onSubmit={startConversation}>
        <div className="form-heading"><span className="form-flower">✿</span><div><b>گفت‌وگوی خصوصی با پریسا</b><small>پیامت را بفرست؛ پاسخ را همین‌جا می‌بینی.</small></div></div>
        <label>اسمت<input required minLength="2" maxLength="80" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثلاً سارا" autoComplete="name" /></label>
        <div className="form-row"><label>راه تماس (اختیاری)<input maxLength="120" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="شماره یا ایمیل، اگر مایلی" autoComplete="email" /></label><label>موضوع<select value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>{topics.map((topic) => <option key={topic}>{topic}</option>)}</select></label></div>
        <label>پیامت<textarea required minLength="8" maxLength="2000" rows="4" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder="هر چیزی که دوست داری بپرسی..." /></label>
        <button className="button primary submit-button" type="submit" disabled={loading}>{loading ? 'در حال فرستادن…' : 'شروع گفت‌وگو'} <span>←</span></button>
        {error && <p className="form-message error" role="alert">{error}</p>}
        <small className="privacy-hint">اطلاعات گفت‌وگو رمزگذاری و حداکثر تا ۹۰ روز نگهداری می‌شود. در صورت تمایل، شماره یا ایمیل را وارد کن تا راه تماس داشته باشیم؛ پیام به‌صورت اعلان بیرون از سایت ارسال نمی‌شود.</small>
      </form>
      <form className="chat-access-form" onSubmit={openWithCode}><label>قبلاً گفت‌وگویی شروع کرده‌ای؟<span className="chat-access-row"><input required maxLength="32" value={accessInput} onChange={(e) => setAccessInput(e.target.value)} placeholder="کد پیگیری خصوصی" autoComplete="one-time-code" /><button className="button dark" disabled={loading}>دیدن گفت‌وگو</button></span></label></form>
    </> : <section className="chat-thread">
      <header className="chat-thread-head"><div><span className="eyebrow">گفت‌وگوی خصوصی</span><h3>{conversation.topic} · {conversation.name}</h3><small>{conversation.status === 'open' ? 'گفت‌وگو باز است' : 'این گفت‌وگو بسته شده است'}</small></div><button type="button" className="chat-quiet-button" onClick={leaveConversation}>خروج از گفت‌وگو</button></header>
      {accessCode && <div className="chat-access-code"><b>کد پیگیری خصوصی</b><code dir="ltr">{accessCode}</code><button type="button" onClick={copyCode}>{copied ? 'کپی شد' : 'کپی کد'}</button><small>این کد را جای امنی نگه دار؛ برای ورود از دستگاه دیگر لازم می‌شود و فقط یک‌بار نمایش داده می‌شود.</small></div>}
      <MessageList messages={messages} />
      {conversation.status === 'open' ? <form className="chat-compose" onSubmit={sendMessage}><label htmlFor="chat-reply">پیام تازه</label><textarea id="chat-reply" rows="3" maxLength="2000" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="پاسخت را اینجا بنویس..." /><div><small>پیام‌ها هر چند ثانیه به‌روز می‌شوند.</small><button className="button primary" disabled={loading || !reply.trim()}>{loading ? 'در حال ارسال…' : 'فرستادن پیام'} <span>←</span></button></div></form> : <p className="chat-closed-note">اگر پرسش تازه‌ای داری، از فرم جدید گفت‌وگو را آغاز کن.</p>}
      {error && <p className="form-message error" role="alert">{error}</p>}
    </section>}
  </div>;
}

export function AdminChat({ onBack }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState('');
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadConversations = useCallback(async () => {
    const data = await api('/api/admin/conversations');
    setConversations(data.conversations || []);
    if (selected && !data.conversations.some((item) => item.id === selected)) setSelected('');
  }, [selected]);

  const loadMessages = useCallback(async (id) => {
    if (!id) { setMessages([]); return; }
    const data = await api(`/api/admin/conversations/${id}/messages`);
    setMessages(data.messages || []);
  }, []);

  useEffect(() => {
    api('/api/admin/session').then(() => setAuthenticated(true)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!authenticated) return undefined;
    loadConversations().catch((err) => setError(err.message));
    const timer = window.setInterval(() => { loadConversations().catch(() => {}); }, 5000);
    return () => window.clearInterval(timer);
  }, [authenticated, loadConversations]);

  useEffect(() => {
    if (!authenticated || !selected) return undefined;
    loadMessages(selected).catch((err) => setError(err.message));
    const timer = window.setInterval(() => { loadMessages(selected).catch(() => {}); }, 4000);
    return () => window.clearInterval(timer);
  }, [authenticated, selected, loadMessages]);

  const login = async (event) => {
    event.preventDefault(); setError(''); setLoading(true);
    try { await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) }); setPassword(''); setAuthenticated(true); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const sendReply = async (event) => {
    event.preventDefault(); if (!selected || !reply.trim()) return;
    setError(''); setLoading(true);
    try {
      await api(`/api/admin/conversations/${selected}/messages`, { method: 'POST', body: JSON.stringify({ body: reply }) });
      setReply(''); await loadMessages(selected); await loadConversations();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const setStatus = async (status) => {
    if (!selected) return;
    try {
      await api(`/api/admin/conversations/${selected}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await loadConversations();
    } catch (err) { setError(err.message); }
  };

  const logout = async () => {
    try { await api('/api/admin/logout', { method: 'POST' }); } catch {}
    setAuthenticated(false); setSelected(''); setMessages([]);
  };

  const active = conversations.find((item) => item.id === selected);

  return <div className="admin-page" dir="rtl">
    <header className="admin-header"><a className="brand" href="/" onClick={(event) => { event.preventDefault(); onBack(); }}><span className="brand-mark">م</span><span>مادرآرام<small>مدیریت گفت‌وگوها</small></span></a><div className="admin-header-actions">{authenticated && <a className="chat-quiet-button" href="/admin/content">مدیریت مراقبت و کتابچه‌ها</a>}<button className="chat-quiet-button" onClick={authenticated ? logout : onBack}>{authenticated ? 'خروج امن' : 'بازگشت به سایت'}</button></div></header>
    {!authenticated ? <main className="admin-login"><span className="eyebrow">فقط برای پریسا</span><h1>ورود به بخش مدیریت</h1><p>برای دیدن پیام‌های خصوصی، رمز مدیر را وارد کن.</p><form onSubmit={login}><label>رمز ورود<input type="password" required minLength="24" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="button primary" disabled={loading}>{loading ? 'در حال بررسی…' : 'ورود امن'}</button>{error && <p className="form-message error" role="alert">{error}</p>}</form><small>رمز مدیر باید در فایل محلی .env تنظیم شده باشد و در اختیار دیگران قرار نگیرد.</small></main> : <main className="admin-main"><div className="admin-title"><div><span className="eyebrow">پاسخ‌گویی داخل سایت</span><h1>گفت‌وگوهای مادران</h1></div><small>پیام‌ها محرمانه‌اند؛ در پاسخ‌گویی فقط اطلاعات لازم را در نظر بگیر.</small></div><div className="admin-chat-layout"><aside className="conversation-list"><div className="conversation-list-head"><b>گفت‌وگوها</b><span>{conversations.filter((item) => item.status === 'open').length} باز</span></div>{conversations.length ? conversations.map((item) => <button key={item.id} className={`conversation-item ${selected === item.id ? 'active' : ''}`} onClick={() => { setSelected(item.id); setError(''); }}><span className="conversation-avatar">{item.name.slice(0, 1)}</span><span><b>{item.name} · {item.topic}</b><small>{formatTime(item.updatedAt)} · {item.status === 'open' ? 'باز' : 'بسته'}</small></span></button>) : <p className="admin-empty">هنوز گفت‌وگویی دریافت نشده است.</p>}</aside><section className="admin-thread">{active ? <><header><div><b>{active.name} · {active.topic}</b><small>{active.contact || 'راه تماس ارائه نشده'} · شروع {formatTime(active.createdAt)}</small></div><button className="chat-quiet-button" onClick={() => setStatus(active.status === 'open' ? 'closed' : 'open')}>{active.status === 'open' ? 'بستن گفت‌وگو' : 'بازکردن گفت‌وگو'}</button></header><MessageList messages={messages} role="admin" /><form className="chat-compose" onSubmit={sendReply}><label htmlFor="admin-reply">پاسخ تو</label><textarea id="admin-reply" rows="3" maxLength="2000" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="پاسخت را بنویس..." disabled={active.status !== 'open'} /><div><small>پاسخ در صفحهٔ پیگیری مادر نمایش داده می‌شود.</small><button className="button primary" disabled={loading || !reply.trim() || active.status !== 'open'}>{loading ? 'در حال ارسال…' : 'ثبت پاسخ'} <span>←</span></button></div></form></> : <div className="admin-empty admin-thread-empty">برای دیدن پیام‌ها، یک گفت‌وگو را انتخاب کن.</div>}{error && <p className="form-message error" role="alert">{error}</p>}</section></div></main>}
  </div>;
}
