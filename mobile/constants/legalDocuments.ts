export interface LegalSection {
  id: string;
  title: string;
  body?: string;
  subsections?: {
    subtitle?: string;
    text: string;
  }[];
  bullets?: string[];
  callout?: string;
}

export interface LegalDocument {
  tag: string;
  title: string;
  effectiveDate: string;
  regulatoryStandard: string;
  preambleCallout?: {
    title: string;
    text: string;
  };
  intro: string;
  sections: LegalSection[];
  footer: {
    company: string;
    items: { label: string; value: string }[];
  };
}

export const TERMS_OF_SERVICE_DOC: LegalDocument = {
  tag: "STATUTORY LEGAL DOCUMENT",
  title: "Terms of Service",
  effectiveDate: "July 30, 2026",
  regulatoryStandard: "Federal Republic of Nigeria (NDPA 2023 & CAMA 2020)",
  preambleCallout: {
    title: "IMPORTANT NOTICE REGARDING THIRD-PARTY DATA & PROXY LIABILITY",
    text: "LoraBiz operates strictly as a technological conduit and B2B SaaS platform. If you submit, query, or process any National Identification Number (NIN), Bank Verification Number (BVN), or personal identity data belonging to a third party, you warrant under penalty of perjury and criminal law that you possess explicit, lawful, documented authorization and consent from that individual in strict compliance with the Nigeria Data Protection Act (NDPA) 2023 and the Cybercrimes Act 2015. LoraBiz maintains permanent audit trails and cooperates fully with law enforcement.",
  },
  intro:
    'These Terms of Service ("Terms") constitute a legally binding agreement between you (the "User", "You", or "Your", whether acting in an individual capacity, as a business entity, or as a registration agent/proxy) and LoraBiz ("LoraBiz", "Company", "We", "Us", or "Our"), governing your access to and use of the LoraBiz website, digital applications, APIs, wallets, and processing services (collectively, the "Platform" or "Services").',
  sections: [
    {
      id: "acceptance",
      title: "1. Acceptance of Terms & Capacity",
      subsections: [
        {
          subtitle: "1.1. Enforceability:",
          text: "By creating an account, depositing funds into your wallet, clicking any statutory consent box, or submitting any verification or registration request on LoraBiz, you acknowledge that you have read, understood, and agreed to be unconditionally bound by these Terms, our Privacy Policy, and our Acceptable Use Policy.",
        },
        {
          subtitle: "1.2. Legal Capacity:",
          text: "You warrant that you are at least 18 years of age, legally competent, and possess the requisite corporate, administrative, or personal authority to enter into these Terms. If you are acting on behalf of a corporate entity or another individual, you represent and warrant that you hold full legal power of attorney and statutory mandate to bind that principal.",
        },
        {
          subtitle: "1.3. Rejection of Terms:",
          text: "If you do not agree with any provision of these Terms, you must immediately terminate use of the platform and refrain from accessing any services.",
        },
      ],
    },
    {
      id: "nature",
      title: "2. Nature of Platform & Intermediary Role",
      subsections: [
        {
          subtitle: "2.1. Technological Conduit:",
          text: "LoraBiz operates as an independent, private Business-to-Business (B2B) and Business-to-Consumer (B2C) software infrastructure provider. LoraBiz is NOT a government ministry, department, or statutory agency. We are not the National Identity Management Commission (NIMC), the Corporate Affairs Commission (CAC), the Federal Inland Revenue Service (FIRS), the Special Control Unit Against Money Laundering (SCUML/EFCC), or the Nigeria Inter-Bank Settlement System (NIBSS).",
        },
        {
          subtitle: "2.2. Passive Data Processor Status:",
          text: "In facilitating identity verifications, slip printing, and statutory filings, LoraBiz acts purely as a Data Processor and technical intermediary pursuant to Sections 24 and 25 of the Nigeria Data Protection Act (NDPA) 2023. LoraBiz does not originate, alter, or synthesize government records; we transmit user-initiated queries to accredited technical partners and statutory databases on your direct instruction.",
        },
        {
          subtitle: "2.3. No Guarantee of Government Approval:",
          text: "You acknowledge that the final approval, issuance, or rejection of business registrations (CAC), tax IDs (FIRS), AML certificates (SCUML), or identity status (NIMC) rests solely within the sovereign discretion and administrative processes of the respective government authorities.",
        },
      ],
    },
    {
      id: "accounts",
      title: "3. User Accounts, Security & KYC",
      subsections: [
        {
          subtitle: "3.1. Account Truthfulness:",
          text: "You agree to provide true, accurate, current, and complete registration details, including your legal name, functional email, verifiable phone number, and residential/business address. The creation of anonymous accounts, spoofed credentials, or disposable emails is strictly prohibited.",
        },
        {
          subtitle: "3.2. Credential Confidentiality:",
          text: "You are solely responsible for maintaining the confidentiality of your login passwords, Two-Factor Authentication (2FA) tokens, and wallet transaction PINs. Any action performed through your authenticated account is conclusively presumed to have been authorized by you.",
        },
        {
          subtitle: "3.3. Know-Your-Customer (KYC) & Verification:",
          text: "LoraBiz reserves the right to request additional KYC documentation (including government-issued ID, biometric facial match, utility bills, or proof of accreditation) at any time to verify account ownership or investigate flagged transactions.",
        },
      ],
    },
    {
      id: "wallet",
      title: "4. Digital Wallet & Payment Terms",
      subsections: [
        {
          subtitle: "4.1. Pre-funded Wallet Operations:",
          text: "Services on LoraBiz operate primarily via a pre-funded digital ledger. You must maintain sufficient cleared wallet funds to initiate transactions.",
        },
        {
          subtitle: "4.2. Non-Refundable Statutory Fees:",
          text: "All statutory levies, filing fees, stamp duties, or verification provider charges successfully disbursed to government agency gateways (CAC, FIRS, NIMC, EFCC) or upstream routing providers on your behalf are strictly non-refundable under all circumstances once the request has been submitted to the upstream network.",
        },
        {
          subtitle: "4.3. Wallet Balances & Non-Withdrawal Policy:",
          text: "Funds credited to your LoraBiz wallet are dedicated for service consumption on the platform and are non-withdrawable, except in cases of verified platform errors approved at the sole administrative discretion of LoraBiz.",
        },
      ],
    },
    {
      id: "identity-warranty",
      title: "5. Strict Identity & Proxy Warranty (NIN / BVN / CAC)",
      callout:
        "This clause is an absolute condition of your use of any identity verification, slip printing, or statutory filing service on LoraBiz.",
      subsections: [
        {
          subtitle: "5.1. Affirmation of Sole Ownership or Lawful Proxy Mandate:",
          text: "Whenever you submit an 11-digit National Identification Number (NIN), Bank Verification Number (BVN), Phone Number, or third-party demographic dataset for verification, slip generation, modification, or CAC registration, you solemnly swear and warrant under penalty of criminal prosecution that:",
        },
      ],
      bullets: [
        "You are the sole, lawful owner of the submitted identity credentials; OR",
        "You are an accredited agent, corporate consultant, legal practitioner, or authorized representative who has obtained express, documented, and verifiable consent from the legitimate data subject pursuant to the Nigeria Data Protection Act (NDPA) 2023 (Sections 24, 25 & 29) to process their details for a specific, lawful transaction (such as CAC company incorporation, Tax ID generation, or slip retrieval).",
      ],
      body: "5.2. Prohibition of Unauthorized Lookups & Harassment: You are strictly forbidden from inputting the NIN, BVN, or personal data of any individual without their prior written consent for surveillance, stalking, unlawful background checks, loan shark recoveries, SIM-swap attacks, or any unauthorized profiling. Any such query constitutes a direct criminal breach of the Cybercrimes (Prohibition, Prevention, etc.) Act 2015 and the NDPA 2023.\n\n5.3. Assumption of Sole Liability: You acknowledge and agree that you bear 100% sole civil, criminal, regulatory, and financial liability for any data query, document generation, or business filing initiated under your account. LoraBiz is completely absolved of any responsibility for unauthorized queries conducted by users.",
    },
    {
      id: "fraud-cooperation",
      title: "6. Anti-Fraud & Law Enforcement Surrender",
      subsections: [
        {
          subtitle: "6.1. Permanent Audit Logging:",
          text: "LoraBiz automatically and permanently records immutable audit trails for every transaction and query, including the authenticated User ID, real client IP address, geolocation headers, user-agent fingerprints, exact UTC timestamps, payment references, and statutory consent affirmations.",
        },
        {
          subtitle: "6.2. Automatic Surrender to Regulatory & Police Authorities:",
          text: "You explicitly consent and agree that upon receipt of a formal investigation letter, query, or subpoena from the Economic and Financial Crimes Commission (EFCC), the Nigeria Police Force (NPF), the Department of State Services (DSS), the Nigeria Data Protection Commission (NDPC), the NIMC, or a competent Court of Law regarding suspected identity theft, impersonation, or fraud, LoraBiz shall, without prior notice to you, immediately surrender:",
        },
      ],
      bullets: [
        "Your full account registration KYC details (Name, Email, Phone, Address).",
        "The complete technical IP address and device logs associated with the disputed query.",
        "Your digital wallet funding source, payment references, and transaction history.",
        "The electronic timestamped record of your statutory consent affirmation.",
      ],
      body: "6.3. Platform Witness Status: You acknowledge that in any subsequent criminal prosecution or civil lawsuit arising from unauthorized data processing, LoraBiz will provide all technical logs to substantiate that the query was initiated solely and unilaterally by you.",
    },
    {
      id: "timelines",
      title: "7. Operational Estimates & Agency Outages",
      subsections: [
        {
          subtitle: "7.1. Indicative Timelines:",
          text: "Any processing timelines stated on our platform (e.g. CAC approval in 24 – 72 Working Hours, TIN generation, or NIN verification response times) are operational estimates based on optimal network conditions during standard working hours.",
        },
        {
          subtitle: "7.2. External Government Downtime:",
          text: "LoraBiz shall not be held liable for delays, query backlogs, or temporary failures resulting from government database scheduled maintenance, API downtimes, NIMC server timeouts, CAC portal upgrades, or national internet disruptions.",
        },
      ],
    },
    {
      id: "ip",
      title: "8. Intellectual Property & Proprietary Rights",
      subsections: [
        {
          subtitle: "8.1. Ownership:",
          text: "All software, user interfaces, visual designs, database architectures, graphics, algorithms, brand names, and documentation comprising the LoraBiz platform are the exclusive intellectual property of LoraBiz and are protected under Nigerian copyright, trademark, and intellectual property laws.",
        },
        {
          subtitle: "8.2. Limited License:",
          text: "You are granted a revocable, non-exclusive, non-transferable license to access the platform solely for lawful business operations in accordance with these Terms.",
        },
      ],
    },
    {
      id: "prohibited",
      title: "9. Prohibited Conduct & Scraping Restrictions",
      body: "You strictly agree that you shall NOT:",
      bullets: [
        "Use automated web crawlers, bots, headless browsers, or scripts to extract data, harvest records, or scrape LoraBiz without explicit written API licensing.",
        "Probe, scan, or test the vulnerability of our systems, networks, or API authentication endpoints.",
        "Upload forged, falsified, manipulated, or photoshopped identity documents or corporate records.",
        "Facilitate money laundering, terrorist financing, illicit gambling, or illegal multi-level marketing (MLM) schemes.",
      ],
    },
    {
      id: "liability",
      title: '10. Limitation of Liability & "AS-IS" Disclaimer',
      subsections: [
        {
          subtitle: '10.1. "AS-IS" Provision:',
          text: 'The Services are provided on an "AS-IS" and "AS-AVAILABLE" basis without warranties of any kind, whether express, statutory, or implied.',
        },
        {
          subtitle: "10.2. Cap on Liability:",
          text: "To the maximum extent permitted under applicable Nigerian law, under no circumstances shall LoraBiz, its directors, officers, employees, affiliates, or technical partners be liable for any indirect, punitive, special, incidental, or consequential damages (including loss of profits, business interruption, or loss of data).",
        },
        {
          subtitle: "10.3. Monetary Limit:",
          text: "In all events, the aggregate liability of LoraBiz arising out of or related to your use of the platform shall be strictly limited to the total service fee actually paid by you to LoraBiz for the specific disputed transaction giving rise to the claim.",
        },
      ],
    },
    {
      id: "indemnification",
      title: "11. Comprehensive Indemnification & Hold-Harmless",
      subsections: [
        {
          subtitle: "11.1. Scope of Indemnity:",
          text: "You agree to defend, indemnify, and hold completely harmless LoraBiz, its parent, subsidiaries, affiliates, directors, officers, agents, employees, and licensors from and against any and all claims, liabilities, damages, losses, regulatory penalties, sanctions, fines (including statutory administrative fines levied by the NDPC, NIMC, or CAC), legal fees, and court costs arising out of or relating to:",
        },
      ],
      bullets: [
        "Your breach of these Terms, the Privacy Policy, or the Acceptable Use Policy;",
        "Your unauthorized submission or querying of third-party personal data (NIN, BVN, Phone, etc.) without lawful consent;",
        "Any claim by a data subject alleging that their personal data was unlawfully accessed or processed through your account;",
        "Any fraudulent, falsified, or forged document uploaded by you during CAC or statutory filings;",
        "Your violation of any applicable Nigerian statute, including the NDPA 2023, CAMA 2020, and Cybercrimes Act 2015.",
      ],
      body: "11.2. Direct Legal Costs: In the event that LoraBiz is joined as a party or subpoenaed in any regulatory enforcement or litigation due to your unauthorized conduct, you agree to immediately reimburse LoraBiz for all legal representation and retainers incurred.",
    },
    {
      id: "sanctions",
      title: "12. Liquidated Damages & Account Forfeiture",
      subsections: [
        {
          subtitle: "12.1. Immediate Suspension:",
          text: "LoraBiz reserves the right to immediately suspend, freeze, or permanently terminate your account without notice if we detect suspicious activity, fraud, unauthorized third-party lookups, or regulatory non-compliance.",
        },
        {
          subtitle: "12.2. Forfeiture of Wallet Funds:",
          text: "In the event of confirmed identity fraud, malicious scraping, or criminal submission of falsified documents, any remaining wallet balance shall be forfeited as liquidated damages toward administrative investigation costs and statutory legal expenses, without prejudice to our right to pursue criminal charges.",
        },
      ],
    },
    {
      id: "disputes",
      title: "13. Dispute Resolution & Governing Law",
      subsections: [
        {
          subtitle: "13.1. Governing Law:",
          text: "These Terms shall be governed by and construed in accordance with the substantive laws of the Federal Republic of Nigeria.",
        },
        {
          subtitle: "13.2. Amicable Settlement:",
          text: "The parties shall use good-faith efforts to resolve any dispute or controversy arising out of these Terms through mutual consultation within thirty (30) days of written notice.",
        },
        {
          subtitle: "13.3. Binding Arbitration:",
          text: "Any dispute which cannot be settled amicably shall be submitted to and finally resolved by binding arbitration in accordance with the Arbitration and Mediation Act 2023. The seat of arbitration shall be Lagos, Nigeria, conducted in the English language before a single arbitrator appointed by the Chairman of the Chartered Institute of Arbitrators (UK, Nigeria Branch).",
        },
      ],
    },
    {
      id: "modifications",
      title: "14. Amendments & Severability",
      subsections: [
        {
          subtitle: "14.1. Revisions:",
          text: 'We may revise these Terms from time to time to reflect regulatory updates (including directives from the NDPC, CAC, or NIMC) or enhancements to our platform. The updated version will be indicated by the "Effective Date" at the top.',
        },
        {
          subtitle: "14.2. Severability:",
          text: "If any provision of these Terms is found to be unlawful, void, or unenforceable by an arbitrator or court of competent jurisdiction, that provision shall be deemed severable and shall not affect the validity and enforceability of any remaining provisions.",
        },
      ],
    },
  ],
  footer: {
    company: "LoraBiz (RC Registered in Nigeria)",
    items: [
      { label: "Legal & Regulatory Affairs", value: "legal@lorabiz.com" },
      { label: "Data Protection Officer", value: "dpo@lorabiz.com" },
    ],
  },
};

export const PRIVACY_POLICY_DOC: LegalDocument = {
  tag: "DATA PROTECTION & PRIVACY CHARTER",
  title: "Privacy Policy",
  effectiveDate: "July 30, 2026",
  regulatoryStandard: "Nigeria Data Protection Act (NDPA) 2023 / NDPC",
  intro:
    'LoraBiz ("LoraBiz", "Company", "we", "us", or "our") is dedicated to protecting the fundamental privacy rights and personal data of our users and data subjects in strict compliance with the Nigeria Data Protection Act (NDPA) 2023, General Application and Implementation Directives of the Nigeria Data Protection Commission (NDPC), and applicable international privacy frameworks.',
  sections: [
    {
      id: "overview",
      title: "1. Scope & Regulatory Framework (NDPA 2023)",
      subsections: [
        {
          subtitle: "1.1. Data Controller vs. Data Processor Role:",
          text: "• As a Data Controller: LoraBiz determines the purposes and means of processing personal data directly collected from registered users for account creation, platform billing, KYC, and security management.\n• As a Data Processor: When you use LoraBiz to initiate third-party business registrations (CAC), Tax ID lookups (FIRS), AML filings (SCUML), or identity slip generations (NIMC/NIBSS), LoraBiz acts purely as a Data Processor and Technological Conduit processing data on your explicit lawful instruction and statutory proxy mandate pursuant to Section 24 and Section 25 of the NDPA 2023.",
        },
        {
          subtitle: "1.2. Scope of Application:",
          text: "This Policy applies to all visitors, registered business clients, registration agents, and individual consumers accessing our website, portals, APIs, and digital applications.",
        },
      ],
    },
    {
      id: "collection",
      title: "2. Categories of Personal Data Collected",
      body: "In operating our B2B SaaS and statutory processing infrastructure, we collect and process the following categories of personal information:",
      bullets: [
        "Account & Identity Data: Full legal name, gender, residential address, state, LGA, email address, verifiable phone number, WhatsApp number, encrypted password hash, and profile image.",
        "Statutory Registration Records: National Identification Number (NIN), Bank Verification Number (BVN), Tax Identification Number (TIN), passport photographs, digital specimen signatures, dates of birth, and identity documentation required by statutory bodies (CAC, NIMC, FIRS, EFCC).",
        "Corporate Filing Data: Proposed business names, LLC articles of association, objects of business, director, shareholder, secretary, and Persons with Significant Control (PSC) details.",
        "Financial & Transactional Logs: Wallet transaction ledgers, Paystack payment references, timestamped debit/credit logs, bank account numbers submitted for payouts, and promo code redemptions. (Raw payment card credentials are tokenized and processed exclusively by PCI-DSS certified payment gateways).",
        "Technical & Non-Repudiation Telemetry: Real client IP addresses, browser user-agent signatures, device fingerprints, login timestamps, and statutory consent acceptance timestamps.",
      ],
    },
    {
      id: "lawful-basis",
      title: "3. Lawful Bases for Processing",
      body: "Pursuant to Section 25 of the NDPA 2023, LoraBiz processes your personal data only where at least one of the following lawful bases applies:",
      bullets: [
        "Performance of Contract: Processing necessary to deliver the requested service (e.g. submitting your CAC incorporation application or issuing your verification slip).",
        "Legal & Statutory Obligation: Compliance with Nigerian statutory requirements under CAMA 2020, NIMC Act 2007, Money Laundering (Prevention and Prohibition) Act 2022, and FIRS tax laws.",
        "Explicit Consent: Specific, freely given, informed, and unambiguous statutory consent provided by you (or obtained by you from third-party data subjects as their lawful proxy) prior to initiating identity verification.",
        "Legitimate Interests: Preventing identity theft, maintaining non-repudiation audit trails, thwarting cyberattacks, and protecting the security of our platform.",
      ],
    },
    {
      id: "usage",
      title: "4. Processing Purposes & Verification Caching",
      body: "Your data is used strictly for legitimate, declared operational purposes:",
      bullets: [
        "Transmitting incorporation forms and statutory documents to the Corporate Affairs Commission (CAC).",
        "Routing verification queries to accredited identity gateways (NIMC/NIBSS) to generate verification slip formats.",
        "Managing your digital wallet, executing debit/credit settlements, and issuing transaction receipts.",
        "Enforcing multi-factor authentication (2FA) and mitigating fraudulent account takeovers.",
        "Short-Term Demographic Caching: Verification records generated on user request are retained in an encrypted, authenticated storage bucket for a limited operational window (enabling you to view and download your slip) and subsequent statutory audit trail preservation.",
      ],
    },
    {
      id: "sharing",
      title: "5. Statutory Transmissions & Disclosures",
      body: "LoraBiz maintains a strict NO DATA SALE POLICY. We never sell, monetize, or rent personal data to advertisers or commercial brokers. Personal data is transmitted only to:",
      bullets: [
        "Statutory & Regulatory Bodies: CAC, NIMC, FIRS, and SCUML/EFCC solely for fulfilling user-requested corporate filings and certifications.",
        "Licensed Identity & Payment Partners: PCI-DSS certified payment processors (Paystack) and accredited technical identity routing nodes under strict confidentiality and NDPA-compliant data processing addenda.",
        "Law Enforcement & Judicial Authorities: In accordance with Section 6 of our Terms of Service, where a formal statutory request, court order, or subpoena is received from the EFCC, Nigeria Police Force, DSS, or NDPC in connection with criminal identity theft investigations.",
      ],
    },
    {
      id: "security",
      title: "6. Technical & Organizational Security Safeguards",
      body: "We deploy comprehensive technical and organizational safeguards to protect data against unauthorized disclosure, interception, or destruction:",
      bullets: [
        "Advanced Cryptography: All data in transit is encrypted using TLS 1.3 / HTTPS. Sensitive data at rest (including passwords, tokens, and verification payloads) is secured using AES-256 encryption.",
        "Role-Based Access Control (RBAC): Internal administrative access is strictly restricted to vetted compliance staff on a principle of least privilege, guarded by mandatory Two-Factor Authentication (2FA).",
        "Immutable Audit Trails: Every query, document upload, and administrative action is logged with IP address, device signature, and UTC timestamp to guarantee non-repudiation.",
      ],
    },
    {
      id: "retention",
      title: "7. Data Retention & Erasure Schedule",
      subsections: [
        {
          subtitle: "7.1. Account Data:",
          text: "Retained for the duration of your active account relationship plus five (5) years following account closure to satisfy anti-money laundering (AML) and statutory tax records requirements under Nigerian law.",
        },
        {
          subtitle: "7.2. Identity Query Telemetry:",
          text: "Transaction metadata (User ID, IP address, masked identifier, timestamp, and consent affirmation) is retained for regulatory audit trail compliance with the NDPC and law enforcement authorities.",
        },
        {
          subtitle: "7.3. Secure Purging:",
          text: "Upon expiry of the retention window or upon valid data subject erasure request (where no overriding statutory retention obligation exists), records are permanently shredded or anonymized.",
        },
      ],
    },
    {
      id: "rights",
      title: "8. Data Subject Rights (Sections 34–37 NDPA)",
      body: "Under the Nigeria Data Protection Act 2023, data subjects possess enforceable statutory rights regarding their personal information:",
      bullets: [
        "Right of Access (Section 34): Right to obtain confirmation and a copy of personal data processed by LoraBiz.",
        "Right to Rectification (Section 35): Right to request correction of inaccurate, misleading, or outdated records.",
        "Right to Erasure / 'Right to be Forgotten' (Section 36): Right to request deletion of personal data where processing is no longer lawful or required.",
        "Right to Restrict or Object to Processing (Section 36 & 37): Right to object to automated profiling or marketing communications.",
        "Right to Data Portability (Section 38): Right to receive personal data in a structured, machine-readable format.",
        "Right to Lodge Complaint with NDPC: Right to petition the Nigeria Data Protection Commission (ndpc.gov.ng) if you believe your privacy rights have been infringed.",
      ],
      callout:
        "To exercise any of these rights, submit a formal request to our Data Protection Officer at dpo@lorabiz.com. We process statutory requests within twenty-one (21) days.",
    },
    {
      id: "breach",
      title: "9. 72-Hour Data Breach Notification Protocol",
      body: "Pursuant to Section 40 of the NDPA 2023, in the unlikely event of a security compromise resulting in unauthorized access, alteration, or disclosure of personal data likely to result in risk to data subjects, LoraBiz shall:",
      bullets: [
        "Formally notify the Nigeria Data Protection Commission (NDPC) within seventy-two (72) hours of becoming aware of the breach;",
        "Promptly communicate the nature of the breach, affected datasets, and recommended mitigating steps to affected data subjects;",
        "Execute incident response protocols to contain and neutralize the vulnerability.",
      ],
    },
    {
      id: "dpo",
      title: "10. Data Protection Officer (DPO) Contact",
      body: "LoraBiz has appointed a designated Data Protection Officer (DPO) responsible for overseeing compliance with the NDPA 2023, coordinating with licensed Data Protection Compliance Organizations (DPCO), and serving as the primary point of contact for regulatory authorities and data subjects:",
      callout:
        "Office of the Data Protection Officer\nLoraBiz\nAddress: Lagos State, Nigeria\nDPO Contact Email: dpo@lorabiz.com\nPrivacy Desk: privacy@lorabiz.com",
    },
    {
      id: "cookies",
      title: "11. Cookies, Telemetry & Session Tokens",
      body: "We use essential session tokens and encrypted cookies strictly required for secure authentication, CSRF attack prevention, and platform navigation. We do not use intrusive third-party cross-site advertising cookies.",
    },
    {
      id: "updates",
      title: "12. Policy Governance & Amendments",
      body: "This Privacy Policy is periodically reviewed to reflect regulatory changes enacted by the NDPC or improvements in our data security architecture. Any material updates will be published on this page with an updated Effective Date.",
    },
  ],
  footer: {
    company: "LoraBiz (RC Registered in Nigeria)",
    items: [
      { label: "DPO Email", value: "dpo@lorabiz.com" },
      { label: "Privacy Desk", value: "privacy@lorabiz.com" },
    ],
  },
};
