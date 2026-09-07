# 🛡️ AI Model Security Audit CLI

Tool CLI interaktif untuk memindai keamanan dan integritas file model AI/ML (seperti format `.onnx`, `.pt`, `.safetensors`, `.bin`, `.h5`, `.pkl`, dll.) dari celah keamanan, backdoor, eksploitasi kode, serta anomali bobot, dan langsung menghasilkan laporan HTML siap print ke PDF untuk atasan.

---

## 🚀 Cara Pakai

### 1. Masuk ke Folder Project
```bash
cd /path/to/modelscan-testing
```

### 2. Install Dependensi (Cukup sekali saja)
```bash
npm install
```

### 3. Jalankan Tool
```bash
npm start
```
*(atau bisa pakai `node index.mjs`)*

> **Info:** Script akan otomatis mendeteksi dan menginstall package Python yang diperlukan (`modelaudit` & `onnx`) ke folder `.venv/` lokal saat pertama kali dijalankan.

---

## 📋 Pilihan Menu

Saat tool berjalan, pilih aksi yang diinginkan:
1. **🔍 Scan Single File Model**: Pindai 1 file model (bisa drag-and-drop file langsung ke terminal).
2. **📁 Bulk Scan Folder**: Pindai seluruh model di dalam satu folder sekaligus.
3. **📝 Scan Multiple Files**: Masukkan beberapa path file dipisahkan tanda koma atau spasi.
4. **🌐 Buka Laporan Terakhir**: Langsung membuka laporan HTML audit terbaru di browser.

Hasil audit otomatis tersimpan di folder `reports/` dan laporan HTML akan langsung terbuka di browser setelah scan selesai.

