import fs from 'fs';
import path from 'path';
import { exec, execSync } from 'child_process';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const inspectScriptPath = path.join(__dirname, 'inspect_onnx.py');
const projectVenvDir = path.join(__dirname, '.venv');

export const SUPPORTED_EXTENSIONS = [
  '.onnx',
  '.pt',
  '.pth',
  '.bin',
  '.safetensors',
  '.pkl',
  '.pickle',
  '.joblib',
  '.h5',
  '.keras',
  '.pb',
  '.npy',
  '.gguf'
];

/**
 * Normalizes a file/dir path across Windows (CMD/PowerShell), macOS, and Linux.
 * Handles drag-and-drop quotes, spaces, and ~ home directory.
 */
export function resolveCrossPlatformPath(inputPath) {
  if (!inputPath) return '';
  let cleaned = inputPath.trim().replace(/^['"]|['"]$/g, '');
  if (cleaned.startsWith('~')) {
    cleaned = path.join(os.homedir(), cleaned.slice(1));
  }
  return path.resolve(cleaned);
}

/**
 * Gets the python binary path inside a given virtualenv folder.
 */
export function getVenvPythonPath(venvPath) {
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    const p1 = path.join(venvPath, 'Scripts', 'python.exe');
    const p2 = path.join(venvPath, 'python.exe');
    return fs.existsSync(p1) ? p1 : p2;
  } else {
    const p1 = path.join(venvPath, 'bin', 'python3');
    const p2 = path.join(venvPath, 'bin', 'python');
    return fs.existsSync(p1) ? p1 : p2;
  }
}

/**
 * Finds a working system Python executable across Windows, macOS, Linux.
 */
export function findSystemPython() {
  const isWindows = process.platform === 'win32';
  const candidates = isWindows
    ? ['python', 'python3', 'py -3', 'py']
    : ['python3', 'python'];

  for (const candidate of candidates) {
    try {
      execSync(`${candidate} -c "import sys; sys.exit(0)"`, { stdio: 'ignore' });
      return candidate;
    } catch {
      // Continue searching
    }
  }
  return null;
}

/**
 * Tests if `modelaudit` and `onnx` can be imported by the given Python executable.
 */
export function checkPythonPackages(pythonExec) {
  if (!pythonExec) return { ok: false, missing: ['python'] };

  let modelauditOk = false;
  let onnxOk = false;
  let version = '';

  try {
    version = execSync(`"${pythonExec}" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')"`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return { ok: false, missing: ['python'] };
  }

  try {
    execSync(`"${pythonExec}" -c "import modelaudit"`, { stdio: 'ignore' });
    modelauditOk = true;
  } catch {
    modelauditOk = false;
  }

  try {
    execSync(`"${pythonExec}" -c "import onnx"`, { stdio: 'ignore' });
    onnxOk = true;
  } catch {
    onnxOk = false;
  }

  const missing = [];
  if (!modelauditOk) missing.push('modelaudit');
  if (!onnxOk) missing.push('onnx');

  return {
    ok: missing.length === 0,
    version,
    modelauditOk,
    onnxOk,
    missing
  };
}

/**
 * Ensures Python environment has modelaudit and onnx installed.
 * If missing, automatically creates .venv and installs required packages via pip.
 */
export async function ensurePythonEnvironment(progressCallback) {
  const isWindows = process.platform === 'win32';
  const venvPython = getVenvPythonPath(projectVenvDir);

  // 1. Check if .venv already exists and has packages ready
  if (fs.existsSync(venvPython)) {
    const venvCheck = checkPythonPackages(venvPython);
    if (venvCheck.ok) {
      return {
        pythonPath: venvPython,
        version: venvCheck.version,
        envType: 'venv',
        newlyInstalled: false
      };
    }
  }

  // 2. Check if system Python already has packages installed
  const sysPython = findSystemPython();
  if (sysPython) {
    const sysCheck = checkPythonPackages(sysPython);
    if (sysCheck.ok) {
      return {
        pythonPath: sysPython,
        version: sysCheck.version,
        envType: 'system',
        newlyInstalled: false
      };
    }
  }

  // 3. Packages are missing -> Auto-install in local project .venv
  if (!sysPython) {
    throw new Error(
      `Python 3 tidak ditemukan di sistem (${process.platform}).\n` +
      `Silakan install Python 3 terlebih dahulu:\n` +
      (isWindows
        ? '  - Windows: Buka PowerShell lalu ketik `winget install Python.Python.3` atau download di https://www.python.org\n'
        : '  - macOS/Linux: Jalankan `brew install python` atau `sudo apt install python3 python3-venv python3-pip`\n')
    );
  }

  // Create .venv if it doesn't exist
  if (!fs.existsSync(venvPython)) {
    if (progressCallback) progressCallback('Membuat Python virtual environment (.venv) terisolasi...');
    try {
      execSync(`"${sysPython}" -m venv "${projectVenvDir}"`, { stdio: 'inherit' });
    } catch (err) {
      throw new Error(`Gagal membuat .venv: ${err.message}`);
    }
  }

  const activeVenvPython = getVenvPythonPath(projectVenvDir);
  if (!fs.existsSync(activeVenvPython)) {
    throw new Error(`Binary Python pada virtual environment tidak ditemukan di: ${activeVenvPython}`);
  }

  // Install missing packages
  if (progressCallback) progressCallback('Menginstall package modelaudit & onnx via pip (otomatis)...');
  try {
    await execPromise(`"${activeVenvPython}" -m pip install --upgrade pip`, { maxBuffer: 10 * 1024 * 1024 });
  } catch {
    // Pip upgrade is optional, ignore failure
  }

  try {
    await execPromise(`"${activeVenvPython}" -m pip install modelaudit onnx`, { maxBuffer: 30 * 1024 * 1024 });
  } catch (err) {
    throw new Error(`Gagal menginstall package modelaudit & onnx: ${err.message}`);
  }

  // Final validation
  const finalCheck = checkPythonPackages(activeVenvPython);
  if (!finalCheck.ok) {
    throw new Error(`Verifikasi package gagal: Masih belum terpasang: ${finalCheck.missing.join(', ')}`);
  }

  return {
    pythonPath: activeVenvPython,
    version: finalCheck.version,
    envType: 'venv',
    newlyInstalled: true
  };
}

/**
 * Checks system engine and Python environment readiness.
 */
export function detectEngine() {
  const venvPython = getVenvPythonPath(projectVenvDir);
  if (fs.existsSync(venvPython)) {
    const check = checkPythonPackages(venvPython);
    if (check.ok) {
      return {
        ready: true,
        pythonPath: venvPython,
        version: check.version,
        engineName: 'Local Python Virtual Environment (.venv)',
        envType: 'venv'
      };
    }
  }

  const sysPython = findSystemPython();
  if (sysPython) {
    const check = checkPythonPackages(sysPython);
    if (check.ok) {
      return {
        ready: true,
        pythonPath: sysPython,
        version: check.version,
        engineName: 'System Python Environment',
        envType: 'system'
      };
    }
  }

  return {
    ready: false,
    pythonPath: sysPython || null,
    version: null,
    engineName: 'Package Needs Auto-Install',
    envType: 'unready'
  };
}

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '__pycache__',
  'reports',
  '.venv',
  'venv',
  'dist',
  'build',
  '.git',
  '.idea',
  '.vscode'
]);

/**
 * Recursively discovers all supported ML model files in a directory.
 * Automatically excludes non-model directories like reports/, node_modules/, .venv/, etc.
 */
export function findModelFiles(dirPath, maxDepth = 4, currentDepth = 0) {
  const resolved = resolveCrossPlatformPath(dirPath);
  if (!fs.existsSync(resolved)) return [];

  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    const ext = path.extname(resolved).toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(ext) ? [resolved] : [];
  }

  if (currentDepth > maxDepth) return [];

  let results = [];
  try {
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(resolved, entry.name);
      if (entry.isDirectory()) {
        const lowerName = entry.name.toLowerCase();
        if (!entry.name.startsWith('.') && !EXCLUDED_DIRS.has(lowerName)) {
          results = results.concat(findModelFiles(fullPath, maxDepth, currentDepth + 1));
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          results.push(fullPath);
        }
      }
    }
  } catch (err) {
    console.error(`Error reading ${resolved}: ${err.message}`);
  }

  return results;
}

/**
 * Runs scan on a single model file using the detected local Python environment.
 */
export async function scanModelFile(filePath, pythonPath) {
  const absPath = resolveCrossPlatformPath(filePath);
  const fileName = path.basename(absPath);
  const ext = path.extname(absPath).toLowerCase();
  let fileSize = 0;

  try {
    fileSize = fs.statSync(absPath).size;
  } catch (e) {
    return {
      filePath: absPath,
      fileName,
      success: false,
      error: `File not accessible: ${e.message}`
    };
  }

  let rawJson = null;
  let onnxMeta = null;
  let executionOutput = '';

  // 1. Run modelaudit scan
  const scanCmd = `"${pythonPath}" -m modelaudit scan "${absPath}" --format json`;

  try {
    const stdout = await execPromise(scanCmd, { maxBuffer: 15 * 1024 * 1024 });
    executionOutput = stdout;
    rawJson = extractJsonFromOutput(stdout);
  } catch (err) {
    // ModelAudit may exit with code 1 if issues are found; parse stdout if available
    if (err.stdout) {
      executionOutput = err.stdout;
      rawJson = extractJsonFromOutput(err.stdout);
    } else {
      executionOutput = err.message || '';
    }
  }

  // 2. If it is an ONNX model, inspect structure and metadata
  if (ext === '.onnx' && fs.existsSync(inspectScriptPath)) {
    try {
      const onnxCmd = `"${pythonPath}" "${inspectScriptPath}" "${absPath}"`;
      const onnxOut = await execPromise(onnxCmd, { maxBuffer: 5 * 1024 * 1024 });
      onnxMeta = parseOnnxOutput(onnxOut);
    } catch (e) {
      if (e.stdout) onnxMeta = parseOnnxOutput(e.stdout);
    }
  }

  return formatScanResult({
    filePath: absPath,
    fileName,
    fileSize,
    ext,
    rawJson,
    onnxMeta,
    executionOutput
  });
}

function extractJsonFromOutput(output) {
  if (!output) return null;
  const trimmed = output.trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const jsonCandidate = trimmed.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonCandidate);
    } catch {
      return null;
    }
  }
  return null;
}

function parseOnnxOutput(output) {
  if (!output) return null;
  const meta = {
    valid: output.includes('VALID'),
    irVersion: null,
    producer: null,
    inputs: [],
    outputs: []
  };

  const irMatch = output.match(/IR Version\s*:\s*([^\r\n]+)/i);
  if (irMatch) meta.irVersion = irMatch[1].trim();

  const prodMatch = output.match(/Producer Name\s*:\s*([^\r\n]+)/i);
  const verMatch = output.match(/Producer Version\s*:\s*([^\r\n]+)/i);
  if (prodMatch) {
    meta.producer = `${prodMatch[1].trim()} ${verMatch ? verMatch[1].trim() : ''}`.trim();
  }

  const inputMatches = [...output.matchAll(/•\s*([^\r\n]+shape[^\r\n]+)/gi)];
  for (const m of inputMatches) {
    if (output.indexOf('--- Inputs ---') < output.indexOf(m[0]) &&
        (output.indexOf('--- Outputs ---') === -1 || output.indexOf(m[0]) < output.indexOf('--- Outputs ---'))) {
      meta.inputs.push(m[1].trim());
    } else {
      meta.outputs.push(m[1].trim());
    }
  }

  return meta;
}

function formatScanResult({ filePath, fileName, fileSize, ext, rawJson, onnxMeta, executionOutput }) {
  let riskLevel = 'CLEAN'; // 'CLEAN' | 'INFO' | 'WARNING' | 'CRITICAL'
  let issues = [];
  let totalChecks = 0;
  let passedChecks = 0;
  let failedChecks = 0;
  let durationSec = 0;

  if (rawJson) {
    totalChecks = rawJson.total_checks || 0;
    passedChecks = rawJson.passed_checks || 0;
    failedChecks = rawJson.failed_checks || 0;
    durationSec = typeof rawJson.duration === 'number' ? rawJson.duration.toFixed(2) : '0';

    if (rawJson.issues && Array.isArray(rawJson.issues)) {
      issues = rawJson.issues.map(iss => {
        const severity = (iss.severity || iss.level || 'INFO').toUpperCase();
        return {
          title: iss.message || iss.name || iss.title || 'Security notice',
          description: iss.description || iss.why || '',
          severity: severity,
          details: iss
        };
      });
    }

    // Anomaly checks
    if (rawJson.findings && rawJson.findings.anomalies_found) {
      if (issues.length === 0) {
        issues.push({
          title: 'Weight Distribution Anomaly Detection',
          description: `Found ${rawJson.findings.anomalies_found} neuron(s) with abnormal weight magnitudes.`,
          severity: 'INFO',
          details: rawJson.findings
        });
      }
    }

    if (issues.some(i => i.severity === 'CRITICAL' || i.severity === 'HIGH')) {
      riskLevel = 'CRITICAL';
    } else if (issues.some(i => i.severity === 'MEDIUM' || i.severity === 'WARNING')) {
      riskLevel = 'WARNING';
    } else if (issues.length > 0) {
      riskLevel = 'INFO';
    }
  } else {
    if (executionOutput.includes('CRITICAL') || executionOutput.includes('EXPLOIT')) {
      riskLevel = 'CRITICAL';
    } else if (executionOutput.includes('WARNING') || executionOutput.includes('issue')) {
      riskLevel = 'INFO';
    }
  }

  return {
    filePath,
    fileName,
    fileSizeHuman: formatBytes(fileSize),
    fileSizeBytes: fileSize,
    ext,
    riskLevel,
    totalChecks,
    passedChecks,
    failedChecks,
    durationSec,
    issues,
    onnxMeta,
    rawJson,
    scanTimestamp: new Date().toISOString()
  };
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function execPromise(cmd, options = {}) {
  return new Promise((resolve, reject) => {
    exec(cmd, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

