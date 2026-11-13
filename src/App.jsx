import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setStage, setReferenceDate } from './store';
import { CARE_DEFAULTS, BOOKLET_DEFAULTS } from './contentDefaults';

const routeUrl = (path) => `${import.meta.env.BASE_URL}#${path}`;


const stages = [
  { id: 'pregnancy', label: 'دوران بارداری', icon: '✿', title: 'قدم‌به‌قدم تا دیدار کوچولوت', copy: 'مراقبت‌ها و آمادگی‌های هر مرحله را ساده و به‌موقع دنبال کن.' },
  { id: 'postpartum', label: 'پس از زایمان', icon: '♡', title: 'مراقبت از خودت هم مهم است', copy: 'برای روزهای تازه، راهنماهای آرام و کاربردی کنار توست.' },
  { id: 'baby', label: 'مراقبت نوزاد', icon: '☼', title: 'با خیال آسوده‌تر از نوزادت مراقبت کن', copy: 'از خواب و تغذیه تا مراقبت‌های روزمره، متناسب با سن نوزاد.' },
];

const lessons = [
  { no: '۰۱', title: 'آمادگی برای شیردهی', text: 'از دوران بارداری چه چیزهایی خوب است بدانی؟', icon: '◌', intro: 'قرار نیست همه‌چیز را از قبل بلد باشی. آشنایی اولیه با نشانه‌های گرسنگی نوزاد و دانستن اینکه برای کمک به کجا مراجعه کنی، شروع خوبی است.', steps: ['یک جای راحت برای نشستن یا درازکشیدن آماده کن.', 'از همراهت بخواه در روزهای اول برای آب، بالش و کارهای روزمره کمکت کند.', 'اگر نگرانی یا تجربهٔ قبلی دشواری داری، آن را برای گفت‌وگو با مراقب سلامت یادداشت کن.'] },
  { no: '۰۲', title: 'وضعیت‌های شیردهی', text: 'حالت‌های راحت برای مادر و نوزاد را بشناس.', icon: '⌁', intro: 'وضعیت خوب یعنی بدن نوزاد نزدیک مادر و رو به سینه باشد؛ سر و بدن در یک راستا قرار بگیرند و تمام بدنش حمایت شود.', steps: ['شانه‌ها و دست‌هایت را راحت و بدون فشار نگه دار.', 'بدن نوزاد را به سمت خودت بچرخان تا برای رسیدن به سینه مجبور به چرخاندن گردن نباشد.', 'با بالش یا تکیه‌گاه، وزن نوزاد را نگه دار تا دست‌هایت آزادتر و راحت‌تر باشند.'] },
  { no: '۰۳', title: 'گرفتن صحیح سینه', text: 'نشانه‌های اتصال خوب را قدم‌به‌قدم ببین.', icon: '♡', intro: 'برای کمک به گرفتن سینه، بینی نوزاد را روبه‌روی نوک سینه قرار بده و صبر کن تا دهانش کاملاً باز شود؛ سپس او را نزدیک سینه بیاور.', steps: ['چانه به سینه نزدیک یا مماس است و دهان باز است.', 'لب پایین به بیرون برگشته و بخش بیشتری از هاله بالای دهان دیده می‌شود.', 'مکیدن معمولاً عمیق و آهسته است و ممکن است مکث داشته باشد. اگر اتصال دردناک یا دشوار ماند، از مراقب سلامت کمک حضوری بگیر.'] },
  { no: '۰۴', title: 'وقتی نیاز به کمک داری', text: 'چه زمانی بهتر است از یک فرد آموزش‌دیده کمک بگیری؟', icon: '✳', intro: 'پرسیدن کمک نشانهٔ ضعف نیست. بعضی موضوع‌ها با مشاهدهٔ یک وعدهٔ شیردهی و بررسی شرایط مادر و نوزاد بهتر ارزیابی می‌شوند.', steps: ['اگر درد ادامه‌دار است یا نوزاد به‌سختی به سینه وصل می‌شود، برای ارزیابی حضوری وقت بگیر.', 'اگر دربارهٔ تغذیه یا حال عمومی نوزاد نگران هستی، با مراقب سلامت یا مرکز درمانی تماس بگیر.', 'برای شرایط فوری، پاسخ آنلاین را جایگزین مراجعه یا خدمات اورژانسی نکن.'] },
];

const persianDateFormatter = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
const persianMonths = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const faNumber = (number) => Number(number).toLocaleString('fa-IR');
const calendarDaysFromToday = (value) => {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((today - Date.parse(`${value}T00:00:00Z`)) / 86400000);
};

function jalaliPartsFromGregorian(value) {
  if (!value) return { year: '', month: '', day: '' };
  const date = new Date(`${value}T12:00:00Z`);
  const parts = Object.fromEntries(persianDateFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

function getJalaliParts(date) {
  const parts = Object.fromEntries(persianDateFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

function jalaliToGregorian(year, month, day) {
  if (!year || !month || !day || month < 1 || month > 12) return '';
  const searchStart = Date.UTC(year + 621, 2, 18);
  let yearStart;
  for (let offset = 0; offset < 9; offset += 1) {
    const candidate = new Date(searchStart + offset * 86400000);
    const parts = getJalaliParts(candidate);
    if (parts.year === year && parts.month === 1 && parts.day === 1) { yearStart = candidate; break; }
  }
  if (!yearStart) return '';
  const dayOffset = month <= 6 ? (month - 1) * 31 + day - 1 : 186 + (month - 7) * 30 + day - 1;
  const result = new Date(yearStart.getTime() + dayOffset * 86400000);
  const actual = getJalaliParts(result);
  if (actual.year !== year || actual.month !== month || actual.day !== day) return '';
  return result.toISOString().slice(0, 10);
}

function PersianDatePicker({ value, onChange, label, yearOffset = 1 }) {
  const [draft, setDraft] = useState(() => jalaliPartsFromGregorian(value));
  const currentYear = getJalaliParts(new Date()).year;
  useEffect(() => setDraft(jalaliPartsFromGregorian(value)), [value]);
  const years = Array.from({ length: 6 }, (_, index) => currentYear - yearOffset + index);
  const maxDay = draft.month === 12
    ? (jalaliToGregorian(draft.year, 12, 30) ? 30 : 29)
    : draft.month <= 6 ? 31 : 30;
  const updatePart = (part, rawValue) => {
    const next = { ...draft, [part]: rawValue ? Number(rawValue) : '' };
    if (next.month && next.day) {
      const allowedDays = next.month === 12 ? (jalaliToGregorian(next.year, 12, 30) ? 30 : 29) : next.month <= 6 ? 31 : 30;
      if (next.day > allowedDays) next.day = allowedDays;
    }
    setDraft(next);
    const gregorian = jalaliToGregorian(next.year, next.month, next.day);
    if (gregorian) onChange(gregorian);
    else if (!next.year && !next.month && !next.day) onChange('');
  };

  return <div className="date-entry"><span>{label}</span><div className="persian-date-selects" dir="rtl">
    <select aria-label={`${label}، روز`} value={draft.day || ''} onChange={(event) => updatePart('day', event.target.value)}><option value="">روز</option>{Array.from({ length: maxDay || 31 }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{faNumber(day)}</option>)}</select>
    <select aria-label={`${label}، ماه`} value={draft.month || ''} onChange={(event) => updatePart('month', event.target.value)}><option value="">ماه</option>{persianMonths.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select>
    <select aria-label={`${label}، سال`} value={draft.year || ''} onChange={(event) => updatePart('year', event.target.value)}><option value="">سال</option>{years.map((year) => <option key={year} value={year}>{faNumber(year)}</option>)}</select>
  </div></div>;
}

function getPregnancyWeek(referenceDate) {
  if (!referenceDate) return null;
  const gestationDays = 280 + calendarDaysFromToday(referenceDate);
  if (gestationDays < 0 || gestationDays >= 280) return null;
  return Math.floor(gestationDays / 7) + 1;
}

const carePlan = (key, period) => ({ careKey: key, period });

function getCarePlan(stage, referenceDate, selectedPregnancyWeek) {
  if (stage === 'pregnancy') {
    const week = selectedPregnancyWeek || getPregnancyWeek(referenceDate);
    if (!week) return null;
    const key = week <= 10 ? 'pregnancy_6_10' : week <= 20 ? 'pregnancy_16_20' : week <= 30 ? 'pregnancy_24_30' : week <= 34 ? 'pregnancy_31_34' : week <= 37 ? 'pregnancy_35_37' : 'pregnancy_38_40';
    const visit = week <= 10 ? 'ملاقات اول: هفتهٔ ۶ تا ۱۰' : week <= 20 ? 'ملاقات دوم: هفتهٔ ۱۶ تا ۲۰' : week <= 30 ? 'ملاقات سوم: هفتهٔ ۲۴ تا ۳۰' : week <= 34 ? 'ملاقات چهارم: هفتهٔ ۳۱ تا ۳۴' : week <= 37 ? 'ملاقات پنجم: هفتهٔ ۳۵ تا ۳۷' : `ملاقات هفتگی: هفتهٔ ${faNumber(week)}`;
    return carePlan(key, `حدود هفتهٔ ${faNumber(week)} بارداری · ${visit}`);
  }
  if (!referenceDate) return null;
  const days = calendarDaysFromToday(referenceDate);
  if (days < 0) return null;
  if (stage === 'postpartum') {
    if (days <= 7) return carePlan('postpartum_0_7', `روز ${faNumber(days + 1)} پس از زایمان`);
    if (days <= 42) return carePlan('postpartum_8_42', `${faNumber(days)} روز پس از زایمان`);
    return carePlan('postpartum_after_42', 'پس از هفته‌های نخست');
  }
  const months = Math.floor(days / 30);
  if (days <= 4) return carePlan('baby_0_5', `روز ${faNumber(days + 1)} نوزاد`);
  if (days <= 14) return carePlan('baby_6_15', `روز ${faNumber(days + 1)} نوزاد`);
  if (days <= 44) return carePlan('baby_16_45', `حدود ${faNumber(days)} روزگی`);
  if (months < 6) return carePlan('baby_under_6m', `حدود ${faNumber(months)} ماهگی`);
  if (months < 12) return carePlan('baby_6_12m', `حدود ${faNumber(months)} ماهگی`);
  return carePlan('baby_over_12m', `حدود ${faNumber(months)} ماهگی`);
}

function PregnancyCalendar({ currentWeek, selectedWeek, onSelect }) {
  const trimesters = [
    { name: 'سه‌ماههٔ اول', range: 'هفتهٔ ۱ تا ۱۴', start: 1, end: 14 },
    { name: 'سه‌ماههٔ دوم', range: 'هفتهٔ ۱۵ تا ۲۸', start: 15, end: 28 },
    { name: 'سه‌ماههٔ سوم', range: 'هفتهٔ ۲۹ تا ۴۰', start: 29, end: 40 },
  ];
  return <div className="pregnancy-calendar"><div className="pregnancy-calendar-head"><div><span>تقویم بارداری</span><h3>هفتهٔ موردنظرت رو انتخاب کن</h3></div>{currentWeek && <span className="current-week-badge">هفتهٔ فعلی: {faNumber(currentWeek)}</span>}</div><div className="trimester-grid">{trimesters.map((trimester, index) => <div className={`trimester trimester-${index + 1}`} key={trimester.name}><div className="trimester-title"><b>{trimester.name}</b><small>{trimester.range}</small></div><div className="week-buttons">{Array.from({ length: trimester.end - trimester.start + 1 }, (_, offset) => trimester.start + offset).map((week) => <button key={week} type="button" className={`${selectedWeek === week ? 'active' : ''} ${currentWeek === week ? 'today' : ''}`} aria-pressed={selectedWeek === week} onClick={() => onSelect(week)}>{faNumber(week)}</button>)}</div></div>)}</div><small className="calendar-hint">برای دیدن یادآورهای هر بازه، روی شمارهٔ هفته بزن. تاریخ زایمان را وارد کنی، هفتهٔ فعلی هم مشخص می‌شود.</small></div>;
}

function VaccineReminder({ date, done, onDateChange, onDone }) {
  const daysUntil = date ? -calendarDaysFromToday(date) : null;
  let reminder = 'کارت واکسن نوزادت رو همین الان نگاه کن و تاریخ نوبت بعدی رو وارد کن.';
  if (date && daysUntil < 0) reminder = 'از تاریخ ثبت‌شده گذشته؛ با مرکز سلامت تماس بگیر و وضعیت نوبت را بررسی کن.';
  else if (date && daysUntil === 0) reminder = 'امروز موعدی است که ثبت کردی؛ کارت واکسن را همراه داشته باش و نوبت را پیگیری کن.';
  else if (date && daysUntil > 0) reminder = `برای تاریخی که ثبت کردی ${faNumber(daysUntil)} روز مانده؛ یادآور را نگه دار تا نوبت از قلم نیفتد.`;
  return <div className={`vaccine-reminder ${done ? 'completed' : ''}`}><div className="vaccine-heading"><span className="vaccine-icon">✚</span><div><span>یادآور مهم نوزاد</span><h4>{done ? 'این نوبت انجام شد' : 'واکسن‌ها رو از قلم ننداز'}</h4></div><span className="vaccine-flag">مهم</span></div><p>{done ? 'آفرین؛ نوبت بعدی را از روی کارت واکسن وارد کن.' : reminder}</p><PersianDatePicker label="تاریخ نوبت بعدی از روی کارت واکسن" value={date} yearOffset={1} onChange={onDateChange} /><label className="vaccine-done"><input type="checkbox" checked={done} onChange={(event) => onDone(event.target.checked)} /><span className="custom-check"/><span>این نوبت را انجام دادم</span></label><small>زمان دقیق واکسن را از کارت واکسن نوزاد یا مرکز سلامت بگیر.</small></div>;
}

function BreastfeedingPage({ onBack }) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'راهنمای جامع شیردهی | مادرآرام';
    return () => { document.title = previousTitle; };
  }, []);
  return <div className="guide-page">
    <header className="guide-header"><button className="guide-back" onClick={onBack}>← بازگشت به مادرآرام</button><a className="brand" href="/" onClick={(event) => { event.preventDefault(); onBack(); }}><span className="brand-mark">م</span><span>مادرآرام<small>مدرسهٔ شیردهی</small></span></a><a className="header-cta" href="/#ask">پرسش از پریسا <span>←</span></a></header>
    <main>
      <section className="guide-hero"><div className="guide-hero-inner"><span className="eyebrow">راهنمای قدم‌به‌قدم مادر و نوزاد</span><h1>شیردهی؛<br /><em>یادگرفتنی، با آرامش</em></h1><p>لازم نیست از روز اول همه‌چیز را بلد باشی. این راهنما کمک می‌کند اصول شروع، وضعیت مناسب و نشانه‌های گرفتن خوب سینه را بشناسی و بدانی چه زمانی کمک حضوری بگیری.</p><div className="guide-hero-actions"><a href="#start" className="button primary">شروع آموزش <span>↓</span></a><a href="#lessons" className="text-link">دیدن درس‌های بعدی</a></div><small>این آموزش عمومی است و جای مشاهده و ارزیابی حضوری مادر و نوزاد را نمی‌گیرد.</small></div><div className="guide-illustration"><span className="guide-sun"/><div className="guide-heart">♡</div><div className="guide-caption">هر مادر و نوزاد<br />مسیر ویژهٔ خودشان را دارند</div><span className="guide-leaf leaf-a">✿</span><span className="guide-leaf leaf-b">✦</span></div></section>
      <section className="guide-intro wrap" id="start"><div className="guide-section-heading"><span className="eyebrow">پیش از شروع</span><h2>سه نکته برای یک شروع آرام</h2></div><div className="guide-intro-grid"><article><span>۰۱</span><h3>راحتی تو هم مهم است</h3><p>جایی را انتخاب کن که شانه‌ها و دست‌هایت تکیه داشته باشند. بالش می‌تواند وزن نوزاد را نگه دارد تا تو مجبور نباشی به جلو خم شوی.</p></article><article><span>۰۲</span><h3>نوزاد را نزدیک خودت بیاور</h3><p>بدن نوزاد رو به بدن تو باشد، سر و بدن در یک راستا قرار بگیرند و تمام بدنش حمایت شود. حالت گهواره‌ای، متقاطع، زیر بغلی یا خوابیده را با توجه به راحتی خودتان انتخاب کن.</p></article><article><span>۰۳</span><h3>برای کمک خواستن صبر نکن</h3><p>اگر گرفتن سینه دردناک یا دشوار ماند، از ماما یا مراقب آموزش‌دیده بخواه یک وعدهٔ شیردهی را حضوری ببیند.</p></article></div></section>
      <section className="guide-method"><div className="wrap"><div className="guide-section-heading"><span className="eyebrow">تمرین مرحله‌به‌مرحله</span><h2>چطور نوزاد را به سینه نزدیک کنی؟</h2><p>با آرامش پیش برو؛ اگر گرفتن خوب شکل نگرفت، وضعیت را عوض کن و دوباره امتحان کن.</p></div><div className="method-grid"><article className="method-card"><span className="method-number">۱</span><h3>بدن نوزاد را تنظیم کن</h3><p>نوزاد را نزدیک خودت نگه دار؛ صورتش رو به سینه باشد و گردنش نچرخد. سر و بدن در یک خط و کل بدنش حمایت شود.</p><div className="method-visual visual-one"><span className="mother-dot"/><span className="baby-dot"/><span className="alignment-line"/></div></article><article className="method-card"><span className="method-number">۲</span><h3>صبر کن دهانش باز شود</h3><p>بینی نوزاد را روبه‌روی نوک سینه قرار بده و نوک سینه را آرام به لبش نزدیک کن؛ برای بازشدن کامل دهان صبر کن.</p><div className="method-visual visual-two"><span className="breast-dot"/><span className="baby-mouth"/><span className="motion-dots">•••</span></div></article><article className="method-card"><span className="method-number">۳</span><h3>نوزاد را نزدیک بیاور</h3><p>وقتی دهانش باز است، نوزاد را به سمت سینه بیاور. چانه به سینه نزدیک باشد و لب پایین به بیرون برگردد.</p><div className="method-visual visual-three"><span className="chin-dot"/><span className="latch-ring"/><span className="smile-mark">⌣</span></div></article></div></div></section>
      <section className="guide-signs wrap"><div className="signs-copy"><span className="eyebrow">چک‌لیست کاربردی</span><h2>نشانه‌های گرفتن مناسب سینه</h2><p>این نشانه‌ها کمک می‌کنند وضعیت را بررسی کنی؛ اگر مطمئن نیستی، مشاهدهٔ حضوری توسط مراقب آموزش‌دیده کمک‌کننده است.</p><ul><li>دهان نوزاد کاملاً باز است.</li><li>چانه‌اش به سینه نزدیک یا مماس است.</li><li>لب پایین به بیرون برگشته است.</li><li>بخش بیشتری از هالهٔ سینه بالای دهان دیده می‌شود.</li><li>مکیدن عمیق و آهسته است و گاهی مکث دارد.</li></ul></div><div className="signs-card"><span className="signs-quote">«اگر درد داری، لازم نیست تحملش کنی.»</span><p>درد مداوم، دشواری در اتصال نوزاد یا نگرانی دربارهٔ شیر خوردنش را با ماما یا مراقب سلامت در میان بگذار تا شرایط شما را از نزدیک بررسی کند.</p><p>از روز پنجم به بعد، شش پوشک خیس یا بیشتر در شبانه‌روز می‌تواند یکی از نشانه‌های دریافت شیر باشد؛ برای نتیجه‌گیری باید وزن و حال نوزاد هم بررسی شود.</p><p>توصیهٔ عمومی، شیردهی انحصاری در شش ماه نخست و سپس غذای کمکی مناسب همراه با ادامهٔ شیردهی تا دو سال و بیشتر است؛ شرایط ویژه را با مراقب سلامت مرور کن.</p><a className="button primary" href="/#ask">از پریسا سؤال کن <span>←</span></a></div></section>
      <section className="guide-roadmap" id="lessons"><div className="wrap"><div className="guide-section-heading"><span className="eyebrow">مسیر یادگیری ادامه دارد</span><h2>موضوع‌های بعدی مدرسهٔ شیردهی</h2><p>این صفحه به‌مرور با آموزش‌ها و کتابچه‌های کاربردی کامل‌تر می‌شود.</p></div><div className="roadmap-grid"><article><span>♡</span><b>از کجا بفهمم نوزادم شیر کافی می‌گیرد؟</b><small>راهنمای نشانه‌ها و زمان پیگیری</small></article><article><span>↗</span><b>دوشیدن شیر با دست</b><small>آموزش تصویری و نکته‌های کاربردی</small></article><article><span>▤</span><b>نگهداری و جابه‌جایی شیر</b><small>کتابچهٔ مرور سریع برای مادر</small></article><article><span>☼</span><b>شیردهی و بازگشت به کار</b><small>برنامه‌ریزی برای ادامهٔ شیردهی</small></article></div></div></section>
      <section className="guide-source wrap"><p>این آموزش با استفاده از «راهنمای بوکلت مراقبت‌های ادغام‌یافتهٔ ناخوشی‌های اطفال (مانا) غیرپزشک» وزارت بهداشت، ۱۴۰۰، صفحات ۳۸ تا ۵۶ و توصیه‌های سازمان جهانی بهداشت بازنویسی شده است. راهنمای مانا برای کارکنان سلامت تدوین شده؛ این صفحه نکته‌های آموزشی آن را برای خانواده‌ها ساده‌سازی می‌کند. برای جزئیات شرایط خودت، از مراقب سلامت کمک بگیر.</p><a href="https://applications.emro.who.int/docs/9789292743468-eng.pdf" target="_blank" rel="noreferrer">مشاهدهٔ راهنمای WHO دربارهٔ وضعیت و اتصال ↗</a></section>
    </main>
    <footer className="site-footer"><div className="wrap footer-inner"><a className="brand" href="/" onClick={(event) => { event.preventDefault(); onBack(); }}><span className="brand-mark">م</span><span>مادرآرام<small>همراه آگاه مادر و نوزاد</small></span></a><span>با مهر برای روزهای تازهٔ مادری</span><a href="#top" onClick={(event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>بازگشت به بالا ↑</a></div></footer>
  </div>;
}

function StaticBookletPage({ booklet, onBack }) {
  return <main className="booklet-reader" dir="rtl"><nav className="booklet-reader-actions"><button onClick={onBack}>← بازگشت</button><button onClick={() => window.print()}>چاپ / ذخیره PDF</button></nav><header className="booklet-reader-cover"><span>مادرآرام · راهنمای آموزشی</span><h1>{booklet.title}</h1><p>{booklet.subtitle}</p><small>{booklet.description}</small></header><article className="booklet-reader-body">{booklet.sections.map((section, index) => <section className="booklet-reader-section" key={index}><h2>{section.heading}</h2>{section.body && <p>{section.body}</p>}{section.bullets?.length > 0 && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}</section>)}<section className="booklet-reader-source"><b>منابع</b><p>{booklet.source}</p><p>این کتابچه آموزشی عمومی است و جایگزین ارزیابی یا مراقبت فردی نیست.</p></section></article></main>;
}

function App() {
  const dispatch = useDispatch();
  const [pathname, setPathname] = useState(() => window.location.hash.startsWith('#/') ? window.location.hash.slice(1) : '/');
  const activeStage = useSelector((state) => state.journey.stage);
  const referenceDate = useSelector((state) => state.journey.referenceDate);
  const vaccineDate = useSelector((state) => state.journey.vaccineDate);
  const vaccineDone = useSelector((state) => state.journey.vaccineDone);
  const stage = stages.find((item) => item.id === activeStage);
  const [activeLesson, setActiveLesson] = useState(lessons[0].no);
  const [selectedPregnancyWeek, setSelectedPregnancyWeek] = useState(null);
  const [careContent] = useState(() => Object.fromEntries(CARE_DEFAULTS.map((item) => [item.key, item])));
  const [careContentLoaded] = useState(true);
  const [booklets] = useState(() => BOOKLET_DEFAULTS.filter((item) => item.published));
  const [doneCare, setDoneCare] = useState(() => {
    try { return JSON.parse(localStorage.getItem('madararam-care-checks') || '{}'); } catch { return {}; }
  });
  useEffect(() => {
    const onRoute = () => setPathname(window.location.hash.startsWith('#/') ? window.location.hash.slice(1) : '/');
    window.addEventListener('popstate', onRoute);
    window.addEventListener('hashchange', onRoute);
    return () => { window.removeEventListener('popstate', onRoute); window.removeEventListener('hashchange', onRoute); };
  }, []);

  

  const navigate = (path) => {
    window.history.pushState({}, '', routeUrl(path));
    setPathname(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getJourneySummary = () => {
    if (!referenceDate) return activeStage === 'pregnancy' ? 'تاریخ زایمان شمسی را وارد کن تا هفتهٔ فعلی مشخص شود؛ یا از تقویم، هفته‌ای را انتخاب کن.' : 'تاریخ تولد شمسی را وارد کن تا سن نوزادت را اینجا ببینی.';
    const days = calendarDaysFromToday(referenceDate);
    if (activeStage === 'pregnancy') {
      const gestationDays = 280 + days;
      const week = Math.min(40, Math.floor(gestationDays / 7) + 1);
      if (gestationDays < 0) return 'تاریخ احتمالی زایمان بیش از ۴۰ هفته در آینده است؛ لطفاً تاریخ را بررسی کن.';
      if (gestationDays >= 280) return 'به تاریخ احتمالی زایمان رسیده‌ای یا از آن گذشته‌ای؛ برای ادامهٔ پیگیری با مراقب سلامتت هماهنگ کن.';
      return `بر اساس تاریخ احتمالی زایمان، اکنون حدود هفتهٔ ${week} بارداری هستی. این محاسبه تقریبی است.`;
    }
    if (days < 0) return 'این تاریخ در آینده است؛ لطفاً تاریخ تولد را بررسی کن.';
    if (activeStage === 'postpartum') return days === 0 ? 'امروز روز اول پس از زایمان است.' : `حدود ${days} روز از زایمان گذشته است.`;
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    if (months === 0) return `نوزادت ${days} روزه است.`;
    return `سن تقریبی نوزادت ${months} ماه و ${remainingDays} روز است.`;
  };
  const dateLabel = activeStage === 'pregnancy' ? 'تاریخ احتمالی زایمان' : 'تاریخ تولد نوزاد';
  const activeLessonContent = lessons.find((lesson) => lesson.no === activeLesson);
  const pregnancyWeek = getPregnancyWeek(referenceDate);
  const displayedPregnancyWeek = selectedPregnancyWeek || pregnancyWeek;
  const carePlanBase = getCarePlan(activeStage, referenceDate, displayedPregnancyWeek);
  const carePlan = carePlanBase && careContent[carePlanBase.careKey] ? { ...careContent[carePlanBase.careKey], careKey: carePlanBase.careKey, period: carePlanBase.period } : null;
  useEffect(() => {
    try { localStorage.setItem('madararam-care-checks', JSON.stringify(doneCare)); } catch { /* Checklist still works without browser storage. */ }
  }, [doneCare]);

  if (pathname.startsWith('/booklets/')) { const slug = pathname.split('/').filter(Boolean)[1]; const booklet = booklets.find((item) => item.slug === slug); return booklet ? <StaticBookletPage booklet={booklet} onBack={() => navigate('/')} /> : <p>کتابچه پیدا نشد.</p>; }
  if (pathname === '/breastfeeding') return <BreastfeedingPage onBack={() => navigate('/')} />;

  return <>
    <header className="site-header">
      <a className="brand" href="#home" aria-label="مادرآرام، صفحه اصلی"><span className="brand-mark">م</span><span>مادرآرام<small>همراه آگاه مادر و نوزاد</small></span></a>
      <nav><a href="#journey">مسیر مراقبت</a><a href="#breastfeeding">مدرسه شیردهی</a><a href="#booklets">کتابچه‌ها</a><a href="#about">درباره من</a></nav>
      <a className="header-cta" href="#ask">پرسش از پریسا <span>←</span></a>
    </header>

    <main id="home">
      <section className="hero wrap">
        <div className="hero-copy">
          <div className="eyebrow"><i /> همراهی آگاهانه، از بارداری تا آغوش اول</div>
          <h1>مادر شدن،<br /><em>قرار نیست تنها</em> باشه.</h1>
          <p className="hero-lead">راهنمایی‌های کاربردی و مهربان برای مراقبت از خودت، یادگیری شیردهی و شناخت نیازهای نوزادت؛ کنار تو، قدم‌به‌قدم.</p>
          <div className="hero-actions"><a className="button primary" href="#journey">مسیر خودم رو پیدا کنم <span>←</span></a><a className="text-link" href="#breastfeeding">دیدن آموزش‌ها <span>↙</span></a></div>
          <div className="trust-note"><span className="avatar">پ</span><span><b>پریسا فرشیدی</b><small>راهنمای فارسی مادر و نوزاد</small></span><span className="trust-divider" /><span className="soft-tag">آموزش، همراه با آرامش</span></div>
        </div>
        <div className="hero-art" aria-label="تصویرسازی مادر و نوزاد">
          <div className="sun-orb" /><div className="art-sticker sticker-top"><span>✿</span> این مسیر، مال توست</div>
          <div className="mother-illustration"><div className="hair"/><div className="face"/><div className="body-shape"/><div className="baby"><span className="baby-face"/><span className="baby-wrap"/></div><span className="art-flower flower-one">✿</span><span className="art-flower flower-two">✳</span></div>
          <div className="art-sticker sticker-bottom"><span className="heart">♡</span><span><b>هر سؤال، ارزش پرسیدن داره</b><small>من اینجام تا همراهت باشم</small></span></div>
          <span className="orbit orbit-one"/><span className="orbit orbit-two"/>
        </div>
      </section>

      <section className="journey-section" id="journey"><div className="wrap">
        <div className="section-heading"><div><span className="eyebrow">از کجای مسیر با هم شروع کنیم؟</span><h2>همراهی، متناسب با <em>روزهای تو</em></h2></div><p>مرحله‌ات رو انتخاب کن تا محتوای مناسب همین روزها رو ببینی.</p></div>
        <div className="journey-grid">{stages.map((item) => <button key={item.id} className={`journey-card ${activeStage === item.id ? 'selected' : ''}`} onClick={() => { if (activeStage !== item.id) { dispatch(setReferenceDate('')); setSelectedPregnancyWeek(null); } dispatch(setStage(item.id)); }}><span className="card-icon">{item.icon}</span><span className="card-label">{item.label}</span><strong>{item.title}</strong><span className="card-copy">{item.copy}</span><span className="card-arrow">←</span></button>)}</div>
        <div className="journey-profile"><div className="profile-copy"><span className="profile-spark">✦</span><div><b>مسیر خودت رو تنظیم کن</b><p>{getJourneySummary()}</p></div></div><PersianDatePicker label={dateLabel} value={referenceDate} yearOffset={activeStage === 'pregnancy' ? 1 : 3} onChange={(value) => { setSelectedPregnancyWeek(null); dispatch(setReferenceDate(value)); }} /><small className="local-data-note">تاریخ شمسی فقط در همین مرورگر ذخیره می‌شود و به سرور ارسال نمی‌شود.</small>
          {activeStage === 'pregnancy' && <PregnancyCalendar currentWeek={pregnancyWeek} selectedWeek={displayedPregnancyWeek} onSelect={setSelectedPregnancyWeek} />}
          {activeStage === 'baby' && <VaccineReminder date={vaccineDate} done={vaccineDone} onDateChange={(value) => dispatch(setVaccineDate(value))} onDone={(value) => dispatch(setVaccineDone(value))} />}
          {carePlan ? <div className="care-plan"><div className="care-plan-heading"><span className="care-plan-icon">✿</span><div><span className="care-period">{carePlan.period}</span><h3>{carePlan.title}</h3></div></div><div className="care-items-title"><b>کارهایی که می‌تونی پیگیری کنی</b><small>بعد از انجام هر مورد، علامتش بزن.</small></div><ul>{carePlan.tasks.map((task, index) => { const key = `${carePlan.period}-${index}`; return <li key={key}><label className={doneCare[key] ? 'checked' : ''}><input type="checkbox" checked={Boolean(doneCare[key])} onChange={(event) => setDoneCare({ ...doneCare, [key]: event.target.checked })} /><span className="custom-check"/><span>{task}</span></label></li>; })}</ul>{carePlan.alerts && <div className="care-alert"><b>علائم نیازمند پیگیری فوری</b><p>{carePlan.alerts}</p></div>}{carePlan.tests?.length > 0 && <div className="pregnancy-tests"><div><b>آزمایش‌ها و بررسی‌های این بازه</b><small>مواردی برای گفت‌وگو با مراقب؛ لازم نیست همه برای همه انجام شوند.</small></div><ul>{carePlan.tests.map((test) => <li key={test}><span>⌕</span>{test}</li>)}</ul></div>}<div className="care-plan-foot">منبع: {carePlan.source} {carePlan.reviewedAt && <>· آخرین بازبینی: {carePlan.reviewedAt} </>}برنامهٔ جاری مرکز و نظر مراقب سلامتت را ملاک قرار بده. <a href={activeStage === 'pregnancy' ? 'https://www.who.int/teams/maternal-newborn-child-adolescent-health-and-ageing/handbooks/programme-manager-s-handbook-mncah/recommendations-on-interventions-along-life-course/maternal' : 'https://www.who.int/publications/i/item/9789240045989'} target="_blank" rel="noreferrer">منبع تکمیلی ↗</a></div></div> : carePlanBase && !careContentLoaded ? <p className="care-empty">در حال دریافت محتوای مراقبت…</p> : carePlanBase && !careContent[carePlanBase.careKey] ? <p className="care-empty">محتوای مراقبت دریافت نشد؛ صفحه را تازه‌سازی کن.</p> : activeStage !== 'baby' && <p className="care-empty">{activeStage === 'pregnancy' ? 'برای دیدن راهنمای هفته، هفته‌ای را از تقویم بالا انتخاب کن؛ برای محاسبهٔ هفتهٔ فعلی، تاریخ احتمالی زایمان را وارد کن.' : 'بعد از واردکردن تاریخ شمسی، یادآورهای مراقبت اینجا نمایش داده می‌شوند.'}</p>}
        </div>
        <div className="stage-note"><span className="stage-spark">✦</span><div><b>پیشنهاد این روزها برای تو</b><p>{stage.title} — {stage.copy}</p></div><a href="#breastfeeding">دیدن راهنماها <span>←</span></a></div>
      </div></section>

      <section className="breastfeeding-section wrap" id="breastfeeding">
        <div className="breast-copy"><span className="eyebrow">یادگیری با تصویر و تمرین</span><h2>شیردهی رو با<br /><em>اطمینان یاد بگیر</em></h2><p>یک مسیر آموزشی مهربان و قدم‌به‌قدم؛ از آمادگی پیش از تولد تا وضعیت مناسب و نشانه‌های گرفتن صحیح سینه.</p><a className="button dark" href={routeUrl('/breastfeeding')} onClick={(event) => { event.preventDefault(); navigate('/breastfeeding'); }}>شروع مسیر شیردهی <span>←</span></a><div className="booklet-note"><span>▤</span><span><b>همراه با کتابچهٔ کاربردی</b><small>برای ذخیره و مرور در هر زمان</small></span></div></div>
        <div className="lesson-panel"><div className="lesson-panel-head"><span>مسیر یادگیری شیردهی</span><span className="lesson-count">۴ گام کوتاه</span></div><div className="lesson-list">{lessons.map((lesson) => <button className={`lesson-row ${activeLesson === lesson.no ? 'active' : ''}`} key={lesson.no} onClick={() => setActiveLesson(lesson.no)} aria-expanded={activeLesson === lesson.no}><span className="lesson-icon">{lesson.icon}</span><span className="lesson-text"><b>{lesson.title}</b><small>{lesson.text}</small></span><span className="lesson-no">{activeLesson === lesson.no ? '−' : lesson.no}</span></button>)}</div><article className="lesson-detail"><span className="detail-kicker">راهنمای گام {activeLesson}</span><h3>{activeLessonContent.title}</h3><p>{activeLessonContent.intro}</p><ul>{activeLessonContent.steps.map((step) => <li key={step}>{step}</li>)}</ul><a href="https://www.who.int/news-room/questions-and-answers/item/breastfeeding" target="_blank" rel="noreferrer">منبع آموزشی: سازمان جهانی بهداشت <span>↗</span></a></article><div className="panel-foot"><span>این راهنما آموزش عمومی است؛ در صورت نیاز، ارزیابی حضوری بگیر.</span><span>✿</span></div></div>
      </section>

      <section className="booklets-section" id="booklets"><div className="wrap"><div className="booklets-heading"><div><span className="eyebrow">همراهت برای مرور و نگهداری</span><h2>کتابچه‌های مادرآرام</h2><p>راهنماهای جمع‌وجور برای وقت‌هایی که می‌خواهی دوباره مرور کنی یا همراهت ببری.</p></div><span className="booklets-decoration">▤</span></div><div className="booklet-grid">{booklets.map((booklet, index) => { const className = ['booklet-purple', 'booklet-coral', 'booklet-mint'][index % 3]; const tag = booklet.slug.includes('pregnancy') ? 'راهنمای بارداری' : booklet.slug.includes('newborn') ? 'راهنمای نوزاد' : 'راهنمای مادر'; const path = `/booklets/${booklet.slug}`; const href = routeUrl(path); return <article className={`booklet-card ${className}`} key={booklet.slug}><div className="booklet-cover"><span>مادرآرام / راهنما</span><b>{booklet.subtitle}</b><small>{tag}</small></div><div className="booklet-info"><span className="booklet-tag">{tag}</span><h3>{booklet.title}</h3><p>{booklet.description}</p><div className="booklet-actions"><a href={href} onClick={(event) => { event.preventDefault(); navigate(path); }}>مطالعه <span>↗</span></a><a href={href} target="_blank" rel="noreferrer">چاپ / ذخیره PDF <span>↓</span></a></div></div></article>; })}{!booklets.length && <p className="booklets-note">کتابچه‌ای برای نمایش منتشر نشده است.</p>}</div><p className="booklets-note">مطالب آموزشی عمومی هستند. زمان‌بندی مراقبت و آزمایش‌ها را با مراقب سلامت و دستورالعمل محل زندگی‌ات هماهنگ کن.</p></div></section>

      <section className="about-section" id="about"><div className="wrap about-inner"><div className="about-seal">با مهر<br /><span>پریسا</span></div><div><span className="eyebrow">سلام، من پریسا هستم</span><h2>راهنمای مادر و نوزاد،<em> با زبان خودمونی</em></h2><p>مادرها بیشتر از انبوه اطلاعات، به راهنمایی روشن، شنیده‌شدن و همراهی به‌موقع نیاز دارند. اینجا فضایی می‌سازیم برای پرسیدن، یادگرفتن و آسوده‌تر پیش رفتن.</p><a href="#ask" className="text-link">با من در ارتباط باش <span>←</span></a></div><div className="about-decoration">❋</div></div></section>

      <section className="ask-section wrap" id="ask"><div className="ask-intro"><span className="eyebrow">ارتباط با مادرآرام</span><h2>به‌زودی؛<br /><em>راه‌های ارتباطی</em></h2><p>این نسخه برای آشنایی با راهنماها و مراقبت‌های سایت منتشر شده است. راه ارتباطی مستقیم در نسخهٔ بعدی اضافه می‌شود.</p></div></section>
    </main>
    <footer className="site-footer"><div className="wrap footer-inner"><a className="brand" href="#home"><span className="brand-mark">م</span><span>مادرآرام<small>همراه آگاه مادر و نوزاد</small></span></a><span>با مهر برای روزهای تازهٔ مادری</span><a href="#home">بازگشت به بالا ↑</a></div><div className="wrap footer-disclaimer">این وب‌سایت برای آموزش و همراهی عمومی است و جایگزین ارزیابی یا مراقبت حضوری نیست.</div></footer>
  </>;
}

export default App;
