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

    heroEyebrow: 'دخل ثابت من الحكومة والبنوك',
    beta: 'نسخة تجريبية',
    heroTitle: 'خلّي مدخراتك تكسب أكتر، وإنت مطمّن',
    heroLead:
      'أذون وسندات خزانة وصكوك من البنوك الشريكة، من موبايلك. وكل سعر هنا مكتوب جنبه الوديعة البنكية لنفس المدة، عشان تقارن بنفسك.',
    ctaRates: 'شوف أحسن الأسعار',
    ctaHow: 'بتشتغل إزاي؟',
    ratesTitle: 'أحسن الأسعار دلوقتي',
    ratesBadge: 'استرشادي',
    ratesLead:
      'بنسعّر كل ورقة معروضة من البنوك الشريكة، وبنوريك اللي هيوصلك بعد الضريبة والمصاريف، جنب الوديعة لنفس المدة.',
    ratesGov: 'مضمونة من الحكومة المصرية',
    ratesCorp: 'صادرة من شركات',
    ratesVs: (dep: string) => `الوديعة ${dep}`,
    ratesMore: (pts: string) => `↑ أعلى من الوديعة بـ ${pts}`,
    ratesLess: (pts: string) => `↓ أقل من الوديعة بـ ${pts}`,
    ratesAsOf: (at: string) => `أسعار استرشادية بتاريخ ${at}. مش عرض ولا وعد بعائد.`,
    ratesEmpty: 'الأسعار هتظهر هنا أول ما البنوك تسعّر.',
    months: (m: number, formatted: string) => `${formatted} ${m <= 10 ? 'شهور' : 'شهر'}`,
    years: (y: number, formatted: string) => (y === 1 ? 'سنة' : y === 2 ? 'سنتين' : `${formatted} ${y <= 10 ? 'سنين' : 'سنة'}`),

    stepsTitle: 'من فتح الحساب لحد الاستحقاق',
    steps: [
      { h: 'افتح حسابك', p: 'تحقّق من هويتك مرة واحدة من موبايلك. من غير ما تروح فرع.' },
      { h: 'اختار المدة', p: 'قارن بين الأذون والسندات والصكوك بالمدة والسعر. بنطلب سعر من كل بنك شريك في نفس اللحظة وبنوريك أحسن سعر.' },
      { h: 'نفّذ الأمر', p: 'أمرك بيروح للجهة المرخّصة اللي بتتعامل مع البنوك وبتحتفظ بفلوسك في حساب عملاء منفصل. أجيال عمرها ما بتمسك فلوسك.' },
      { h: 'استنى الاستحقاق', p: 'تابع الكوبونات وتاريخ الاستحقاق، والفلوس بتوصلك أوتوماتيك.' },
    ],
    stepsNote: 'الورق بيتسجّل باسمك إنت، بكودك الموحد في مصر للمقاصة أو البنك المركزي. مش باسم المنصّة.',

    learnTitle: 'أول مرة تسمع عن الدخل الثابت؟ ابدأ من هنا.',
    learnLead: 'تلات حاجات يهمّك تعرفهم قبل ما تشتري أي حاجة.',
    learn: [
      { h: 'يعني إيه أذون خزانة؟', p: 'قرض قصير للحكومة المصرية، من ٣ شهور لسنة. بتدفع أقل من ١٠٠ وبتاخد ١٠٠ في الآخر، والفرق ده مكسبك.' },
      { h: 'يعني إيه صكوك؟', p: 'بديل متوافق مع الشريعة، بس صادر من شركة مش من الحكومة. بيدي أعلى، لأن الشركة ممكن تتعثر في السداد.' },
      { h: 'العائد ده معناه إيه؟', p: 'المكسب في السنة. وكل رقم في الصفحة دي هو اللي هيفضلك بعد الضريبة والمصاريف، وده الرقم الوحيد اللي يستاهل تقارنه بالوديعة.' },
    ],

    cmpTitle: 'إيه الفرق بين ده وبين الوديعة؟',
    cmpPoints: [
      'الوديعة بتسلّف البنك. هنا بتسلّف الحكومة المصرية أو شركة.',
      'عائد الوديعة معفي من الضريبة للأفراد، وعائد أدوات الخزانة عليه ٢٠٪ ضريبة.',
      'لو خرجت من الوديعة بدري بتخسر عائد. هنا تقدر تبيع في السوق.',
      'ورق الشركات (الصكوك وسندات الشركات) بيدي أعلى، لأن الشركة ممكن تتعثر في السداد.',
    ],
    cmpFx: 'كله بالجنيه المصري دلوقتي. شغالين على إتاحة أذون وسندات بعملات تانية، ولسه مش متاحة.',
    cmpToCalc: 'عشان المقارنة تبقى عادلة، الحاسبة تحت بتوريك العائد بعد الضريبة والمصاريف.',

    calcTitle: 'اعرف هتاخد كام',
    calcLead: 'جرّب بأي مبلغ ومدة. الأرقام استرشادية وبتتغير مع السوق.',
    calcAmount: 'المبلغ (جنيه)',
    calcTenor: 'المدة',
    calcGo: 'احسب',
    calcWorking: 'بنحسب…',
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
    errName: 'اكتب اسمك، حرفين على الأقل.',
    errEmail: 'الإيميل ده شكله مش مظبوط. راجعه وجرّب تاني.',
    errPhone: 'الرقم ده مش رقم موبايل مصري. اكتبه كده: 01012345678.',
    errGeneric: 'في حاجة مظبطتش. جرّب تاني بعد شوية.',

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

    heroEyebrow: 'Government and bank fixed income',
    beta: 'Beta',
    heroTitle: 'Earn more on your savings, with confidence',
    heroLead:
      'Treasury bills, bonds and sukuk from Egypt\u2019s partner banks, in a few taps. Every rate here is shown next to what a bank deposit pays for the same term, so you can judge it yourself.',
    ctaRates: 'Explore the best rates',
    ctaHow: 'How it works',
    ratesTitle: 'Best rates right now',
    ratesBadge: 'Indicative',
    ratesLead:
      'We price every paper the partner banks offer and show what you would keep, after tax and fees, next to a deposit for the same term.',
    ratesGov: 'Backed by the Egyptian government',
    ratesCorp: 'Issued by companies',
    ratesVs: (dep: string) => `deposit ${dep}`,
    ratesMore: (pts: string) => `\u2191 ${pts} more than a bank deposit`,
    ratesLess: (pts: string) => `\u2193 ${pts} less than a bank deposit`,
    ratesAsOf: (at: string) => `Indicative, as of ${at}. Not an offer.`,
    ratesEmpty: 'Rates appear here as soon as the banks quote.',

    stepsTitle: 'From sign-up to maturity',
    steps: [
      { h: 'Open an account', p: 'Verify your identity once, from your phone. No branch visit.' },
      { h: 'Choose your term', p: 'Compare bills, bonds and sukuk by term and rate. We ask every partner bank at the same moment and show you the best quote.' },
      { h: 'Place the order', p: 'Your order goes to the licensed firm, which deals with the banks and holds your money in a segregated client account. Agyal never holds it.' },
      { h: 'Hold to maturity', p: 'Track your coupons and your maturity date. You are paid automatically.' },
    ],
    stepsNote: 'The paper is registered in your own name, under your unified code at MCDR or the Central Bank. Never in the platform\u2019s name.',

    learnTitle: 'New to fixed income? Start here.',
    learnLead: 'Three things worth knowing before you buy anything.',
    learn: [
      { h: 'What is a treasury bill?', p: 'A short loan to the Egyptian government, from three months to a year. You pay less than 100 and are paid 100 at the end. The difference is your return.' },
      { h: 'What is a sukuk?', p: 'A sharia-compliant alternative, issued by a company rather than the government. It pays more, because a company can fail to pay.' },
      { h: 'What does the yield mean?', p: 'The return over a year. Every number on this page is what you would keep after tax and fees, which is the only figure worth comparing with a deposit.' },
    ],

    cmpTitle: 'How is this different from a deposit?',
    cmpPoints: [
      'A deposit lends to your bank. These lend to the Egyptian government, or to a company.',
      'Deposit interest is tax-exempt for individuals. Treasury returns are taxed at 20%.',
      'Breaking a deposit early costs you return. Here you can sell in the market.',
      'Company paper (sukuk and corporate bonds) pays more, because a company can fail to pay.',
    ],
    cmpFx: 'Everything is in Egyptian pounds today. We are working on bills and bonds in other currencies, which are not available yet.',
    cmpToCalc: 'To compare them fairly, the calculator below shows the return after tax and fees.',

    calcTitle: 'See what you would earn',
    calcLead: 'Try any amount and term. Figures are indicative and move with the market.',
    calcAmount: 'Amount (EGP)',
    calcTenor: 'Term',
    calcGo: 'Calculate',
    calcWorking: 'Working…',
    months: (m: number, formatted: string) => `${formatted} month${m === 1 ? '' : 's'}`,
    years: (y: number, formatted: string) => `${formatted} year${y === 1 ? '' : 's'}`,
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
    errName: 'Please enter your name, at least two letters.',
    errEmail: 'That email address does not look right. Please check it.',
    errPhone: 'That is not an Egyptian mobile number. Write it like 01012345678.',
    errGeneric: 'Something went wrong. Please try again in a moment.',

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
