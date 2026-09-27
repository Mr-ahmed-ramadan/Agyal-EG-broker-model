export type Locale = 'en' | 'ar';

const en = {
  nav: { how: 'How it works', features: 'Features', pricing: 'Pricing', faq: 'FAQ', cta: 'Book a demo', lang: 'العربية' },
  hero: {
    eyebrow: 'For licensed brokerage firms in Egypt',
    title: 'Offer T-bills, bonds and sukuk to your clients, under your brand',
    lead:
      'Agyal gives your firm a ready fixed-income platform: a branded app for your clients, fully online onboarding, live prices from partner banks over FIX, and the back office to run it. No technology team needed.',
    primary: 'Get your branded demo',
    secondary: 'See how it works',
    note: 'We set up a demo in your name, logo and colours.',
  },
  why: {
    title: 'Why brokers choose Agyal',
    items: [
      { title: 'Launch without building', body: 'Your clients get a finished app and your team a finished back office. We run the technology; you keep the client relationship.' },
      { title: 'Your brand, your clients', body: 'Your name, logo, colours and domain, in Arabic and English. Clients never see ours.' },
      { title: 'Best price from several banks', body: 'Every request goes to all your partner banks at once. Clients see the best price, with your markup and fees built in and disclosed.' },
    ],
  },
  how: {
    title: 'How it works',
    steps: [
      { title: 'We set you up', body: 'Your branded client app, broker console, pricing rules and links to your partner banks.' },
      { title: 'Clients open accounts online', body: 'Identity check, AML screening, investment profile and MCDR unified code, with your compliance team approving anything flagged.' },
      { title: 'They invest, you earn', body: 'Clients buy and sell at live bank prices. Orders go to the bank over FIX; your markup and commission are booked automatically.' },
    ],
  },
  features: {
    title: 'Everything a fixed-income desk needs',
    items: [
      { title: 'White-label app', body: 'Mobile-first web app in Arabic and English, in your brand.' },
      { title: 'Online onboarding', body: 'eKYC, AML screening, suitability and unified-code handling, with a compliance queue.' },
      { title: 'Live bank prices over FIX', body: 'Request-for-quote to several banks; firm prices with a countdown.' },
      { title: 'Buy and sell before maturity', body: 'Clients can exit early at the banks’ bid; proceeds shown net of fees.' },
      { title: 'Client-money ledger', body: 'Double-entry books per client, deposits by reference, daily balance checks.' },
      { title: 'Settlement and withdrawals', body: 'Settlement with banks, withdrawals to the client’s own IBAN with two-person approval.' },
      { title: 'Coupons and maturities', body: 'Coupons and redemptions credited to clients; matured holdings closed.' },
      { title: 'Compliance and audit', body: 'Every action logged with who and when; each broker’s data kept separate.' },
    ],
  },
  screens: {
    title: 'See it in action',
    client: 'Your clients’ app',
    broker: 'Your team’s console',
    captions: {
      quote: 'Live price from partner banks',
      sell: 'Selling before maturity',
      arabic: 'Portfolio in Arabic',
      orders: 'Orders and fills from banks',
      settlements: 'Settlement with banks',
      income: 'Coupons and maturities',
    },
  },
  pricing: {
    title: 'Simple pricing',
    lead: 'Free setup. Pay as your clients trade.',
    items: [
      { title: 'Growth', body: 'No setup fee and no subscription. A small technology fee per trade, billed monthly to your firm, never to your clients.' },
      { title: 'Scale', body: 'A fixed subscription with a lower per-trade fee, for firms with steady volume.' },
    ],
    note: 'Indicative. We agree terms with each broker.',
  },
  trust: {
    title: 'Built for a regulated business',
    items: [
      'You remain the licensed party for every client and trade; Agyal is your technology provider.',
      'Client money stays in your segregated account; Agyal never holds client funds.',
      'Two-step sign-in, confirmation codes for withdrawals and an audit trail of every action.',
      'Each broker’s data is isolated at the database level and encrypted where sensitive.',
    ],
  },
  faq: {
    title: 'Questions brokers ask',
    items: [
      { q: 'Do we need our own technology team?', a: 'No. We set up and run the platform. Your team works in a browser-based console.' },
      { q: 'Which banks can we connect?', a: 'Your partner banks. Banks with FIX connect directly; others can answer requests through a bank portal.' },
      { q: 'Which instruments are covered?', a: 'Treasury bills, treasury bonds, corporate bonds and sukuk.' },
      { q: 'What happens to our clients’ money?', a: 'It stays in your segregated client account. The platform keeps the ledger and helps you reconcile it.' },
      { q: 'Can we try it first?', a: 'Yes. We create a demo in your firm’s name, logo and colours that you can use on your phone.' },
    ],
  },
  contact: {
    title: 'Get your branded demo',
    lead: 'Tell us about your firm. We will send you a demo in your own brand.',
    name: 'Your name',
    firm: 'Brokerage firm',
    role: 'Your role',
    email: 'Work email',
    mobile: 'Mobile',
    message: 'Anything we should know? (optional)',
    submit: 'Request a demo',
    sending: 'Sending…',
    thanks: 'Thank you. We will be in touch shortly.',
    error: 'Something went wrong. Please try again, or email us.',
  },
  footer: 'Agyal Egypt. Technology for licensed brokers.',
};

type Content = typeof en;

const ar: Content = {
  nav: { how: 'كيف يعمل', features: 'المزايا', pricing: 'الأسعار', faq: 'الأسئلة', cta: 'اطلب عرضًا', lang: 'English' },
  hero: {
    eyebrow: 'لشركات السمسرة المرخّصة في مصر',
    title: 'قدّم أذون وسندات الخزانة والصكوك لعملائك باسم شركتك',
    lead:
      'تمنح أجيال شركتك منصة جاهزة لأدوات الدخل الثابت: تطبيقًا باسمك لعملائك، وفتح حسابات أونلاين بالكامل، وأسعارًا حيّة من البنوك الشريكة عبر FIX، ونظام تشغيل متكاملًا. دون الحاجة إلى فريق تقني.',
    primary: 'احصل على عرض باسم شركتك',
    secondary: 'تعرّف على طريقة العمل',
    note: 'نجهّز لك عرضًا تجريبيًا باسم شركتك وشعارها وألوانها.',
  },
  why: {
    title: 'لماذا تختار شركات السمسرة أجيال',
    items: [
      { title: 'انطلق دون بناء', body: 'يحصل عملاؤك على تطبيق جاهز وفريقك على نظام تشغيل جاهز. نحن نتولى التقنية، وتبقى العلاقة مع العميل لك.' },
      { title: 'علامتك وعملاؤك', body: 'اسمك وشعارك وألوانك ونطاقك، بالعربية والإنجليزية. لا يرى عملاؤك اسمنا.' },
      { title: 'أفضل سعر من عدة بنوك', body: 'يُرسل كل طلب إلى جميع البنوك الشريكة في آن واحد، ويرى العميل أفضل سعر متضمنًا هامشك ورسومك مع الإفصاح عنها.' },
    ],
  },
  how: {
    title: 'كيف يعمل',
    steps: [
      { title: 'نجهّز كل شيء', body: 'تطبيق العملاء باسمك، ولوحة تحكم الشركة، وقواعد التسعير، والربط مع بنوكك الشريكة.' },
      { title: 'يفتح العملاء حساباتهم أونلاين', body: 'التحقق من الهوية، وفحص مكافحة غسل الأموال، والملف الاستثماري، والكود الموحد من مصر للمقاصة، مع موافقة فريق الالتزام لديك على أي حالة تحتاج مراجعة.' },
      { title: 'يستثمرون وتربح', body: 'يشتري العملاء ويبيعون بأسعار البنوك الحيّة، وتُرسل الأوامر إلى البنك عبر FIX، ويُسجَّل هامشك وعمولتك تلقائيًا.' },
    ],
  },
  features: {
    title: 'كل ما يحتاجه مكتب الدخل الثابت',
    items: [
      { title: 'تطبيق باسمك', body: 'تطبيق ويب للموبايل أولًا بالعربية والإنجليزية وبهويتك.' },
      { title: 'فتح حساب أونلاين', body: 'التحقق الإلكتروني من الهوية، وفحص غسل الأموال، والملاءمة، والكود الموحد، مع قائمة مراجعة للالتزام.' },
      { title: 'أسعار حيّة من البنوك عبر FIX', body: 'طلب تسعير من عدة بنوك، وأسعار ملزمة بعدّاد زمني.' },
      { title: 'الشراء والبيع قبل الاستحقاق', body: 'يمكن للعميل البيع مبكرًا بسعر شراء البنك، مع عرض الصافي بعد الرسوم.' },
      { title: 'دفتر أموال العملاء', body: 'قيد مزدوج لكل عميل، وإيداعات برقم مرجعي، ومطابقة يومية.' },
      { title: 'التسوية والسحب', body: 'التسوية مع البنوك، والسحب إلى حساب العميل البنكي باسمه بموافقة شخصين.' },
      { title: 'الكوبونات والاستحقاقات', body: 'إضافة الكوبونات ومبالغ السداد لحسابات العملاء وإغلاق المراكز المستحقة.' },
      { title: 'الالتزام والتدقيق', body: 'تسجيل كل إجراء ومن قام به ومتى، مع فصل بيانات كل شركة.' },
    ],
  },
  screens: {
    title: 'شاهدها وهي تعمل',
    client: 'تطبيق عملائك',
    broker: 'لوحة تحكم فريقك',
    captions: {
      quote: 'سعر حيّ من البنوك الشريكة',
      sell: 'البيع قبل الاستحقاق',
      arabic: 'المحفظة بالعربية',
      orders: 'الأوامر والتنفيذ من البنوك',
      settlements: 'التسوية مع البنوك',
      income: 'الكوبونات والاستحقاقات',
    },
  },
  pricing: {
    title: 'أسعار بسيطة',
    lead: 'دون رسوم إعداد. تدفع كلما تداول عملاؤك.',
    items: [
      { title: 'النمو', body: 'دون رسوم إعداد أو اشتراك. رسوم تقنية صغيرة على كل صفقة تُحصَّل شهريًا من الشركة، ولا تُحمَّل على العملاء.' },
      { title: 'التوسع', body: 'اشتراك ثابت مع رسوم أقل على كل صفقة، للشركات ذات الأحجام المستقرة.' },
    ],
    note: 'استرشادية. نتفق على الشروط مع كل شركة.',
  },
  trust: {
    title: 'مصممة لنشاط خاضع للرقابة',
    items: [
      'تبقى شركتك الجهة المرخّصة لكل عميل وكل صفقة، وأجيال هي مزوّد التقنية.',
      'تبقى أموال العملاء في حسابك المنفصل، ولا تحتفظ أجيال بأي أموال للعملاء.',
      'تسجيل دخول بخطوتين، ورموز تأكيد لعمليات السحب، وسجل تدقيق لكل إجراء.',
      'بيانات كل شركة معزولة على مستوى قاعدة البيانات ومشفّرة حيث تكون حساسة.',
    ],
  },
  faq: {
    title: 'أسئلة تطرحها شركات السمسرة',
    items: [
      { q: 'هل نحتاج إلى فريق تقني خاص بنا؟', a: 'لا. نحن نجهّز المنصة ونشغّلها، ويعمل فريقك من خلال لوحة تحكم على المتصفح.' },
      { q: 'ما البنوك التي يمكننا الربط معها؟', a: 'بنوكك الشريكة. البنوك التي تدعم FIX ترتبط مباشرة، والبقية يمكنها الرد على الطلبات من خلال بوابة للبنوك.' },
      { q: 'ما الأدوات المتاحة؟', a: 'أذون الخزانة، وسندات الخزانة، وسندات الشركات، والصكوك.' },
      { q: 'ماذا يحدث لأموال عملائنا؟', a: 'تبقى في حساب العملاء المنفصل لديك، وتحتفظ المنصة بالدفاتر وتساعدك على مطابقتها.' },
      { q: 'هل يمكننا التجربة أولًا؟', a: 'نعم. نجهّز لك عرضًا تجريبيًا باسم شركتك وشعارها وألوانها يمكنك استخدامه من الموبايل.' },
    ],
  },
  contact: {
    title: 'احصل على عرض باسم شركتك',
    lead: 'أخبرنا عن شركتك، وسنرسل لك عرضًا تجريبيًا بهويتك.',
    name: 'الاسم',
    firm: 'شركة السمسرة',
    role: 'المنصب',
    email: 'البريد الإلكتروني للعمل',
    mobile: 'رقم الموبايل',
    message: 'هل هناك ما تود إخبارنا به؟ (اختياري)',
    submit: 'اطلب عرضًا',
    sending: 'جارٍ الإرسال…',
    thanks: 'شكرًا لك. سنتواصل معك قريبًا.',
    error: 'حدث خطأ. حاول مرة أخرى أو راسلنا عبر البريد.',
  },
  footer: 'أجيال مصر. تقنية لشركات السمسرة المرخّصة.',
};

export const content: Record<Locale, Content> = { en, ar };
