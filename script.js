const storageKey = "arsipTubanCertificates";
const authTokenKey = "arsipTubanAccessToken";
const apiBase = "/api";
const sessionPdfUrls = new Map();
let backendReady = false;

function generateId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const seedData = [
  {
    id: generateId(),
    nomor: "SH-PK/2026/014",
    nama: "Tanah Kantor Pelayanan",
    opd: "Sekretariat Daerah",
    kecamatan: "Semanding",
    kelurahan: "Gedongombo",
    lokasi: "Semanding, Tuban",
    luas: "1.250 m2",
    tahun: "2026",
    status: "Hak Pakai",
    keterangan: "Data awal demo",
    pdfName: "sertifikat-semanding.pdf",
    hasPdf: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: generateId(),
    nomor: "SH-PK/2025/118",
    nama: "Lahan Fasilitas Umum",
    opd: "Sekretariat Daerah",
    kecamatan: "Merakurak",
    kelurahan: "Tegalrejo",
    lokasi: "Merakurak, Tuban",
    luas: "840 m2",
    tahun: "2025",
    status: "Hak Pakai",
    keterangan: "Menunggu verifikasi file",
    pdfName: "",
    hasPdf: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: generateId(),
    nomor: "SH-PK/2024/331",
    nama: "Gedung Arsip Daerah",
    opd: "Dinas Perpustakaan dan Kearsipan",
    kecamatan: "Tuban",
    kelurahan: "Latsari",
    lokasi: "Tuban Kota",
    luas: "2.100 m2",
    tahun: "2024",
    status: "Hak Pakai",
    keterangan: "Lengkap",
    pdfName: "gedung-arsip-daerah.pdf",
    hasPdf: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: generateId(),
    nomor: "SH-PK/2023/087",
    nama: "Tanah Puskesmas",
    opd: "Dinas Kesehatan",
    kecamatan: "Jenu",
    kelurahan: "Beji",
    lokasi: "Jenu, Tuban",
    luas: "1.780 m2",
    tahun: "2023",
    status: "Hak Pakai",
    keterangan: "Arsip lama",
    pdfName: "puskesmas-jenu.pdf",
    hasPdf: true,
    createdAt: new Date().toISOString(),
  },
];

let certificateData = loadCertificates();
let selectedPdf = null;
let editingId = null;

const authPage = document.querySelector("#authPage");
const appShell = document.querySelector("#appShell");
const loginForm = document.querySelector("#loginForm");
const logoutButton = document.querySelector("#logoutButton");
const accountButton = document.querySelector("#accountButton");
const accountDropdown = document.querySelector("#accountDropdown");
const accountLogoutButton = document.querySelector("#accountLogoutButton");
const togglePassword = document.querySelector("#togglePassword");
const passwordInput = document.querySelector("#password");
const passwordIcon = document.querySelector("#passwordIcon");
const certificateForm = document.querySelector("#certificateForm");
const certificateRows = document.querySelector("#certificateRows");
const searchInput = document.querySelector("#searchInput");
const opdFilter = document.querySelector("#opdFilter");
const districtFilter = document.querySelector("#districtFilter");
const statusFilter = document.querySelector("#statusFilter");
const sidebar = document.querySelector(".sidebar");
const menuToggle = document.querySelector("#menuToggle");
const pdfFile = document.querySelector("#pdfFile");
const pdfFileName = document.querySelector("#pdfFileName");
const previewPdfButton = document.querySelector("#previewPdfButton");
const focusFormButton = document.querySelector("#focusFormButton");
const resetFormButton = document.querySelector("#resetFormButton");
const saveCertificateButton = document.querySelector("#saveCertificateButton");
const certificateDialog = document.querySelector("#certificateDialog");
const certificateDialogTitle = document.querySelector("#certificateDialogTitle");
const closeFormButton = document.querySelector("#closeFormButton");
const pdfDialog = document.querySelector("#pdfDialog");
const pdfDialogTitle = document.querySelector("#pdfDialogTitle");
const pdfViewer = document.querySelector("#pdfViewer");
const closePdfButton = document.querySelector("#closePdfButton");
const emptyState = document.querySelector("#emptyState");
const toast = document.querySelector("#toast");

function loadCertificates() {
  const storedData = localStorage.getItem(storageKey);

  if (!storedData) {
    localStorage.setItem(storageKey, JSON.stringify(seedData));
    return seedData;
  }

  try {
    const parsedData = JSON.parse(storedData).map((item) => ({ ...item, status: "Hak Pakai" }));
    localStorage.setItem(storageKey, JSON.stringify(parsedData));
    return parsedData;
  } catch {
    localStorage.setItem(storageKey, JSON.stringify(seedData));
    return seedData;
  }
}

function saveCertificates() {
  localStorage.setItem(storageKey, JSON.stringify(certificateData));
}

function mapApiCertificate(row) {
  return {
    id: row.id,
    nomor: row.nomor,
    nama: row.nama,
    opd: row.opd || "Belum ada OPD",
    kecamatan: row.kecamatan,
    kelurahan: row.kelurahan,
    lokasi: row.lokasi,
    luas: row.luas,
    tahun: String(row.tahun),
    status: row.status || "Hak Pakai",
    keterangan: row.keterangan || "",
    pdfName: row.pdf_name || "",
    hasPdf: Boolean(row.has_pdf),
    localPdfUrl: row.local_pdf_url || "",
    createdAt: row.created_at,
  };
}

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem(authTokenKey);
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Permintaan backend gagal.");
  }

  return data;
}

async function loadBackendCertificates() {
  try {
    const response = await apiRequest("/certificates");
    certificateData = response.data.map(mapApiCertificate);
    backendReady = true;
    saveCertificates();
    renderAll();
  } catch {
    backendReady = false;
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Gagal membaca file PDF."));
    reader.readAsDataURL(file);
  });
}

async function buildApiPayload(item) {
  const payload = {
    id: editingId,
    nomor: item.nomor,
    nama: item.nama,
    opd: item.opd,
    kecamatan: item.kecamatan,
    kelurahan: item.kelurahan,
    lokasi: item.lokasi,
    luas: item.luas,
    tahun: item.tahun,
    status: "Hak Pakai",
    keterangan: item.keterangan,
  };

  if (selectedPdf) {
    payload.pdf = {
      filename: selectedPdf.name,
      mimeType: selectedPdf.type,
      base64Data: await readFileAsBase64(selectedPdf),
    };
  }

  return payload;
}

function showApp() {
  authPage.classList.add("hidden");
  appShell.classList.remove("hidden");
  renderAll();
  loadBackendCertificates();
}

function showLogin() {
  appShell.classList.add("hidden");
  authPage.classList.remove("hidden");
}

function setActiveSection(target) {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.target === target);
  });
  document.querySelectorAll(".content-section").forEach((section) => {
    section.classList.toggle("active", section.id === target);
  });
  sidebar.classList.remove("open");
}

function getFilteredRows() {
  const keyword = searchInput.value.trim().toLowerCase();
  const selectedOpd = opdFilter.value;
  const selectedDistrict = districtFilter.value;
  const status = statusFilter.value;

  return getUploadedCertificates().filter((item) => {
    const matchesKeyword = Object.values(item).some((value) => String(value).toLowerCase().includes(keyword));
    const matchesOpd = selectedOpd === "Semua OPD" || item.opd === selectedOpd;
    const matchesDistrict = selectedDistrict === "Semua Kecamatan" || item.kecamatan === selectedDistrict;
    const matchesStatus = status === "Semua Status" || item.status === status;
    return matchesKeyword && matchesOpd && matchesDistrict && matchesStatus;
  });
}

function getUploadedCertificates() {
  return certificateData.filter((item) => item.hasPdf);
}

function renderRows(rows) {
  certificateRows.innerHTML = rows
    .map((item) => {
      const statusClass = String(item.status || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-");
      const pdfLabel = item.pdfName || "Belum ada";
      const canPreview = sessionPdfUrls.has(item.id) || Boolean(item.localPdfUrl);
      const escapedId = escapeHtml(item.id);

      return `
        <tr>
          <td><strong>${escapeHtml(item.nomor)}</strong></td>
          <td>${escapeHtml(item.nama)}</td>
          <td>${escapeHtml(item.opd || "Belum ada OPD")}</td>
          <td>${escapeHtml(item.kecamatan)}</td>
          <td>${escapeHtml(item.lokasi)}</td>
          <td>${escapeHtml(item.tahun)}</td>
          <td><span class="status-badge ${statusClass}">${escapeHtml(item.status)}</span></td>
          <td>${escapeHtml(pdfLabel)}</td>
          <td>
            <div class="table-actions">
              <button class="soft-button small" type="button" data-action="preview" data-id="${escapedId}" ${canPreview ? "" : "disabled"}>Preview</button>
              <button class="soft-button small" type="button" data-action="edit" data-id="${escapedId}">Edit</button>
              <button class="soft-button small danger" type="button" data-action="delete" data-id="${escapedId}">Hapus</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  emptyState.classList.toggle("hidden", rows.length > 0);
}

function renderDashboard() {
  const uploadedCertificates = getUploadedCertificates();
  const total = uploadedCertificates.length;
  const totalPdfs = uploadedCertificates.length;
  const districtCount = new Set(uploadedCertificates.map((item) => item.kecamatan).filter(Boolean)).size;
  const opdCount = new Set(uploadedCertificates.map((item) => item.opd).filter(Boolean)).size;
  const pdfPercentValue = total ? Math.round((totalPdfs / total) * 100) : 0;

  document.querySelector("#totalCertificates").textContent = total;
  document.querySelector("#totalOpd").textContent = opdCount;
  document.querySelector("#totalDistricts").textContent = districtCount;
  document.querySelector("#statusMeter").style.width = `${pdfPercentValue}%`;
  document.querySelector("#statusSummary").textContent =
    `${pdfPercentValue}% arsip sudah lengkap dengan data metadata dan scan PDF.`;

  const latestRows = uploadedCertificates.slice(-3).reverse();
  document.querySelector("#activityList").innerHTML = latestRows.length
    ? latestRows
        .map((item) => `<li><b>${escapeHtml(item.nomor)}</b><span>${escapeHtml(item.nama)} - ${escapeHtml(item.opd || "Belum ada OPD")}</span></li>`)
        .join("")
    : "<li><b>Belum ada aktivitas</b><span>Tambah data sertifikat untuk mulai mencatat arsip.</span></li>";
}

function syncFilterOptions() {
  const currentOpd = opdFilter.value || "Semua OPD";
  const currentDistrict = districtFilter.value || "Semua Kecamatan";
  const rows = getUploadedCertificates();
  const buildOptions = (values, allLabel) => [allLabel, ...values]
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join("");

  const opdValues = [...new Set(rows.map((item) => item.opd || "Belum ada OPD"))].sort((a, b) => a.localeCompare(b, "id"));
  const districtValues = [...new Set(rows.map((item) => item.kecamatan).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"));
  opdFilter.innerHTML = buildOptions(opdValues, "Semua OPD");
  districtFilter.innerHTML = buildOptions(districtValues, "Semua Kecamatan");
  opdFilter.value = opdValues.includes(currentOpd) ? currentOpd : "Semua OPD";
  districtFilter.value = districtValues.includes(currentDistrict) ? currentDistrict : "Semua Kecamatan";
}

function renderCertificateInfo(rows) {
  const total = rows.length;
  const opdCount = new Set(rows.map((item) => item.opd).filter(Boolean)).size;
  const districtCount = new Set(rows.map((item) => item.kecamatan).filter(Boolean)).size;
  document.querySelector("#certificateInfo").textContent =
    `Menampilkan ${total} sertifikat dari ${opdCount} OPD dan ${districtCount} Kecamatan.`;
}

function renderAll() {
  syncFilterOptions();
  const filteredRows = getFilteredRows();
  renderRows(filteredRows);
  renderCertificateInfo(filteredRows);
  renderDashboard();
}

function getFormData() {
  return {
    id: editingId || generateId(),
    nomor: document.querySelector("#nomorSertifikat").value.trim(),
    nama: document.querySelector("#namaAset").value.trim(),
    opd: document.querySelector("#opd").value.trim(),
    kecamatan: document.querySelector("#kecamatan").value.trim(),
    kelurahan: document.querySelector("#kelurahan").value.trim(),
    lokasi: document.querySelector("#lokasi").value.trim(),
    luas: document.querySelector("#luas").value.trim(),
    tahun: document.querySelector("#tahun").value.trim(),
    status: document.querySelector("#status").value,
    keterangan: document.querySelector("#keterangan").value.trim(),
    pdfName: selectedPdf?.name || "",
    hasPdf: Boolean(selectedPdf),
    createdAt: new Date().toISOString(),
  };
}

function fillForm(item) {
  editingId = item.id;
  selectedPdf = null;
  document.querySelector("#nomorSertifikat").value = item.nomor;
  document.querySelector("#namaAset").value = item.nama;
  document.querySelector("#opd").value = item.opd || "";
  document.querySelector("#kecamatan").value = item.kecamatan;
  document.querySelector("#kelurahan").value = item.kelurahan;
  document.querySelector("#lokasi").value = item.lokasi;
  document.querySelector("#luas").value = item.luas;
  document.querySelector("#tahun").value = item.tahun;
  document.querySelector("#status").value = item.status;
  document.querySelector("#keterangan").value = item.keterangan;
  pdfFileName.textContent = item.pdfName || "Pilih scan PDF sertifikat";
  saveCertificateButton.textContent = "Update Sertifikat";
  certificateDialogTitle.textContent = "Edit Data Sertifikat & PDF";
  previewPdfButton.disabled = !(sessionPdfUrls.has(item.id) || item.localPdfUrl);
  certificateDialog.showModal();
}

function resetCertificateForm() {
  editingId = null;
  selectedPdf = null;
  certificateForm.reset();
  pdfFileName.textContent = "Pilih scan PDF sertifikat";
  saveCertificateButton.textContent = "Simpan Sertifikat";
  certificateDialogTitle.textContent = "Tambah Data Sertifikat & PDF";
  previewPdfButton.disabled = true;
}

async function getPdfPreviewUrl(item, id) {
  if (sessionPdfUrls.has(id)) return sessionPdfUrls.get(id);
  if (!item?.localPdfUrl) return "";

  const token = localStorage.getItem(authTokenKey);
  const response = await fetch(item.localPdfUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) throw new Error("Gagal membuka file PDF. Silakan login ulang jika sesi sudah habis.");

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  sessionPdfUrls.set(id, url);
  return url;
}

async function showPdfPreview(id, title) {
  const item = certificateData.find((row) => row.id === id);
  let pdfUrl = "";

  try {
    pdfUrl = await getPdfPreviewUrl(item, id);
  } catch (error) {
    showToast(error.message || "PDF belum tersedia untuk preview.");
    return;
  }

  if (!pdfUrl) {
    showToast("PDF belum tersedia untuk preview. Pilih ulang file PDF jika ini data demo lama.");
    return;
  }

  pdfDialogTitle.textContent = title;
  pdfViewer.src = pdfUrl;
  pdfDialog.showModal();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.add("hidden"), 2800);
}

function downloadTextFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getReportRows() {
  return getUploadedCertificates().map((item) => ({
    nomor: item.nomor,
    nama: item.nama,
    opd: item.opd,
    kecamatan: item.kecamatan,
    kelurahan: item.kelurahan,
    lokasi: item.lokasi,
    luas: item.luas,
    tahun: item.tahun,
    status: item.status,
    keterangan: item.keterangan,
  }));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildReportTable() {
  const headers = ["Nomor", "Nama Barang/Tanah", "Nama OPD", "Kecamatan", "Kelurahan/Desa", "Lokasi", "Luas", "Tahun", "Status", "Keterangan"];
  const rows = getReportRows();
  const body = rows
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.nomor)}</td>
          <td>${escapeHtml(item.nama)}</td>
          <td>${escapeHtml(item.opd)}</td>
          <td>${escapeHtml(item.kecamatan)}</td>
          <td>${escapeHtml(item.kelurahan)}</td>
          <td>${escapeHtml(item.lokasi)}</td>
          <td>${escapeHtml(item.luas)}</td>
          <td>${escapeHtml(item.tahun)}</td>
          <td>${escapeHtml(item.status)}</td>
          <td>${escapeHtml(item.keterangan)}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <table>
      <thead>
        <tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function exportExcel() {
  const table = buildReportTable();
  const content = `
    <html>
      <head><meta charset="UTF-8" /></head>
      <body>
        <h2>Data Sertifikat Hak Pakai Kabupaten Tuban</h2>
        ${table}
      </body>
    </html>
  `;

  downloadTextFile("data-sertifikat-tuban.xls", content, "application/vnd.ms-excel;charset=utf-8");
  showToast("File Excel berhasil dibuat.");
}

function exportPdf() {
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    showToast("Pop-up diblokir browser. Izinkan pop-up untuk export PDF.");
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html lang="id">
      <head>
        <meta charset="UTF-8" />
        <title>Data Sertifikat Tuban</title>
        <style>
          body { font-family: Arial, sans-serif; color: #211827; margin: 28px; }
          h1 { margin: 0 0 6px; font-size: 22px; }
          p { margin: 0 0 18px; color: #666; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
          th { background: #fff1f7; color: #3b1024; }
        </style>
      </head>
      <body>
        <h1>Data Sertifikat Hak Pakai Kabupaten Tuban</h1>
        <p>Export metadata sertifikat tanpa file PDF.</p>
        ${buildReportTable()}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  showToast("Dialog export PDF dibuka.");
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.querySelector("#email").value.trim();
  const password = passwordInput.value;

  try {
    const response = await apiRequest("/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem(authTokenKey, response.accessToken);
    backendReady = true;
  } catch (error) {
    localStorage.removeItem(authTokenKey);
    backendReady = false;
    localStorage.removeItem("arsipTubanLoggedIn");
    showToast(error.message || "Login gagal. Periksa email/password dan server lokal.");
    return;
  }

  localStorage.setItem("arsipTubanLoggedIn", "true");
  showApp();
});

logoutButton.addEventListener("click", () => {
  localStorage.removeItem("arsipTubanLoggedIn");
  localStorage.removeItem(authTokenKey);
  showLogin();
});

accountButton.addEventListener("click", () => {
  const isOpen = !accountDropdown.classList.contains("hidden");
  accountDropdown.classList.toggle("hidden", isOpen);
  accountButton.setAttribute("aria-expanded", String(!isOpen));
});

accountLogoutButton.addEventListener("click", () => {
  localStorage.removeItem("arsipTubanLoggedIn");
  localStorage.removeItem(authTokenKey);
  accountDropdown.classList.add("hidden");
  accountButton.setAttribute("aria-expanded", "false");
  showLogin();
  showToast("Anda sudah logout.");
});

document.addEventListener("click", (event) => {
  const isAccountClick = event.target.closest(".account-menu");
  if (isAccountClick) return;

  accountDropdown.classList.add("hidden");
  accountButton.setAttribute("aria-expanded", "false");
});

togglePassword.addEventListener("click", () => {
  const isPassword = passwordInput.type === "password";
  passwordInput.type = isPassword ? "text" : "password";
  passwordIcon.textContent = isPassword ? "Tutup" : "Lihat";
  togglePassword.setAttribute("aria-label", isPassword ? "Sembunyikan password" : "Tampilkan password");
});

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => setActiveSection(button.dataset.target));
});

document.querySelectorAll(".stat-link").forEach((button) => {
  button.addEventListener("click", () => {
    setActiveSection(button.dataset.target);
    const focusTarget = button.dataset.focusFilter;
    if (focusTarget) document.querySelector(`#${focusTarget}`)?.focus();
  });
});

searchInput.addEventListener("input", renderAll);
opdFilter.addEventListener("change", renderAll);
districtFilter.addEventListener("change", renderAll);
statusFilter.addEventListener("change", renderAll);

menuToggle.addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

focusFormButton.addEventListener("click", () => {
  resetCertificateForm();
  certificateDialog.showModal();
  document.querySelector("#nomorSertifikat").focus();
});

closeFormButton.addEventListener("click", () => {
  resetCertificateForm();
  certificateDialog.close();
});

resetFormButton.addEventListener("click", () => {
  window.setTimeout(resetCertificateForm, 0);
});

pdfFile.addEventListener("change", () => {
  selectedPdf = pdfFile.files[0] || null;
  pdfFileName.textContent = selectedPdf ? selectedPdf.name : "Pilih scan PDF sertifikat";
  previewPdfButton.disabled = !selectedPdf;
});

previewPdfButton.addEventListener("click", () => {
  if (!selectedPdf && editingId) {
    const item = certificateData.find((row) => row.id === editingId);
    showPdfPreview(editingId, item?.pdfName || item?.nomor || "Scan Sertifikat");
    return;
  }

  if (!selectedPdf) return;

  const previewId = editingId || "new-file";
  const existingUrl = sessionPdfUrls.get(previewId);
  if (existingUrl) URL.revokeObjectURL(existingUrl);

  sessionPdfUrls.set(previewId, URL.createObjectURL(selectedPdf));
  showPdfPreview(previewId, selectedPdf.name);
});

certificateForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!editingId && !selectedPdf) {
    showToast("Pilih file PDF dulu agar sertifikat muncul di daftar pengelolaan.");
    return;
  }

  const item = getFormData();
  let savedByBackend = false;

  if (selectedPdf) {
    const temporaryUrl = sessionPdfUrls.get("new-file");
    if (!editingId && temporaryUrl) {
      URL.revokeObjectURL(temporaryUrl);
      sessionPdfUrls.delete("new-file");
    }

    const oldUrl = sessionPdfUrls.get(item.id);
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    sessionPdfUrls.set(item.id, URL.createObjectURL(selectedPdf));
  } else if (editingId) {
    const currentItem = certificateData.find((row) => row.id === editingId);
    item.pdfName = currentItem?.pdfName || "";
    item.hasPdf = Boolean(currentItem?.hasPdf);
  }

  try {
    const apiPayload = await buildApiPayload(item);
    const response = await apiRequest("/certificates", {
      method: editingId ? "PUT" : "POST",
      body: JSON.stringify(apiPayload),
    });
    const apiItem = mapApiCertificate(response.data);

    if (editingId) {
      certificateData = certificateData.map((row) => (row.id === editingId ? apiItem : row));
    } else {
      certificateData.unshift(apiItem);
    }

    savedByBackend = true;
    backendReady = true;
    showToast(editingId ? "Data diperbarui di server lokal." : "Data dan PDF tersimpan di server lokal.");
  } catch (error) {
    backendReady = false;
    showToast(error.message || "Gagal menyimpan ke server lokal. Data belum disimpan.");
    return;
  }

  if (savedByBackend && selectedPdf) {
    const apiItem = editingId ? certificateData.find((row) => row.id === editingId) : certificateData[0];
    const localUrl = sessionPdfUrls.get(item.id);
    if (localUrl && apiItem?.id !== item.id) {
      sessionPdfUrls.delete(item.id);
      sessionPdfUrls.set(apiItem.id, localUrl);
    }
  }

  saveCertificates();
  resetCertificateForm();
  certificateDialog.close();
  renderAll();
});

certificateRows.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const item = certificateData.find((row) => row.id === button.dataset.id);
  if (!item) return;

  if (button.dataset.action === "preview") {
    showPdfPreview(item.id, item.pdfName || item.nomor);
  }

  if (button.dataset.action === "edit") {
    fillForm(item);
    showToast("Data dimuat ke form edit.");
  }

  if (button.dataset.action === "delete") {
    const confirmed = window.confirm(`Hapus data ${item.nomor}?`);
    if (!confirmed) return;

    try {
      await apiRequest(`/certificates?id=${encodeURIComponent(item.id)}`, {
        method: "DELETE",
      });
      backendReady = true;
    } catch (error) {
      backendReady = false;
      showToast(error.message || "Gagal menghapus data di server lokal.");
      return;
    }

    const oldUrl = sessionPdfUrls.get(item.id);
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    sessionPdfUrls.delete(item.id);
    certificateData = certificateData.filter((row) => row.id !== item.id);
    saveCertificates();
    renderAll();
    showToast("Data sertifikat berhasil dihapus.");
  }
});

closePdfButton.addEventListener("click", () => {
  pdfDialog.close();
  pdfViewer.src = "";
});

document.querySelector("#exportExcelButton").addEventListener("click", exportExcel);
document.querySelector("#exportPdfButton").addEventListener("click", exportPdf);

if (localStorage.getItem("arsipTubanLoggedIn") === "true") {
  showApp();
} else {
  showLogin();
}
