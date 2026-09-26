/**
 * Two languages, one dictionary.
 *
 * Scoped to the pages for buyers abroad, because that is where a second
 * language is a feature rather than a gesture. The rest of the product stays
 * English until there is a reason for it not to be.
 *
 * Every string lives here rather than beside the markup it appears in. That is
 * the only arrangement in which a native speaker can review the whole
 * translation in one sitting without reading React, and this translation needs
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
   type so switching language does not switch design.
   
   The variable is set by next/font in app/(rift)/layout.tsx, which self-hosts
   the face. The named fallbacks after it are what carries the page if that
   variable is ever missing: on a surface outside the rift shell, or in a
   preview where the build-time fetch did not happen. */
export const ETHIOPIC_STACK =
  "var(--font-ethiopic), 'Noto Sans Ethiopic', 'Abyssinica SIL', sans-serif";

type Dict = Record<string, string>;

const en: Dict = {
  "nav.abroad": "From abroad",
  "nav.domestic": "Buying to live here",
  "nav.talk": "Talk to Kaleb",

  "hero.h1": "You don't need a green card to own property in Georgia.",
  "hero.lede":
    "No citizenship, no visa, no U.S. address, and no requirement to have set foot here. What you do need is a real number before you send anyone a document, and the honest one depends on which of these you are.",

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
    "Held empty for your own use it earns nothing, but the principal in your first year's payments is yours, not the bank's.",

  "down.floor": "is the least a lender will take in your situation.",
  "down.breakEven": "the rent covers everything and the house pays for itself.",
  "down.never":
    "At this price no down payment makes the rent cover the costs; a cheaper house or a different county will.",

  "lender.title": "What a lender will ask you for",

  "why.kicker": "Why Georgia, and why now",
  "why.h2": "One asset, priced in dollars, that four things pay you at once.",
  "why.lede":
    "Money sent home is spent once. A house keeps paying: in rent, in a loan someone else is retiring, and in a price that is not set in your local currency.",
  "bar.rent": "Rent",
  "bar.principal": "Loan paid down",
  "bar.appreciation": "Appreciation",
  "why.1": "A tenant pays the loan down",
  "why.1.body":
    "About {principal} of the first year's payments is principal. You didn't pay it; the rent did, and it's yours.",
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
    "A licensed property manager, at about {pct} of rent, already taken out of the figure above. They screen the tenant, collect the rent, and handle the 2 a.m. call.",
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
    "The full readout: every cost, the first year broken down, and the one thing in your way. No more questions.",
  "doors.1.cta": "Show me",
  "doors.2": "Talk to someone who's done it",
  "doors.2.body": "Fifteen minutes with Kaleb, in Amharic or English, at a time that works where you are.",
  "doors.2.cta": "See open times",
  "doors.3": "I might live here instead",
  "doors.3.body": "If you'll be living in the house, the Georgia assistance programs may apply to you.",
  "doors.3.cta": "Buying to live here",

  "disc.hero":
    "Planning estimates, not a loan approval or a rent guarantee. Down payments and rates come from what lenders in this market publish for each situation; your own lender's terms decide. The rent figure is our own working assumption for this county, not a measured average and not a quote for a specific property.",
  "foot.note":
    "Rift for buyers abroad. Guided by Kaleb Befekadu, a licensed agent in Georgia. Every figure is a planning estimate, not a lending commitment, approval, or valuation. We are not tax advisors or immigration attorneys, and we tell you when a question belongs to one.",
  "foot.fair":
    "Equal Housing Opportunity. We work with every buyer on the same terms regardless of race, colour, religion, sex, disability, familial status, or national origin.",

  /* Second person, written out rather than derived.

     The readout used to turn the first-person label above into "you" with a
     regular expression (`^I('m| have| live)` → `You$1`) which produced
     "You'm a U.S. citizen living abroad" on the live page for a quarter of
     readers. It could never have worked in Amharic either, where the change is
     a verb ending rather than a prefix. Grammar is not a string operation. */
  "status.citizen.you": "You're a U.S. citizen living abroad",
  "status.resident.you": "You have a green card or a U.S. visa",
  "status.itin.you": "You have an ITIN, not a Social Security number",
  "status.foreign.you": "You live abroad with no U.S. status",

  /* The readout. Same voice as the landing page, because it is the same
     conversation: somebody switched to Amharic, tapped through, and used to
     land on a wall of English. */
  /* The booking page is English, and says so here rather than pretending
     otherwise. The form is not translated on purpose: the consent wording
     stored with a phone number is evidence of what somebody agreed to, and
     showing one language while storing another would make that record false.
     Translating it means translating the stored wording too, which is a legal
     review rather than a commit. Until then, this band says what is going on
     and promises the call itself in Amharic, which is the part that matters. */
  "book.band.h": "ካሌብ አማርኛ ይናገራል።",
  "book.band.b": "ንግግሩ በአማርኛ ይሆናል። ከታች ያለው ቅጽ ግን በእንግሊዝኛ ነው፤ ስምዎን፣ ኢሜይልዎን ወይም ስልክዎን ብቻ ነው የሚጠይቀው።",
  "book.back": "ወደ ቁጥሮቼ ልመለስ",
  "res.title": "What this would take from where you are",
  "res.change": "Change my answers",
  "res.kicker": "{price} in {county} County · {use}",
  "res.kicker.rent": "rented out",
  "res.kicker.live": "kept for your own use",
  "res.h1.covers": "It covers itself, and three other things pay you.",
  "res.h1.short": "It runs {amount} a month short, and still returns {pct}%.",
  "res.h1.live": "You'd send {amount} and own it outright in thirty years.",

  "res.send.title": "What you'd have to send",
  "res.send.downChip": "{pct}% down",
  "res.send.down": "Down payment",
  "res.send.down.note": "{pct}%, the least a lender takes in your situation",
  "res.send.closing": "Closing costs",
  "res.send.closing.note": "{pct}%: attorney, title, recording, lender fees",
  "res.send.total": "Before you own it",

  "res.month.title": "Every month",
  "res.month.pi": "Loan payment",
  "res.month.tax": "Property tax",
  "res.month.ins": "Insurance",
  "res.month.mgmt": "Management",
  "res.month.mgmt.note": "{pct}%, someone local, because you are not",
  "res.month.vac": "Vacancy set-aside",
  "res.month.vac.note": "{pct}%, about a month a year between tenants",
  "res.month.maint": "Maintenance set-aside",
  "res.month.maint.note": "{pct}%: repairs and turnover",
  "res.month.left": "Left over",
  "res.month.short": "Short",
  "res.month.costs": "Costs you, each month",

  "res.year.h2": "Where the first year actually goes.",
  "res.year.lede": "Cash flow is the smallest of the three, and the only one most people look at.",
  "res.year.flow": "Rent, after everything",
  "res.year.flow.note": "Spendable. The only part that reaches your account.",
  "res.year.principal": "Loan paid down",
  "res.year.principal.note": "Not spendable, but yours. The tenant paid it, not you.",
  "res.year.appreciation": "Appreciation at {pct}%",
  "res.year.appreciation.note": "On the whole {price}, not on what you put in.",
  "res.year.total": "Year one, all in",
  "res.month.running": "Running it as a rental",
  "res.month.running.meta": "{n} costs, −{amount} a month",
  "res.year.total.note":
    "On the {cash} you sent. Appreciation is an estimate and can be negative; the other two are contractual.",
  "res.year.of": "{pct}% of what you sent",

  "res.block.kicker": "The one thing in your way",
  "res.block.live": "It earns nothing while you hold it",
  "res.block.live.body":
    "Held empty it costs {monthly} a month. {principal} of the first year is principal, so it is not lost, but it is not income either.",
  "res.block.tenant": "Finding a tenant who stays",
  "res.block.tenant.body":
    "The figures assume about a month empty a year. Two months empty turns {flow} a month into roughly {worse}.",
  "res.block.under": "At {pct}% down it does not cover itself",
  "res.block.under.body":
    "You would need {breakEven}% down ({needed} instead of {have}) for the rent to cover everything. A cheaper house in the same county gets there with less.",
  "res.block.never": "At this price nothing covers itself",
  "res.block.never.body":
    "No down payment makes the rent cover the costs at {price} in {county}. A cheaper house, or a county with a better rent-to-price ratio, will.",

  "res.lender.rate": "Rate shown is {rate}% plus about {premium} points for this paper. {source}.",
  /* The only rate provenance this file can translate. A recorded source is the
     name of an institution ("Freddie Mac PMMS") and a proper noun stays in
     its own script in any language. The fallback is our own sentence, so it
     does not get to stay English on an Amharic page. */
  "res.rate.assumption": "No rate has been recorded; this is the starting assumption",

  "res.keep.h3": "This page keeps working whether or not you call.",
  "res.keep.body":
    "Save the link. Nothing here expires, and no one has your details unless you give them.",
  "res.keep.cta": "Fifteen minutes with Kaleb",
  "res.disc":
    "Planning estimates, not a loan approval, a rent guarantee, or a valuation. Down payments and rate premiums reflect what lenders in this market publish for each situation; your own lender's terms decide. The rent figure is our own working assumption for this county, not a measured average and not a quote for a specific property. U.S. tax on rental income and the FIRPTA withholding on sale are real and are questions for a cross-border accountant, not for an agent.",

  /* Capture. This page had none: every other readout in the product can send
     itself to somebody and this one could only offer a call, so the only
     funnel written for people who are not in the country was also the only
     one that could not produce a lead. */
  "res.email.h": "Have these numbers sent to you.",
  "res.email.body":
    "One email with the figures above and a link back to this page. No newsletter, nothing sold on, one click stops it.",
  "res.email.field": "Email address",
  "res.email.cta": "Send it to me",
  "res.email.sent": "On its way. It carries the link, so it works on any device.",
  "res.email.off":
    "Noted, but email is not switched on yet, so nothing has been sent. Keep this page's address; it is the same document.",
  "res.email.bad": "That email address does not look right.",
  "res.email.err": "That did not go through. This page and its address still work.",

  /* Deletion. Also absent here, on the page whose readers are most likely to
     be weighing what a U.S. company now knows about them. */
  "res.forget.h": "Delete everything",
  "res.forget.body":
    "Remove your answers and anything we hold, now, rather than waiting for the schedule.",
  "res.forget.cta": "Delete all of it",
  "res.forget.working": "Deleting\u2026",
  "res.forget.done":
    "Deleted. Nothing about this visit is left on this device or on our side.",
  "res.forget.partial":
    "Cleared from this device. Nothing was stored on our side to remove, or the request did not reach us, in which case the schedule removes it on its own.",
};

const am: Dict = {
  "nav.abroad": "ከውጭ አገር",
  "nav.domestic": "እዚህ ለመኖር የሚገዙ",
  "nav.talk": "ካሌብን ያናግሩ",

  "hero.h1": "በጆርጂያ ንብረት ለመግዛት ግሪን ካርድ አያስፈልግዎትም።",
  "hero.lede":
    "ዜግነት አያስፈልግም፣ ቪዛ አያስፈልግም፣ የአሜሪካ አድራሻ አያስፈልግም፣ እና አንድ ቀን እንኳ አሜሪካ መርገጥ አያስፈልግም። የሚያስፈልግዎት ለማንም ሰው ሰነድ ከመላክዎ በፊት ትክክለኛውን ቁጥር ማወቅ ነው። እውነተኛው ቁጥር ደግሞ ከእነዚህ ውስጥ የትኛው እንደሆኑ ይወስናል።",

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
    "ለራስዎ ይዘውት ባዶ ከቆየ ገቢ አያመጣም፤ ነገር ግን በመጀመሪያው ዓመት ክፍያዎ ውስጥ ያለው የዋናው ብድር ክፍል የእርስዎ ነው፣ የባንኩ አይደለም።",

  "down.floor": "አበዳሪዎች በእርስዎ ሁኔታ የሚቀበሉት ዝቅተኛው ነው።",
  "down.breakEven": "ኪራዩ ሁሉንም ወጪ ይሸፍናል፤ ቤቱ ራሱን ይከፍላል።",
  "down.never":
    "በዚህ ዋጋ ምንም ያህል ቅድመ ክፍያ ቢከፍሉ ኪራዩ ወጪውን አይሸፍንም፤ ርካሽ ቤት ወይም ሌላ ካውንቲ ግን ይሸፍናል።",

  "lender.title": "አበዳሪው የሚጠይቅዎት ነገር",

  "why.kicker": "ለምን ጆርጂያ፣ ለምን አሁን",
  "why.h2": "በዶላር የተተመነ አንድ ንብረት፤ በአራት መንገድ ይከፍልዎታል።",
  "why.lede":
    "ወደ አገር ቤት የተላከ ገንዘብ አንድ ጊዜ ወጪ ሆኖ ያልቃል። ቤት ግን መክፈሉን ይቀጥላል፦ በኪራይ፣ ሌላ ሰው በሚከፍለው ብድር፣ እና በአካባቢዎ ምንዛሬ ባልተወሰነ ዋጋ።",
  "bar.rent": "ኪራይ",
  "bar.principal": "የተከፈለ ብድር",
  "bar.appreciation": "የዋጋ ጭማሪ",
  "why.1": "ተከራዩ ብድሩን ይከፍላል",
  "why.1.body":
    "በመጀመሪያው ዓመት ከሚከፈለው ክፍያ ውስጥ {principal} የሚሆነው ዋናውን ብድር የሚቀንስ ነው። የከፈሉት እርስዎ አይደሉም፤ ኪራዩ ነው። ገንዘቡ ግን የእርስዎ ነው።",
  "why.2": "ዋጋው የሚጨምረው በሙሉ ቤቱ ላይ ነው፣ በከፈሉት ድርሻ ላይ ብቻ አይደለም",
  "why.2.body":
    "በ{rate} ስሌት ቤቱ በዓመት {gain} ያህል ይጨምራል። እርስዎ ያስገቡት {cash} ነው። ጭማሪው ግን በሙሉ {price} ላይ ነው።",
  "why.3": "ሊከፈሉበት በሚፈልጉት ምንዛሬ የሚመጣ ገቢ",
  "why.3.body":
    "ኪራዩ በየወሩ በዶላር፣ ወደ አሜሪካ የባንክ ሂሳብ ይገባል፤ እርስዎ በሚኖሩበት አገር ምንዛሬ ላይ ምንም ይሁን ምን።",
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
  "doors.1.body": "ሙሉ ዝርዝር፦ እያንዳንዱ ወጪ፣ የመጀመሪያው ዓመት በዝርዝር፣ እና እንቅፋት የሆነብዎት ነገር። ተጨማሪ ጥያቄ የለም።",
  "doors.1.cta": "አሳየኝ",
  "doors.2": "ያደረገውን ሰው ያናግሩ",
  "doors.2.body": "ከካሌብ ጋር አሥራ አምስት ደቂቃ፣ በአማርኛ ወይም በእንግሊዝኛ፣ እርስዎ ባሉበት ሰዓት።",
  "doors.2.cta": "ክፍት ሰዓቶችን ይመልከቱ",
  "doors.3": "ምናልባት እኔው እዚህ እኖር ይሆናል",
  "doors.3.body": "በቤቱ ውስጥ የሚኖሩ ከሆነ የጆርጂያ የድጋፍ ፕሮግራሞች ሊመለከቱዎት ይችላሉ።",
  "doors.3.cta": "እዚህ ለመኖር መግዛት",

  "disc.hero":
    "እነዚህ የዕቅድ ግምቶች ናቸው፤ የብድር ፈቃድ ወይም የኪራይ ዋስትና አይደሉም። የቅድመ ክፍያና የወለድ መጠኖች አበዳሪዎች ለእያንዳንዱ ሁኔታ ካወጡት መረጃ የተወሰዱ ናቸው፤ የሚወስነው የራስዎ አበዳሪ ነው። ኪራዩ ከካውንቲ አማካይ የተሰላ ነው፤ ከአንድ የተወሰነ ቤት አይደለም።",
  "foot.note":
    "Rift ለውጭ አገር ገዢዎች። በጆርጂያ ፈቃድ ባለው ደላላ በካሌብ በፈቃዱ የሚመራ። እያንዳንዱ ቁጥር የዕቅድ ግምት ነው፤ የብድር ቃል፣ ፈቃድ ወይም ግምገማ አይደለም። የግብር አማካሪዎች ወይም የኢሚግሬሽን ጠበቆች አይደለንም፤ ጥያቄው የእነሱ ሲሆን እንነግርዎታለን።",
  "foot.fair":
    "እኩል የቤት ዕድል። ከዘር፣ ከቀለም፣ ከሃይማኖት፣ ከፆታ፣ ከአካል ጉዳት፣ ከቤተሰብ ሁኔታ ወይም ከትውልድ አገር ነፃ በሆነ መልኩ ከሁሉም ገዢ ጋር በእኩል ሁኔታ እንሰራለን።",

  "status.citizen.you": "የአሜሪካ ዜጋ ነዎት፤ ከአገር ውጭ ይኖራሉ",
  "status.resident.you": "ግሪን ካርድ ወይም የአሜሪካ ቪዛ አለዎት",
  "status.itin.you": "ITIN አለዎት፤ የሶሻል ሴኩሪቲ ቁጥር የለዎትም",
  "status.foreign.you": "ከአሜሪካ ውጭ ይኖራሉ፤ ምንም የአሜሪካ ሁኔታ የለዎትም",

  "book.band.h": "ካሌብ አማርኛ ይናገራል።",
  "book.band.b": "ንግግሩ በአማርኛ ይሆናል። ከታች ያለው ቅጽ ግን በእንግሊዝኛ ነው፤ ስምዎን፣ ኢሜይልዎን ወይም ስልክዎን ብቻ ነው የሚጠይቀው።",
  "book.back": "ወደ ቁጥሮቼ ልመለስ",
  "res.title": "ካሉበት ሆነው ይህ ምን ያህል እንደሚጠይቅዎት",
  "res.change": "መልሶቼን ልቀይር",
  "res.kicker": "{price} በ{county} ካውንቲ · {use}",
  "res.kicker.rent": "ተከራይቶ",
  "res.kicker.live": "ለራስዎ ተይዞ",
  "res.h1.covers": "ራሱን ይሸፍናል፤ ሌሎች ሦስት ነገሮችም ይከፍሉዎታል።",
  "res.h1.short": "በየወሩ {amount} ይጎድላል፤ ቢሆንም {pct}% ይመልሳል።",
  "res.h1.live": "{amount} ይልካሉ፤ በሠላሳ ዓመትም ሙሉ በሙሉ የእርስዎ ይሆናል።",

  "res.send.title": "መላክ ያለብዎት",
  "res.send.downChip": "{pct}% ቅድመ ክፍያ",
  "res.send.down": "ቅድመ ክፍያ",
  "res.send.down.note": "{pct}%፣ በእርስዎ ሁኔታ አበዳሪ የሚቀበለው ዝቅተኛው",
  "res.send.closing": "የዝግጅት ወጪ",
  "res.send.closing.note": "{pct}%፦ ጠበቃ፣ የባለቤትነት ማረጋገጫ፣ ምዝገባ፣ የአበዳሪ ክፍያ",
  "res.send.total": "ባለቤት ከመሆንዎ በፊት",

  "res.month.title": "በየወሩ",
  "res.month.pi": "የብድር ክፍያ",
  "res.month.tax": "የንብረት ግብር",
  "res.month.ins": "ኢንሹራንስ",
  "res.month.mgmt": "አስተዳደር",
  "res.month.mgmt.note": "{pct}%፣ እርስዎ እዚያ ስለሌሉ የአካባቢው ሰው",
  "res.month.vac": "ለክፍት ጊዜ የሚቀመጥ",
  "res.month.vac.note": "{pct}%፣ በዓመት አንድ ወር ገደማ በተከራዮች መካከል",
  "res.month.maint": "ለጥገና የሚቀመጥ",
  "res.month.maint.note": "{pct}%፦ ጥገናና የተከራይ ለውጥ",
  "res.month.left": "የሚተርፍ",
  "res.month.short": "የሚጎድል",
  "res.month.costs": "በየወሩ የሚያስወጣዎት",

  "res.year.h2": "የመጀመሪያው ዓመት በትክክል የት እንደሚሄድ።",
  "res.year.lede": "ከሦስቱ ትንሹ የወር ገቢ ነው፤ ብዙ ሰው የሚያየውም እሱን ብቻ ነው።",
  "res.year.flow": "ኪራይ፣ ከሁሉም ወጪ በኋላ",
  "res.year.flow.note": "የሚወጣ ገንዘብ። ወደ ሂሳብዎ የሚደርሰው ይህ ብቻ ነው።",
  "res.year.principal": "የተከፈለ የብድር ዋና",
  "res.year.principal.note": "አሁን የሚወጣ አይደለም፤ ግን የእርስዎ ነው። የከፈለው ተከራዩ ነው፣ እርስዎ አይደሉም።",
  "res.year.appreciation": "የዋጋ ጭማሪ በ{pct}%",
  "res.year.appreciation.note": "በሙሉ {price} ላይ እንጂ ባስገቡት ገንዘብ ላይ አይደለም።",
  "res.year.total": "የመጀመሪያው ዓመት በጠቅላላ",
  "res.month.running": "እንደ ኪራይ ቤት ማስኬድ",
  "res.month.running.meta": "{n} ወጪዎች፣ በወር −{amount}",
  "res.year.total.note":
    "በላኩት {cash} ላይ። የዋጋ ጭማሪ ግምት ነው፤ አሉታዊም ሊሆን ይችላል። ሌሎቹ ሁለቱ በውል የተያዙ ናቸው።",
  "res.year.of": "{pct}% ከላኩት ገንዘብ",

  "res.block.kicker": "መንገድዎን የሚዘጋው አንድ ነገር",
  "res.block.live": "ይዘውት እስካሉ ድረስ ምንም አያመጣም",
  "res.block.live.body":
    "ባዶ ሆኖ ከቆየ በየወሩ {monthly} ያስወጣዎታል። ከመጀመሪያው ዓመት {principal} የብድር ዋና ነው፤ ስለዚህ አልጠፋም፤ ገቢም ግን አይደለም።",
  "res.block.tenant": "ረጅም ጊዜ የሚቆይ ተከራይ ማግኘት",
  "res.block.tenant.body":
    "ቁጥሮቹ በዓመት አንድ ወር ገደማ ክፍት እንደሚሆን ይገምታሉ። ሁለት ወር ክፍት ከሆነ በየወሩ {flow} የነበረው ወደ {worse} ገደማ ይወርዳል።",
  "res.block.under": "በ{pct}% ቅድመ ክፍያ ራሱን አይሸፍንም",
  "res.block.under.body":
    "ኪራዩ ሁሉንም እንዲሸፍን {breakEven}% ቅድመ ክፍያ ያስፈልጋል፤ ከ{have} ይልቅ {needed}። በዚያው ካውንቲ ውስጥ ርካሽ ቤት በዚህ ያነሰ ይደርሳል።",
  "res.block.never": "በዚህ ዋጋ ምንም ራሱን አይሸፍንም",
  "res.block.never.body":
    "በ{county} ውስጥ በ{price} ኪራዩ ወጪውን እንዲሸፍን የሚያደርግ ምንም ቅድመ ክፍያ የለም። ርካሽ ቤት፣ ወይም የተሻለ የኪራይ-ወደ-ዋጋ ጥምርታ ያለው ካውንቲ ያደርገዋል።",

  "res.lender.rate": "የሚታየው ወለድ {rate}% ሲሆን ለዚህ ዓይነት ብድር {premium} ነጥብ ገደማ ይጨመርበታል። {source}።",
  "res.rate.assumption": "እስካሁን የተመዘገበ የወለድ መጠን የለም፤ ይህ የመነሻ ግምት ነው",

  "res.keep.h3": "ይህ ገጽ ቢደውሉም ባይደውሉም መስራቱን ይቀጥላል።",
  "res.keep.body":
    "አገናኙን ያስቀምጡ። እዚህ ያለው ምንም አያልፍበትም፤ እርስዎ እስካልሰጡ ድረስም ማንም መረጃዎን አልያዘም።",
  "res.keep.cta": "ከካሌብ ጋር አስራ አምስት ደቂቃ",
  "res.disc":
    "እነዚህ የዕቅድ ግምቶች ናቸው፤ የብድር ፈቃድ፣ የኪራይ ዋስትና ወይም የንብረት ግምገማ አይደሉም። የቅድመ ክፍያና የወለድ ተጨማሪዎች አበዳሪዎች ለእያንዳንዱ ሁኔታ ካወጡት መረጃ የተወሰዱ ናቸው፤ የሚወስነው የራስዎ አበዳሪ ነው። ኪራዩ ከካውንቲ አማካይ የተሰላ ነው እንጂ ከአንድ የተወሰነ ቤት አይደለም። በኪራይ ገቢ ላይ የሚከፈል የአሜሪካ ግብርና በሽያጭ ጊዜ የሚተገበረው FIRPTA ቀረጥ እውነተኛ ናቸው፤ ሁለቱም ለደላላ ሳይሆን ለድንበር ተሻጋሪ የሂሳብ ባለሙያ የሚቀርቡ ጥያቄዎች ናቸው።",

  "res.email.h": "እነዚህ ቁጥሮች በኢሜይል ይድረሱዎት።",
  "res.email.body":
    "ከላይ ያሉትን ቁጥሮችና ወደዚህ ገጽ የሚመልስ አገናኝ የያዘ አንድ ኢሜይል። ጋዜጣ የለም፤ መረጃዎ ለማንም አይሸጥም፤ በአንድ ጠቅታ ያቆሙታል።",
  "res.email.field": "የኢሜይል አድራሻ",
  "res.email.cta": "ይላኩልኝ",
  "res.email.sent": "በመንገድ ላይ ነው። አገናኙን ስለያዘ በማንኛውም መሣሪያ ይሠራል።",
  "res.email.off":
    "ተመዝግቧል፤ ነገር ግን ኢሜይል ገና አልተከፈተም፤ ስለዚህ ምንም አልተላከም። የዚህን ገጽ አድራሻ ያስቀምጡ፤ ተመሳሳይ ሰነድ ነው።",
  "res.email.bad": "ያ የኢሜይል አድራሻ ትክክል አይመስልም።",
  "res.email.err": "አልተሳካም። ይህ ገጽና አድራሻው አሁንም ይሠራሉ።",

  "res.forget.h": "ሁሉንም ይሰርዙ",
  "res.forget.body":
    "መልሶችዎንና የያዝነውን ሁሉ የጊዜ ሰሌዳውን ሳይጠብቁ አሁኑኑ ያስወግዱ።",
  "res.forget.cta": "ሁሉንም ሰርዝ",
  "res.forget.working": "በመሰረዝ ላይ\u2026",
  "res.forget.done":
    "ተሰርዟል። ስለዚህ ጉብኝት በዚህ መሣሪያም ሆነ በእኛ በኩል ምንም አልቀረም።",
  "res.forget.partial":
    "ከዚህ መሣሪያ ጸድቷል። በእኛ በኩል የሚወገድ ምንም አልተከማቸም ነበር፤ ወይም ጥያቄው አልደረሰንም፤ በዚያ ሁኔታ የጊዜ ሰሌዳው በራሱ ያስወግደዋል።",
};

const DICTS: Record<Locale, Dict> = { en, am };

/**
 * Falls back to English rather than showing a key, which is never anyone's
 * language. Values may carry {named} slots so a sentence keeps its own word
 * order in each language: Amharic puts the verb last, and a translation
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

/**
 * Which Amharic values a native speaker has actually confirmed.
 *
 * Empty, and that is the honest state: every value in `am` is a first pass by
 * a non-native writer. The docblock at the top of this file has said so since
 * it was written, which helps nobody decide what to do about it: a note in a
 * comment does not produce a worklist, and "the Amharic needs reviewing" has
 * sat on a list for weeks precisely because it has no edge.
 *
 * So it is a list instead. Add a key here when Kaleb has read that one value
 * and is happy with it; `/api/health` reports the remainder as an outcome
 * rather than as configuration, which is the only kind of check that has ever
 * caught anything in this product.
 */
export const REVIEWED_AM: string[] = [];

/**
 * Keys whose Amharic is not merely unreviewed but now says something FALSE.
 *
 * A different and more urgent thing than the list below. Everything is
 * unreviewed: that means "a non-native first pass, tone unchecked". These
 * mean "the English was corrected and the Amharic still carries the claim that
 * was wrong", so an Amharic reader is being told something the English reader
 * is no longer told.
 *
 * `disc.hero` and `res.disc` both said the rent figure came from county
 * averages. It does not: the ratios in lib/core/abroad.ts are engineering's
 * own assumptions and always were. The English now says so. Until these two
 * are retranslated, the Amharic page makes a claim about provenance that the
 * product knows to be untrue, which is worse than an unpolished sentence,
 * because it is exactly the promise this audience is being asked to trust.
 *
 * Empty this list by retranslating, not by deleting it.
 */
export const WRONG_IN_AM: string[] = ["disc.hero", "res.disc"];

/** The keys still carrying an unreviewed translation. */
export function unreviewedAm(): string[] {
  return KEYS.filter((k) => !REVIEWED_AM.includes(k));
}

/** Every English key must exist in Amharic; the test enforces it. */
export const KEYS = Object.keys(en);
export const dictFor = (l: Locale) => DICTS[l];
