export type Locale = 'en' | 'ar';

/** Live hosted portals the proposal page links to (demo broker tenant). */
export const LIVE = {
  clientApp: 'https://invest.egypt.agyal.net/?broker=demo-broker&login=1',
  brokerConsole: 'https://broker.egypt.agyal.net/?broker=demo-broker',
};

/**
 * Throwaway demo logins printed on the page. Both are seeded on the demo tenant, and the
 * one-time sign-in code is shown on-screen for these accounts (DEMO_LOGINS), so anyone can
 * try the live product. Safe to publish — they only reach the demo broker's sandbox data.
 */
export const DEMO = {
  client: { email: 'investor@demo-broker.example', password: 'Demo-Pass-2026!' },
  ops: { email: 'admin@demo-broker.example', password: 'Demo-Pass-2026!' },
};

/** Illustrative revenue scenarios: annual margin income ≈ clients × avg holding × 0.50% markup. */
export interface ScenarioRow {
  clients: string;
  holding: string;
  aum: string;
  revenue: string;
}

export interface Content {
  dir: 'ltr' | 'rtl';
  nav: { offer: string; tryit: string; numbers: string; contact: string; lang: string; cta: string };
  hero: { eyebrow: string; title: string; lead: string; primary: string; secondary: string; note: string };
  try: {
    title: string;
    lead: string;
    codeNote: string;
    emailLabel: string;
    passwordLabel: string;
    open: string;
    copy: string;
    copied: string;
    client: { tag: string; title: string; desc: string };
    ops: { tag: string; title: string; desc: string };
  };
  offer: { title: string; lead: string; points: { title: string; body: string }[]; footnote: string };
  numbers: {
    title: string;
    lead: string;
    stats: { value: string; label: string }[];
    cols: { clients: string; holding: string; aum: string; revenue: string };
    rows: ScenarioRow[];
    assumption: string;
    invest: string;
  };
  how: { title: string; steps: { title: string; body: string }[] };
  close: { title: string; lead: string; next: string[] };
  contact: {
    title: string;
    lead: string;
    name: string;
    firm: string;
    role: string;
    email: string;
    mobile: string;
    message: string;
    submit: string;
    sending: string;
    thanks: string;
    error: string;
  };
  footer: string;
}

const en: Content = {
  dir: 'ltr',
  nav: { offer: 'The offer', tryit: 'Try it live', numbers: 'The numbers', contact: 'Talk to us', lang: 'العربية', cta: 'Start the conversation' },
  hero: {
    eyebrow: 'A partnership for licensed brokers',
    title: 'Offer fixed income under your own brand. You hold the licence. We bring the technology.',
    lead:
      'Egyptians want to put their savings into treasury bills, bonds and sukuk, but buying them online has never been easy. The platform that makes it easy already exists. You hold the licence to offer it, and we run the technology behind your brand. Nothing to build, nothing to invest.',
    primary: 'Try the live product now',
    secondary: 'Why it works for you',
    note: 'A live demo is below. Real screens, simulated banks, no sign-up.',
  },
  try: {
    title: 'Try it live, right now',
    lead:
      'These are the real products, the same ones your customers and your team would use, running on a demo brokerage. Open either one and sign in with the details shown. The 6-digit code appears on the screen, so you go straight in.',
    codeNote: 'For these demo accounts, the code appears on the sign-in screen.',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    open: 'Open the portal',
    copy: 'Copy',
    copied: 'Copied',
    client: {
      tag: 'What your customers see',
      title: 'Investor app',
      desc: 'Open an account, browse today’s rates, see the after-tax return on any paper, and buy at a live price from partner banks. Arabic and English, built for the phone.',
    },
    ops: {
      tag: 'What your team runs',
      title: 'Broker and operations console',
      desc: 'Onboarding, unified codes and custody, deposits, orders, settlement, coupons, withdrawals and the ledger. Everything your operations, finance and compliance teams need.',
    },
  },
  offer: {
    title: 'Why it makes sense to partner',
    lead: 'You hold the licence. We bring everything else, and we grow it with you.',
    points: [
      { title: 'You provide the licence', body: 'You stay the licensed, regulated party. Your brand, your rules, your name on every agreement.' },
      { title: 'Nothing to build, nothing to invest', body: 'No platform to build and no upfront cost. We set it up, run it, and keep it compliant.' },
      { title: 'Customers onboard online', body: 'Account opening is fully digital, on the platform you just tried.' },
      { title: 'A new income line, in your name', body: 'The margin on every trade is booked under your brokerage.' },
      { title: 'A real partnership', body: 'You bring the licence and equity; we bring the technology and marketing. We earn only from the margin your desk produces.' },
    ],
    footnote: 'The only real change from what you just tried is your brand on the front and the margin in your name.',
  },
  numbers: {
    title: 'What it could mean for your firm',
    lead: 'Egyptian savers want government paper, and today most of it is still bought the slow way, in a branch. A digital channel in your name meets that demand, at no cost to you.',
    stats: [
      { value: 'Trillions EGP', label: 'Household savings still sitting in deposits that pay less after tax.' },
      { value: 'Fast-growing', label: 'Retail appetite to hold treasury paper directly, once it is easy to buy.' },
    ],
    cols: { clients: 'Customers', holding: 'Avg. holding', aum: 'Assets on platform', revenue: 'Illustrative annual margin income' },
    rows: [
      { clients: '500', holding: 'EGP 250,000', aum: 'EGP 125m', revenue: 'EGP 625,000' },
      { clients: '2,000', holding: 'EGP 250,000', aum: 'EGP 500m', revenue: 'EGP 2.5m' },
      { clients: '5,000', holding: 'EGP 300,000', aum: 'EGP 1.5bn', revenue: 'EGP 7.5m' },
    ],
    assumption: 'Illustrative only. Roughly customers times average holding times a 0.50% margin over a year. Adjust to your own assumptions. Not a forecast.',
    invest: 'What you invest to earn it: only your licence.',
  },
  how: {
    title: 'What you get',
    steps: [
      { title: 'Onboarding handled for you', body: 'Clients apply online and are checked against your rules, with no data entry for your team.' },
      { title: 'Live pricing from your banks', body: 'Every request goes to your partner banks at once over FIX, and the margin is booked in your name.' },
      { title: 'One console to run the book', body: 'Ledger, settlement, coupons, maturities, withdrawals and a full audit trail, all in one place.' },
    ],
  },
  close: {
    title: 'Let’s talk',
    lead: 'If a fixed-income desk in your name, at no cost and nothing to build, is worth a look, the next step is a short conversation.',
    next: ['We brand the demo in your name, logo and colours', 'We walk your compliance and operations leads through it', 'We agree a pilot with one or two of your partner banks'],
  },
  contact: {
    title: 'Start the conversation',
    lead: 'Tell us a little about your firm and we’ll be in touch.',
    name: 'Your name',
    firm: 'Brokerage firm',
    role: 'Your role',
    email: 'Email',
    mobile: 'Mobile',
    message: 'Anything you’d like us to know (optional)',
    submit: 'Send',
    sending: 'Sending…',
    thanks: 'Thank you. We’ll be in touch shortly.',
    error: 'Something went wrong. Please try again.',
  },
  footer: 'Agyal, the technology behind licensed brokers in Egypt',
};

const ar: Content = {
  dir: 'rtl',
  nav: { offer: 'العرض', tryit: 'جرّبه على طول', numbers: 'الأرقام', contact: 'كلّمنا', lang: 'English', cta: 'يلا نتكلّم' },
  hero: {
    eyebrow: 'شراكة لشركات السمسرة المرخّصة',
    title: 'قدّم أدوات الدخل الثابت باسم شركتك. الرخصة معاك، والتكنولوجيا علينا.',
    lead:
      'المصريين عايزين يحطّوا فلوسهم في أذون وسندات الخزانة والصكوك، بس شراءها أونلاين ماكانش سهل أبدًا. المنصّة اللي بتسهّله موجودة خلاص. إنت معاك الرخصة اللي تقدّمها، وإحنا بنشغّل التكنولوجيا ورا علامتك. من غير ما تبني حاجة، ومن غير ما تدفع حاجة.',
    primary: 'جرّب المنتج على طول',
    secondary: 'ليه ده في مصلحتك',
    note: 'في تجربة حيّة تحت. شاشات حقيقية، بنوك تجريبية، ومن غير تسجيل.',
  },
  try: {
    title: 'جرّبه بنفسك، دلوقتي',
    lead:
      'دي المنتجات الحقيقية، نفس اللي عملاءك وفريقك هيستخدموه، شغّالة على وسيط تجريبي. افتح أي واحد فيهم وادخل بالبيانات اللي قدّامك. كود الدخول بيظهر على الشاشة علشان تدخل على طول.',
    codeNote: 'للحسابات التجريبية دي، كود الدخول بيظهر على شاشة الدخول.',
    emailLabel: 'الإيميل',
    passwordLabel: 'كلمة السر',
    open: 'افتح البوابة',
    copy: 'نسخ',
    copied: 'اتنسخ',
    client: {
      tag: 'اللي عملاءك بيشوفوه',
      title: 'تطبيق المستثمر',
      desc: 'يفتح حساب، ويتفرّج على أسعار النهارده، ويعرف العائد بعد الضريبة لأي ورقة، ويشتري بسعر حيّ من البنوك الشريكة. بالعربي والإنجليزي، ومظبوط للموبايل.',
    },
    ops: {
      tag: 'اللي فريقك بيشغّله',
      title: 'لوحة الوسيط والعمليات',
      desc: 'التسجيل، والأكواد الموحّدة والحفظ، والإيداعات، والأوامر، والتسوية، والكوبونات، والسحب، ودفتر الأستاذ. كل اللي فرق العمليات والمالية والالتزام محتاجاه.',
    },
  },
  offer: {
    title: 'ليه الشراكة في مصلحتك',
    lead: 'الرخصة معاك. وإحنا بنجيب كل حاجة تانية، وبننمّيها معاك.',
    points: [
      { title: 'إنت بتقدّم الرخصة', body: 'إنت الطرف المرخّص والخاضع للرقابة. علامتك، وقواعدك، واسمك على كل عقد.' },
      { title: 'من غير ما تبني، ومن غير ما تدفع', body: 'مفيش منصّة تبنيها ولا تكلفة مقدّمة. إحنا بنجهّزها ونشغّلها ونلتزم بكل المتطلبات.' },
      { title: 'عملاءك بيسجّلوا أونلاين', body: 'فتح الحساب أونلاين بالكامل، على نفس المنصّة اللي جرّبتها دلوقتي.' },
      { title: 'مصدر دخل جديد باسمك', body: 'هامش كل صفقة بيتسجّل باسم شركتك.' },
      { title: 'شراكة حقيقية', body: 'إنت بتقدّم الرخصة وحصة الملكية، وإحنا بنقدّم التكنولوجيا والتسويق. وماحناش بنكسب غير من الهامش اللي مكتبك بيعمله.' },
    ],
    footnote: 'التغيير الوحيد عن اللي جرّبته إن علامتك في الواجهة والهامش باسمك.',
  },
  numbers: {
    title: 'ده معناه إيه لشركتك',
    lead: 'المصريين عايزين أوراق الحكومة، ولسه معظمها بيتشري بالطريقة البطيئة في الفروع. قناة رقمية باسمك بتلبّي الطلب ده، ومن غير تكلفة عليك.',
    stats: [
      { value: 'تريليونات ج.م.', label: 'مدّخرات الناس لسه في ودائع بتدّي أقل بعد الضريبة.' },
      { value: 'نمو سريع', label: 'الناس بقت عايزة تشتري أوراق الخزانة بنفسها، طول ما ده بقى سهل.' },
    ],
    cols: { clients: 'العملاء', holding: 'متوسط الحيازة', aum: 'الأصول على المنصّة', revenue: 'دخل الهامش السنوي التقريبي' },
    rows: [
      { clients: '٥٠٠', holding: '٢٥٠٬٠٠٠ ج.م.', aum: '١٢٥ مليون ج.م.', revenue: '٦٢٥٬٠٠٠ ج.م.' },
      { clients: '٢٬٠٠٠', holding: '٢٥٠٬٠٠٠ ج.م.', aum: '٥٠٠ مليون ج.م.', revenue: '٢٫٥ مليون ج.م.' },
      { clients: '٥٬٠٠٠', holding: '٣٠٠٬٠٠٠ ج.م.', aum: '١٫٥ مليار ج.م.', revenue: '٧٫٥ مليون ج.م.' },
    ],
    assumption: 'أرقام تقريبية بس. تقريبًا: العملاء × متوسط الحيازة × هامش ٠٫٥٠٪ خلال سنة. عدّلها على حسب افتراضاتك. مش توقّع.',
    invest: 'اللي هتدفعه علشان توصل لده: رخصتك بس.',
  },
  how: {
    title: 'إنت بتاخد إيه',
    steps: [
      { title: 'التسجيل بيتدار بدالك', body: 'العملاء بيسجّلوا أونلاين وبيتفحصوا على حسب قواعدك، من غير ما فريقك يدخّل أي بيانات.' },
      { title: 'تسعير حيّ من بنوكك', body: 'كل طلب بيروح لبنوكك الشريكة مرة واحدة عبر FIX، والهامش بيتسجّل باسمك.' },
      { title: 'لوحة واحدة تدير بيها الدفتر', body: 'دفتر الأستاذ، والتسوية، والكوبونات، والاستحقاقات، والسحب، وسجل تدقيق كامل، كله في مكان واحد.' },
    ],
  },
  close: {
    title: 'يلا نتكلّم',
    lead: 'لو مكتب دخل ثابت باسمك، من غير تكلفة ومن غير بناء، يستاهل نظرة، الخطوة الجاية مكالمة قصيرة.',
    next: ['نجهّزلك التجربة باسمك وشعارك وألوانك', 'نستعرضها مع مسؤولين الالتزام والعمليات عندك', 'نتّفق على تجربة أولى مع بنك أو اتنين من بنوكك الشريكة'],
  },
  contact: {
    title: 'يلا نبدأ',
    lead: 'قوللنا شوية عن شركتك وإحنا هنتواصل معاك.',
    name: 'اسمك',
    firm: 'شركة السمسرة',
    role: 'دورك',
    email: 'الإيميل',
    mobile: 'الموبايل',
    message: 'أي حاجة تحب تقولهالنا (اختياري)',
    submit: 'ابعت',
    sending: 'بيتبعت…',
    thanks: 'شكرًا ليك، هنتواصل معاك قريّب.',
    error: 'حصل خطأ. جرّب تاني من فضلك.',
  },
  footer: 'Agyal، التكنولوجيا ورا شركات السمسرة المرخّصة في مصر',
};

export const content: Record<Locale, Content> = { en, ar };
