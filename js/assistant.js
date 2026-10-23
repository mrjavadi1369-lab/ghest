/* EasyVAM Smart Assistant v4 — Offline Intelligent Command & Analytics Engine
 * Major overhaul: intent scoring, fuzzy entity extraction, conversation context,
 * portfolio analytics, proactive insights, multi-turn dialogs, richer cards.
 */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fa = '<i class="fa-solid fa-robot"></i>';

  // ─── State ───────────────────────────────────────────────────────────────
  let pendingAction = null;
  let assistantLastSnapshot = new Map();
  let assistantInternalChanges = new Set();
  let vamSpeechRecognition = null;
  let vamSpeechListening = false;

  /** Conversation context (last few turns + last focused loan) */
  const ctx = {
    lastLoanId: null,
    lastIntent: null,
    history: [],
    pendingClarification: null,
    lastSimPlan: null,   // { budget, covered: [{loanId, number, amount}] }
    greetedThisOpen: false
  };

  // Simple learning: frequent successful commands
  const LEARN_KEY = 'vam_assistant_learned_v4';
  function loadLearned() {
    try { return JSON.parse(localStorage.getItem(LEARN_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveLearned(map) {
    try { localStorage.setItem(LEARN_KEY, JSON.stringify(map)); } catch (e) {}
  }
  function rememberCommand(text) {
    if (!text || text.length < 3) return;
    const key = norm(text).slice(0, 80);
    const m = loadLearned();
    m[key] = (m[key] || 0) + 1;
    // keep top 30
    const entries = Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,30);
    saveLearned(Object.fromEntries(entries));
  }
  function topLearned(n=5) {
    return Object.entries(loadLearned()).sort((a,b)=>b[1]-a[1]).slice(0,n).map(x=>x[0]);
  }

  // ─── Utilities ───────────────────────────────────────────────────────────
  function getLoans() {
    return Array.isArray(window.loans) ? window.loans : (typeof loans !== 'undefined' && Array.isArray(loans) ? loans : []);
  }

  function stats(l) {
    try {
      if (typeof getLoanStats === 'function') {
        const base = getLoanStats(l) || {};
        const a = Array.isArray(l.installments) ? l.installments : [];
        const ov = a.filter(i => !i.paid && ((typeof isOverdue === 'function') ? isOverdue(i) : (i.date && String(i.date) < today())));
        return { ...base, overdueCount: ov.length, overdueAmount: ov.reduce((s, i) => s + (Number(i.amount) || 0), 0), overdue: ov };
      }
    } catch (e) {}
    const a = Array.isArray(l.installments) ? l.installments : [];
    const p = a.filter(x => x && x.paid);
    const ov = a.filter(i => !i.paid && i.date && String(i.date) < today());
    return {
      totalInst: a.length,
      paidCount: p.length,
      paidAmount: p.reduce((s, x) => s + (+x.amount || 0), 0),
      remainingAmount: a.filter(x => !x.paid).reduce((s, x) => s + (+x.amount || 0), 0),
      overdueCount: ov.length,
      overdueAmount: ov.reduce((s, x) => s + (+x.amount || 0), 0),
      overdue: ov,
      next: a.filter(x => !x.paid).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))[0] || null
    };
  }

  function money(n) {
    try {
      if (typeof formatMoney === 'function') return formatMoney(n);
      const unit = (typeof currencyLabel === 'function') ? currencyLabel() : 'تومان';
      return Number(n || 0).toLocaleString('fa-IR') + ' ' + unit;
    } catch (e) {
      return Number(n || 0).toLocaleString('fa-IR') + ' تومان';
    }
  }

  function pd(n) {
    try { return typeof toPersianDigits === 'function' ? toPersianDigits(n) : String(n); }
    catch (e) { return String(n); }
  }

  function today() {
    try {
      if (typeof jalaliPartsFromDate === 'function') {
        const p = jalaliPartsFromDate(new Date());
        if (p && p.year && p.month && p.day)
          return String(p.year).padStart(4, '0') + '-' + String(p.month).padStart(2, '0') + '-' + String(p.day).padStart(2, '0');
      }
    } catch (e) {}
    return '';
  }

  function dateText(d) {
    try { return typeof formatDateToPersian === 'function' ? formatDateToPersian(d) : String(d || '—'); }
    catch (e) { return String(d || '—'); }
  }

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[\u200c\u200d\ufeff]/g, ' ')
      .replace(/[؟?!،,.:؛]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function digits(s) {
    return String(s || '')
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .replace(/[٬،,]/g, '');
  }

  function num(s) {
    const n = Number(digits(String(s).replace(/[^0-9۰-۹٬،,.-]/g, '')));
    return isNaN(n) ? 0 : n;
  }

  function amountWithUnit(raw) {
    let t = String(raw || '').replace(/[٬،,]/g, '').trim();
    let mul = 1;
    if (/میلیارد/.test(t)) { mul = 1e9; t = t.replace(/میلیارد/g, ''); }
    else if (/میلیون|م\b/.test(t)) { mul = 1e6; t = t.replace(/میلیون|م\b/g, ''); }
    else if (/هزار/.test(t)) { mul = 1e3; t = t.replace(/هزار/g, ''); }
    const n = num(t);
    return n * mul;
  }

  const FA_NUM_WORDS = {
    'صفر': 0, 'یک': 1, '۱': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'پنج': 5,
    'شش': 6, 'شیش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9, 'ده': 10,
    'یازده': 11, 'دوازده': 12, 'سیزده': 13, 'چهارده': 14, 'پانزده': 15,
    'شانزده': 16, 'هفده': 17, 'هجده': 18, 'نوزده': 19, 'بیست': 20,
    'سی': 30, 'چهل': 40, 'پنجاه': 50, 'شصت': 60, 'هفتاد': 70, 'هشتاد': 80, 'نود': 90,
    'اول': 1, 'دوم': 2, 'سوم': 3, 'چهارم': 4, 'پنجم': 5, 'ششم': 6, 'هفتم': 7, 'هشتم': 8, 'نهم': 9, 'دهم': 10
  };

  function faNumWordToInt(s) {
    const t = norm(s);
    if (FA_NUM_WORDS[t] !== undefined) return FA_NUM_WORDS[t];
    const m = t.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  }

  function extractInstallmentNumber(x) {
    let m = x.match(/(?:قسط|شماره قسط|قسط شماره)\s*([۰-۹0-9]+|\S+)/);
    if (m) {
      const w = m[1];
      const n = faNumWordToInt(w) || num(w);
      if (n > 0) return n;
    }
    m = x.match(/(?:قسط)\s*(اول|دوم|سوم|چهارم|پنجم|ششم|هفتم|هشتم|نهم|دهم)/);
    if (m) return faNumWordToInt(m[1]);
    return 0;
  }

  // ─── UI helpers ──────────────────────────────────────────────────────────
  function buildSmartGreeting() {
    try {
      const ov = getOverdues();
      const td = getTodayDue();
      const p = portfolio();
      const parts = [];
      if (ov.length) {
        const amt = ov.reduce((s, x) => s + (Number(x.inst.amount) || 0), 0);
        parts.push('⚠️ <b>' + pd(ov.length) + '</b> قسط معوق به مبلغ ' + money(amt));
      }
      if (td.length) {
        const amt = td.reduce((s, x) => s + (Number(x.inst.amount) || 0), 0);
        parts.push('📅 امروز <b>' + pd(td.length) + '</b> قسط سررسید (' + money(amt) + ')');
      }
      if (!parts.length && p.count) {
        parts.push('✅ معوق و سررسید امروز نداری. مانده کل: ' + money(p.totalRemaining));
      }
      if (!p.count) {
        return 'هنوز وامی ثبت نشده. بگو <b>ثبت وام جدید</b> تا شروع کنیم.';
      }
      let html = '<b>سلام 👋 یادآوری هوشمند</b><br>' + parts.join('<br>');
      if (ov.length) {
        html += '<br><br>می‌تونی بگی: <b>معوقات</b> · <b>همه معوقات را پرداخت کن</b> · <b>اگر ... میلیون بدم چی میشه؟</b>';
      } else if (td.length) {
        html += '<br><br>بگو: <b>همه اقساط امروز را پرداخت کن</b> یا <b>قسط بعدی را پرداخت کن</b>';
      }
      return html;
    } catch (e) {
      return null;
    }
  }

  function open() {
    $('vam-assistant-overlay')?.classList.add('open');
    setTimeout(() => {
      $('vam-assistant-input')?.focus();
      if (!ctx.greetedThisOpen) {
        ctx.greetedThisOpen = true;
        const g = buildSmartGreeting();
        if (g) add('bot', g);
      }
    }, 80);
  }

  function close() {
    $('vam-assistant-overlay')?.classList.remove('open');
    ctx.greetedThisOpen = false;
  }

  function add(role, html) {
    const list = $('vam-assistant-messages');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'vam-assistant-msg ' + role;
    row.innerHTML = role === 'bot'
      ? '<span class="vam-assistant-avatar">' + fa + '</span><div class="vam-assistant-bubble">' + html + '</div>'
      : '<div class="vam-assistant-bubble">' + html + '</div>';
    list.appendChild(row);
    list.scrollTop = list.scrollHeight;
  }

  function quick(t) {
    $('vam-assistant-input').value = t;
    send();
  }

  function actionResult(msg) {
    add('bot', msg);
  }

  function go(page, loan) {
    try {
      if (loan && typeof selectAndShowPage === 'function') selectAndShowPage(loan.id, page);
      else if (typeof showPage === 'function') showPage(page);
    } catch (e) {
      if (typeof showPage === 'function') showPage(page);
    }
  }

  function fill(id, value) {
    const el = $(id);
    if (!el) return false;
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  // ─── Loan finding (fuzzy) ────────────────────────────────────────────────
  function extractLoanQuery(x, extra = '') {
    let q = x;
    q = q.replace(/(?:قسط|شماره|پرداخت|ثبت پرداخت|پرداخت کن|پرداختش کن|بزن|کن|کنم|شود|بشه|لطفا|لطفاً|رو|را|وام|معوقات|معوقه|عقب افتاده|عقب‌افتاده|دیرکرد|تاخیر|تأخیر|گزارش|جزئیات|مدیریت اقساط|اقساط|وضعیت|خلاصه|بدهی|مانده|باقی‌مانده|باقی مانده|حذف|ویرایش|مقایسه|بیشترین|کمترین)/g, ' ');
    if (extra) q = q.replace(extra, ' ');
    return q.replace(/\s+/g, ' ').trim();
  }

  function findLoan(q) {
    const ls = getLoans();
    const x = norm(q);
    if (!x) {
      if (ctx.lastLoanId) {
        const byCtx = ls.find(l => String(l.id) === String(ctx.lastLoanId));
        if (byCtx) return byCtx;
      }
      return null;
    }
    let best = null, bestScore = 0;
    for (const l of ls) {
      const n = norm(l.name || '');
      const party = norm(l.party || '');
      if (!n && !party) continue;
      if (x === n || x.includes(n) || n.includes(x)) {
        ctx.lastLoanId = l.id;
        return l;
      }
      const xt = x.split(' ').filter(Boolean);
      const nt = (n + ' ' + party).split(' ').filter(t => t.length > 1);
      let score = 0;
      for (const t of nt) {
        if (xt.some(z => z === t || z.includes(t) || t.includes(z))) score += t.length > 2 ? 2 : 1;
      }
      if (score > bestScore) { bestScore = score; best = l; }
    }
    if (bestScore > 0) {
      ctx.lastLoanId = best.id;
      return best;
    }
    return null;
  }

  // ─── Portfolio analytics ─────────────────────────────────────────────────
  function portfolio() {
    const ls = getLoans();
    let totalRemaining = 0, totalPaid = 0, totalOverdueCount = 0, totalOverdueAmount = 0;
    let totalInstallments = 0, paidInstallments = 0;
    const loanStats = [];
    for (const l of ls) {
      const s = stats(l);
      totalRemaining += s.remainingAmount || 0;
      totalPaid += s.paidAmount || 0;
      totalOverdueCount += s.overdueCount || 0;
      totalOverdueAmount += s.overdueAmount || 0;
      totalInstallments += s.totalInst || 0;
      paidInstallments += s.paidCount || 0;
      loanStats.push({ loan: l, s });
    }
    loanStats.sort((a, b) => (b.s.remainingAmount || 0) - (a.s.remainingAmount || 0));
    const mostRemaining = loanStats[0] || null;
    const mostOverdue = [...loanStats].sort((a, b) => (b.s.overdueCount || 0) - (a.s.overdueCount || 0))[0] || null;
    const nextItems = getNextDue(5);
    return {
      count: ls.length,
      totalRemaining, totalPaid, totalOverdueCount, totalOverdueAmount,
      totalInstallments, paidInstallments,
      mostRemaining, mostOverdue, nextItems, loanStats
    };
  }

  function getOverdues() {
    const out = [];
    for (const l of getLoans()) {
      const s = stats(l);
      (s.overdue || []).forEach(i => out.push({ loan: l, inst: i }));
    }
    out.sort((a, b) => String(a.inst.date || '').localeCompare(String(b.inst.date || '')));
    return out;
  }

  function getTodayDue() {
    const t = today();
    const out = [];
    if (!t) return out;
    for (const l of getLoans()) {
      (l.installments || []).forEach(i => {
        if (!i.paid && String(i.date) === t) out.push({ loan: l, inst: i });
      });
    }
    return out;
  }

  function getNextDue(limit = 8) {
    const out = [];
    const t = today();
    for (const l of getLoans()) {
      (l.installments || []).forEach(i => {
        if (!i.paid && i.date && (!t || String(i.date) >= t)) out.push({ loan: l, inst: i });
      });
    }
    out.sort((a, b) => String(a.inst.date || '').localeCompare(String(b.inst.date || '')));
    return out.slice(0, limit);
  }

  // ─── Actions ─────────────────────────────────────────────────────────────
  function directPay(loan, inst) {
    if (!loan || !inst || inst.paid) return false;
    inst.paid = true;
    inst.paidAt = new Date().toISOString();
    if (inst.paidFrom === undefined) inst.paidFrom = null;
    try { persist(); } catch (e) { return false; }
    try { invalidateLoanStats(loan.id); } catch (e) {}
    try { refreshAllViews('assistant-payment'); } catch (e) {}
    try { if (typeof v8Log === 'function') v8Log('payment', 'قسط ' + pd(inst.number) + ' پرداخت شد', loan.name || ''); } catch (e) {}
    return true;
  }

  function directUnpay(loan, inst) {
    if (!loan || !inst || !inst.paid) return false;
    inst.paid = false;
    delete inst.paidAt;
    delete inst.paidFrom;
    try { persist(); } catch (e) { return false; }
    try { invalidateLoanStats(loan.id); } catch (e) {}
    try { refreshAllViews('assistant-payment-cancel'); } catch (e) {}
    try { if (typeof v8Log === 'function') v8Log('assistant-payment-cancel', { loanId: loan.id, installment: Number(inst.number) || 0, amount: Number(inst.amount) || 0 }); } catch (e) {}
    try { assistantInternalChanges.add(String(loan.id) + '|' + String(inst.number)); } catch (e) {}
    return true;
  }

  function payToday() {
    const arr = getTodayDue();
    let paid = 0, total = 0;
    for (const a of arr) {
      if (directPay(a.loan, a.inst)) { paid++; total += Number(a.inst.amount) || 0; }
    }
    return { paid, total, items: arr };
  }

  function executeAction(a) {
    if (!a) return;
    if (a.type === 'open-page') { go(a.page, a.loan); return; }
    if (a.type === 'pay') {
      const loan = a.loan;
      if (!loan) { actionResult('وام موردنظر پیدا نشد.'); return; }
      const inst = (loan.installments || []).find(i => Number(i.number) === Number(a.number));
      if (!inst) { actionResult('قسط شماره ' + pd(a.number) + ' در وام «' + esc(loan.name) + '» پیدا نشد.'); return; }
      if (inst.paid) { actionResult('قسط شماره ' + pd(a.number) + ' وام «' + esc(loan.name) + '» قبلاً پرداخت شده است.'); return; }
      if (!directPay(loan, inst)) { actionResult('ثبت پرداخت قسط با خطا مواجه شد.'); return; }
      try { if (typeof showToast === 'function') showToast('قسط شماره ' + pd(a.number) + ' وام «' + (loan.name || '') + '» پرداخت شد.', 'success'); } catch (e) {}
      return;
    }
    if (a.type === 'unpay') {
      const loan = a.loan;
      if (!loan) { actionResult('وام موردنظر پیدا نشد.'); return; }
      const inst = (loan.installments || []).find(i => Number(i.number) === Number(a.number));
      if (!inst) { actionResult('قسط شماره ' + pd(a.number) + ' در وام «' + esc(loan.name) + '» پیدا نشد.'); return; }
      if (!inst.paid) { actionResult('قسط شماره ' + pd(a.number) + ' وام «' + esc(loan.name) + '» قبلاً پرداخت نشده است.'); return; }
      if (!directUnpay(loan, inst)) { actionResult('لغو پرداخت قسط با خطا مواجه شد.'); return; }
      try { if (typeof showToast === 'function') showToast('پرداخت قسط لغو شد.', 'success'); } catch (e) {}
      return;
    }
    if (a.type === 'prepare-loan') {
      go('register-loan');
      setTimeout(() => {
        fill('loan-name', a.name || '');
        if (a.party) fill('loan-party', a.party);
        if (a.amount) fill('loan-amount', String(a.amount));
        if (a.installmentAmount) fill('installment-amount', String(a.installmentAmount));
        if (a.count) fill('installment-count', String(a.count));
        if (a.startDate) fill('start-date', a.startDate);
        actionResult('فرم ثبت وام آماده شد. اطلاعات را بررسی کن و روی «ساخت جدول اقساط» بزن.');
      }, 120);
      return;
    }
  }


  // ─── Advanced analytics: this month, simulation, pay-next ─────────────────
  function jalaliMonthPrefix() {
    const t = today(); // YYYY-MM-DD jalali-like
    return t ? t.slice(0, 7) : '';
  }

  function getMonthDues(monthPrefix) {
    const pref = monthPrefix || jalaliMonthPrefix();
    const out = [];
    if (!pref) return out;
    for (const l of getLoans()) {
      (l.installments || []).forEach(i => {
        if (i.date && String(i.date).startsWith(pref)) out.push({ loan: l, inst: i });
      });
    }
    out.sort((a, b) => String(a.inst.date || '').localeCompare(String(b.inst.date || '')));
    return out;
  }

  function buildMonthPlanCard() {
    const items = getMonthDues();
    if (!items.length) return 'برای این ماه قسطی ثبت نشده (یا تاریخ‌ها ناقص‌اند).';
    let due = 0, paid = 0, unpaidAmt = 0, paidAmt = 0;
    items.forEach(({ inst }) => {
      if (inst.paid) { paid++; paidAmt += Number(inst.amount) || 0; }
      else { due++; unpaidAmt += Number(inst.amount) || 0; }
    });
    let html = '<b>📆 برنامه اقساط این ماه</b><br>';
    html += 'تعداد: <b>' + pd(items.length) + '</b> (پرداخت‌شده ' + pd(paid) + ' · مانده ' + pd(due) + ')<br>';
    html += 'مبلغ مانده ماه: <b>' + money(unpaidAmt) + '</b><br>';
    html += 'پرداخت‌شده ماه: ' + money(paidAmt) + '<br><br>';
    const show = items.filter(x => !x.inst.paid).slice(0, 8);
    if (show.length) {
      html += '<b>باقی‌مانده‌ها:</b><br>';
      show.forEach(({ loan, inst }) => {
        html += '• ' + dateText(inst.date) + ' — قسط ' + pd(inst.number) + ' «' + esc(loan.name) + '» — ' + money(inst.amount) + '<br>';
      });
    } else {
      html += '✅ همه اقساط این ماه پرداخت شده‌اند.';
    }
    return html;
  }

  /** What-if: if user pays amount X, which installments get covered (greedy by date) */
  function simulatePayment(budget) {
    const budgetN = Number(budget) || 0;
    if (budgetN <= 0) return null;
    const candidates = [];
    for (const l of getLoans()) {
      (l.installments || []).forEach(i => {
        if (!i.paid) candidates.push({ loan: l, inst: i });
      });
    }
    // prioritize overdue first, then by date
    const t = today();
    candidates.sort((a, b) => {
      const ao = t && a.inst.date && String(a.inst.date) < t ? 0 : 1;
      const bo = t && b.inst.date && String(b.inst.date) < t ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return String(a.inst.date || '').localeCompare(String(b.inst.date || ''));
    });
    let left = budgetN;
    const covered = [];
    for (const c of candidates) {
      const amt = Number(c.inst.amount) || 0;
      if (amt <= left) {
        covered.push(c);
        left -= amt;
      }
    }
    return { budget: budgetN, covered, remainingBudget: left, totalCovered: budgetN - left };
  }

  function buildSimulateCard(budget) {
    const r = simulatePayment(budget);
    if (!r) return 'مبلغ معتبر بگو. مثلاً: «اگر ۵۰ میلیون پرداخت کنم چی میشه؟»';
    let html = '<b>🔮 شبیه‌سازی پرداخت</b><br>';
    html += 'بودجه: <b>' + money(r.budget) + '</b><br>';
    html += 'قابل پوشش: <b>' + pd(r.covered.length) + '</b> قسط به مبلغ ' + money(r.totalCovered) + '<br>';
    if (r.remainingBudget > 0) html += 'باقی بودجه: ' + money(r.remainingBudget) + '<br>';
    if (!r.covered.length) {
      html += '<br>با این مبلغ هیچ قسط کاملی پوشش داده نمی‌شود (اولویت با اقساط زودتر/معوق است).';
      ctx.lastSimPlan = null;
      return html;
    }
    html += '<br><b>ترتیب پیشنهادی:</b><br>';
    r.covered.slice(0, 10).forEach(({ loan, inst }) => {
      const ov = today() && inst.date && String(inst.date) < today();
      html += '• قسط ' + pd(inst.number) + ' «' + esc(loan.name) + '» — ' + money(inst.amount) + (ov ? ' <span style="color:#be123c">معوق</span>' : '') + '<br>';
    });
    // store plan for one-tap confirm
    ctx.lastSimPlan = {
      budget: r.budget,
      totalCovered: r.totalCovered,
      covered: r.covered.map(({ loan, inst }) => ({
        loanId: loan.id,
        name: loan.name,
        number: Number(inst.number),
        amount: Number(inst.amount) || 0
      }))
    };
    ctx.pendingClarification = { type: 'confirm-sim-plan' };
    html += '<br><br>✅ برای <b>اجرای واقعی</b> همین لیست بگو: <b>تأیید</b> یا <b>همینا رو پرداخت کن</b><br>';
    html += '❌ برای انصراف: <b>لغو</b>';
    return html;
  }

  function executeSimPlan() {
    const plan = ctx.lastSimPlan;
    ctx.lastSimPlan = null;
    ctx.pendingClarification = null;
    if (!plan || !plan.covered || !plan.covered.length) return 'برنامه شبیه‌سازی فعالی نیست. اول بگو مثلاً «اگر ۵۰ میلیون پرداخت کنم».';
    const loans = getLoans();
    let paid = 0, total = 0, failed = 0;
    for (const item of plan.covered) {
      const loan = loans.find(l => String(l.id) === String(item.loanId));
      if (!loan) { failed++; continue; }
      const inst = (loan.installments || []).find(i => Number(i.number) === Number(item.number));
      if (!inst || inst.paid) { failed++; continue; }
      if (directPay(loan, inst)) {
        paid++;
        total += Number(inst.amount) || 0;
      } else failed++;
    }
    try { if (typeof showToast === 'function') showToast(paid + ' قسط پرداخت شد', paid ? 'success' : 'warning'); } catch (e) {}
    let msg = '✅ اجرا شد: <b>' + pd(paid) + '</b> قسط به مبلغ ' + money(total);
    if (failed) msg += '<br>⚠️ ' + pd(failed) + ' مورد انجام نشد (شاید قبلاً پرداخت شده).';
    return msg;
  }

  function payAllOverdues() {
    const items = getOverdues();
    if (!items.length) return 'معوقه‌ای برای پرداخت نیست.';
    let paid = 0, total = 0;
    for (const { loan, inst } of items) {
      if (directPay(loan, inst)) {
        paid++;
        total += Number(inst.amount) || 0;
      }
    }
    try { if (typeof showToast === 'function') showToast(paid + ' معوقه پرداخت شد', 'success'); } catch (e) {}
    return '✅ <b>' + pd(paid) + '</b> قسط معوق به مبلغ ' + money(total) + ' پرداخت شد.';
  }


  function payNextInstallment(loanFilter) {
    const items = getNextDue(20);
    let target = items[0];
    if (loanFilter) {
      const l = findLoan(loanFilter);
      if (l) target = items.find(x => String(x.loan.id) === String(l.id)) || null;
    }
    if (!target) return 'قسط پرداخت‌نشده‌ای پیدا نشد.';
    if (directPay(target.loan, target.inst)) {
      try { if (typeof showToast === 'function') showToast('قسط بعدی پرداخت شد', 'success'); } catch (e) {}
      return '✅ قسط ' + pd(target.inst.number) + ' وام «' + esc(target.loan.name) + '» به مبلغ ' + money(target.inst.amount) + ' پرداخت شد.';
    }
    return 'خطا در پرداخت قسط بعدی.';
  }

  function parseSimulate(x) {
    // «اگر ۵۰ میلیون پرداخت کنم» / «شبیه‌سازی پرداخت ۱۰۰ میلیون»
    if (!/(اگر|شبیه|شبیه‌سازی|فرض|با فرض).*(پرداخت|بپرداز)|(?:پرداخت|بپرداز).*(اگر|فرض)/.test(x) && !/شبیه/.test(x)) {
      // also: "اگر ۵۰ میلیون بدم چی میشه"
      if (!/(اگر|فرض کن).{0,40}(میلیون|میلیارد|تومان|ریال)/.test(x)) return null;
    }
    const m = x.match(/([0-9۰-۹][0-9۰-۹٬،,]*\s*(?:میلیون|میلیارد|هزار)?)/);
    if (!m) return null;
    return amountWithUnit(m[1]);
  }


  // ─── Intent scoring engine ───────────────────────────────────────────────
  const INTENTS = [
    {
      id: 'summary',
      score: (x) => {
        let s = 0;
        if (/(خلاصه|وضعیت|داشبورد|گزارش کلی|وضعیت کلی|خلاصه وضعیت)/.test(x)) s += 8;
        if (/(چطوره|چطوری|چیه وضعیت)/.test(x)) s += 5;
        if (/^(وضعیت|خلاصه)$/.test(x)) s += 10;
        return s;
      }
    },
    {
      id: 'overdues',
      score: (x) => {
        let s = 0;
        if (/(معوق|معوقات|عقب افتاده|عقب‌افتاده|دیرکرد|تاخیر|تأخیر|پرداخت نشده معوق)/.test(x)) s += 9;
        if (/(کدوم|کدام|بیشترین).*(معوق|عقب)/.test(x)) s += 4;
        return s;
      }
    },
    {
      id: 'today',
      score: (x) => {
        let s = 0;
        if (/(امروز|قسط امروز|اقساط امروز)/.test(x)) s += 9;
        if (/(چه قسطی.*امروز|امروز.*قسط)/.test(x)) s += 6;
        return s;
      }
    },
    {
      id: 'next',
      score: (x) => {
        let s = 0;
        if (/(قسط بعدی|بعدی|نزدیک‌ترین|نزدیکترین|آینده)/.test(x)) s += 7;
        if (/(چه موقع|کی.*پرداخت|زمان.*قسط)/.test(x)) s += 4;
        return s;
      }
    },
    {
      id: 'debt',
      score: (x) => {
        let s = 0;
        if (/(مجموع بدهی|کل بدهی|مانده کل|باقی‌مانده کل|چقدر بدهکار|کل مانده)/.test(x)) s += 9;
        if (/(بدهی|مانده|باقی‌مانده|باقی مانده)/.test(x) && !/(قسط|معوق)/.test(x)) s += 5;
        return s;
      }
    },
    {
      id: 'pay',
      score: (x) => {
        let s = 0;
        if (/(پرداخت کن|پرداختش کن|بزن پرداخت|ثبت پرداخت|پرداخت قسط)/.test(x)) s += 10;
        if (/(پرداخت|بپرداز|پرداختش)/.test(x) && /(قسط)/.test(x)) s += 7;
        if (/(پرداخت همه|همه رو پرداخت|پرداخت امروز)/.test(x)) s += 6;
        return s;
      }
    },
    {
      id: 'unpay',
      score: (x) => {
        let s = 0;
        if (/(لغو پرداخت|برگشت پرداخت|لغو قسط|پرداخت رو لغو|برگردان)/.test(x)) s += 10;
        if (/(لغو|برگردون|برگشت).*(پرداخت|قسط)/.test(x)) s += 7;
        return s;
      }
    },
    {
      id: 'create_loan',
      score: (x) => {
        let s = 0;
        if (/(ثبت وام|وام جدید|ایجاد وام|اضافه کردن وام|ثبت وام جدید)/.test(x)) s += 10;
        if (/(وام).*(ثبت|بساز|ایجاد)/.test(x)) s += 6;
        return s;
      }
    },
    {
      id: 'delete_loan',
      score: (x) => {
        let s = 0;
        if (/(حذف وام|پاک کن وام|حذف کن)/.test(x)) s += 9;
        if (/(حذف|پاک).*(وام)/.test(x)) s += 7;
        return s;
      }
    },
    {
      id: 'details',
      score: (x) => {
        let s = 0;
        if (/(جزئیات|وضعیت وام|اطلاعات وام|چقدر مانده|مانده وام)/.test(x)) s += 7;
        if (/(وام).*(چطوره|چیه|جزئیات)/.test(x)) s += 5;
        return s;
      }
    },
    {
      id: 'compare',
      score: (x) => {
        let s = 0;
        if (/(مقایسه|کدام بیشتر|بیشترین مانده|بیشترین معوق|رتبه‌بندی|کدوم وام)/.test(x)) s += 8;
        return s;
      }
    },
    {
      id: 'advice',
      score: (x) => {
        let s = 0;
        if (/(پیشنهاد|نصیحت|چی کار کنم|راهنمایی|اولویت|کدام را اول)/.test(x)) s += 8;
        if (/(کمک|راهنما)/.test(x) && !/(ثبت|پرداخت)/.test(x)) s += 3;
        return s;
      }
    },
    {
      id: 'navigate',
      score: (x) => {
        let s = 0;
        if (/(برو|باز کن|نمایش بده|ببر)/.test(x)) s += 4;
        if (/(خانه|داشبورد|تقویم|رسید|گزارش|تنظیمات|حساب بانکی)/.test(x)) s += 5;
        return s;
      }
    },
    {
      id: 'backup',
      score: (x) => {
        let s = 0;
        if (/(بکاپ|پشتیبان|backup|پشتیبان‌گیری|پشتیبان گیری)/.test(x)) s += 9;
        return s;
      }
    },
    {
      id: 'help',
      score: (x) => {
        let s = 0;
        if (/(کمک|راهنما|چه کارهایی|چیکار میتونی|دستورات|چی بلدی)/.test(x)) s += 8;
        if (/^help$|^راهنما$|^کمک$/.test(x)) s += 12;
        return s;
      }
    },
    {
      id: 'month_plan',
      score: (x) => {
        let s = 0;
        if (/(این ماه|اقساط این ماه|برنامه ماه|قسط‌های ماه|ماه جاری)/.test(x)) s += 9;
        if (/(ماه).*(قسط|پرداخت)/.test(x)) s += 5;
        return s;
      }
    },
    {
      id: 'simulate',
      score: (x) => {
        let s = 0;
        if (/(شبیه|شبیه‌سازی|اگر.*پرداخت|فرض کن)/.test(x)) s += 9;
        if (/(اگر).*(میلیون|میلیارد|بدم|پرداخت کنم)/.test(x)) s += 8;
        return s;
      }
    },
    {
      id: 'pay_next',
      score: (x) => {
        let s = 0;
        if (/(پرداخت قسط بعدی|قسط بعدی را پرداخت|بعدی رو بزن|پرداخت بعدی)/.test(x)) s += 10;
        if (/(قسط بعدی).*(پرداخت|بزن)/.test(x)) s += 8;
        return s;
      }
    },
    {
      id: 'learned',
      score: (x) => {
        let s = 0;
        if (/(دستورات پرتکرار|دستورات من|پرتکرار|یادگرفته)/.test(x)) s += 9;
        return s;
      }
    },
    {
      id: 'theme',
      score: (x) => {
        let s = 0;
        if (/(تم تاریک|دارک|حالت شب|حالت تاریک)/.test(x)) s += 8;
        if (/(تم روشن|حالت روشن|لایت)/.test(x)) s += 8;
        return s;
      }
    }
  ];

  function detectIntent(x) {
    let best = { id: null, score: 0 };
    for (const intent of INTENTS) {
      const sc = intent.score(x);
      if (sc > best.score) best = { id: intent.id, score: sc };
    }
    return best.score >= 4 ? best : { id: null, score: 0 };
  }

  // ─── Response builders ───────────────────────────────────────────────────
  function buildSummaryCard() {
    const p = portfolio();
    if (p.count === 0) {
      return 'هنوز هیچ وامی ثبت نکردی.<br>می‌تونی بگی: <b>«ثبت وام جدید»</b> یا از دکمه ثبت وام استفاده کن.';
    }
    const progress = p.totalInstallments ? Math.round((p.paidInstallments / p.totalInstallments) * 100) : 0;
    let html = '<b>📊 خلاصه وضعیت پرتفوی</b><br>';
    html += 'تعداد وام‌ها: <b>' + pd(p.count) + '</b><br>';
    html += 'پرداخت‌شده: <b>' + money(p.totalPaid) + '</b><br>';
    html += 'مانده کل: <b>' + money(p.totalRemaining) + '</b><br>';
    html += 'پیشرفت اقساط: <b>' + pd(progress) + '٪</b> (' + pd(p.paidInstallments) + ' از ' + pd(p.totalInstallments) + ')<br>';
    if (p.totalOverdueCount > 0) {
      html += '<span style="color:#be123c">⚠️ معوقات: <b>' + pd(p.totalOverdueCount) + '</b> قسط به مبلغ ' + money(p.totalOverdueAmount) + '</span><br>';
    } else {
      html += '✅ معوقه‌ای نداری. عالی!<br>';
    }
    if (p.mostRemaining) {
      html += '<br>بیشترین مانده: <b>' + esc(p.mostRemaining.loan.name) + '</b> (' + money(p.mostRemaining.s.remainingAmount) + ')';
    }
    if (p.nextItems.length) {
      const n = p.nextItems[0];
      html += '<br>نزدیک‌ترین قسط: <b>' + money(n.inst.amount) + '</b> — ' + dateText(n.inst.date) + ' («' + esc(n.loan.name) + '»)';
    }
    if (p.totalOverdueCount > 0) {
      html += '<br><br>💡 پیشنهاد: اول معوقات رو تسویه کن. بگو «معوقات» تا لیست دقیق ببینم.';
    } else if (p.nextItems.length) {
      html += '<br><br>💡 می‌تونی بگی «قسط امروز» یا «پرداخت قسط بعدی».';
    }
    return html;
  }

  function buildOverduesCard() {
    const items = getOverdues();
    if (!items.length) return '✅ هیچ قسط معوقی نداری. وضعیت عالیه!';
    let html = '<b>⚠️ اقساط معوق (' + pd(items.length) + ')</b><br>';
    const limit = Math.min(items.length, 8);
    for (let i = 0; i < limit; i++) {
      const { loan, inst } = items[i];
      html += '• قسط ' + pd(inst.number) + ' «' + esc(loan.name) + '» — ' + money(inst.amount) + ' — ' + dateText(inst.date) + '<br>';
    }
    if (items.length > limit) html += '... و ' + pd(items.length - limit) + ' مورد دیگر<br>';
    html += '<br>برای پرداخت بگو مثلاً: <b>«قسط ' + pd(items[0].inst.number) + ' وام ' + esc(items[0].loan.name) + ' را پرداخت کن»</b>';
    return html;
  }

  function buildTodayCard() {
    const items = getTodayDue();
    if (!items.length) return 'امروز قسطی سررسید نشده. 👍<br>بگو «قسط بعدی» تا نزدیک‌ترین‌ها رو ببینم.';
    let total = 0;
    let html = '<b>📅 اقساط امروز (' + pd(items.length) + ')</b><br>';
    items.forEach(({ loan, inst }) => {
      total += Number(inst.amount) || 0;
      html += '• قسط ' + pd(inst.number) + ' «' + esc(loan.name) + '» — ' + money(inst.amount) + '<br>';
    });
    html += '<br>جمع امروز: <b>' + money(total) + '</b>';
    html += '<br><br>برای پرداخت همه بگو: <b>«همه اقساط امروز را پرداخت کن»</b>';
    return html;
  }

  function buildNextCard() {
    const items = getNextDue(6);
    if (!items.length) return 'قسط پرداخت‌نشده‌ای در آینده پیدا نشد.';
    let html = '<b>🔜 نزدیک‌ترین اقساط</b><br>';
    items.forEach(({ loan, inst }) => {
      html += '• ' + dateText(inst.date) + ' — قسط ' + pd(inst.number) + ' «' + esc(loan.name) + '» — ' + money(inst.amount) + '<br>';
    });
    return html;
  }

  function buildDebtCard() {
    const p = portfolio();
    if (!p.count) return 'وامی ثبت نشده.';
    let html = '<b>💰 مجموع بدهی (مانده)</b><br>کل مانده: <b>' + money(p.totalRemaining) + '</b><br><br>';
    p.loanStats.slice(0, 6).forEach(({ loan, s }) => {
      html += '• ' + esc(loan.name) + ': ' + money(s.remainingAmount) + (s.overdueCount ? ' <span style="color:#be123c">(' + pd(s.overdueCount) + ' معوق)</span>' : '') + '<br>';
    });
    return html;
  }

  function buildLoanDetails(loan) {
    if (!loan) return 'وام مورد نظر پیدا نشد. نام دقیق‌تر بگو.';
    const s = stats(loan);
    const next = s.next;
    let html = '<b>📋 ' + esc(loan.name) + '</b>';
    if (loan.party) html += '<br>طرف حساب: ' + esc(loan.party);
    html += '<br>پرداخت‌شده: ' + money(s.paidAmount || 0) + ' (' + pd(s.paidCount || 0) + ' قسط)';
    html += '<br>مانده: <b>' + money(s.remainingAmount || 0) + '</b>';
    if (s.overdueCount) html += '<br><span style="color:#be123c">معوق: ' + pd(s.overdueCount) + ' قسط — ' + money(s.overdueAmount) + '</span>';
    if (next) html += '<br>قسط بعدی: ' + money(next.amount) + ' — ' + dateText(next.date);
    html += '<br><br><button class="vam-assistant-action" data-act="manage" data-id="' + esc(loan.id) + '">مدیریت اقساط</button> ';
    html += '<button class="vam-assistant-action" data-act="report" data-id="' + esc(loan.id) + '">گزارش</button>';
    return html;
  }

  function buildCompareCard() {
    const p = portfolio();
    if (p.count < 2) return 'برای مقایسه حداقل دو وام لازم است.';
    let html = '<b>⚖️ مقایسه وام‌ها (بر اساس مانده)</b><br>';
    p.loanStats.forEach(({ loan, s }, idx) => {
      html += (idx + 1) + '. <b>' + esc(loan.name) + '</b> — مانده ' + money(s.remainingAmount);
      if (s.overdueCount) html += ' | معوق ' + pd(s.overdueCount);
      html += '<br>';
    });
    if (p.mostOverdue && p.mostOverdue.s.overdueCount > 0) {
      html += '<br>🚨 بیشترین معوقه: <b>' + esc(p.mostOverdue.loan.name) + '</b> (' + pd(p.mostOverdue.s.overdueCount) + ' قسط)';
    }
    return html;
  }

  function buildAdviceCard() {
    const p = portfolio();
    if (!p.count) return 'اول یک وام ثبت کن تا بتونم راهنمایی کنم.';
    let tips = [];
    if (p.totalOverdueCount > 0) {
      tips.push('اولویت اول: تسویه <b>' + pd(p.totalOverdueCount) + ' قسط معوق</b> به مبلغ ' + money(p.totalOverdueAmount) + '. بگو «معوقات».');
    }
    const todayItems = getTodayDue();
    if (todayItems.length) {
      tips.push('امروز ' + pd(todayItems.length) + ' قسط سررسید داری. می‌تونی بگی «همه اقساط امروز را پرداخت کن».');
    }
    if (p.mostRemaining && p.count > 1) {
      tips.push('بیشترین فشار بدهی روی «' + esc(p.mostRemaining.loan.name) + '» است.');
    }
    const monthItems = getMonthDues().filter(x => !x.inst.paid);
    if (monthItems.length) {
      const sum = monthItems.reduce((s, x) => s + (Number(x.inst.amount) || 0), 0);
      tips.push('این ماه هنوز <b>' + pd(monthItems.length) + '</b> قسط به مبلغ ' + money(sum) + ' مانده. بگو «اقساط این ماه».');
    }
    if (!tips.length) {
      tips.push('وضعیت خوبه. نزدیک‌ترین قسط رو با «قسط بعدی» چک کن و به‌موقع پرداخت کن.');
    }
    tips.push('می‌تونی شبیه‌سازی کنی: «اگر ۵۰ میلیون پرداخت کنم چی میشه؟»');
    return '<b>💡 پیشنهادهای من</b><br>' + tips.map((t, i) => (i + 1) + '. ' + t).join('<br>');
  }

  function buildHelpCard() {
    return `<b>🤖 من چیکار می‌تونم برات انجام بدم؟</b><br>
• خلاصه وضعیت / مجموع بدهی / معوقات / قسط امروز / قسط بعدی<br>
• <b>برنامه این ماه</b> و <b>شبیه‌سازی + اجرای واقعی</b>: «اگر ۵۰ میلیون پرداخت کنم» سپس «تأیید»<br>• <b>پرداخت همه معوقات</b> / همه اقساط امروز<br>
• پرداخت قسط: «قسط ۳ وام ملت را پرداخت کن» · «قسط بعدی را پرداخت کن»<br>
• لغو پرداخت · جزئیات وام · مقایسه وام‌ها · پیشنهاد اولویت<br>
• ثبت / حذف وام · بکاپ · تغییر تم<br>
• ناوبری: داشبورد، مدیریت اقساط، رسیدها، گزارش، تنظیمات، حساب بانکی<br>
• دستورات پرتکرار شما (یادگیری خودکار)<br>
<br>مثال‌ها:<br>
«چقدر بدهکارم؟» · «اقساط این ماه» · «اگر ۸۰ میلیون بدم چی میشه؟» · «اولویت پرداخت چیه؟»`;
  }

  // ─── Parse helpers for pay / create ──────────────────────────────────────
  function parsePayCommand(x) {
    if (!/(پرداخت|بپرداز)/.test(x)) return null;
    if (/(همه|کل).*(امروز)|امروز.*(همه|کل)/.test(x) || /پرداخت همه اقساط امروز/.test(x)) {
      return { type: 'pay-today-all' };
    }
    const numInst = extractInstallmentNumber(x);
    const loan = findLoan(extractLoanQuery(x));
    if (numInst && loan) return { type: 'pay', loan, number: numInst };
    if (numInst && !loan) return { type: 'pay', number: numInst, needLoan: true };
    if (!numInst && loan) return { type: 'pay', loan, needNumber: true };
    return null;
  }

  function parseCancelPayCommand(x) {
    if (!/(لغو|برگرد|برگشت).*(پرداخت|قسط)|(پرداخت).*(لغو)/.test(x)) return null;
    const numInst = extractInstallmentNumber(x);
    const loan = findLoan(extractLoanQuery(x));
    if (numInst && loan) return { type: 'unpay', loan, number: numInst };
    return null;
  }

  function parseCreate(x) {
    if (!/(ثبت|ایجاد|اضافه|افزودن|بساز).*(وام)|وام.*(ثبت|ایجاد|اضافه|بساز)/.test(x)) return null;
    const nameM = x.match(/(?:به نام|نام|وام)\s+([\u0600-\u06ff\w\- ]{2,50}?)(?=\s+(?:مبلغ|به مبلغ|تومان|ریال|قسط|تعداد|با|از|در|برای)\b|$)/);
    const amountM = x.match(/(?:مبلغ|به مبلغ)\s*([0-9۰-۹][0-9۰-۹٬،,]*\s*(?:میلیون|میلیارد|هزار)?)/);
    const countM = x.match(/(?:تعداد|در)\s*([0-9۰-۹]+)\s*(?:قسط|ماه)/);
    const instM = x.match(/(?:هر قسط|مبلغ قسط|قسط)\s*([0-9۰-۹٬،,]+\s*(?:میلیون|میلیارد|هزار)?)/);
    const name = nameM ? nameM[1].trim() : '';
    if (!name) return { missing: 'نام وام' };
    return {
      type: 'prepare-loan',
      name,
      amount: amountM ? amountWithUnit(amountM[1]) : 0,
      count: countM ? num(countM[1]) : 0,
      installmentAmount: instM ? amountWithUnit(instM[1]) : 0
    };
  }

  // ─── Main answer engine ──────────────────────────────────────────────────
  function answer(q) {
    const x = norm(q);
    const ls = getLoans();
    if (!x) return 'سؤالت رو بنویس تا بررسی کنم. 😊';

    if (/^(لغو دستور|لغو|انصراف|cancel|بیخیال|بی خیال)$/.test(x)) {
      pendingAction = null;
      ctx.pendingClarification = null;
      return 'دستور لغو شد. 👍';
    }

    if (ctx.pendingClarification) {
      const pc = ctx.pendingClarification;
      // confirm sim plan
      if (pc.type === 'confirm-sim-plan') {
        if (/^(تأیید|تایید|بله|آره|باشه|اجرا|پرداخت کن|همینا|همینا رو پرداخت کن|همینا را پرداخت کن|انجام بده)$/.test(x)
            || /(همینا|همین‌ها|همینها).*(پرداخت)|^(تأیید|تایید)/.test(x)) {
          return executeSimPlan();
        }
        if (/^(لغو|انصراف|نه|نخير|نخير|cancel)/.test(x) || /لغو/.test(x)) {
          ctx.pendingClarification = null;
          ctx.lastSimPlan = null;
          return 'اجرای شبیه‌سازی لغو شد. 👍';
        }
        // keep pending if user said something else mild
        if (/(تأیید|تایید|پرداخت|همینا)/.test(x)) return executeSimPlan();
        ctx.pendingClarification = null;
        // fall through to normal handling
      } else {
        ctx.pendingClarification = null;
        if (pc.type === 'pay-need-loan') {
          const loan = findLoan(x);
          if (loan) {
            executeAction({ type: 'pay', loan, number: pc.number });
            return 'قسط ' + pd(pc.number) + ' وام «' + esc(loan.name) + '» پرداخت شد. ✅';
          }
          return 'وام پیدا نشد. دوباره نام وام رو بگو یا «لغو».';
        }
        if (pc.type === 'pay-need-number') {
          const n = extractInstallmentNumber(x) || num(x);
          if (n > 0 && pc.loan) {
            executeAction({ type: 'pay', loan: pc.loan, number: n });
            return 'قسط ' + pd(n) + ' وام «' + esc(pc.loan.name) + '» پرداخت شد. ✅';
          }
          return 'شماره قسط مشخص نشد. مثلاً بگو «۳» یا «قسط سوم».';
        }
        if (pc.type === 'confirm-pay-overdues') {
          if (/^(تأیید|تایید|بله|آره|باشه|پرداخت کن)/.test(x)) return payAllOverdues();
          return 'پرداخت معوقات لغو شد.';
        }
      }
    }

    // Batch: pay all overdues
    if (/(همه معوقات|کل معوقات|معوقات را پرداخت|معوقه‌ها را پرداخت|پرداخت همه معوق)/.test(x)) {
      const items = getOverdues();
      if (!items.length) return 'معوقه‌ای وجود ندارد.';
      const amt = items.reduce((s, i) => s + (Number(i.inst.amount) || 0), 0);
      if (items.length >= 3 || amt > 0) {
        // soft confirm for large batches
        if (items.length >= 5 && !/(حتما|قطعی|تأیید|تایید|الان پرداخت)/.test(x)) {
          ctx.pendingClarification = { type: 'confirm-pay-overdues' };
          return '⚠️ می‌خوای <b>' + pd(items.length) + '</b> قسط معوق به مبلغ ' + money(amt) + ' یکجا پرداخت بشه؟<br>بگو <b>تأیید</b> یا <b>لغو</b>.';
        }
      }
      return payAllOverdues();
    }

    // Confirm leftover phrases even without pending (if plan exists)
    if (ctx.lastSimPlan && /(همینا رو پرداخت|همینا را پرداخت|اجرای شبیه|تأیید پرداخت|تایید پرداخت)/.test(x)) {
      return executeSimPlan();
    }

    const payCmd = parsePayCommand(x);
    if (payCmd) {
      if (payCmd.type === 'pay-today-all') {
        const r = payToday();
        if (!r.paid) return 'امروز قسط پرداخت‌نشده‌ای نبود یا همه قبلاً پرداخت شده‌اند.';
        return '✅ ' + pd(r.paid) + ' قسط امروز پرداخت شد. جمع: ' + money(r.total);
      }
      if (payCmd.needLoan) {
        ctx.pendingClarification = { type: 'pay-need-loan', number: payCmd.number };
        return 'کدام وام؟ نام وام را بگو (مثلاً «ملت» یا نام کامل).';
      }
      if (payCmd.needNumber) {
        ctx.pendingClarification = { type: 'pay-need-number', loan: payCmd.loan };
        return 'شماره قسط کدام است؟ (مثلاً ۳ یا «سوم»)';
      }
      if (payCmd.loan && payCmd.number) {
        const inst = (payCmd.loan.installments || []).find(i => Number(i.number) === Number(payCmd.number));
        if (!inst) return 'قسط ' + pd(payCmd.number) + ' در وام «' + esc(payCmd.loan.name) + '» پیدا نشد.';
        if (inst.paid) return 'این قسط قبلاً پرداخت شده.';
        if (directPay(payCmd.loan, inst)) {
          try { if (typeof showToast === 'function') showToast('قسط پرداخت شد', 'success'); } catch (e) {}
          return '✅ قسط ' + pd(payCmd.number) + ' وام «' + esc(payCmd.loan.name) + '» به مبلغ ' + money(inst.amount) + ' پرداخت شد.';
        }
        return 'خطا در ثبت پرداخت.';
      }
    }

    const unpayCmd = parseCancelPayCommand(x);
    if (unpayCmd && unpayCmd.loan && unpayCmd.number) {
      executeAction(unpayCmd);
      return 'پرداخت قسط ' + pd(unpayCmd.number) + ' وام «' + esc(unpayCmd.loan.name) + '» لغو شد.';
    }

    const createCmd = parseCreate(x);
    if (createCmd) {
      if (createCmd.missing) return 'برای ثبت وام، حداقل نام وام را بگو. مثال: «ثبت وام بانک ملت به مبلغ ۵۰۰ میلیون، ۲۴ قسط»';
      executeAction(createCmd);
      return 'فرم ثبت وام با اطلاعات استخراج‌شده آماده شد. بررسی کن و ذخیره کن.';
    }

    const { id: intent } = detectIntent(x);
    ctx.lastIntent = intent;

    if (intent === 'navigate' || /^(خانه|داشبورد|صفحه اصلی)/.test(x)) {
      if (/(خانه|داشبورد|صفحه اصلی)/.test(x)) { go('dashboard'); return 'داشبورد باز شد. 🏠'; }
      if (/(ثبت وام|وام جدید)/.test(x)) { go('register-loan'); return 'فرم ثبت وام باز شد.'; }
      if (/(مدیریت اقساط|لیست اقساط)/.test(x)) { const loan = findLoan(extractLoanQuery(x)); go('manage-loans', loan); return 'مدیریت اقساط باز شد.'; }
      if (/(رسید)/.test(x)) { go('payment-receipts'); return 'بخش رسیدهای پرداخت باز شد.'; }
      if (/(گزارش)/.test(x)) { const loan = findLoan(extractLoanQuery(x)); go('reports', loan); return 'گزارش باز شد.'; }
      if (/(بکاپ|پشتیبان|حذف داده)/.test(x)) { go('backup-delete'); return 'بخش پشتیبان و حذف باز شد.'; }
      if (/(تنظیمات)/.test(x)) {
        try { document.getElementById('settings-modal')?.classList.add('open'); } catch(e) {}
        return 'تنظیمات باز شد.';
      }
      if (/(حساب بانکی|کارت بانکی)/.test(x)) {
        try { document.getElementById('bank-accounts-modal')?.classList.add('open'); } catch(e) {}
        return 'حساب‌های بانکی باز شد.';
      }
    }

    // Simulation early (natural language)
    const simAmt = parseSimulate(x);
    if (simAmt || intent === 'simulate') {
      const amt = simAmt || amountWithUnit((x.match(/([0-9۰-۹][0-9۰-۹٬،,]*\s*(?:میلیون|میلیارد|هزار)?)/) || [])[1] || '0');
      if (amt > 0) return buildSimulateCard(amt);
      return 'مبلغ را بگو. مثال: «اگر ۸۰ میلیون پرداخت کنم چی میشه؟»';
    }

    if (intent === 'month_plan') return buildMonthPlanCard();
    if (intent === 'pay_next') return payNextInstallment(extractLoanQuery(x));
    if (intent === 'learned') {
      const tops = topLearned(8);
      if (!tops.length) return 'هنوز دستور پرتکراری ذخیره نشده. با استفاده عادی، دستورات پرتکرار اینجا ظاهر می‌شوند.';
      return '<b>📌 دستورات پرتکرار شما</b><br>' + tops.map((t,i)=> (i+1)+'. '+esc(t)).join('<br>') + '<br><br>روی هر کدام کلیک کن یا دوباره تایپ کن.';
    }

    if (intent === 'summary') return buildSummaryCard();
    if (intent === 'overdues') return buildOverduesCard();
    if (intent === 'today') return buildTodayCard();
    if (intent === 'next') return buildNextCard();
    if (intent === 'debt') return buildDebtCard();
    if (intent === 'compare') return buildCompareCard();
    if (intent === 'advice') return buildAdviceCard();
    if (intent === 'help') return buildHelpCard();

    if (intent === 'details' || (/(وضعیت|جزئیات|مانده|چقدر).*(وام)|وام.*(وضعیت|جزئیات)/.test(x))) {
      const loan = findLoan(extractLoanQuery(x));
      if (loan) return buildLoanDetails(loan);
      if (ls.length === 1) return buildLoanDetails(ls[0]);
      return 'کدام وام؟ نامش را بگو یا بگو «خلاصه وضعیت».';
    }

    if (intent === 'create_loan' || /^(ثبت وام|وام جدید)$/.test(x)) {
      go('register-loan');
      return 'بخش ثبت وام جدید باز شد. 📝';
    }

    if (intent === 'delete_loan') {
      const l = findLoan(extractLoanQuery(x));
      if (!l) return 'نام وام را هم بگو؛ مثلاً «وام ملت را حذف کن».';
      window.loans = getLoans().filter(v => String(v.id) !== String(l.id));
      if (Array.isArray(window.loanOrder)) window.loanOrder = window.loanOrder.filter(id => String(id) !== String(l.id));
      try { persist(); } catch (e) {}
      try { refreshAllViews('assistant-delete'); } catch (e) {}
      return 'وام «' + esc(l.name) + '» حذف شد. 🗑️';
    }

    if (intent === 'backup') {
      try {
        if (typeof backupData === 'function') { backupData(); return 'پشتیبان‌گیری انجام شد. 💾'; }
      } catch (e) {}
      return 'پشتیبان‌گیری اجرا نشد.';
    }

    if (intent === 'theme') {
      try {
        if (/(تاریک|دارک|شب)/.test(x)) {
          if (!document.body.classList.contains('dark-theme') && typeof toggleTheme === 'function') toggleTheme();
          return 'تم تاریک فعال شد. 🌙';
        }
        if (/(روشن|لایت)/.test(x)) {
          if (document.body.classList.contains('dark-theme') && typeof toggleTheme === 'function') toggleTheme();
          return 'تم روشن فعال شد. ☀️';
        }
      } catch (e) {}
    }

    const maybeLoan = findLoan(extractLoanQuery(x));
    if (maybeLoan && x.length > 2) {
      return buildLoanDetails(maybeLoan);
    }

    const p = portfolio();
    let hint = 'این مورد رو دقیق متوجه نشدم. 🤔<br>';
    if (p.totalOverdueCount > 0) hint += 'الان <b>' + pd(p.totalOverdueCount) + ' قسط معوق</b> داری — بگو «معوقات».<br>';
    hint += 'یا امتحان کن: <b>خلاصه وضعیت</b> · <b>قسط امروز</b> · <b>مجموع بدهی</b> · <b>کمک</b>';
    return hint;
  }

  function snapshotInstallments() {
    const m = new Map();
    getLoans().forEach(l => {
      (l.installments || []).forEach(i => {
        m.set(String(l.id) + '|' + String(i.number), !!i.paid);
      });
    });
    return m;
  }

  function watchManualChanges() {
    try {
      assistantLastSnapshot = snapshotInstallments();
    } catch (e) {}
  }

  function setupVoice() {
    const btn = $('vam-assistant-voice');
    const input = $('vam-assistant-input');
    if (!btn || !input) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      btn.style.opacity = '0.4';
      btn.title = 'تشخیص گفتار در این مرورگر پشتیبانی نمی‌شود';
      return;
    }
    vamSpeechRecognition = new SR();
    vamSpeechRecognition.lang = 'fa-IR';
    vamSpeechRecognition.interimResults = false;
    vamSpeechRecognition.onresult = (ev) => {
      const t = ev.results[0][0].transcript;
      input.value = t;
      send();
    };
    vamSpeechRecognition.onend = () => {
      vamSpeechListening = false;
      btn.classList.remove('listening');
    };
    btn.onclick = () => {
      if (vamSpeechListening) {
        try { vamSpeechRecognition.stop(); } catch (e) {}
        return;
      }
      try {
        vamSpeechRecognition.start();
        vamSpeechListening = true;
        btn.classList.add('listening');
      } catch (e) {}
    };
  }

  function bindActions() {
    document.querySelectorAll('.vam-assistant-action').forEach(b => {
      if (b.dataset.bound) return;
      b.dataset.bound = '1';
      b.onclick = () => {
        const loan = getLoans().find(l => String(l.id) === String(b.dataset.id));
        if (!loan) return;
        if (b.dataset.act === 'manage') executeAction({ type: 'open-page', page: 'manage-loans', loan });
        else executeAction({ type: 'open-page', page: 'reports', loan });
      };
    });
  }

  function send() {
    const input = $('vam-assistant-input');
    if (!input) return;
    const q = input.value.trim();
    if (!q) return;
    add('user', esc(q));
    input.value = '';
    const typing = $('vam-assistant-typing');
    typing?.classList.add('show');
    setTimeout(() => {
      typing?.classList.remove('show');
      Promise.resolve(answer(q)).then(r => {
        add('bot', r);
        bindActions();
        ctx.history.push({ role: 'user', text: q });
        if (ctx.history.length > 12) ctx.history.shift();
        // learn non-trivial successful queries
        if (r && !/متوجه نشدم|پیدا نشد|خطا|معتبر|کدام وام|شماره قسط/.test(String(r))) {
          try { rememberCommand(q); } catch (e) {}
        }
      }).catch(() => add('bot', 'اجرای دستور با خطا مواجه شد.'));
    }, 180);
  }

  function init() {
    if ($('vam-assistant-root')) {
      const oldFab = $('vam-assistant-fab');
      if (oldFab) oldFab.remove();
    }
    assistantLastSnapshot = snapshotInstallments();
    setInterval(watchManualChanges, 1200);

    const root = document.createElement('div');
    root.id = 'vam-assistant-root';
    root.innerHTML = `
<div id="vam-assistant-overlay" class="vam-assistant-overlay">
  <div class="vam-assistant-panel" role="dialog" aria-label="دستیار هوشمند">
    <div class="vam-assistant-head">
      <div class="vam-assistant-title">
        <span class="vam-assistant-head-icon">${fa}</span>
        <div>
          <strong>دستیار هوشمند v9.0.13</strong>
          <small>آفلاین • شبیه‌سازی اجرایی • یادآوری هوشمند</small>
        </div>
      </div>
      <button id="vam-assistant-close" class="vam-assistant-close">×</button>
    </div>
    <div id="vam-assistant-messages" class="vam-assistant-messages">
      <div class="vam-assistant-msg bot">
        <span class="vam-assistant-avatar">${fa}</span>
        <div class="vam-assistant-bubble">
          سلام 👋 من نسخه <b>۹.۰.۱</b> دستیار هوشمند هستم.<br>
          تحلیل پرتفوی، معوقات، برنامه ماه، شبیه‌سازی پرداخت و پیشنهاد اولویت.<br>
          امتحان کن: <b>خلاصه وضعیت</b> · <b>اقساط این ماه</b> · <b>اگر ۵۰ میلیون بدم چی میشه؟</b>
        </div>
      </div>
    </div>
    <div id="vam-assistant-typing" class="vam-assistant-typing">در حال بررسی…</div>
    <div class="vam-assistant-quick">
      <button data-q="خلاصه وضعیت">خلاصه</button>
      <button data-q="معوقات">معوقات</button>
      <button data-q="همه معوقات را پرداخت کن">پرداخت معوقات</button>
      <button data-q="اقساط این ماه">این ماه</button>
      <button data-q="قسط امروز">امروز</button>
      <button data-q="پیشنهاد بده">پیشنهاد</button>
      <button data-q="کمک">کمک</button>
    </div>
    <div class="vam-assistant-input">
      <input id="vam-assistant-input" placeholder="مثلاً: قسط ۳ وام ملت را پرداخت کن / چقدر بدهکارم؟" autocomplete="off">
      <button id="vam-assistant-voice" class="vam-assistant-voice" aria-label="دستور صوتی" title="دستور صوتی"><i class="fa-solid fa-microphone"></i></button>
      <button id="vam-assistant-send" aria-label="ارسال"><i class="fa-solid fa-paper-plane"></i></button>
    </div>
  </div>
</div>`;
    document.body.appendChild(root);

    const fab = $('fab-assistant');
    if (fab) fab.onclick = open;
    $('vam-assistant-close').onclick = close;
    $('vam-assistant-send').onclick = send;
    $('vam-assistant-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') send();
      if (e.key === 'Escape') close();
    });
    root.querySelectorAll('.vam-assistant-quick button').forEach(b => b.onclick = () => quick(b.dataset.q));
    setupVoice();
    $('vam-assistant-overlay').addEventListener('click', e => {
      if (e.target.id === 'vam-assistant-overlay') close();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.openVamAssistant = open;
  window.vamAssistantAnswer = answer;
})();
