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
    title: 'Why it makes sense to join',
    lead: 'You have the licence. We bring everything else it takes to turn it into a live fixed-income business, and we grow it with you.',
    points: [
      { title: 'You provide the licence', body: 'You stay the licensed, regulated party. Your brand, your rules, your name on every agreement. We are the technology behind you.' },
      { title: 'Nothing to build, nothing to invest', body: 'No platform to build, no engineers to hire, no upfront cost. We set it up, run it, and keep it secure and compliant.' },
      { title: 'Customers onboard themselves, online', body: 'Account opening is fully digital: identity, AML, suitability and e-signed agreements, on the platform you just tried.' },
      { title: 'A new income line, in your name', body: 'The margin on every trade is booked under your brokerage. Fee income from a product you cannot offer today.' },
      { title: 'A real partnership', body: 'We only earn from the margin your desk produces, so we are on the same side. We share the build, the bank connections and the growth.' },
    ],
    footnote: 'The only real change from what you just tried is your brand on the front and the margin in your name.',
  },
  numbers: {
    title: 'What it could mean for your firm',
    lead: 'Egyptian savers want government paper, and today most of it is still bought the slow way, in a branch. A digital channel in your name meets that demand, at no cost to you.',
    stats: [
      { value: '~25%+', label: 'Typical yields on Egyptian treasury bills and bonds, among the highest in the region.' },
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
    title: 'How it works',
    steps: [
      { title: 'Customers onboard online', body: 'They open an account online: identity, AML, suitability and e-signed agreements. Your rules decide who is approved automatically.' },
      { title: 'Best price across your banks', body: 'Each price request goes to all your partner banks at once over FIX. The customer gets the best price, and the margin is booked in your name.' },
      { title: 'Run the book in your console', body: 'Ledger, settlement, coupons, maturities, withdrawals with maker and checker, statements and a full audit trail, all in one place.' },
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
  nav: { offer: 'العرض', tryit: 'جرّبه مباشرة', numbers: 'الأرقام', contact: 'تواصل معنا', lang: 'English', cta: 'ابدأ الحديث' },
  hero: {
    eyebrow: 'شراكة لشركات الوساطة المرخّصة',
    title: 'قدّم أدوات الدخل الثابت باسم شركتك. أنت تملك الرخصة، ونحن نوفّر التقنية.',
    lead:
      'المصريون يريدون وضع مدّخراتهم في أذون وسندات الخزانة والصكوك، لكن شراءها إلكترونيًا لم يكن سهلًا يومًا. المنصّة التي تجعله سهلًا موجودة بالفعل. أنت تملك الرخصة لتقديمها، ونحن نشغّل التقنية خلف علامتك. لا شيء تبنيه، ولا شيء تستثمره.',
    primary: 'جرّب المنتج مباشرة الآن',
    secondary: 'لماذا يناسبك',
    note: 'تجربة حيّة بالأسفل. شاشات حقيقية، بنوك محاكاة، دون تسجيل.',
  },
  try: {
    title: 'جرّبه مباشرة، الآن',
    lead:
      'هذه هي المنتجات الحقيقية، نفس ما سيستخدمه عملاؤك وفريقك، تعمل على وسيط تجريبي. افتح أيًّا منها وسجّل الدخول بالبيانات الموضّحة. يظهر رمز التحقق على الشاشة لتدخل مباشرة.',
    codeNote: 'لهذه الحسابات التجريبية، يظهر رمز الدخول على شاشة الدخول.',
    emailLabel: 'البريد الإلكتروني',
    passwordLabel: 'كلمة المرور',
    open: 'افتح البوابة',
    copy: 'نسخ',
    copied: 'تم النسخ',
    client: {
      tag: 'ما يراه عملاؤك',
      title: 'تطبيق المستثمر',
      desc: 'فتح حساب، وتصفّح أسعار اليوم، ومعرفة العائد بعد الضريبة لأي ورقة، والشراء بسعر حيّ من البنوك الشريكة. بالعربية والإنجليزية، وللهاتف أولًا.',
    },
    ops: {
      tag: 'ما يديره فريقك',
      title: 'لوحة الوسيط والعمليات',
      desc: 'التسجيل، والأكواد الموحّدة والحفظ، والإيداعات، والأوامر، والتسوية، والكوبونات، والسحوبات، ودفتر الأستاذ. كل ما تحتاجه فرق العمليات والمالية والالتزام.',
    },
  },
  offer: {
    title: 'لماذا الانضمام في مصلحتك',
    lead: 'أنت تملك الرخصة. ونحن نوفّر كل ما يلزم لتحويلها إلى نشاط دخل ثابت مباشر، وننمّيه معك.',
    points: [
      { title: 'أنت تقدّم الرخصة', body: 'تبقى أنت الطرف المرخّص والخاضع للرقابة. علامتك، وقواعدك، واسمك على كل عقد. ونحن التقنية خلفك.' },
      { title: 'لا شيء تبنيه، ولا شيء تستثمره', body: 'لا منصّة تبنيها، ولا مهندسين توظّفهم، ولا تكلفة مقدّمة. نجهّزها ونشغّلها ونؤمّنها ونلتزم بالمتطلبات.' },
      { title: 'عملاؤك يسجّلون أنفسهم إلكترونيًا', body: 'فتح الحساب رقمي بالكامل: الهوية، وفحص غسل الأموال، والملاءمة، والعقود الموقّعة إلكترونيًا، على المنصّة التي جرّبتها للتو.' },
      { title: 'مصدر دخل جديد باسمك', body: 'يُقيَّد هامش كل صفقة تحت اسم شركتك. دخل من منتج لا تقدّمه اليوم.' },
      { title: 'شراكة حقيقية', body: 'لا نكسب إلا من الهامش الذي يحقّقه مكتبك، فنحن في صفّك. نتقاسم البناء والربط مع البنوك والنمو.' },
    ],
    footnote: 'التغيير الوحيد عمّا جرّبته هو علامتك في الواجهة والهامش باسمك.',
  },
  numbers: {
    title: 'ماذا يمكن أن يعني ذلك لشركتك',
    lead: 'المدّخرون في مصر يريدون أوراق الحكومة، ومعظمها ما زال يُشترى بالطريقة البطيئة عبر الفروع. قناة رقمية باسمك تلبّي هذا الطلب، دون تكلفة عليك.',
    stats: [
      { value: '~٢٥٪+', label: 'عوائد نموذجية على أذون وسندات الخزانة المصرية، من الأعلى في المنطقة.' },
      { value: 'تريليونات ج.م.', label: 'مدّخرات الأسر ما زالت في ودائع تعطي أقل بعد الضريبة.' },
      { value: 'نمو سريع', label: 'رغبة الأفراد في حيازة أوراق الخزانة مباشرةً متى صار شراؤها سهلًا.' },
    ],
    cols: { clients: 'العملاء', holding: 'متوسط الحيازة', aum: 'الأصول على المنصّة', revenue: 'دخل الهامش السنوي التوضيحي' },
    rows: [
      { clients: '٥٠٠', holding: '٢٥٠٬٠٠٠ ج.م.', aum: '١٢٥ مليون ج.م.', revenue: '٦٢٥٬٠٠٠ ج.م.' },
      { clients: '٢٬٠٠٠', holding: '٢٥٠٬٠٠٠ ج.م.', aum: '٥٠٠ مليون ج.م.', revenue: '٢٫٥ مليون ج.م.' },
      { clients: '٥٬٠٠٠', holding: '٣٠٠٬٠٠٠ ج.م.', aum: '١٫٥ مليار ج.م.', revenue: '٧٫٥ مليون ج.م.' },
    ],
    assumption: 'أرقام توضيحية فقط. تقريبًا: العملاء × متوسط الحيازة × هامش ٠٫٥٠٪ خلال سنة. عدّلها وفق افتراضاتك. ليست تنبؤًا.',
    invest: 'ما تستثمره لتحقيق ذلك: رخصتك فقط.',
  },
  how: {
    title: 'كيف يعمل',
    steps: [
      { title: 'العملاء يسجّلون إلكترونيًا', body: 'يفتحون الحساب أونلاين: الهوية، وغسل الأموال، والملاءمة، والعقود الموقّعة. وقواعدك تقرّر من يُعتمد تلقائيًا.' },
      { title: 'أفضل سعر عبر بنوكك', body: 'كل طلب سعر يذهب لكل بنوكك الشريكة دفعةً واحدة عبر FIX. يحصل العميل على أفضل سعر، ويُقيَّد الهامش باسمك.' },
      { title: 'أدر الدفتر في لوحتك', body: 'دفتر الأستاذ، والتسوية، والكوبونات، والاستحقاقات، والسحوبات بمبدأ صانع ومدقّق، وكشوف الحساب وسجل تدقيق كامل، في مكان واحد.' },
    ],
  },
  close: {
    title: 'لنتحدّث',
    lead: 'إذا كان مكتب دخل ثابت باسمك، دون تكلفة ودون بناء، يستحق نظرة، فالخطوة التالية حديث قصير.',
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
    thanks: 'شكرًا لك، سنتواصل معك قريبًا.',
    error: 'حدث خطأ ما. من فضلك حاول مرة أخرى.',
  },
  footer: 'Agyal، التقنية خلف الوسطاء المرخّصين في مصر',
};

export const content: Record<Locale, Content> = { en, ar };
