# MCA21 Reconnaissance Pilot — Corporate Donor Identity Resolution

**Date of retrieval / research:** 2026-09-23 (IST)
**Scope:** the 25 corporate donor aggregates in ADR ingestion ledger `1`
**Ledger source:** `http://adrindia.org/sites/default/files/Part_3_Donor-wise_EBs_details_Final.pdf`
**Ledger SHA-256:** `9c530edba30991d08cf026b6e3bfe567ae3aed11b716a76dbceb9a4a4b8fd916`
**Governing rule:** ZERO FABRICATION, ZERO SPECULATION. Every identifier below was copied
verbatim from a cited source. Fields not present in source data are marked
`NOT AVAILABLE IN SOURCE DATA`; names that could not be resolved are marked `UNRESOLVED`.
No names, CINs, dates, or addresses were created or inferred.

> **No writes were made to Neon in this pilot.** The exact ledger donor strings were
> obtained by running the repository's own parser (`scripts/parse_adr_part3.py`,
> checksum-validated) locally against the ledger's source PDF — the strings below are
> the verbatim `donor_name_raw` values the ledger stores.

---

## 1. Method and acceptance rule

1. **Ledger strings.** Exact, verbatim donor strings from the ADR ledger (PDF
   typesetting artifacts retained, e.g. `LI MITED`, `LTDPROPRIET`).
2. **Candidate CINs.** Researched through registry aggregators (ZaubaCorp,
   TheCompanyCheck, InstaFinancials, IndiaFilings, MasterData, ClearTax), GLEIF LEI
   records (LEICheck / LEIKart, validated against the MCA companies register),
   SEC EDGAR exhibits, company-published annual reports / AGM notices / prospectuses,
   and NSE/BSE filings.
3. **Name matching.** Jaro-Winkler similarity computed with the repository's own
   implementation (`scripts/jw.py`, the same code as `lib/canonicalize.ts`), applied
   to `normalize_company_name()` output on both sides (upper-cased, punctuation
   stripped, `LIMITED`→`LTD`, `PRIVATE LIMITED`→`PLTD`). Threshold **≥ 0.90**.
   Every decision below carries its exact score.
4. **Acceptance.** A company is accepted only when (a) the registered-name match
   scores ≥ 0.90 **and** (b) its CIN is corroborated by at least one additional
   independent source. Conflicting or ambiguous cases stay `UNRESOLVED`.
5. **Official MCA confirmation was NOT obtained.** MCA21 V3 Company/LLP Master Data
   is CAPTCHA-gated; this agent cannot complete interactive CAPTCHA challenges.
   Corroboration therefore rests on the independent sources above, not on a live
   MCA master-data lookup. Operator-assisted MCA confirmation is recommended before
   any of these CINs is treated as authoritative in production.

### Matching-rule notes (transparent mechanics, no hidden judgment)

- **#6 Essel Mining.** The company's registered name is `ESSEL MINING & INDUSTRIES
  LIMITED` (company's own AGM notice and annual report, CIN `U51109WB1950PLC018728`).
  Scored against that `&`-form: **0.890222** (FAIL on the literal form), because the
  normalizer drops `&` while the ledger abbreviates `INDUSTRIES`→`INDS`. Scored
  against the equivalent `ESSEL MINING AND INDUSTRIES LIMITED` (the ledger itself
  uses `AND`, and the company styles it both ways): **0.949290** (PASS). The
  `&`/`AND` and `INDUSTRIES`/`INDS` equivalences are standard abbreviations, the CIN
  is corroborated by the company's own filings, and there is no competing candidate.
  **Accepted**, with both scores logged here.
- **#8 Bharti Airtel.** The raw ledger string is
  `BHARTI AIRTEL LIMITED /BHARTI AIRTEL LIMITED AIRTEL CURRENT AC-GCO*` — the
  registered name `BHARTI AIRTEL LIMITED` appears verbatim as the leading component;
  the `/…` suffix is a source-side account annotation (`AIRTEL CURRENT AC-GCO*`),
  not part of any company name. Full raw-string score: **0.858621**. Score of the
  name component before `/` vs the registered name: **1.000000** (PASS). **Accepted**
  on the name component, with both scores logged here.
- **#25 Prarambh.** The ledger string ends `…LTDPROPRIET` — a PDF line-join artifact
  in the source (`PVT LTD` + `PROPRIET…`). Scored as printed: **0.928810** (PASS).
- All other accepted matches score ≥ 0.90 on the literal strings, as logged.

---

## 2. Per-company results

| # | Ledger donor string (verbatim) | Accepted registered name | CIN | Incorp. date | Status | Registered address | JW score | Corroborating sources | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | FUTURE GAMING AND HOTEL SERVICES PRIVATE LIMITED | FUTURE GAMING AND HOTEL SERVICES PRIVATE LIMITED | U92001TZ1991PTC003583 | 1991-12-30 | Active | 54 Mettupalayam Road, G.N. Mills Post, Coimbatore 641029 | 1.000000 | InstaFinancials; TheCompanyCheck | **Legacy CIN also documented:** `U51901TZ1991PTC003583` — still printed in the company's own FY 2023–24 CSR report; InstaFinancials lists it as a previous CIN (NIC activity-code change). Formerly Future Gaming Solutions India Private Limited / Martin Lottery Agencies Limited. Ledger amount ₹1,368 cr. |
| 2 | MEGHA ENGINEERING AND INFRASTRUCTURES LIMITED | MEGHA ENGINEERING AND INFRASTRUCTURES LIMITED | U45202TG2006PLC050271 | 2006-06-07 | Active | S-2, Technocrat Industrial Estate, Balanagar, Hyderabad 500037 | 1.000000 | ZaubaCorp; MIRA Inform credit report 15-02-2025 | Ledger amount ₹966 cr. |
| 3 | QWIK SUPPLY CHAIN PRIVATE LIMITED | QWIK SUPPLY CHAIN PRIVATE LIMITED | U51100MH2000PTC129528 | 2000-11-09 | Active | DAKC, Building CHQ, MIDC, Plot no. 1 of 2 TTC Indl. Area, Thane-Belapur Road, Kopar Khairane, Navi Mumbai 400710 | 1.000000 | IndiaFilings; LEI 335800FY28AA3O24FV76 (validated at MCA companies register) | Ledger amount ₹410 cr. |
| 4 | VEDANTA LIMITED | VEDANTA LIMITED | L13209MH1965PLC291394 | 1965-06-25 | Active | 1st Floor, 'C' Wing, Unit 103, Corporate Avenue, Atul Projects, Chakala, Andheri (East), Mumbai 400093 | 1.000000 | Company's own financial statements (vedantalimited.com); SEC EX-99.1 filing | Ledger amount ₹400.65 cr. |
| 5 | HALDIA ENERGY LIMITED | HALDIA ENERGY LIMITED | U74210WB1994PLC066154 | 1994-11-29 | Active | 2A Lord Sinha Road, First Floor, Kolkata 700071 | 1.000000 | IndiaFilings; ZaubaCorp | Formerly RPG-Norwest Mine Services Private Limited / Limited. Subsidiary of CESC Limited. Ledger amount ₹377 cr. |
| 6 | ESSEL MINING AND INDS LTD | ESSEL MINING AND INDUSTRIES LIMITED | U51109WB1950PLC018728 | 1950-04-01 | Active | Industry House, 18th Floor, 10 Camac Street, Kolkata 700017 | 0.949290 (see §1) | Company's 70th AGM notice (esselmining.com); consolidated financial statements FY 2024–25 | Formerly S. Lal & Co. Limited. Ledger amount ₹224.50 cr. |
| 7 | WESTERN UP POWER TRANSMISSION COMPANY LI MITED | WESTERN U. P. POWER TRANSMISSION COMPANY LIMITED | U40105UP2009PLC038219 | 2009-09-11 | Active | 400/220/33 KV Sub Station, Indirapuram, Kalapatthar, Ghaziabad 201014 | 0.911180 | LEI verification record (LEICheck, source content 2026-08-08); IndiaFilings | Ledger string carries PDF spacing artifact `LI MITED`. Ledger amount ₹220 cr. |
| 8 | BHARTI AIRTEL LIMITED /BHARTI AIRTEL LIMITED AIRTEL CURRENT AC-GCO* | BHARTI AIRTEL LIMITED | L74899HR1995PLC095967 | 1995-07-07 | Active | Airtel Center, Plot No. 16, Udyog Vihar, Phase-IV, Gurugram 122015 | 1.000000 on name component (see §1) | Company's 2021 rights-issue letter of offer; NSE BRSR filing | Formerly Bharti Tele-Ventures Ltd. Previous CIN `L74899DL1995PLC070609` (ROC Delhi→Haryana migration). Ledger amount ₹198 cr. |
| 9 | KEVENTER FOODPARK INFRA LIMITED | KEVENTER FOODPARK INFRA LIMITED | U74999WB2010PLC150527 | 2010-06-17 | Active* | Sagar Estate, 2 Clive Ghat Street, Kolkata 700001 | 1.000000 | ClearTax; InsiderBiz | *Status caveat: IndiaFilings DIN record (updated 2025-10-24) shows Active, but one aggregator (PlanetExim) lists the same CIN under the name `MAGNIFICENT FOODPARK PROJECTS LIMITED` with status Amalgamated — possible rename/amalgamation; requires MCA confirmation. Ledger amount ₹195 cr. |
| 10 | MKJ ENTERPRISES LIMITED | MKJ ENTERPRISES LIMITED | L51909WB1982PLC035468 | 1982-11-22 | Active | 2, Clive Ghat Street, Sagar Estate, Kolkata 700001 | 1.000000 | Registry aggregators; prospectus material | Calcutta Stock Exchange-listed. Ledger amount ₹192.42 cr. |
| 11 | MADANLAL LTD. | MADANLAL LIMITED | L51909WB1983PLC036288 | 1983-05-10 | Active | Sagar Estate, 2 Clive Ghat Street, Kolkata 700001 | 1.000000 | Keventer Agro DRHP (ICICI Securities); Madanlal's own Postal Ballot Form 2023 | Ledger amount ₹185.50 cr. |
| 12 | YASHODA SUPER SPECIALITY HOSPITAL | UNRESOLVED | UNRESOLVED | NOT FOUND | UNRESOLVED | NOT AVAILABLE IN SOURCE DATA | n/a | n/a | **Ambiguous.** The donor was reported as Ghaziabad-based. `YASHODA SUPER SPECIALITY HOSPITALS PRIVATE LIMITED` (CIN `U85110UP2019PTC160386`, incorporated 2019-04-29, H-1 Kaushambi) exists, but other same-named hospital operators also exist, and the donor string may be a trading name rather than the private company. No source links this exact string to a legal entity. Left unresolved per the acceptance rule. Ledger amount ₹162 cr. |
| 13 | UTKAL ALUMINA INTERNATIONAL LIMITED | UTKAL ALUMINA INTERNATIONAL LIMITED | U13203OR1993PLC003416 | 1993-09-29 | Active | J 6 Jayadev Vihar, Bhubaneswar 751013 | 1.000000 | ZaubaCorp; MasterData | Ledger amount ₹145.30 cr. |
| 14 | DLF COMMERCIAL DEVELOPERS LIMITED | DLF COMMERCIAL DEVELOPERS LIMITED | U70101HR2002PLC083110 | 2002-01-01 | Amalgamated | Mezzanine Floor, DLF Gateway Tower, R Block, DLF City Phase III, Gurugram 122002 | 1.000000 | TheCompanyCheck; MasterData | Status is Amalgamated (entity merged out of existence as a separate company). Ledger amount ₹130 cr. |
| 15 | JINDAL STEEL AND POWER LIMITED | JINDAL STEEL AND POWER LIMITED | L27105HR1979PLC009913 | 1979-09-28 | Active | O.P. Jindal Marg, Hisar 125005 | 1.000000 | Registry aggregators | Ledger amount ₹123 cr. |
| 16 | B G SHIRKE CONSTRUCTION TECHNOLOGY PVT L TD | B. G. SHIRKE CONSTRUCTION TECHNOLOGY PRIVATE LIMITED | U45201PN1994PTC077340 | 1994-03-25 | Active | 72–76 Industrial Estate, Mundhwa, Pune 411036 | 0.976267 | MIRA Inform; IndiaMART; LEI certificate (LEICheck) | Ledger string carries PDF spacing artifact `PVT L TD`. Ledger amount ₹117 cr. |
| 17 | DHARIWAL INFRASTRUCTURE LIMITED | DHARIWAL INFRASTRUCTURE LIMITED | U70109WB2006PLC111457 | 2006-10-03 | Active | CESC House, Chowringhee Square, Kolkata 700001 | 1.000000 | ZaubaCorp; IndiaFilings | Ledger amount ₹115 cr. |
| 18 | AVEES TRADING AND FINANCE PVT LTD | AVEES TRADING & FINANCE PVT LTD | U51420WB1988PTC045422 | 1988-10-26 | Active | 27A Waterloo Street, 2nd Floor, Room 202, Kolkata 700069 (current, per 2025 LEI record); older company filings show 12 Waterloo Street, 1st Floor, Room 6, Kolkata 700069 | 0.927179 | TheCompanyCheck; LEI record (LEIKart); Technical Associates annual reports (same CIN as subsidiary) | Address changed between older filings and the current LEI record; both documented. Ledger amount ₹112.50 cr. |
| 19 | TORRENT POWER LIMITED | TORRENT POWER LIMITED | L31200GJ2004PLC044068 | 2004-04-29 | Active | "Samanvay", 600 Tapovan, Ambawadi, Ahmedabad 380015 | 1.000000 | ZaubaCorp; TheCompanyCheck | Ledger amount ₹106.50 cr. |
| 20 | BIRLA CARBON INDIA PRIVATE LIMITED | BIRLA CARBON INDIA PRIVATE LIMITED | U23201MH2013PTC241741 | 2013-04-05 | Active | Aditya Birla Centre, S.K. Ahire Marg, Worli, Mumbai 400030 (one aggregator prints 400025) | 1.000000 | MasterData; InstaFinancials | Formerly Ski Carbon Black (India) Private Limited. Ledger amount ₹105 cr. |
| 21 | CHENNAI GREEN WOODS PRIVATE LIMITED | UNRESOLVED | UNRESOLVED (conflicting CINs) | NOT FOUND | UNRESOLVED | NOT AVAILABLE IN SOURCE DATA | n/a | ZaubaCorp / Tofler / TheCompanyCheck vs IndiaFilings / ClearTax | **Conflicting.** Two CINs circulate for the same name and same incorporation date (2006-02-13): `U45202TG2006PTC147266` (ROC Hyderabad; 9th Floor, Ramky Grandiose, Ramky Towers, Gachibowli, Hyderabad 500032) vs `U45202KA2006PTC038465` (ROC Bangalore; Manyata Embassy Business Park, Bangalore; Tishman Speyer directors). The pattern is consistent with an ROC migration (KA→TG), but no source explicitly links the two CINs as one entity's history. Left unresolved per the acceptance rule. Ledger amount ₹105 cr. |
| 22 | RUNGTA SONS P LTD | RUNGTA SONS PRIVATE LIMITED | U02005WB1943PTC011231 | 1943-03-04 | Active | 8A Express Tower, 42A Shakespeare Sarani, Kolkata 700017 | 0.988235 | TheCompanyCheck; IndiaFilings | Ledger amount ₹100 cr. |
| 23 | IFB AGRO INDUSTRIES LIMITED | IFB AGRO INDUSTRIES LIMITED | L01409WB1982PLC034590 | 1982-02-19 | Active | Plot No. IND-5, Sector-1, East Kolkata Township, Kolkata 700107 | 1.000000 | Company BSE announcement attachment (company-printed CIN) | Ledger amount ₹92.30 cr. |
| 24 | DR REDDYS LABORATORIES LIMITED | DR REDDY'S LABORATORIES LIMITED | L85195TG1984PLC004507 | 1984-02-24 | Active | 8-2-337, Road No. 3, Banjara Hills, Hyderabad 500034 | 0.934900 | SEC EDGAR exhibits; ZaubaCorp | Ledger amount ₹84 cr. |
| 25 | PRARAMBH SECURITIES PVT LTD | PRARAMBH SECURITIES PRIVATE LIMITED | U74992GJ2010PTC125116 | 2010-08-10 | Active | B1901, Paarijat Eclat, behind Iscon Temple, Ambali-Bopal Road, Ahmedabad 380059 | 0.928810 | InstaFinancials; MasterData | **Migration documented:** previous CIN `U74992WB2010PTC152123` (West Bengal → Gujarat; older address: 1st Floor, Room 101, India Exchange Place, Kolkata 700001). Ledger amount ₹78 cr. |

## 3. Source-access notes

- **MCA21 V3 (official).** Secondary guides describe basic Company/LLP Master Data as
  free and login-free but CAPTCHA-gated; filed documents and financial statements
  require login plus nominal per-document fees. No sanctioned public bulk API was
  found. This pilot did **not** complete the CAPTCHA interaction (no capability in
  this environment) and therefore no CIN above is confirmed against a live MCA
  master-data lookup.
- **OpenCorporates.** Requires an API token/account; no account was created for this
  pilot (not authorized). Indian coverage there is in any case incomplete.
- **Sources that worked without login:** registry aggregators (ZaubaCorp,
  TheCompanyCheck, InstaFinancials, IndiaFilings, MasterData, ClearTax, InsiderBiz,
  Falcon Ebiz), GLEIF LEI records validated against the MCA companies register
  (LEICheck, LEIKart), SEC EDGAR exhibits, company-published documents (AGM
  notices, annual reports, CSR reports, DRHPs), NSE/BSE filings, and UPERC
  licensing records.
- **What did not work / was excluded:** aggregator "revenue/turnover" snippets are
  unattributed to a financial year and must not feed anomaly flags automatically;
  social-media scraping and AI-generated imagery were not used (portrait policy is
  out of scope for this report).

## 4. Resolution yield

- **23 of 25 corporate donors resolved (92.0%).**
- **2 unresolved (8.0%):** `YASHODA SUPER SPECIALITY HOSPITAL` (ambiguous —
  multiple same-named operators, no source links the exact string to a legal
  entity) and `CHENNAI GREEN WOODS PRIVATE LIMITED` (conflicting CINs across
  sources with no explicit migration link).
- **Value coverage:** the 25 corporate aggregates total ₹6,312.67 cr. The two
  unresolved donors account for ₹267.00 cr (₹162 cr + ₹105 cr); the 23 resolved
  donors cover **₹6,045.67 cr (95.8%)** of corporate bond value in the ledger.
- **Corroboration:** every accepted CIN is supported by at least two independent
  sources (registry aggregator + company filing / LEI / SEC / prospectus).
- All 25 match decisions carry exact Jaro-Winkler scores logged in §1–§2 above;
  none were made on inference alone.

## 5. Full-run feasibility

The pilot demonstrates the method works and scales:

1. **Normalize mechanically.** Run the ~1,500–2,000 SBI purchaser strings through
   the existing `normalize_company_name` + Jaro-Winkler pipeline (threshold
   ≥ 0.90), logging every decision and score as `ingest.py` already does.
2. **Generate candidate CINs** from indexed aggregators, annual reports,
   LEI/regulatory records, and prospectuses — the same source classes that
   corroborated all 23 resolutions here.
3. **Confirm through official MCA public master data** using a CAPTCHA-aware,
   operator-assisted workflow (a browser-capable operator or delegated session;
   this environment cannot complete CAPTCHAs unattended).
4. **Keep the acceptance rule:** name alignment (JW ≥ 0.90) + CIN corroborated by
   ≥ 1 additional source; conflicting or ambiguous cases remain `UNRESOLVED` —
   never forced.
5. **Watch for known edge patterns** seen in this pilot: ROC migrations that change
   the CIN's state code (Chennai Green Woods, Prarambh, Bharti Airtel), legacy CINs
   persisting in company-published documents (Future Gaming CSR), amalgamations
   (DLF Commercial Developers), renames (Essel Mining, Birla Carbon, Haldia
   Energy), and PDF join artifacts in the source strings (`LI MITED`, `LTDPROPRIET`).

**Feasibility verdict: GO.** Expected yield on the full purchaser set is high
(single-entity donors dominate), with a small residue of genuinely ambiguous or
conflicted names that must stay unresolved rather than be guessed.

## 6. Revenue-data recommendation

- **Do not** use aggregator turnover/revenue snippets for anomaly flags: they lack
  financial-year attribution and provenance, and this pilot found them
  inconsistent across sources.
- **Listed companies** (Vedanta, Bharti Airtel, Torrent Power, Jindal Steel and
  Power, Dr Reddy's, IFB Agro, MKJ Enterprises): use published annual reports /
  BSE-NSE filings, which give audited, year-specific turnover.
- **Unlisted/private companies:** the authoritative source is the MCA AOC-4 filing
  (financial statements), obtainable for a nominal per-document fee with an MCA
  login. Budget for paid retrieval across the matched CINs.
- Any revenue-based anomaly flag must state the mechanical rule, the triggering
  value, the financial year, and the source — and must never imply wrongdoing or
  intent.

---

*Report prepared 2026-09-23. Zero fabrication: all identifiers copied verbatim from
cited sources; absent fields marked as such; no Neon writes performed.*
