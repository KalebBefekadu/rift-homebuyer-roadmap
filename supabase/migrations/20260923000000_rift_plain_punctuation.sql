-- ============================================================================
-- Stored copy follows the same punctuation rule as the code: no em dashes.
-- The old text is matched with U&'\2014', so this file does not contain the
-- sign either.
--
-- The code was rewritten on 23 September 2026. These are the rows that carried
-- the old wording into the database: copied from code when they were written
-- (lead score notes, the default question labels, programme conditions) or
-- written by the application as a reason (a delivery log line). Each update
-- names the exact old text, so a row that was edited by hand since is left
-- alone rather than rewritten by a guess.
--
-- Idempotent: once applied, no row matches any WHERE clause below.
-- ============================================================================

update rift_leads
   set signals = replace(signals::text,
         U&'No saving rate given \2014 timeline unknown',
         'No saving rate given, timeline unknown')::jsonb
 where signals::text like U&'%No saving rate given \2014 timeline unknown%';

update rift_leads
   set signals = replace(replace(replace(replace(replace(signals::text,
         U&'No contact details \2014 nothing can be done here', 'No contact details, nothing can be done here'),
         U&'Named \2014 bring them in early', 'Named: bring them in early'),
         U&'No way to reach them \2014 the assessment is all we have', 'No way to reach them; the assessment is all we have'),
         U&'Real, but the money is the constraint \2014 this is a nurture relationship, not a call',
         'Real, but the money is the constraint. This is a nurture relationship, not a call'),
         U&'Nothing to do \2014 waits for them to come back', 'Nothing to do. Waits for them to come back')::jsonb
 where signals::text like U&'%\2014%';

update rift_programs
   set conditions = array_replace(array_replace(conditions,
         U&'Forgiven over a residency period \2014 leaving early can trigger repayment',
         'Forgiven over a residency period; leaving early can trigger repayment'),
         U&'Matched savings requirement \2014 buyer funds are matched at a set ratio',
         'Matched savings requirement: buyer funds are matched at a set ratio')
 where array_to_string(conditions, '|') like U&'%\2014%';

update rift_programs
   set source_note = 'Lender guidance, general'
 where source_note = U&'Lender guidance \2014 general';

update rift_questions
   set options = replace(replace(options::text,
         U&'"Yes \2014 it was where I lived"', '"Yes, it was where I lived"'),
         U&'"Yes \2014 but it was a rental or investment property"', '"Yes, but it was a rental or investment property"')::jsonb
 where options::text like U&'%Yes \2014 %';

update rift_touches
   set detail = 'BREVO_FROM_EMAIL not set; Brevo rejects any send without a verified sender'
 where detail = U&'BREVO_FROM_EMAIL not set \2014 Brevo rejects any send without a verified sender';
