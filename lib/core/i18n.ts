/**
 * Two languages, one dictionary.
 *
 * Scoped to the pages for buyers abroad, because that is where a second
 * language is a feature rather than a gesture. The rest of the product stays
 * English until there is a reason for it not to be.
 *
 * Every string lives here rather than beside the markup it appears in. That is
 * the only arrangement in which a native speaker can review the whole
 * translation in one sitting without reading React — and this translation needs
 * exactly that before it meets real traffic.
 *
 * Amharic below is a first pass by a non-native writer. It is structurally
 * sound and the numbers around it are computed, not translated, so a wrong word
 * cannot produce a wrong figure. But tone is not something this file can check,
 * and a clumsy sentence in someone's own language reads worse than plain
 * English would have. Kaleb speaks Amharic; this is written to be corrected by
 * him, one value at a time, with no code to touch.
 */

export type Locale = "en" | "am";

export const LOCALES: { id: Locale; label: string; native: string }[] = [
  { id: "en", label: "English", native: "English" },
  { id: "am", label: "Amharic", native: "አማርኛ" },
];

/* Ethiopic needs a face that actually has the glyphs; without one the browser
   falls back and the page renders in boxes. Latin keeps the product's own
   type so switching language does not switch design. */
export const ETHIOPIC_STACK = "'Noto Sans Ethiopic', 'Abyssinica SIL', sans-serif";

type Dict = Record<string, string>;

const en: Dict = {
  "nav.abroad": "From abroad",
  "nav.domestic": "Buying to live here",
  "nav.talk": "Talk to Kaleb",

  "hero.h1": "You don't need a green card to own property in Georgia.",
  "hero.lede":
    "No citizenship, no visa, no U.S. address, and no requirement to have set foot here. What you do need is a real number before you send anyone a document — and the honest one depends on which of these you are.",

  "ask.status": "Where you stand today",

  "status.citizen": "I'm a U.S. citizen living abroad",
  "status.citizen.note": "Born here or naturalised, and currently outside the country.",
  "status.citizen.asks": "Foreign income documented and usually translated, plus a U.S. bank account to close from.",
  "status.resident": "I have a green card or a U.S. visa",
  "status.resident.note": "A permanent resident, or here on a work or student visa with a Social Security number.",
  "status.resident.asks": "The same file as any American buyer. A visa with under a year left may need extra documentation.",
  "status.itin": "I have an ITIN, not a Social Security number",
  "status.itin.note": "Filing U.S. taxes on an individual taxpayer identification number.",
  "status.itin.asks": "Two years of ITIN tax returns. Fewer lenders do this, and the ones that do price it higher.",
  "status.foreign": "I live abroad with no U.S. status",
  "status.foreign.note": "No green card, no visa, no U.S. tax history. This is the most common case.",
  "status.foreign.asks": "A passport, a reference letter from your own bank, and reserves held in a U.S. account before closing.",

  "ask.use": "What you'd do with it",
  "ask.price": "Purchase price",
  "ask.county": "County",
  "ask.down": "Down payment",

  "use.rent": "Rent it out",
  "use.rent.note": "Income now, someone else paying the loan down",
  "use.live": "Live in it later",
  "use.live.note": "A place to return to, or for family here now",

  "out.cashIn": "What you'd have to send, all in",
  "out.down": "down",
  "out.closing": "closing",
  "out.on": "on",
  "out.rent": "Rent, estimated",
  "out.rentNote": "County, at this price",
  "out.short": "Short each month",
  "out.left": "Left over each month",
  "out.flowNote": "After the loan, tax, insurance, management and vacancy",
  "out.year1": "Year one, all in",
  "out.ofSent": "of what you sent",
  "out.cta": "Work this out properly",
  "out.liveNote":
    "Held empty for your own use it earns nothing — but the principal in your first year's payments is yours, not the bank's.",

  "down.floor": "is the least a lender will take in your situation.",
  "down.breakEven": "the rent covers everything and the house pays for itself.",
  "down.never":
    "At this price no down payment makes the rent cover the costs — a cheaper house or a different county will.",

  "lender.title": "What a lender will ask you for",

  "why.kicker": "Why Georgia, and why now",
  "why.h2": "One asset, priced in dollars, that four things pay you at once.",
  "why.lede":
    "Money sent home is spent once. A house keeps paying — in rent, in a loan someone else is retiring, and in a price that is not set in your local currency.",
  "bar.rent": "Rent",
  "bar.principal": "Loan paid down",
  "bar.appreciation": "Appreciation",
  "why.1": "A tenant pays the loan down",
  "why.1.body":
    "About {principal} of the first year's payments is principal. You didn't pay it — the rent did — and it's yours.",
  "why.2": "Appreciation on the whole house, not your share",
  "why.2.body":
    "At {rate} the house gains about {gain} a year. You put in {cash}. The gain is on {price}.",
  "why.3": "Income in the currency you want to be paid in",
  "why.3.body":
    "Rent arrives monthly in dollars, into a U.S. account, whatever is happening to the currency where you live.",
  "why.4": "A title that doesn't depend on who you know",
  "why.4.body":
    "Georgia deeds are public record and searchable. Ownership is a document, not a relationship you have to maintain from abroad.",

  "faq.h2": "The questions everyone asks, answered before you have to ask them.",
  "faq.q1": "Do I have to come to America to close?",
  "faq.a1":
    "No. Closings are done remotely through a Georgia closing attorney, with documents notarised at a U.S. embassy or consulate, or by an approved remote notary. Plenty of owners have never seen the house.",
  "faq.q2": "Who looks after it when I'm far away?",
  "faq.a2":
    "A licensed property manager, at about {pct} of rent — already taken out of the figure above. They screen the tenant, collect the rent, and handle the 2 a.m. call.",
  "faq.q3": "What about U.S. tax?",
  "faq.a3":
    "You file a U.S. return on the rental income, and depreciation usually shelters most of it in the early years. When you sell, a withholding rule called FIRPTA applies. Neither is a reason not to do this, and both need a cross-border accountant, not an agent.",
  "faq.q4": "Can I get the money out again?",
  "faq.a4":
    "Yes. There is no restriction on a foreign owner selling and repatriating the proceeds. The constraint is the market, the same as it is for anyone.",
  "faq.q5": "Is this the right time to buy?",
  "faq.a5":
    "Sometimes the answer is no. Rates are high and the cash-flow maths is tighter than it was three years ago, which is exactly why the panel above shows you a negative number when it is one.",
  "faq.q6": "Why you?",
  "faq.a6":
    "Kaleb is a licensed Georgia agent who works with buyers abroad and speaks Amharic and English. Everything on this page is free and yours whether or not you ever call.",

  "doors.h3": "Nothing here is held back until you sign up.",
  "doors.lede": "No account, no passport scan, and nothing sent to a lender until you decide to.",
  "doors.1": "See the whole thing",
  "doors.1.body":
    "The full readout — every cost, the first year broken down, and the one thing in your way. No more questions.",
  "doors.1.cta": "Show me",
  "doors.2": "Talk to someone who's done it",
  "doors.2.body": "Fifteen minutes with Kaleb, in Amharic or English, at a time that works where you are.",
  "doors.2.cta": "See open times",
  "doors.3": "I might live here instead",
  "doors.3.body": "If you'll be living in the house, the Georgia assistance programs may apply to you.",
  "doors.3.cta": "Buying to live here",

  "disc.hero":
    "Planning estimates, not a loan approval or a rent guarantee. Down payments and rates come from what lenders in this market publish for each situation — your own lender's terms decide. Rent is estimated from county averages, not from a specific property.",
  "foot.note":
    "Rift for buyers abroad. Guided by Kaleb Befekadu, a licensed agent in Georgia. Every figure is a planning estimate, not a lending commitment, approval, or valuation. We are not tax advisors or immigration attorneys, and we tell you when a question belongs to one.",
  "foot.fair":
    "Equal Housing Opportunity. We work with every buyer on the same terms regardless of race, colour, religion, sex, disability, familial status, or national origin.",
};

const am: Dict = {
  "nav.abroad": "ከውጭ አገር",
  "nav.domestic": "እዚህ ለመኖር የሚገዙ",
  "nav.talk": "ካሌብን ያናግሩ",

  "hero.h1": "በጆርጂያ ንብረት ለመግዛት ግሪን ካርድ አያስፈልግዎትም።",
  "hero.lede":
    "ዜግነት አያስፈልግም፣ ቪዛ አያስፈልግም፣ የአሜሪካ አድራሻ አያስፈልግም፣ እና አንድ ቀን እንኳ አሜሪካ መርገጥ አያስፈልግም። የሚያስፈልግዎት ለማንም ሰው ሰነድ ከመላክዎ በፊት ትክክለኛውን ቁጥር ማወቅ ነው — እውነተኛው ቁጥር ደግሞ ከእነዚህ ውስጥ የትኛው እንደሆኑ ይወስናል።",

  "ask.status": "ዛሬ ያሉበት ሁኔታ",

  "status.citizen": "የአሜሪካ ዜጋ ነኝ፤ ከአገር ውጭ እኖራለሁ",
  "status.citizen.note": "እዚህ የተወለዱ ወይም ዜግነት ያገኙ፤ አሁን ከአሜሪካ ውጭ ያሉ።",
  "status.citizen.asks": "የውጭ አገር ገቢዎ በሰነድ መረጋገጥ አለበት፤ ብዙውን ጊዜም መተርጎም ይኖርበታል። ክፍያ የሚፈጸምበት የአሜሪካ የባንክ ሂሳብም ያስፈልጋል።",
  "status.resident": "ግሪን ካርድ ወይም የአሜሪካ ቪዛ አለኝ",
  "status.resident.note": "ቋሚ ነዋሪ፤ ወይም የሶሻል ሴኩሪቲ ቁጥር ያለው የሥራ ወይም የተማሪ ቪዛ የያዙ።",
  "status.resident.asks": "እንደማንኛውም አሜሪካዊ ገዢ ተመሳሳይ ሰነድ። ቪዛዎ ከአንድ ዓመት በታች የቀረው ከሆነ ተጨማሪ ማስረጃ ሊጠየቅ ይችላል።",
  "status.itin": "ITIN አለኝ፤ የሶሻል ሴኩሪቲ ቁጥር የለኝም",
  "status.itin.note": "በግለሰብ የግብር ከፋይ መለያ ቁጥር የአሜሪካ ግብር የሚከፍሉ።",
  "status.itin.asks": "የሁለት ዓመት የITIN የግብር ማስታወቂያ። ይህን የሚያደርጉ አበዳሪዎች ጥቂት ናቸው፤ የሚያደርጉትም በከፍተኛ ወለድ ነው።",
  "status.foreign": "ከአሜሪካ ውጭ እኖራለሁ፤ ምንም የአሜሪካ ሁኔታ የለኝም",
  "status.foreign.note": "ግሪን ካርድ የለም፣ ቪዛ የለም፣ የአሜሪካ የግብር ታሪክ የለም። በብዛት የሚያጋጥመው ይህ ነው።",
  "status.foreign.asks": "ፓስፖርት፣ ከባንክዎ የድጋፍ ደብዳቤ፣ እና ከመፈረምዎ በፊት በአሜሪካ ሂሳብ ውስጥ የተቀመጠ ተጠባባቂ ገንዘብ።",

  "ask.use": "በቤቱ ምን ያደርጋሉ",
  "ask.price": "የመግዣ ዋጋ",
  "ask.county": "ካውንቲ",
  "ask.down": "ቅድመ ክፍያ",

  "use.rent": "ተከራይ ማስገባት",
  "use.rent.note": "አሁን ገቢ፣ ብድሩን ሌላ ሰው ይከፍላል",
  "use.live": "ወደፊት መኖር",
  "use.live.note": "የሚመለሱበት ቦታ፣ ወይም አሁን እዚህ ላሉ ቤተሰቦች",

  "out.cashIn": "በጠቅላላ መላክ ያለብዎት",
  "out.down": "ቅድመ ክፍያ",
  "out.closing": "የዝግጅት ወጪ",
  "out.on": "በ",
  "out.rent": "ግምታዊ የኪራይ ገቢ",
  "out.rentNote": "ካውንቲ፣ በዚህ ዋጋ",
  "out.short": "በየወሩ የሚጎድል",
  "out.left": "በየወሩ የሚተርፍ",
  "out.flowNote": "ከብድር፣ ከግብር፣ ከኢንሹራንስ፣ ከአስተዳደር እና ከክፍት ጊዜ በኋላ",
  "out.year1": "የመጀመሪያው ዓመት በጠቅላላ",
  "out.ofSent": "ከላኩት ገንዘብ",
  "out.cta": "በዝርዝር አስሉልኝ",
  "out.liveNote":
    "ለራስዎ ይዘውት ባዶ ከቆየ ገቢ አያመጣም — ነገር ግን በመጀመሪያው ዓመት ክፍያዎ ውስጥ ያለው የዋናው ብድር ክፍል የእርስዎ ነው፣ የባንኩ አይደለም።",

  "down.floor": "አበዳሪዎች በእርስዎ ሁኔታ የሚቀበሉት ዝቅተኛው ነው።",
  "down.breakEven": "ኪራዩ ሁሉንም ወጪ ይሸፍናል፤ ቤቱ ራሱን ይከፍላል።",
  "down.never":
    "በዚህ ዋጋ ምንም ያህል ቅድመ ክፍያ ቢከፍሉ ኪራዩ ወጪውን አይሸፍንም — ርካሽ ቤት ወይም ሌላ ካውንቲ ግን ይሸፍናል።",

  "lender.title": "አበዳሪው የሚጠይቅዎት ነገር",

  "why.kicker": "ለምን ጆርጂያ፣ ለምን አሁን",
  "why.h2": "በዶላር የተተመነ አንድ ንብረት፤ በአራት መንገድ ይከፍልዎታል።",
  "why.lede":
    "ወደ አገር ቤት የተላከ ገንዘብ አንድ ጊዜ ወጪ ሆኖ ያልቃል። ቤት ግን መክፈሉን ይቀጥላል — በኪራይ፣ ሌላ ሰው በሚከፍለው ብድር፣ እና በአካባቢዎ ምንዛሬ ባልተወሰነ ዋጋ።",
  "bar.rent": "ኪራይ",
  "bar.principal": "የተከፈለ ብድር",
  "bar.appreciation": "የዋጋ ጭማሪ",
  "why.1": "ተከራዩ ብድሩን ይከፍላል",
  "why.1.body":
    "በመጀመሪያው ዓመት ከሚከፈለው ክፍያ ውስጥ {principal} የሚሆነው ዋናውን ብድር የሚቀንስ ነው። የከፈሉት እርስዎ አይደሉም — ኪራዩ ነው — ገንዘቡ ግን የእርስዎ ነው።",
  "why.2": "ዋጋው የሚጨምረው በሙሉ ቤቱ ላይ ነው፣ በከፈሉት ድርሻ ላይ ብቻ አይደለም",
  "why.2.body":
    "በ{rate} ስሌት ቤቱ በዓመት {gain} ያህል ይጨምራል። እርስዎ ያስገቡት {cash} ነው። ጭማሪው ግን በሙሉ {price} ላይ ነው።",
  "why.3": "ሊከፈሉበት በሚፈልጉት ምንዛሬ የሚመጣ ገቢ",
  "why.3.body":
    "ኪራዩ በየወሩ በዶላር፣ ወደ አሜሪካ የባንክ ሂሳብ ይገባል — እርስዎ በሚኖሩበት አገር ምንዛሬ ላይ ምንም ይሁን ምን።",
  "why.4": "በማንም ትውውቅ ላይ የማይመሰረት ባለቤትነት",
  "why.4.body":
    "በጆርጂያ የቤት ባለቤትነት ሰነድ ይፋዊ መዝገብ ነው፤ ማንም ሊያረጋግጠው ይችላል። ባለቤትነት ሰነድ ነው፣ ከውጭ ሆነው መጠበቅ ያለብዎት ግንኙነት አይደለም።",

  "faq.h2": "ሁሉም ሰው የሚጠይቃቸው ጥያቄዎች፣ ከመጠየቅዎ በፊት ተመልሰዋል።",
  "faq.q1": "ለመፈረም አሜሪካ መምጣት አለብኝ?",
  "faq.a1":
    "አያስፈልግም። ሽያጩ በጆርጂያ ጠበቃ አማካኝነት ከርቀት ይጠናቀቃል፤ ሰነዶቹ በአሜሪካ ኤምባሲ ወይም ቆንስላ፣ ወይም በተፈቀደ የርቀት ኖታሪ ይረጋገጣሉ። ብዙ ባለቤቶች ቤታቸውን አይተውት አያውቁም።",
  "faq.q2": "እኔ ሩቅ አገር ሆኜ ቤቱን ማን ይጠብቃል?",
  "faq.a2":
    "ፈቃድ ያለው የንብረት አስተዳዳሪ፤ ክፍያው ከኪራዩ {pct} ያህል ሲሆን ከላይ ካለው ሒሳብ ውስጥ ተቀናሽ ሆኗል። ተከራዩን ይመረምራል፣ ኪራዩን ይሰበስባል፣ በሌሊት የሚመጣውንም ጥሪ ይመልሳል።",
  "faq.q3": "ስለ አሜሪካ ግብርስ?",
  "faq.a3":
    "በኪራይ ገቢው ላይ የአሜሪካ የግብር ማስታወቂያ ያስገባሉ፤ በመጀመሪያዎቹ ዓመታት አብዛኛውን ገቢ የእርጅና ቅናሽ ይሸፍነዋል። ሲሸጡ ደግሞ FIRPTA የሚባል የተቀናሽ ሕግ ይሰራል። ሁለቱም ይህን እንዳያደርጉ የሚከለክሉ አይደሉም፤ ሁለቱም ግን የድንበር ተሻጋሪ የሒሳብ ባለሙያ ይፈልጋሉ፣ የቤት ደላላ አይደለም።",
  "faq.q4": "ገንዘቤን መልሼ ማውጣት እችላለሁ?",
  "faq.a4":
    "አዎ። የውጭ አገር ባለቤት ሸጦ ገንዘቡን ወደ አገሩ እንዳይመልስ የሚከለክል ሕግ የለም። ገደቡ የገበያው ሁኔታ ነው፣ ለሁሉም ሰው እንደሚሆነው።",
  "faq.q5": "አሁን ለመግዛት ትክክለኛው ጊዜ ነው?",
  "faq.a5":
    "አንዳንድ ጊዜ መልሱ አይደለም ነው። የወለድ ምጣኔ ከፍ ብሏል፤ የገቢ ሒሳቡም ከሦስት ዓመት በፊት ከነበረው ጠባብ ነው። ከላይ ያለው ሠንጠረዥ አሉታዊ ቁጥር የሚያሳይዎት ለዚሁ ነው።",
  "faq.q6": "ለምን እናንተ?",
  "faq.a6":
    "ካሌብ ፈቃድ ያለው የጆርጂያ የቤት ደላላ ሲሆን ከውጭ አገር ከሚገዙ ሰዎች ጋር ይሰራል፤ አማርኛና እንግሊዝኛ ይናገራል። በዚህ ገጽ ላይ ያለው ሁሉ ነፃ ነው፤ ደውለው ባያናግሩትም የእርስዎ ነው።",

  "doors.h3": "እዚህ ምንም ነገር እስኪመዘገቡ ድረስ አልተያዘም።",
  "doors.lede": "መለያ አያስፈልግም፣ የፓስፖርት ቅጂ አያስፈልግም፣ እርስዎ እስኪወስኑ ድረስ ወደ አበዳሪ የሚላክ ነገር የለም።",
  "doors.1": "ሙሉውን አሳየኝ",
  "doors.1.body": "ሙሉ ዝርዝር — እያንዳንዱ ወጪ፣ የመጀመሪያው ዓመት በዝርዝር፣ እና እንቅፋት የሆነብዎት ነገር። ተጨማሪ ጥያቄ የለም።",
  "doors.1.cta": "አሳየኝ",
  "doors.2": "ያደረገውን ሰው ያናግሩ",
  "doors.2.body": "ከካሌብ ጋር አሥራ አምስት ደቂቃ፣ በአማርኛ ወይም በእንግሊዝኛ፣ እርስዎ ባሉበት ሰዓት።",
  "doors.2.cta": "ክፍት ሰዓቶችን ይመልከቱ",
  "doors.3": "ምናልባት እኔው እዚህ እኖር ይሆናል",
  "doors.3.body": "በቤቱ ውስጥ የሚኖሩ ከሆነ የጆርጂያ የድጋፍ ፕሮግራሞች ሊመለከቱዎት ይችላሉ።",
  "doors.3.cta": "እዚህ ለመኖር መግዛት",

  "disc.hero":
    "እነዚህ የዕቅድ ግምቶች ናቸው፤ የብድር ፈቃድ ወይም የኪራይ ዋስትና አይደሉም። የቅድመ ክፍያና የወለድ መጠኖች አበዳሪዎች ለእያንዳንዱ ሁኔታ ካወጡት መረጃ የተወሰዱ ናቸው — የሚወስነው የራስዎ አበዳሪ ነው። ኪራዩ ከካውንቲ አማካይ የተሰላ ነው፤ ከአንድ የተወሰነ ቤት አይደለም።",
  "foot.note":
    "Rift ለውጭ አገር ገዢዎች። በጆርጂያ ፈቃድ ባለው ደላላ በካሌብ በፈቃዱ የሚመራ። እያንዳንዱ ቁጥር የዕቅድ ግምት ነው፤ የብድር ቃል፣ ፈቃድ ወይም ግምገማ አይደለም። የግብር አማካሪዎች ወይም የኢሚግሬሽን ጠበቆች አይደለንም፤ ጥያቄው የእነሱ ሲሆን እንነግርዎታለን።",
  "foot.fair":
    "እኩል የቤት ዕድል። ከዘር፣ ከቀለም፣ ከሃይማኖት፣ ከፆታ፣ ከአካል ጉዳት፣ ከቤተሰብ ሁኔታ ወይም ከትውልድ አገር ነፃ በሆነ መልኩ ከሁሉም ገዢ ጋር በእኩል ሁኔታ እንሰራለን።",
};

const DICTS: Record<Locale, Dict> = { en, am };

/**
 * Falls back to English rather than showing a key, which is never anyone's
 * language. Values may carry {named} slots so a sentence keeps its own word
 * order in each language — Amharic puts the verb last, and a translation
 * assembled by concatenating fragments cannot.
 */
export function translator(locale: Locale) {
  const d = DICTS[locale] ?? en;
  return (key: string, vars?: Record<string, string | number>) => {
    const raw = d[key] ?? en[key] ?? key;
    if (!vars) return raw;
    return raw.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  };
}

export const isLocale = (v: unknown): v is Locale => v === "en" || v === "am";

/** Every English key must exist in Amharic; the test enforces it. */
export const KEYS = Object.keys(en);
export const dictFor = (l: Locale) => DICTS[l];
