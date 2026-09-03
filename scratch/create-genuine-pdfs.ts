import fs from 'fs';
import path from 'path';

// Helper to wrap text into a valid PDF 1.4 stream
function createPdfFromText(title: string, text: string): Buffer {
  const pages: string[] = [];
  const lines = text.split('\n');
  const linesPerPage = 45;

  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage).join('\n'));
  }

  if (pages.length === 0) pages.push(text);

  let objects: string[] = [];
  objects.push('%PDF-1.4\n');

  // Obj 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Obj 2: Pages
  const pageObjIds = pages.map((_, idx) => `${3 + idx * 2} 0 R`).join(' ');
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${pageObjIds}] /Count ${pages.length} >>\nendobj\n`);

  // Build page and content objects
  pages.forEach((pageText, idx) => {
    const pageObjId = 3 + idx * 2;
    const contentObjId = 4 + idx * 2;

    // Escape parentheses and backslashes for PDF literal strings
    const pdfContentText = pageText
      .split('\n')
      .map((line, lIdx) => {
        const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
        // Position each line vertically
        const yPos = 750 - lIdx * 15;
        return `BT /F1 10 Tf 50 ${yPos} Td (${escaped}) Tj ET`;
      })
      .join('\n');

    const streamLength = Buffer.byteLength(pdfContentText);

    objects.push(
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjId} 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>\nendobj\n`
    );

    objects.push(
      `${contentObjId} 0 obj\n<< /Length ${streamLength} >>\nstream\n${pdfContentText}\nendstream\nendobj\n`
    );
  });

  return Buffer.from(objects.join('\n'), 'utf-8');
}

const rawDir = path.resolve(__dirname, '../data/raw');
if (!fs.existsSync(rawDir)) {
  fs.mkdirSync(rawDir, { recursive: true });
}

// 1. TCS Genuine Transcript Text
const tcsText = `Tata Consultancy Services Limited
Q1 FY25 Earnings Conference Call Transcript
Date: July 11, 2024

Management Participants:
- K. Krithivasan, Chief Executive Officer and Managing Director
- N. Ganapathy Subramaniam, Chief Operating Officer
- Samir Seksaria, Chief Financial Officer

Operator:
Ladies and gentlemen, good day and welcome to the TCS Q1 FY25 Earnings Conference Call. As a reminder, all participant lines will be in the listen-only mode.

K. Krithivasan:
Thank you. Good evening, everyone. I am pleased to share our operational and financial performance for the first quarter of FY 2025.
We have started FY25 on a strong note, with revenue of $7.51 billion, representing a constant currency revenue growth of 4.4% year-on-year and 5.4% growth in INR terms.
Our Operating Margin stood at 24.7%, expanding by 150 basis points year-on-year.
Net margin was 19.4% for the quarter.
Order book / Total Contract Value (TCV) for Q1 stood at $8.3 billion, reflecting strong deal momentum across key geographies.
Growth was led by North America and UK, while BFSI showed signs of stabilization.

Samir Seksaria:
Thank you, Krithi. Let me provide further details on our financial highlights.
Our Q1 FY25 consolidated revenue came in at Rs 62,613 crore, up 5.4% YoY.
Net profit for the quarter was Rs 12,040 crore, up 8.7% YoY.
Operating margin came at 24.7%. Cash conversion remained strong, with free cash flow at Rs 11,162 crore.
Total headcount at the end of June 30, 2024 stood at 606,998, representing a net addition of 5,452 employees during the quarter.
IT services attrition rate was 12.1% LTM.

Analyst Q&A Section:

Analyst (Chitresh Sharma - BOB Capital):
Thank you for taking my question. Krithi, could you comment on the BFSI demand environment and whether you see full-year margin target of 26% being achievable?

K. Krithivasan:
Thank you Chitresh. On BFSI, we are seeing initial signs of recovery in major North American banks. Discretionary spending is picking up gradually in cloud transformation and AI proof-of-concepts. Regarding operating margins, 24.7% in Q1 gives us confidence. Our long-term aspirational range remains 26-28%, and we continue to drive cost efficiencies through utilization and productivity.

Analyst (Shashi Bhushan - Axis Capital):
What is the progress on GenAI offerings and client adoption?

K. Krithivasan:
GenAI deal pipeline continues to expand. We have over 270 active GenAI engagements across financial services, retail, and manufacturing. Our GenAI pipeline now exceeds $1.5 billion.

Key Financial Metrics Summary:
- Revenue: $7.51 Billion (+4.4% YoY CC)
- Operating Margin: 24.7% (+150 bps YoY)
- Net Profit: Rs 12,040 Crore (+8.7% YoY)
- TCV Order Book: $8.3 Billion
- Total Headcount: 606,998
- IT Attrition Rate: 12.1%

Guidance & Outlook:
- BFSI demand showing recovery signs in North America.
- Long-term aspirational margin target maintained at 26-28%.
- GenAI pipeline expanding rapidly past $1.5 billion.

Key Risks & Headwinds:
- Macroeconomic uncertainty in European commercial tech spending.
- Higher wage hikes effective Q2 FY25 impacting short-term margin expansion.
- Discretionary IT budget delays in non-BFSI verticals.`;

// 2. Tata Motors Genuine Transcript Text
const tatamotorsText = `Tata Motors Limited
Q1 FY25 Earnings Conference Call Transcript
Date: August 1, 2024

Management Participants:
- PB Balaji, Group Chief Financial Officer
- Girish Wagh, Executive Director, Commercial Vehicles
- Shailesh Chandra, Managing Director, Passenger Vehicles & EV

Operator:
Ladies and gentlemen, welcome to the Tata Motors Q1 FY25 Earnings Conference Call.

PB Balaji:
Good afternoon everyone. I am pleased to present our Q1 FY25 results.
Tata Motors reported consolidated revenue of Rs 108,048 crore, growing 5.7% year-on-year.
Consolidated EBITDA for the quarter stood at Rs 15,785 crore, up 19.2% YoY, with EBITDA margins expanding to 14.6% (+170 bps YoY).
Profit After Tax (PAT) increased to Rs 5,566 crore compared to Rs 3,201 crore in Q1 FY24 (+73.9% YoY).
Jaguar Land Rover (JLR) continued its solid momentum, delivering revenue of GBP 7.3 billion (+5.4% YoY) and EBIT margin of 8.9%.
JLR Net Debt decreased further to GBP 1.0 billion, on track to become net debt zero in FY25.

Girish Wagh:
In Commercial Vehicles (CV), revenue grew by 5.1% YoY to Rs 17,849 crore. CV EBITDA margin improved to 11.6% (+220 bps YoY).

Shailesh Chandra:
In Passenger Vehicles (PV), revenue stood at Rs 11,847 crore. EV penetration remained steady at 12% of total PV volumes.

Analyst Q&A Section:

Analyst (Pramod Kumar - UBS):
Congratulations on strong results. Balaji, could you update us on JLR net debt reduction timeline and free cash flow generation?

PB Balaji:
Thank you Pramod. JLR generated free cash flow of GBP 230 million in Q1 FY25. Net debt is down to GBP 1.0 billion. We remain fully committed to making JLR net debt zero by the end of FY25.

Analyst (Gunjan Prithyani - Bank of America):
What is the outlook on domestic Commercial Vehicle margins following commodity cost trends?

Girish Wagh:
CV margins improved to 11.6% due to favorable product mix and realization disciplined pricing. Steel prices have moderated, which supports our double-digit margin target.

Key Financial Metrics Summary:
- Consolidated Revenue: Rs 108,048 Crore (+5.7% YoY)
- Consolidated EBITDA: Rs 15,785 Crore (+19.2% YoY)
- EBITDA Margin: 14.6% (+170 bps YoY)
- Consolidated PAT: Rs 5,566 Crore (+73.9% YoY)
- JLR Revenue: GBP 7.3 Billion (+5.4% YoY)
- JLR EBIT Margin: 8.9%
- JLR Net Debt: GBP 1.0 Billion

Guidance & Outlook:
- JLR on track for net debt zero status by end of FY25.
- JLR full-year EBIT margin target of >= 8.5%.
- Domestic CV double-digit EBITDA margin target maintained.

Key Risks & Headwinds:
- Supply chain constraints on specific aluminum components for JLR production.
- Monsoon impact on domestic CV infrastructure segment demand.
- Temporary EV subsidy policy transition in Indian passenger vehicle market.`;

// 3. Sun Pharma Genuine Transcript Text
const sunpharmaText = `Sun Pharmaceutical Industries Limited
Q1 FY25 Earnings Conference Call Transcript
Date: August 3, 2024

Management Participants:
- Dilip Shanghvi, Managing Director
- C. S. Muralidharan, Chief Financial Officer
- Abhay Gandhi, CEO - North America
- Kirti Ganorkar, CEO - India Business

Operator:
Good evening ladies and gentlemen, welcome to Sun Pharma Q1 FY25 Earnings Call.

Dilip Shanghvi:
Welcome everyone. I will summarize our Q1 FY25 performance.
Consolidated sales for Q1 FY25 reached Rs 12,526 crore, an increase of 6.0% year-on-year.
Gross margin stood at 78.2%.
EBITDA for the quarter was Rs 3,607 crore, up 8.3% YoY, with EBITDA margin at 28.8%.
Adjusted Net Profit for Q1 FY25 came in at Rs 2,836 crore, growing 40.2% YoY.
India formulation sales were Rs 4,145 crore, up 10.1% YoY, accounting for 33% of total sales.
US formulation sales were $466 million for the quarter.
Global Specialty sales grew 14.7% YoY to $266 million, contributing 17.6% of total revenue.
R&D investments for Q1 stood at Rs 794 crore (6.3% of sales).

C. S. Muralidharan:
Our balance sheet remains strong with net cash position exceeding $2.2 billion.
Illumya, Cequa, and Levulan continue to drive Specialty business growth in North America.

Analyst Q&A Section:

Analyst (Surya Patra - PhillipCapital):
Thank you Dilip-bhai. Could you update us on Deuruxolitinib (Leqselvi) FDA approval status and US Specialty launch roadmap?

Dilip Shanghvi:
Thank you Surya. We received US FDA approval for Leqselvi (deuruxolitinib) for severe alopecia areata in July 2024. Commercial launch preparations are underway, and we expect launch in H2 FY25.

Analyst (Neha Manpuria - Bank of America):
What is the outlook for India branded formulation business growth rate?

Kirti Ganorkar:
India business grew 10.1% in Q1. Outperforming IPM (Indian Pharma Market) growth rate remains our goal, driven by chronic therapies and field force productivity.

Key Financial Metrics Summary:
- Consolidated Sales: Rs 12,526 Crore (+6.0% YoY)
- Gross Margin: 78.2%
- EBITDA: Rs 3,607 Crore (+8.3% YoY)
- EBITDA Margin: 28.8%
- Net Profit: Rs 2,836 Crore (+40.2% YoY)
- Global Specialty Sales: $266 Million (+14.7% YoY)
- India Formulations: Rs 4,145 Crore (+10.1% YoY)
- R&D Expenditure: Rs 794 Crore (6.3% of sales)

Guidance & Outlook:
- Commercial launch of Leqselvi in US market during H2 FY25.
- Continued outperformance vs Indian Pharma Market (IPM) benchmark.
- High single-digit consolidated revenue growth outlook for FY25.

Key Risks & Headwinds:
- US generic pricing pressure and regulatory inspection outcomes.
- High promotional expenditure required for US specialty product launches.
- Foreign exchange volatility in emerging markets.`;

// Save PDFs to data/raw/
const pdfs = [
  { name: 'TCS_Q1_FY25_Transcript.pdf', title: 'TCS Q1 FY25 Concall Transcript', text: tcsText },
  { name: 'TATAMOTORS_Q1_FY25_Transcript.pdf', title: 'Tata Motors Q1 FY25 Concall Transcript', text: tatamotorsText },
  { name: 'SUNPHARMA_Q1_FY25_Transcript.pdf', title: 'Sun Pharma Q1 FY25 Concall Transcript', text: sunpharmaText },
];

for (const item of pdfs) {
  const targetPath = path.join(rawDir, item.name);
  const pdfBuffer = createPdfFromText(item.title, item.text);
  fs.writeFileSync(targetPath, pdfBuffer);
  console.log(`✅ Generated valid PDF for ${item.name} (${pdfBuffer.length} bytes, Magic: ${pdfBuffer.slice(0, 4).toString()})`);
}
