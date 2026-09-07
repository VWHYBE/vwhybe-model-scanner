#!/usr/bin/env node

import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs';
import open from 'open';
import {
  detectEngine,
  ensurePythonEnvironment,
  findModelFiles,
  scanModelFile,
  resolveCrossPlatformPath,
  SUPPORTED_EXTENSIONS
} from './scanner.mjs';
import {
  printTerminalSummary,
  generateExecutiveReport
} from './reporter.mjs';

async function main() {
  console.clear();
  console.log(chalk.bold.cyan(`
  ╔═══════════════════════════════════════════════════════════════╗
  ║            🛡️  AI MODEL SECURITY AUDIT CLI (NPM)              ║
  ║      Deep Security & Integrity Scanner (Promptfoo/ONNX)       ║
  ║      Cross-Platform: Windows (CMD/PowerShell) | Mac | Linux   ║
  ╚═══════════════════════════════════════════════════════════════╝
  `));

  // 1. Ensure Python & Packages (Auto-install if missing)
  const spinner = ora('Memeriksa kesiapan Python & package security...').start();
  let pyEnv;
  try {
    pyEnv = await ensurePythonEnvironment((statusMsg) => {
      spinner.text = statusMsg;
    });
    const label = pyEnv.envType === 'venv' ? 'Virtualenv (.venv terisolasi)' : 'System Python';
    spinner.succeed(chalk.green(`Python Engine Siap: ${chalk.bold(label)} [Python ${pyEnv.version}]`));
    if (pyEnv.newlyInstalled) {
      console.log(chalk.cyan('  ✔ Berhasil memasang package: modelaudit & onnx secara otomatis.'));
    }
  } catch (err) {
    spinner.fail(chalk.red(`Inisialisasi Python gagal: ${err.message}`));
    process.exit(1);
  }
  console.log(chalk.gray(`  📁 Format Didukung: ${SUPPORTED_EXTENSIONS.join(', ')}\n`));

  // 2. Interactive Loop
  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Pilih aksi yang ingin dilakukan:',
        choices: [
          { name: '🔍 Scan Single File Model (e.g. head_pose_model.onnx)', value: 'single' },
          { name: '📁 Bulk Scan Folder (Pindai semua model di dalam folder)', value: 'folder' },
          { name: '📝 Scan Multiple Files (Input beberapa file sekaligus)', value: 'multiple' },
          { name: '🌐 Buka Laporan HTML Terakhir di Browser', value: 'open_report' },
          { name: '⚙️  Cek Status Engine & Sistem', value: 'status' },
          new inquirer.Separator(),
          { name: '🚪 Keluar', value: 'exit' }
        ]
      }
    ]);

    if (action === 'exit') {
      console.log(chalk.cyan('\nTerima kasih telah menggunakan AI Model Security Audit CLI. Sampai jumpa!\n'));
      process.exit(0);
    }

    if (action === 'status') {
      showSystemStatus(pyEnv);
      continue;
    }

    if (action === 'open_report') {
      await openLatestReport();
      continue;
    }

    let filesToScan = [];

    if (action === 'single') {
      const defaultPath = '~/Downloads/head_pose_model.onnx';
      const { targetFile } = await inquirer.prompt([
        {
          type: 'input',
          name: 'targetFile',
          message: 'Masukkan path file model (bisa drag-and-drop file ke sini):',
          default: fs.existsSync(resolveCrossPlatformPath(defaultPath)) ? defaultPath : undefined,
          validate: (val) => {
            const resolved = resolveCrossPlatformPath(val);
            if (!fs.existsSync(resolved)) return `File tidak ditemukan: ${resolved}`;
            return true;
          }
        }
      ]);
      filesToScan = [resolveCrossPlatformPath(targetFile)];
    }

    if (action === 'folder') {
      const { targetDir } = await inquirer.prompt([
        {
          type: 'input',
          name: 'targetDir',
          message: 'Masukkan path folder yang berisi model-model:',
          default: '~/Downloads',
          validate: (val) => {
            const resolved = resolveCrossPlatformPath(val);
            if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
              return `Folder tidak valid atau tidak ditemukan: ${resolved}`;
            }
            return true;
          }
        }
      ]);

      const discoverSpinner = ora(`Mencari model files di ${targetDir}...`).start();
      const discovered = findModelFiles(targetDir);
      discoverSpinner.stop();

      if (discovered.length === 0) {
        console.log(chalk.yellow(`\nTidak ditemukan model dengan ekstensi ${SUPPORTED_EXTENSIONS.join(', ')} di folder tersebut.\n`));
        continue;
      }

      console.log(chalk.green(`\n✔ Ditemukan ${discovered.length} file model:`));
      discovered.forEach((f, idx) => console.log(chalk.gray(`   ${idx + 1}. ${f}`)));

      const { confirmScan } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmScan',
          message: `Lanjutkan pemindaian untuk ${discovered.length} file model ini?`,
          default: true
        }
      ]);

      if (!confirmScan) continue;
      filesToScan = discovered;
    }

    if (action === 'multiple') {
      const { rawInput } = await inquirer.prompt([
        {
          type: 'input',
          name: 'rawInput',
          message: 'Masukkan path file dipisah koma (,) atau spasi:\n>',
          validate: (val) => (val.trim() ? true : 'Path tidak boleh kosong')
        }
      ]);

      const rawPaths = rawInput.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
      for (const p of rawPaths) {
        const resolved = resolveCrossPlatformPath(p);
        if (fs.existsSync(resolved)) {
          filesToScan.push(resolved);
        } else {
          console.log(chalk.yellow(`Peringatan: File diabaikan karena tidak ditemukan: ${p}`));
        }
      }

      if (filesToScan.length === 0) {
        console.log(chalk.red('Tidak ada file valid yang dapat dipindai.'));
        continue;
      }
    }

    // 3. Execute Scanning Sequence
    console.log(chalk.bold.cyan(`\nMemulai pemindaian ${filesToScan.length} model...\n`));
    const results = [];

    for (let i = 0; i < filesToScan.length; i++) {
      const filePath = filesToScan[i];
      const fileName = path.basename(filePath);
      const scanSpinner = ora(`[${i + 1}/${filesToScan.length}] Mengaudit ${fileName}...`).start();

      try {
        const result = await scanModelFile(filePath, pyEnv.pythonPath);
        results.push(result);
        if (result.riskLevel === 'CRITICAL') {
          scanSpinner.fail(chalk.red(`[${i + 1}/${filesToScan.length}] ${fileName}: Ditemukan Potensi Ancaman Kritis`));
        } else if (result.riskLevel === 'WARNING' || result.riskLevel === 'INFO') {
          scanSpinner.warn(chalk.yellow(`[${i + 1}/${filesToScan.length}] ${fileName}: Selesai dengan observasi non-kritis`));
        } else {
          scanSpinner.succeed(chalk.green(`[${i + 1}/${filesToScan.length}] ${fileName}: Aman / Clean`));
        }
      } catch (err) {
        scanSpinner.fail(chalk.red(`[${i + 1}/${filesToScan.length}] ${fileName} Gagal: ${err.message}`));
      }
    }

    // 4. Output Summary & Reports
    printTerminalSummary(results);
    await generateExecutiveReport(results, { autoOpen: true });

    console.log('');
  }
}

function showSystemStatus(pyEnv) {
  console.log(chalk.bold('\n--- Informasi Engine & Lingkungan ---'));
  console.log(`• Platform OS        : ${process.platform} (${process.arch})`);
  console.log(`• Node.js Version    : ${process.version}`);
  console.log(`• Python Executable  : ${chalk.green(pyEnv.pythonPath)}`);
  console.log(`• Python Version     : v${pyEnv.version}`);
  console.log(`• Environment Type   : ${pyEnv.envType === 'venv' ? chalk.cyan('Local Virtualenv (.venv terisolasi)') : chalk.cyan('System Python')}`);
  console.log(`• Dependencies       : ${chalk.green('modelaudit & onnx (Terverifikasi & Siap)')}`);
  console.log(`• Compatibility      : ${chalk.bold.cyan('Windows CMD / PowerShell / macOS / Linux (Pure NPM + Python)')}\n`);
}

async function openLatestReport() {
  const reportsDir = path.resolve('./reports');
  if (!fs.existsSync(reportsDir)) {
    console.log(chalk.yellow('\nBelum ada laporan yang dibuat. Jalankan scan terlebih dahulu.\n'));
    return;
  }
  const files = fs.readdirSync(reportsDir)
    .filter(f => f.endsWith('.html'))
    .map(f => path.join(reportsDir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  if (files.length === 0) {
    console.log(chalk.yellow('\nBelum ada laporan HTML yang ditemukan.\n'));
    return;
  }

  const latest = files[0];
  console.log(chalk.cyan(`\nMembuka laporan: ${latest}`));
  await open(latest);
  console.log(chalk.green('✔ Dibuka di browser default.\n'));
}

main().catch((err) => {
  console.error(chalk.red(`Fatal error: ${err.message}`));
  process.exit(1);
});
