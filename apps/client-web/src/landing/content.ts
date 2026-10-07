/**
 * Copy for the public awareness campaign.
 *
 * The page reads in one order, and the copy is written to hold it: what this is,
 * how the instruments differ from a deposit or certificate, the calculator, then
 * the demo account. Anything that interrupts that sequence belongs below it.
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
    navDiff: 'الفرق',
    navJoin: 'حساب تجريبي',
    navSignIn: 'تسجيل الدخول',

    heroEyebrow: 'أدوات الدخل الثابت في مصر',
    beta: 'نسخة تجريبية',
    heroTitle: 'طريقة تانية تحطّ فيها فلوسك',
    heroLead:
      'بدل ما فلوسك قاعدة في وديعة، تسلّفها للحكومة المصرية أو لشركة لمدة محدّدة بعائد معروف من أول يوم. من موبايلك.',

    cmpTitle: 'إيه الفرق بين ده وبين الوديعة؟',
    cmpLead: 'كلهم بيحطّوا فلوسك لمدة بعائد. اللي بيختلف هو الخصائص: بتسلّف مين، وإمتى تقدر تخرج، والضريبة.',
    cmpChars: 'الخصائص',
    cmpWho: 'بتسلّف مين',
    cmpTerm: 'المدة والخروج',
    cmpYield: 'العائد والضريبة',
    cmp: [
      {
        h: 'وديعة أو شهادة',
        who: 'البنك',
        term: 'مدة محدّدة. لو خرجت بدري بتكسر الوديعة وبتخسر عائد.',
        yield: 'البنك بيحدّد العائد، ومعفي من الضريبة للأفراد.',
      },
      {
        h: 'أذون خزانة',
        who: 'الحكومة المصرية',
        term: 'من ٣ لـ ١٢ شهر. تقدر تبيع في السوق قبل الميعاد.',
        yield: 'السوق بيحدّد العائد، وعليه ٢٠٪ ضريبة.',
      },
      {
        h: 'سندات خزانة',
        who: 'الحكومة المصرية',
        term: 'سنتين أو أكتر. بتبيع في السوق لو احتجت.',
        yield: 'كوبون بييجي كل فترة، وعليه ٢٠٪ ضريبة.',
      },
      {
        h: 'صكوك وسندات شركات',
        who: 'شركة، مش الحكومة',
        term: 'على حسب الإصدار.',
        yield: 'بيدي عائد أعلى من ورق الحكومة، لأن الشركة ممكن تتعثر في السداد. الصكوك بديل متوافق مع الشريعة.',
      },
    ],
    cmpNote: 'ورق الحكومة وورق الشركات مالهمش نفس الخصائص. الحكومة هي الجهة الأأمن في السداد، والشركة ممكن تتعثر، وعشان كده ورقها بيدي أعلى. إحنا بنوضّح خصائص كل ورقة قبل ما تشتري.',
    cmpFx: 'كله بالجنيه المصري دلوقتي. شغالين على إتاحة أذون وسندات بعملات تانية، ولسه مش متاحة.',
    cmpToCalc: 'عشان المقارنة تبقى عادلة، الحاسبة تحت بتوريك العائد بعد الضريبة والمصاريف.',

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

    whyTitle: 'ليه من هنا، مش من سمسار عادي؟',
    whyLead: 'الخدمة متبنية رقمية من الأساس، مش فرع بيتعمله موقع.',
    why: [
      {
        h: 'من غير ما تروح فرع',
        p: 'فتح الحساب والتحقق من هويتك بيتمّوا من التطبيق. مش هتضيّع يوم إجازة في طابور.',
      },
      {
        h: 'كل حاجة إلكترونية',
        p: 'كشف الحساب، إشعارات التنفيذ، وأوراقك كلها في مكان واحد وقدّامك في أي وقت.',
      },
      {
        h: 'ولو عايز ورق',
        p: 'لو محتاج مستندات مطبوعة لأي غرض، اطلبها وإحنا نظبّطهالك.',
      },
    ],

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

    signupTitle: 'حساب تجريبي لحد ما نخلّص المنصّة',
    signupLead:
      'المنصّة لسه بنكمّلها، فاللي متاح دلوقتي حساب تجريبي. اسمك وإيميلك بس، وبعدها تشوف الأسعار وتجرّب الشراء وتتابع العائد بنفسك. من غير رقم قومي ولا مستندات ولا كلمة سر.',
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

    fName: 'اسمك',
    fEmail: 'الإيميل',
    fErrorContact: 'سيب إيميل أو رقم موبايل.',

    footerLegal:
      'أجيال شركة تكنولوجيا. الاستثمار الحقيقي بيتم من خلال جهة مرخّصة من الهيئة العامة للرقابة المالية، وهي اللي بتحتفظ بفلوس العملاء. أجيال عمرها ما بتحتفظ بفلوسك ولا بأوراقك.',
    footerPrivacy:
      'بياناتك بنستخدمها علشان نتواصل معاك بس، وبنمسحها أول ما تطلب. مش بنطلب رقم قومي ولا مستندات ولا بيانات بنكية.',

    fbTitle: 'إحنا لسه بنبني. قوللنا رأيك.',
    fbLead: 'أي حاجة مش واضحة أو ناقصة أو مضايقاك، اكتبها هنا. بنقرا كل حاجة.',
    fbMessage: 'رأيك',
    fbEmail: 'إيميلك (لو عايز نرد عليك)',
    fbSubmit: 'ابعت',
    fbSending: 'بنبعت…',
    fbDone: 'وصلنا. شكرًا.',
  },

  en: {
    dir: 'ltr' as const,
    switch: 'العربية',
    brand: 'Agyal',
    navCalc: 'Calculate',
    navDiff: 'The difference',
    navJoin: 'Demo account',
    navSignIn: 'Sign in',

    heroEyebrow: 'Fixed income in Egypt',
    beta: 'Beta',
    heroTitle: 'Another place to put your cash',
    heroLead:
      'Instead of leaving it in a deposit, you lend it to the Egyptian government, or to a company, for a set term at a return you know from day one. From your phone.',

    cmpTitle: 'How is this different from a deposit?',
    cmpLead: 'All of them hold your cash for a term at a return. What differs is their characteristics: who you lend to, when you can get out, and tax.',
    cmpChars: 'Characteristics',
    cmpWho: 'Who you lend to',
    cmpTerm: 'Term and getting out',
    cmpYield: 'Return and tax',
    cmp: [
      {
        h: 'Deposit or certificate',
        who: 'The bank',
        term: 'A set term. Breaking it early costs you return.',
        yield: 'The bank sets the rate, and it is tax-exempt for individuals.',
      },
      {
        h: 'Treasury bills',
        who: 'The Egyptian government',
        term: 'Three to twelve months. You can sell in the market before maturity.',
        yield: 'The market sets the rate, and 20% tax applies.',
      },
      {
        h: 'Treasury bonds',
        who: 'The Egyptian government',
        term: 'Two years or more. You can sell in the market if you need to.',
        yield: 'A coupon at regular intervals, with 20% tax.',
      },
      {
        h: 'Sukuk and corporate bonds',
        who: 'A company, not the government',
        term: 'Depends on the issue.',
        yield: 'Pays more than government paper, because a company can fail to pay. Sukuk are the sharia-compliant option.',
      },
    ],
    cmpNote: 'Government paper and company paper do not have the same characteristics. The government is the safer borrower; a company can fail to pay, which is why its paper offers more. We set them out on each paper before you buy.',
    cmpFx: 'Everything is in Egyptian pounds today. We are working on bills and bonds in other currencies, which are not available yet.',
    cmpToCalc: 'To compare them fairly, the calculator below shows the return after tax and fees.',

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

    whyTitle: 'Why here, and not a typical broker?',
    whyLead: 'The service is built digital from the start, rather than a branch with a website on top.',
    why: [
      {
        h: 'No branch visit',
        p: 'Opening the account and checking your identity both happen in the app. No day off spent in a queue.',
      },
      {
        h: 'Everything electronic',
        p: 'Statements, contract notes and your holdings are all in one place and available whenever you want them.',
      },
      {
        h: 'Paper if you want it',
        p: 'If you need printed documents for any purpose, ask and we will arrange them.',
      },
    ],

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

    signupTitle: 'A demo account while we finish the platform',
    signupLead:
      'We are still building, so what is open today is a demo account. Your name and email are enough, and then you can see prices, try buying, and follow the return yourself. No national ID, no documents, no password.',
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

    fName: 'Your name',
    fEmail: 'Email',
    fErrorContact: 'Leave an email or a mobile number.',

    footerLegal:
      'Agyal is a technology company. Real investing happens through an entity licensed by the Financial Regulatory Authority, which holds all client money. Agyal never holds your money or your securities.',
    footerPrivacy:
      'We use your details only to contact you, and delete them as soon as you ask. We do not ask for a national ID, documents or bank details.',

    fbTitle: 'We are still building. Tell us what you think.',
    fbLead: 'Anything unclear, missing or annoying, write it here. We read all of it.',
    fbMessage: 'Your feedback',
    fbEmail: 'Your email (if you want a reply)',
    fbSubmit: 'Send',
    fbSending: 'Sending…',
    fbDone: 'Got it. Thank you.',
  },
};

export type LandingLocale = keyof typeof LANDING;
