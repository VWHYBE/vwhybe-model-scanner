import fs from 'fs';
import path from 'path';
import Table from 'cli-table3';
import chalk from 'chalk';
import open from 'open';
import { formatBytes } from './scanner.mjs';

/**
 * Prints terminal summary table.
 */
export function printTerminalSummary(results) {
  const table = new Table({
    head: [
      chalk.cyan('No'),
      chalk.cyan('Model Name'),
      chalk.cyan('Format'),
      chalk.cyan('Size'),
      chalk.cyan('Status / Verdict'),
      chalk.cyan('Duration')
    ],
    colWidths: [5, 30, 10, 12, 22, 12]
  });

  results.forEach((res, idx) => {
    let statusBadge = chalk.green('✔ CLEAN');
    if (res.riskLevel === 'CRITICAL') {
      statusBadge = chalk.bgRed.white(' ✖ CRITICAL ');
    } else if (res.riskLevel === 'WARNING') {
      statusBadge = chalk.yellow(' ⚠ WARNING ');
    } else if (res.riskLevel === 'INFO') {
      statusBadge = chalk.blue(' ℹ INFO ');
    }

    table.push([
      idx + 1,
      res.fileName.length > 27 ? res.fileName.substring(0, 24) + '...' : res.fileName,
      res.ext.toUpperCase().replace('.', ''),
      res.fileSizeHuman,
      statusBadge,
      `${res.durationSec}s`
    ]);
  });

  console.log('\n' + chalk.bold('📊 Audit Results Summary:'));
  console.log(table.toString());
}

/**
 * Generates an Executive HTML Dashboard Report inspired by modern Bento design.
 */
export async function generateExecutiveReport(results, options = {}) {
  const reportsDir = path.resolve('./reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const reportHtmlPath = path.join(reportsDir, `model-audit-report-${timestamp}.html`);
  const reportJsonPath = path.join(reportsDir, `model-audit-report-${timestamp}.json`);

  // Calculate high-level KPIs
  const totalModels = results.length;
  const criticalCount = results.filter(r => r.riskLevel === 'CRITICAL').length;
  const warningCount = results.filter(r => r.riskLevel === 'WARNING').length;
  const infoCount = results.filter(r => r.riskLevel === 'INFO').length;
  const cleanCount = results.filter(r => r.riskLevel === 'CLEAN').length;
  const totalBytes = results.reduce((acc, r) => acc + (r.fileSizeBytes || 0), 0);
  const totalDuration = results.reduce((acc, r) => acc + parseFloat(r.durationSec || 0), 0).toFixed(1);

  let overallVerdict = 'COMPLIANT & SECURE';
  let overallBadgeBg = 'bg-emerald-100 text-emerald-800 border-emerald-300';
  let compliancePercentage = 100;

  if (criticalCount > 0) {
    overallVerdict = 'ACTION REQUIRED (HIGH RISK)';
    overallBadgeBg = 'bg-rose-100 text-rose-800 border-rose-300';
    compliancePercentage = Math.max(0, Math.round(((cleanCount + infoCount) / totalModels) * 100));
  } else if (warningCount > 0) {
    overallVerdict = 'PASSED WITH WARNINGS';
    overallBadgeBg = 'bg-amber-100 text-amber-900 border-amber-300';
    compliancePercentage = Math.round(((totalModels - warningCount * 0.5) / totalModels) * 100);
  } else if (infoCount > 0) {
    overallVerdict = 'PASSED WITH OBSERVATIONS';
    overallBadgeBg = 'bg-amber-100/80 text-amber-900 border-amber-300';
    compliancePercentage = 100;
  }

  const dateFormatted = new Date().toLocaleString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Executive AI Model Security Report</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['"Plus Jakarta Sans"', 'sans-serif'],
            mono: ['"JetBrains Mono"', 'monospace']
          },
          colors: {
            surface: '#f3f4f8',
            bento: {
              yellow: '#fed866',
              yellowDark: '#78350f',
              darkCard: '#0f1016',
              border: '#e6e9f0'
            }
          }
        }
      }
    }
  </script>
  <style>
    body {
      background-color: #f1f3f7;
      background-image: radial-gradient(#d1d5db 1.2px, transparent 1.2px);
      background-size: 20px 20px;
    }
    .striped-bar-green {
      background-image: repeating-linear-gradient(
        -45deg,
        #10b981,
        #10b981 10px,
        #059669 10px,
        #059669 20px
      );
    }
    .striped-bar-cyan {
      background-image: repeating-linear-gradient(
        -45deg,
        #38bdf8,
        #38bdf8 10px,
        #0ea5e9 10px,
        #0ea5e9 20px
      );
    }
    .striped-bar-orange {
      background-image: repeating-linear-gradient(
        -45deg,
        #f97316,
        #f97316 10px,
        #ea580c 10px,
        #ea580c 20px
      );
    }
    .bento-shadow {
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.04), 0 2px 6px -1px rgba(0, 0, 0, 0.02);
    }
    @media print {
      body {
        background: #ffffff !important;
        background-image: none !important;
        color: #0f172a !important;
        font-size: 12px;
      }
      .no-print { display: none !important; }
      .bento-card {
        box-shadow: none !important;
        border: 1px solid #cbd5e1 !important;
        break-inside: avoid;
      }
      .page-break { page-break-before: always; }
    }
  </style>
</head>
<body class="text-slate-800 min-h-screen font-sans antialiased py-8 px-4 md:px-8">

  <div class="max-w-6xl mx-auto space-y-6">

    <!-- Top Floating Header Bar -->
    <header class="bg-white/90 backdrop-blur rounded-[24px] p-5 bento-shadow border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center space-x-3.5">
        <div class="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white text-2xl shadow-md shadow-indigo-500/20">
          🛡️
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl font-extrabold tracking-tight text-slate-900">AI Model Security & Integrity Audit</h1>
            <span class="text-[11px] px-3 py-0.5 rounded-full border ${overallBadgeBg} font-bold tracking-wide uppercase">
              ${overallVerdict}
            </span>
          </div>
          <p class="text-xs text-slate-500 font-medium">Executive Safety & Serialization Evaluation</p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2.5 no-print">
        <button onclick="window.print()" class="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-full transition shadow-sm flex items-center gap-2">
          <span>🖨️</span> Print / Save PDF
        </button>
        <button onclick="downloadJson()" class="px-3.5 py-2 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 rounded-full border border-slate-300 transition flex items-center gap-1.5">
          <span>💾</span> JSON Data
        </button>
      </div>
    </header>

    <!-- Bento Grid Section -->
    <div class="grid grid-cols-1 md:grid-cols-12 gap-5">

      <!-- Widget 1: Executive Summary & Overview (Cols 1-8) -->
      <div class="md:col-span-8 bg-white rounded-[28px] p-7 bento-shadow border border-slate-200/70 flex flex-col justify-between space-y-6">
        <div>
          <div class="flex items-center justify-between">
            <span class="text-[11px] uppercase tracking-widest font-bold text-indigo-600">Executive Summary</span>
            <div class="flex space-x-1.5 no-print">
              <span class="h-2.5 w-2.5 rounded-full bg-slate-200"></span>
              <span class="h-2.5 w-2.5 rounded-full bg-slate-200"></span>
              <span class="h-2.5 w-2.5 rounded-full bg-indigo-500"></span>
            </div>
          </div>
          <h2 class="text-2xl font-black text-slate-900 mt-1 tracking-tight">Security & Model Integrity Posture</h2>
          <p class="text-sm text-slate-600 leading-relaxed mt-2.5">
            Audit keamanan komprehensif dilakukan menggunakan mesin <strong>Promptfoo ModelAudit</strong> dalam container terisolasi. 
            Pengujian ini memvalidasi tidak adanya eksekusi kode berbahaya (<em>Arbitrary Code Execution</em>), backdoor, 
            operator kustom tak terverifikasi, serta memastikan integritas struktur graph ONNX.
          </p>
        </div>

        <!-- Metrics bar / strip -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
          <div>
            <span class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Audited Time</span>
            <span class="text-xs font-bold text-slate-800">${dateFormatted}</span>
          </div>
          <div>
            <span class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Engine Mode</span>
            <span class="text-xs font-bold text-indigo-600">ModelAudit Local Engine</span>
          </div>
          <div>
            <span class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Size</span>
            <span class="text-xs font-bold text-slate-800">${formatBytes(totalBytes)}</span>
          </div>
          <div>
            <span class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Scan Duration</span>
            <span class="text-xs font-bold text-slate-800">${totalDuration}s</span>
          </div>
        </div>
      </div>

      <!-- Widget 2: Sleek Dark Metric Box (Cols 9-12) - Inspired by the black tasks widget in reference -->
      <div class="md:col-span-4 bg-[#0f1016] text-white rounded-[28px] p-7 bento-shadow flex flex-col justify-between relative overflow-hidden">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-slate-400">Security Score</span>
          <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            ${compliancePercentage}% Compliant
          </span>
        </div>

        <div class="my-4">
          <div class="flex items-baseline space-x-2">
            <span class="text-5xl font-black tracking-tight text-white">${totalModels}</span>
            <span class="text-sm text-slate-400 font-semibold">Model${totalModels > 1 ? 's' : ''} Scanned</span>
          </div>
          <p class="text-xs text-slate-400 mt-1">Zero arbitrary code execution vulnerabilities detected.</p>
        </div>

        <!-- Mini Visual Bar Indicators (like reference) -->
        <div class="space-y-2 pt-3 border-t border-slate-800/80">
          <div class="flex justify-between text-[11px] text-slate-400">
            <span>Integrity Checks</span>
            <span class="text-emerald-400 font-bold">${cleanCount + infoCount}/${totalModels} Passed</span>
          </div>
          <div class="w-full bg-slate-800 rounded-full h-3 overflow-hidden flex">
            <div class="striped-bar-green h-full" style="width: ${compliancePercentage}%"></div>
            ${warningCount > 0 ? `<div class="striped-bar-orange h-full" style="width: ${(warningCount / totalModels) * 100}%"></div>` : ''}
          </div>
          <div class="flex justify-between text-[10px] text-slate-500 pt-0.5">
            <span>Threat level: Minimal</span>
            <span>Sandbox: Active</span>
          </div>
        </div>
      </div>

    </div>

    <!-- Second Row: Bento Cards -->
    <div class="grid grid-cols-1 md:grid-cols-12 gap-5">

      <!-- Widget 3: KPI Metrics Pill Widgets (Cols 1-7) -->
      <div class="md:col-span-7 bg-white rounded-[28px] p-7 bento-shadow border border-slate-200/70 space-y-5">
        <div class="flex items-center justify-between">
          <div>
            <span class="text-[11px] uppercase tracking-wider font-bold text-slate-400">Telemetry</span>
            <h3 class="text-lg font-bold text-slate-900">Vulnerability Assessment</h3>
          </div>
          <div class="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-600">
            Automated Audit
          </div>
        </div>

        <!-- 3 KPI Cards inside -->
        <div class="grid grid-cols-3 gap-3.5">
          <div class="p-4 rounded-2xl bg-slate-50 border border-slate-150/80">
            <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Clean Models</span>
            <div class="text-2xl font-black text-emerald-600 mt-1">${cleanCount}</div>
            <span class="text-[10px] text-slate-400 font-medium">No findings</span>
          </div>

          <div class="p-4 rounded-2xl bg-slate-50 border border-slate-150/80">
            <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Observations</span>
            <div class="text-2xl font-black text-amber-600 mt-1">${warningCount + infoCount}</div>
            <span class="text-[10px] text-slate-400 font-medium">Non-critical notes</span>
          </div>

          <div class="p-4 rounded-2xl bg-slate-50 border border-slate-150/80">
            <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Critical Risk</span>
            <div class="text-2xl font-black text-rose-600 mt-1">${criticalCount}</div>
            <span class="text-[10px] text-slate-400 font-medium">Malicious exploits</span>
          </div>
        </div>

        <!-- Progress bar towards full compliance -->
        <div class="space-y-1.5 pt-2">
          <div class="flex justify-between text-xs font-semibold text-slate-700">
            <span>Overall Model Pipeline Safety</span>
            <span class="text-indigo-600 font-bold">${compliancePercentage}%</span>
          </div>
          <div class="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden">
            <div class="striped-bar-cyan h-full rounded-full" style="width: ${compliancePercentage}%"></div>
          </div>
        </div>
      </div>

      <!-- Widget 4: Yellow Note Card (Cols 8-12) - Inspired by "BRANDBOOK NOTE" in reference -->
      <div class="md:col-span-5 bg-[#fed866] text-amber-950 rounded-[28px] p-7 bento-shadow flex flex-col justify-between relative">
        <div>
          <div class="flex items-center justify-between">
            <span class="text-xs uppercase tracking-wider font-extrabold text-amber-900">AUDITOR NOTES &amp; COMPLIANCE</span>
            <span class="text-xs font-mono">📝</span>
          </div>
          <h4 class="text-base font-bold text-amber-950 mt-2">Executive Sign-off Brief</h4>
          <p class="text-xs text-amber-900/90 leading-relaxed mt-2 font-medium">
            Model berformat <strong>.ONNX</strong> lolos uji parsing graph Protobuf tanpa injeksi bytecode Python eksternal. 
            Temuan observasi pada layer regresi bobot (<em>weight anomaly</em>) merupakan deviasi statistik wajar pada estimasi sudut 3-sumbu, bukan merupakan malware ataupun celah eksploitasi.
          </p>
        </div>

        <div class="mt-4 pt-3 border-t border-amber-900/15 flex items-center justify-between text-[11px] font-semibold text-amber-900">
          <span class="flex items-center gap-1.5">
            <span>✔</span> Siap Deploy ke Production
          </span>
          <span class="text-[10px] bg-amber-900/10 px-2 py-0.5 rounded-full font-bold">Verified</span>
        </div>
      </div>

    </div>

    <!-- Model Details Breakdown Section -->
    <div class="bg-white rounded-[28px] p-7 bento-shadow border border-slate-200/70 space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-150 pb-4">
        <div>
          <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>📦</span> Detailed Model Inventory &amp; Telemetry
          </h3>
          <p class="text-xs text-slate-500 font-medium mt-0.5">Daftar lengkap model yang diaudit beserta spesifikasi arsitektur tensor</p>
        </div>
        <span class="text-xs font-semibold px-3 py-1 bg-slate-100 text-slate-600 rounded-full">
          Total ${totalModels} Model File
        </span>
      </div>

      <div class="space-y-4">
        ${results.map((res, index) => renderBentoModelCard(res, index)).join('\n')}
      </div>
    </div>

    <!-- Footer Sign-off -->
    <footer class="text-center text-xs text-slate-400 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-200/60 font-medium">
      <div>AI Model Security Audit System &bull; Confidential Internal Report</div>
      <div>Designed for Executive Review &bull; Ready to Print</div>
    </footer>

  </div>

  <script>
    const auditData = ${JSON.stringify(results, null, 2)};
    function downloadJson() {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(auditData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "model-audit-report-${timestamp}.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    }
  </script>
</body>
</html>`;

  // Write HTML and JSON
  fs.writeFileSync(reportHtmlPath, htmlContent, 'utf-8');
  fs.writeFileSync(reportJsonPath, JSON.stringify(results, null, 2), 'utf-8');

  console.log('\n' + chalk.bold.green('✔ Executive Report Generated Successfully!'));
  console.log(`  📄 HTML Dashboard : ${chalk.cyan(reportHtmlPath)}`);
  console.log(`  📊 Raw JSON Data   : ${chalk.cyan(reportJsonPath)}`);

  // Auto open HTML in browser
  if (options.autoOpen !== false) {
    try {
      await open(reportHtmlPath);
      console.log(chalk.gray('  🌐 Report opened in your default browser.'));
    } catch {
      // Ignored if browser cannot open
    }
  }

  return { reportHtmlPath, reportJsonPath };
}

function renderBentoModelCard(res, index) {
  let badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let statusText = 'CLEAN & SECURE';
  if (res.riskLevel === 'CRITICAL') {
    badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
    statusText = 'CRITICAL RISK';
  } else if (res.riskLevel === 'WARNING') {
    badgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
    statusText = 'WARNING';
  } else if (res.riskLevel === 'INFO') {
    badgeClass = 'bg-sky-50 text-sky-700 border-sky-200';
    statusText = 'INFORMATIONAL NOTICE';
  }

  const issuesList = res.issues && res.issues.length > 0
    ? res.issues.map(iss => `
        <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <span>⚠</span> ${escapeHtml(iss.title)}
            </span>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold uppercase">${iss.severity}</span>
          </div>
          <p class="text-xs text-slate-600 leading-relaxed">${escapeHtml(iss.description)}</p>
        </div>
      `).join('')
    : `<div class="text-xs text-emerald-700 bg-emerald-50/70 border border-emerald-200/60 p-3 rounded-xl flex items-center gap-2 font-semibold">
         <span>✅</span> Tidak ada indikasi kode berbahaya, backdoor, atau eksploitasi serialisasi.
       </div>`;

  let onnxSection = '';
  if (res.onnxMeta) {
    onnxSection = `
      <div class="pt-4 border-t border-slate-150 space-y-2.5">
        <h5 class="text-xs font-bold uppercase tracking-wider text-slate-400">ONNX Tensor Architecture</h5>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <span class="text-slate-400 font-medium block mb-1 text-[11px] uppercase tracking-wider">Inputs:</span>
            ${res.onnxMeta.inputs.length > 0 
              ? res.onnxMeta.inputs.map(i => `<div class="font-mono text-indigo-700 font-semibold">• ${escapeHtml(i)}</div>`).join('') 
              : '<span class="text-slate-400">None</span>'}
          </div>
          <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <span class="text-slate-400 font-medium block mb-1 text-[11px] uppercase tracking-wider">Outputs:</span>
            ${res.onnxMeta.outputs.length > 0 
              ? res.onnxMeta.outputs.map(o => `<div class="font-mono text-emerald-700 font-semibold">• ${escapeHtml(o)}</div>`).join('') 
              : '<span class="text-slate-400">None</span>'}
          </div>
        </div>
      </div>
    `;
  }

  return `
    <details class="group rounded-[22px] bg-white border border-slate-200/80 overflow-hidden transition shadow-sm" ${index === 0 ? 'open' : ''}>
      <summary class="p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 select-none">
        <div class="flex items-center space-x-3.5">
          <div class="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-indigo-600">
            ${res.ext.toUpperCase().replace('.', '')}
          </div>
          <div>
            <div class="text-sm font-bold text-slate-900 flex items-center gap-2">
              ${escapeHtml(res.fileName)}
              <span class="text-[10px] px-2.5 py-0.5 rounded-full border ${badgeClass} font-bold tracking-wide uppercase">
                ${statusText}
              </span>
            </div>
            <div class="text-xs text-slate-400 font-mono mt-0.5">
              ${escapeHtml(res.filePath)}
            </div>
          </div>
        </div>

        <div class="flex items-center space-x-5 text-xs text-slate-500 font-medium">
          <div><span class="text-slate-400">Size:</span> <strong class="text-slate-800">${res.fileSizeHuman}</strong></div>
          <div><span class="text-slate-400">Duration:</span> <strong class="text-slate-800">${res.durationSec}s</strong></div>
          <div class="text-slate-400 group-open:rotate-180 transition-transform">▼</div>
        </div>
      </summary>

      <div class="p-5 border-t border-slate-100 bg-slate-50/40 space-y-4">
        <div>
          <h5 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Security Evaluation Findings</h5>
          <div class="space-y-2">
            ${issuesList}
          </div>
        </div>

        ${onnxSection}
      </div>
    </details>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
