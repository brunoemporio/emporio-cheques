import { createClient } from "@supabase/supabase-js";
import "./styles.css";

const STORAGE_KEY = "controle-cheques-v1";
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
});

const elements = {
  form: document.querySelector("#checkForm"),
  checkId: document.querySelector("#checkId"),
  supplier: document.querySelector("#supplierInput"),
  supplierOptions: document.querySelector("#supplierOptions"),
  bank: document.querySelector("#bankInput"),
  bankOptions: document.querySelector("#bankOptions"),
  number: document.querySelector("#numberInput"),
  amount: document.querySelector("#amountInput"),
  dueDate: document.querySelector("#dueDateInput"),
  sentDate: document.querySelector("#sentDateInput"),
  status: document.querySelector("#statusInput"),
  notes: document.querySelector("#notesInput"),
  clear: document.querySelector("#clearButton"),
  export: document.querySelector("#exportButton"),
  pdf: document.querySelector("#pdfButton"),
  reportDate: document.querySelector("#reportDateInput"),
  search: document.querySelector("#searchInput"),
  filter: document.querySelector("#filterInput"),
  list: document.querySelector("#checkList"),
  openTotal: document.querySelector("#openTotal"),
  paidTotal: document.querySelector("#paidTotal"),
  soonCount: document.querySelector("#soonCount"),
  save: document.querySelector("#saveButton"),
  syncStatus: document.querySelector("#syncStatus"),
};

let checks = [];

function normalizeFromDatabase(row) {
  return {
    id: row.id,
    supplier: row.supplier,
    bank: row.bank,
    number: row.number,
    amount: Number(row.amount || 0),
    dueDate: row.due_date,
    sentDate: row.sent_date,
    status: row.status,
    notes: row.notes || "",
  };
}

function normalizeToDatabase(check) {
  return {
    id: check.id,
    supplier: check.supplier,
    bank: check.bank,
    number: check.number,
    amount: check.amount,
    due_date: check.dueDate,
    sent_date: check.sentDate,
    status: check.status,
    notes: check.notes,
    updated_at: new Date().toISOString(),
  };
}

function loadLocalChecks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveLocalChecks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(checks));
}

async function loadChecks() {
  if (!supabase) {
    checks = loadLocalChecks();
    setSyncStatus("Modo local");
    render();
    return;
  }

  setSyncStatus("Carregando nuvem...");
  const { data, error } = await supabase
    .from("checks")
    .select("*")
    .order("due_date", { ascending: true });

  if (error) {
    checks = loadLocalChecks();
    setSyncStatus("Sem conexão. Usando modo local");
  } else {
    checks = data.map(normalizeFromDatabase);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checks));
    setSyncStatus("Salvando na nuvem");
  }

  render();
}

function setSyncStatus(message) {
  elements.syncStatus.textContent = message;
}

async function persistUpsert(check) {
  if (!supabase) {
    saveLocalChecks();
    return;
  }

  const { error } = await supabase.from("checks").upsert(normalizeToDatabase(check));
  if (error) {
    saveLocalChecks();
    setSyncStatus("Erro na nuvem. Salvo localmente");
    throw error;
  }
  setSyncStatus("Salvando na nuvem");
}

async function persistDelete(id) {
  if (!supabase) {
    saveLocalChecks();
    return;
  }

  const { error } = await supabase.from("checks").delete().eq("id", id);
  if (error) {
    saveLocalChecks();
    setSyncStatus("Erro na nuvem. Salvo localmente");
    throw error;
  }
  setSyncStatus("Salvando na nuvem");
}

function normalizeText(value) {
  return String(value || "").trim();
}

function formatDate(value) {
  if (!value) return "-";
  return dateFormatter.format(new Date(`${value}T00:00:00Z`));
}

function formatDateForField(value) {
  return value ? formatDate(value) : "";
}

function todayIso() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateValue(value) {
  const clean = normalizeText(value);
  if (!clean) return "";

  const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return clean;

  const brMatch = clean.match(/^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?$/);
  if (!brMatch) return "";

  const day = Number(brMatch[1]);
  const month = Number(brMatch[2]);
  let year = brMatch[3] ? Number(brMatch[3]) : new Date().getFullYear();
  if (year < 100) year += 2000;

  const date = new Date(year, month - 1, day);
  const isValid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  if (!isValid) return "";

  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function applyDateMask(input) {
  const isoDate = normalizeDateValue(input.value);
  if (isoDate) {
    input.value = formatDateForField(isoDate);
  }
  return isoDate;
}

function formatMoney(value) {
  return moneyFormatter.format(Number(value) || 0);
}

function todayAtMidnight() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function daysUntil(dateValue) {
  const due = new Date(`${dateValue}T00:00:00`);
  const diff = due.getTime() - todayAtMidnight().getTime();
  return Math.ceil(diff / 86400000);
}

function currentStatus(check) {
  if (check.status === "Enviado" && daysUntil(check.dueDate) < 0) {
    return "Atrasado";
  }
  return check.status;
}

function resetForm() {
  elements.form.reset();
  elements.checkId.value = "";
  elements.sentDate.value = formatDateForField(todayIso());
  if (!elements.reportDate.value) {
    elements.reportDate.value = formatDateForField(todayIso());
  }
  elements.status.value = "Enviado";
  elements.save.textContent = "Salvar cheque";
  elements.supplier.focus();
}

async function upsertCheck(event) {
  event.preventDefault();

  const dueDate = applyDateMask(elements.dueDate);
  const sentDate = applyDateMask(elements.sentDate);
  if (!dueDate || !sentDate) {
    window.alert("Confira as datas. Use dia/mês ou dia/mês/ano.");
    return;
  }

  const id = elements.checkId.value || crypto.randomUUID();
  const record = {
    id,
    supplier: normalizeText(elements.supplier.value),
    bank: normalizeText(elements.bank.value),
    number: normalizeText(elements.number.value),
    amount: Number(elements.amount.value),
    dueDate,
    sentDate,
    status: elements.status.value,
    notes: normalizeText(elements.notes.value),
  };

  const existingIndex = checks.findIndex((check) => check.id === id);
  if (existingIndex >= 0) {
    checks[existingIndex] = record;
  } else {
    checks.unshift(record);
  }

  render();
  resetForm();

  try {
    await persistUpsert(record);
  } catch {
    window.alert("Salvei no navegador, mas não consegui salvar na nuvem agora.");
  }
}

function editCheck(id) {
  const check = checks.find((item) => item.id === id);
  if (!check) return;

  elements.checkId.value = check.id;
  elements.supplier.value = check.supplier;
  elements.bank.value = check.bank;
  elements.number.value = check.number;
  elements.amount.value = check.amount;
  elements.dueDate.value = formatDateForField(check.dueDate);
  elements.sentDate.value = formatDateForField(check.sentDate);
  elements.status.value = check.status;
  elements.notes.value = check.notes;
  elements.save.textContent = "Atualizar cheque";
  elements.supplier.focus();
}

async function removeCheck(id) {
  const check = checks.find((item) => item.id === id);
  if (!check) return;

  const confirmed = window.confirm(`Excluir o cheque ${check.number} de ${check.supplier}?`);
  if (!confirmed) return;

  checks = checks.filter((item) => item.id !== id);
  render();

  try {
    await persistDelete(id);
  } catch {
    window.alert("Removi da tela, mas não consegui remover da nuvem agora.");
  }
}

async function updateStatus(id, status) {
  const check = checks.find((item) => item.id === id);
  if (!check) return;

  const updated = { ...check, status };
  checks = checks.map((item) => (item.id === id ? updated : item));
  render();

  try {
    await persistUpsert(updated);
  } catch {
    window.alert("Atualizei no navegador, mas não consegui salvar na nuvem agora.");
  }
}

function filteredChecks() {
  const query = normalizeText(elements.search.value).toLowerCase();
  const selectedStatus = elements.filter.value;

  return checks
    .filter((check) => {
      const status = currentStatus(check);
      const matchesStatus = selectedStatus === "Todos" || status === selectedStatus;
      const searchable = `${check.supplier} ${check.bank} ${check.number}`.toLowerCase();
      return matchesStatus && searchable.includes(query);
    })
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
}

function renderSummary() {
  const openTotal = checks
    .filter((check) => !["Compensado", "Cancelado"].includes(currentStatus(check)))
    .reduce((sum, check) => sum + Number(check.amount || 0), 0);

  const paidTotal = checks
    .filter((check) => currentStatus(check) === "Compensado")
    .reduce((sum, check) => sum + Number(check.amount || 0), 0);

  const soonCount = checks.filter((check) => {
    const status = currentStatus(check);
    const days = daysUntil(check.dueDate);
    return status === "Enviado" && days >= 0 && days <= 7;
  }).length;

  elements.openTotal.textContent = formatMoney(openTotal);
  elements.paidTotal.textContent = formatMoney(paidTotal);
  elements.soonCount.textContent = soonCount;
}

function renderChecks() {
  const visibleChecks = filteredChecks();

  if (visibleChecks.length === 0) {
    elements.list.innerHTML = '<div class="empty">Nenhum cheque encontrado.</div>';
    return;
  }

  elements.list.innerHTML = visibleChecks
    .map((check) => {
      const status = currentStatus(check);
      return `
        <article class="check-card">
          <div class="card-head">
            <div>
              <h3>${escapeHtml(check.supplier)}</h3>
              <p>${escapeHtml(check.bank)} · Cheque ${escapeHtml(check.number)}</p>
              <span class="status status-${status}">${status}</span>
            </div>
            <div class="amount">${formatMoney(check.amount)}</div>
          </div>

          <div class="details">
            <div><span>Enviado em</span><strong>${formatDate(check.sentDate)}</strong></div>
            <div><span>Vencimento</span><strong>${formatDate(check.dueDate)}</strong></div>
            <div><span>Dias até vencer</span><strong>${daysUntil(check.dueDate)}</strong></div>
            <div>
              <span>Alterar status</span>
              <select data-action="status" data-id="${check.id}">
                ${["Enviado", "Compensado", "Cancelado"].map((option) => `
                  <option value="${option}" ${check.status === option ? "selected" : ""}>${option}</option>
                `).join("")}
              </select>
            </div>
          </div>

          ${check.notes ? `<p class="notes">${escapeHtml(check.notes)}</p>` : ""}

          <div class="card-actions">
            <button type="button" class="secondary" data-action="edit" data-id="${check.id}">Editar</button>
            <button type="button" class="danger" data-action="remove" data-id="${check.id}">Excluir</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderAutocompleteOptions() {
  fillDatalist(elements.supplierOptions, checks.map((check) => check.supplier));
  fillDatalist(elements.bankOptions, checks.map((check) => check.bank));
}

function fillDatalist(list, values) {
  const options = [...new Set(values.map(normalizeText).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map((value) => `<option value="${escapeHtml(value)}"></option>`)
    .join("");

  list.innerHTML = options;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function render() {
  renderAutocompleteOptions();
  renderSummary();
  renderChecks();
}

function exportCsv() {
  if (checks.length === 0) {
    window.alert("Não há cheques para exportar.");
    return;
  }

  const headers = ["Fornecedor", "Banco", "Numero", "Valor", "Envio", "Vencimento", "Status", "Observacoes"];
  const rows = checks.map((check) => [
    check.supplier,
    check.bank,
    check.number,
    String(check.amount).replace(".", ","),
    formatDate(check.sentDate),
    formatDate(check.dueDate),
    currentStatus(check),
    check.notes,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell || "").replaceAll('"', '""')}"`).join(";"))
    .join("\n");

  downloadBytes(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }), "controle-cheques.csv");
}

function reportChecksByDate() {
  const reportDate = applyDateMask(elements.reportDate);
  if (!reportDate) {
    window.alert("Escolha a data do relatório.");
    return;
  }

  const reportChecks = checks
    .filter((check) => check.sentDate === reportDate)
    .sort((a, b) => a.supplier.localeCompare(b.supplier) || a.number.localeCompare(b.number));

  if (reportChecks.length === 0) {
    window.alert("Não há cheques enviados nesta data.");
    return;
  }

  const pdfBytes = buildDailyReportPdf(reportDate, reportChecks);
  downloadBytes(new Blob([pdfBytes], { type: "application/pdf" }), `relatorio-cheques-${reportDate}.pdf`);
}

function downloadBytes(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildDailyReportPdf(reportDate, reportChecks) {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 42;
  const lineHeight = 16;
  const bottomLimit = 70;
  const columns = {
    check: margin,
    bank: 102,
    dueDate: 185,
    amount: 260,
    status: 330,
  };
  const pages = [];
  let lines = [];
  let y = pageHeight - margin;

  function addLine(text, size = 10, bold = false, x = margin) {
    if (y < bottomLimit) {
      pages.push(lines);
      lines = [];
      y = pageHeight - margin;
    }
    lines.push({ text, size, bold, x, y });
    y -= lineHeight;
  }

  function addTableHeader() {
    addTableCells([
      { text: "Cheque", x: columns.check, bold: true },
      { text: "Banco", x: columns.bank, bold: true },
      { text: "Vencimento", x: columns.dueDate, bold: true },
      { text: "Valor", x: columns.amount, bold: true },
      { text: "Status", x: columns.status, bold: true },
    ]);
  }

  function addTableCells(cells, size = 9) {
    if (y < bottomLimit) {
      pages.push(lines);
      lines = [];
      y = pageHeight - margin;
    }

    cells.forEach((cell) => {
      lines.push({
        text: cell.text,
        size,
        bold: Boolean(cell.bold),
        x: cell.x,
        y,
      });
    });
    y -= lineHeight;
  }

  const total = reportChecks.reduce((sum, check) => sum + Number(check.amount || 0), 0);
  addLine("Relatorio de Cheques Enviados", 18, true);
  addLine(`Data de envio: ${formatDate(reportDate)}`, 12);
  addLine(`Total do dia: ${formatMoney(total).replace(/\s/g, " ")}`, 12, true);
  addLine(`Quantidade de cheques: ${reportChecks.length}`, 12);
  y -= 8;

  const grouped = groupBySupplier(reportChecks);
  Object.keys(grouped).forEach((supplier) => {
    const supplierChecks = grouped[supplier];
    const supplierTotal = supplierChecks.reduce((sum, check) => sum + Number(check.amount || 0), 0);
    addLine(`Fornecedor: ${supplier}`, 13, true);
    addLine(`Subtotal: ${formatMoney(supplierTotal).replace(/\s/g, " ")}`, 11, true);
    addTableHeader();

    supplierChecks.forEach((check) => {
      addTableCells([
        { text: limitPdfText(check.number, 12), x: columns.check },
        { text: limitPdfText(check.bank, 16), x: columns.bank },
        { text: formatDate(check.dueDate), x: columns.dueDate },
        { text: formatMoney(check.amount).replace(/\s/g, " "), x: columns.amount },
        { text: currentStatus(check), x: columns.status },
      ]);
    });
    y -= 8;
  });

  if (lines.length > 0) pages.push(lines);
  return createPdf(pages, pageWidth, pageHeight);
}

function groupBySupplier(items) {
  return items.reduce((groups, check) => {
    if (!groups[check.supplier]) groups[check.supplier] = [];
    groups[check.supplier].push(check);
    return groups;
  }, {});
}

function limitPdfText(value, length) {
  const clean = toPdfText(value);
  return clean.length > length ? `${clean.slice(0, length - 1)}.` : clean;
}

function toPdfText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfText(value) {
  return toPdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function createPdf(pages, pageWidth, pageHeight) {
  const objects = [];
  const pageRefs = [];
  const fontRegularId = 3;
  const fontBoldId = 4;

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  pages.forEach((pageLines, index) => {
    const pageObjectId = 5 + index * 2;
    const contentObjectId = pageObjectId + 1;
    pageRefs.push(`${pageObjectId} 0 R`);

    const content = pageLines
      .map((line) => `BT /${line.bold ? "F2" : "F1"} ${line.size} Tf ${line.x} ${line.y.toFixed(2)} Td (${escapePdfText(line.text)}) Tj ET`)
      .join("\n");

    objects[pageObjectId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
    objects[contentObjectId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  objects[2] = `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pages.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = pdf.length;
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const bytes = new Uint8Array(pdf.length);
  for (let index = 0; index < pdf.length; index += 1) {
    bytes[index] = pdf.charCodeAt(index);
  }
  return bytes;
}

elements.form.addEventListener("submit", upsertCheck);
elements.clear.addEventListener("click", resetForm);
elements.export.addEventListener("click", exportCsv);
elements.pdf.addEventListener("click", reportChecksByDate);
elements.search.addEventListener("input", renderChecks);
elements.filter.addEventListener("change", renderChecks);
[elements.dueDate, elements.sentDate, elements.reportDate].forEach((input) => {
  input.addEventListener("blur", () => applyDateMask(input));
});
elements.list.addEventListener("click", (event) => {
  const target = event.target;
  const action = target.dataset.action;
  const id = target.dataset.id;

  if (action === "edit") editCheck(id);
  if (action === "remove") removeCheck(id);
});
elements.list.addEventListener("change", (event) => {
  const target = event.target;
  if (target.dataset.action === "status") {
    updateStatus(target.dataset.id, target.value);
  }
});

resetForm();
loadChecks();
