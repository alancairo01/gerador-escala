const ROLES = [
  "Controlador de Operações",
  "Supervisor Técnico",
  "Téc.sistema Audio visual",
  "Eletricista",
];

const WEEKDAYS = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];

const DEFAULT_COLORS = {
  header: "#fff200",
  weekday: "#ffffff",
  name: "#ffffff",
  cargo: "#b8dd61",
  sunday: "#e7f199",
  defaultCell: "#e7f199",
  emptyCell: "#dbe88b",
  folga: "#ff820f",
  compensando: "#9fc5e8",
  curso: "#fff173",
  viagem: "#f8fafc",
  t00: "#ff000d",
  t06: "#d395a6",
  t09: "#7eba72",
  t12: "#76bb68",
  t18: "#d9ef6a",
};

const DEFAULT_STATE = {
  config: {
    dataInicial: "",
    quantidadeSemanas: 2,
    descansoMinimo: "11:30",
    domingoAutomatico: "padrao",
    modoGeracao: "manual",
    validacaoCobertura: "tecnicos",
  },
  employees: [
    { nome: "Giordano Casagranda", cargo: "Controlador de Operações" },
    { nome: "Cladeylton", cargo: "Supervisor Técnico" },
    { nome: "Felipe Oliveira", cargo: "Supervisor Técnico" },
    { nome: "Alan Cairo", cargo: "Téc.sistema Audio visual" },
    { nome: "Bruno Martins", cargo: "Téc.sistema Audio visual" },
    { nome: "Gabryel Castro", cargo: "Téc.sistema Audio visual" },
    { nome: "Igor Veras", cargo: "Téc.sistema Audio visual" },
    { nome: "", cargo: "Téc.sistema Audio visual" },
    { nome: "", cargo: "Eletricista" },
  ],
  shifts: {
    "Controlador de Operações": [
      { inicio: "09:00", fim: "18:00" },
      { inicio: "06:00", fim: "14:20" },
    ],
    "Supervisor Técnico": [
      { inicio: "06:00", fim: "14:20" },
      { inicio: "12:00", fim: "20:20" },
    ],
    "Téc.sistema Audio visual": [
      { inicio: "06:00", fim: "12:00" },
      { inicio: "12:00", fim: "18:00" },
      { inicio: "18:00", fim: "00:00" },
      { inicio: "00:00", fim: "06:00" },
    ],
    "Eletricista": [
      { inicio: "08:00", fim: "17:00" },
    ],
  },
  manualCells: {},
  cellColors: {},
  manualSundayCounts: {},
  colors: { ...DEFAULT_COLORS },
  schedule: [],
  sundayCounts: {},
  savedAt: null,
};

let state = structuredClone(DEFAULT_STATE);
let currentCell = null;
let saveTimer = null;
let selectMode = false;
let selectedCells = new Set();
const TECH_ROLE = "Téc.sistema Audio visual";

const FIXED_SHIFT_COLORS = {
  "00:00": "#ff000d",
  "06:00": "#d395a6",
  "12:00": "#76bb68",
  "18:00": "#d9ef6a",
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();
  await loadState();
  applyStateToFields();
  applyCustomColors();
  renderEmployeesEditor();
  renderShiftsEditor();
  renderColorEditor();
  if (state.schedule && state.schedule.length) {
    renderSchedule();
    hideValidationToast();
    setStatus("Escala carregada do sistema.");
  } else {
    generateSchedule();
  }
}

function bindEvents() {
  $("#btnGerar").addEventListener("click", generateSchedule);
  $("#btnValidarRegras").addEventListener("click", () => validateAllRules(true));
  $("#btnSelectAll").addEventListener("click", selectAllCells);
  $("#btnClearSelection").addEventListener("click", clearSelection);
  $("#btnSelectMode").addEventListener("click", toggleSelectMode);
  $("#btnEditSelected").addEventListener("click", openBulkCellEditor);
  $("#btnSalvar").addEventListener("click", () => saveState(true));
  $("#btnColaboradores").addEventListener("click", () => openModal("modalColaboradores"));
  $("#btnHorarios").addEventListener("click", () => {
    renderShiftsEditor();
    openModal("modalHorarios");
  });
  $("#btnCores").addEventListener("click", () => {
    renderColorEditor();
    openModal("modalCores");
  });
  $("#btnSaveColors").addEventListener("click", saveColorsFromEditor);
  $("#btnResetColors").addEventListener("click", resetColors);
  $("#btnAddEmployee").addEventListener("click", addEmployee);
  $("#btnAddBlank").addEventListener("click", addBlankLine);
  $("#btnSaveShifts").addEventListener("click", () => {
    readShiftsFromEditor();
    closeModal("modalHorarios");
    generateSchedule();
  });
  $("#btnLimparAjustes").addEventListener("click", clearManualCells);
  $("#btnCSV").addEventListener("click", exportCSV);
  $("#btnExportarJPEG").addEventListener("click", () => exportJPEG(false));
  $("#btnWhatsApp").addEventListener("click", () => exportJPEG(true));
  $("#btnImprimir").addEventListener("click", () => window.print());

  ["dataInicial", "quantidadeSemanas", "descansoMinimo", "domingoAutomatico", "modoGeracao", "validacaoCobertura"].forEach(id => {
    const field = $(`#${id}`);
    if (!field) return;
    field.addEventListener("change", () => {
      readFieldsToState();
      generateSchedule();
    });
  });

  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => closeModal(btn.dataset.close));
  });

  document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", e => {
      if (e.target === modal) closeModal(modal.id);
    });
  });

  document.querySelectorAll(".quick").forEach(btn => {
    btn.addEventListener("click", () => {
      $("#cellCustomText").value = btn.dataset.value;
      saveCurrentCell(btn.dataset.value);
    });
  });

  $("#btnApplyPreset").addEventListener("click", () => {
    const value = $("#presetShiftSelect").value;
    if (!value) return;
    $("#cellCustomText").value = value;
    const parsed = parseCellTime(value);
    if (parsed) {
      $("#cellStart").value = parsed.start;
      $("#cellEnd").value = parsed.end;
    }
    saveCurrentCell(value);
  });

  $("#btnApplyTime").addEventListener("click", () => {
    const text = `${$("#cellStart").value} – ${$("#cellEnd").value}`;
    $("#cellCustomText").value = text;
    saveCurrentCell(text);
  });

  $("#btnSaveCell").addEventListener("click", () => saveCurrentCell($("#cellCustomText").value.trim()));
  $("#btnClearCell").addEventListener("click", () => clearCurrentCell());
  $("#btnApplyCellColor").addEventListener("click", () => saveCurrentCellColor($("#cellColor").value));
  $("#btnClearCellColor").addEventListener("click", clearCurrentCellColor);
}

async function loadState() {
  try {
    const response = await fetch("/api/state");
    if (response.ok) {
      const saved = await response.json();
      if (saved && Object.keys(saved).length) {
        state = mergeState(DEFAULT_STATE, saved);
        return;
      }
    }
  } catch (error) {
    console.warn("API indisponível, usando localStorage.", error);
  }

  const local = localStorage.getItem("escalaAutoStateV12");
  if (local) {
    try {
      state = mergeState(DEFAULT_STATE, JSON.parse(local));
    } catch (error) {
      state = structuredClone(DEFAULT_STATE);
    }
  }

  if (!state.config.dataInicial) {
    state.config.dataInicial = startOfWeekSunday(new Date()).toISOString().slice(0, 10);
  }
}

function mergeState(base, incoming) {
  return {
    ...structuredClone(base),
    ...incoming,
    config: { ...base.config, ...(incoming.config || {}) },
    employees: incoming.employees || base.employees,
    shifts: { ...base.shifts, ...(incoming.shifts || {}) },
    manualCells: incoming.manualCells || {},
    cellColors: incoming.cellColors || {},
    manualSundayCounts: incoming.manualSundayCounts || {},
    colors: { ...DEFAULT_COLORS, ...(incoming.colors || {}) },
    schedule: incoming.schedule || [],
    sundayCounts: incoming.sundayCounts || {},
  };
}

function applyStateToFields() {
  if (!state.config.dataInicial) {
    state.config.dataInicial = startOfWeekSunday(new Date()).toISOString().slice(0, 10);
  }
  $("#dataInicial").value = state.config.dataInicial;
  $("#quantidadeSemanas").value = state.config.quantidadeSemanas;
  $("#descansoMinimo").value = state.config.descansoMinimo;
  $("#domingoAutomatico").value = state.config.domingoAutomatico;
  if ($("#modoGeracao")) $("#modoGeracao").value = state.config.modoGeracao || "manual";
  if ($("#validacaoCobertura")) $("#validacaoCobertura").value = state.config.validacaoCobertura || "tecnicos";
}

function readFieldsToState() {
  state.config.dataInicial = $("#dataInicial").value;
  state.config.quantidadeSemanas = Number($("#quantidadeSemanas").value);
  state.config.descansoMinimo = $("#descansoMinimo").value;
  state.config.domingoAutomatico = $("#domingoAutomatico").value;
  if ($("#modoGeracao")) state.config.modoGeracao = $("#modoGeracao").value;
  if ($("#validacaoCobertura")) state.config.validacaoCobertura = $("#validacaoCobertura").value;
}

async function saveState(showMessage = false) {
  state.savedAt = new Date().toISOString();
  localStorage.setItem("escalaAutoStateV12", JSON.stringify(state));

  try {
    const response = await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });

    if (!response.ok) throw new Error("Falha ao salvar no servidor.");
    setStatus("Salvo no sistema.");
    if (showMessage) showAlert("Informações salvas no sistema com sucesso.");
  } catch (error) {
    setStatus("Salvo apenas no navegador.");
    if (showMessage) showAlert("Não consegui salvar no arquivo do sistema. Salvei no navegador.", true);
  }
}

function autoSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveState(false), 450);
}

function setStatus(text) {
  $("#saveStatus").textContent = text;
}

function showAlert(text, warning = false) {
  const box = $("#alertBox");
  box.textContent = text;
  box.classList.remove("hidden");
  box.style.background = warning ? "#fff8db" : "#e8f5e9";
  box.style.borderColor = warning ? "#fedf89" : "#abefc6";
  box.style.color = warning ? "#7a4b00" : "#067647";
  setTimeout(() => box.classList.add("hidden"), 4200);
}

function generateSchedule() {
  readFieldsToState();

  const start = parseDateLocal(state.config.dataInicial);
  if (!start) return;

  const totalDays = Number(state.config.quantidadeSemanas) * 7;
  const minRest = timeToMinutes(state.config.descansoMinimo || "11:30");
  const lastEnd = {};
  const rotation = {};
  const weeklyWorkDays = {};
  state.schedule = [];
  state.sundayCounts = {};

  state.employees.forEach(e => {
    if (e.nome) {
      state.sundayCounts[e.nome] = 0;
      weeklyWorkDays[e.nome] = {};
    }
  });

  if (state.config.modoGeracao === "manual") {
    for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
      const date = addDays(start, dayIndex);
      const dateKey = toInputDate(date);
      const day = {
        date: dateKey,
        assignments: {},
        warnings: [],
      };

      state.employees.forEach(employee => {
        if (!employee.nome) return;
        day.assignments[employee.nome] = getManual(employee.nome, dateKey) || "";
      });

      state.schedule.push(day);
    }

    recomputeSundayCountsFromManualCells();
    renderSchedule();
    hideValidationToast();
    autoSave();
    showAlert("Escala manual criada com horários vazios. Preencha os campos e clique em Validar regras quando terminar.");
    return;
  }

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
    const date = addDays(start, dayIndex);
    const dateKey = toInputDate(date);
    const weekIndex = Math.floor(dayIndex / 7);
    const isSunday = date.getDay() === 0;
    const sundayPolicy = state.config.domingoAutomatico;

    const day = {
      date: dateKey,
      assignments: {},
      warnings: [],
    };

    for (const role of ROLES) {
      const employees = state.employees.filter(e => e.nome && e.cargo === role);
      const shifts = (state.shifts[role] || []).map(s => parseShift(s.inicio, s.fim));
      if (rotation[role] === undefined) rotation[role] = 0;

      if (isSunday && sundayPolicy === "folga") {
        employees.forEach(e => {
          const manual = getManual(e.nome, dateKey);
          day.assignments[e.nome] = manual || "FOLGA";
          if (manual && parseCellTime(manual) && !isBlock(manual)) {
            const parsed = parseCellTime(manual);
            const shift = parseShift(parsed.start, parsed.end);
            lastEnd[e.nome] = absoluteEnd(date, shift);
            markWeeklyWorkDay(weeklyWorkDays, e.nome, weekIndex, dateKey);
            state.sundayCounts[e.nome] = (state.sundayCounts[e.nome] || 0) + 1;
          }
        });
        continue;
      }

      if (isSunday && sundayPolicy === "padrao" && role !== TECH_ROLE) {
        employees.forEach(e => {
          const manual = getManual(e.nome, dateKey);
          day.assignments[e.nome] = manual || "FOLGA";
          if (manual && parseCellTime(manual) && !isBlock(manual)) {
            const parsed = parseCellTime(manual);
            const shift = parseShift(parsed.start, parsed.end);
            lastEnd[e.nome] = absoluteEnd(date, shift);
            markWeeklyWorkDay(weeklyWorkDays, e.nome, weekIndex, dateKey);
          }
        });
        continue;
      }

      for (const shift of shifts) {
        if (isSunday && role === TECH_ROLE && shift.start === "00:00" && shift.end === "06:00") {
          continue;
        }

        const chosen = chooseEmployee(employees, role, date, day, shift, minRest, lastEnd, rotation, weeklyWorkDays, weekIndex);
        if (chosen) {
          day.assignments[chosen.nome] = shift.label;
          lastEnd[chosen.nome] = absoluteEnd(date, shift);
          markWeeklyWorkDay(weeklyWorkDays, chosen.nome, weekIndex, dateKey);
          if (isSunday && role === TECH_ROLE) {
            state.sundayCounts[chosen.nome] = (state.sundayCounts[chosen.nome] || 0) + 1;
          }
        } else if (employees.length) {
          day.warnings.push(`${role}: sem disponível para ${shift.label}`);
        }
      }

      employees.forEach(e => {
        const manual = getManual(e.nome, dateKey);
        if (manual) {
          day.assignments[e.nome] = manual;
          const parsed = parseCellTime(manual);
          if (parsed && !isBlock(manual)) {
            const manualShift = parseShift(parsed.start, parsed.end);
            lastEnd[e.nome] = absoluteEnd(date, manualShift);
            markWeeklyWorkDay(weeklyWorkDays, e.nome, weekIndex, dateKey);
            if (isSunday && role === TECH_ROLE) {
              state.sundayCounts[e.nome] = (state.sundayCounts[e.nome] || 0) + 1;
            }
          }
        }

        if (!day.assignments[e.nome]) {
          day.assignments[e.nome] = "FOLGA";
        }
      });
    }

    state.schedule.push(day);
  }

  recomputeSundayCountsFromManualCells();
  renderSchedule();
  hideValidationToast();
  autoSave();
  showAlert("Escala gerada. Clique em Validar regras para conferir pendências.");
}


function recomputeSundayCountsFromManualCells() {
  state.sundayCounts = {};
  state.employees.forEach(e => {
    if (e.nome) state.sundayCounts[e.nome] = 0;
  });

  for (const employee of state.employees) {
    if (!employee.nome || employee.cargo !== TECH_ROLE) continue;

    for (const day of state.schedule) {
      const date = parseDateLocal(day.date);
      if (!date || date.getDay() !== 0) continue;

      const value = getManual(employee.nome, day.date) || day.assignments[employee.nome] || "";
      if (parseCellTime(value) && !isBlock(value)) {
        state.sundayCounts[employee.nome] = (state.sundayCounts[employee.nome] || 0) + 1;
      }
    }
  }
}

function chooseEmployee(employees, role, date, day, shift, minRest, lastEnd, rotation, weeklyWorkDays, weekIndex) {
  if (!employees.length) return null;

  if (state.config.modoGeracao === "aleatoria") {
    const candidates = shuffleArray([...employees]).filter(employee =>
      canWork(employee, date, day, shift, minRest, lastEnd, weeklyWorkDays, weekIndex)
    );
    return candidates[0] || null;
  }

  for (let attempt = 0; attempt < employees.length; attempt++) {
    const index = (rotation[role] + attempt) % employees.length;
    const employee = employees[index];

    if (canWork(employee, date, day, shift, minRest, lastEnd, weeklyWorkDays, weekIndex)) {
      rotation[role] = (index + 1) % employees.length;
      return employee;
    }
  }

  return null;
}

function shuffleArray(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function canWork(employee, date, day, shift, minRest, lastEnd, weeklyWorkDays, weekIndex) {
  if (day.assignments[employee.nome]) return false;

  const manual = getManual(employee.nome, toInputDate(date));
  if (manual) return false;

  if (getWeeklyWorkCount(weeklyWorkDays, employee.nome, weekIndex) >= 6) {
    return false;
  }

  const startAbs = absoluteStart(date, shift);
  const previousEnd = lastEnd[employee.nome];

  if (previousEnd !== undefined && (startAbs - previousEnd) < minRest) {
    return false;
  }

  return true;
}

function markWeeklyWorkDay(weeklyWorkDays, employeeName, weekIndex, dateKey) {
  if (!employeeName) return;
  if (!weeklyWorkDays[employeeName]) weeklyWorkDays[employeeName] = {};
  if (!weeklyWorkDays[employeeName][weekIndex]) weeklyWorkDays[employeeName][weekIndex] = new Set();
  weeklyWorkDays[employeeName][weekIndex].add(dateKey);
}

function getWeeklyWorkCount(weeklyWorkDays, employeeName, weekIndex) {
  if (!weeklyWorkDays[employeeName] || !weeklyWorkDays[employeeName][weekIndex]) return 0;
  return weeklyWorkDays[employeeName][weekIndex].size;
}

function isBlock(value) {
  const text = String(value).toUpperCase();
  return text.includes("FOLGA") || text.includes("CURSO") || text.includes("VIAGEM") || text.includes("COMPENS");
}

function renderSchedule() {
  const container = $("#schedulePreview");
  container.innerHTML = "";

  const weeks = chunk(state.schedule, 7);
  for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
    const week = weeks[weekIndex];
    const table = document.createElement("table");
    table.className = "scale-table";
    table.innerHTML = buildWeekTable(week, weekIndex);
    container.appendChild(table);
  }

  document.querySelectorAll(".status-cell").forEach(cell => {
    cell.addEventListener("click", () => {
      if (selectMode) {
        toggleCellSelection(cell);
      } else {
        openCellEditor(cell);
      }
    });
  });

  document.querySelectorAll(".sunday-select").forEach(select => {
    select.addEventListener("change", () => {
      const parsed = parseSundaySelectKey(select.dataset.key);
      const value = Number(select.value);

      if (parsed) {
        applySundayCountSequence(parsed.name, parsed.weekIndex, value);
      } else {
        state.manualSundayCounts[select.dataset.key] = value;
      }

      renderSchedule();
      hideValidationToast();
      autoSave();
    });
  });
}

function buildWeekTable(week, weekIndex) {
  const headerDates = week.map(day => `<th class="day-col" style="background:${state.colors.header}"><div class="cell">${formatDateBR(parseDateLocal(day.date))}</div></th>`).join("");
  const weekdays = week.map(day => `<td class="weekday" style="background:${state.colors.weekday}"><div class="cell">${WEEKDAYS[parseDateLocal(day.date).getDay()]}</div></td>`).join("");

  const rows = state.employees.map(employee => {
    const days = week.map(day => {
      const value = getManual(employee.nome, day.date) || day.assignments[employee.nome] || "";
      const cls = classForValue(value);
      const key = cellKey(employee.nome, day.date);
      const selected = selectedCells.has(key) ? " selected" : "";
      const bg = getCellBackground(employee.nome, day.date, value);
      return `<td class="status-cell ${cls}${selected}" style="background:${bg}" data-key="${escapeAttr(key)}" data-name="${escapeAttr(employee.nome)}" data-date="${day.date}" data-value="${escapeAttr(value)}"><div class="cell">${escapeHtml(value)}</div></td>`;
    }).join("");

    const sunday = buildSundaySelect(employee, week, weekIndex);
    return `
      <tr>
        <td class="name-col" style="background:${state.colors.name}"><div class="cell">${escapeHtml(employee.nome)}</div></td>
        <td class="role-col" style="background:${state.colors.cargo}"><div class="cell">${escapeHtml(employee.cargo)}</div></td>
        ${days}
        <td class="sunday-col default-cell" style="background:${state.colors.sunday}"><div class="cell sunday-cell">${sunday}</div></td>
      </tr>
    `;
  }).join("");

  return `
    <thead>
      <tr>
        <th class="name-col" rowspan="2" style="background:${state.colors.header}"><div class="cell">Colaboradores</div></th>
        <th class="role-col" rowspan="2" style="background:${state.colors.header}"><div class="cell">Cargo</div></th>
        ${headerDates}
        <th class="sunday-col" rowspan="2" style="background:${state.colors.header}"><div class="cell">QUANTIDADE DE DOMINGO<br>NO MÊS</div></th>
      </tr>
      <tr>${weekdays}</tr>
    </thead>
    <tbody>${rows}</tbody>
  `;
}

function buildSundaySelect(employee, week, weekIndex) {
  if (!employee.nome) return "";
  if (employee.cargo !== TECH_ROLE) return '<span class="sunday-empty"></span>';
  const value = getSundayCountValue(employee.nome, weekIndex);
  const key = `${employee.nome}|${weekIndex}`;
  return `
    <select class="sunday-select" data-key="${escapeAttr(key)}" aria-label="Quantidade de domingos">
      ${[0, 1, 2, 3].map(n => `<option value="${n}" ${Number(value) === n ? "selected" : ""}>${n}º</option>`).join("")}
    </select>
  `;
}

function getSundayCountValue(name, weekIndex) {
  const key = `${name}|${weekIndex}`;
  if (state.manualSundayCounts && state.manualSundayCounts[key] !== undefined) {
    return Number(state.manualSundayCounts[key]);
  }
  const sequenceMap = getConsecutiveSundayMap();
  return Math.min(sequenceMap[name]?.[weekIndex] || 0, 3);
}

function parseSundaySelectKey(key) {
  if (!key) return null;
  const parts = String(key).split("|");
  const weekIndex = Number(parts.pop());
  const name = parts.join("|");

  if (!name || Number.isNaN(weekIndex)) return null;

  return { name, weekIndex };
}

function applySundayCountSequence(name, startWeekIndex, startValue) {
  const weeks = chunk(state.schedule, 7);
  let currentValue = Number(startValue);

  for (let weekIndex = startWeekIndex; weekIndex < weeks.length; weekIndex++) {
    const key = `${name}|${weekIndex}`;

    if (currentValue <= 0) {
      state.manualSundayCounts[key] = 0;
    } else {
      state.manualSundayCounts[key] = Math.min(currentValue, 3);
      currentValue += 1;
    }
  }
}

function getConsecutiveSundayMap() {
  const weeks = chunk(state.schedule, 7);
  const map = {};

  state.employees.filter(e => e.nome && e.cargo === TECH_ROLE).forEach(employee => {
    let sequence = 0;
    map[employee.nome] = {};
    weeks.forEach((week, weekIndex) => {
      const sundayDay = week.find(d => parseDateLocal(d.date).getDay() === 0);
      const value = sundayDay ? (getManual(employee.nome, sundayDay.date) || sundayDay.assignments[employee.nome] || "") : "";
      const worked = !!parseCellTime(value) && !isBlock(value);
      if (worked) {
        sequence += 1;
        map[employee.nome][weekIndex] = Math.min(sequence, 3);
      } else {
        sequence = 0;
        map[employee.nome][weekIndex] = 0;
      }
    });
  });

  return map;
}

function openCellEditor(cell) {
  const name = cell.dataset.name;
  if (!name) return;

  const date = cell.dataset.date;
  const value = getManual(name, date) || cell.dataset.value || "";

  if (selectedCells.size && selectedCells.has(cell.dataset.key)) {
    const targets = [...selectedCells].map(parseCellKey).filter(Boolean);
    currentCell = { targets };
    $("#cellInfo").textContent = `${targets.length} célula(s) selecionada(s). A alteração será aplicada em todas.`;
    $("#cellCustomText").value = "";
    $("#cellColor").value = state.colors.defaultCell;
    populatePresetShiftSelect(targets);
    openModal("modalCell");
    return;
  }

  currentCell = { targets: [{ name, date }] };
  $("#cellInfo").textContent = `${name} — ${formatDateBR(parseDateLocal(date))}`;
  $("#cellCustomText").value = value;
  $("#cellColor").value = getCellBackground(name, date, value);
  populatePresetShiftSelect(currentCell.targets);

  const parsed = parseCellTime(value);
  if (parsed) {
    $("#cellStart").value = parsed.start;
    $("#cellEnd").value = parsed.end;
  }

  openModal("modalCell");
}

function saveCurrentCell(value) {
  if (!currentCell || !currentCell.targets || !currentCell.targets.length) return;

  currentCell.targets.forEach(target => {
    const key = cellKey(target.name, target.date);
    if (value) {
      state.manualCells[key] = value;
      const parsed = parseCellTime(value);
      if (parsed) {
        state.cellColors[key] = getFixedShiftColor(parsed.start);
      }
    } else {
      delete state.manualCells[key];
      delete state.cellColors[key];
    }
  });

  closeModal("modalCell");
  finishMultiSelectionIfNeeded();
  recomputeSundayCountsFromManualCells();
  renderSchedule();
  hideValidationToast();
  autoSave();
}

function clearCurrentCell() {
  if (!currentCell || !currentCell.targets || !currentCell.targets.length) return;
  currentCell.targets.forEach(target => delete state.manualCells[cellKey(target.name, target.date)]);
  closeModal("modalCell");
  finishMultiSelectionIfNeeded();
  recomputeSundayCountsFromManualCells();
  renderSchedule();
  hideValidationToast();
  autoSave();
}

function saveCurrentCellColor(color) {
  if (!currentCell || !currentCell.targets || !currentCell.targets.length || !color) return;
  currentCell.targets.forEach(target => {
    state.cellColors[cellKey(target.name, target.date)] = color;
  });
  closeModal("modalCell");
  finishMultiSelectionIfNeeded();
  renderSchedule();
  hideValidationToast();
  autoSave();
}

function clearCurrentCellColor() {
  if (!currentCell || !currentCell.targets || !currentCell.targets.length) return;
  currentCell.targets.forEach(target => {
    delete state.cellColors[cellKey(target.name, target.date)];
  });
  closeModal("modalCell");
  finishMultiSelectionIfNeeded();
  renderSchedule();
  hideValidationToast();
  autoSave();
}


function toggleSelectMode() {
  selectMode = !selectMode;
  updateSelectModeUI();

  if (!selectMode) {
    selectedCells.clear();
    renderSchedule();
  } else {
    showAlert("Modo de seleção ativado. Clique nos dias que deseja alterar e depois em Editar selecionados.");
  }
}

function updateSelectModeUI() {
  const btn = $("#btnSelectMode");
  if (!btn) return;
  btn.classList.toggle("active", selectMode);
  btn.textContent = selectMode ? `Selecionando (${selectedCells.size})` : "Selecionar dias";
}

function selectAllCells() {
  selectedCells = new Set(
    [...document.querySelectorAll('.status-cell')]
      .filter(cell => cell.dataset.name)
      .map(cell => cell.dataset.key)
  );
  selectMode = true;
  renderSchedule();
  updateSelectModeUI();
  showAlert(`${selectedCells.size} célula(s) selecionada(s). Clique em Editar selecionados para aplicar a mudança em lote.`);
}

function clearSelection() {
  selectedCells.clear();
  selectMode = false;
  renderSchedule();
  updateSelectModeUI();
}

function toggleCellSelection(cell) {
  const key = cell.dataset.key;
  if (!key || !cell.dataset.name) return;

  if (selectedCells.has(key)) {
    selectedCells.delete(key);
    cell.classList.remove("selected");
  } else {
    selectedCells.add(key);
    cell.classList.add("selected");
  }

  updateSelectModeUI();
}

function openBulkCellEditor() {
  if (!selectedCells.size) {
    showAlert("Selecione as células desejadas ou use Selecionar tudo.", true);
    return;
  }

  const targets = [...selectedCells].map(parseCellKey).filter(Boolean);
  currentCell = { targets };

  $("#cellInfo").textContent = `${targets.length} célula(s) selecionada(s). A alteração será aplicada em todas.`;
  $("#cellCustomText").value = "";
  $("#cellColor").value = state.colors.defaultCell;
  populatePresetShiftSelect(targets);
  openModal("modalCell");
}

function parseCellKey(key) {
  if (!key || key.length < 12) return null;
  const date = key.slice(-10);
  const name = key.slice(0, -11);
  return { name, date };
}

function finishMultiSelectionIfNeeded() {
  if (currentCell && currentCell.targets && currentCell.targets.length > 1) {
    selectedCells.clear();
    selectMode = false;
    updateSelectModeUI();
  }
  currentCell = null;
}

function populatePresetShiftSelect(targets = []) {
  const select = $("#presetShiftSelect");
  if (!select) return;

  const targetRoles = new Set(
    targets.map(t => findEmployee(t.name)?.cargo).filter(Boolean)
  );

  const options = [];
  const seen = new Set();

  const addRoleShifts = (role, destaque = false) => {
    (state.shifts[role] || []).forEach(shift => {
      const label = `${shift.inicio} – ${shift.fim}`;
      const unique = `${role}|${label}`;
      if (seen.has(unique)) return;
      seen.add(unique);
      options.push({ value: label, text: `${label} — ${role}${destaque ? "" : ""}` });
    });
  };

  // Primeiro mostra os horários do cargo da pessoa selecionada; depois todos os demais.
  targetRoles.forEach(role => addRoleShifts(role, true));
  ROLES.filter(role => !targetRoles.has(role)).forEach(role => addRoleShifts(role, false));

  select.innerHTML = `<option value="">Selecione um horário...</option>` +
    options.map(opt => `<option value="${escapeAttr(opt.value)}">${escapeHtml(opt.text)}</option>`).join("");
}

function findEmployee(name) {
  return state.employees.find(e => e.nome === name);
}

function clearManualCells() {
  if (!confirm("Deseja limpar todos os ajustes manuais da escala?")) return;
  state.manualCells = {};
  generateSchedule();
}

function getManual(name, date) {
  return state.manualCells[cellKey(name, date)];
}

function cellKey(name, date) {
  return `${name}|${date}`;
}

function renderEmployeesEditor() {
  const area = $("#employeesEditor");
  area.innerHTML = "";

  state.employees.forEach((employee, index) => {
    const row = document.createElement("div");
    row.className = "editor-row";

    const input = document.createElement("input");
    input.value = employee.nome;
    input.placeholder = "Nome";
    input.addEventListener("input", e => {
      migrateManualCells(employee.nome, e.target.value);
      state.employees[index].nome = e.target.value;
      autoSave();
    });

    const select = document.createElement("select");
    ROLES.forEach(role => {
      const option = document.createElement("option");
      option.value = role;
      option.textContent = role;
      if (role === employee.cargo) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener("change", e => {
      state.employees[index].cargo = e.target.value;
      autoSave();
    });

    const remove = document.createElement("button");
    remove.className = "remove-btn";
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      state.employees.splice(index, 1);
      renderEmployeesEditor();
      generateSchedule();
    });

    row.append(input, select, remove);
    area.appendChild(row);
  });
}

function addEmployee() {
  const nome = $("#novoNome").value.trim();
  const cargo = $("#novoCargo").value;
  state.employees.push({ nome, cargo });
  $("#novoNome").value = "";
  renderEmployeesEditor();
  generateSchedule();
}

function addBlankLine() {
  state.employees.push({ nome: "", cargo: "Téc.sistema Audio visual" });
  renderEmployeesEditor();
  generateSchedule();
}

function migrateManualCells(oldName, newName) {
  if (!oldName || oldName === newName) return;
  const updated = {};
  Object.entries(state.manualCells).forEach(([key, value]) => {
    const [name, date] = key.split("|");
    updated[name === oldName ? `${newName}|${date}` : key] = value;
  });
  state.manualCells = updated;
}

function renderShiftsEditor() {
  const area = $("#shiftsEditor");
  area.innerHTML = "";

  ROLES.forEach(role => {
    const section = document.createElement("section");
    section.className = "shift-section";
    section.dataset.role = role;

    const title = document.createElement("h4");
    title.textContent = role;

    const list = document.createElement("div");
    list.className = "shift-list";

    (state.shifts[role] || []).forEach(shift => list.appendChild(createShiftRow(shift.inicio, shift.fim)));

    const add = document.createElement("button");
    add.className = "btn";
    add.textContent = "Adicionar horário";
    add.addEventListener("click", () => list.appendChild(createShiftRow("06:00", "12:00")));

    section.append(title, list, add);
    area.appendChild(section);
  });
}

function createShiftRow(start, end) {
  const row = document.createElement("div");
  row.className = "shift-row";
  row.innerHTML = `
    <input type="time" class="shift-start" value="${start}">
    <input type="time" class="shift-end" value="${end}">
    <button class="remove-btn" type="button">×</button>
  `;
  row.querySelector(".remove-btn").addEventListener("click", () => row.remove());
  return row;
}

function readShiftsFromEditor() {
  document.querySelectorAll(".shift-section").forEach(section => {
    const role = section.dataset.role;
    state.shifts[role] = [...section.querySelectorAll(".shift-row")].map(row => ({
      inicio: row.querySelector(".shift-start").value,
      fim: row.querySelector(".shift-end").value,
    })).filter(s => s.inicio && s.fim);
  });
  autoSave();
}

function renderColorEditor() {
  const area = $("#colorEditor");
  if (!area) return;

  const items = [
    ["header", "Cabeçalho da tabela"],
    ["weekday", "Dias da semana"],
    ["name", "Coluna Colaboradores"],
    ["cargo", "Coluna Cargo"],
    ["sunday", "Quantidade de domingos"],
    ["defaultCell", "Horários / padrão"],
    ["emptyCell", "Célula vazia"],
    ["folga", "FOLGA"],
    ["compensando", "COMPENSANDO"],
    ["curso", "CURSO"],
    ["viagem", "VIAGEM"],
    ["t00", "Turno 00:00"],
    ["t06", "Turno 06:00"],
    ["t09", "Turno 09:00"],
    ["t12", "Turno 12:00"],
    ["t18", "Turno 18:00"],
  ];

  area.innerHTML = items.map(([key, label]) => `
    <label class="color-item">
      <span>${label}</span>
      <input type="color" data-color-key="${key}" value="${state.colors[key] || DEFAULT_COLORS[key]}">
    </label>
  `).join("");
}

function saveColorsFromEditor() {
  document.querySelectorAll("[data-color-key]").forEach(input => {
    state.colors[input.dataset.colorKey] = input.value;
  });
  applyCustomColors();
  closeModal("modalCores");
  renderSchedule();
  autoSave();
  showAlert("Cores atualizadas e salvas.");
}

function resetColors() {
  if (!confirm("Deseja restaurar todas as cores padrão?")) return;
  state.colors = { ...DEFAULT_COLORS };
  state.cellColors = {};
  applyCustomColors();
  renderColorEditor();
  renderSchedule();
  autoSave();
  showAlert("Cores padrão restauradas.");
}

function applyCustomColors() {
  const root = document.documentElement;
  const map = {
    header: "--header",
    weekday: "--weekday",
    cargo: "--cargo",
    defaultCell: "--base-cell",
    emptyCell: "--empty-cell",
    folga: "--folga",
    compensando: "--comp",
    curso: "--curso",
    viagem: "--viagem",
    t00: "--t00",
    t06: "--t06",
    t09: "--t09",
    t12: "--t12",
    t18: "--t18",
  };

  Object.entries(map).forEach(([key, cssVar]) => {
    root.style.setProperty(cssVar, state.colors[key] || DEFAULT_COLORS[key]);
  });
}

function getCellBackground(name, date, value) {
  const parsed = parseCellTime(value);
  if (parsed) return getFixedShiftColor(parsed.start);
  const key = cellKey(name, date);
  return state.cellColors[key] || colorForValue(value);
}

function getFixedShiftColor(startTime) {
  return FIXED_SHIFT_COLORS[String(startTime || "").slice(0, 5)] || state.colors.defaultCell || DEFAULT_COLORS.defaultCell;
}

function validateAllRules(showToast = true) {
  const result = {
    rest: validateRestRules(),
    coverage: validateCoverageRules(),
    weeklyFolga: validateWeeklyFolgaRules(),
    consecutiveSundays: validateConsecutiveSundayRules(),
  };

  if (showToast) {
    renderValidationSummary(result);
  }
  return result;
}

function validateRestRules() {
  const minRest = timeToMinutes(state.config.descansoMinimo || "11:30");
  const violations = [];

  for (const employee of state.employees) {
    if (!employee.nome) continue;

    const shifts = [];
    for (const day of state.schedule) {
      const value = getManual(employee.nome, day.date) || day.assignments[employee.nome] || "";
      const parsed = parseCellTime(value);
      if (!parsed || isBlock(value)) continue;
      const date = parseDateLocal(day.date);
      const shift = parseShift(parsed.start, parsed.end);
      shifts.push({ employee: employee.nome, date: day.date, label: shift.label, start: absoluteStart(date, shift), end: absoluteEnd(date, shift) });
    }

    shifts.sort((a, b) => a.start - b.start);
    for (let i = 1; i < shifts.length; i++) {
      const previous = shifts[i - 1];
      const current = shifts[i];
      const rest = current.start - previous.end;
      if (rest < minRest) violations.push({ employee: employee.nome, previous, current, rest, minRest });
    }
  }
  return violations;
}

function validateCoverageRules() {
  const mode = state.config.validacaoCobertura || "tecnicos";
  if (mode === "desativada") return [];

  const violations = [];

  for (const day of state.schedule) {
    const date = parseDateLocal(day.date);
    const isSunday = date.getDay() === 0;

    for (const role of ROLES) {
      if (mode === "tecnicos" && role !== TECH_ROLE) continue;
      if (!shouldRequireCoverage(role, isSunday)) continue;

      const roleEmployees = state.employees.filter(e => e.nome && e.cargo === role);
      const shifts = state.shifts[role] || [];

      for (const shift of shifts) {
        if (shift.required === false) continue;

        if (isSunday && role === TECH_ROLE && shift.inicio === "00:00" && shift.fim === "06:00") {
          continue;
        }

        const label = `${shift.inicio} – ${shift.fim}`;
        const hasCoverage = roleEmployees.some(emp => {
          const value = getManual(emp.nome, day.date) || day.assignments[emp.nome] || "";
          return normalizeShiftLabel(value) === normalizeShiftLabel(label);
        });

        if (!hasCoverage) {
          violations.push({ date: day.date, role, shift: label });
        }
      }
    }
  }

  return violations;
}

function shouldRequireCoverage(role, isSunday) {
  const policy = state.config.domingoAutomatico;
  if (!state.shifts[role] || !state.shifts[role].length) return false;
  if (!isSunday) return true;
  if (policy === 'folga') return false;
  if (policy === 'padrao' && role !== TECH_ROLE) return false;
  return true;
}

function normalizeShiftLabel(value) {
  return String(value || '').replace(/\s+/g, ' ').replace('-', '–').trim().toUpperCase();
}

function validateWeeklyFolgaRules() {
  const violations = [];
  const weeks = chunk(state.schedule, 7);

  state.employees.forEach(employee => {
    if (!employee.nome) return;
    weeks.forEach((week, weekIndex) => {
      if (week.length < 7) return;
      const hasFolga = week.some(day => String(getManual(employee.nome, day.date) || day.assignments[employee.nome] || '').toUpperCase().includes('FOLGA'));
      if (!hasFolga) {
        violations.push({ employee: employee.nome, weekIndex, startDate: week[0].date, endDate: week[week.length - 1].date });
      }
    });
  });

  return violations;
}

function validateConsecutiveSundayRules() {
  const violations = [];
  const map = getConsecutiveSundayMap();
  Object.entries(map).forEach(([employee, weekMap]) => {
    Object.entries(weekMap).forEach(([weekIndex, value]) => {
      if (Number(value) >= 3) {
        violations.push({ employee, weekIndex: Number(weekIndex), count: Number(value) });
      }
    });
  });
  return violations;
}

function renderValidationSummary(result) {
  const box = $('#dangerToast');
  if (!box) return;

  const messages = [];

  if (result.rest.length) {
    const first = result.rest[0];
    messages.push(`Descanso: ${escapeHtml(first.employee)} ficou com ${formatMinutes(Math.max(first.rest, 0))}. Mínimo: 11h30.`);
  }

  if (result.coverage.length) {
    const first = result.coverage[0];
    messages.push(`Cobertura: falta ${escapeHtml(first.shift)} para ${escapeHtml(first.role)} em ${formatDateBR(parseDateLocal(first.date))}.`);
  }

  if (result.weeklyFolga.length) {
    const first = result.weeklyFolga[0];
    messages.push(`Folga semanal: ${escapeHtml(first.employee)} está sem FOLGA na semana.`);
  }

  if (result.consecutiveSundays.length) {
    const first = result.consecutiveSundays[0];
    messages.push(`Domingos consecutivos: ${escapeHtml(first.employee)} trabalhou 3 domingos consecutivos.`);
  }

  if (!messages.length) {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }

  const total = result.rest.length + result.coverage.length + result.weeklyFolga.length + result.consecutiveSundays.length;
  const visibleMessages = messages.slice(0, 4);

  box.innerHTML = `
    <strong>Regras não atendidas</strong>
    <ul>${visibleMessages.map(msg => `<li>${msg}</li>`).join('')}</ul>
    ${total > visibleMessages.length ? `<div>+ ${total - visibleMessages.length} outra(s) ocorrência(s).</div>` : ''}
  `;
  box.classList.remove('hidden');
}

function hideRestViolationToast() {
  hideValidationToast();
}

function hideValidationToast() {
  const box = $("#dangerToast");
  if (box) {
    box.classList.add("hidden");
    box.innerHTML = "";
  }
}

function formatMinutes(total) {
  const minutes = Math.max(0, Number(total) || 0);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function exportCSV() {
  const rows = [];
  rows.push(["Colaboradores", "Cargo", ...state.schedule.map(d => `${formatDateBR(parseDateLocal(d.date))} ${WEEKDAYS[parseDateLocal(d.date).getDay()]}`), "Domingos"]);

  for (const emp of state.employees) {
    rows.push([
      emp.nome,
      emp.cargo,
      ...state.schedule.map(day => getManual(emp.nome, day.date) || day.assignments[emp.nome] || ""),
      emp.cargo === TECH_ROLE ? getSundayCountValue(emp.nome, chunk(state.schedule,7).length - 1) : "",
    ]);
  }

  const csv = rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
  downloadBlob("escala.csv", "\ufeff" + csv, "text/csv;charset=utf-8");
}

async function exportJPEG(shareToWhatsApp) {
  const blob = await createScheduleJPEGBlob();
  const filename = `escala-${new Date().toISOString().slice(0, 10)}.jpg`;

  if (shareToWhatsApp) {
    const file = new File([blob], filename, { type: "image/jpeg" });

    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      try {
        await navigator.share({
          title: "Escala de Trabalho",
          text: "Segue a escala de trabalho.",
          files: [file],
        });
        return;
      } catch (error) {
        console.warn("Compartilhamento cancelado ou indisponível.", error);
      }
    }

    downloadBlob(filename, blob, "image/jpeg");
    window.open("https://wa.me/?text=Escala%20gerada.%20A%20imagem%20JPEG%20foi%20baixada%20no%20computador%20para%20anexar%20no%20WhatsApp.", "_blank");
    showAlert("Seu navegador não permite anexar a imagem automaticamente. Baixei o JPEG; anexe no WhatsApp Web.", true);
    return;
  }

  downloadBlob(filename, blob, "image/jpeg");
}

function createScheduleJPEGBlob() {
  const weeks = chunk(state.schedule, 7);
  const scale = 2;
  const widths = [220, 210, ...Array(7).fill(125), 150];
  const rowH = 32;
  const gap = 16;
  const weekH = rowH * (2 + state.employees.length);
  const canvasW = widths.reduce((a, b) => a + b, 0);
  const canvasH = weeks.length * weekH + Math.max(0, weeks.length - 1) * gap;

  const canvas = document.createElement("canvas");
  canvas.width = canvasW * scale;
  canvas.height = canvasH * scale;

  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.font = "bold 12px Arial";
  ctx.textBaseline = "middle";

  let y = 0;
  for (const week of weeks) {
    drawWeek(ctx, week, widths, 0, y, rowH);
    y += weekH + gap;
  }

  return new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.94));
}

function drawWeek(ctx, week, widths, startX, startY, rowH) {
  let x = startX;
  drawCell(ctx, x, startY, widths[0], rowH * 2, "Colaboradores", state.colors.header, true);
  x += widths[0];
  drawCell(ctx, x, startY, widths[1], rowH * 2, "Cargo", state.colors.header, true);
  x += widths[1];

  week.forEach((day, i) => {
    drawCell(ctx, x, startY, widths[2+i], rowH, formatDateBR(parseDateLocal(day.date)), state.colors.header, true);
    x += widths[2+i];
  });

  drawCell(ctx, x, startY, widths[9], rowH * 2, "QUANTIDADE DE DOMINGO\nNO MÊS", state.colors.header, true);

  x = startX + widths[0] + widths[1];
  week.forEach((day, i) => {
    drawCell(ctx, x, startY + rowH, widths[2+i], rowH, WEEKDAYS[parseDateLocal(day.date).getDay()], state.colors.weekday, true);
    x += widths[2+i];
  });

  const weeks = chunk(state.schedule, 7);
  const weekIndex = weeks.findIndex(item => item.length && item[0].date === week[0].date);

  state.employees.forEach((emp, idx) => {
    const rowY = startY + rowH * 2 + idx * rowH;
    let cx = startX;
    drawCell(ctx, cx, rowY, widths[0], rowH, emp.nome, state.colors.name, true);
    cx += widths[0];
    drawCell(ctx, cx, rowY, widths[1], rowH, emp.cargo, state.colors.cargo, true);
    cx += widths[1];

    week.forEach((day, i) => {
      const value = getManual(emp.nome, day.date) || day.assignments[emp.nome] || "";
      drawCell(ctx, cx, rowY, widths[2+i], rowH, value, getCellBackground(emp.nome, day.date, value), false);
      cx += widths[2+i];
    });

    const sundayText = emp.nome && emp.cargo === TECH_ROLE ? `${getSundayCountValue(emp.nome, weekIndex)}º` : "";
    drawCell(ctx, cx, rowY, widths[9], rowH, sundayText, state.colors.sunday, false);
  });
}

function drawCell(ctx, x, y, w, h, text, fill, bold) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = "#111";
  ctx.font = `${bold ? "bold" : "normal"} 12px Arial`;
  const lines = String(text || "").split("\n");
  lines.forEach((line, i) => {
    const fitted = fitText(ctx, line, w - 10);
    ctx.fillText(fitted, x + w / 2 - ctx.measureText(fitted).width / 2, y + h / 2 + (i - (lines.length - 1) / 2) * 13);
  });
}

function fitText(ctx, text, maxWidth) {
  let out = String(text || "");
  if (ctx.measureText(out).width <= maxWidth) return out;
  while (out.length > 3 && ctx.measureText(out + "...").width > maxWidth) {
    out = out.slice(0, -1);
  }
  return out + "...";
}

function classForValue(value) {
  const t = String(value || "").toUpperCase();
  if (!t) return "empty-cell";
  if (t.includes("FOLGA")) return "folga";
  if (t.includes("COMPENS")) return "compensando";
  if (t.includes("CURSO")) return "curso";
  if (t.includes("VIAGEM")) return "viagem";
  if (t.startsWith("00:00")) return "t00";
  if (t.startsWith("06:00")) return "t06";
  if (t.startsWith("09:00")) return "t09";
  if (t.startsWith("12:00")) return "t12";
  if (t.startsWith("18:00")) return "t18";
  return "default-cell";
}

function colorForValue(value) {
  const cls = classForValue(value);
  const map = {
    "empty-cell": "emptyCell",
    "folga": "folga",
    "compensando": "compensando",
    "curso": "curso",
    "viagem": "viagem",
    "t00": "t00",
    "t06": "t06",
    "t09": "t09",
    "t12": "t12",
    "t18": "t18",
    "default-cell": "defaultCell",
  };
  if (cls === "t00") return FIXED_SHIFT_COLORS["00:00"];
  if (cls === "t06") return FIXED_SHIFT_COLORS["06:00"];
  if (cls === "t12") return FIXED_SHIFT_COLORS["12:00"];
  if (cls === "t18") return FIXED_SHIFT_COLORS["18:00"];
  const key = map[cls] || "defaultCell";
  return state.colors[key] || DEFAULT_COLORS[key] || DEFAULT_COLORS.defaultCell;
}

function downloadBlob(filename, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1500);
}

function parseShift(start, end) {
  return {
    start,
    end,
    startMin: timeToMinutes(start),
    endMin: timeToMinutes(end),
    label: `${start} – ${end}`,
  };
}

function absoluteStart(date, shift) {
  return Math.floor(date.getTime() / 60000) + shift.startMin;
}

function absoluteEnd(date, shift) {
  let end = Math.floor(date.getTime() / 60000) + shift.endMin;
  if (shift.endMin <= shift.startMin) end += 24 * 60;
  return end;
}

function timeToMinutes(time) {
  const [h, m] = String(time).split(":").map(Number);
  return h * 60 + m;
}

function parseCellTime(value) {
  const match = String(value).match(/(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})/);
  if (!match) return null;
  return { start: match[1], end: match[2] };
}

function parseDateLocal(value) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeekSunday(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function toInputDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

function formatDateBR(date) {
  return `${String(date.getDate()).padStart(2,"0")}/${String(date.getMonth()+1).padStart(2,"0")}/${date.getFullYear()}`;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function openModal(id) {
  $(`#${id}`).classList.add("open");
  $(`#${id}`).setAttribute("aria-hidden", "false");
}

function closeModal(id) {
  $(`#${id}`).classList.remove("open");
  $(`#${id}`).setAttribute("aria-hidden", "true");
}

function $(selector) {
  return document.querySelector(selector);
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(text) {
  return escapeHtml(text).replaceAll('"', "&quot;");
}
