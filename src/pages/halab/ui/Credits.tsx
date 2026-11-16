/**
 * Credits and dedication. The wording here is personal: change it only with Mahmoud's approval.
 */

/** One quiet line under the title. */
export function Dedication() {
  return <p className="mt-2 font-naskh text-base text-gold/70">إلى روح أبي، أحمد أديب شعار</p>;
}

/** The full credits, at the foot of every day. */
export function Credits() {
  return (
    <aside className="mt-20 pt-10 border-t border-paper/10 space-y-8 text-paper/65 leading-loose" aria-label="عن اللعبة">
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-3">
          <div className="h-px w-10 bg-gold/50" />
          <span className="text-xs text-gold">إهداء</span>
          <div className="h-px w-10 bg-gold/50" />
        </div>
        <p className="font-naskh text-2xl text-paper leading-[1.9]">إلى روح أبي، أحمد أديب شعار، رحمه الله،</p>
        <p className="font-naskh text-xl text-paper/80 leading-[1.9]">
          الذي نقل هذه الموسوعة من الورق إلى الشاشة، وأتاحها للناس جميعًا.
          <br />
          هذه اللعبة رسالة حبّ إليه، وإلى حلب التي أحبّها.
        </p>
        <p className="text-sm text-paper/40" dir="ltr">
          For my father, Ahmad Adib Shaar, who digitized this encyclopedia and gave it to everyone.
        </p>
      </div>

      <div className="space-y-3 text-sm">
        <p>
          أسئلة {"«حلبيّات»"} مأخوذة من <span className="text-paper">«موسوعة حلب المقارنة»</span> للعلّامة{" "}
          <span className="text-paper">محمد خير الدين الأسدي</span> (١٩٠٠–١٩٧١)، الذي أمضى سنوات طويلة يجمع كلام أهل حلب من
          أفواههم في سهراتهم ومقاهيهم وأسواقهم: ألفاظهم وأصولها، وأمثالهم وأغانيهم وألغازهم ونداءات باعتهم.
        </p>
        <p>
          نقّح النسخة الورقية وأخرجها الأديب محمد كمال. وحوّلها إلى نسختها الرقمية وأتاحها للجميع{" "}
          <span className="text-paper">أحمد أديب شعار</span> (حلب، ٢٠٠٩)، برعاية{" "}
          <span className="text-paper">جمعية العاديات بحلب</span> ودعمها.
        </p>
        <p className="text-paper/45">
          نُقلت النصوص من نسخة رقمية مستخرجة آليًا وصُحّحت يدويًا، والشروح القصيرة للأمثال من إعداد اللعبة. إن وجدت خطأ
          فأخبرني.
        </p>
      </div>
    </aside>
  );
}
