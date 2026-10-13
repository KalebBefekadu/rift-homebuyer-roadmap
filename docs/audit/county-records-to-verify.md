# County records to verify

Decision V1 (Kaleb, 13 October 2026): the agent drafts county tax and rent records, and a named
person verifies each one before it reaches a page. This is the checklist. The records live in
`lib/core/county-data.ts`.

**Nothing below is shown to anyone yet.** Every page keeps its planning assumption (property tax
at 1% of the value; the abroad return's assumed rent ratio) and says the county's own figure is
not verified, until a record here is verified.

**How the drafts were made:** from web search summaries of the sources named, on 13 October
2026. The government pages themselves could not be opened from where this was built, so every
figure must be checked at its source. A record with a gap cannot be verified until the gap is
filled.

**How to verify one:** open the source, check every figure against it, fill any gap, then set
`verified: { by: "Your name", on: "YYYY-MM-DD" }` on the record (or ask for it to be done). The
test suite then fails until that county is taken off the list of questions that change nothing in
`lib/core/value-inputs.test.ts`, which is how the change is confirmed to reach the pages.

## Property tax, unincorporated, tax year 2025

Mills are dollars per $1,000 of assessed value; Georgia assesses at 40% of market value, so 30
mills is 1.2% of the value a year.

| County | Drafted total | What was found | Gap before it can be verified | Check at |
| --- | --- | --- | --- | --- |
| Gwinnett | 34.86 mills | County 6.95, schools 18.7, school bond 1.45, recreation 1, fire and EMS 3.2, police 2.9, development 0.36, economic development 0.3 | None known | [Tax Commissioner millage table](https://gwinnetttaxcommissioner.com/property-tax/billing-information/millage-rates) |
| Forsyth | 24.522 mills | County 4.791, fire 2.805, county bond 0.3, schools 15.208, school bond 1.418 | Confirm the fire district covers every unincorporated parcel | [County release, 2025 rates](https://www.forsythco.com/News/forsyth-county-commission-adopts-millage-rates-2025) |
| DeKalb | Incomplete | County, unincorporated, 20.81 | School rate conflicts: 22.78 or 22.88 | [Tax Commissioner, Millage Rates 2025](https://dekalbtaxga.gov/form-doc/millage-rates-2025/) |
| Cobb | Incomplete | County general 8.46, schools 18.7 | Fire, debt service and parks levies missing | Cobb County Tax Commissioner's millage table |
| Fulton | Incomplete | County general 8.87, schools 17.08 | Special districts; most of Fulton is inside a city | [County release, 8.87 mills](https://www.fultoncountyga.gov/News/2025/08/06/Fulton-Holds-Millage-Rate-at-8-87-mills-for-2025) |
| Clayton | Incomplete | County 15.266 net and fire 4.146 (both proposed), schools 19.6 | County rates were proposals; take the adopted ones | Clayton County Tax Commissioner |
| Cherokee | Incomplete | County, parks bond and fire 8.311 (likely 2024) | Year uncertain; school rate not found | County finance, Millage Rate Info; Board of Education |
| Henry | Incomplete | County 15.733 (proposed), schools 20 | School may be 19.8; school bond missing | Henry County Tax Commissioner |

Homestead exemptions are not drafted yet: the unclaimed page uses only the statewide $2,000 off
the assessed value, said as "at least". Each county's own exemptions are the next records to add.

## Fair market rents (HUD), for the abroad return

| Area | Counties | Drafted rents | Gap | Check at |
| --- | --- | --- | --- | --- |
| Atlanta-Sandy Springs-Roswell HUD Metro FMR Area | Fulton, DeKalb, Cobb, Gwinnett, Clayton, Cherokee, Henry, Forsyth, Douglas, Fayette, Rockdale, Paulding, Newton | None recorded | FY2026 two- and three-bedroom were reported as $1,820 and $2,182, and FY2027 as $1,762 and $2,099 from 1 October 2026 (one source). Take all five FY2027 figures and the county list | [HUD User, Fair Market Rents](https://www.huduser.gov/portal/datasets/fmr.html) |
| Savannah MSA | Chatham, Bryan, Effingham | FY2026: studio $1,455, one bedroom $1,533, two $1,680, three $2,235, four $2,547 | FY2027 may have taken effect on 1 October 2026 | [HUD FY2026 schedule](https://www.huduser.gov/portal/datasets/fmr/fmr2026/FY2026_FMR_Schedule.pdf) |

When a rent record is verified, the return uses its three-bedroom rent. The abroad pages still
call the rent an estimate until their copy, `RENT_RATIO_SOURCE` and the test that guards both
are updated together (`lib/core/abroad.test.ts`).
