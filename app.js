let patients = [];

const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    const currentUser = await getCurrentDashboardUser();

    if (!currentUser) {
        await supabaseClient.auth.signOut();
        showLogin();
        return;
    }

    if (!currentUser.aktif) {
        alert("Akun Anda sudah dinonaktifkan.");
        await supabaseClient.auth.signOut();
        showLogin();
        return;
    }

    showDashboard(session.user);
    await applyRoleAccess();
    await loadAll();
} else {
    showLogin();
}
  supabaseClient.auth.onAuthStateChange(async (_event, session) => {

  if (session) {

    const dashboardUser = await getCurrentDashboardUser();

    if (!dashboardUser) {
      await supabaseClient.auth.signOut();
      alert("Akun belum terdaftar sebagai petugas Dashboard DM.");
      showLogin();
      return;
    }

    if (!dashboardUser.aktif) {
      await supabaseClient.auth.signOut();
      alert("Akun Anda sedang dinonaktifkan oleh Admin.");
      showLogin();
      return;
    }

    showDashboard(session.user);
    await applyRoleAccess();
    await loadAll();

    } else {
    showLogin();
  }
  });
});

function bindEvents() {
  $("loginForm").addEventListener("submit", login);
  $("logoutBtn").addEventListener("click", async () => { await supabaseClient.auth.signOut(); });
  [
    "filterStatus",
    "filterProlanis",
    "filterSearch"
].forEach(id => {
    const element = $(id);

    if (element) {
        element.addEventListener(
            id === "filterSearch" ? "input" : "change",
            renderDashboard
        );
    }
});
  $("openModalBtn").onclick = openModal;
  $("openModalBtn2").onclick = openModal;
  $("closeModalBtn").onclick = closeModal;
  $("cancelModalBtn").onclick = closeModal;
  $("patientForm").addEventListener("submit", addPatient);

  document.querySelectorAll(".nav-item[data-page]").forEach(item => {
    item.addEventListener("click", () => navigate(item.dataset.page, item));
  });
  $("inputTanggalLahir")?.addEventListener(
  "change",
  function () {
    const umur = hitungUmur(this.value);

    $("inputUmur").value = umur;
  }
);
}

async function login(e) {

  e.preventDefault();

  const email =
    $("username").value.trim();

  const password =
    $("password").value;

  $("loginError").textContent =
    "Sedang login...";


  try {

    const {
      data,
      error
    } =
      await supabaseClient.auth.signInWithPassword({

        email: email,

        password: password

      });


    if (error) {

      $("loginError").textContent =
        "Login gagal: " +
        error.message;

      return;
    }


    if (data?.user) {

      $("loginError").textContent = "";

      // Jangan showDashboard/loadAll di sini.
      // onAuthStateChange yang menangani.

    }


  } catch (error) {

    console.error(
      "ERROR LOGIN:",
      error
    );

    $("loginError").textContent =
      "Error: " +
      error.message;

  }

}

function showLogin() {
  $("loginPage").style.display = "flex";
  $("dashboardPage").style.display = "none";
}
function showDashboard(user) {
  $("loginPage").style.display = "none";
  $("dashboardPage").style.display = "block";
  $("loggedUser").textContent = user?.email || "Admin";
}

async function loadAll() {
  const { data, error } = await supabaseClient
    .from("patients_dm")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    alert("Gagal mengambil data Supabase: " + error.message);
    return;
  }

  patients = data || [];
renderDashboard();
renderAllPatients();
renderAllFollowUp();
renderReport();
}

function getStatus(patient) {

  if (!patient.last_visit) {
    return "Tidak Berkunjung";
  }

  const last = new Date(
    patient.last_visit + "T00:00:00"
  );

  const days =
    (new Date() - last) / 86400000;

  if (days > 90) {
    return "Tidak Berkunjung";
  }

  const gdp =
    patient.gdp !== null &&
    patient.gdp !== undefined &&
    patient.gdp !== ""
      ? Number(patient.gdp)
      : null;

  const hba1c =
    patient.hba1c !== null &&
    patient.hba1c !== undefined &&
    patient.hba1c !== ""
      ? Number(patient.hba1c)
      : null;

  // Jika pemeriksaan belum lengkap,
  // jangan dianggap terkendali
  if (gdp === null || hba1c === null) {
    return "Tidak Terkendali";
  }

  if (
    !isNaN(gdp) &&
    !isNaN(hba1c) &&
    gdp < 126 &&
    hba1c < 7
  ) {
    return "Terkendali";
  }

  return "Tidak Terkendali";
}
function hitungUmur(tanggalLahir) {
  if (!tanggalLahir) return "";

  const lahir = new Date(tanggalLahir + "T00:00:00");
  const sekarang = new Date();

  let umur =
    sekarang.getFullYear() -
    lahir.getFullYear();

  const bulan =
    sekarang.getMonth() -
    lahir.getMonth();

  if (
    bulan < 0 ||
    (
      bulan === 0 &&
      sekarang.getDate() < lahir.getDate()
    )
  ) {
    umur--;
  }

  return umur;
}
function getStatusClass(status) {
  return status === "Terkendali" ? "green" : status === "Tidak Berkunjung" ? "yellow" : "red";
}

function getFilteredPatients() {
    const status = $("filterStatus")?.value || "all";
    const prolanis = $("filterProlanis")?.value || "all";
    const search = ($("filterSearch")?.value || "").toLowerCase().trim();

    return patients.filter(p => {

        // Filter Status DM
        if (
            status !== "all" &&
            getStatus(p) !== status
        ) {
            return false;
        }

        // Filter Prolanis
        if (
            prolanis !== "all" &&
            (p.status_prolanis || "Non-Prolanis") !== prolanis
        ) {
            return false;
        }

        // Filter pencarian nama
        if (
            search &&
            !(p.nama || "").toLowerCase().includes(search)
        ) {
            return false;
        }

        return true;
    });
}

function renderDashboard() {
  const data = getFilteredPatients();
  const total = data.length;
  const terkendali = data.filter(p => getStatus(p) === "Terkendali").length;
  const tidak = data.filter(p => getStatus(p) === "Tidak Terkendali").length;
  const tidakKunjung = data.filter(p => getStatus(p) === "Tidak Berkunjung").length;
  const pct = n => total ? ((n / total) * 100).toFixed(1) : "0.0";

  $("totalPasien").textContent = total;
  $("totalTerkendali").textContent = terkendali;
  $("totalTidakTerkendali").textContent = tidak;
  $("totalTidakBerkunjung").textContent = tidakKunjung;
  $("persenTerkendali").textContent = pct(terkendali) + "%";
  $("persenTidakTerkendali").textContent = pct(tidak) + "%";
  $("persenTidakBerkunjung").textContent = pct(tidakKunjung) + "%";

  $("chartTerkendali").textContent = terkendali;
  $("chartTidakTerkendali").textContent = tidak;
  $("chartTidakBerkunjung").textContent = tidakKunjung;
  const max = Math.max(terkendali, tidak, tidakKunjung, 1);
  $("barTerkendali").style.height = `${terkendali / max * 150}px`;
  $("barTidakTerkendali").style.height = `${tidak / max * 150}px`;
  $("barTidakBerkunjung").style.height = `${tidakKunjung / max * 150}px`;

  const kunjungan = total - tidakKunjung;
  const follow = data.filter(p => {
  const status = getStatus(p);

  if (
    status !== "Tidak Terkendali" &&
    status !== "Tidak Berkunjung"
  ) {
    return false;
  }

  if (
    p.followup_status === "Sudah Ditindaklanjuti" ||
    p.followup_status === "Pasien Sudah Kontrol"
  ) {
    return false;
  }

  return true;
}).length;
  setProgress("Terkendali", pct(terkendali));
  setProgress("Kunjungan", pct(kunjungan));
  setProgress("Followup", pct(follow));

  renderPatientTable(data);
  renderFollowUp(data);
  renderAllFollowUp();
  renderFollowUpSummary();
  renderTrendStatusChart();
}
function filterByStatus(status) {

  const filterStatus = $("filterStatus");

  if (!filterStatus) return;

  filterStatus.value = status;

  renderDashboard();

  // Scroll ke tabel pasien
  const table = document.querySelector(".table-card");

  if (table) {
    table.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}
function setProgress(name, value) {
  $(`progress${name}`).textContent = value + "%";
  $(`fill${name}`).style.width = value + "%";
}

function renderPatientTable(data) {
  const tbody = $("patientTableBody");
  tbody.innerHTML = data.length ? data.map(row => patientRow(row)).join("") :
    `<tr><td colspan="10" class="empty">Data pasien tidak ditemukan.</td></tr>`;
}
function patientRow(p) {

  const status = getStatus(p);

  let followupText = "Tidak Perlu";
  let followupClass = "green";

  if (status === "Tidak Terkendali") {
    followupText = p.followup_status || "Belum Ditindaklanjuti";
    followupClass = "yellow";
  }

  if (status === "Tidak Berkunjung") {
    followupText = p.followup_status || "Belum Ditindaklanjuti";
    followupClass = "brown";
  }

  if (
    p.followup_status === "Sudah Ditindaklanjuti" ||
    p.followup_status === "Pasien Sudah Kontrol"
  ) {
    followupClass = "green";
  }

  if (
    p.followup_status === "Tidak Dapat Dihubungi" ||
    p.followup_status === "Menolak Kontrol"
  ) {
    followupClass = "red";
  }

  return `<tr>

    <td>
      ${escapeHtml(p.patient_code || "")}
    </td>

    <td>
      <b>${escapeHtml(p.nama)}</b>
    </td>

    <td>
      ${p.umur ?? ""} th
    </td>

    <td>
      ${p.gdp ?? ""}
    </td>

    <td>
      ${p.hba1c ?? ""}%
    </td>

    <td>
      ${escapeHtml(p.td || "")}
    </td>

    <td>
      <span class="status ${getStatusClass(status)}">
        ${status}
      </span>
    </td>

    <td>

  <div style="display:flex; flex-direction:column; gap:6px;">

    <span class="status ${followupClass}">
      ${escapeHtml(followupText)}
    </span>

    ${
      p.followup_date
        ? `
          <small style="color:#777;">
            📅 ${formatDate(p.followup_date)}
          </small>
        `
        : ""
    }

    ${
      p.followup_note
        ? `
          <small
            style="
              color:#666;
              line-height:1.4;
              max-width:220px;
            "
            title="${escapeHtml(p.followup_note)}">
            📝 ${escapeHtml(p.followup_note)}
          </small>
        `
        : ""
    }

    ${
      status === "Tidak Terkendali" ||
      status === "Tidak Berkunjung"
        ? `
          <button
            type="button"
            class="action-btn"
            onclick="openFollowUpForm('${p.id}')">
            📋 Tindaklanjuti
          </button>
        `
        : ""
    }

  </div>

</td>

    <td>

      <div class="action-buttons">

        <button
          class="action-btn"
          onclick="viewPatient('${p.id}')">
          Detail
        </button>

        <button
          class="action-btn edit-btn"
          onclick="editPatient('${p.id}')">
          Edit
        </button>

        <button
          class="action-btn delete-btn"
          onclick="deletePatient('${p.id}')">
          Hapus
        </button>

      </div>

    </td>

  </tr>`;
}
function renderAllPatients() {

  const tableBody = $("allPatientTableBody");

  if (!tableBody) return;


  const searchInput = $("patientPageSearch");
  const statusFilter = $("patientPageStatus");
  const prolanisFilter = $("patientPageProlanis");


  const search = searchInput
    ? searchInput.value.trim().toLowerCase()
    : "";


  const selectedStatus = statusFilter
    ? statusFilter.value
    : "all";


  const selectedProlanis = prolanisFilter
    ? prolanisFilter.value
    : "all";


  // ==============================
  // FILTER DATA PASIEN
  // ==============================

  const filteredPatients = patients.filter(p => {

    const status = getStatus(p);

    const prolanis =
      p.status_prolanis || "Non-Prolanis";


    const matchesSearch =
      !search ||
      (p.nama || "").toLowerCase().includes(search) ||
      (p.patient_code || "").toLowerCase().includes(search);


    const matchesStatus =
      selectedStatus === "all" ||
      status === selectedStatus;


    const matchesProlanis =
      selectedProlanis === "all" ||
      prolanis === selectedProlanis;


    return (
      matchesSearch &&
      matchesStatus &&
      matchesProlanis
    );

  });


  // ==============================
  // HITUNG STATISTIK
  // ==============================

  const total = patients.length;


  const terkendali = patients.filter(
    p => getStatus(p) === "Terkendali"
  ).length;


  const tidakTerkendali = patients.filter(
    p => getStatus(p) === "Tidak Terkendali"
  ).length;


  const tidakBerkunjung = patients.filter(
    p => getStatus(p) === "Tidak Berkunjung"
  ).length;


  // ==============================
  // TAMPILKAN STATISTIK
  // ==============================

  const totalEl =
    $("patientPageTotal");

  const controlledEl =
    $("patientPageControlled");

  const uncontrolledEl =
    $("patientPageUncontrolled");

  const notVisitedEl =
    $("patientPageNotVisited");


  if (totalEl) {
    totalEl.textContent = total;
  }


  if (controlledEl) {
    controlledEl.textContent =
      terkendali;
  }


  if (uncontrolledEl) {
    uncontrolledEl.textContent =
      tidakTerkendali;
  }


  if (notVisitedEl) {
    notVisitedEl.textContent =
      tidakBerkunjung;
  }


  // ==============================
  // JIKA DATA KOSONG
  // ==============================

  if (!filteredPatients.length) {

    tableBody.innerHTML = `
      <tr>
        <td colspan="11" class="empty">
          Tidak ada pasien yang sesuai
          dengan pencarian/filter.
        </td>
      </tr>
    `;

    return;
  }


  // ==============================
  // TABEL PASIEN
  // ==============================

  tableBody.innerHTML =
    filteredPatients.map(p => {

      const status =
        getStatus(p);


      const prolanis =
        p.status_prolanis ||
        "Non-Prolanis";


      const prolanisClass =
        prolanis === "Prolanis"
          ? "green"
          : "brown";


      return `
        <tr>

          <td>
            ${escapeHtml(
              p.patient_code || ""
            )}
          </td>


          <td>
            <b>
              ${escapeHtml(
                p.nama || ""
              )}
            </b>
          </td>


          <td>
            ${p.umur ?? ""}
          </td>


          <td>
            ${p.gdp ?? ""}
          </td>


          <td>
            ${p.gds ?? ""}
          </td>


          <td>
            ${p.hba1c ?? ""}%
          </td>


          <td>
            ${escapeHtml(
              p.td || ""
            )}
          </td>


          <td>
            <span class="status ${prolanisClass}">
              ${escapeHtml(prolanis)}
            </span>
          </td>


          <td>
            <span class="status ${getStatusClass(status)}">
              ${status}
            </span>
          </td>


          <td>

            <div class="action-buttons">

              <button
                type="button"
                class="action-btn"
                onclick="viewPatient('${p.id}')">
                Detail
              </button>


              <button
                type="button"
                class="action-btn edit-btn"
                onclick="editPatient('${p.id}')">
                Edit
              </button>


              <button
                type="button"
                class="action-btn delete-btn"
                onclick="deletePatient('${p.id}')">
                Hapus
              </button>

            </div>

          </td>

        </tr>
      `;

    }).join("");
}
function renderFollowUp(data = patients) {
  const follow = data.filter(p => {
    const status = getStatus(p);
    return status === "Tidak Terkendali" || status === "Tidak Berkunjung";
  });

  $("followUpList").innerHTML = follow.length
    ? follow.map(followCard).join("")
    : `<div class="empty">Tidak ada pasien yang perlu follow-up.</div>`;
}
function getFollowUpReason(p) {
  const status = getStatus(p);

  if (status === "Tidak Berkunjung") {
    return "Tidak kontrol >90 hari";
  }

  const reasons = [];

  if (p.hba1c != null && Number(p.hba1c) >= 7) {
    reasons.push("HbA1c di atas target");
  }

  if (p.gdp != null && Number(p.gdp) >= 126) {
    reasons.push("GDP di atas target");
  }

  if (reasons.length > 0) {
    return reasons.join(" & ");
  }

  return "Perlu pemantauan";
}
function getFollowUpAction(p) {
  const status = getStatus(p);

  // Pasien tidak berkunjung
  if (status === "Tidak Berkunjung") {
    return "Hubungi pasien dan ingatkan untuk kontrol";
  }

  const hba1c = p.hba1c != null ? Number(p.hba1c) : null;
  const gdp = p.gdp != null ? Number(p.gdp) : null;

  // HbA1c dan GDP sama-sama tinggi
  if (
    hba1c != null &&
    hba1c >= 7 &&
    gdp != null &&
    gdp >= 126
  ) {
    return "Evaluasi terapi, kepatuhan obat, dan pola makan";
  }

  // HbA1c tinggi
  if (hba1c != null && hba1c >= 7) {
    return "Evaluasi kontrol glikemik dan kepatuhan terapi";
  }

  // GDP tinggi
  if (gdp != null && gdp >= 126) {
    return "Evaluasi pola makan dan terapi diabetes";
  }

  return "Lakukan pemantauan dan edukasi";
}
function renderAllFollowUp() {
  const container = $("allFollowUpList");
  if (!container) return;

  const priorityFilter =
    $("followupPriorityFilter")?.value || "all";

  const statusFilter =
    $("followupStatusFilter")?.value || "all";

  const follow = patients
    .filter(p => {
      const status = getStatus(p);
    if (
      p.followup_status === "Sudah Ditindaklanjuti" ||
      p.followup_status === "Pasien Sudah Kontrol"
    ) {
      return false;
    }
      // Hanya pasien yang perlu follow-up
      if (
        status !== "Tidak Terkendali" &&
        status !== "Tidak Berkunjung"
      ) {
        return false;
      }

      // Filter status
      if (
        statusFilter !== "all" &&
        status !== statusFilter
      ) {
        return false;
      }

      // Tentukan prioritas
      const priority =
        status === "Tidak Berkunjung"
          ? "Tinggi"
          : "Sedang";

      // Filter prioritas
      if (
        priorityFilter !== "all" &&
        priority !== priorityFilter
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      const statusA = getStatus(a);
      const statusB = getStatus(b);

      if (
        statusA === "Tidak Berkunjung" &&
        statusB !== "Tidak Berkunjung"
      ) {
        return -1;
      }

      if (
        statusB === "Tidak Berkunjung" &&
        statusA !== "Tidak Berkunjung"
      ) {
        return 1;
      }

      return 0;
    });
    const reasonSummary = $("followupReasonSummary");

if (reasonSummary) {
  const reasonCount = {};

  follow.forEach(p => {
    const reason = getFollowUpReason(p);

    reasonCount[reason] =
      (reasonCount[reason] || 0) + 1;
  });

  reasonSummary.innerHTML = `
    <div class="followup-reason-summary">

      <h4>Ringkasan Alasan Follow-up</h4>

      <div class="reason-cards">

        ${Object.entries(reasonCount)
          .map(([reason, count]) => `
            <div class="reason-card">

              <strong>${count}</strong>

              <span>
                ${escapeHtml(reason)}
              </span>

            </div>
          `)
          .join("")}

      </div>

    </div>
  `;
}
  if (!follow.length) {
    container.innerHTML =
      `<div class="empty">
        Tidak ada pasien yang sesuai dengan filter.
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="followup-summary">
      <div>
        <strong>${follow.length}</strong>
        <span>pasien perlu follow-up</span>
      </div>
    </div>

    <div class="followup-table-wrapper">
      <table class="followup-table">

        <thead>
          <tr>
            <th>Prioritas</th>
            <th>Nama Pasien</th>
            <th>GDP</th>
            <th>HbA1c</th>
            <th>Kunjungan Terakhir</th>
            <th>Status</th>
            <th>Alasan Follow-up</th>
            <th>Tindakan Follow-up</th>
            <th>Status Follow-up</th>
            <th>Tanggal Follow-up</th>
            <th>Aksi</th>
          </tr>
        </thead>

        <tbody>

          ${follow.map(p => {

            const status = getStatus(p);

            const priority =
              status === "Tidak Berkunjung"
                ? "Tinggi"
                : "Sedang";

            const priorityClass =
              status === "Tidak Berkunjung"
                ? "high"
                : "medium";

            return `
              <tr>

                <td>
                  <span class="follow-priority ${priorityClass}">
                    ${priority}
                  </span>
                </td>

                <td>
                  <strong>
                    ${escapeHtml(p.nama)}
                  </strong>
                </td>

                <td>
                  ${p.gdp ?? "-"} mg/dL
                </td>

                <td>
                  ${p.hba1c ?? "-"}%
                </td>

                <td>
                  ${p.last_visit
                    ? formatDate(p.last_visit)
                    : "-"
                  }
                </td>

                <td>
                  <span class="follow-status">
                    ${status}
                  </span>
                </td>

                <td>
                  ${getFollowUpReason(p)}
                </td>
                
                <td>
                  ${getFollowUpAction(p)}
                </td>
                
                <td>
                  <span class="follow-status ${
                    p.followup_status === "Sudah Ditindaklanjuti"
                      ? "follow-success"
                      : p.followup_status === "Pasien Sudah Kontrol"
                      ? "follow-success"
                      : p.followup_status === "Tidak Dapat Dihubungi"
                      ? "follow-danger"
                      : p.followup_status === "Menolak Kontrol"
                      ? "follow-danger"
                      : "follow-pending"
                  }">
                    ${escapeHtml(
                      p.followup_status || "Belum Ditindaklanjuti"
                    )}
                  </span>
                </td>
                <td>
                  ${
                    p.followup_date
                      ? formatDate(p.followup_date)
                      : "-"
                  }
                </td>
                <td>
                  <div style="display:flex; gap:6px; flex-wrap:wrap;">

  <button
    type="button"
    class="action-btn"
    onclick="viewPatient('${p.id}')">
    Detail
  </button>

  <button
    type="button"
    class="action-btn"
    onclick="openFollowUpForm('${p.id}')">
    Tindaklanjuti
  </button>

</div>
                </td>

              </tr>
            `;

          }).join("")}

        </tbody>

      </table>
    </div>
  `;
}
function followCard(p) {
  const status = getStatus(p);

  let priority = "Prioritas Sedang";
  let priorityClass = "medium";

  if (status === "Tidak Berkunjung") {
    priority = "Prioritas Tinggi";
    priorityClass = "high";
  }

  return `
    <div class="follow-up-item">
      
      <div class="follow-up-info">
        <strong>${escapeHtml(p.nama)}</strong>

        <small>
          ${escapeHtml(p.puskesmas || "")}
          · HbA1c ${p.hba1c ?? "-"}%
          · GDP ${p.gdp ?? "-"} mg/dL
        </small>

        <small>
          Kunjungan terakhir:
          ${p.last_visit ? formatDate(p.last_visit) : "-"}
        </small>
      </div>

      <div class="follow-up-right">
        <span class="follow-priority ${priorityClass}">
          ${priority}
        </span>

        <span class="follow-status">
          ${status}
        </span>

        <button
          class="action-btn"
          onclick="viewPatient('${p.id}')">
          Detail
        </button>
      </div>

    </div>
  `;
}
let reportFilteredPatients = null;

function getReportPatients() {
  const month = $("reportMonth")?.value || "all";
  const year = $("reportYear")?.value || "all";

  if (month === "all" && year === "all") {
    return patients;
  }

  return patients.filter(p => {
    if (!p.last_visit) return false;

    const date = new Date(p.last_visit + "T00:00:00");
    const patientMonth = String(date.getMonth() + 1).padStart(2, "0");
    const patientYear = String(date.getFullYear());

    if (month !== "all" && patientMonth !== month) return false;
    if (year !== "all" && patientYear !== year) return false;

    return true;
  });
}

function applyReportFilter() {
  reportFilteredPatients = getReportPatients();
  renderReport();
}

function resetReportFilter() {
  if ($("reportMonth")) $("reportMonth").value = "all";
  if ($("reportYear")) $("reportYear").value = "all";

  reportFilteredPatients = null;
  renderReport();
}
function populateReportYears() {
  const select = $("reportYear");
  if (!select) return;

  const selectedYear = select.value || "all";

  const years = [...new Set(
    patients
      .filter(p => p.last_visit)
      .map(p => new Date(p.last_visit + "T00:00:00").getFullYear())
  )].sort((a, b) => b - a);

  select.innerHTML = `
    <option value="all">Semua Tahun</option>
    ${years.map(year => `
      <option value="${year}">${year}</option>
    `).join("")}
  `;

  if (years.includes(Number(selectedYear))) {
    select.value = selectedYear;
  } else {
    select.value = "all";
  }
}
function renderReport() {
  const container = $("reportContent");
  if (!container) return;

  populateReportYears();

  const reportPatients = reportFilteredPatients || patients;

  const reportMonth = $("reportMonth")?.value || "all";
const reportYear = $("reportYear")?.value || "all";

const monthNames = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember"
];

let periodeText = "Semua Periode";

if (reportMonth !== "all" && reportYear !== "all") {
  periodeText = `${monthNames[Number(reportMonth) - 1]} ${reportYear}`;
} else if (reportMonth !== "all") {
  periodeText = monthNames[Number(reportMonth) - 1];
} else if (reportYear !== "all") {
  periodeText = `Tahun ${reportYear}`;
}
  const total = reportPatients.length;

  const terkendali = reportPatients.filter(
    p => getStatus(p) === "Terkendali"
  ).length;

  const tidakTerkendali = reportPatients.filter(
    p => getStatus(p) === "Tidak Terkendali"
  ).length;

  const tidakBerkunjung = reportPatients.filter(
    p => getStatus(p) === "Tidak Berkunjung"
  ).length;

  const perluFollowUp = reportPatients.filter(p => {
    const status = getStatus(p);

    if (
      status !== "Tidak Terkendali" &&
      status !== "Tidak Berkunjung"
    ) {
      return false;
    }

    return (
      p.followup_status !== "Sudah Ditindaklanjuti" &&
      p.followup_status !== "Pasien Sudah Kontrol"
    );
  }).length;

  const persen = jumlah =>
    total > 0
      ? ((jumlah / total) * 100).toFixed(1)
      : "0.0";

  container.innerHTML = `
    <div class="report-grid">

      <div class="report-card">
        <span>Total Pasien DM</span>
        <strong>${total}</strong>
        <small>Pasien terdaftar</small>
      </div>

      <div class="report-card success">
        <span>DM Terkendali</span>
        <strong>${terkendali}</strong>
        <small>${persen(terkendali)}%</small>
      </div>

      <div class="report-card warning">
        <span>DM Tidak Terkendali</span>
        <strong>${tidakTerkendali}</strong>
        <small>${persen(tidakTerkendali)}%</small>
      </div>

      <div class="report-card danger">
        <span>Tidak Berkunjung</span>
        <strong>${tidakBerkunjung}</strong>
        <small>${persen(tidakBerkunjung)}%</small>
      </div>

      <div class="report-card follow">
        <span>Perlu Follow-up</span>
        <strong>${perluFollowUp}</strong>
        <small>Pasien</small>
      </div>

    </div>

    <div class="report-section">
      <h4>📊 Rekapitulasi Program DM — ${periodeText}</h4>

      <table class="report-table">
        <thead>
          <tr>
            <th>Indikator</th>
            <th>Jumlah</th>
            <th>Persentase</th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>Total pasien DM</td>
            <td>${total}</td>
            <td>100%</td>
          </tr>

          <tr>
            <td>DM terkendali</td>
            <td>${terkendali}</td>
            <td>${persen(terkendali)}%</td>
          </tr>

          <tr>
            <td>DM tidak terkendali</td>
            <td>${tidakTerkendali}</td>
            <td>${persen(tidakTerkendali)}%</td>
          </tr>

          <tr>
            <td>Tidak berkunjung</td>
            <td>${tidakBerkunjung}</td>
            <td>${persen(tidakBerkunjung)}%</td>
          </tr>

          <tr>
            <td>Pasien perlu follow-up</td>
            <td>${perluFollowUp}</td>
            <td>${persen(perluFollowUp)}%</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="report-section">
      <h4>📌 Interpretasi Singkat</h4>

      <div class="report-note">
        Dari total <strong>${total} pasien DM</strong>,
        terdapat <strong>${terkendali} pasien</strong>
        (${persen(terkendali)}%) dengan status DM terkendali,
        <strong>${tidakTerkendali} pasien</strong>
        (${persen(tidakTerkendali)}%) tidak terkendali,
        dan <strong>${tidakBerkunjung} pasien</strong>
        (${persen(tidakBerkunjung)}%) tidak berkunjung.
        Sebanyak <strong>${perluFollowUp} pasien</strong>
        memerlukan tindak lanjut.
      </div>
    </div>
        <div class="report-section">
      <h4>🏥 Rekapitulasi Berdasarkan Puskesmas</h4>

      <div class="report-table-wrapper">
        <table class="report-table">
          <thead>
            <tr>
              <th>Total DM</th>
              <th>Terkendali</th>
              <th>Tidak Terkendali</th>
              <th>Tidak Berkunjung</th>
            </tr>
          </thead>

          <tbody>
            ${[...new Set(reportPatients.map(p => p.puskesmas).filter(Boolean))]
              .sort()
              .map(puskesmas => {

                const dataPuskesmas = reportPatients.filter(
                  p => p.puskesmas === puskesmas
                );

                const totalPuskesmas = dataPuskesmas.length;

                const terkendaliPuskesmas = dataPuskesmas.filter(
                  p => getStatus(p) === "Terkendali"
                ).length;

                const tidakTerkendaliPuskesmas = dataPuskesmas.filter(
                  p => getStatus(p) === "Tidak Terkendali"
                ).length;

                const tidakBerkunjungPuskesmas = dataPuskesmas.filter(
                  p => getStatus(p) === "Tidak Berkunjung"
                ).length;

                return `
                  <tr>
                    <td><strong>${escapeHtml(puskesmas)}</strong></td>
                    <td>${totalPuskesmas}</td>
                    <td>${terkendaliPuskesmas}</td>
                    <td>${tidakTerkendaliPuskesmas}</td>
                    <td>${tidakBerkunjungPuskesmas}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
        <div class="report-section">
      <h4>🏆 Capaian DM Terkendali per Puskesmas</h4>

      <div class="report-table-wrapper">
        <table class="report-table">
          <thead>
            <tr>
              <th>Ranking</th>
              <th>Total DM</th>
              <th>DM Terkendali</th>
              <th>Persentase Terkendali</th>
            </tr>
          </thead>

          <tbody>
            ${[...new Set(reportPatients.map(p => p.puskesmas).filter(Boolean))]
              .map(puskesmas => {

                const dataPuskesmas = reportPatients.filter(
                  p => p.puskesmas === puskesmas
                );

                const totalPuskesmas = dataPuskesmas.length;

                const terkendaliPuskesmas = dataPuskesmas.filter(
                  p => getStatus(p) === "Terkendali"
                ).length;

                const persenTerkendali =
                  totalPuskesmas > 0
                    ? (terkendaliPuskesmas / totalPuskesmas) * 100
                    : 0;

                return {
                  puskesmas,
                  total: totalPuskesmas,
                  terkendali: terkendaliPuskesmas,
                  persen: persenTerkendali
                };
              })
              .sort((a, b) => b.persen - a.persen)
              .map((item, index) => `
                <tr>
                  <td><strong>${index + 1}</strong></td>
                  <td><strong>${escapeHtml(item.puskesmas)}</strong></td>
                  <td>${item.total}</td>
                  <td>${item.terkendali}</td>
                  <td>
                    <strong>${item.persen.toFixed(1)}%</strong>
                  </td>
                </tr>
              `)
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
        <div class="report-section">
      <h4>📊 Grafik Capaian DM Terkendali per Puskesmas</h4>

      <div style="height:350px;">
        <canvas id="reportPuskesmasChart"></canvas>
      </div>
    </div>

  `; 

  renderReportPuskesmasChart();
}

let reportPuskesmasChart = null;

function renderReportPuskesmasChart() {
  const canvas = $("reportPuskesmasChart");
  if (!canvas) return;

  if (reportPuskesmasChart) {
    reportPuskesmasChart.destroy();
    reportPuskesmasChart = null;
  }

  // Gunakan data sesuai filter laporan
  const reportPatients = reportFilteredPatients || patients;

  const dataPuskesmas = [...new Set(
    reportPatients
      .map(p => p.puskesmas)
      .filter(Boolean)
  )]
    .map(puskesmas => {

      const data = reportPatients.filter(
        p => p.puskesmas === puskesmas
      );

      const total = data.length;

      const terkendali = data.filter(
        p => getStatus(p) === "Terkendali"
      ).length;

      return {
        puskesmas,
        persen: total > 0
          ? (terkendali / total) * 100
          : 0
      };
    })
    .sort((a, b) => b.persen - a.persen);

  reportPuskesmasChart = new Chart(canvas, {
    type: "bar",

    data: {
      labels: dataPuskesmas.map(
        item => item.puskesmas
      ),

      datasets: [{
        label: "DM Terkendali (%)",
        data: dataPuskesmas.map(
          item => item.persen
        ),
        borderWidth: 1
      }]
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      scales: {
        y: {
          beginAtZero: true,
          max: 100,

          ticks: {
            callback: value => value + "%"
          },

          title: {
            display: true,
            text: "Persentase DM Terkendali"
          }
        },

        x: {
          title: {
            display: true,
            text: "Puskesmas"
          }
        }
      },

      plugins: {
        legend: {
          display: false
        },

        tooltip: {
          callbacks: {
            label: context =>
              context.parsed.y.toFixed(1) + "%"
          }
        }
      }
    }
  });
}

async function navigate(page, clicked) {

  // Jika mencoba membuka Manajemen Petugas,
  // cek apakah user adalah admin
  if (page === "users" || page === "activity") {

  const currentUser = await getCurrentDashboardUser();

  if (
    !currentUser ||
    currentUser.role !== "admin" ||
    currentUser.aktif !== true
  ) {
    alert(
      "Akses ditolak. Halaman ini hanya dapat diakses oleh Admin."
    );
    return;
  }
}

  // Tandai menu yang aktif
  document.querySelectorAll(".nav-item")
    .forEach(n => n.classList.remove("active"));

  clicked.classList.add("active");

  // Sembunyikan semua halaman
  document.querySelectorAll(".page-section")
    .forEach(s => s.classList.remove("active"));

  // Tampilkan halaman yang dipilih
  $(`${page}Section`).classList.add("active");

  const titles = {
    dashboard: "Dashboard DM Tipe 2",
    patients: "Data Pasien DM Tipe 2",
    followup: "Pasien Perlu Follow-up",
    report: "Laporan Program DM",
    users: "Manajemen Petugas",
    activity: "Riwayat Aktivitas"
  };

  $("pageTitle").textContent = titles[page];

  if (page === "patients") renderAllPatients();
  if (page === "followup") renderAllFollowUp();
  if (page === "report") renderReport();
  if (page === "users") renderDashboardUsers();
  if (page === "activity") renderActivityLogs();
}

function openModal() {

  resetPatientModal();

  $("patientModal").classList.add("show");
}
function closeModal() { $("patientModal").classList.remove("show"); }

let editingPatientId = null;

function autofillDataPasien() {

    const namaInput =
        $("inputNama").value.trim();

    if (namaInput === "") {
        return;
    }

    const namaDicari =
        namaInput.toLowerCase();

    const hasil =
        patients.filter(function(p) {

            return (
                (p.nama || "").trim().toLowerCase()
                === namaDicari
            );

        });

    // Tidak ditemukan
    if (hasil.length === 0) {
        return;
    }

    // Kalau ada lebih dari satu pasien
    // dengan nama yang sama, jangan otomatis memilih
    if (hasil.length > 1) {

        alert(
            "Ada lebih dari satu pasien dengan nama tersebut. " +
            "Silakan cek NIK secara manual."
        );

        return;
    }

    const pasienDitemukan = hasil[0];

    // Isi NIK
    $("inputNIK").value =
        pasienDitemukan.nik || "";

    // Isi No BPJS
    $("inputNoBPJS").value =
        pasienDitemukan.no_bpjs || "";

}
$("inputNama").addEventListener(
    "blur",
    autofillDataPasien
);

function editPatient(id) {

  const p = patients.find(x => x.id === id);

  if (!p) {
    alert("Data pasien tidak ditemukan.");
    return;
  }

  editingPatientId = id;

  // IDENTITAS
  $("inputNama").value = p.nama || "";
  $("inputNIK").value = p.nik || "";
  $("inputTanggalLahir").value = p.tanggal_lahir || "";
  $("inputUmur").value =
  p.tanggal_lahir
    ? hitungUmur(p.tanggal_lahir)
    : "";
  $("inputNoHP").value = p.no_hp || "";
  $("inputAlamat").value = p.alamat || "";

  // KEPESERTAAN
  $("inputNoBPJS").value = p.no_bpjs || "";
  $("inputStatusProlanis").value =
    p.status_prolanis || "Non-Prolanis";

  // DIAGNOSIS
  $("inputTanggalDiagnosis").value =
    p.tanggal_diagnosis || "";

    // PEMERIKSAAN
  $("inputGDP").value = p.gdp ?? "";
  $("inputGDS").value = p.gds ?? "";
  $("inputHbA1c").value = p.hba1c ?? "";
  $("inputTD").value = p.td || "";

  // TERAPI
  $("inputObat").value = p.obat || "";

  // EDUKASI & OBAT
  $("inputSudahEdukasi").checked =
    p.sudah_edukasi === true;

  $("inputSudahDiberiObat").checked =
    p.sudah_diberi_obat === true;
  
  $("inputTanggalEdukasi").value =
  p.tanggal_edukasi || "";

  $("inputMateriEdukasi").value =
    p.materi_edukasi || "";

  $("inputTanggalPemberianObat").value =
    p.tanggal_pemberian_obat || "";

  // KUNJUNGAN
  $("inputKunjungan").value =
    p.last_visit || "";

  // BUKA MODAL
  $("patientModal").classList.add("show");

  // UBAH TOMBOL
  const submitButton =
    document.querySelector(
      "#patientForm button[type='submit']"
    );

  if (submitButton) {
    submitButton.textContent =
      "Simpan Perubahan";
  }
}
async function addPatient(e) {
  e.preventDefault();

  const user =
    (await supabaseClient.auth.getUser()).data.user;

  if (!user) {
    alert("Sesi login tidak ditemukan.");
    return;
  }

  const payload = {
    nama: $("inputNama").value.trim(),
    nik: $("inputNIK").value.trim(),
    tanggal_lahir: $("inputTanggalLahir").value || null,
    umur:
      $("inputUmur").value !== ""
        ? Number($("inputUmur").value)
        : null,
    no_hp: $("inputNoHP").value.trim(),
    alamat: $("inputAlamat").value.trim(),
    no_bpjs: $("inputNoBPJS").value.trim(),
    status_prolanis: $("inputStatusProlanis").value,
    tanggal_diagnosis:
      $("inputTanggalDiagnosis").value || null,

    gdp:
      $("inputGDP").value !== ""
        ? Number($("inputGDP").value)
        : null,

    gds:
      $("inputGDS").value !== ""
        ? Number($("inputGDS").value)
        : null,

    hba1c:
      $("inputHbA1c").value !== ""
        ? Number($("inputHbA1c").value)
        : null,

    td: $("inputTD").value.trim(),
    obat: $("inputObat").value.trim(),

    sudah_edukasi:
      $("inputSudahEdukasi").checked,

    sudah_diberi_obat:
      $("inputSudahDiberiObat").checked,

    tanggal_edukasi:
      $("inputTanggalEdukasi").value || null,

    materi_edukasi:
      $("inputMateriEdukasi").value.trim() || null,

    tanggal_pemberian_obat:
      $("inputTanggalPemberianObat").value || null,

    last_visit:
      $("inputKunjungan").value || null
  };

  if (!payload.nama) {
    alert("Nama pasien wajib diisi.");
    return;
  }

  if (editingPatientId) {

    const { error } =
      await supabaseClient
        .from("patients_dm")
        .update(payload)
        .eq("id", editingPatientId);

    if (error) {
      console.error(error);
      alert(
        "Gagal mengubah data: " +
        error.message
      );
      return;
    }

    await logActivity(
  "Mengubah data pasien",
  "patients_dm",
  editingPatientId,
  `Mengubah data pasien ${payload.nama}`
);

alert("Data pasien berhasil diperbarui.");

editingPatientId = null;

  } else {

    payload.created_by = user.id;

    const { data, error } =
  await supabaseClient
    .from("patients_dm")
    .insert(payload)
    .select("id")
    .single();

    if (error) {
      console.error(error);
      alert(
        "Gagal menyimpan: " +
        error.message
      );
      return;
    }

    await logActivity(
  "Menambah pasien",
  "patients_dm",
  data?.id,
  `Menambahkan pasien ${payload.nama}`
);

alert("Data pasien berhasil ditambahkan.");
  }

  closeModal();
  resetPatientModal();

  await loadAll();
}
async function deletePatient(id) {

  const patient = patients.find(p => p.id === id);

  if (!patient) {
    alert("Data pasien tidak ditemukan.");
    return;
  }

  const yakin = confirm(
    `Yakin ingin menghapus data pasien berikut?\n\n` +
    `Nama: ${patient.nama}\n` +
    `Puskesmas: ${patient.puskesmas}\n\n` +
    `Data yang dihapus tidak dapat dikembalikan.`
  );

  if (!yakin) {
    return;
  }


  const { error } = await supabaseClient
    .from("patients_dm")
    .delete()
    .eq("id", id);


  if (error) {

    alert("Gagal menghapus data: " + error.message);

    return;
  }


  alert("Data pasien berhasil dihapus.");

  await loadAll();
}
function resetPatientModal() {

  editingPatientId = null;

  $("patientForm").reset();

  $("inputKunjungan").value =
    new Date().toISOString().slice(0, 10);

  const submitButton =
    document.querySelector("#patientForm button[type='submit']");

  if (submitButton) {
    submitButton.textContent = "Tambah Pasien";
  }
}

let currentFollowUpPatientId = null;

function openFollowUpForm(patientId) {
  const patient = patients.find(p => p.id === patientId);

  if (!patient) return;

  currentFollowUpPatientId = patientId;

  $("followUpPatientName").value = patient.nama || "";

  $("followUpDate").value =
    new Date().toISOString().split("T")[0];

  $("followUpStatus").value =
    "Sudah Ditindaklanjuti";

  $("followUpNote").value =
    patient.followup_note || "";

  $("followUpModal").style.display = "flex";
}

function closeFollowUpForm() {
  $("followUpModal").style.display = "none";
  currentFollowUpPatientId = null;
}

async function saveFollowUp() {

  if (!currentFollowUpPatientId) return;

  const status =
    $("followUpStatus").value;

  const date =
    $("followUpDate").value;

  const note =
    $("followUpNote").value.trim();

  if (!date) {
    alert("Tanggal follow-up wajib diisi.");
    return;
  }

  const userResult =
    await supabaseClient.auth.getUser();

  const userId =
    userResult.data.user?.id;

  if (!userId) {
    alert("Sesi login tidak ditemukan.");
    return;
  }


  // 1. UPDATE STATUS TERAKHIR PASIEN
  const { error } = await supabaseClient
    .from("patients_dm")
    .update({
      followup_status: status,
      followup_date: date,
      followup_note: note
    })
    .eq("id", currentFollowUpPatientId);


  if (error) {

    console.error(error);

    alert(
      "Gagal menyimpan follow-up: " +
      error.message
    );

    return;
  }


  // 2. SIMPAN RIWAYAT FOLLOW-UP
  const { data: followUpData, error: historyError } =
  await supabaseClient
    .from("dm_followups")
    .insert({
      patient_id: currentFollowUpPatientId,
      tanggal_followup: date,
      status: status,
      catatan: note,
      created_by: userId
    })
    .select("id")
    .single();


  if (historyError) {

    console.error(historyError);

    alert(
      "Status pasien tersimpan, tetapi riwayat gagal disimpan: " +
      historyError.message
    );

    return;
  }
  await logActivity(
    "Menambah follow-up",
    "dm_followups",
    followUpData?.id,
    `Follow-up pasien dengan status "${status}" pada tanggal ${date}`
  );

  // 3. UPDATE DATA LOKAL
  const patient = patients.find(
    p => p.id === currentFollowUpPatientId
  );

  if (patient) {

    patient.followup_status = status;
    patient.followup_date = date;
    patient.followup_note = note;

  }

  closeFollowUpForm();

  await loadAll();

  alert("Follow-up berhasil disimpan.");
}

async function viewPatient(id) {

  const p = patients.find(x => x.id === id);

  if (!p) {
    alert("Data pasien tidak ditemukan.");
    return;
  }

  currentDetailPatientId = id;

  const status = getStatus(p);
  const statusClass = getStatusClass(status);

  $("detailContent").innerHTML = `
    
    <!-- STATUS -->
    <div class="detail-status ${statusClass}">
      <span>Status Pengendalian</span>
      <strong>${status}</strong>
    </div>

    <!-- DATA PASIEN --><h3 class="detail-section-title">Informasi Pasien</h3>

<div class="detail-subtitle">
  Identitas pasien dan informasi kepesertaan.
</div>

<div class="detail-grid">

  <div class="detail-item">
    <span>ID Pasien</span>
    <strong>${escapeHtml(p.patient_code || "-")}</strong>
  </div>

  <div class="detail-item">
    <span>Nama Pasien</span>
    <strong>${escapeHtml(p.nama || "-")}</strong>
  </div>

  <div class="detail-item">
    <span>NIK</span>
    <strong>${escapeHtml(p.nik || "-")}</strong>
  </div>

  <div class="detail-item">
    <span>Tanggal Lahir</span>
    <strong>${p.tanggal_lahir ? formatDate(p.tanggal_lahir) : "-"}</strong>
  </div>

  <div class="detail-item">
    <span>Umur</span>
    <strong>${p.umur ?? "-"} tahun</strong>
  </div>

  <div class="detail-item">
    <span>No. HP</span>
    <strong>${escapeHtml(p.no_hp || "-")}</strong>
  </div>

  <div class="detail-item detail-full">
    <span>Alamat</span>
    <strong>${escapeHtml(p.alamat || "-")}</strong>
  </div>

</div>


<h3 class="detail-section-title">Kepesertaan & Diagnosis</h3>

<div class="detail-grid">

  <div class="detail-item">
    <span>Puskesmas</span>
    <strong>${escapeHtml(p.puskesmas || "-")}</strong>
  </div>

  <div class="detail-item">
    <span>No. BPJS</span>
    <strong>${escapeHtml(p.no_bpjs || "-")}</strong>
  </div>

  <div class="detail-item">
    <span>Status Prolanis</span>
    <strong>${escapeHtml(p.status_prolanis || "Non-Prolanis")}</strong>
  </div>

  <div class="detail-item">
    <span>Tanggal Diagnosis DM</span>
    <strong>${p.tanggal_diagnosis ? formatDate(p.tanggal_diagnosis) : "-"}</strong>
  </div>

</div>


<h3 class="detail-section-title">Terapi & Edukasi</h3>

<div class="detail-grid">

  <div class="detail-item">
    <span>Status Edukasi</span>
    <strong>
      ${p.sudah_edukasi ? "Sudah diberikan edukasi" : "Belum diberikan edukasi"}
    </strong>
  </div>

  <div class="detail-item">
    <span>Status Pemberian Obat</span>
    <strong>
      ${p.sudah_diberi_obat ? "Sudah diberikan obat" : "Belum diberikan obat"}
    </strong>
  </div>

  <div class="detail-item detail-full">
    <span>Obat</span>
    <strong>${escapeHtml(p.obat || "-")}</strong>
  </div>

</div>


<h3 class="detail-section-title">Pemeriksaan Terakhir</h3>

<div class="detail-grid">

  <div class="detail-item">
    <span>GDP</span>
    <strong>${p.gdp ?? "-"} mg/dL</strong>
  </div>

  <div class="detail-item">
    <span>GDS</span>
    <strong>${p.gds ?? "-"} mg/dL</strong>
  </div>

  <div class="detail-item">
    <span>HbA1c</span>
    <strong>${p.hba1c ?? "-"}%</strong>
  </div>

  <div class="detail-item">
    <span>Tekanan Darah</span>
    <strong>${escapeHtml(p.td || "-")} mmHg</strong>
  </div>

  <div class="detail-item detail-full">
    <span>Kunjungan Terakhir</span>
    <strong>${p.last_visit ? formatDate(p.last_visit) : "-"}</strong>
  </div>

</div>

      <div>
        <h3 class="detail-section-title">
          Riwayat Kunjungan / Pemeriksaan
        </h3>

        <p class="history-subtitle">
          Riwayat pemeriksaan pasien dari setiap kunjungan.
        </p>
      </div>

      <button
        type="button"
        class="btn-primary"
        onclick="openVisitModal('${p.id}')">
        + Tambah Kunjungan
      </button>

    </div>

    <div id="visitHistoryContainer">
      <div class="history-loading">
        Memuat riwayat kunjungan...
      </div>
    </div>
    <!-- RIWAYAT FOLLOW-UP -->
<div class="followup-history-section">

  <h3 class="detail-section-title">
    📋 Riwayat Follow-up
  </h3>

  <p class="history-subtitle">
    Riwayat tindak lanjut pasien pada setiap follow-up.
  </p>

  <div id="patientFollowUpHistory">
    <div class="history-loading">
      Memuat riwayat follow-up...
    </div>
  </div>

</div>

<div class="patient-chart-section">

  <h3 class="detail-section-title">
    Perkembangan Pemeriksaan
  </h3>

  <p class="history-subtitle">
    Perkembangan hasil pemeriksaan pasien berdasarkan setiap kunjungan.
  </p>

  <div class="chart-card">
    <h4>Perkembangan GDP</h4>
    <div class="patient-chart-container">
      <canvas id="gdpChart"></canvas>
    </div>
  </div>

  <div class="chart-card">
    <h4>Perkembangan GDS</h4>
    <div class="patient-chart-container">
      <canvas id="gdsChart"></canvas>
    </div>
  </div>

  <div class="chart-card">
    <h4>Perkembangan HbA1c</h4>
    <div class="patient-chart-container">
      <canvas id="hba1cChart"></canvas>
    </div>
  </div>

</div>
  `;

  $("detailModal").classList.add("show");

await loadPatientVisits(id);
await loadPatientFollowUps(id);
await loadPatientCharts(id);
}
async function loadPatientVisits(patientId) {

  const container = $("visitHistoryContainer");

  if (!container) return;

  const { data, error } = await supabaseClient
    .from("dm_visits")
    .select("*")
    .eq("patient_id", patientId)
    .order("tanggal_kunjungan", { ascending: false });

  if (error) {

    container.innerHTML = `
      <div class="history-error">
        Gagal mengambil riwayat:
        ${escapeHtml(error.message)}
      </div>
    `;

    return;
  }

  if (!data || data.length === 0) {

    container.innerHTML = `
      <div class="history-empty">

        <div class="history-empty-icon">
          📋
        </div>

        <strong>
          Belum ada riwayat kunjungan
        </strong>

        <p>
          Tambahkan pemeriksaan pasien dari kunjungan berikutnya.
        </p>

      </div>
    `;

    return;
  }

  container.innerHTML = `
    <div class="history-table-wrapper">

      <table class="history-table">

        <thead>
          <tr>
            <th>Tanggal</th>
            <th>GDP</th>
            <th>GDS</th>
            <th>HbA1c</th>
            <th>TD</th>
            <th>BB</th>
            <th>Obat</th>
            <th>Catatan</th>
            <th>Aksi</th>
          </tr>
        </thead>

        <tbody>

          ${data.map(v => `

            <tr>

              <td>
                <b>${formatDate(v.tanggal_kunjungan)}</b>
              </td>

              <td>
                ${v.gdp ?? "-"}
                ${v.gdp != null ? " mg/dL" : ""}
              </td>

              <td>
                ${v.gds ?? "-"}
                ${v.gds != null ? " mg/dL" : ""}
              </td>

              <td>
                ${v.hba1c ?? "-"}
                ${v.hba1c != null ? "%" : ""}
              </td>

              <td>
                ${escapeHtml(v.td || "-")}
              </td>

              <td>
                ${v.berat_badan ?? "-"}
                ${v.berat_badan != null ? " kg" : ""}
              </td>

              <td>
                ${escapeHtml(v.obat || "-")}
              </td>

              <td>
                ${escapeHtml(v.catatan || "-")}
              </td>

              <td>

                <div class="history-action-buttons">

                  <button
                    type="button"
                    class="history-edit-btn"
                    onclick="editVisit('${v.id}')">
                    Edit
                  </button>

                  <button
                    type="button"
                    class="history-delete-btn"
                    onclick="deleteVisit('${v.id}', '${v.patient_id}')">
                    Hapus
                  </button>

                </div>

              </td>

            </tr>

          `).join("")}

        </tbody>

      </table>

    </div>
  `;
}
async function loadPatientFollowUps(patientId) {

  const container = $("patientFollowUpHistory");

  if (!container) return;

  const { data, error } = await supabaseClient
    .from("dm_followups")
    .select("*")
    .eq("patient_id", patientId)
    .order("tanggal_followup", { ascending: false });

  if (error) {

    console.error("Gagal mengambil riwayat follow-up:", error);

    container.innerHTML = `
      <div class="history-error">
        Gagal mengambil riwayat follow-up:
        ${escapeHtml(error.message)}
      </div>
    `;

    return;
  }

  if (!data || data.length === 0) {

    container.innerHTML = `
      <div class="history-empty">

        <div class="history-empty-icon">
          📋
        </div>

        <strong>
          Belum ada riwayat follow-up
        </strong>

        <p>
          Belum ada tindak lanjut yang tercatat untuk pasien ini.
        </p>

      </div>
    `;

    return;
  }

  container.innerHTML = `
    <div class="followup-history-list">

      ${data.map(item => {

        let statusClass = "medium";

        if (item.status === "Sudah Ditindaklanjuti") {
          statusClass = "success";
        }

        if (
          item.status === "Tidak Dapat Dihubungi" ||
          item.status === "Menolak Kontrol"
        ) {
          statusClass = "high";
        }

        return `
          <div class="followup-history-item">

            <div class="followup-history-header">

              <strong>
                ${formatDate(item.tanggal_followup)}
              </strong>

              <span class="follow-priority ${statusClass}">
                ${escapeHtml(item.status)}
              </span>

            </div>

            <div class="followup-history-note">

              <strong>Catatan:</strong>

              <span>
                ${item.catatan
                  ? escapeHtml(item.catatan)
                  : "-"
                }
              </span>

            </div>

            <!-- TOMBOL AKSI -->
            <div class="followup-history-actions">

              <button
                type="button"
                class="action-btn"
                onclick="editFollowUp('${item.id}', '${item.patient_id}')">
                ✏️ Edit
              </button>

              <button
                type="button"
                class="action-btn danger"
                onclick="deleteFollowUp('${item.id}', '${item.patient_id}')">
                🗑️ Hapus
              </button>

            </div>

          </div>
        `;

      }).join("")}

    </div>
  `;
}
async function editFollowUp(followUpId, patientId) {

  const { data, error } = await supabaseClient
    .from("dm_followups")
    .select("*")
    .eq("id", followUpId)
    .single();

  if (error || !data) {
    alert("Data follow-up tidak ditemukan.");
    return;
  }

  const tanggal = prompt(
    "Tanggal follow-up (YYYY-MM-DD):",
    data.tanggal_followup || ""
  );

  if (tanggal === null) return;

  const status = prompt(
    "Status follow-up:\n\n" +
    "1. Sudah Ditindaklanjuti\n" +
    "2. Pasien Sudah Kontrol\n" +
    "3. Tidak Dapat Dihubungi\n" +
    "4. Menolak Kontrol\n\n" +
    "Masukkan status:",
    data.status || ""
  );

  if (status === null) return;

  const catatan = prompt(
    "Catatan follow-up:",
    data.catatan || ""
  );

  if (catatan === null) return;

const { error: updateError } = await supabaseClient
  .from("dm_followups")
  .update({
    tanggal_followup: tanggal,
    status: status,
    catatan: catatan
  })
  .eq("id", followUpId);

  if (updateError) {

    console.error(updateError);

    alert(
      "Gagal mengubah follow-up: " +
      updateError.message
    );

    return;
  }
await logActivity(
  "Mengubah follow-up",
  "dm_followups",
  followUpId,
  `Mengubah follow-up pasien dengan status "${status}" pada tanggal ${tanggal}`
);
  await syncLatestFollowUp(patientId);

  await loadAll();

  await viewPatient(patientId);

  alert("Riwayat follow-up berhasil diubah.");
}
async function deleteFollowUp(followUpId, patientId) {

  const yakin = confirm(
    "Apakah kamu yakin ingin menghapus riwayat follow-up ini?"
  );

  if (!yakin) return;


  // 1. AMBIL DATA FOLLOW-UP SEBELUM DIHAPUS
  const { data: followUp, error: fetchError } =
    await supabaseClient
      .from("dm_followups")
      .select("*")
      .eq("id", followUpId)
      .single();

  if (fetchError || !followUp) {

    console.error(fetchError);

    alert(
      "Data follow-up tidak ditemukan."
    );

    return;
  }


  // 2. HAPUS DATA FOLLOW-UP
  const { error } = await supabaseClient
    .from("dm_followups")
    .delete()
    .eq("id", followUpId);

  if (error) {

    console.error(error);

    alert(
      "Gagal menghapus follow-up: " +
      error.message
    );

    return;
  }


  // 3. CATAT AKTIVITAS
  await logActivity(
    "Menghapus follow-up",
    "dm_followups",
    followUpId,
    `Menghapus follow-up pasien dengan status "${followUp.status}" pada tanggal ${followUp.tanggal_followup}`
  );


  // 4. SINKRONKAN STATUS TERAKHIR PASIEN
  await syncLatestFollowUp(patientId);


  // 5. REFRESH DATA
  await loadAll();

  await viewPatient(patientId);


  alert("Riwayat follow-up berhasil dihapus.");
}
async function syncLatestFollowUp(patientId) {

  const { data, error } = await supabaseClient
    .from("dm_followups")
    .select("*")
    .eq("patient_id", patientId)
    .order("tanggal_followup", { ascending: false })
    .limit(1);

  if (error) {

    console.error(
      "Gagal mengambil follow-up terbaru:",
      error
    );

    return;
  }

  let updateData;

  if (data && data.length > 0) {

    const latest = data[0];

    updateData = {
      followup_status: latest.status,
      followup_date: latest.tanggal_followup,
      followup_note: latest.catatan || ""
    };

  } else {

    updateData = {
      followup_status: "Belum Ditindaklanjuti",
      followup_date: null,
      followup_note: ""
    };
  }

  const { error: updateError } = await supabaseClient
    .from("patients_dm")
    .update(updateData)
    .eq("id", patientId);

  if (updateError) {

    console.error(
      "Gagal sinkronisasi follow-up:",
      updateError
    );
  }
}
async function editVisit(visitId) {

  const { data: visit, error } = await supabaseClient
    .from("dm_visits")
    .select("*")
    .eq("id", visitId)
    .single();

  if (error || !visit) {

    alert(
      "Data kunjungan tidak ditemukan: " +
      (error?.message || "")
    );

    return;
  }

  const tanggal = prompt(
    "Tanggal kunjungan:",
    visit.tanggal_kunjungan || ""
  );

  if (tanggal === null) return;

  const gdp = prompt(
    "GDP (mg/dL):",
    visit.gdp ?? ""
  );

  if (gdp === null) return;

  const gds = prompt(
    "GDS (mg/dL):",
    visit.gds ?? ""
  );

  if (gds === null) return;

  const hba1c = prompt(
    "HbA1c (%):",
    visit.hba1c ?? ""
  );

  if (hba1c === null) return;

  const td = prompt(
    "Tekanan Darah:",
    visit.td || ""
  );

  if (td === null) return;

  const bb = prompt(
    "Berat Badan (kg):",
    visit.berat_badan ?? ""
  );

  if (bb === null) return;

  const obat = prompt(
    "Obat:",
    visit.obat || ""
  );

  if (obat === null) return;

  const catatan = prompt(
    "Catatan:",
    visit.catatan || ""
  );

  if (catatan === null) return;


  const payload = {

    tanggal_kunjungan: tanggal,

    gdp: gdp !== "" ? Number(gdp) : null,

    gds: gds !== "" ? Number(gds) : null,

    hba1c: hba1c !== "" ? Number(hba1c) : null,

    td: td.trim() || null,

    berat_badan: bb !== "" ? Number(bb) : null,

    obat: obat.trim() || null,

    catatan: catatan.trim() || null

  };


  // UPDATE RIWAYAT KUNJUNGAN
  const { error: updateError } = await supabaseClient
    .from("dm_visits")
    .update(payload)
    .eq("id", visitId);


  if (updateError) {

    alert(
      "Gagal mengubah kunjungan: " +
      updateError.message
    );

    return;
  }
await logActivity(
  "Mengubah kunjungan",
  "dm_visits",
  visitId,
  `Mengubah data kunjungan pasien tanggal ${payload.tanggal_kunjungan}`
);

  // CARI KUNJUNGAN TERBARU PASIEN
  const { data: latestVisits, error: latestError } =
    await supabaseClient
      .from("dm_visits")
      .select("*")
      .eq("patient_id", visit.patient_id)
      .order("tanggal_kunjungan", {
        ascending: false
      })
      .limit(1);


  if (latestError) {

    console.error(
      "Gagal mengambil kunjungan terbaru:",
      latestError
    );

    alert(
      "Kunjungan berhasil diubah, tetapi data ringkasan pasien gagal diperbarui."
    );

    await loadAll();
    await viewPatient(visit.patient_id);

    return;
  }


  // UPDATE DATA RINGKASAN PASIEN
  if (latestVisits && latestVisits.length > 0) {

    const latest = latestVisits[0];

    const { error: patientError } = await supabaseClient
      .from("patients_dm")
      .update({

        gdp: latest.gdp,

        gds: latest.gds,

        hba1c: latest.hba1c,

        td: latest.td,

        obat: latest.obat,

        last_visit: latest.tanggal_kunjungan

      })
      .eq("id", visit.patient_id);


    if (patientError) {

      console.error(
        "Gagal memperbarui ringkasan pasien:",
        patientError
      );

    }

  }


  alert("Data kunjungan berhasil diperbarui.");


  await loadAll();

  await viewPatient(visit.patient_id);
}
async function deleteVisit(visitId) {

  const yakin = confirm(
    "Apakah kamu yakin ingin menghapus data kunjungan ini?"
  );

  if (!yakin) return;


  // Ambil data kunjungan terlebih dahulu
  const { data: visit, error: visitError } = await supabaseClient
    .from("dm_visits")
    .select("*")
    .eq("id", visitId)
    .single();


  if (visitError || !visit) {

    alert(
      "Data kunjungan tidak ditemukan: " +
      (visitError?.message || "")
    );

    return;
  }


  const patientId = visit.patient_id;


  // HAPUS KUNJUNGAN
  const { error: deleteError } = await supabaseClient
    .from("dm_visits")
    .delete()
    .eq("id", visitId);


  if (deleteError) {

    console.error(deleteError);

    alert(
      "Gagal menghapus kunjungan: " +
      deleteError.message
    );

    return;
  }
  await logActivity(
  "Menghapus kunjungan",
  "dm_visits",
  visitId,
  `Menghapus kunjungan pasien tanggal ${visit.tanggal_kunjungan}`
);


  // CARI KUNJUNGAN TERBARU YANG MASIH ADA
  const { data: latestVisits, error: latestError } =
    await supabaseClient
      .from("dm_visits")
      .select("*")
      .eq("patient_id", patientId)
      .order("tanggal_kunjungan", {
        ascending: false
      })
      .limit(1);


  if (latestError) {

    console.error(latestError);

    alert(
      "Kunjungan berhasil dihapus, tetapi data ringkasan pasien gagal diperbarui."
    );

    await loadAll();
    await viewPatient(patientId);

    return;
  }


  // JIKA MASIH ADA RIWAYAT KUNJUNGAN
  if (latestVisits && latestVisits.length > 0) {

    const latest = latestVisits[0];


    const { error: patientError } = await supabaseClient
      .from("patients_dm")
      .update({

        gdp: latest.gdp,

        gds: latest.gds,

        hba1c: latest.hba1c,

        td: latest.td,

        obat: latest.obat,

        last_visit: latest.tanggal_kunjungan

      })
      .eq("id", patientId);


    if (patientError) {

      console.error(
        "Gagal memperbarui data pasien:",
        patientError
      );

    }

  } else {

    // JIKA SUDAH TIDAK ADA RIWAYAT KUNJUNGAN
    const { error: patientError } = await supabaseClient
      .from("patients_dm")
      .update({

        gdp: null,

        gds: null,

        hba1c: null,

        td: null,

        obat: null,

        last_visit: null

      })
      .eq("id", patientId);


    if (patientError) {

      console.error(
        "Gagal mengosongkan data pasien:",
        patientError
      );

    }

  }


  alert("Data kunjungan berhasil dihapus.");


  // REFRESH DASHBOARD
  await loadAll();


  // BUKA KEMBALI DETAIL PASIEN
  await viewPatient(patientId);
}
function formatDate(dateString) {

  if (!dateString) return "-";

  const date = new Date(dateString + "T00:00:00");

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}
function closeDetailModal() {
  $("detailModal").classList.remove("show");
  currentDetailPatientId = null;
}

$("closeDetailBtn").onclick = closeDetailModal;
$("closeDetailBtn2").onclick = closeDetailModal;

$("detailEditBtn").onclick = function () {

  if (!currentDetailPatientId) return;

  const id = currentDetailPatientId;

  closeDetailModal();

  editPatient(id);
};
function escapeHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
let currentDetailPatientId = null;
let currentVisitPatientId = null;

function openVisitModal(patientId) {

  currentVisitPatientId = patientId;

  $("visitForm").reset();

  $("visitTanggal").value =
    new Date().toISOString().slice(0, 10);

  $("visitModal").classList.add("show");
}

function closeVisitModal() {

  $("visitModal").classList.remove("show");

  currentVisitPatientId = null;
}

$("closeVisitBtn").onclick = closeVisitModal;

$("cancelVisitBtn").onclick = closeVisitModal;

$("visitForm").addEventListener("submit", addVisit);
async function addVisit(e) {

  e.preventDefault();

  if (!currentVisitPatientId) {
    alert("Pasien belum dipilih.");
    return;
  }

  const user =
    (await supabaseClient.auth.getUser()).data.user;

  if (!user) {
    alert("Sesi login tidak ditemukan.");
    return;
  }


  // =========================
  // DATA KUNJUNGAN
  // =========================

  const payload = {

    patient_id: currentVisitPatientId,

    tanggal_kunjungan:
      $("visitTanggal").value,

    gdp:
      $("visitGDP").value !== ""
        ? Number($("visitGDP").value)
        : null,

    gds:
      $("visitGDS").value !== ""
        ? Number($("visitGDS").value)
        : null,

    hba1c:
      $("visitHbA1c").value !== ""
        ? Number($("visitHbA1c").value)
        : null,

    td:
      $("visitTD").value.trim() || null,

    berat_badan:
      $("visitBB").value !== ""
        ? Number($("visitBB").value)
        : null,

    obat:
      $("visitObat").value.trim() || null,

    catatan:
      $("visitCatatan").value.trim() || null,

    created_by: user.id
  };


  // =========================
  // VALIDASI TANGGAL
  // =========================

  if (!payload.tanggal_kunjungan) {
    alert("Tanggal kunjungan wajib diisi.");
    return;
  }


  // =========================
  // SIMPAN RIWAYAT
  // =========================

  const { data: visitData, error } = await supabaseClient
  .from("dm_visits")
  .insert(payload)
  .select("id")
  .single();

  if (error) {

    console.error(error);

    alert(
      "Gagal menyimpan kunjungan: " +
      error.message
    );

    return;
  }
await logActivity(
  "Menambah kunjungan",
  "dm_visits",
  visitData?.id,
  `Menambahkan kunjungan pasien dengan tanggal ${payload.tanggal_kunjungan}`
);

  // =========================
  // UPDATE DATA TERBARU PASIEN
  // =========================

  const { error: updateError } =
    await supabaseClient
      .from("patients_dm")
      .update({
        gdp: payload.gdp,
        gds: payload.gds,
        hba1c: payload.hba1c,
        td: payload.td,
        obat: payload.obat,
        last_visit: payload.tanggal_kunjungan
      })
      .eq("id", currentVisitPatientId);


  if (updateError) {

    console.error(updateError);

    alert(
      "Riwayat kunjungan tersimpan, tetapi " +
      "data terbaru pasien gagal diperbarui: " +
      updateError.message
    );

  } else {

    alert("Kunjungan berhasil disimpan.");

  }


  // =========================
  // REFRESH DATA
  // =========================

  const patientId = currentVisitPatientId;

  closeVisitModal();

  await loadAll();

  await viewPatient(patientId);
}
// =========================
// GRAFIK RIWAYAT PEMERIKSAAN
// =========================

let gdpChartInstance = null;
let gdsChartInstance = null;
let hba1cChartInstance = null;

async function loadPatientCharts(patientId) {

  const { data, error } = await supabaseClient
    .from("dm_visits")
    .select("tanggal_kunjungan, gdp, gds, hba1c")
    .eq("patient_id", patientId)
    .order("tanggal_kunjungan", { ascending: true });

  if (error) {
    console.error("Gagal mengambil data grafik:", error.message);
    return;
  }

  if (!data || data.length === 0) {
    return;
  }

  const labels = data.map(v => formatDate(v.tanggal_kunjungan));

  const gdpData = data.map(v =>
    v.gdp !== null ? Number(v.gdp) : null
  );

  const gdsData = data.map(v =>
    v.gds !== null ? Number(v.gds) : null
  );

  const hba1cData = data.map(v =>
    v.hba1c !== null ? Number(v.hba1c) : null
  );

  // Hapus grafik lama kalau ada
  if (gdpChartInstance) {
    gdpChartInstance.destroy();
  }

  if (gdsChartInstance) {
    gdsChartInstance.destroy();
  }

  if (hba1cChartInstance) {
    hba1cChartInstance.destroy();
  }

  // =========================
  // GRAFIK GDP
  // =========================

  const gdpCanvas = document.getElementById("gdpChart");

  if (gdpCanvas) {

    gdpChartInstance = new Chart(gdpCanvas, {

      type: "line",

      data: {
        labels: labels,

        datasets: [{
          label: "GDP (mg/dL)",
          data: gdpData,
          tension: 0.3,
          spanGaps: true,
          borderWidth: 3,
          pointRadius: 5
        }]
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,

        plugins: {
          legend: {
            display: true
          }
        },

        scales: {
          y: {
            beginAtZero: false,
            title: {
              display: true,
              text: "mg/dL"
            }
          },

          x: {
            title: {
              display: true,
              text: "Tanggal Kunjungan"
            }
          }
        }
      }

    });
  }


  // =========================
  // GRAFIK GDS
  // =========================

  const gdsCanvas = document.getElementById("gdsChart");

  if (gdsCanvas) {

    gdsChartInstance = new Chart(gdsCanvas, {

      type: "line",

      data: {
        labels: labels,

        datasets: [{
          label: "GDS (mg/dL)",
          data: gdsData,
          tension: 0.3,
          spanGaps: true,
          borderWidth: 3,
          pointRadius: 5
        }]
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,

        plugins: {
          legend: {
            display: true
          }
        },

        scales: {
          y: {
            beginAtZero: false,
            title: {
              display: true,
              text: "mg/dL"
            }
          },

          x: {
            title: {
              display: true,
              text: "Tanggal Kunjungan"
            }
          }
        }
      }

    });
  }


  // =========================
  // GRAFIK HbA1c
  // =========================

  const hba1cCanvas = document.getElementById("hba1cChart");

  if (hba1cCanvas) {

    hba1cChartInstance = new Chart(hba1cCanvas, {

      type: "line",

      data: {
        labels: labels,

        datasets: [{
          label: "HbA1c (%)",
          data: hba1cData,
          tension: 0.3,
          spanGaps: true,
          borderWidth: 3,
          pointRadius: 5
        }]
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,

        plugins: {
          legend: {
            display: true
          }
        },

        scales: {
          y: {
            beginAtZero: false,
            title: {
              display: true,
              text: "%"
            }
          },

          x: {
            title: {
              display: true,
              text: "Tanggal Kunjungan"
            }
          }
        }
      }

    });
  }
}
document.addEventListener("DOMContentLoaded", () => {
  const priorityFilter = $("followupPriorityFilter");
  const statusFilter = $("followupStatusFilter");

  if (priorityFilter) priorityFilter.addEventListener("change", renderAllFollowUp);
  if (statusFilter) statusFilter.addEventListener("change", renderAllFollowUp);

  const resetButton = $("resetFollowupFilter");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      if (priorityFilter) priorityFilter.value = "all";
      if (statusFilter) statusFilter.value = "all";
      renderAllFollowUp();
    });
  }


  // ==============================
  // FILTER DATA PASIEN
  // ==============================

  const patientSearch = $("patientPageSearch");

const patientStatus = $("patientPageStatus");

const patientProlanis = $("patientPageProlanis");


if (patientSearch) {
  patientSearch.addEventListener(
    "input",
    renderAllPatients
  );
}


if (patientStatus) {
  patientStatus.addEventListener(
    "change",
    renderAllPatients
  );
}


if (patientProlanis) {
  patientProlanis.addEventListener(
    "change",
    renderAllPatients
  );
}

});
function renderFollowUpSummary() {

  const counts = {
    belum: 0,
    selesai: 0,
    kontrol: 0,
    tidakDihubungi: 0,
    menolak: 0
  };

  patients.forEach(p => {

    const status = p.followup_status || "Belum Ditindaklanjuti";

    if (status === "Belum Ditindaklanjuti") {
      counts.belum++;
    }

    else if (status === "Sudah Ditindaklanjuti") {
      counts.selesai++;
    }

    else if (status === "Pasien Sudah Kontrol") {
      counts.kontrol++;
    }

    else if (status === "Tidak Dapat Dihubungi") {
      counts.tidakDihubungi++;
    }

    else if (status === "Menolak Kontrol") {
      counts.menolak++;
    }

  });

  $("followupBelum").textContent = counts.belum;
  $("followupSelesai").textContent = counts.selesai;
  $("followupKontrol").textContent = counts.kontrol;
  $("followupTidakDihubungi").textContent = counts.tidakDihubungi;
  $("followupMenolak").textContent = counts.menolak;
}
// =========================
// GRAFIK TREN STATUS DM BULANAN
// =========================

let trendStatusChart = null;

async function renderTrendStatusChart() {

  const canvas = $("trendStatusChart");

  if (!canvas) return;


  // =========================
  // AMBIL SEMUA RIWAYAT KUNJUNGAN
  // =========================

  const { data: visits, error } = await supabaseClient
    .from("dm_visits")
    .select(`
      patient_id,
      tanggal_kunjungan,
      gdp,
      hba1c,
      created_at
    `)
    .order("tanggal_kunjungan", {
      ascending: true
    })
    .order("created_at", {
      ascending: true
    });


  if (error) {

    console.error(
      "Gagal mengambil data tren DM:",
      error.message
    );

    return;
  }


  // =========================
  // HAPUS GRAFIK LAMA
  // =========================

  if (trendStatusChart) {

    trendStatusChart.destroy();

    trendStatusChart = null;

  }


  if (!visits || visits.length === 0) {

    return;

  }


  // =====================================================
  // KELOMPOKKAN PASIEN BERDASARKAN BULAN
  // =====================================================

  const monthlyPatients = {};


  visits.forEach(v => {

    if (
      !v.patient_id ||
      !v.tanggal_kunjungan
    ) {
      return;
    }


    // Contoh:
    // 2026-07-15 → 2026-07

    const month =
      v.tanggal_kunjungan.substring(0, 7);


    if (!monthlyPatients[month]) {

      monthlyPatients[month] = {};

    }


    /*
      SATU PASIEN HANYA DIHITUNG 1 KALI
      DALAM SATU BULAN.

      Karena data sudah diurutkan berdasarkan
      tanggal dan created_at secara ascending,
      data berikutnya akan menggantikan data
      sebelumnya.

      Jadi yang tersimpan adalah:
      KUNJUNGAN TERAKHIR PASIEN PADA BULAN TERSEBUT.
    */

    monthlyPatients[month][v.patient_id] = v;

  });


  // =========================
  // URUTKAN BULAN
  // =========================

  const months =
    Object.keys(monthlyPatients).sort();


  // =========================
  // DATA GRAFIK
  // =========================

  const controlledData = [];

  const uncontrolledData = [];


  months.forEach(month => {

    let controlled = 0;

    let uncontrolled = 0;


    const patientsInMonth =
      Object.values(
        monthlyPatients[month]
      );


    patientsInMonth.forEach(v => {

      const gdp =
        v.gdp !== null &&
        v.gdp !== undefined &&
        v.gdp !== ""
          ? Number(v.gdp)
          : null;


      const hba1c =
        v.hba1c !== null &&
        v.hba1c !== undefined &&
        v.hba1c !== ""
          ? Number(v.hba1c)
          : null;


      // =========================
      // DATA TIDAK LENGKAP
      // =========================

      if (
        gdp === null ||
        hba1c === null ||
        isNaN(gdp) ||
        isNaN(hba1c)
      ) {

        uncontrolled++;

        return;

      }


      // =========================
      // DM TERKENDALI
      // =========================

      if (
        gdp < 126 &&
        hba1c < 7
      ) {

        controlled++;

      }


      // =========================
      // DM TIDAK TERKENDALI
      // =========================

      else {

        uncontrolled++;

      }

    });


    controlledData.push(controlled);

    uncontrolledData.push(uncontrolled);

  });


  // =========================
  // FORMAT NAMA BULAN
  // =========================

  const labels = months.map(month => {

    const [
      year,
      monthNumber
    ] = month.split("-");


    const date = new Date(
      Number(year),
      Number(monthNumber) - 1,
      1
    );


    return date.toLocaleDateString(
      "id-ID",
      {
        month: "short",
        year: "numeric"
      }
    );

  });


  // =========================
  // BUAT GRAFIK
  // =========================

  trendStatusChart = new Chart(
    canvas,
    {

      type: "line",


      data: {

        labels: labels,


        datasets: [

          // =========================
          // TERKENDALI
          // =========================

          {
            label: "DM Terkendali",

            data: controlledData,

            tension: 0.3,

            borderWidth: 3,

            pointRadius: 5,

            pointHoverRadius: 7,

            fill: false
          },


          // =========================
          // TIDAK TERKENDALI
          // =========================

          {
            label: "DM Tidak Terkendali",

            data: uncontrolledData,

            tension: 0.3,

            borderWidth: 3,

            pointRadius: 5,

            pointHoverRadius: 7,

            fill: false
          }

        ]

      },


      options: {

        responsive: true,

        maintainAspectRatio: false,


        plugins: {

          legend: {

            position: "top"

          },


          tooltip: {

            callbacks: {

              label: function(context) {

                return (
                  context.dataset.label +
                  ": " +
                  context.parsed.y +
                  " pasien"
                );

              }

            }

          }

        },


        scales: {

          y: {

            beginAtZero: true,

            ticks: {

              stepSize: 1

            },

            title: {

              display: true,

              text: "Jumlah Pasien"

            }

          },


          x: {

            title: {

              display: true,

              text: "Bulan"

            }

          }

        }

      }

    }
  );

}
function printReport() {
  window.print();
}
// ==========================================
// MANAJEMEN PETUGAS
// ==========================================

async function renderDashboardUsers() {

  const tableBody = $("dashboardUsersTableBody");

  if (!tableBody) return;

  const { data, error } = await supabaseClient
    .from("dashboard_users")
    .select("id, nama, role, aktif, created_at")
    .order("created_at", {
      ascending: true
    });

  if (error) {

    console.error(
      "Gagal mengambil data petugas:",
      error
    );

    tableBody.innerHTML = `
      <tr>
        <td colspan="4" class="empty">
          Gagal mengambil data petugas.
        </td>
      </tr>
    `;

    return;
  }

  if (!data || data.length === 0) {

    tableBody.innerHTML = `
      <tr>
        <td colspan="4" class="empty">
          Belum ada petugas terdaftar.
        </td>
      </tr>
    `;

    return;
  }

  tableBody.innerHTML = data.map(user => {

    const statusText =
      user.aktif ? "Aktif" : "Nonaktif";

    return `
      <tr>

        <td>
          <strong>
            ${escapeHtml(user.nama || "Tanpa nama")}
          </strong>
        </td>

        <td>
          ${escapeHtml(user.role || "petugas")}
        </td>

        <td>
          <span class="status ${user.aktif ? "green" : "red"}">
            ${statusText}
          </span>
        </td>

        <td>

          <button
            type="button"
            class="action-btn"
            onclick="toggleDashboardUser('${user.id}', ${user.aktif})"
          >
            ${user.aktif ? "Nonaktifkan" : "Aktifkan"}
          </button>

        </td>

      </tr>
    `;

  }).join("");
}
async function toggleDashboardUser(userId, currentStatus) {

  const currentUser = await getCurrentDashboardUser();

  if (!currentUser || currentUser.role !== "admin") {
    alert("Akses ditolak. Hanya Admin yang dapat mengubah status petugas.");
    return;
  }

  const newStatus = !currentStatus;

  const konfirmasi = confirm(
    newStatus
      ? "Apakah Anda yakin ingin mengaktifkan petugas ini?"
      : "Apakah Anda yakin ingin menonaktifkan petugas ini?"
  );

  if (!konfirmasi) return;

  const { error } = await supabaseClient
    .from("dashboard_users")
    .update({
      aktif: newStatus
    })
    .eq("id", userId);

  if (error) {

    console.error(
      "Gagal mengubah status petugas:",
      error
    );

    alert(
      "Gagal mengubah status petugas: " +
      error.message
    );

    return;
  }

  await renderDashboardUsers();

  alert(
    newStatus
      ? "Petugas berhasil diaktifkan."
      : "Petugas berhasil dinonaktifkan."
  );
}
async function renderActivityLogs() {

  const tableBody = $("activityLogsTableBody");

  if (!tableBody) return;

  const currentUser = await getCurrentDashboardUser();

  if (!currentUser || currentUser.role !== "admin") {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty">
          Akses ditolak. Halaman ini hanya untuk Admin.
        </td>
      </tr>
    `;
    return;
  }

  const { data, error } = await supabaseClient
    .from("activity_logs")
    .select(`
      id,
      nama_petugas,
      aktivitas,
      tabel_data,
      data_id,
      keterangan,
      created_at
    `)
    .order("created_at", {
      ascending: false
    });

  if (error) {

    console.error(
      "Gagal mengambil riwayat aktivitas:",
      error
    );

    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty">
          Gagal mengambil riwayat aktivitas.
        </td>
      </tr>
    `;

    return;
  }

  if (!data || data.length === 0) {

    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty">
          Belum ada aktivitas tercatat.
        </td>
      </tr>
    `;

    return;
  }

  tableBody.innerHTML = data.map(log => {

    const waktu = log.created_at
      ? new Date(log.created_at).toLocaleString("id-ID", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        })
      : "-";

    return `
      <tr>

        <td>
          ${escapeHtml(waktu)}
        </td>

        <td>
          <strong>
            ${escapeHtml(log.nama_petugas || "Tidak diketahui")}
          </strong>
        </td>

        <td>
          ${escapeHtml(log.aktivitas || "-")}
        </td>

        <td>
          ${escapeHtml(log.tabel_data || "-")}
        </td>

        <td>
          ${escapeHtml(log.keterangan || "-")}
        </td>

      </tr>
    `;

  }).join("");
}
async function logActivity(aktivitas, tabelData = null, dataId = null, keterangan = null) {

  try {

    const { data: sessionData } =
      await supabaseClient.auth.getSession();

    const user = sessionData?.session?.user;

    if (!user) {
      console.warn("Tidak ada user login. Aktivitas tidak dicatat.");
      return;
    }

    const currentUser = await getCurrentDashboardUser();

    const { error } = await supabaseClient
      .from("activity_logs")
      .insert({
        user_id: user.id,
        nama_petugas: currentUser?.nama || user.email || "Tidak diketahui",
        aktivitas: aktivitas,
        tabel_data: tabelData,
        data_id: dataId,
        keterangan: keterangan
      });

    if (error) {
      console.error(
        "Gagal mencatat aktivitas:",
        error
      );
    }

  } catch (error) {

    console.error(
      "Error logActivity:",
      error
    );

  }

}
async function getCurrentDashboardUser() {
    const { data: { user }, error } =
        await supabaseClient.auth.getUser();

    if (error || !user) return null;

    const { data, error: userError } = await supabaseClient
        .from("dashboard_users")
        .select("id, nama, role, aktif")
        .eq("id", user.id)
        .single();

    if (userError || !data) return null;

    return data;
}
async function applyRoleAccess() {
    const currentUser = await getCurrentDashboardUser();

    if (!currentUser) return;

    const menuUsers = document.querySelector(
        '.nav-item[data-page="users"]'
    );
    const menuActivity = document.querySelector(
  '.nav-item[data-page="activity"]'
);

    if (currentUser.role !== "admin") {

  if (menuUsers) {
    menuUsers.style.display = "none";
  }

  if (menuActivity) {
    menuActivity.style.display = "none";
  }

} else {

  if (menuUsers) {
    menuUsers.style.display = "flex";
  }

  if (menuActivity) {
    menuActivity.style.display = "flex";
  }

}
}
// ==========================================
// TAMBAH PETUGAS
// ==========================================

function openPetugasModal() {

  const modal = $("petugasModal");

  if (!modal) return;

  $("petugasForm").reset();

  modal.classList.add("show");
}


function closePetugasModal() {

  const modal = $("petugasModal");

  if (!modal) return;

  modal.classList.remove("show");
}


// ==========================================
// SUBMIT TAMBAH PETUGAS
// ==========================================

async function addPetugas(e) {

  e.preventDefault();

  const nama =
    $("petugasNama").value.trim();

  const email =
    $("petugasEmail").value.trim().toLowerCase();


  if (!nama || !email) {

    alert(
      "Nama dan email petugas wajib diisi."
    );

    return;
  }


  // =========================
  // CEK USER SAAT INI
  // =========================

  const currentUser =
    await getCurrentDashboardUser();


  if (!currentUser) {

    alert(
      "Sesi login tidak ditemukan."
    );

    return;
  }


  if (
    currentUser.role !== "admin" ||
    currentUser.aktif !== true
  ) {

    alert(
      "Akses ditolak. Hanya Admin yang dapat menambahkan petugas."
    );

    return;
  }


  // =========================
  // TOMBOL
  // =========================

  const submitButton =
    document.querySelector(
      "#petugasForm button[type='submit']"
    );


  if (submitButton) {

    submitButton.disabled = true;

    submitButton.textContent =
      "Membuat akun...";
  }


  try {

    // =========================
    // PANGGIL EDGE FUNCTION
    // =========================

    const { data: sessionData, error: sessionError } =
    await supabaseClient.auth.getSession();

if (sessionError || !sessionData.session) {
    alert("Sesi login sudah tidak valid. Silakan login kembali.");
    return;
}

const accessToken = sessionData.session.access_token;

const { data, error } =
    await supabaseClient.functions.invoke(
        "create-dashboard-user",
        {
            headers: {
                Authorization: `Bearer ${accessToken}`
            },
            body: {
                nama,
                email
            }
        }
    );


    if (error) {
  console.error("Error Edge Function:", error);

  let detail = error.message;

  try {
    if (error.context) {
      const body = await error.context.json();
      console.error("Response Edge Function:", body);

      if (body?.error) {
        detail = body.error;
      } else if (body?.message) {
        detail = body.message;
      }
    }
  } catch (e) {
    console.error("Tidak bisa membaca response:", e);
  }

  alert("Gagal membuat petugas:\n\n" + detail);
  return;
}


    if (!data || !data.success) {

      alert(
        data?.error ||
        "Petugas gagal dibuat."
      );

      return;
    }


    // =========================
    // BERHASIL
    // =========================

    closePetugasModal();

    await renderDashboardUsers();


    alert(
      "Petugas berhasil dibuat.\n\n" +
      "Email undangan telah dikirim ke:\n" +
      email
    );


  } catch (error) {

    console.error(error);

    alert(
      "Terjadi kesalahan: " +
      error.message
    );

  } finally {

    if (submitButton) {

      submitButton.disabled = false;

      submitButton.textContent =
        "Buat Petugas";
    }

  }

}


// ==========================================
// EVENT FORM
// ==========================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const form =
      $("petugasForm");

    if (form) {

      form.addEventListener(
        "submit",
        addPetugas
      );

    }

  }
);