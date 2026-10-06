/**
 * Copy for the public awareness campaign.
 *
 * Guardrails, because this is consumer-facing and Agyal is not licensed:
 * - the only account offered here is a demo one, and the page says its money
 *   is simulated. Never imply a real investment account or a real holding.
 * - every figure is indicative and said to be so.
 * - the footer carries one line stating that Agyal is a technology company,
 *   that real investing is through an FRA-licensed entity holding client
 *   money, and that Agyal holds neither money nor securities. Said once:
 *   repeating it through the body was the main source of duplication.
 * - Arabic is the default, in Egyptian dialect, as on the broker showcase.
 * - keep sentences short and avoid dashes; both were asked for by name.
 */

export const LANDING = {
  ar: {
    dir: 'rtl' as const,
    switch: 'English',
    brand: 'أجيال',
    navCalc: 'احسب عائدك',
    navHow: 'الفرق',
    navJoin: 'ابدأ',
    navSignIn: 'تسجيل الدخول',

    heroEyebrow: 'أذون الخزانة المصرية',
    heroTitle: 'طريقة تانية تحطّ فيها فلوسك',
    heroLead:
      'بدل ما فلوسك قاعدة في وديعة، تسلّفها للحكومة المصرية لمدة محدّدة بعائد معروف من أول يوم. من موبايلك.',

    diffTitle: 'الوديعة والأذون: إيه الفرق؟',
    diffLead: 'الاتنين بتحطّ فيهم فلوسك لمدة. الفرق في مين بتسلّفه، والعائد، والضريبة.',
    diffColDeposit: 'وديعة بنكية',
    diffColBill: 'أذون خزانة',
    diff: [
      { k: 'بتسلّف مين؟', deposit: 'البنك', bill: 'الحكومة المصرية' },
      { k: 'العائد', deposit: 'البنك بيحدّده', bill: 'السوق بيحدّده، وغالبًا أعلى' },
      { k: 'الضريبة', deposit: 'معفي للأفراد', bill: '٢٠٪ على العائد' },
      { k: 'تحتاج تخرج بدري؟', deposit: 'بتكسر الوديعة وبتخسر عائد', bill: 'تقدر تبيع بسعر السوق' },
    ],
    diffNote: 'عشان المقارنة تبقى عادلة، الحاسبة تحت بتوريك العائد بعد الضريبة والمصاريف.',

    calcTitle: 'اعرف هتاخد كام',
    calcLead: 'جرّب بأي مبلغ ومدة. الأرقام استرشادية وبتتغير مع السوق.',
    calcAmount: 'المبلغ (جنيه)',
    calcTenor: 'المدة',
    calcGo: 'احسب',
    calcWorking: 'بنحسب…',
    /** Arabic takes the plural for 3–10 and the singular from 11 up. */
    months: (m: number, formatted: string) => `${formatted} ${m <= 10 ? 'شهور' : 'شهر'}`,
    resInvested: 'اللي هتدفعه',
    resReceive: 'اللي هتستلمه',
    resProfit: 'الربح',
    resNetYield: 'العائد الصافي سنويًا',
    resVsDeposit: 'مقارنة بوديعة لنفس المدة',
    resAfterTax: 'بعد الضريبة والمصاريف',
    resBetter: (x: string) => `أعلى من الوديعة بـ ${x}`,
    resWorse: (x: string) => `أقل من الوديعة بـ ${x}`,
    calcDisclaimer: 'أرقام استرشادية على أسعار السوق الحالية وبتتغير. مش عرض ولا وعد بعائد.',

    howTitle: 'حاجتين يهمّك تعرفهم',
    how: [
      {
        h: 'السعر بييجي منين؟',
        p: 'بنطلب سعر من أكتر من بنك شريك في نفس اللحظة، وبنوريك أحسن سعر رجعلنا.',
      },
      {
        h: 'الورق بيتسجّل باسم مين؟',
        p: 'باسمك إنت، بكودك الموحد في مصر للمقاصة أو البنك المركزي. مش باسم المنصّة.',
      },
    ],

    signupTitle: 'افتح حساب تجريبي',
    signupLead:
      'اسمك وإيميلك بس. هتشوف الأسعار، تشتري، وتتابع عائدك بنفسك. من غير رقم قومي ولا مستندات ولا كلمة سر.',
    signupCta: 'افتح حساب تجريبي',
    signupSubmit: 'افتح حسابي',
    signupSending: 'بنجهّز حسابك…',
    codeTitle: 'اكتب الكود',
    codeLead: (where: string) => `بعتنا كود من ٦ أرقام على ${where}.`,
    codeField: 'الكود',
    codeCta: 'ادخل',
    codeSending: 'بنتأكد…',
    codeResend: 'ابعت الكود تاني',
    haveAccount: 'عندك حساب قبل كده؟',
    signinHere: 'ادخل من هنا',
    signupWarning: 'الفلوس في الحساب ده وهمية وللتجربة بس. مش حساب استثمار حقيقي.',
    fPhone: 'الموبايل (اختياري)',
    fPhoneHint: 'لو حابب نتواصل معاك.',

    proTitle: 'شركة سمسرة أو بنك؟',
    proLead: 'لو إنت جاي من جهة مرخّصة وعايز تشوف المنصّة من ناحية المؤسسات، الصفحة بتاعتك هنا.',
    proCta: 'egypt.agyal.net',

    joinTitle: 'مش عايز تفتح حساب؟',
    joinLead: 'سيب إيميلك وهنبلّغك أول ما نفتح رسمي.',
    joinToggle: 'بلّغني بس لما تفتحوا',
    fName: 'اسمك',
    fEmail: 'الإيميل',
    fMobile: 'الموبايل',
    fOneOf: 'سيب إيميل أو موبايل، واحد منهم يكفي.',
    fGovernorate: 'المحافظة',
    fAmount: 'تحب تبدأ بكام؟',
    fSaves: 'فلوسك دلوقتي فين؟',
    fChoose: 'اختر',
    fConsent: 'موافق إن أجيال تتواصل معايا بخصوص الخدمة دي.',
    fSubmit: 'بلّغوني',
    fSending: 'بنبعت…',
    fDone: 'تمام. هنبلّغك أول ما نفتح.',
    fDoneAgain: 'إنت بالفعل على القايمة. هنبلّغك أول ما نفتح.',
    fErrorConsent: 'لازم توافق الأول.',
    fErrorContact: 'سيب إيميل أو رقم موبايل.',

    amountBands: {
      UNDER_10K: 'أقل من ١٠ آلاف',
      FROM_10K_TO_50K: 'من ١٠ لـ ٥٠ ألف',
      FROM_50K_TO_250K: 'من ٥٠ لـ ٢٥٠ ألف',
      FROM_250K_TO_1M: 'من ٢٥٠ ألف لمليون',
      OVER_1M: 'أكتر من مليون',
    } as Record<string, string>,
    savesIn: {
      DEPOSIT: 'وديعة في البنك',
      CERTIFICATE: 'شهادات',
      GOLD: 'دهب',
      NONE: 'مش مستثمرة',
      OTHER: 'حاجة تانية',
    } as Record<string, string>,

    footerLegal:
      'أجيال شركة تكنولوجيا. الاستثمار الحقيقي بيتم من خلال جهة مرخّصة من الهيئة العامة للرقابة المالية، وهي اللي بتحتفظ بفلوس العملاء. أجيال عمرها ما بتحتفظ بفلوسك ولا بأوراقك.',
    footerPrivacy:
      'بياناتك بنستخدمها علشان نتواصل معاك بس، وبنمسحها أول ما تطلب. مش بنطلب رقم قومي ولا مستندات ولا بيانات بنكية.',
  },

  en: {
    dir: 'ltr' as const,
    switch: 'العربية',
    brand: 'Agyal',
    navCalc: 'Calculate',
    navHow: 'The difference',
    navJoin: 'Start',
    navSignIn: 'Sign in',

    heroEyebrow: 'Egyptian treasury bills',
    heroTitle: 'Another place to put your cash',
    heroLead:
      'Instead of leaving it in a deposit, you lend it to the Egyptian government for a set term at a return you know from day one. From your phone.',

    diffTitle: 'Deposit or treasury bills?',
    diffLead: 'Both hold your cash for a term. The difference is who you lend to, the return, and tax.',
    diffColDeposit: 'Bank deposit',
    diffColBill: 'Treasury bills',
    diff: [
      { k: 'Who you lend to', deposit: 'The bank', bill: 'The Egyptian government' },
      { k: 'The return', deposit: 'Set by the bank', bill: 'Set by the market, usually higher' },
      { k: 'Tax', deposit: 'Exempt for individuals', bill: '20% on the return' },
      { k: 'Getting out early', deposit: 'Breaking it costs you return', bill: 'You can sell at the market price' },
    ],
    diffNote: 'To compare them fairly, the calculator below shows the return after tax and fees.',

    calcTitle: 'See what you would earn',
    calcLead: 'Try any amount and term. Figures are indicative and move with the market.',
    calcAmount: 'Amount (EGP)',
    calcTenor: 'Term',
    calcGo: 'Calculate',
    calcWorking: 'Working…',
    months: (m: number, formatted: string) => `${formatted} month${m === 1 ? '' : 's'}`,
    resInvested: 'You pay',
    resReceive: 'You receive',
    resProfit: 'Profit',
    resNetYield: 'Net yield a year',
    resVsDeposit: 'Against a same-term deposit',
    resAfterTax: 'after tax and fees',
    resBetter: (x: string) => `${x} ahead of a deposit`,
    resWorse: (x: string) => `${x} behind a deposit`,
    calcDisclaimer: 'Indicative, based on current market rates, and subject to change. Not an offer.',

    howTitle: 'Two things worth knowing',
    how: [
      {
        h: 'Where does the price come from?',
        p: 'We ask several partner banks at the same moment and show you the best quote that comes back.',
      },
      {
        h: 'Whose name is the paper in?',
        p: 'Yours, under your own unified code at MCDR or the Central Bank. Never in the platform’s name.',
      },
    ],

    signupTitle: 'Open a demo account',
    signupLead:
      'Just your name and email. See live prices, buy, and follow your return yourself. No national ID, no documents, no password.',
    signupCta: 'Open a demo account',
    signupSubmit: 'Open my account',
    signupSending: 'Setting up your account…',
    codeTitle: 'Enter the code',
    codeLead: (where: string) => `We sent a 6-digit code to ${where}.`,
    codeField: 'Code',
    codeCta: 'Enter',
    codeSending: 'Checking…',
    codeResend: 'Send the code again',
    haveAccount: 'Already have an account?',
    signinHere: 'Sign in here',
    signupWarning: 'The money in this account is simulated, for trying things out. Not a real investment account.',
    fPhone: 'Mobile (optional)',
    fPhoneHint: 'If you would like us to get in touch.',

    proTitle: 'A brokerage firm or a bank?',
    proLead: 'If you are here from a licensed institution and want the institutional view of the platform, your page is here.',
    proCta: 'egypt.agyal.net',

    joinTitle: 'Not ready to open one?',
    joinLead: 'Leave your email and we will tell you when we open.',
    joinToggle: 'Just tell me when you launch',
    fName: 'Your name',
    fEmail: 'Email',
    fMobile: 'Mobile',
    fOneOf: 'An email or a mobile number. Either is enough.',
    fGovernorate: 'Governorate',
    fAmount: 'How much would you start with?',
    fSaves: 'Where are your savings today?',
    fChoose: 'Choose',
    fConsent: 'I agree that Agyal may contact me about this service.',
    fSubmit: 'Tell me when you open',
    fSending: 'Sending…',
    fDone: 'Done. We will tell you when we open.',
    fDoneAgain: 'You are already on the list. We will tell you when we open.',
    fErrorConsent: 'Please agree first.',
    fErrorContact: 'Leave an email or a mobile number.',

    amountBands: {
      UNDER_10K: 'Under 10,000',
      FROM_10K_TO_50K: '10,000 – 50,000',
      FROM_50K_TO_250K: '50,000 – 250,000',
      FROM_250K_TO_1M: '250,000 – 1,000,000',
      OVER_1M: 'Over 1,000,000',
    } as Record<string, string>,
    savesIn: {
      DEPOSIT: 'A bank deposit',
      CERTIFICATE: 'Certificates',
      GOLD: 'Gold',
      NONE: 'Not invested',
      OTHER: 'Something else',
    } as Record<string, string>,

    footerLegal:
      'Agyal is a technology company. Real investing happens through an entity licensed by the Financial Regulatory Authority, which holds all client money. Agyal never holds your money or your securities.',
    footerPrivacy:
      'We use your details only to contact you, and delete them as soon as you ask. We do not ask for a national ID, documents or bank details.',
  },
};

export type LandingLocale = keyof typeof LANDING;

/** Governorate labels; the API holds the canonical list. */
export const GOVERNORATE_LABEL: Record<string, { ar: string; en: string }> = {
  CAIRO: { ar: 'القاهرة', en: 'Cairo' },
  GIZA: { ar: 'الجيزة', en: 'Giza' },
  ALEXANDRIA: { ar: 'الإسكندرية', en: 'Alexandria' },
  QALYUBIA: { ar: 'القليوبية', en: 'Qalyubia' },
  SHARQIA: { ar: 'الشرقية', en: 'Sharqia' },
  DAKAHLIA: { ar: 'الدقهلية', en: 'Dakahlia' },
  BEHEIRA: { ar: 'البحيرة', en: 'Beheira' },
  MINYA: { ar: 'المنيا', en: 'Minya' },
  SOHAG: { ar: 'سوهاج', en: 'Sohag' },
  ASYUT: { ar: 'أسيوط', en: 'Asyut' },
  GHARBIA: { ar: 'الغربية', en: 'Gharbia' },
  MONUFIA: { ar: 'المنوفية', en: 'Monufia' },
  KAFR_EL_SHEIKH: { ar: 'كفر الشيخ', en: 'Kafr El Sheikh' },
  FAYOUM: { ar: 'الفيوم', en: 'Fayoum' },
  BENI_SUEF: { ar: 'بني سويف', en: 'Beni Suef' },
  QENA: { ar: 'قنا', en: 'Qena' },
  ASWAN: { ar: 'أسوان', en: 'Aswan' },
  LUXOR: { ar: 'الأقصر', en: 'Luxor' },
  DAMIETTA: { ar: 'دمياط', en: 'Damietta' },
  ISMAILIA: { ar: 'الإسماعيلية', en: 'Ismailia' },
  PORT_SAID: { ar: 'بورسعيد', en: 'Port Said' },
  SUEZ: { ar: 'السويس', en: 'Suez' },
  NORTH_SINAI: { ar: 'شمال سيناء', en: 'North Sinai' },
  SOUTH_SINAI: { ar: 'جنوب سيناء', en: 'South Sinai' },
  MATROUH: { ar: 'مطروح', en: 'Matrouh' },
  NEW_VALLEY: { ar: 'الوادي الجديد', en: 'New Valley' },
  RED_SEA: { ar: 'البحر الأحمر', en: 'Red Sea' },
};
