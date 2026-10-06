/**
 * Copy for the public awareness campaign.
 *
 * Guardrails, because this is consumer-facing and Agyal is not licensed:
 * - never "open an account", "invest now" or "your money" — nobody has an
 *   account yet and nothing here is an offer;
 * - every figure is indicative and said to be so;
 * - it says plainly that Agyal is a technology provider and that investing
 *   happens through an FRA-licensed brokerage firm;
 * - Arabic is the default and is written in Egyptian dialect, as on the
 *   broker-facing showcase.
 */

export const LANDING = {
  ar: {
    dir: 'rtl' as const,
    switch: 'English',
    brand: 'أجيال',
    navCalc: 'احسب عائدك',
    navHow: 'بيشتغل إزاي',
    navJoin: 'احجز مكانك',

    heroEyebrow: 'أذون وسندات الحكومة المصرية',
    heroTitle: 'فلوسك تستاهل عائد أحسن',
    heroLead:
      'أذون الخزانة بتدي عائد أعلى من الشهادة في أغلب الأوقات، بس الوصول ليها لسه صعب ومحتاج تروح الفرع. إحنا بنخلّيها من موبايلك، بأقل مبلغ، ومن غير ورق.',
    heroNote: 'لسه مفتحناش. سيب بياناتك وهنبلّغك أول ما نفتح.',

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
    calcDisclaimer:
      'الأرقام دي استرشادية، محسوبة على أسعار السوق الحالية، وبتتغير. مش عرض ولا وعد بعائد.',

    howTitle: 'بيشتغل إزاي',
    how: [
      {
        h: 'إيه هي أذون الخزانة؟',
        p: 'دين قصير الأجل على الحكومة المصرية. بتشتريه بأقل من قيمته، وفي الميعاد بتاخد القيمة كاملة. الفرق ده هو ربحك.',
      },
      {
        h: 'الفلوس بتبقى فين؟',
        p: 'في حساب العملاء المنفصل عند شركة السمسرة المرخّصة — مش عند أجيال. والورق بيتسجّل باسمك أنت بكودك في مصر للمقاصة.',
      },
      {
        h: 'ليه من خلال شركة سمسرة؟',
        p: 'لأن دي الجهة المرخّصة من الهيئة العامة للرقابة المالية. أجيال بتوفّر التكنولوجيا بس، وشركة السمسرة هي اللي بتتعامل معاك.',
      },
      {
        h: 'الضرايب؟',
        p: 'بتتخصم من العائد وبنوريهالك قبل ما تبدأ، مش مفاجأة في الآخر.',
      },
    ],

    joinTitle: 'احجز مكانك',
    joinLead: 'هنبلّغك أول ما نفتح. مش هنطلب منك رقم قومي ولا أي مستندات دلوقتي.',
    fName: 'اسمك',
    fEmail: 'الإيميل',
    fMobile: 'الموبايل',
    fOneOf: 'سيب إيميل أو موبايل، واحد منهم يكفي.',
    fGovernorate: 'المحافظة',
    fAmount: 'تحب تبدأ بكام؟',
    fSaves: 'فلوسك دلوقتي فين؟',
    fChoose: 'اختر',
    fConsent: 'موافق إن أجيال تتواصل معايا بخصوص الخدمة دي.',
    fSubmit: 'احجز مكاني',
    fSending: 'بنبعت…',
    fDone: 'تمام، مكانك اتحجز. هنبلّغك أول ما نفتح.',
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
      'أجيال شركة تكنولوجيا، مش شركة سمسرة. الاستثمار هيتم من خلال شركة سمسرة مرخّصة من الهيئة العامة للرقابة المالية، وهي اللي بتحتفظ بفلوس العملاء. أجيال عمرها ما بتحتفظ بفلوسك ولا بأوراقك. كل الأرقام في الصفحة دي استرشادية ومش عرض.',
    footerPrivacy:
      'البيانات اللي بتسيبها بنستخدمها علشان نبلّغك بس، وبنحتفظ بيها لحد ما تطلب مسحها. مش بنطلب رقم قومي ولا مستندات ولا بيانات بنكية.',
  },

  en: {
    dir: 'ltr' as const,
    switch: 'العربية',
    brand: 'Agyal',
    navCalc: 'Calculate',
    navHow: 'How it works',
    navJoin: 'Join',

    heroEyebrow: 'Egyptian government treasury bills and bonds',
    heroTitle: 'Your savings deserve a better return',
    heroLead:
      'Treasury bills usually pay more than a bank certificate, but reaching them still means a branch visit and paperwork. We are making them available from your phone, at a smaller minimum, with no forms.',
    heroNote: 'We have not opened yet. Leave your details and we will tell you when we do.',

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
    calcDisclaimer:
      'Indicative only, based on current market rates, and subject to change. Not an offer and not a promise of return.',

    howTitle: 'How it works',
    how: [
      {
        h: 'What is a treasury bill?',
        p: 'Short-term debt of the Egyptian government. You buy below face value and are repaid the full value at maturity. The difference is your return.',
      },
      {
        h: 'Where does the money sit?',
        p: "In the segregated client account at a licensed brokerage firm — never with Agyal. Each security is registered under your own code at MCDR.",
      },
      {
        h: 'Why through a brokerage firm?',
        p: 'Because that is the party licensed by the Financial Regulatory Authority. Agyal provides the technology; the brokerage firm is who you contract with.',
      },
      {
        h: 'What about tax?',
        p: 'It is deducted from the return, and we show it to you before you commit rather than as a surprise at the end.',
      },
    ],

    joinTitle: 'Join the waitlist',
    joinLead: 'We will tell you when we open. We are not asking for a national ID or any documents.',
    fName: 'Your name',
    fEmail: 'Email',
    fMobile: 'Mobile',
    fOneOf: 'An email or a mobile number — either is enough.',
    fGovernorate: 'Governorate',
    fAmount: 'How much would you start with?',
    fSaves: 'Where are your savings today?',
    fChoose: 'Choose',
    fConsent: 'I agree that Agyal may contact me about this service.',
    fSubmit: 'Reserve my place',
    fSending: 'Sending…',
    fDone: 'Done — your place is reserved. We will tell you when we open.',
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
      'Agyal is a technology company, not a brokerage firm. Investing will be through a brokerage firm licensed by the Financial Regulatory Authority, which holds all client money. Agyal never holds your money or your securities. Every figure on this page is indicative and is not an offer.',
    footerPrivacy:
      'We use the details you leave only to tell you when we open, and we keep them until you ask us to delete them. We do not ask for a national ID, documents or bank details.',
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
