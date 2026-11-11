import { useState, type FormEvent } from 'react';
import { MailIcon } from './icons';
import { useT } from '../lib/i18n';
import { CONTACT_EMAIL } from '../config';

const shots = ['nyc', 'santorini', 'rio', 'about'].map((k) => `/renders/shot-${k}.webp`);

/** Contact form. Opens the visitor's email app addressed to CONTACT_EMAIL, or copies the message when none is set. */
export default function ContactSection() {
  const { tr } = useT();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [state, setState] = useState<'' | 'mail' | 'copied' | 'copyfail'>('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const subject = tr(`House design question from ${name}`, `คำถามเรื่องออกแบบบ้านจาก ${name}`);
    const body = `${msg}\n\n— ${name} <${email}>`;
    if (CONTACT_EMAIL) {
      location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      setState('mail');
      return;
    }
    try { await navigator.clipboard.writeText(`${subject}\n\n${body}`); setState('copied'); } catch { setState('copyfail'); }
  }

  const field = 'w-full rounded-lg border-[1.5px] border-transparent bg-field px-3.5 py-2.5 text-[13px] placeholder:text-muted focus:border-ink focus:outline-none transition-colors duration-300';
  return (
    <section id="contact" aria-label={tr('Contact', 'ติดต่อ')} className="sec relative overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute -inset-[30px] grid grid-cols-5 opacity-50 blur-[6px]">
        {Array.from({ length: 15 }, (_, b) => (
          <div key={b} className="relative aspect-square">
            <img alt="" loading="lazy" decoding="async" src={shots[(b * 3 + Math.floor(b / 5)) % shots.length]} className="absolute inset-0 size-full object-cover" />
          </div>
        ))}
      </div>
      <div className="wrap relative">
        <div className="mx-auto max-w-[520px] rounded-3xl bg-card/90 p-6 shadow-[0_30px_70px_-20px_rgb(80_40_20/0.35)] backdrop-blur-md sm:p-8">
          <h2 className="text-center text-[clamp(22px,3vw,28px)] leading-[1.3] font-bold">{tr('Questions about your design?', 'มีคำถามเรื่องแบบบ้าน?')}</h2>
          <p className="mt-2 mb-6 text-center text-[13px] font-medium text-muted">{tr('Tell us what you are planning and we will get back to you.', 'เล่าให้เราฟังว่ากำลังวางแผนบ้านแบบไหน แล้วเราจะติดต่อกลับ')}</p>
          <form onSubmit={submit} className="grid gap-2.5">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder={tr('Your name', 'ชื่อของคุณ')} aria-label={tr('Your name', 'ชื่อของคุณ')} className={field} />
              <div className="relative">
                <MailIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={tr('Email', 'อีเมล')} aria-label={tr('Email', 'อีเมล')} className={`${field} pl-[34px]`} />
              </div>
            </div>
            <textarea required rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={tr('Plot size, number of rooms, style you like…', 'ขนาดที่ดิน จำนวนห้อง สไตล์ที่ชอบ…')} aria-label={tr('Message', 'ข้อความ')} className={`${field} resize-y`} />
            <button type="submit" className="btn press mt-1 justify-self-center px-8"><MailIcon className="size-4" />{CONTACT_EMAIL ? tr('Send', 'ส่งข้อความ') : tr('Copy message', 'คัดลอกข้อความ')}</button>
          </form>
          <p role="status" className="mt-3 min-h-5 text-center text-[12.5px] font-semibold text-muted">
            {state === 'mail' && tr('Your email app should open with the message ready to send.', 'แอปอีเมลจะเปิดขึ้นพร้อมข้อความ กดส่งได้เลย')}
            {state === 'copied' && tr('Copied. Paste it into an email or chat to send it.', 'คัดลอกแล้ว นำไปวางในอีเมลหรือแชตเพื่อส่งได้เลย')}
            {state === 'copyfail' && tr('Could not copy here. Select the text above and copy it.', 'คัดลอกอัตโนมัติไม่ได้ กรุณาเลือกข้อความแล้วคัดลอกเอง')}
          </p>
        </div>
      </div>
    </section>
  );
}
