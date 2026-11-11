import { useState } from 'react';
import { QuoteMark, Star } from './icons';
import { useT } from '../lib/i18n';

// Sample reviews for the template. Replace them with real customer reviews before going live.
const REVIEWS = [
  { initials: 'DR', color: '#C77B5B', name: 'Dianne Russell', th: 'ประสบการณ์ยอดเยี่ยม! ทีมงานมีความเชี่ยวชาญ ดูแลใส่ใจ และขั้นตอนราบรื่น ช่วยให้ฉันได้บ้านในฝันอย่างรวดเร็วโดยไม่เครียด แนะนำเลย!', text: 'Fantastic experience! Their expertise, personalized service, and seamless process helped me find my dream home quickly and without stress. Highly recommended for a smooth and successful real estate journey!' },
  { initials: 'PA', color: '#7C8F5A', name: 'Pushpa kumar arora', th: 'บริการดีเยี่ยม! ความเชี่ยวชาญและการดูแลแบบเฉพาะตัวทำให้หาบ้านในฝันได้ง่ายและเร็ว จัดการทุกอย่างราบรื่น สื่อสารชัดเจน แนะนำเลย!', text: 'Exceptional service! Their expertise and personalized approach made finding my dream home quick and easy. They handled everything smoothly and communicated clearly. Highly recommend for a seamless real estate experience!' },
  { initials: 'NS', color: '#8C6B9B', name: 'Nattaya Srisuk', th: 'ได้ลองจัดห้องบนเว็บก่อนเจอทีมครั้งแรก ประหยัดเวลาไปหลายสัปดาห์ เรามาพร้อมโจทย์ที่ชัดเจน และทีมก็เปลี่ยนมันเป็นบ้านที่เรารัก', text: 'Planning each room on the website before our first meeting saved us weeks. We arrived with a clear brief and the team turned it into a home we love.' },
  { initials: 'ML', color: '#4F7F95', name: 'Marcus Lee', th: 'หมุนดูบ้านได้ทุกด้านและเปิดดูทุกชั้น ทำให้เข้าใจผังง่ายมาก คำแนะนำชัดเจนและตอบเร็วตลอด', text: 'Turning the house to each side and opening every floor made the layout easy to understand. Clear advice and quick replies the whole way through.' },
];

export default function Testimonials() {
  const { tr, t } = useT();
  const [idx, setIdx] = useState(0);
  const shown = [REVIEWS[idx], REVIEWS[(idx + 1) % REVIEWS.length]];

  return (
    <>
      <div className="grid gap-10 md:grid-cols-2 md:gap-[26px]">
        {shown.map((r, i) => (
          <article key={r.name} className={`lift animate-slide-left relative rounded-lg bg-card px-7 pt-10 pb-[22px] ${i === 1 ? 'max-md:hidden' : ''}`} style={{ animationDelay: `${i * 90}ms` }}>
            <span aria-hidden="true" className="absolute -top-6 left-[18px] grid size-[52px] place-items-center rounded-full border-[3px] border-card text-[15px] font-bold text-white" style={{ background: r.color }}>{r.initials}</span>
            <QuoteMark className="absolute -top-3.5 right-4 h-10 w-[46px] text-ink" />
            <p className="text-xs leading-loose font-medium text-muted">{tr(r.text, r.th)}</p>
            <hr className="mt-[22px] mb-3.5 border-0 border-t-[1.5px] border-line" />
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold">{r.name}<small className="block text-[10px] font-medium text-muted">{tr('Sample review', 'รีวิวตัวอย่าง')}</small></div>
              <div className="flex gap-0.5 text-star" aria-label={tr('4 out of 5 stars', '4 จาก 5 ดาว')}>
                {[0, 1, 2, 3, 4].map((s) => <Star key={s} filled={s < 4} className="size-[13px]" />)}
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-[22px] flex gap-[5px]" role="group" aria-label={tr('Choose testimonials', 'เลือกรีวิว')}>
        {REVIEWS.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={tr(`Show testimonial ${i + 1}`, `แสดงรีวิวที่ ${i + 1}`)}
            aria-current={i === idx}
            onClick={() => setIdx(i)}
            className={`h-2 cursor-pointer rounded border-0 p-0 transition-[width] motion-reduce:transition-none ${i === idx ? 'w-[22px] bg-accent' : 'w-2 bg-card'}`}
          />
        ))}
      </div>
    </>
  );
}
