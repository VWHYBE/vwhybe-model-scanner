# 🛡️ AI Model Security & Integrity Audit CLI (Pure NPM)

Aplikasi CLI interaktif berbasis **Node.js / NPM** untuk mengaudit keamanan dan integritas model AI/ML secara mendalam menggunakan mesin **Promptfoo ModelAudit** dan **ONNX Graph Inspector**.

Didesain untuk berjalan **cross-platform tanpa Docker** (Windows CMD, Windows PowerShell, macOS, Linux) dengan fitur **Auto-Installer Package Python**, **Bulk Scanning Folder**, **Interactive TUI**, dan **Executive Bento HTML Dashboard Report** yang siap dicetak ke PDF untuk pelaporan ke atasan.

---

## 🚀 Cara Menjalankan

Masuk ke folder project:
```bash
cd /Users/femto/Worklab/modelscan-testing
```

Install dependensi npm (hanya dilakukan sekali):
```bash
npm install
```

Jalankan UI interaktif:
```bash
npm start
```
*(atau bisa juga `node index.mjs`)*

> **⚡ Auto-Installer Otomatis:**
> Saat pertama kali dijalankan, script akan secara otomatis mengecek apakah package Python (`modelaudit` dan `onnx`) sudah terpasang. Jika belum, script akan otomatis membuat virtual environment `.venv` terisolasi dan menginstall kedua package tersebut via pip tanpa memerlukan setup manual!

---

## 💻 Dukungan Windows (CMD & PowerShell) & Mac / Linux

Aplikasi ini 100% didesain native cross-platform:
- **Windows Friendly**: Mendukung path Windows berkoma/berspasi seperti `C:\Users\Username\Downloads\model.onnx` atau `.\models\`, baik via drag-and-drop terminal, Command Prompt (CMD), maupun PowerShell.
- **Isolasi Tanpa Docker**: Menggunakan local virtualenv (`.venv/`) sehingga tidak mengotori environment global sistem dan tidak memerlukan Docker / container runtime.
- **Non-blocking Interactive TUI**: Menggunakan `inquirer`, `ora`, dan `chalk` yang adaptif pada semua tipe terminal emulator.

---

## ✨ Fitur Utama

### 1. 🎛️ Interactive Terminal UI (TUI)
Menu navigasi interaktif:
- **Scan Single Model File**: Pindai 1 file model spesifik (mendukung drag-and-drop file path).
- **Bulk Scan Folder**: Masukkan path folder (misal `~/Downloads` atau `./models`), tool akan otomatis mencari semua file model dan memindai semuanya secara berurutan dengan progress spinner.
- **Scan Multiple Files**: Masukkan beberapa file sekaligus (dipisahkan koma atau spasi).
- **Buka Laporan Terakhir**: Buka laporan HTML Bento terbaru langsung di browser default.
- **Cek Status Engine**: Memeriksa status Python, virtual environment, dan dependensi security scanner.

### 2. 📁 Format Model yang Didukung (Bulk Scan)
Secara otomatis mendeteksi dan mengaudit 42+ format model:
- **ONNX**: `.onnx` (Graph structure validation, inputs/outputs shape, tensor anomaly)
- **PyTorch**: `.pt`, `.pth`, `.bin`
- **SafeTensors**: `.safetensors`
- **Pickle**: `.pkl`, `.pickle`, `.joblib`
- **Keras / TensorFlow**: `.h5`, `.keras`, `.pb`
- **Lainnya**: `.npy`, `.gguf`

### 3. 📊 Modern Bento Executive Report (Ciamik & PDF Ready)
Setiap selesai scanning, sistem otomatis membuat laporan HTML berestetika **Bento Light Canvas** (`#f1f3f7` dotted background, Plus Jakarta Sans, candy-striped progress bar, dark contrast score box):
- **Executive Verdict**: Ringkasan status model (COMPLIANT / NEEDS REVIEW / HIGH RISK).
- **KPI Metrics Cards**: Total Model, Clean Count, Warning Count, Critical Count, Total Size, dan Durasi.
- **Detailed Findings per Model**:
  - Deteksi Arbitrary Code Execution (injeksi exploit Python/Pickle).
  - Deteksi Backdoor Operators.
  - Deteksi Anomali Distribusi Bobot (*Weight Distribution Anomaly*).
  - Arsitektur Tensor ONNX (Dimensi input citra, output class/regressor, framework pembuat).
- **Tombol "🖨️ Print / Save PDF"**: Sudah terpasang styling `@media print` sehingga saat di-print / Save as PDF melalui browser, tampilan langsung rapi sebagai dokumen laporan manajemen ke atasan.
- **Tombol "💾 Export JSON"**: Untuk kebutuhan compliance teknis dan SIEM integration.

---

## 📂 Struktur File Project
- [`index.mjs`](file:///Users/femto/Worklab/modelscan-testing/index.mjs) — Entry point CLI interaktif & status manager.
- [`scanner.mjs`](file:///Users/femto/Worklab/modelscan-testing/scanner.mjs) — Core engine scanner, auto-installer package (`modelaudit` & `onnx`), dan normalisasi path cross-platform.
- [`reporter.mjs`](file:///Users/femto/Worklab/modelscan-testing/reporter.mjs) — Generator Modern Bento Executive HTML Dashboard & CLI Table.
- [`inspect_onnx.py`](file:///Users/femto/Worklab/modelscan-testing/inspect_onnx.py) — Parser ONNX graph & tensor dimensions.
- [`reports/`](file:///Users/femto/Worklab/modelscan-testing/reports/) — Folder penyimpanan laporan HTML dan JSON.
- [`package.json`](file:///Users/femto/Worklab/modelscan-testing/package.json) — Konfigurasi dependensi NPM.

