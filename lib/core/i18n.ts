/**
 * Two languages, one dictionary.
 *
 * Scoped to the pages for buyers abroad, the Equb page (keys `eq.*`) and the
 * client portal (keys `pt.*`, manual review WS11.6), because that is where a
 * second language is a feature rather than a gesture. The rest of the product stays
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

  "hero.h1": "You don't need a green card to own property in the United States.",
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

  "why.kicker": "Why the United States, and why now",
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
  "why.4.body": "Property deeds in the United States are public record and searchable. Ownership is a document, not a relationship you have to maintain from abroad.",

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
  "res.month.pmi": "Mortgage insurance",
  "res.month.pmi.note": "{pct}% of the loan a year, because less than 20% is down",
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

  /* The Equb page (manual review WS2.3). */
  "eq.chip": "Equb for a home",
  "eq.nav.how": "How it works",
  "eq.nav.faq": "FAQ",
  "eq.cta.seat": "Save my seat",
  "eq.cta.fits": "See if a group fits me",
  "eq.cta.join": "Join the next group",
  "eq.hero.h1": "Save together. Buy a home.",
  "eq.hero.lede": "Join a group of families saving together, each receiving a down payment on a set schedule, with attorneys, CPAs, lenders and a licensed real estate agent guiding every step.",
  "eq.problem.k": "The problem",
  "eq.problem.b": "Rent keeps going up. Saving a down payment alone can take 7 to 10 years, and many hardworking families have strong income but thin credit history. Banks see a file. We see a community.",
  "eq.vision.k": "Our vision",
  "eq.vision.h": "Leveraging a tool that is proven. A clear path to a home.",
  "eq.vision.p1": "Generations of Ethiopians built businesses, paid for weddings and brought families across oceans through Equb. It worked because it was built on trust.",
  "eq.vision.p2": "Bet Equb takes that same tradition and gives it the structure of modern homebuying: a secure platform, professional oversight and a clear path from renter to homeowner.",
  "eq.vision.p3": "Our goal is simple: every member of every group walks away with the keys to their own home.",
  "eq.safe.k": "Safety",
  "eq.safe.h": "How we make Equb safer",
  "eq.safe.lede": "What we are building into every group. The exact terms are being finalized with our attorney, and you get them in writing before you commit anything.",
  "eq.safe.1.t": "Protection if a member stops paying",
  "eq.safe.1.b": "We are building a security for each group, so a member who stops paying after their turn does not leave the others short.",
  "eq.safe.2.t": "A legal entity for each group",
  "eq.safe.2.b": "Each group is set up as its own legal entity, with written rules every member signs.",
  "eq.safe.3.t": "A team of professionals",
  "eq.safe.3.b": "Attorneys, CPAs, lenders and a licensed real estate agent, each with a defined role.",
  "eq.safe.4.t": "A dashboard for every member",
  "eq.safe.4.b": "Every member sees every payment in and every payout, as it happens.",
  "eq.safe.5.t": "Automatic payments",
  "eq.safe.5.b": "Contributions are collected automatically by ACH bank transfer, so nobody has to chase a payment.",
  "eq.how.h": "How it works",
  "eq.step.1.t": "Join a group",
  "eq.step.1.b": "Families commit to a fixed monthly contribution for a fixed cycle.",
  "eq.step.2.t": "Save together",
  "eq.step.2.b": "Contributions are made through the app and held by an independent, licensed professional. Every member can see every payment.",
  "eq.step.3.t": "Get mortgage-ready",
  "eq.step.3.b": "While you save, we help you with credit, pre-approval and down payment assistance programs you may qualify for.",
  "eq.step.4.t": "Receive your down payment",
  "eq.step.4.b": "When your turn comes, your funds go directly to closing on your new home.",
  "eq.step.5.t": "Move in",
  "eq.step.5.b": "Keep contributing until the cycle is complete so every family in your group gets home too.",
  "eq.ex.k": "An example group",
  "eq.ex.members": "Members",
  "eq.ex.monthly": "Monthly contribution",
  "eq.ex.cycle": "Cycle",
  "eq.ex.receives": "Each member receives",
  "eq.ex.families": "{n} families",
  "eq.ex.months": "{n} months",
  "eq.ex.toward": "~{amount} toward their home",
  "eq.ex.varies": "Varies",
  "eq.ex.ladder": "One household is paid each month, and every payout is the same size. Going earlier or later changes when you receive it, not how much.",
  "eq.ex.ladderLabel": "{n} months, one household paid each month, every payout the same size",
  "eq.why.h": "Why Bet Equb",
  "eq.why.1.t": "Built on tradition",
  "eq.why.1.b": "The Equb you know, with the same spirit of trust and community.",
  "eq.why.2.t": "Protected by professionals",
  "eq.why.2.b": "Structured with attorneys, CPAs and financial professionals. Funds are held independently, never by individual members.",
  "eq.why.3.t": "Fully transparent",
  "eq.why.3.b": "A shared dashboard shows every contribution and every payout, in real time.",
  "eq.why.4.t": "Your money goes straight to closing",
  "eq.why.4.b": "Funds are delivered to your closing attorney for your home purchase.",
  "eq.why.5.t": "Guided from start to finish",
  "eq.why.5.b": "Credit coaching, lender matching, down payment assistance and home search, all in one place.",
  "eq.why.6.t": "English and Amharic",
  "eq.why.6.b": "Every document, every conversation, in the language you are most comfortable with.",
  "eq.why.ledger": "Every member sees every payment.",
  "eq.why.closing": "Funds go to your closing attorney, not to a person.",
  "eq.who.k": "Who it's for",
  "eq.who.b": "Families who are ready to stop renting, have steady income, and want a disciplined, community-backed path to owning a home in metro Atlanta.",
  "eq.team.k": "Meet the team",
  "eq.team.b": "A licensed Georgia real estate agent, raised in the Ethiopian community, working alongside attorneys, CPAs and mortgage professionals.",
  "eq.team.own": "Members are free to work with our agent or bring their own.",
  "eq.faq.h": "Questions",
  "eq.faq.1.q": "How is my money protected?",
  "eq.faq.1.a": "Contributions are held by an independent licensed professional and paid directly to closing. The exact structure is being finalized with our attorney, and you will get it in writing, in full, before you commit anything.",
  "eq.faq.2.q": "How is the order decided?",
  "eq.faq.2.a": "The method is not final yet. You will see it written out, and agree to it, before the group starts.",
  "eq.faq.3.q": "What if I miss a payment?",
  "eq.faq.3.a": "The policy is not final yet. It will be in writing before you commit, so nobody learns the rule after they need it.",
  "eq.faq.4.q": "Do I need perfect credit?",
  "eq.faq.4.a": "No. We help members build credit and get mortgage-ready during the cycle.",
  "eq.faq.5.q": "Can I use down payment assistance too?",
  "eq.faq.5.a": "Yes. We help you find and combine programs you qualify for.",
  "eq.reserve.h": "Your home is closer than you think.",
  "eq.reserve.b": "Groups are forming now. Save your seat and we will contact you about the next information session.",
  "eq.f.step1": "Step 1 of 2: how to reach you",
  "eq.f.step2": "Step 2 of 2: a little about your plans",
  "eq.f.name": "Name",
  "eq.f.phone": "Phone",
  "eq.f.email": "Email",
  "eq.f.household": "Household size",
  "eq.f.lang": "Preferred language",
  "eq.f.price": "Target home price",
  "eq.f.when": "When would you like to be in a home?",
  "eq.f.next": "Next",
  "eq.f.send": "Send",
  "eq.f.skip": "Skip this step",
  "eq.f.sending": "Sending…",
  "eq.f.addName": "Add your name",
  "eq.f.addReach": "Add a phone number or email",
  "eq.f.tick": "Tick the box so we can call you",
  "eq.f.saved": "We have your details. These last questions help us place you in the right group.",
  "eq.f.done.h": "Got it. Your seat request is in.",
  "eq.f.done.b": "A seat request is not a commitment and no money changes hands. We will reach out about the next information session.",
  "eq.f.nocommit": "Saving a seat is not a commitment, and nothing is charged.",
  "eq.f.consentNote": "The consent wording is in English, because it is the version that is legally binding.",
  "eq.f.err.save": "We could not save your request just now, so it has not reached us. Please try again in a minute.",
  "eq.f.err.net": "We could not send your request. Check your connection and try again; what you typed is still here.",
  "eq.t.0": "In the next 3 months",
  "eq.t.1": "3 to 9 months",
  "eq.t.2": "9 to 18 months",
  "eq.t.3": "Just exploring",
  "eq.foot.b": "Bet Equb is a working name. The program is being structured with legal and tax professionals; the terms you receive in writing, not this page, govern. Examples are for illustration and are not a promise of any outcome.",
  "eq.foot.privacy": "What we keep",
  "eq.foot.buy": "Buying on your own",
  "eq.reserve.title": "Save your seat",
  "eq.reserve.lede": "Two short steps. Your details reach us after the first one.",
  "eq.back": "Back to Bet Equb",

  /* The simpler abroad page (manual review WS6). */
  "four.label": "Four ways one home pays you back: rent, growth in value, an asset held in dollars, and a place to stay when you visit.",
  "four.rent": "Rent",
  "four.growth": "Growth",
  "four.dollar": "A dollar asset",
  "four.stay": "A place to stay",
  "abroad.cta.h": "See your whole picture",
  "abroad.cta.b": "What it would cost and what it could earn, worked out from your answers. No account and no passport scan.",
  /* The client portal (manual review WS11.6). The sentences the product
     works out from records (what is due, offer terms, the ledger) stay in
     English for now, and the page says so: a generated sentence translated
     piece by piece is how a wrong word changes a meaning. */
  "pt.with": "With {agent}",
  "pt.account": "Account",
  "pt.signout": "Sign out",
  "pt.lang": "Language",
  "pt.english": "Some details on this page are in English for now.",
  "pt.tab.today": "Today",
  "pt.tab.homes": "Homes",
  "pt.tab.offers": "Offers",
  "pt.tab.money": "Money",
  "pt.tab.documents": "Documents",
  "pt.tab.help": "Help",
  "pt.nav": "Your move",
  "pt.back": "← Your move",
  "pt.signedAs": "With {agent} · you are signed in as {name} ({role})",
  "pt.records": "Your records",
  "pt.sellerNote": "{agent} will share more here as your sale moves forward.",
  "pt.today.h": "Today",
  "pt.today.failed": "What is due did not load. That is not the same as nothing being due; reload in a moment, or ask {agent}.",
  "pt.today.setup": "This part is being set up. Ask {agent} what comes next.",
  "pt.movein.h": "Moving in",
  "pt.offers.h": "Offers",
  "pt.offers.failed": "Your offers did not load. That is not the same as there being none; reload in a moment.",
  "pt.offers.setup": "This part is being set up. Ask {agent} about any offer.",
  "pt.pri.h": "Your search priorities",
  "pt.pri.failed": "Your priorities did not load. Nothing is lost; reload in a moment.",
  "pt.homes.h": "Homes",
  "pt.homes.note": "Homes you or {agent} added. Reacting tells {agent} what you think; it does not change your search.",
  "pt.homes.compare": "Compare side by side",
  "pt.homes.failed": "The homes did not load. That is not the same as an empty list; reload in a moment.",
  "pt.pricing.h": "Pricing",
  "pt.proceeds.h": "What you would keep",
  "pt.proceeds.note": "Until the settlement statement, these are plans, not money in hand.",
  "pt.money.h": "Money",
  "pt.money.note": "What you pay before closing, what you bring to the table, and what your savings leave, worked out from {source} and the amounts {agent} has recorded. Each line says where it came from.",
  "pt.money.saved": "the plan you saved",
  "pt.money.typical": "typical Georgia figures",
  "pt.money.failed": "This did not load. That is not the same as there being nothing to show; reload in a moment.",
  "pt.docs.h": "Documents",
  "pt.docs.from": "From {agent}",
  "pt.docs.fromNote": "Everything {agent} has shared with you, in one place.",
  "pt.docs.none": "Nothing has been shared yet. When {agent} shares a document, it appears here.",
  "pt.docs.yours": "From you",
  "pt.docs.yoursAll": "From you and the people buying with you",
  "pt.docs.sentFailed": "What you sent did not load. That is not the same as nothing being there; reload in a moment.",
  "pt.docs.nothing": "Nothing yet.",
  "pt.docs.you": "You",
  "pt.questions": "Questions? How to reach {agent}",
  "pt.foot": "Only people {agent} invited can see this page, and only the parts shared with them. Nothing here is a contract, an offer, or a loan decision.",

  "pt.help.h": "Help",
  "pt.help.next": "What happens next:",
  "pt.help.q": "Questions, or something here looks wrong?",
  "pt.help.emailAt": "Email {agent} at",
  "pt.help.orReply": "or reply to any email from Rift.",
  "pt.help.reply": "Reply to any email from Rift and it reaches {agent}.",
  "pt.help.sameDay": "On business days you hear back the same day.",

  "pt.send.btn": "Send {agent} a document",
  "pt.send.what": "What it is",
  "pt.send.name": "Name it",
  "pt.send.namePh": "For example, bank statement for September",
  "pt.send.file": "File",
  "pt.send.note": "PDF, JPEG or PNG, up to 20 MB. Only {agent} and the people buying with you can open it.",
  "pt.send.go": "Send it",
  "pt.send.cancel": "Cancel",
  "pt.send.ready": "Getting ready…",
  "pt.send.sending": "Sending…",
  "pt.send.checking": "Checking the file…",
  "pt.send.sent": "Sent. {agent} has “{label}”.",
  "pt.send.failed": "The file did not go through. Nothing was kept. Try again.",
  "pt.send.error": "That did not work. Try again.",
  "pt.kind.preapproval": "Pre-approval letter",
  "pt.kind.funds": "Proof of funds",
  "pt.kind.id": "Photo ID",
  "pt.kind.other": "Something else",

  "pt.si.title": "Sign in to your move",
  "pt.si.lede": "For buyers and sellers your agent has invited. Use your password, or we can email you a link.",
  "pt.si.first": "First time here?",
  "pt.si.firstBody": "Access starts with an invitation link from your agent. Open it, create a password, and you are in; after that, sign in here with the same email. If you have not had an invitation, ask your agent for one.",
  "pt.si.out": "You are signed out.",
  "pt.si.expired": "That sign-in link has expired or was already used. Ask for a new one below.",
  "pt.si.missing": "That sign-in link was incomplete. Ask for a new one below.",
  "pt.si.otherDevice": "That link was opened in a different browser from the one that asked for it. Ask for a new one below, or sign in with your password.",
  "pt.si.unconfigured": "Sign-in is not set up on this site right now. Your agent can still help by phone or email.",
  "pt.f.email": "Email",
  "pt.f.password": "Password",
  "pt.f.signin": "Sign in",
  "pt.f.signingIn": "Signing in…",
  "pt.f.sending": "Sending…",
  "pt.f.reset": "Email me a reset link",
  "pt.f.link": "Email me a sign-in link",
  "pt.f.forgot": "Forgot password?",
  "pt.f.linkInstead": "Email me a sign-in link instead",
  "pt.f.withPassword": "Sign in with a password",
  "pt.f.check": "Check your email.",
  "pt.f.sentBody": "If {email} has been invited, a link is on its way. It works once, on any device. Nothing arrived after a few minutes? Check spam, check the address is spelled the way your agent has it, then ask your agent to confirm it.",
  "pt.f.sentBodyReset": "If {email} has been invited, a link to choose a new password is on its way. It works once, on any device. Nothing arrived after a few minutes? Check spam, check the address is spelled the way your agent has it, then ask your agent to confirm it.",
  "pt.f.back": "Back to sign in",
  "pt.f.failed": "That did not work.",

  "pt.inv.title": "{agent} invited you to “{journey}”",
  "pt.inv.body": "You will see your search priorities and the homes {agent} shares, and you can confirm them, ask for changes and react to homes. This invitation is for {email}.",
  "pt.inv.create": "Create a password",
  "pt.inv.hint": "At least {n} characters. A short phrase works well.",
  "pt.inv.join": "Join",
  "pt.inv.joining": "Joining…",
  "pt.inv.createJoin": "Create password and join",
  "pt.inv.noPassword": "Rather not have a password?",
  "pt.inv.haveLogin": "Already have a login?",
  "pt.inv.emailTo": "Email a sign-in link to {email}",
  "pt.inv.once": "The link works once and on any device.",
  "pt.inv.passwordInstead": "Create a password instead",
  "pt.inv.check": "Check {email}.",
  "pt.inv.sent": "We sent a sign-in link. Open it, press Continue, and you will come straight back here to join.",
  "pt.inv.signingOut": "Signing out…",
  "pt.inv.first": "first.",

  "pt.acc.title": "Your account",
  "pt.acc.signin": "Signing in",
  "pt.acc.as": "You sign in as {email}. To use a different address, ask your agent to invite it; access belongs to the address that was invited.",
  "pt.acc.who": "Who is on “{journey}”",
  "pt.acc.agent": "your agent",
  "pt.acc.you": "(you)",
  "pt.acc.invited": "invited",
  "pt.acc.addRemove": "To add or remove someone, ask your agent.",
  "pt.acc.notices": "Email me when {agent} shares something new or needs my answer. The email says what kind of thing it is, never the details.",
  "pt.acc.on": "Saved. We will email you.",
  "pt.acc.off": "Saved. No more of these emails.",
  "pt.acc.notSaved": "That did not save. Try again.",
  "pt.pw.new": "Choose a new password",
  "pt.pw.set": "Set or change your password",
  "pt.pw.hint": "At least {n} characters. You can still sign in with an email link any time.",
  "pt.pw.save": "Save password",
  "pt.pw.saving": "Saving…",
  "pt.pw.saved": "Password saved. Use it next time you sign in.",

  "pt.home.title": "Your move",
  "pt.home.none": "You are signed in as {email}, but nothing has been shared with this address. If your agent sent you an invitation link, open it. It only works for the address it was sent to.",
  "pt.home.with": "with {agent}",
  "pt.role.buyer": "buyer",
  "pt.role.co-buyer": "co-buyer",
  "pt.role.viewer": "viewer",
};

const am: Dict = {
  "nav.abroad": "ከውጭ አገር",
  "nav.domestic": "እዚህ ለመኖር የሚገዙ",
  "nav.talk": "ካሌብን ያናግሩ",

  "hero.h1": "በአሜሪካ ንብረት ለመግዛት ግሪን ካርድ አያስፈልግዎትም።",
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

  "why.kicker": "ለምን አሜሪካ፣ ለምን አሁን",
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
  "why.4.body": "በአሜሪካ የቤት ባለቤትነት ሰነድ ይፋዊ መዝገብ ነው፤ ማንም ሊያረጋግጠው ይችላል። ባለቤትነት ሰነድ ነው፣ ከውጭ ሆነው መጠበቅ ያለብዎት ግንኙነት አይደለም።",

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
  "res.month.pmi": "የብድር ኢንሹራንስ",
  "res.month.pmi.note": "ቅድመ ክፍያው ከ20% በታች ስለሆነ በዓመት የብድሩ {pct}%",
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

  /* The Equb page (manual review WS2.3). First pass, unreviewed like the rest (D6). */
  "eq.chip": "እቁብ ለቤት",
  "eq.nav.how": "እንዴት ይሠራል",
  "eq.nav.faq": "ጥያቄዎች",
  "eq.cta.seat": "ቦታዬን ያዙልኝ",
  "eq.cta.fits": "የሚስማማኝ ቡድን ካለ ይመልከቱ",
  "eq.cta.join": "የሚቀጥለውን ቡድን ይቀላቀሉ",
  "eq.hero.h1": "በአንድነት እንቆጥብ። ቤት እንግዛ።",
  "eq.hero.lede": "አብረው ከሚቆጥቡ ቤተሰቦች ቡድን ጋር ይቀላቀሉ። እያንዳንዱ ቤተሰብ በተወሰነ የጊዜ ሰሌዳ የቅድሚያ ክፍያውን ይቀበላል፤ ጠበቆች፣ የሂሳብ ባለሙያዎች (CPA)፣ አበዳሪዎች እና ፈቃድ ያለው የሪል እስቴት ወኪል በእያንዳንዱ እርምጃ ይመሩዎታል።",
  "eq.problem.k": "ችግሩ",
  "eq.problem.b": "የቤት ኪራይ መጨመሩን አላቆመም። ብቻዎን የቅድሚያ ክፍያ ለማጠራቀም ከ7 እስከ 10 ዓመት ሊወስድ ይችላል፤ ብዙ ታታሪ ቤተሰቦች ጥሩ ገቢ ቢኖራቸውም የክሬዲት ታሪካቸው አጭር ነው። ባንኮች ፋይል ያያሉ። እኛ ማኅበረሰብ እናያለን።",
  "eq.vision.k": "ራዕያችን",
  "eq.vision.h": "የተፈተነ መሣሪያን መጠቀም። ወደ ቤት የሚወስድ ግልጽ መንገድ።",
  "eq.vision.p1": "ትውልዶች ኢትዮጵያውያን በእቁብ ንግድ ገንብተዋል፣ ሠርግ ደግሰዋል፣ ቤተሰቦቻቸውን ከውቅያኖስ ማዶ አምጥተዋል። የሠራው በእምነት ላይ ስለተገነባ ነው።",
  "eq.vision.p2": "ቤት እቁብ ያንኑ ባህል ይዞ የዘመናዊ ቤት ግዢን መዋቅር ይሰጠዋል፦ ደኅንነቱ የተጠበቀ መድረክ፣ የባለሙያ ቁጥጥር እና ከተከራይነት ወደ ቤት ባለቤትነት የሚወስድ ግልጽ መንገድ።",
  "eq.vision.p3": "ግባችን ቀላል ነው፦ የእያንዳንዱ ቡድን እያንዳንዱ አባል የራሱን ቤት ቁልፍ ይዞ እንዲወጣ።",
  "eq.safe.k": "ደኅንነት",
  "eq.safe.h": "እቁብን እንዴት ይበልጥ አስተማማኝ እናደርገዋለን",
  "eq.safe.lede": "በእያንዳንዱ ቡድን ውስጥ እየገነባን ያለነው። ትክክለኛው ውል ከጠበቃችን ጋር እየተጠናቀቀ ነው፤ ምንም ቃል ከመግባትዎ በፊት በጽሑፍ ይደርስዎታል።",
  "eq.safe.1.t": "አንድ አባል መክፈል ቢያቆም ጥበቃ",
  "eq.safe.1.b": "ተራውን የወሰደ አባል መክፈል ቢያቆም ሌሎቹ እንዳይጎዱ ለእያንዳንዱ ቡድን ዋስትና እየገነባን ነው።",
  "eq.safe.2.t": "ለእያንዳንዱ ቡድን ሕጋዊ ተቋም",
  "eq.safe.2.b": "እያንዳንዱ ቡድን የራሱ ሕጋዊ ተቋም ሆኖ ይቋቋማል፤ እያንዳንዱ አባል የሚፈርምበት የጽሑፍ ደንብ አለው።",
  "eq.safe.3.t": "የባለሙያዎች ቡድን",
  "eq.safe.3.b": "ጠበቆች፣ የሂሳብ ባለሙያዎች (CPA)፣ አበዳሪዎች እና ፈቃድ ያለው የሪል እስቴት ወኪል፤ እያንዳንዳቸው የተወሰነ ሚና አላቸው።",
  "eq.safe.4.t": "ለእያንዳንዱ አባል ዳሽቦርድ",
  "eq.safe.4.b": "እያንዳንዱ አባል እያንዳንዱን ገቢ ክፍያ እና እያንዳንዱን ክፍፍል ሲፈጸም ያያል።",
  "eq.safe.5.t": "ራስ-ሰር ክፍያዎች",
  "eq.safe.5.b": "መዋጮዎች በባንክ ዝውውር (ACH) በራስ-ሰር ይሰበሰባሉ፤ ማንም ክፍያ ማሳደድ አያስፈልገውም።",
  "eq.how.h": "እንዴት ይሠራል",
  "eq.step.1.t": "ቡድን ይቀላቀሉ",
  "eq.step.1.b": "ቤተሰቦች ለተወሰነ ዙር ቋሚ ወርሃዊ መዋጮ ለመክፈል ቃል ይገባሉ።",
  "eq.step.2.t": "በአንድነት ይቆጥቡ",
  "eq.step.2.b": "መዋጮዎች በመተግበሪያው ይከፈላሉ፤ ገለልተኛ፣ ፈቃድ ያለው ባለሙያ ይይዛቸዋል። እያንዳንዱ አባል እያንዳንዱን ክፍያ ማየት ይችላል።",
  "eq.step.3.t": "ለብድር ይዘጋጁ",
  "eq.step.3.b": "እየቆጠቡ ሳሉ በክሬዲት፣ በቅድመ-ፈቃድ እና ብቁ ሊሆኑባቸው በሚችሉ የቅድሚያ ክፍያ እርዳታ ፕሮግራሞች እንረዳዎታለን።",
  "eq.step.4.t": "የቅድሚያ ክፍያዎን ይቀበሉ",
  "eq.step.4.b": "ተራዎ ሲደርስ ገንዘቡ በቀጥታ ለአዲሱ ቤትዎ የግዢ መዝጊያ ይሄዳል።",
  "eq.step.5.t": "ይግቡ",
  "eq.step.5.b": "በቡድንዎ ያለው እያንዳንዱ ቤተሰብ ቤት እንዲገባ ዙሩ እስኪጠናቀቅ ድረስ መዋጮዎን ይቀጥሉ።",
  "eq.ex.k": "የምሳሌ ቡድን",
  "eq.ex.members": "አባላት",
  "eq.ex.monthly": "ወርሃዊ መዋጮ",
  "eq.ex.cycle": "ዙር",
  "eq.ex.receives": "እያንዳንዱ አባል የሚቀበለው",
  "eq.ex.families": "{n} ቤተሰቦች",
  "eq.ex.months": "{n} ወራት",
  "eq.ex.toward": "ለቤታቸው ~{amount}",
  "eq.ex.varies": "ይለያያል",
  "eq.ex.ladder": "በየወሩ አንድ ቤተሰብ ይከፈለዋል፤ እያንዳንዱ ክፍፍል መጠኑ እኩል ነው። ቀድሞ ወይም ዘግይቶ መቀበል የሚቀይረው መቼ እንደሚቀበሉ እንጂ ምን ያህል እንደሆነ አይደለም።",
  "eq.ex.ladderLabel": "{n} ወራት፤ በየወሩ አንድ ቤተሰብ ይከፈለዋል፤ እያንዳንዱ ክፍፍል እኩል ነው",
  "eq.why.h": "ለምን ቤት እቁብ",
  "eq.why.1.t": "በባህል ላይ የተገነባ",
  "eq.why.1.b": "የሚያውቁት እቁብ፣ በዚያው የእምነት እና የማኅበረሰብ መንፈስ።",
  "eq.why.2.t": "በባለሙያዎች የተጠበቀ",
  "eq.why.2.b": "ከጠበቆች፣ ከሂሳብ ባለሙያዎች እና ከፋይናንስ ባለሙያዎች ጋር የተዋቀረ። ገንዘቡ በገለልተኛ አካል ይያዛል እንጂ በግለሰብ አባላት አይደለም።",
  "eq.why.3.t": "ሙሉ በሙሉ ግልጽ",
  "eq.why.3.b": "የጋራ ዳሽቦርድ እያንዳንዱን መዋጮ እና እያንዳንዱን ክፍፍል በቅጽበት ያሳያል።",
  "eq.why.4.t": "ገንዘብዎ በቀጥታ ወደ ግዢ መዝጊያ ይሄዳል",
  "eq.why.4.b": "ገንዘቡ ለቤት ግዢዎ ለመዝጊያ ጠበቃዎ ይደርሳል።",
  "eq.why.5.t": "ከመጀመሪያ እስከ መጨረሻ የሚመራ",
  "eq.why.5.b": "የክሬዲት ምክር፣ አበዳሪ ማገናኘት፣ የቅድሚያ ክፍያ እርዳታ እና ቤት ፍለጋ፣ ሁሉም በአንድ ቦታ።",
  "eq.why.6.t": "እንግሊዝኛ እና አማርኛ",
  "eq.why.6.b": "እያንዳንዱ ሰነድ፣ እያንዳንዱ ውይይት፣ በሚመችዎ ቋንቋ።",
  "eq.why.ledger": "እያንዳንዱ አባል እያንዳንዱን ክፍያ ያያል።",
  "eq.why.closing": "ገንዘቡ ለመዝጊያ ጠበቃዎ ይሄዳል እንጂ ለግለሰብ አይደለም።",
  "eq.who.k": "ለማን ነው",
  "eq.who.b": "ኪራይ ማቆም ለሚፈልጉ፣ ቋሚ ገቢ ላላቸው እና በሜትሮ አትላንታ ቤት ለመያዝ ሥርዓት ያለው፣ በማኅበረሰብ የሚደገፍ መንገድ ለሚፈልጉ ቤተሰቦች።",
  "eq.team.k": "ቡድኑን ይተዋወቁ",
  "eq.team.b": "በኢትዮጵያ ማኅበረሰብ ውስጥ ያደገ፣ ፈቃድ ያለው የጆርጂያ የሪል እስቴት ወኪል፣ ከጠበቆች፣ ከሂሳብ ባለሙያዎች እና ከብድር ባለሙያዎች ጋር የሚሠራ።",
  "eq.team.own": "አባላት ከእኛ ወኪል ጋር መሥራት ወይም የራሳቸውን ወኪል ማምጣት ይችላሉ።",
  "eq.faq.h": "ጥያቄዎች",
  "eq.faq.1.q": "ገንዘቤ እንዴት ይጠበቃል?",
  "eq.faq.1.a": "መዋጮዎች በገለልተኛ፣ ፈቃድ ባለው ባለሙያ ይያዛሉ፤ በቀጥታ ለግዢ መዝጊያ ይከፈላሉ። ትክክለኛው መዋቅር ከጠበቃችን ጋር እየተጠናቀቀ ነው፤ ምንም ቃል ከመግባትዎ በፊት ሙሉውን በጽሑፍ ያገኛሉ።",
  "eq.faq.2.q": "ተራው እንዴት ይወሰናል?",
  "eq.faq.2.a": "ዘዴው ገና አልተጠናቀቀም። ቡድኑ ከመጀመሩ በፊት በጽሑፍ ያዩታል፣ ይስማሙበታል።",
  "eq.faq.3.q": "ክፍያ ብዘልስ?",
  "eq.faq.3.a": "ደንቡ ገና አልተጠናቀቀም። ቃል ከመግባትዎ በፊት በጽሑፍ ይሆናል፤ ማንም ደንቡን ከሚያስፈልገው በኋላ አያውቅም።",
  "eq.faq.4.q": "ፍጹም ክሬዲት ያስፈልገኛል?",
  "eq.faq.4.a": "አያስፈልግዎትም። በዙሩ ወቅት አባላት ክሬዲት እንዲገነቡ እና ለብድር እንዲዘጋጁ እንረዳለን።",
  "eq.faq.5.q": "የቅድሚያ ክፍያ እርዳታም መጠቀም እችላለሁ?",
  "eq.faq.5.a": "አዎ። ብቁ የሆኑባቸውን ፕሮግራሞች እንዲያገኙ እና እንዲያጣምሩ እንረዳዎታለን።",
  "eq.reserve.h": "ቤትዎ ከሚያስቡት በላይ ቅርብ ነው።",
  "eq.reserve.b": "ቡድኖች አሁን እየተቋቋሙ ነው። ቦታዎን ይያዙ፤ ስለሚቀጥለው የመረጃ ስብሰባ እናገኝዎታለን።",
  "eq.f.step1": "ደረጃ 1 ከ2፦ እንዴት እናግኝዎ",
  "eq.f.step2": "ደረጃ 2 ከ2፦ ስለ ዕቅድዎ ትንሽ",
  "eq.f.name": "ስም",
  "eq.f.phone": "ስልክ",
  "eq.f.email": "ኢሜይል",
  "eq.f.household": "የቤተሰብ ብዛት",
  "eq.f.lang": "የሚመርጡት ቋንቋ",
  "eq.f.price": "የሚፈልጉት የቤት ዋጋ",
  "eq.f.when": "መቼ ቤት ውስጥ መሆን ይፈልጋሉ?",
  "eq.f.next": "ቀጣይ",
  "eq.f.send": "ላክ",
  "eq.f.skip": "ይህን ደረጃ ይለፉ",
  "eq.f.sending": "በመላክ ላይ…",
  "eq.f.addName": "ስምዎን ያስገቡ",
  "eq.f.addReach": "ስልክ ቁጥር ወይም ኢሜይል ያስገቡ",
  "eq.f.tick": "እንድንደውልልዎ ሳጥኑን ምልክት ያድርጉ",
  "eq.f.saved": "መረጃዎ ደርሶናል። እነዚህ የመጨረሻ ጥያቄዎች ትክክለኛው ቡድን ውስጥ እንድናስገባዎ ይረዱናል።",
  "eq.f.done.h": "ደርሶናል። የቦታ ጥያቄዎ ገብቷል።",
  "eq.f.done.b": "የቦታ ጥያቄ ቃል መግባት አይደለም፤ ምንም ገንዘብ አይንቀሳቀስም። ስለሚቀጥለው የመረጃ ስብሰባ እናገኝዎታለን።",
  "eq.f.nocommit": "ቦታ መያዝ ቃል መግባት አይደለም፤ ምንም አይከፈልም።",
  "eq.f.consentNote": "የፈቃድ ቃሉ በእንግሊዝኛ ነው፤ በሕግ አስገዳጅ የሆነው ቅጂ እሱ ስለሆነ።",
  "eq.f.err.save": "ጥያቄዎን አሁን ማስቀመጥ አልቻልንም፤ ስለዚህ አልደረሰንም። እባክዎ ከአንድ ደቂቃ በኋላ እንደገና ይሞክሩ።",
  "eq.f.err.net": "ጥያቄዎን መላክ አልቻልንም። ግንኙነትዎን አረጋግጠው እንደገና ይሞክሩ፤ የጻፉት አሁንም እዚህ አለ።",
  "eq.t.0": "በሚቀጥሉት 3 ወራት",
  "eq.t.1": "ከ3 እስከ 9 ወራት",
  "eq.t.2": "ከ9 እስከ 18 ወራት",
  "eq.t.3": "ገና እየተመለከትኩ ነው",
  "eq.foot.b": "ቤት እቁብ የሥራ ስም ነው። ፕሮግራሙ ከሕግ እና ከግብር ባለሙያዎች ጋር እየተዋቀረ ነው፤ የሚገዛው በጽሑፍ የሚቀበሉት ውል እንጂ ይህ ገጽ አይደለም። ምሳሌዎቹ ለማስረዳት ብቻ ናቸው፤ የማንኛውም ውጤት ቃል አይደሉም።",
  "eq.foot.privacy": "የምንይዘው",
  "eq.foot.buy": "ብቻዎን መግዛት",
  "eq.reserve.title": "ቦታዎን ይያዙ",
  "eq.reserve.lede": "ሁለት አጭር ደረጃዎች። ከመጀመሪያው በኋላ መረጃዎ ይደርሰናል።",
  "eq.back": "ወደ ቤት እቁብ ይመለሱ",

  /* The simpler abroad page (manual review WS6). */
  "four.label": "አንድ ቤት በአራት መንገድ ይከፍልዎታል፦ ኪራይ፣ የዋጋ ዕድገት፣ በዶላር የተያዘ ንብረት፣ እና ሲመጡ የሚያርፉበት ቦታ።",
  "four.rent": "ኪራይ",
  "four.growth": "የዋጋ ዕድገት",
  "four.dollar": "በዶላር የተያዘ ንብረት",
  "four.stay": "የሚያርፉበት ቦታ",
  "abroad.cta.h": "ሙሉውን ምስል ይመልከቱ",
  "abroad.cta.b": "ምን እንደሚያስወጣ እና ምን ሊያስገኝ እንደሚችል፣ ከመልሶችዎ የተሰላ። መለያ የለም፣ ፓስፖርት መቃኘት የለም።",
  /* The client portal (WS11.6). First pass, unreviewed, like the rest. */
  "pt.with": "ከ{agent} ጋር",
  "pt.account": "መለያ",
  "pt.signout": "ውጣ",
  "pt.lang": "ቋንቋ",
  "pt.english": "በዚህ ገጽ ላይ ያሉ አንዳንድ ዝርዝሮች ለጊዜው በእንግሊዝኛ ናቸው።",
  "pt.tab.today": "ዛሬ",
  "pt.tab.homes": "ቤቶች",
  "pt.tab.offers": "ኦፈሮች",
  "pt.tab.money": "ገንዘብ",
  "pt.tab.documents": "ሰነዶች",
  "pt.tab.help": "እርዳታ",
  "pt.nav": "የቤት ጉዳይዎ",
  "pt.back": "← የቤት ጉዳይዎ",
  "pt.signedAs": "ከ{agent} ጋር · እንደ {name} ገብተዋል ({role})",
  "pt.records": "መዝገቦችዎ",
  "pt.sellerNote": "ሽያጩ እየቀጠለ ሲሄድ {agent} ተጨማሪ መረጃ እዚህ ያጋራል።",
  "pt.today.h": "ዛሬ",
  "pt.today.failed": "የሚጠበቀው ነገር አልተጫነም። ይህ ምንም የሚጠበቅ የለም ማለት አይደለም፤ ትንሽ ቆይተው ገጹን ያድሱ፣ ወይም {agent}ን ይጠይቁ።",
  "pt.today.setup": "ይህ ክፍል እየተዘጋጀ ነው። ቀጥሎ ምን እንደሚመጣ {agent}ን ይጠይቁ።",
  "pt.movein.h": "ወደ ቤቱ መግባት",
  "pt.offers.h": "ኦፈሮች",
  "pt.offers.failed": "ኦፈሮችዎ አልተጫኑም። ይህ ምንም የለም ማለት አይደለም፤ ትንሽ ቆይተው ገጹን ያድሱ።",
  "pt.offers.setup": "ይህ ክፍል እየተዘጋጀ ነው። ስለ ማንኛውም ኦፈር {agent}ን ይጠይቁ።",
  "pt.pri.h": "የፍለጋ ቅድሚያዎችዎ",
  "pt.pri.failed": "ቅድሚያዎችዎ አልተጫኑም። ምንም አልጠፋም፤ ትንሽ ቆይተው ገጹን ያድሱ።",
  "pt.homes.h": "ቤቶች",
  "pt.homes.note": "እርስዎ ወይም {agent} የጨመራችኋቸው ቤቶች። ምላሽ መስጠት ሀሳብዎን ለ{agent} ይነግራል፤ ፍለጋዎን አይቀይርም።",
  "pt.homes.compare": "ጎን ለጎን ያወዳድሩ",
  "pt.homes.failed": "ቤቶቹ አልተጫኑም። ይህ ዝርዝሩ ባዶ ነው ማለት አይደለም፤ ትንሽ ቆይተው ገጹን ያድሱ።",
  "pt.pricing.h": "የዋጋ ውሳኔ",
  "pt.proceeds.h": "የሚቀርልዎት",
  "pt.proceeds.note": "የመዝጊያ ሰነዱ እስኪወጣ ድረስ እነዚህ እቅዶች ናቸው እንጂ በእጅ ያለ ገንዘብ አይደሉም።",
  "pt.money.h": "ገንዘብ",
  "pt.money.note": "ከመዝጊያ በፊት የሚከፍሉት፣ በመዝጊያ ቀን የሚያመጡት፣ እና ከቁጠባዎ የሚቀረው፣ ከ{source} እና {agent} ከመዘገባቸው መጠኖች የተሰላ። እያንዳንዱ መስመር ከየት እንደመጣ ይናገራል።",
  "pt.money.saved": "ያስቀመጡት እቅድ",
  "pt.money.typical": "የተለመዱ የጆርጂያ አሃዞች",
  "pt.money.failed": "ይህ አልተጫነም። ይህ የሚታይ ነገር የለም ማለት አይደለም፤ ትንሽ ቆይተው ገጹን ያድሱ።",
  "pt.docs.h": "ሰነዶች",
  "pt.docs.from": "ከ{agent}",
  "pt.docs.fromNote": "{agent} ያጋራዎት ሁሉ፣ በአንድ ቦታ።",
  "pt.docs.none": "እስካሁን የተጋራ ነገር የለም። {agent} ሰነድ ሲያጋራ እዚህ ይታያል።",
  "pt.docs.yours": "ከእርስዎ",
  "pt.docs.yoursAll": "ከእርስዎ እና አብረውዎት ከሚገዙት",
  "pt.docs.sentFailed": "የላኩት አልተጫነም። ይህ ምንም የለም ማለት አይደለም፤ ትንሽ ቆይተው ገጹን ያድሱ።",
  "pt.docs.nothing": "እስካሁን ምንም የለም።",
  "pt.docs.you": "እርስዎ",
  "pt.questions": "ጥያቄ አለዎት? {agent}ን እንዴት ማግኘት እንደሚችሉ",
  "pt.foot": "ይህን ገጽ ማየት የሚችሉት {agent} የጋበዛቸው ሰዎች ብቻ ናቸው፣ ለእነርሱ የተጋራውን ክፍል ብቻ። እዚህ ያለው ምንም ነገር ውል፣ ኦፈር ወይም የብድር ውሳኔ አይደለም።",

  "pt.help.h": "እርዳታ",
  "pt.help.next": "ቀጥሎ የሚሆነው፦",
  "pt.help.q": "ጥያቄ አለዎት፣ ወይም እዚህ ያለ ነገር የተሳሳተ ይመስላል?",
  "pt.help.emailAt": "ለ{agent} በዚህ አድራሻ ኢሜይል ይላኩ፦",
  "pt.help.orReply": "ወይም ከRift ለመጣ ማንኛውም ኢሜይል መልስ ይስጡ።",
  "pt.help.reply": "ከRift ለመጣ ማንኛውም ኢሜይል መልስ ቢሰጡ {agent} ጋር ይደርሳል።",
  "pt.help.sameDay": "በሥራ ቀናት በዚያው ቀን መልስ ያገኛሉ።",

  "pt.send.btn": "ለ{agent} ሰነድ ይላኩ",
  "pt.send.what": "ምንድን ነው",
  "pt.send.name": "ስም ይስጡት",
  "pt.send.namePh": "ለምሳሌ፣ የመስከረም የባንክ መግለጫ",
  "pt.send.file": "ፋይል",
  "pt.send.note": "PDF፣ JPEG ወይም PNG፣ እስከ 20 MB። ሊከፍቱት የሚችሉት {agent} እና አብረውዎት የሚገዙት ብቻ ናቸው።",
  "pt.send.go": "ላክ",
  "pt.send.cancel": "ተው",
  "pt.send.ready": "በመዘጋጀት ላይ…",
  "pt.send.sending": "በመላክ ላይ…",
  "pt.send.checking": "ፋይሉን በማረጋገጥ ላይ…",
  "pt.send.sent": "ተልኳል። “{label}” {agent} ጋር ደርሷል።",
  "pt.send.failed": "ፋይሉ አልደረሰም። ምንም አልተቀመጠም። እንደገና ይሞክሩ።",
  "pt.send.error": "አልሰራም። እንደገና ይሞክሩ።",
  "pt.kind.preapproval": "የብድር ቅድመ ማረጋገጫ ደብዳቤ",
  "pt.kind.funds": "የገንዘብ ማስረጃ",
  "pt.kind.id": "ፎቶ ያለበት መታወቂያ",
  "pt.kind.other": "ሌላ ነገር",

  "pt.si.title": "ወደ ቤት ጉዳይዎ ይግቡ",
  "pt.si.lede": "ወኪልዎ ለጋበዛቸው ገዢዎችና ሻጮች። የይለፍ ቃልዎን ይጠቀሙ፣ ወይም ሊንክ በኢሜይል እንልክልዎታለን።",
  "pt.si.first": "ለመጀመሪያ ጊዜ ነው?",
  "pt.si.firstBody": "መግቢያው የሚጀምረው ከወኪልዎ በሚመጣ የግብዣ ሊንክ ነው። ይክፈቱት፣ የይለፍ ቃል ይፍጠሩ፣ እና ገብተዋል፤ ከዚያ በኋላ በዚያው ኢሜይል እዚህ ይግቡ። ግብዣ ካልደረስዎት ወኪልዎን ይጠይቁ።",
  "pt.si.out": "ወጥተዋል።",
  "pt.si.expired": "ያ የመግቢያ ሊንክ ጊዜው አልፎበታል ወይም ቀደም ብሎ ጥቅም ላይ ውሏል። ከታች አዲስ ይጠይቁ።",
  "pt.si.missing": "ያ የመግቢያ ሊንክ ያልተሟላ ነበር። ከታች አዲስ ይጠይቁ።",
  "pt.si.otherDevice": "ሊንኩ የተከፈተው ከጠየቀው የተለየ ብሮውዘር ላይ ነው። ከታች አዲስ ይጠይቁ፣ ወይም በይለፍ ቃልዎ ይግቡ።",
  "pt.si.unconfigured": "በዚህ ድረ-ገጽ መግቢያ አሁን አልተዘጋጀም። ወኪልዎ በስልክ ወይም በኢሜይል አሁንም ሊረዳዎት ይችላል።",
  "pt.f.email": "ኢሜይል",
  "pt.f.password": "የይለፍ ቃል",
  "pt.f.signin": "ግባ",
  "pt.f.signingIn": "በመግባት ላይ…",
  "pt.f.sending": "በመላክ ላይ…",
  "pt.f.reset": "የይለፍ ቃል መቀየሪያ ሊንክ ይላኩልኝ",
  "pt.f.link": "የመግቢያ ሊንክ ይላኩልኝ",
  "pt.f.forgot": "የይለፍ ቃልዎን ረሱ?",
  "pt.f.linkInstead": "በምትኩ የመግቢያ ሊንክ ይላኩልኝ",
  "pt.f.withPassword": "በይለፍ ቃል ይግቡ",
  "pt.f.check": "ኢሜይልዎን ይመልከቱ።",
  "pt.f.sentBody": "{email} ተጋብዞ ከሆነ ሊንክ እየመጣ ነው። አንድ ጊዜ ብቻ ይሰራል፣ በማንኛውም መሳሪያ። ከጥቂት ደቂቃዎች በኋላ ምንም ካልደረሰ፣ የስፓም ማህደሩን ይመልከቱ፣ አድራሻው ወኪልዎ ባለው መንገድ መጻፉን ያረጋግጡ፣ ከዚያ ወኪልዎ እንዲያረጋግጥ ይጠይቁ።",
  "pt.f.sentBodyReset": "{email} ተጋብዞ ከሆነ አዲስ የይለፍ ቃል ለመምረጥ የሚያስችል ሊንክ እየመጣ ነው። አንድ ጊዜ ብቻ ይሰራል፣ በማንኛውም መሳሪያ። ከጥቂት ደቂቃዎች በኋላ ምንም ካልደረሰ፣ የስፓም ማህደሩን ይመልከቱ፣ አድራሻው ወኪልዎ ባለው መንገድ መጻፉን ያረጋግጡ፣ ከዚያ ወኪልዎ እንዲያረጋግጥ ይጠይቁ።",
  "pt.f.back": "ወደ መግቢያ ይመለሱ",
  "pt.f.failed": "አልሰራም።",

  "pt.inv.title": "{agent} ወደ “{journey}” ጋብዞዎታል",
  "pt.inv.body": "የፍለጋ ቅድሚያዎችዎን እና {agent} የሚያጋራቸውን ቤቶች ያያሉ፤ ማረጋገጥ፣ ለውጥ መጠየቅ እና ለቤቶች ምላሽ መስጠት ይችላሉ። ይህ ግብዣ ለ{email} ነው።",
  "pt.inv.create": "የይለፍ ቃል ይፍጠሩ",
  "pt.inv.hint": "ቢያንስ {n} ፊደላት። አጭር ሐረግ በደንብ ይሰራል።",
  "pt.inv.join": "ይቀላቀሉ",
  "pt.inv.joining": "በመቀላቀል ላይ…",
  "pt.inv.createJoin": "የይለፍ ቃል ፈጥረው ይቀላቀሉ",
  "pt.inv.noPassword": "የይለፍ ቃል ባይኖርዎት ይመርጣሉ?",
  "pt.inv.haveLogin": "ቀደም ብለው መለያ አለዎት?",
  "pt.inv.emailTo": "የመግቢያ ሊንክ ወደ {email} ይላክ",
  "pt.inv.once": "ሊንኩ አንድ ጊዜ ብቻ ይሰራል፣ በማንኛውም መሳሪያ።",
  "pt.inv.passwordInstead": "በምትኩ የይለፍ ቃል ይፍጠሩ",
  "pt.inv.check": "{email}ን ይመልከቱ።",
  "pt.inv.sent": "የመግቢያ ሊንክ ልከናል። ይክፈቱት፣ ቀጥል የሚለውን ይጫኑ፣ እና ለመቀላቀል በቀጥታ ወደዚህ ይመለሳሉ።",
  "pt.inv.signingOut": "በመውጣት ላይ…",
  "pt.inv.first": "በመጀመሪያ።",

  "pt.acc.title": "መለያዎ",
  "pt.acc.signin": "መግቢያ",
  "pt.acc.as": "የሚገቡት እንደ {email} ነው። የተለየ አድራሻ ለመጠቀም ወኪልዎ እንዲጋብዘው ይጠይቁ፤ መግቢያው የተጋበዘው አድራሻ ነው።",
  "pt.acc.who": "በ“{journey}” ላይ ያሉት",
  "pt.acc.agent": "ወኪልዎ",
  "pt.acc.you": "(እርስዎ)",
  "pt.acc.invited": "ተጋብዘዋል",
  "pt.acc.addRemove": "ሰው ለመጨመር ወይም ለማስወጣት ወኪልዎን ይጠይቁ።",
  "pt.acc.notices": "{agent} አዲስ ነገር ሲያጋራ ወይም የእኔን መልስ ሲፈልግ በኢሜይል ያሳውቁኝ። ኢሜይሉ ምን ዓይነት ነገር እንደሆነ ብቻ ይናገራል፣ ዝርዝሩን አይደለም።",
  "pt.acc.on": "ተቀምጧል። ኢሜይል እንልክልዎታለን።",
  "pt.acc.off": "ተቀምጧል። ከእንግዲህ እነዚህ ኢሜይሎች አይላኩም።",
  "pt.acc.notSaved": "አልተቀመጠም። እንደገና ይሞክሩ።",
  "pt.pw.new": "አዲስ የይለፍ ቃል ይምረጡ",
  "pt.pw.set": "የይለፍ ቃልዎን ያስገቡ ወይም ይቀይሩ",
  "pt.pw.hint": "ቢያንስ {n} ፊደላት። በማንኛውም ጊዜ በኢሜይል ሊንክ መግባት ይችላሉ።",
  "pt.pw.save": "የይለፍ ቃሉን አስቀምጥ",
  "pt.pw.saving": "በማስቀመጥ ላይ…",
  "pt.pw.saved": "የይለፍ ቃሉ ተቀምጧል። በሚቀጥለው ጊዜ ሲገቡ ይጠቀሙበት።",

  "pt.home.title": "የቤት ጉዳይዎ",
  "pt.home.none": "እንደ {email} ገብተዋል፣ ነገር ግን ለዚህ አድራሻ ምንም አልተጋራም። ወኪልዎ የግብዣ ሊንክ ልኮልዎት ከሆነ ይክፈቱት። የሚሰራው ለተላከለት አድራሻ ብቻ ነው።",
  "pt.home.with": "ከ{agent} ጋር",
  "pt.role.buyer": "ገዢ",
  "pt.role.co-buyer": "ተባባሪ ገዢ",
  "pt.role.viewer": "ተመልካች",
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
    /* A string known to say something false (WRONG_IN_AM) is served in
       English until it is retranslated: a true sentence in the wrong script
       is the lesser harm than a false one in the right script. */
    const raw = (locale === "am" && WRONG_IN_AM.includes(key) ? en[key] : d[key]) ?? en[key] ?? key;
    if (!vars) return raw;
    return raw.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  };
}

/** The language a key is actually served in, for the element's lang attribute. */
export const servedIn = (locale: Locale, key: string): Locale => (locale === "am" && WRONG_IN_AM.includes(key) ? "en" : locale);

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

/**
 * The language cookie: the choice made on the abroad or Equb pages carries
 * into the client portal, which is rendered on the server and so cannot read
 * the browser's saved choice. Not a tracking cookie: one of two values.
 */
export const LANG_COOKIE = "rift-lang";
