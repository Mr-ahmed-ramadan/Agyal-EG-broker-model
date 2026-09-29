export type Locale = 'en' | 'ar';

/** Live hosted portals the proposal page links to (demo broker tenant). */
export const LIVE = {
  clientApp: 'https://invest.egypt.agyal.net/?broker=demo-broker',
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
    eyebrow: 'A partnership for licensed brokerage firms',
    title: 'Offer fixed income under your own brand. You bring the licence — we bring the technology.',
    lead:
      'Your clients want treasury bills, bonds and sukuk. Building the technology to sell them online — digital onboarding, bank connectivity, the ledger, settlement — takes years and a team you do not have. We have already built it. Put your name on it and go live, with no tech spend and no capital.',
    primary: 'Try the live product now',
    secondary: 'Why it works for you',
    note: 'Live demo below — real screens, simulated banks, no sign-up.',
  },
  try: {
    title: 'Try it live, right now',
    lead:
      'These are the real, working products — the same ones your clients and your team would use, running under a demo brokerage. Open either one and sign in with the credentials shown. The 6-digit code appears on the sign-in screen, so you can go straight in.',
    codeNote: 'The one-time code shows on the sign-in screen for these demo accounts.',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    open: 'Open the portal',
    copy: 'Copy',
    copied: 'Copied',
    client: {
      tag: 'Your clients see this',
      title: 'Client investor app',
      desc: 'Open an account, browse today’s rates, see the after-tax return on any paper, and buy at a live price from partner banks. Arabic and English, phone-first.',
    },
    ops: {
      tag: 'Your team runs this',
      title: 'Broker / ops console',
      desc: 'Compliance queue, unified codes and custody, deposits, orders, settlement, coupons, withdrawals and the ledger — everything your operations, finance and compliance teams need.',
    },
  },
  offer: {
    title: 'Why this is the right move for your firm',
    lead: 'You already have the hardest thing to get: a licence and clients. We supply everything else.',
    points: [
      { title: 'You provide the licence — nothing else', body: 'You stay the licensed, regulated party. Your brand, your clients, your client agreements. We are the technology behind you.' },
      { title: 'Zero technology spend, zero capital', body: 'No platform to build, no engineers to hire, no upfront investment. We set it up, run it and keep it secure and compliant.' },
      { title: 'Clients onboarded digitally', body: 'Fully online account opening — eKYC, AML screening, suitability, e-signed agreements — using the exact platform you just tried.' },
      { title: 'A new income line, under your name', body: 'The markup margin on every trade runs under your brokerage’s own name. New fee income from an asset class you do not offer today.' },
      { title: 'Live in weeks, not years', body: 'A branded version of what you just used, connected to your partner banks — a pilot in a matter of weeks.' },
    ],
    footnote: 'The only visible change from the platform you just tried is the brand and the margin running under your name.',
  },
  numbers: {
    title: 'What it can mean for your firm',
    lead: 'Egypt’s savers are hungry for government paper, and most of it is still bought the hard way. A digital, branded channel captures that demand — at no cost to you.',
    stats: [
      { value: '~25%+', label: 'Prevailing yields on Egyptian T-bills and bonds — among the highest in the region' },
      { value: 'Trillions EGP', label: 'Household savings still parked in bank deposits that pay less after tax' },
      { value: 'Fast-growing', label: 'Retail appetite to hold treasury paper directly, once it is easy to buy' },
    ],
    cols: { clients: 'Active clients', holding: 'Avg. holding', aum: 'Assets on platform', revenue: 'Illustrative annual margin income' },
    rows: [
      { clients: '500', holding: 'EGP 250,000', aum: 'EGP 125m', revenue: 'EGP 625,000' },
      { clients: '2,000', holding: 'EGP 250,000', aum: 'EGP 500m', revenue: 'EGP 2.5m' },
      { clients: '5,000', holding: 'EGP 300,000', aum: 'EGP 1.5bn', revenue: 'EGP 7.5m' },
    ],
    assumption: 'Illustrative only. Annual margin income ≈ clients × average holding × a 0.50% markup, held for a year; adjust to your own assumptions. Not a forecast.',
    invest: 'Your investment to earn it: nothing but your licence.',
  },
  how: {
    title: 'How it works, end to end',
    steps: [
      { title: 'Onboard digitally', body: 'Clients open an account online — identity, AML, suitability, unified code and e-signed agreements. Your rules decide who is approved automatically.' },
      { title: 'Price across banks over FIX', body: 'Every price request goes to your partner banks at once over FIX 4.4. The client gets the best price; the margin is booked under your name.' },
      { title: 'Run the book under your brand', body: 'Double-entry ledger, settlement, coupons and maturities, withdrawals with maker-checker, statements and a full audit trail — in your console.' },
    ],
  },
  close: {
    title: 'Let’s talk',
    lead: 'If entering fixed income under your brand — at no cost and no build — is interesting, the next step is a short conversation.',
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
    thanks: 'Thank you — we’ll be in touch shortly.',
    error: 'Something went wrong. Please try again.',
  },
  footer: 'Agyal — the technology behind licensed brokers in Egypt',
};

const ar: Content = {
  dir: 'rtl',
  nav: { offer: 'العرض', tryit: 'جرّبه مباشرة', numbers: 'الأرقام', contact: 'تواصل معنا', lang: 'English', cta: 'ابدأ الحديث' },
  hero: {
    eyebrow: 'شراكة لشركات الوساطة المرخّصة',
    title: 'قدّم أدوات الدخل الثابت باسم شركتك. أنت تقدّم الرخصة، ونحن نقدّم التقنية.',
    lead:
      'عملاؤك يريدون أذون وسندات الخزانة والصكوك. بناء التقنية لبيعها إلكترونيًا — من فتح الحساب الرقمي إلى الربط مع البنوك ودفتر الأستاذ والتسوية — يستغرق سنوات وفريقًا لا تملكه. نحن بنيناها بالفعل. ضع اسمك عليها وانطلق، دون أي إنفاق تقني ودون رأس مال.',
    primary: 'جرّب المنتج مباشرة الآن',
    secondary: 'لماذا يناسبك',
    note: 'تجربة حيّة بالأسفل — شاشات حقيقية، بنوك محاكاة، دون تسجيل.',
  },
  try: {
    title: 'جرّبه مباشرة، الآن',
    lead:
      'هذه هي المنتجات الحقيقية العاملة — نفس ما سيستخدمه عملاؤك وفريقك، تعمل تحت وسيط تجريبي. افتح أيًّا منها وسجّل الدخول بالبيانات الموضّحة. يظهر رمز التحقق المكوّن من ٦ أرقام على شاشة الدخول لتدخل مباشرة.',
    codeNote: 'يظهر رمز الدخول لمرة واحدة على شاشة الدخول لهذه الحسابات التجريبية.',
    emailLabel: 'البريد الإلكتروني',
    passwordLabel: 'كلمة المرور',
    open: 'افتح البوابة',
    copy: 'نسخ',
    copied: 'تم النسخ',
    client: {
      tag: 'هذا ما يراه عملاؤك',
      title: 'تطبيق العميل المستثمر',
      desc: 'فتح حساب، تصفّح أسعار اليوم، معرفة العائد بعد الضريبة لأي ورقة، والشراء بسعر حيّ من البنوك الشريكة. بالعربية والإنجليزية، وللهاتف أولًا.',
    },
    ops: {
      tag: 'هذا ما يديره فريقك',
      title: 'لوحة الوسيط والعمليات',
      desc: 'قائمة الالتزام، الأكواد الموحّدة والحفظ، الإيداعات، الأوامر، التسوية، الكوبونات، السحوبات ودفتر الأستاذ — كل ما تحتاجه فرق العمليات والمالية والالتزام.',
    },
  },
  offer: {
    title: 'لماذا هذه هي الخطوة الصحيحة لشركتك',
    lead: 'لديك بالفعل أصعب ما يمكن الحصول عليه: رخصة وعملاء. ونحن نوفّر كل ما عدا ذلك.',
    points: [
      { title: 'أنت تقدّم الرخصة فقط', body: 'تبقى أنت الطرف المرخّص والخاضع للرقابة. علامتك، وعملاؤك، وعقودك معهم. ونحن التقنية خلفك.' },
      { title: 'صفر إنفاق تقني وصفر رأس مال', body: 'لا منصّة تبنيها، ولا مهندسين توظّفهم، ولا استثمار مقدّم. نحن نجهّزها ونشغّلها ونؤمّنها ونلتزم بالمتطلبات.' },
      { title: 'عملاء يُسجَّلون رقميًا', body: 'فتح حساب إلكتروني بالكامل — تحقق الهوية، فحص غسل الأموال، الملاءمة، والعقود الموقّعة إلكترونيًا — بنفس المنصّة التي جرّبتها للتو.' },
      { title: 'مصدر دخل جديد باسمك', body: 'هامش الربح على كل صفقة يجري تحت اسم شركتك. دخل جديد من فئة أصول لا تقدّمها اليوم.' },
      { title: 'انطلاق خلال أسابيع لا سنوات', body: 'نسخة تحمل علامتك مما استخدمته للتو، مرتبطة ببنوكك الشريكة — تجربة أولى خلال أسابيع.' },
    ],
    footnote: 'التغيير الوحيد المرئي عمّا جرّبته هو العلامة والهامش اللذان يعملان تحت اسمك.',
  },
  numbers: {
    title: 'ماذا يعني ذلك لشركتك',
    lead: 'المدّخرون في مصر متعطّشون لأوراق الحكومة، ومعظمها ما زال يُشترى بالطريقة الصعبة. قناة رقمية باسمك تلتقط هذا الطلب — دون تكلفة عليك.',
    stats: [
      { value: '~٢٥٪+', label: 'العوائد السائدة على أذون وسندات الخزانة المصرية — من الأعلى في المنطقة' },
      { value: 'تريليونات ج.م.', label: 'مدّخرات الأسر ما زالت في ودائع تعطي أقل بعد الضريبة' },
      { value: 'نمو سريع', label: 'رغبة الأفراد في حيازة أوراق الخزانة مباشرةً متى صار شراؤها سهلًا' },
    ],
    cols: { clients: 'عملاء نشطون', holding: 'متوسط الحيازة', aum: 'الأصول على المنصّة', revenue: 'دخل الهامش السنوي التوضيحي' },
    rows: [
      { clients: '٥٠٠', holding: '٢٥٠٬٠٠٠ ج.م.', aum: '١٢٥ مليون ج.م.', revenue: '٦٢٥٬٠٠٠ ج.م.' },
      { clients: '٢٬٠٠٠', holding: '٢٥٠٬٠٠٠ ج.م.', aum: '٥٠٠ مليون ج.م.', revenue: '٢٫٥ مليون ج.م.' },
      { clients: '٥٬٠٠٠', holding: '٣٠٠٬٠٠٠ ج.م.', aum: '١٫٥ مليار ج.م.', revenue: '٧٫٥ مليون ج.م.' },
    ],
    assumption: 'أرقام توضيحية فقط. دخل الهامش السنوي ≈ العملاء × متوسط الحيازة × هامش ٠٫٥٠٪ على مدار سنة؛ عدّلها وفق افتراضاتك. ليست تنبؤًا.',
    invest: 'استثمارك لتحقيق ذلك: لا شيء سوى رخصتك.',
  },
  how: {
    title: 'كيف يعمل، من البداية للنهاية',
    steps: [
      { title: 'تسجيل رقمي', body: 'يفتح العملاء الحساب إلكترونيًا — الهوية، غسل الأموال، الملاءمة، الكود الموحّد والعقود الموقّعة. وقواعدك تقرّر من يُعتمد تلقائيًا.' },
      { title: 'تسعير عبر البنوك بـ FIX', body: 'كل طلب سعر يذهب لبنوكك الشريكة دفعةً واحدة عبر FIX 4.4. يحصل العميل على أفضل سعر، ويُقيَّد الهامش باسمك.' },
      { title: 'إدارة الدفتر باسمك', body: 'دفتر أستاذ مزدوج القيد، تسوية، كوبونات واستحقاقات، سحوبات بمبدأ صانع-مدقّق، كشوف حساب وسجل تدقيق كامل — في لوحتك.' },
    ],
  },
  close: {
    title: 'لنتحدّث',
    lead: 'إذا كان دخول سوق الدخل الثابت باسمك — دون تكلفة ودون بناء — يهمّك، فالخطوة التالية حديث قصير.',
    next: ['نجهّز التجربة باسمك وشعارك وألوانك', 'نستعرضها مع قادة الالتزام والعمليات لديك', 'نتفق على تجربة أولى مع أحد بنوكك الشريكة أو اثنين'],
  },
  contact: {
    title: 'ابدأ الحديث',
    lead: 'أخبرنا قليلًا عن شركتك وسنتواصل معك.',
    name: 'اسمك',
    firm: 'شركة الوساطة',
    role: 'دورك',
    email: 'البريد الإلكتروني',
    mobile: 'الهاتف',
    message: 'أي شيء تودّ إخبارنا به (اختياري)',
    submit: 'إرسال',
    sending: 'جارٍ الإرسال…',
    thanks: 'شكرًا لك — سنتواصل معك قريبًا.',
    error: 'حدث خطأ ما. من فضلك حاول مرة أخرى.',
  },
  footer: 'Agyal — التقنية خلف الوسطاء المرخّصين في مصر',
};

export const content: Record<Locale, Content> = { en, ar };
