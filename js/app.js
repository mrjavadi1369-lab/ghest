    // ============================================================
    //  TOAST + GLASS CONFIRM (پیام‌های شیشه‌ای یکدست — بالای صفحه)
    // ============================================================
    let toastTimer = null;
    let glassConfirmResolver = null;

    function showToast(message, type = 'success') {
      const toast = document.getElementById('toast');
      if (!toast) return;
      const icon = toast.querySelector('.toast-icon');
      const msg = document.getElementById('toast-message');
      
      icon.className = 'toast-icon fa-solid';
      if (type === 'success') {
        icon.classList.add('fa-circle-check');
        toast.className = 'toast-success';
      } else if (type === 'error') {
        icon.classList.add('fa-circle-xmark');
        toast.className = 'toast-error';
      } else if (type === 'warning') {
        icon.classList.add('fa-triangle-exclamation');
        toast.className = 'toast-warning';
      } else {
        icon.classList.add('fa-circle-info');
        toast.className = 'toast-info';
      }
      
      msg.textContent = message;
      toast.classList.remove('hidden');
      
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toast.classList.add('hidden');
      }, 3200);
    }

    function closeGlassConfirm(result) {
      const overlay = document.getElementById('glass-confirm-overlay');
      if (overlay) {
        overlay.classList.add('hidden');
      }
      if (glassConfirmResolver) {
        const r = glassConfirmResolver;
        glassConfirmResolver = null;
        r(!!result);
      }
    }

    /** تأیید شیشه‌ای — جایگزین confirm مرورگر. Promise<boolean> */
    function showConfirmGlass(message, options = {}) {
      return new Promise((resolve) => {
        // اگر تأیید قبلی باز است، آن را ببند
        if (glassConfirmResolver) {
          glassConfirmResolver(false);
          glassConfirmResolver = null;
        }
        glassConfirmResolver = resolve;
        const overlay = document.getElementById('glass-confirm-overlay');
        const body = document.getElementById('glass-confirm-body');
        const titleEl = document.getElementById('glass-confirm-title-text');
        const okBtn = document.getElementById('glass-confirm-ok');
        const cancelBtn = document.getElementById('glass-confirm-cancel');
        if (!overlay || !body) {
          resolve(window.confirm(message));
          return;
        }
        titleEl.textContent = options.title || 'تأیید';
        body.textContent = message;
        okBtn.textContent = options.okText || 'تأیید';
        cancelBtn.textContent = options.cancelText || 'انصراف';
        okBtn.onclick = () => closeGlassConfirm(true);
        cancelBtn.onclick = () => closeGlassConfirm(false);
        overlay.onclick = (e) => {
          if (e.target === overlay) closeGlassConfirm(false);
        };
        overlay.classList.remove('hidden');
        // فوکوس دکمه تأیید برای دسترسی‌پذیری
        setTimeout(() => okBtn.focus(), 50);
      });
    }


    /** اطلاعات پرداخت — Promise<{source:string,dateIso:string}|null> */
    let paySourceResolver = null;
    function closePaySourcePrompt(result) {
      const overlay = document.getElementById('pay-source-overlay');
      if (overlay) overlay.classList.add('hidden');
      if (paySourceResolver) {
        const r = paySourceResolver;
        paySourceResolver = null;
        r(result);
      }
    }
    function fillPayDestSelect() {
      const sel = document.getElementById('pay-dest-select');
      if (!sel) return;
      const accounts = getBankAccounts();
      const cur = sel.value;
      sel.innerHTML = '<option value="">انتخاب حساب ثبت‌شده</option>';
      accounts.forEach(a => {
        const num = a.number ? formatBankNumber(a.number, a.type) : '';
        // عنوان فارسی + ایزوله LTR برای شماره تا در RTL برعکس نشود
        const label = (a.title || 'حساب')
          + (a.bank ? ' · ' + a.bank : '')
          + (num ? ' · ' + ltrIsolate(num) : '');
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = label;
        // بعضی مرورگرها dir روی option را هم احترام می‌گذارند
        try { opt.dir = 'rtl'; } catch (_) {}
        sel.appendChild(opt);
      });
      if (cur && accounts.some(a => String(a.id) === String(cur))) sel.value = cur;
    }
    function resolvePayDestination() {
      const sel = document.getElementById('pay-dest-select');
      const input = document.getElementById('pay-source-input');
      const manual = String(input?.value || '').trim();
      if (manual) return manual;
      const id = sel?.value;
      if (!id) return '';
      const acc = getBankAccounts().find(a => String(a.id) === String(id));
      if (!acc) return '';
      // نمایش کامل در رسید: عنوان + شماره
      const num = acc.number ? formatBankNumber(acc.number, acc.type) : '';
      // ذخیره بدون کاراکتر ایزوله؛ فقط برای نمایش ایزوله می‌شود
      const parts = [acc.title, acc.bank, num].filter(Boolean);
      return parts.join(' · ');
    }
    function showPaySourcePrompt(message, options = {}) {
      return new Promise((resolve) => {
        if (paySourceResolver) {
          paySourceResolver(null);
          paySourceResolver = null;
        }
        paySourceResolver = resolve;
        const overlay = document.getElementById('pay-source-overlay');
        const body = document.getElementById('pay-source-body');
        const input = document.getElementById('pay-source-input');
        const dateInput = document.getElementById('pay-paid-date');
        const dateBtn = document.getElementById('pay-paid-date-btn');
        const okBtn = document.getElementById('pay-source-ok');
        const cancelBtn = document.getElementById('pay-source-cancel');
        if (!overlay) {
          const fallback = window.prompt((message || '') + '\n\nشماره حساب / کارت مبدأ (اختیاری):', '');
          resolve(fallback === null ? null : { source: String(fallback).trim(), dateIso: inputDateToPaidAtIso('') });
          return;
        }
        if (body) body.textContent = message || '';
        if (input) input.value = '';
        if (dateInput) dateInput.value = formatDateToPersian(todayISO());
        if (dateBtn) {
          dateBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); if (typeof jdpOpen === 'function') jdpOpen(dateInput); };
        }
        fillPayDestSelect();
        const sel = document.getElementById('pay-dest-select');
        if (sel) sel.value = '';
        okBtn.textContent = options.okText || 'ثبت پرداخت';
        cancelBtn.textContent = options.cancelText || 'انصراف';
        okBtn.onclick = () => {
          const dateIso = inputDateToPaidAtIso(dateInput?.value || '');
          closePaySourcePrompt({ source: resolvePayDestination(), dateIso });
        };
        cancelBtn.onclick = () => closePaySourcePrompt(null);
        overlay.onclick = (e) => { if (e.target === overlay) closePaySourcePrompt(null); };
        if (input) {
          input.onkeydown = (e) => {
            if (e.key === 'Enter') { e.preventDefault(); closePaySourcePrompt({ source: resolvePayDestination(), dateIso: inputDateToPaidAtIso(dateInput?.value || '') }); }
            if (e.key === 'Escape') { e.preventDefault(); closePaySourcePrompt(null); }
          };
        }
        overlay.classList.remove('hidden');
        setTimeout(() => {
          // تقویم فقط با کلیک روی دکمه/فیلد تاریخ باز شود — نه خودکار
          if (sel && getBankAccounts().length) sel.focus();
          else if (input) input.focus();
          else if (okBtn) okBtn.focus();
        }, 60);
      });
    }


    /** نرمال‌سازی ارقام به انگلیسی و حذف فاصله */
    function digitsOnlyEn(str) {
      return toEnglishDigits(String(str || '')).replace(/[^\d]/g, '');
    }
    /**
     * فرمت شماره کارت/حساب برای نمایش:
     * - کارت (۱۳–۱۹ رقم): هر ۴ رقم یک خط‌تیره  6037-9911-2222-3333
     * - شبا (IR + ۲۴ رقم): IR00-0000-...
     * - سایر: فقط ارقام انگلیسی با گروه‌بندی ملایم
     */

    /** جلوگیری از برعکس شدن ارقام در محیط RTL (مثلاً داخل option) */
    function ltrIsolate(str) {
      const s = String(str || '');
      if (!s) return '';
      // LRI ... PDI — ایزوله قوی چپ‌به‌راست
      return '\u2066' + s + '\u2069';
    }

    function formatBankNumber(raw, typeHint) {
      let s = toEnglishDigits(String(raw || '')).trim().toUpperCase();
      if (!s) return '';
      // شبا
      const isSheba = typeHint === 'sheba' || /^IR/i.test(s) || (digitsOnlyEn(s).length === 24 && !s.includes('-') && s.length <= 26);
      if (isSheba || /^IR/.test(s)) {
        let d = digitsOnlyEn(s).slice(0, 24);
        if (!d) return 'IR';
        // IR + groups of 4
        let out = 'IR';
        for (let i = 0; i < d.length; i++) {
          if (i > 0 && i % 4 === 0) out += '-';
          out += d[i];
        }
        return out;
      }
      // کارت یا حساب عددی
      let d = digitsOnlyEn(s);
      const isCard = typeHint === 'card' || (!typeHint && d.length >= 13 && d.length <= 19) || typeHint !== 'account';
      if (typeHint === 'account') {
        // حساب بانکی: گروه‌های ۴ تایی از راست برای خوانایی، اما ذخیره LTR از چپ
        // برای جلوگیری از برعکس شدن، همان چپ‌به‌راست با خط‌تیره هر ۴ رقم
        d = d.slice(0, 20);
        const parts = [];
        for (let i = 0; i < d.length; i += 4) parts.push(d.slice(i, i + 4));
        return parts.join('-');
      }
      // پیش‌فرض کارت
      d = d.slice(0, 19);
      const parts = [];
      for (let i = 0; i < d.length; i += 4) parts.push(d.slice(i, i + 4));
      return parts.join('-');
    }
    function onBankNumberInput(e) {
      const input = e?.target || document.getElementById('ba-number');
      if (!input) return;
      const typeEl = document.getElementById('ba-type');
      const type = typeEl?.value || 'card';
      const start = input.selectionStart;
      const oldLen = input.value.length;
      const formatted = formatBankNumber(input.value, type);
      input.value = formatted;
      // حفظ تقریبی موقعیت کرسر
      try {
        const newLen = formatted.length;
        const pos = Math.max(0, (start || 0) + (newLen - oldLen));
        input.setSelectionRange(pos, pos);
      } catch (_) {}
    }
    
    function formatPaidFromDisplay(val) {
      if (!val) return '—';
      const s = String(val);
      const clean = s.replace(/[\u2066\u2067\u2068\u2069\u202A\u202B\u202C\u200E\u200F]/g, '');
      if (/^[\d\s\-IR]+$/i.test(toEnglishDigits(clean).replace(/\s/g, ''))) {
        return formatBankNumber(clean);
      }
      return clean.split(' · ').map(part => {
        const en = toEnglishDigits(part).replace(/\s/g, '');
        if (/^\d{8,}$/.test(en.replace(/-/g, '')) || /^IR\d/i.test(en) || /^[\d\-]{9,}$/.test(en)) {
          return formatBankNumber(part);
        }
        return part;
      }).join(' · ');
    }
    /** نسخه HTML امن برای RTL — فقط بخش عددی LTR می‌شود */
    function formatPaidFromHtml(val) {
      if (!val) return '—';
      const clean = String(val).replace(/[\u2066\u2067\u2068\u2069\u202A\u202B\u202C\u200E\u200F]/g, '');
      const parts = clean.split(' · ').map(p => p.trim()).filter(Boolean);
      if (!parts.length) return '—';
      return parts.map(part => {
        const en = toEnglishDigits(part).replace(/\s/g, '');
        const isNum = /^[\d\-]+$/.test(en) || /^IR[\d\-]+$/i.test(en) || (en.replace(/-/g, '').length >= 8 && /^[\dIR\-]+$/i.test(en));
        if (isNum) {
          const formatted = formatBankNumber(part);
          // bdo اجباری برای مرورگرهایی که isolate را ضعیف پشتیبانی می‌کنند
          return '<bdo dir="ltr" class="ba-num-ltr" style="direction:ltr;unicode-bidi:bidi-override;display:inline-block;text-align:left;letter-spacing:0.03em">'
            + escapeHtml(formatted) + '</bdo>';
        }
        return escapeHtml(part);
      }).join(' <span style="margin:0 .15em">·</span> ');
    }

    function displayBankNumberHtml(num) {
      const f = formatBankNumber(num);
      if (!f) return '—';
      return '<span class="ba-num-ltr" dir="ltr" style="unicode-bidi:isolate;direction:ltr;display:inline-block">' + escapeHtml(f) + '</span>';
    }


    // ============================================================
    //  BANK ACCOUNTS (حساب / کارت مبدأ)
    // ============================================================
    const BANK_ACCOUNTS_KEY = 'vam_bank_accounts';
    function getBankAccounts() {
      try {
        const raw = JSON.parse(localStorage.getItem(BANK_ACCOUNTS_KEY) || '[]');
        return Array.isArray(raw) ? raw.filter(a => a && a.id) : [];
      } catch (_) { return []; }
    }
    function setBankAccounts(list) {
      localStorage.setItem(BANK_ACCOUNTS_KEY, JSON.stringify(list || []));
    }
    function openBankAccountsModal() {
      try {
        if (typeof afterSideMenuClose === 'function') {
          afterSideMenuClose(() => {
            resetBankAccountForm();
            renderBankAccountsList();
            document.getElementById('bank-accounts-modal')?.classList.add('open');
          });
        } else {
          try { closeSideMenu(); } catch (_) {}
          resetBankAccountForm();
          renderBankAccountsList();
          document.getElementById('bank-accounts-modal')?.classList.add('open');
        }
      } catch (_) {
        resetBankAccountForm();
        renderBankAccountsList();
        document.getElementById('bank-accounts-modal')?.classList.add('open');
      }
    }
    function closeBankAccountsModal() {
      document.getElementById('bank-accounts-modal')?.classList.remove('open');
    }
    function resetBankAccountForm() {
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
      set('ba-edit-id', '');
      set('ba-title', '');
      set('ba-number', '');
      set('ba-bank', '');
      set('ba-type', 'card');
    }
    function renderBankAccountsList() {
      const host = document.getElementById('bank-accounts-list');
      if (!host) return;
      const list = getBankAccounts();
      if (!list.length) {
        host.innerHTML = '<div class="ba-empty">هنوز حسابی ثبت نشده است.<br>فرم زیر را پر کنید.</div>';
        return;
      }
      const typeLabel = { card: 'کارت', account: 'حساب', sheba: 'شبا' };
      host.innerHTML = list.map(a => `
        <div class="ba-item">
          <div class="ba-item-info">
            <b>${escapeHtml(a.title || 'بدون عنوان')} <span style="font-weight:600;color:#64748b;font-size:11px">(${typeLabel[a.type] || 'کارت'})</span></b>
            <small>${a.number ? displayBankNumberHtml(a.number) : '—'}${a.bank ? ' · ' + escapeHtml(a.bank) : ''}</small>
          </div>
          <div class="ba-item-actions">
            <button type="button" title="ویرایش" data-ba-id="${escapeHtml(String(a.id))}" onclick="editBankAccount(this.getAttribute('data-ba-id'))"><i class="fa-solid fa-pen"></i></button>
            <button type="button" class="ba-del" title="حذف" data-ba-id="${escapeHtml(String(a.id))}" onclick="deleteBankAccount(this.getAttribute('data-ba-id'))"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      `).join('');
    }
    function saveBankAccount() {
      const title = String(document.getElementById('ba-title')?.value || '').trim();
      const type = document.getElementById('ba-type')?.value || 'card';
      const numberRaw = String(document.getElementById('ba-number')?.value || '').trim();
      const number = formatBankNumber(numberRaw, type);
      const bank = String(document.getElementById('ba-bank')?.value || '').trim();
      const editId = String(document.getElementById('ba-edit-id')?.value || '').trim();
      if (!title && !number) {
        showToast('عنوان یا شماره حساب را وارد کنید.', 'error');
        return;
      }
      // اعمال فرمت روی اینپوت
      const numInput = document.getElementById('ba-number');
      if (numInput) numInput.value = number;
      const list = getBankAccounts();
      if (editId) {
        const idx = list.findIndex(a => String(a.id) === String(editId));
        if (idx > -1) {
          list[idx] = { ...list[idx], title: title || list[idx].title || 'حساب', number, bank, type };
          setBankAccounts(list);
          resetBankAccountForm();
          renderBankAccountsList();
          showToast('حساب ویرایش شد.', 'success');
          return;
        }
        // اگر id پیدا نشد، به‌عنوان جدید ذخیره کن
        console.warn('edit id not found, creating new', editId);
      }
      list.push({
        id: 'ba_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        title: title || 'حساب',
        number,
        bank,
        type,
        createdAt: new Date().toISOString()
      });
      setBankAccounts(list);
      resetBankAccountForm();
      renderBankAccountsList();
      showToast('حساب ذخیره شد.', 'success');
    }
    function editBankAccount(id) {
      const a = getBankAccounts().find(x => String(x.id) === String(id));
      if (!a) {
        showToast('حساب برای ویرایش پیدا نشد.', 'error');
        return;
      }
      const type = a.type || 'card';
      document.getElementById('ba-edit-id').value = String(a.id);
      document.getElementById('ba-title').value = a.title || '';
      document.getElementById('ba-type').value = type;
      document.getElementById('ba-number').value = formatBankNumber(a.number || '', type);
      document.getElementById('ba-bank').value = a.bank || '';
      // اسکرول به فرم و فوکوس
      try {
        document.querySelector('.bank-account-form')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (_) {}
      setTimeout(() => document.getElementById('ba-title')?.focus(), 50);
    }
    async function deleteBankAccount(id) {
      const ok = await showConfirmGlass('این حساب حذف شود؟', { title: 'حذف حساب', okText: 'حذف', cancelText: 'انصراف' });
      if (!ok) return;
      setBankAccounts(getBankAccounts().filter(a => String(a.id) !== String(id)));
      renderBankAccountsList();
      showToast('حساب حذف شد.', 'info');
    }


    // ============================================================
    //  PAYMENT RECEIPTS ARCHIVE (آرشیو رسیدهای پرداخت)
    // ============================================================
    const PAYMENT_RECEIPTS_KEY = 'vam_payment_receipts';
    function getPaymentReceiptsStore() {
      try {
        const raw = JSON.parse(localStorage.getItem(PAYMENT_RECEIPTS_KEY) || '[]');
        return Array.isArray(raw) ? raw : [];
      } catch (_) { return []; }
    }
    function setPaymentReceiptsStore(list) {
      try {
        localStorage.setItem(PAYMENT_RECEIPTS_KEY, JSON.stringify(list || []));
      } catch (e) {
        console.warn('receipts store failed', e);
      }
    }
    function buildReceiptRecord(loan, inst, receiptNo) {
      const no = receiptNo || inst?.receiptNo || ('R-' + Date.now().toString().slice(-8));
      return {
        id: no + '_' + String(loan?.id ?? '') + '_' + String(inst?.number ?? ''),
        receiptNo: no,
        loanId: loan?.id != null ? String(loan.id) : '',
        loanName: String(loan?.name || ''),
        party: String(loan?.party || ''),
        instNumber: Number(inst?.number) || 0,
        amount: Number(inst?.amount) || 0,
        dueDate: inst?.date || '',
        paidAt: inst?.paidAt || new Date().toISOString(),
        paidFrom: inst?.paidFrom || null,
        createdAt: new Date().toISOString()
      };
    }
    function savePaymentReceiptRecord(loan, inst, receiptNo) {
      if (!loan || !inst) return null;
      const rec = buildReceiptRecord(loan, inst, receiptNo);
      inst.receiptNo = rec.receiptNo;
      const list = getPaymentReceiptsStore();
      // جلوگیری از تکراری بودن همان قسط+رسید
      const filtered = list.filter(r =>
        !(String(r.loanId) === String(rec.loanId) && Number(r.instNumber) === Number(rec.instNumber))
      );
      filtered.unshift(rec);
      // سقف معقول برای حجم localStorage
      if (filtered.length > 2000) filtered.length = 2000;
      setPaymentReceiptsStore(filtered);
      return rec;
    }
    /** ساخت/تکمیل آرشیو از اقساط پرداخت‌شده فعلی */
    function rebuildPaymentReceiptsFromLoans() {
      const existing = getPaymentReceiptsStore();
      const byKey = new Map();
      existing.forEach(r => {
        const k = String(r.loanId) + '#' + String(r.instNumber);
        byKey.set(k, r);
      });
      (loans || []).forEach(loan => {
        (loan.installments || []).forEach(inst => {
          if (!inst.paid) return;
          const k = String(loan.id) + '#' + String(inst.number);
          if (byKey.has(k)) {
            // به‌روزرسانی فیلدهای جدید اگر خالی بودند
            const old = byKey.get(k);
            if (!old.paidFrom && inst.paidFrom) old.paidFrom = inst.paidFrom;
            if (!old.receiptNo && inst.receiptNo) old.receiptNo = inst.receiptNo;
            if (inst.receiptNo) old.receiptNo = inst.receiptNo;
            return;
          }
          let no = inst.receiptNo;
          if (!no) {
            no = 'R-' + String(loan.id).slice(-4) + String(inst.number).padStart(3, '0') + String(Date.now()).slice(-4);
            inst.receiptNo = no;
          }
          byKey.set(k, buildReceiptRecord(loan, inst, no));
        });
      });
      const merged = Array.from(byKey.values()).sort((a, b) => {
        const ta = new Date(a.paidAt || a.createdAt || 0).getTime();
        const tb = new Date(b.paidAt || b.createdAt || 0).getTime();
        return tb - ta;
      });
      setPaymentReceiptsStore(merged);
      try { persist(); } catch (_) {}
      renderPaymentReceiptsList();
      showToast(`آرشیو رسیدها همگام شد (${toPersianDigits(merged.length)} مورد).`, 'success');
    }
    function fillReceiptsLoanFilter() {
      const sel = document.getElementById('receipts-loan-filter');
      if (!sel) return;
      const cur = sel.value;
      const names = new Map();
      getPaymentReceiptsStore().forEach(r => {
        if (r.loanId) names.set(String(r.loanId), r.loanName || ('وام ' + r.loanId));
      });
      (loans || []).forEach(l => {
        if (!names.has(String(l.id))) names.set(String(l.id), l.name || String(l.id));
      });
      sel.innerHTML = '<option value="">همه وام‌ها</option>';
      [...names.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'fa')).forEach(([id, name]) => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = name;
        sel.appendChild(opt);
      });
      if (cur && [...names.keys()].includes(cur)) sel.value = cur;
    }
    function renderPaymentReceiptsList() {
      const host = document.getElementById('payment-receipts-list');
      if (!host) return;
      fillReceiptsLoanFilter();
      const q = toEnglishDigits((document.getElementById('receipts-search')?.value || '').trim()).toLowerCase();
      const loanFilter = document.getElementById('receipts-loan-filter')?.value || '';
      let list = getPaymentReceiptsStore();
      if (loanFilter) list = list.filter(r => String(r.loanId) === String(loanFilter));
      if (q) {
        list = list.filter(r => {
          const hay = [r.receiptNo, r.loanName, r.party, r.paidFrom, r.instNumber, r.amount, r.dueDate]
            .map(x => toEnglishDigits(String(x || '')).toLowerCase()).join(' ');
          return hay.includes(q);
        });
      }
      if (!list.length) {
        host.innerHTML = '<div class="pr-empty">رسیدی ثبت نشده است.<br>پس از پرداخت قسط، رسید اینجا ذخیره می‌شود.<br>یا روی «همگام‌سازی» بزنید تا از اقساط پرداخت‌شده ساخته شود.</div>';
        return;
      }
      host.innerHTML = list.map(r => {
        const paidStr = r.paidAt
          ? toPersianDigits(new Date(r.paidAt).toLocaleDateString('fa-IR'))
          : '—';
        const dueStr = r.dueDate ? formatDateToPersian(r.dueDate) : '—';
        const safeId = String(r.id).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return `<div class="pr-item">
          <div class="pr-item-main">
            <b>${escapeHtml(r.loanName || 'وام')} · قسط ${toPersianDigits(r.instNumber)}</b>
            <small>
              شماره رسید: ${escapeHtml(r.receiptNo || '—')}
              · پرداخت: ${paidStr}
              · سررسید: ${dueStr}
              ${r.paidFrom ? '<br>مبدأ: ' + formatPaidFromHtml(r.paidFrom) : ''}
            </small>
          </div>
          <div class="pr-item-amount">${formatMoney(r.amount)}</div>
          <div class="pr-item-actions">
            <button type="button" class="pr-btn-view" onclick="viewStoredPaymentReceipt('${safeId}')"><i class="fa-solid fa-eye me-1"></i>مشاهده</button>
            <button type="button" class="pr-btn-print" onclick="printStoredPaymentReceipt('${safeId}')"><i class="fa-solid fa-print me-1"></i>چاپ</button>
          </div>
        </div>`;
      }).join('');
    }
    function findStoredReceipt(id) {
      return getPaymentReceiptsStore().find(r => String(r.id) === String(id)) || null;
    }
    function receiptRecordToLoanInst(rec) {
      const loan = {
        id: rec.loanId,
        name: rec.loanName,
        party: rec.party
      };
      const inst = {
        number: rec.instNumber,
        amount: rec.amount,
        date: rec.dueDate,
        paid: true,
        paidAt: rec.paidAt,
        paidFrom: rec.paidFrom,
        receiptNo: rec.receiptNo
      };
      // تلاش برای داده به‌روز از وام زنده
      const live = (loans || []).find(l => String(l.id) === String(rec.loanId));
      if (live) {
        loan.name = live.name || loan.name;
        loan.party = live.party || loan.party;
        const liveInst = (live.installments || []).find(i => Number(i.number) === Number(rec.instNumber));
        if (liveInst) {
          inst.amount = liveInst.amount ?? inst.amount;
          inst.date = liveInst.date || inst.date;
          inst.paidAt = liveInst.paidAt || inst.paidAt;
          inst.paidFrom = liveInst.paidFrom || inst.paidFrom;
          inst.receiptNo = liveInst.receiptNo || inst.receiptNo;
        }
      }
      return { loan, inst, receiptNo: rec.receiptNo };
    }
    function viewStoredPaymentReceipt(id) {
      const rec = findStoredReceipt(id);
      if (!rec) return showToast('رسید یافت نشد.', 'error');
      const { loan, inst, receiptNo } = receiptRecordToLoanInst(rec);
      openPaymentReceipt(loan, inst, receiptNo, { editable: true, receiptStoreId: rec.id });
    }
    function paidAtToInputValue(paidAt) {
      try {
        const d = paidAt ? new Date(paidAt) : new Date();
        if (Number.isNaN(d.getTime())) return formatDateToPersian(todayISO());
        // نمایش شمسی مثل فرم ثبت وام
        return formatDateToPersian(toLocalISO(d));
      } catch (_) {
        try { return formatDateToPersian(todayISO()); } catch (e) { return ''; }
      }
    }
    function inputDateToPaidAtIso(val) {
      const raw = String(val || '').trim();
      if (!raw) return new Date().toISOString();
      try {
        // ورودی شمسی → YYYY-MM-DD جلالی
        const j = (typeof parseUserDateInput === 'function') ? parseUserDateInput(raw) : null;
        if (j && typeof gregorianDateFromJalali === 'function') {
          const g = gregorianDateFromJalali(j);
          if (g && !Number.isNaN(g.getTime())) {
            // ظهر محلی برای جلوگیری از جابه‌جایی روز
            const local = new Date(g.getUTCFullYear(), g.getUTCMonth(), g.getUTCDate(), 12, 0, 0);
            return local.toISOString();
          }
        }
      } catch (_) {}
      const en = toEnglishDigits(raw);
      if (/^\d{4}-\d{2}-\d{2}$/.test(en)) {
        const d = new Date(en + 'T12:00:00');
        if (!Number.isNaN(d.getTime())) return d.toISOString();
      }
      return new Date().toISOString();
    }
    function resolveRcptPaidFromValue() {
      const sel = document.getElementById('rcpt-edit-paidfrom-select');
      const input = document.getElementById('rcpt-edit-paidfrom');
      const manual = String(input?.value || '').trim();
      if (manual) return formatPaidFromDisplay(manual) === '—' ? manual : formatPaidFromDisplay(manual);
      const id = sel?.value;
      if (!id) return '';
      const acc = getBankAccounts().find(a => String(a.id) === String(id));
      if (!acc) return '';
      const num = acc.number ? formatBankNumber(acc.number, acc.type) : '';
      return [acc.title, acc.bank, num].filter(Boolean).join(' · ');
    }
    function fillRcptPaidFromSelect(currentPaidFrom) {
      const sel = document.getElementById('rcpt-edit-paidfrom-select');
      if (!sel) return;
      const accounts = getBankAccounts();
      sel.innerHTML = '<option value="">انتخاب حساب ثبت‌شده</option>';
      let matched = '';
      const cur = String(currentPaidFrom || '');
      accounts.forEach(a => {
        const num = a.number ? formatBankNumber(a.number, a.type) : '';
        const label = (a.title || 'حساب') + (a.bank ? ' · ' + a.bank : '') + (num ? ' · ' + ltrIsolate(num) : '');
        const full = [a.title, a.bank, num].filter(Boolean).join(' · ');
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = label;
        if (cur && (cur.includes(num) || cur === full || cur.includes(a.title || ''))) {
          matched = a.id;
        }
        sel.appendChild(opt);
      });
      if (matched) sel.value = matched;
      sel.addEventListener('change', () => {
        const input = document.getElementById('rcpt-edit-paidfrom');
        if (!input) return;
        if (!sel.value) return;
        const acc = accounts.find(a => String(a.id) === String(sel.value));
        if (!acc) return;
        const num = acc.number ? formatBankNumber(acc.number, acc.type) : '';
        input.value = [acc.title, acc.bank, num].filter(Boolean).join(' · ');
      });
    }
    function bindRcptJalaliDatePicker() {
      const input = document.getElementById('rcpt-edit-paidat');
      const btn = document.getElementById('rcpt-edit-paidat-btn');
      if (!input || typeof jdpOpen !== 'function') return;
      const open = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        jdpOpen(input);
      };
      if (btn) {
        btn.onclick = open;
      }
      input.addEventListener('focus', () => {
        setTimeout(() => {
          if (document.activeElement === input && !jdpState.open) jdpOpen(input);
        }, 50);
      });
    }
    /** تأیید ویرایش فیلدهای رسید از مودال مشاهده */
    function confirmReceiptEdits() {
      const meta = window.__lastPaymentReceipt;
      if (!meta || !meta.loan || !meta.inst) return;
      const partyEl = document.getElementById('rcpt-edit-party');
      const dateEl = document.getElementById('rcpt-edit-paidat');
      const party = String(partyEl?.value || '').trim();
      const paidAtIso = inputDateToPaidAtIso(dateEl?.value);
      const paidFrom = resolveRcptPaidFromValue();

      meta.loan.party = party;
      meta.inst.paidAt = paidAtIso;
      meta.inst.paidFrom = paidFrom || null;

      // به‌روزرسانی آرشیو رسید
      const storeId = meta.receiptStoreId;
      if (storeId) {
        const list = getPaymentReceiptsStore();
        const idx = list.findIndex(r => String(r.id) === String(storeId));
        if (idx > -1) {
          list[idx] = {
            ...list[idx],
            party: party,
            paidAt: paidAtIso,
            paidFrom: paidFrom || null,
            loanName: meta.loan.name || list[idx].loanName
          };
          setPaymentReceiptsStore(list);
        }
      } else if (meta.no) {
        // پیدا کردن با شماره رسید + قسط
        const list = getPaymentReceiptsStore();
        const idx = list.findIndex(r =>
          String(r.receiptNo) === String(meta.no) &&
          String(r.loanId) === String(meta.loan.id) &&
          Number(r.instNumber) === Number(meta.inst.number)
        );
        if (idx > -1) {
          list[idx].party = party;
          list[idx].paidAt = paidAtIso;
          list[idx].paidFrom = paidFrom || null;
          setPaymentReceiptsStore(list);
        }
      }

      // همگام‌سازی با قسط زنده در loans
      try {
        const live = (loans || []).find(l => String(l.id) === String(meta.loan.id));
        if (live) {
          // طرف حساب وام را عوض نکنیم مگر کاربر بخواهد — فقط paidFrom/paidAt قسط
          const liveInst = (live.installments || []).find(i => Number(i.number) === Number(meta.inst.number));
          if (liveInst) {
            liveInst.paidAt = paidAtIso;
            liveInst.paidFrom = paidFrom || null;
            try { persist(); } catch (_) {}
          }
        }
      } catch (_) {}

      // رفرش نمایش مودال با مقادیر جدید (قابل ویرایش)
      openPaymentReceipt(meta.loan, meta.inst, meta.no, {
        editable: true,
        receiptStoreId: storeId || meta.receiptStoreId
      });
      try { renderPaymentReceiptsList(); } catch (_) {}
      showToast('تغییرات رسید ذخیره شد.', 'success');
    }
    function printStoredPaymentReceipt(id) {
      const rec = findStoredReceipt(id);
      if (!rec) return showToast('رسید یافت نشد.', 'error');
      const { loan, inst, receiptNo } = receiptRecordToLoanInst(rec);
      printPaymentReceipt(loan, inst, receiptNo);
    }


    // ============================================================
    //  DIGIT HELPERS (function decl — hoisted, safe for early use)
    // ============================================================
    function toEnglishDigits(str) {
      if (str === undefined || str === null) return '';
      const map = {
        '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9',
        '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'
      };
      return String(str).replace(/[۰-۹٠-٩]/g, d => map[d] || d);
    }

    function toPersianDigits(num) {
      if (num === undefined || num === null) return '۰';
      const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
      return num.toString().replace(/\d/g, d => persianDigits[d]);
    }

    // ============================================================
    //  STATE
    // ============================================================
    function safeParseJSON(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const data = JSON.parse(raw);
        return data ?? fallback;
      } catch (e) {
        console.warn('localStorage parse failed for', key, e);
        return fallback;
      }
    }
    let loans = safeParseJSON('loans', []);
    if (!Array.isArray(loans)) loans = [];
    // نرمال‌سازی ساختاری وام‌ها (جلوگیری از داده خراب + هم‌تراز تعداد اقساط)
    loans = loans.map(l => {
      if (!l || typeof l !== 'object') return null;
      const id = l.id != null ? l.id : Date.now();
      let installments = Array.isArray(l.installments) ? l.installments.map((inst, idx) => ({
        number: Number(inst.number) || (idx + 1),
        date: (() => {
          const raw = inst.date || '';
          const n = normalizeJalaliDateString(toEnglishDigits(String(raw)).replace(/[\/\.\s]/g, '-'));
          return n || String(raw);
        })(),
        amount: (() => {
          const raw = Number(inst.amount);
          return Number.isFinite(raw) ? raw : (Number(l.installmentAmount) || 0);
        })(),
        paid: !!inst.paid,
        paidAt: inst.paidAt ? String(inst.paidAt) : null,
        paidFrom: inst.paidFrom ? String(inst.paidFrom) : (inst.sourceAccount ? String(inst.sourceAccount) : null),
        receiptNo: inst.receiptNo ? String(inst.receiptNo) : null
      })) : [];
      // شماره‌گذاری یکنواخت ۱..n
      installments = installments
        .sort((a, b) => (a.number || 0) - (b.number || 0))
        .map((inst, idx) => ({
          ...inst,
          number: idx + 1,
          paidAt: inst.paid ? (inst.paidAt || null) : null,
          paidFrom: inst.paid ? (inst.paidFrom || null) : null,
          receiptNo: inst.paid ? (inst.receiptNo || null) : null
        }));
      const countFromArr = installments.length;
      let installmentCount = Number(l.installmentCount) || 0;
      // هم‌تراز: اگر آرایه اقساط موجود است، منبع حقیقت همان است
      if (countFromArr > 0) installmentCount = countFromArr;
      else if (installmentCount < 0) installmentCount = 0;
      const startRaw = l.startDate || '';
      const startNorm = normalizeJalaliDateString(toEnglishDigits(String(startRaw)).replace(/[\/\.\s]/g, '-')) || String(startRaw || '');
      return {
        id,
        name: String(l.name || 'بدون نام'),
        party: String(l.party || l.side || l.counterparty || ''),
        amount: Number(l.amount) || 0,
        installmentAmount: Number(l.installmentAmount) || 0,
        installmentCount,
        startDate: startNorm,
        icon: typeof l.icon === 'string' ? l.icon : '',
        installments
      };
    }).filter(Boolean);
    let currentLoan = null;
    let chartProgress = null;
    let loanOrder = safeParseJSON('loanOrder', []);
    if (!Array.isArray(loanOrder)) loanOrder = [];
    // فقط شناسه‌های موجود در loans را نگه دار
    (function normalizeLoanOrder() {
      const idSet = new Set(loans.map(l => String(l.id)));
      loanOrder = loanOrder.filter(id => idSet.has(String(id)));
      loans.forEach(l => {
        if (!loanOrder.some(id => String(id) === String(l.id))) loanOrder.push(l.id);
      });
    })();
    let archivedLoans = safeParseJSON('archivedLoans', []);
    if (!Array.isArray(archivedLoans)) archivedLoans = [];
    // مهاجرت: وام‌های تسویه‌شده‌ای که هنوز در لیست فعال‌اند را بایگانی کن (اختیاری دستی)
    function persistArchived() {
      try { localStorage.setItem('archivedLoans', JSON.stringify(archivedLoans)); } catch (e) {}
    }
    function isLoanSettled(loan) {
      if (!loan) return false;
      const insts = loan.installments || [];
      if (!insts.length) return false;
      return insts.every(i => i.paid);
    }
    function archiveLoanById(loanId, silent) {
      const idx = (loans || []).findIndex(l => String(l.id) === String(loanId));
      if (idx < 0) return false;
      const loan = loans[idx];
      if (!isLoanSettled(loan)) {
        if (!silent) showToast('فقط وام کاملاً تسویه‌شده قابل بایگانی است.', 'warning');
        return false;
      }
      loans.splice(idx, 1);
      loanOrder = (loanOrder || []).filter(id => String(id) !== String(loanId));
      loan.archivedAt = new Date().toISOString();
      archivedLoans.unshift(loan);
      persist();
      persistArchived();
      if (!silent) showToast('وام «' + (loan.name || '') + '» به بایگانی منتقل شد.', 'success');
      try { renderArchivedLoansList(); } catch (_) {}
      return true;
    }
    function restoreArchivedLoan(loanId) {
      const idx = (archivedLoans || []).findIndex(l => String(l.id) === String(loanId));
      if (idx < 0) return;
      const loan = archivedLoans.splice(idx, 1)[0];
      delete loan.archivedAt;
      loans.push(loan);
      if (!(loanOrder || []).some(id => String(id) === String(loan.id))) loanOrder.push(loan.id);
      persist();
      persistArchived();
      showToast('وام از بایگانی بازگردانده شد.', 'success');
      renderArchivedLoansList();
      try { refreshAllViews('restore-archive'); } catch (_) {}
    }
    function renderArchivedLoansList() {
      const html = (!archivedLoans || !archivedLoans.length)
        ? 'هنوز وامی بایگانی نشده است.'
        : archivedLoans.map(l => {
            return `<div class="archived-loan-row">
          <div><b>${escapeHtml(l.name || 'بدون نام')}</b><br><small>${escapeHtml(l.party || '')} · ${formatMoney(l.amount || 0)}</small></div>
          <button type="button" class="btn-glass text-xs" onclick="restoreArchivedLoan('${String(l.id).replace(/'/g, '')}')">بازگردانی</button>
        </div>`;
          }).join('');
      ['archived-loans-list', 'archived-loans-list-main'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
      });
    }
    window.restoreArchivedLoan = restoreArchivedLoan;
    window.archiveLoanById = archiveLoanById;

    let editingLoanId = null;

    // ============================================================
    //  CACHE
    // ============================================================
    let cachedLoanCards = {};
    let debounceTimer = null;
    let draggedElement = null;
    let dragOverElement = null;

    // ============================================================
    //  UTILS
    // ============================================================
    const numberWithCommas = x => x?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") ?? "0";

    /** جلوگیری از XSS در innerHTML */
    function escapeHtml(str) {
      if (str === undefined || str === null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    /** نام امن برای فایل (ویندوز/اندروید/مک) */
    function safeFilename(name, fallback = 'loan') {
      const s = String(name || '')
        .replace(/[\/\\:\*\?"<>\|\x00-\x1f]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^\.+|\.+$/g, '')
        .slice(0, 80);
      return s || fallback;
    }

    /** تبدیل ارقام فارسی/عربی به انگلیسی */
    /** فرمت مبلغ با ارقام فارسی و جداکننده هزارگان */
    const formatNumber = (input) => {
      const eng = toEnglishDigits(input.value || '').replace(/\D/g, '');
      input.value = eng ? toPersianDigits(numberWithCommas(eng)) : '';
    };

    /** فقط ارقام (برای تعداد اقساط) با نمایش فارسی */
    const formatCountInput = (input) => {
      const eng = toEnglishDigits(input.value || '').replace(/\D/g, '');
      input.value = eng ? toPersianDigits(eng) : '';
    };

    /** نرخ سود: ارقام فارسی + یک نقطه اعشار */
    const formatRateInput = (input) => {
      let s = toEnglishDigits(input.value || '').replace(/[^\d.]/g, '');
      const parts = s.split('.');
      if (parts.length > 2) s = parts[0] + '.' + parts.slice(1).join('');
      if (s.includes('.')) {
        const [a, b = ''] = s.split('.');
        s = a + '.' + b.slice(0, 4);
      }
      if (!s) { input.value = ''; return; }
      if (s.endsWith('.')) {
        input.value = toPersianDigits(s.slice(0, -1)) + '.';
      } else if (s.includes('.')) {
        const [a, b] = s.split('.');
        input.value = toPersianDigits(a) + '.' + toPersianDigits(b);
      } else {
        input.value = toPersianDigits(s);
      }
    };

    const parseNumber = (str) => {
      if (!str) return 0;
      const eng = toEnglishDigits(String(str)).replace(/,/g, '').replace(/[^\d.]/g, '');
      return parseFloat(eng) || 0;
    };

    /**
     * پارس تاریخ ورودی کاربر:
     * - ۱۴۰۵/۰۱/۰۱ یا 1405-01-01 → YYYY-MM-DD
     * - ۰۱-۰۱-۱۴۰۵ (روز-ماه-سال) → ۱۴۰۵-۰۱-۰۱
     * خروجی همیشه انگلیسی YYYY-MM-DD برای ذخیره
     */
    function parseUserDateInput(raw) {
      const s = toEnglishDigits(String(raw || '').trim()).replace(/[\/\.\s]/g, '-');
      if (!s) return '';
      const parts = s.split('-').filter(Boolean);
      if (parts.length !== 3) return '';
      let y, m, d;
      if (parts[0].length === 4) {
        // YYYY-MM-DD یا YYYY/MM/DD
        y = Number(parts[0]); m = Number(parts[1]); d = Number(parts[2]);
      } else if (parts[2].length === 4) {
        // DD-MM-YYYY (مثل ۰۱-۰۱-۱۴۰۵ → ۱۴۰۵/۰۱/۰۱)
        d = Number(parts[0]); m = Number(parts[1]); y = Number(parts[2]);
      } else {
        return '';
      }
      if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return '';
      const normalized = normalizeJalaliDateString(`${y}-${m}-${d}`);
      if (!normalized) return '';
      // از ورود تاریخ‌های غیرممکن مثل ۱۴۰۵/۱۲/۳۰ یا ۱۴۰۵/۰۷/۳۱ جلوگیری کن.
      // این بررسی عمداً اینجا انجام می‌شود تا normalizeJalaliDateString
      // وارد چرخه‌ی وابستگی با jalaliDaysInMonth نشود.
      const [ny, nm, nd] = normalized.split('-').map(Number);
      if (nm <= 6 && nd > 31) return '';
      if (nm >= 7 && nm <= 11 && nd > 30) return '';
      if (nm === 12 && nd > 30) return '';
      if (Number.isNaN(gregorianDateFromJalali(normalized).getTime())) return '';
      return normalized;
    }

    /** تاریخ تسویه وام: اولویت با آخرین قسط، در غیر این صورت محاسبه از شروع */
    function getLoanSettlementDate(loan) {
      if (!loan) return '';
      const insts = loan.installments || [];
      if (insts.length) {
        const last = insts[insts.length - 1];
        if (last && last.date) {
          const n = normalizeJalaliDateString(toEnglishDigits(String(last.date)).replace(/[\/\.\s]/g, '-'));
          if (n) return n;
        }
      }
      const startNorm = normalizeJalaliDateString(
        toEnglishDigits(String(loan.startDate || '')).replace(/[\/\.\s]/g, '-')
      );
      if (!startNorm) return '';
      const start = parseLocalDate(startNorm);
      if (isNaN(start.getTime())) return '';
      const endDate = addMonths(start, Math.max((loan.installmentCount || 1) - 1, 0));
      return toLocalISO(endDate) || '';
    }
    // ============================================================
    //  STORAGE (versioned localStorage + IndexedDB)
    // ============================================================
    const IDB_NAME = 'EasyVAM_DB';
    const IDB_STORE = 'kv';
    const DATA_SCHEMA_VERSION = 5;
    const BACKUP_VERSION = 5;
    const APP_VERSION = 'v9.0.13';
    /** نام نمایشی PWA / تب — نسخه از APP_VERSION می‌آید (هم‌زمان با manifest.json به‌روز شود) */
    const APP_DISPLAY_NAME = `مدیریت وام و اقساط ورژن ${APP_VERSION}`;
    const APP_SHORT_NAME = `مدیریت وام ${APP_VERSION}`;
    function applyAppBranding() {
      try {
        document.title = APP_DISPLAY_NAME;
        const setMeta = (name, content) => {
          let el = document.querySelector(`meta[name="${name}"]`);
          if (!el) {
            el = document.createElement('meta');
            el.setAttribute('name', name);
            document.head.appendChild(el);
          }
          el.setAttribute('content', content);
        };
        setMeta('application-name', APP_DISPLAY_NAME);
        setMeta('apple-mobile-web-app-title', APP_SHORT_NAME);
        setMeta('description', `سیستم مدیریت وام و پرداخت اقساط - نسخه حرفه‌ای ${APP_VERSION}`);
      } catch (_) {}
    }
    let idbReady = null;
    let dataRevision = Number(safeParseJSON('vam_data_meta', {}).revision) || 0;
    let dataUpdatedAt = Number(safeParseJSON('vam_data_meta', {}).updatedAt) || 0;

    function openIDB() {
      if (idbReady) return idbReady;
      idbReady = new Promise((resolve) => {
        if (!window.indexedDB) { resolve(null); return; }
        const req = indexedDB.open(IDB_NAME, 2);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });
      return idbReady;
    }

    async function idbSet(key, value) {
      try {
        const db = await openIDB();
        if (!db) return false;
        return await new Promise(resolve => {
          const tx = db.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).put(value, key);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        });
      } catch (_) { return false; }
    }
    async function idbGet(key) {
      try {
        const db = await openIDB();
        if (!db) return null;
        return await new Promise(resolve => {
          const tx = db.transaction(IDB_STORE, 'readonly');
          const req = tx.objectStore(IDB_STORE).get(key);
          req.onsuccess = () => resolve(req.result ?? null);
          req.onerror = () => resolve(null);
        });
      } catch (_) { return null; }
    }

    let persistTimer = null;
    let persistInFlight = false;
    let persistQueued = false;
    let lastPersistedSnapshot = null;
    const operationHistory = JSON.parse(localStorage.getItem('vam_operation_history') || '[]');
    function buildStorageSnapshot() {
      return { schemaVersion: DATA_SCHEMA_VERSION, revision: dataRevision, updatedAt: dataUpdatedAt, loans, loanOrder };
    }
    function persistToIDB() {
      if (persistInFlight) { persistQueued = true; return; }
      persistInFlight = true;
      const snapshot = buildStorageSnapshot();
      openIDB().then(db => {
        if (!db) return false;
        return new Promise(resolve => {
          try {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            const store = tx.objectStore(IDB_STORE);
            store.put(snapshot, 'appSnapshot');
            store.put(loans, 'loans');
            store.put(loanOrder, 'loanOrder');
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
            tx.onabort = () => resolve(false);
          } catch (_) { resolve(false); }
        });
      }).catch(() => false).finally(() => {
        persistInFlight = false;
        if (persistQueued) { persistQueued = false; persistToIDB(); }
      });
    }
    const persist = () => {
      try {
        lastPersistedSnapshot = { loans: JSON.parse(JSON.stringify(loans)), loanOrder: JSON.parse(JSON.stringify(loanOrder)) };
        dataRevision = Math.max(dataRevision + 1, 1);
        dataUpdatedAt = Date.now();
        const meta = { schemaVersion: DATA_SCHEMA_VERSION, revision: dataRevision, updatedAt: dataUpdatedAt };
        localStorage.setItem('loans', JSON.stringify(loans));
        localStorage.setItem('loanOrder', JSON.stringify(loanOrder));
        localStorage.setItem('vam_data_meta', JSON.stringify(meta));
        clearTimeout(persistTimer);
        persistTimer = setTimeout(persistToIDB, 80);
      } catch (e) {
        console.error('persist failed', e);
        try { showToast('ذخیره داده ناموفق بود. لطفاً پشتیبان بگیرید.', 'error'); } catch (_) {}
      }
    };
    function flushPersistentStorage() {
      clearTimeout(persistTimer);
      persistToIDB();
    }
    window.addEventListener('pagehide', flushPersistentStorage);
    window.addEventListener('beforeunload', flushPersistentStorage);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushPersistentStorage(); });

    async function tryRecoverFromIDB() {
      try {
        const snapshot = await idbGet('appSnapshot');
        if (snapshot && Array.isArray(snapshot.loans) && Number(snapshot.schemaVersion || 1) <= DATA_SCHEMA_VERSION) {
          const localMeta = safeParseJSON('vam_data_meta', {});
          const localUpdated = Number(localMeta.updatedAt) || 0;
          const localRevision = Number(localMeta.revision) || 0;
          const snapshotRevision = Number(snapshot.revision) || 0;
          const snapshotUpdated = Number(snapshot.updatedAt) || 0;
          if (snapshotRevision > localRevision || (snapshotRevision === localRevision && snapshotUpdated > localUpdated)) {
            loans = snapshot.loans;
            if (Array.isArray(snapshot.loanOrder)) loanOrder = snapshot.loanOrder;
            dataRevision = Number(snapshot.revision) || dataRevision;
            dataUpdatedAt = Number(snapshot.updatedAt) || dataUpdatedAt;
            localStorage.setItem('loans', JSON.stringify(loans));
            localStorage.setItem('loanOrder', JSON.stringify(loanOrder));
            localStorage.setItem('vam_data_meta', JSON.stringify({ schemaVersion: DATA_SCHEMA_VERSION, revision: dataRevision, updatedAt: dataUpdatedAt }));
            return true;
          }
        }
        // سازگاری با نسخه‌های قدیمی که snapshot نداشتند.
        const idbLoans = await idbGet('loans');
        const idbOrder = await idbGet('loanOrder');
        if (Array.isArray(idbLoans) && idbLoans.length > 0 && !loans.length) {
          loans = idbLoans;
          if (Array.isArray(idbOrder)) loanOrder = idbOrder;
          dataRevision = Math.max(dataRevision, 1);
          dataUpdatedAt = Date.now();
          localStorage.setItem('loans', JSON.stringify(loans));
          localStorage.setItem('loanOrder', JSON.stringify(loanOrder));
          localStorage.setItem('vam_data_meta', JSON.stringify({ schemaVersion: DATA_SCHEMA_VERSION, revision: dataRevision, updatedAt: dataUpdatedAt }));
          return true;
        }
      } catch (_) {}
      return false;
    }

    function formatDateToPersian(dateString) {
      if (!dateString) return '';
      // YYYY-MM-DD → YYYY/MM/DD با ارقام فارسی (جلوگیری از برعکس‌شدن در RTL)
      const normalized = toEnglishDigits(String(dateString).trim()).replace(/[\/\.\s]/g, '-');
      const parts = normalized.split('-');
      if (parts.length === 3) {
        const [y, m, d] = parts;
        return toPersianDigits(y) + '/' + toPersianDigits(m) + '/' + toPersianDigits(d);
      }
      return toPersianDigits(normalized.replace(/-/g, '/'));
    }

    // تاریخ واقعی پرداخت قسط (ذخیره‌شده به صورت ISO) → تاریخ شمسی قابل نمایش
    function formatPaidAt(inst) {
      if (!inst || !inst.paid || !inst.paidAt) return '—';
      try {
        const d = new Date(inst.paidAt);
        if (!Number.isNaN(d.getTime())) return toPersianDigits(d.toLocaleDateString('fa-IR'));
      } catch (_) {}
      const raw = String(inst.paidAt || '').trim();
      return raw ? formatDateToPersian(raw) : '—';
    }

    function getLastPaymentDate(loan) {
      const paid = (loan?.installments || []).filter(i => i.paid && i.paidAt);
      if (!paid.length) return '—';
      paid.sort((a,b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
      return formatPaidAt(paid[0]);
    }

    // ============================================================
    //  JALALI DATE CORE
    //  همه تاریخ‌های برنامه به صورت YYYY-MM-DD شمسی ذخیره می‌شوند.
    //  برای محاسبات داخلی، تاریخ به Gregorian Date تبدیل و دوباره
    //  به شمسی برگردانده می‌شود. این کار جلوی محاسبه اشتباه سال ۱۴۰۵
    //  به عنوان سال میلادی را می‌گیرد.
    // ============================================================
    // تاریخ روز باید بر اساس تهران محاسبه شود؛ استفاده از UTC باعث می‌شد
    // بعد از نیمه‌شب تهران، تا ساعت ۲۰:۳۰ تاریخ روز قبل نمایش داده شود.
    const jalaliFormatter = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
      timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit'
    });

    function normalizeJalaliDateString(str) {
      if (!str) return '';
      const cleaned = toEnglishDigits(String(str).trim()).replace(/[\/\.\s]/g, '-');
      const parts = cleaned.split('-').map(Number);
      if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return '';
      const [y,m,d] = parts;
      if (y < 1200 || y > 1600 || m < 1 || m > 12 || d < 1 || d > 31) return '';
      return `${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }

    function jalaliPartsFromDate(date) {
      const n = date instanceof Date ? date : new Date(date);
      if (Number.isNaN(n.getTime())) return null;
      const parts = jalaliFormatter.formatToParts(n);
      const out = {};
      parts.forEach(p => { if (p.type === 'year' || p.type === 'month' || p.type === 'day') out[p.type] = Number(p.value); });
      return out.year && out.month && out.day ? out : null;
    }

    function jalaliNumber(parts) {
      return parts.year * 10000 + parts.month * 100 + parts.day;
    }

    function gregorianDateFromJalali(str) {
      const normalized = normalizeJalaliDateString(str);
      if (!normalized) return new Date(NaN);
      const [jy, jm, jd] = normalized.split('-').map(Number);
      const target = jy * 10000 + jm * 100 + jd;
      // سال شمسی موردنظر تقریباً از مارس سال jy+621 شروع می‌شود.
      // بازه را کمی بزرگ‌تر می‌گیریم و با جست‌وجوی دودویی تاریخ دقیق را پیدا می‌کنیم.
      let lo = Date.UTC(jy + 621, 0, 1);
      let hi = Date.UTC(jy + 622, 11, 31);
      while (lo <= hi) {
        const mid = lo + Math.floor((hi - lo) / 2 / 86400000) * 86400000;
        const got = jalaliPartsFromDate(new Date(mid));
        if (!got) break;
        const num = jalaliNumber(got);
        if (num === target) return new Date(mid);
        if (num < target) lo = mid + 86400000;
        else hi = mid - 86400000;
      }
      return new Date(NaN);
    }

    function jalaliDaysInMonth(year, month) {
      if (month <= 6) return 31;
      if (month <= 11) return 30;
      // با بررسی روز ۳۰ و ۲۹، طول اسفند را بدون وابستگی به الگوریتم جداگانه تعیین می‌کنیم.
      return jalaliPartsFromDate(gregorianDateFromJalali(`${year}-12-30`))?.year === year ? 30 : 29;
    }

    function jalaliToDateString(year, month, day) {
      return `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    }

    // Format a Gregorian Date as local Jalali YYYY-MM-DD.
    const toLocalISO = (date) => {
      const p = jalaliPartsFromDate(date);
      if (!p) return '';
      return jalaliToDateString(p.year, p.month, p.day);
    };

    // Parse a stored Jalali YYYY-MM-DD into a Gregorian Date object for arithmetic.
    const parseLocalDate = (str) => gregorianDateFromJalali(str);

    // Jalali today (YYYY-MM-DD)
    const todayISO = () => {
      // تاریخ امروز باید شمسی باشد؛ تاریخ‌های اقساط در دیتابیس به‌صورت Jalali YYYY-MM-DD ذخیره می‌شوند.
      // استفاده از getFullYear/getMonth/getDate در اینجا تاریخ میلادی تولید می‌کرد و
      // باعث می‌شد بعضی اقساطِ آینده به‌اشتباه «معوق» تشخیص داده شوند.
      return toLocalISO(new Date());
    };
    // خروجی‌های رسمی برنامه: تمام تاریخ‌ها فقط شمسی و با ارقام فارسی نمایش داده می‌شوند.
    const reportDateJalali = () => formatDateToPersian(todayISO());
    const reportDateForFilename = () => toPersianDigits(todayISO());

    // Compare two plain Jalali date strings safely.
    const compareDateStrings = (a, b) => String(a || '').localeCompare(String(b || ''));
    const isOverdue = inst => (!inst.paid) && inst.date && compareDateStrings(inst.date, todayISO()) < 0;

    // ============================================================
    //  JALALI DATE PICKER (تقویم شمسی جمع‌وجور)
    // ============================================================
    const JDP_MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
    const JDP_WEEKDAYS = ['ش','ی','د','س','چ','پ','ج']; // شنبه تا جمعه

    let jdpState = {
      open: false,
      view: 'days', // days | months | years
      year: 1404,
      month: 1,
      selected: null, // YYYY-MM-DD
      targetInput: null,
      popup: null
    };

    function jdpEnsurePopup() {
      if (jdpState.popup && document.body.contains(jdpState.popup)) return jdpState.popup;
      const el = document.createElement('div');
      el.className = 'jdp-popup hidden';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', 'تقویم شمسی');
      document.body.appendChild(el);
      jdpState.popup = el;
      return el;
    }

    function jdpClose() {
      if (!jdpState.open) return;
      jdpState.open = false;
      jdpState.view = 'days';
      if (jdpState.popup) jdpState.popup.classList.add('hidden');
      document.removeEventListener('pointerdown', jdpOutsideHandler, true);
      document.removeEventListener('keydown', jdpKeyHandler, true);
    }

    function jdpOutsideHandler(e) {
      const pop = jdpState.popup;
      const btn = document.getElementById('start-date-btn');
      const btnEdit = document.getElementById('edit-start-date-btn');
      const btnRcpt = document.getElementById('rcpt-edit-paidat-btn');
      const btnPay = document.getElementById('pay-paid-date-btn');
      const input = jdpState.targetInput;
      if (!pop) return;
      if (pop.contains(e.target)) return;
      if (btn && btn.contains(e.target)) return;
      if (btnEdit && btnEdit.contains(e.target)) return;
      if (btnRcpt && btnRcpt.contains(e.target)) return;
      if (btnPay && btnPay.contains(e.target)) return;
      if (input && input.contains(e.target)) return;
      jdpClose();
    }

    function jdpKeyHandler(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        jdpClose();
      }
    }

    function jdpPosition() {
      const pop = jdpState.popup;
      const input = jdpState.targetInput;
      if (!pop || !input || !jdpState.open) return;

      const rect = input.getBoundingClientRect();
      const margin = 8;
      const gap = 6;
      const viewportW = document.documentElement.clientWidth || window.innerWidth;
      const viewportH = window.innerHeight;

      // بعد از render اندازه واقعی تقویم را می‌خوانیم؛ دیگر به ارتفاع ثابت
      // وابسته نیستیم تا در انتخاب ماه/سال یا روی موبایل از صفحه بیرون نزند.
      const popW = Math.min(pop.offsetWidth || 280, viewportW - margin * 2);
      const popH = pop.offsetHeight || 320;

      // در RTL ابتدا با لبه راست فیلد تراز می‌شود.
      let left = rect.right - popW;
      left = Math.max(margin, Math.min(left, viewportW - popW - margin));

      let top = rect.bottom + gap;
      const spaceBelow = viewportH - rect.bottom - margin;
      const spaceAbove = rect.top - margin;

      // هر طرف فضای بیشتری دارد؛ اگر پایین جا نبود، بالا قرار می‌گیرد.
      if (spaceBelow < popH + gap && spaceAbove >= popH + gap) {
        top = rect.top - popH - gap;
      }

      top = Math.max(margin, Math.min(top, viewportH - popH - margin));
      pop.style.left = `${Math.round(left)}px`;
      pop.style.top = `${Math.round(top)}px`;
    }

    function jdpRender() {
      const pop = jdpEnsurePopup();
      const { view, year, month, selected } = jdpState;
      const today = todayISO();

      if (view === 'years') {
        const startY = year - (year % 12);
        let yearsHtml = '';
        for (let y = startY; y < startY + 12; y++) {
          const sel = y === year ? ' selected' : '';
          yearsHtml += `<button type="button" class="jdp-year-item${sel}" data-year="${y}">${toPersianDigits(y)}</button>`;
        }
        pop.innerHTML = `
          <div class="jdp-header">
            <button type="button" class="jdp-nav-btn" data-action="years-prev" aria-label="سال‌های قبلی"><i class="fa-solid fa-chevron-right"></i></button>
            <div class="jdp-title">${toPersianDigits(startY)} – ${toPersianDigits(startY + 11)}</div>
            <button type="button" class="jdp-nav-btn" data-action="years-next" aria-label="سال‌های بعدی"><i class="fa-solid fa-chevron-left"></i></button>
          </div>
          <div class="jdp-year-grid">${yearsHtml}</div>
          <div class="jdp-footer">
            <button type="button" class="jdp-footer-btn jdp-btn-today" data-action="back-days">بازگشت</button>
            <span></span>
          </div>`;
      } else if (view === 'months') {
        let monthsHtml = '';
        for (let m = 1; m <= 12; m++) {
          const sel = m === month ? ' selected' : '';
          monthsHtml += `<button type="button" class="jdp-month-item${sel}" data-month="${m}">${JDP_MONTHS[m - 1]}</button>`;
        }
        pop.innerHTML = `
          <div class="jdp-header">
            <button type="button" class="jdp-nav-btn" data-action="year-prev" aria-label="سال قبل"><i class="fa-solid fa-chevron-right"></i></button>
            <div class="jdp-title" data-action="show-years">${toPersianDigits(year)}</div>
            <button type="button" class="jdp-nav-btn" data-action="year-next" aria-label="سال بعد"><i class="fa-solid fa-chevron-left"></i></button>
          </div>
          <div class="jdp-month-grid">${monthsHtml}</div>
          <div class="jdp-footer">
            <button type="button" class="jdp-footer-btn jdp-btn-today" data-action="back-days">بازگشت</button>
            <span></span>
          </div>`;
      } else {
        // days view
        const daysInMonth = jalaliDaysInMonth(year, month);
        // روز هفتهٔ اول ماه (۰=شنبه … ۶=جمعه)
        const firstG = gregorianDateFromJalali(jalaliToDateString(year, month, 1));
        // getUTCDay: 0=Sun … 6=Sat → تبدیل به شنبه=۰
        const utcDay = firstG.getUTCDay(); // 0 Sun .. 6 Sat
        const startOffset = (utcDay + 1) % 7; // شنبه=0

        let weekdaysHtml = JDP_WEEKDAYS.map((w, i) =>
          `<div class="jdp-weekday${i === 6 ? ' weekend' : ''}">${w}</div>`
        ).join('');

        // روزها را با ستون و ردیف مشخص می‌چینیم تا RTL/CSS Grid باعث حذف یا جابه‌جایی
        // روزهای ستون جمعه نشود. ستون‌ها در RTL: شنبه=1 ... جمعه=7.
        let daysHtml = '';
        for (let d = 1; d <= daysInMonth; d++) {
          const iso = jalaliToDateString(year, month, d);
          const classes = ['jdp-day'];
          if (iso === today) classes.push('today');
          if (iso === selected) classes.push('selected');
          const g = gregorianDateFromJalali(iso);
          const weekdayIndex = (g.getUTCDay() + 1) % 7; // شنبه=0 ... جمعه=6
          if (weekdayIndex === 6) classes.push('weekend');
          daysHtml += `<button type="button" class="${classes.join(' ')}" data-day="${d}" style="grid-column:${weekdayIndex + 1};grid-row:${Math.floor((startOffset + d - 1) / 7) + 1};">${toPersianDigits(d)}</button>`;
        }

        pop.innerHTML = `
          <div class="jdp-header">
            <button type="button" class="jdp-nav-btn" data-action="month-prev" aria-label="ماه قبل"><i class="fa-solid fa-chevron-right"></i></button>
            <div class="jdp-title" data-action="show-months">${JDP_MONTHS[month - 1]} ${toPersianDigits(year)}</div>
            <button type="button" class="jdp-nav-btn" data-action="month-next" aria-label="ماه بعد"><i class="fa-solid fa-chevron-left"></i></button>
          </div>
          <div class="jdp-weekdays">${weekdaysHtml}</div>
          <div class="jdp-days">${daysHtml}</div>
          <div class="jdp-footer">
            <button type="button" class="jdp-footer-btn jdp-btn-today" data-action="today">امروز</button>
            <button type="button" class="jdp-footer-btn jdp-btn-clear" data-action="clear">پاک کردن</button>
          </div>`;
      }

      // bind clicks
      pop.onclick = (e) => {
        const t = e.target.closest('[data-action], [data-day], [data-month], [data-year]');
        if (!t) return;
        e.preventDefault();
        e.stopPropagation();

        if (t.dataset.day) {
          const d = Number(t.dataset.day);
          const iso = jalaliToDateString(jdpState.year, jdpState.month, d);
          jdpSelect(iso);
          return;
        }
        if (t.dataset.month) {
          jdpState.month = Number(t.dataset.month);
          jdpState.view = 'days';
          jdpRender();
          return;
        }
        if (t.dataset.year) {
          jdpState.year = Number(t.dataset.year);
          jdpState.view = 'months';
          jdpRender();
          return;
        }

        const action = t.dataset.action;
        if (action === 'month-prev') {
          jdpState.month--;
          if (jdpState.month < 1) { jdpState.month = 12; jdpState.year--; }
          jdpRender();
        } else if (action === 'month-next') {
          jdpState.month++;
          if (jdpState.month > 12) { jdpState.month = 1; jdpState.year++; }
          jdpRender();
        } else if (action === 'year-prev') {
          jdpState.year--;
          jdpRender();
        } else if (action === 'year-next') {
          jdpState.year++;
          jdpRender();
        } else if (action === 'years-prev') {
          jdpState.year -= 12;
          jdpRender();
        } else if (action === 'years-next') {
          jdpState.year += 12;
          jdpRender();
        } else if (action === 'show-months') {
          jdpState.view = 'months';
          jdpRender();
        } else if (action === 'show-years') {
          jdpState.view = 'years';
          jdpRender();
        } else if (action === 'back-days') {
          jdpState.view = 'days';
          jdpRender();
        } else if (action === 'today') {
          jdpSelect(todayISO());
        } else if (action === 'clear') {
          jdpSelect('');
        }
      };

      pop.classList.remove('hidden');
      jdpPosition();
    }

    function jdpSelect(iso) {
      const input = jdpState.targetInput;
      if (input) {
        if (iso) {
          input.value = formatDateToPersian(iso);
          jdpState.selected = iso;
        } else {
          input.value = '';
          jdpState.selected = null;
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      jdpClose();
    }

    function jdpOpen(inputEl) {
      if (!inputEl) return;
      // اگر همین الان باز است روی همین اینپوت، ببند
      if (jdpState.open && jdpState.targetInput === inputEl) {
        jdpClose();
        return;
      }
      jdpState.targetInput = inputEl;
      jdpState.view = 'days';

      // مقدار فعلی اینپوت
      const parsed = parseUserDateInput(inputEl.value);
      if (parsed) {
        const [y, m] = parsed.split('-').map(Number);
        jdpState.year = y;
        jdpState.month = m;
        jdpState.selected = parsed;
      } else {
        const t = todayISO();
        const [y, m] = t.split('-').map(Number);
        jdpState.year = y;
        jdpState.month = m;
        jdpState.selected = null;
      }

      jdpState.open = true;
      jdpRender();
      document.addEventListener('pointerdown', jdpOutsideHandler, true);
      document.addEventListener('keydown', jdpKeyHandler, true);
    }

    function initJalaliDatePicker() {
      const bindDateField = (inputId, btnId, openOnFocus = true) => {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(btnId);
        if (!input) return;
        if (btn) {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            jdpOpen(input);
          });
        }
        // برای تاریخ پرداخت: فقط با کلیک روی دکمه/دوبارکلیک عمدی باز شود
        if (openOnFocus) {
          input.addEventListener('focus', () => {
            setTimeout(() => {
              if (document.activeElement === input && !jdpState.open) jdpOpen(input);
            }, 50);
          });
        } else {
          input.addEventListener('click', (e) => {
            // فقط اگر کاربر عمداً روی فیلد زد
            if (typeof jdpOpen === 'function') jdpOpen(input);
          });
        }
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') jdpClose();
        });
      };

      // تمام فیلدهای تاریخ که از تقویم شمسی مشترک استفاده می‌کنند
      bindDateField('start-date', 'start-date-btn');
      bindDateField('edit-start-date', 'edit-start-date-btn');
      bindDateField('pay-paid-date', 'pay-paid-date-btn', false);

      // ریپوزیشن هنگام اسکرول/ریسایز
      window.addEventListener('resize', () => { if (jdpState.open) jdpPosition(); });
      window.addEventListener('scroll', () => { if (jdpState.open) jdpPosition(); }, true);
    }


    // ============================================================
    //  APP SETTINGS + CURRENCY + AUTOLOCK + NOTIFICATIONS
    // ============================================================
    let appSettings = safeParseJSON('vam_app_settings', {
      currency: 'toman',
      autoLockMinutes: 5,
      notifOverdue: true,
      compactCards: false,
      calendarAlarmDays: 0
    });
    // مهاجرت: اگر از قبل تنظیمات بدون calendarAlarmDays ذخیره شده
    if (appSettings.calendarAlarmDays == null || !Number.isFinite(Number(appSettings.calendarAlarmDays))) {
      appSettings.calendarAlarmDays = 0;
    }
    let swWaitingRegistration = null;
    let dashFilter = 'all';
    let autoLockTimer = null;
    let lastActivity = Date.now();

    function currencyLabel() {
      return appSettings.currency === 'rial' ? 'ریال' : 'تومان';
    }
    /** مبالغ داخلی همیشه به تومان ذخیره می‌شوند */
    function toDisplayAmount(storedToman) {
      const v = Number(storedToman) || 0;
      return appSettings.currency === 'rial' ? v * 10 : v;
    }
    /** مقدار واردشده در UI را به تومان ذخیره‌ای تبدیل می‌کند */
    function toStoredAmount(displayValue) {
      const v = Number(displayValue) || 0;
      return appSettings.currency === 'rial' ? v / 10 : v;
    }
    function formatMoney(n) {
      // n = مبلغ ذخیره‌شده (تومان)
      const v = toDisplayAmount(n);
      return toPersianDigits(numberWithCommas(v)) + ' ' + currencyLabel();
    }
    /** فقط عدد با واحد نمایش (بدون چسباندن دستی تومان/ریال) */
    function formatMoneyNumber(n) {
      return toPersianDigits(numberWithCommas(toDisplayAmount(n)));
    }
    /** به‌روزرسانی لیبل‌های واحد پول در فرم محاسبه و ثبت وام */
    function refreshCurrencyLabels() {
      const unit = currencyLabel();
      function setLabelText(labelId, text) {
        const el = document.getElementById(labelId);
        if (!el) return;
        // فقط نود متنی اول را عوض کن تا input داخل label حفظ شود
        for (let i = 0; i < el.childNodes.length; i++) {
          if (el.childNodes[i].nodeType === Node.TEXT_NODE) {
            el.childNodes[i].textContent = text;
            return;
          }
        }
        // اگر نود متنی نبود، اضافه کن
        el.insertBefore(document.createTextNode(text), el.firstChild);
      }
      setLabelText('calc-amount-label', 'مبلغ وام (' + unit + ')\n');
      setLabelText('loan-amount-label', 'مبلغ کل وام (' + unit + ')\n');
      setLabelText('installment-amount-label', 'مبلغ هر قسط (' + unit + ')\n');
      setLabelText('edit-loan-amount-label', 'مبلغ کل وام (' + unit + ')\n');
      setLabelText('edit-installment-amount-label', 'مبلغ هر قسط (' + unit + ')\n');
      const payHeader = document.getElementById('installment-pay-header');
      if (payHeader) payHeader.textContent = 'پرداخت (' + unit + ')';
    }
    function openSettingsModal() {
      afterSideMenuClose(() => {
        document.getElementById('set-currency').value = appSettings.currency || 'toman';
        document.getElementById('set-autolock').value = String(appSettings.autoLockMinutes ?? 5);
        document.getElementById('set-notif-overdue').checked = !!appSettings.notifOverdue;
        const c = document.getElementById('set-compact');
        if (c) c.checked = !!appSettings.compactCards;
        const calAlarm = document.getElementById('set-calendar-alarm');
        if (calAlarm) calAlarm.value = String(appSettings.calendarAlarmDays ?? 0);
        document.getElementById('settings-modal').classList.add('open');
        try { renderArchivedLoansList(); } catch (_) {}
      });
    }
    function closeSettingsModal() {
      document.getElementById('settings-modal')?.classList.remove('open');
    }
    function saveAppSettings() {
      appSettings.currency = document.getElementById('set-currency')?.value || 'toman';
      appSettings.autoLockMinutes = parseInt(document.getElementById('set-autolock')?.value || '5', 10);
      appSettings.notifOverdue = !!document.getElementById('set-notif-overdue')?.checked;
      appSettings.compactCards = !!document.getElementById('set-compact')?.checked;
      {
        const raw = parseInt(document.getElementById('set-calendar-alarm')?.value ?? '3', 10);
        appSettings.calendarAlarmDays = Number.isFinite(raw) && raw >= 0 ? raw : 0;
      }
      localStorage.setItem('vam_app_settings', JSON.stringify(appSettings));
      document.body.classList.toggle('compact-cards', !!appSettings.compactCards);
      try { syncCalendarAlarmSelect(); } catch (_) {}
      resetAutoLockTimer();
      refreshCurrencyLabels();
      renderDashboard();
      if (currentLoan) updateManageInstallmentTable();
      // اگر نتیجه محاسبه باز است، دوباره با واحد جدید نمایش بده
      if (lastCalcResult && !document.getElementById('calc-result-box')?.classList.contains('hidden')) {
        runLoanCalculator();
      }
      showToast('تنظیمات ذخیره شد.', 'success');
    }

    function applyCompactFromSettings() {
      document.body.classList.toggle('compact-cards', !!appSettings.compactCards);
    }

    function quickPayFab() {
      showPage('register-loan');
      setTimeout(() => {
        const typeEl = document.getElementById('calc-loan-type');
        if (typeEl) {
          typeEl.focus();
          try { typeEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
        }
      }, 200);
    }
    function goHomeFab() {
      const dash = document.getElementById('dashboard');
      const already = dash && !dash.classList.contains('hidden');
      showPage('dashboard');
      const scrollTop = () => {
        try {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
        } catch (e) {
          window.scrollTo(0, 0);
        }
      };
      if (already) scrollTop();
      else setTimeout(scrollTop, 50);
    }

    let boostBusy = false;
    /** موشک: پاک‌سازی کش / آزادسازی حافظه — داده‌های وام حفظ می‌شوند */
    async function boostAppSpeed() {
      if (boostBusy) return;
      boostBusy = true;
      const btn = document.getElementById('fab-boost');
      if (btn) btn.classList.add('boosting');

      try {
        // ۱) کش موقت در حافظه
        if (typeof cachedLoanCards === 'object') cachedLoanCards = {};
        if (typeof debounceTimer !== 'undefined' && debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = null;
        }

        // ۲) نابود کردن نمودارهای Chart.js (حافظه)
        try {
          if (typeof chartProgress !== 'undefined' && chartProgress) {
            chartProgress.destroy();
            chartProgress = null;
          }
          if (typeof chartAllLoans !== 'undefined' && chartAllLoans) {
            chartAllLoans.destroy();
            chartAllLoans = null;
          }
        } catch (e) {}

        // ۳) پاک کردن Cache Storage سرویس‌ورکر (دارایی‌های قدیمی)
        let cacheCount = 0;
        if (typeof caches !== 'undefined') {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => { cacheCount++; return caches.delete(k); }));
        }

        // ۴) sessionStorage سبک (به‌جز وضعیت ورود)
        try {
          const keep = ['vam_logged_in', 'vam_user_id'];
          const toRemove = [];
          for (let i = 0; i < sessionStorage.length; i++) {
            const k = sessionStorage.key(i);
            if (k && !keep.includes(k)) toRemove.push(k);
          }
          toRemove.forEach(k => sessionStorage.removeItem(k));
        } catch (e) {}

        // ۵) رندر دوباره سبک + اسکرول بالا
        try {
          renderDashboard();
        } catch (e) {}
        try {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e) { window.scrollTo(0, 0); }

        // ۶) پاک‌سازی + پیش‌کش مجدد از طریق سرویس‌ورکر
        if ('serviceWorker' in navigator) {
          try {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const reg of regs) {
              try { await reg.update(); } catch (e) {}
            }
            const ctrl = navigator.serviceWorker.controller;
            if (ctrl) {
              ctrl.postMessage({ type: 'CLEAR_AND_RECACHE' });
            } else {
              // بدون کنترلر: فقط update؛ precache در install بعدی
              for (const reg of regs) {
                try { await reg.update(); } catch (e) {}
              }
            }
          } catch (e) {}
        }

        showToast('🚀 سرعت بهینه شد — کش پاک و دوباره ساخته می‌شود' + (cacheCount ? ` (${toPersianDigits(cacheCount)})` : ''), 'success');
      } catch (err) {
        console.error(err);
        showToast('بهینه‌سازی با خطا مواجه شد.', 'error');
      } finally {
        setTimeout(() => {
          if (btn) btn.classList.remove('boosting');
          boostBusy = false;
        }, 900);
      }
    }

    function applySwUpdate() {
      const banner = document.getElementById('sw-update-banner');
      if (swWaitingRegistration && swWaitingRegistration.waiting) {
        swWaitingRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      if (banner) banner.classList.remove('show');
      setTimeout(() => location.reload(), 400);
    }

    function registerServiceWorkerWithUpdate() {
      if (!('serviceWorker' in navigator)) return;
      navigator.serviceWorker.register('./sw.js').then(reg => {
        console.log('SW registered', reg.scope, APP_VERSION);
        if (reg.waiting) {
          swWaitingRegistration = reg;
          document.getElementById('sw-update-banner')?.classList.add('show');
        }
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              swWaitingRegistration = reg;
              document.getElementById('sw-update-banner')?.classList.add('show');
            }
          });
        });
      }).catch(err => console.log('SW failed', err));

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        location.reload();
      });

      navigator.serviceWorker.addEventListener('message', (event) => {
        const d = event.data || {};
        if (d.type === 'RECACHE_DONE') {
          try { showToast('کش برنامه بازسازی شد (' + (d.version || APP_VERSION) + ')', 'success'); } catch (e) {}
        }
      });
    }




    function setDashFilter(f) {
      dashFilter = f;
      document.querySelectorAll('.dash-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === f);
      });
      // همگام‌سازی دکمه شناور فیلتر
      const fab = document.getElementById('fab-filter');
      const icon = document.getElementById('fab-filter-icon');
      if (fab && icon) {
        if (f === 'overdue') {
          fab.dataset.mode = 'overdue';
          fab.title = 'معوق';
          fab.setAttribute('aria-label', 'فیلتر: معوق');
          fab.classList.add('fab-filter-overdue');
          icon.className = 'fa-solid fa-triangle-exclamation';
        } else {
          fab.dataset.mode = 'all';
          fab.title = 'همه';
          fab.setAttribute('aria-label', 'فیلتر: همه');
          fab.classList.remove('fab-filter-overdue');
          icon.className = 'fa-solid fa-list';
        }
      }
      renderLoanCards();
    }
    /** دکمه شناور: یک بار همه، بار بعد معوق (و برعکس) */
    function toggleDashFilterFab() {
      const next = (dashFilter === 'overdue') ? 'all' : 'overdue';
      setDashFilter(next);
      if (typeof showToast === 'function') {
        showToast(next === 'overdue' ? 'نمایش وام‌های معوق' : 'نمایش همه وام‌ها', 'info');
      }
    }
    function loanMatchesFilter(loan) {
      const paidCount = (loan.installments || []).filter(i => i.paid).length;
      const total = loan.installmentCount || 0;
      const hasOverdue = (loan.installments || []).some(i => isOverdue(i));
      if (dashFilter === 'active') return paidCount < total;
      if (dashFilter === 'done') return total > 0 && paidCount >= total;
      if (dashFilter === 'overdue') return hasOverdue;
      return true;
    }
    function loanMatchesSearch(loan) {
      const q = (
        document.getElementById('global-search')?.value ||
        document.getElementById('dash-search')?.value ||
        ''
      ).trim().toLowerCase();
      if (!q) return true;
      return [loan.name, loan.party].some(v => String(v || '').toLowerCase().includes(q));
    }

    function resetAutoLockTimer() {
      lastActivity = Date.now();
      if (autoLockTimer) clearTimeout(autoLockTimer);
      const mins = Number(appSettings.autoLockMinutes) || 0;
      if (mins <= 0) return;
      autoLockTimer = setTimeout(() => {
        if (sessionStorage.getItem('vam_logged_in') === '1') {
          const users = getUsers();
          if (users.some(u => u.passwordHash)) {
            sessionStorage.removeItem('vam_logged_in');
            sessionStorage.removeItem('vam_user_id');
            showLoginScreen();
            showToast('به دلیل عدم فعالیت، برنامه قفل شد.', 'info');
          }
        }
      }, mins * 60 * 1000);
    }
    function setupActivityWatchers() {
      const events = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
      events.forEach(ev => {
        document.addEventListener(ev, () => {
          if (Date.now() - lastActivity > 15000) resetAutoLockTimer();
          else lastActivity = Date.now();
        }, { passive: true });
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') resetAutoLockTimer();
      });
    }

    function notifIconUrl() {
      try {
        return new URL('icons/icon-192.png', window.location.href).href;
      } catch (e) {
        return 'icons/icon-192.png';
      }
    }

    async function showSystemNotification(title, options = {}) {
      const opts = {
        body: options.body || '',
        icon: options.icon || notifIconUrl(),
        badge: options.badge || notifIconUrl(),
        tag: options.tag || ('vam-' + Date.now()),
        dir: 'rtl',
        lang: 'fa',
        renotify: !!options.renotify,
        data: options.data || {},
        silent: false
      };
      // اولویت با Service Worker (موبایل / PWA پایدارتر است)
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          if (reg && typeof reg.showNotification === 'function') {
            await reg.showNotification(title, opts);
            return true;
          }
        }
      } catch (e) {
        console.warn('SW notification failed', e);
      }
      // fallback: Notification سازنده صفحه
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          const n = new Notification(title, opts);
          n.onclick = () => {
            try { window.focus(); } catch (_) {}
            try { n.close(); } catch (_) {}
          };
          return true;
        }
      } catch (e) {
        console.warn('Page notification failed', e);
      }
      return false;
    }

    async function requestNotifPermission() {
      if (!('Notification' in window)) {
        return showToast('این مرورگر از اعلان پشتیبانی نمی‌کند.', 'warning');
      }
      // بعضی محیط‌ها (مثل content://) secure context نیستند
      if (typeof window.isSecureContext === 'boolean' && !window.isSecureContext) {
        showToast('برای اعلان، برنامه را از طریق HTTPS یا نصب PWA باز کنید.', 'warning');
      }
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          showToast('مجوز اعلان داده شد.', 'success');
          // اعلان آزمایشی تا کاربر ببیند کار می‌کند
          await showSystemNotification('سیستم مدیریت وام', {
            body: 'اعلان‌ها فعال شد. برای اقساط معوق و نزدیک سررسید مطلع می‌شوید.',
            tag: 'vam-permission-ok',
            renotify: true
          });
          await maybeShowOverdueNotifications(true);
        } else if (perm === 'denied') {
          showToast('مجوز اعلان رد شد. از تنظیمات مرورگر فعال کنید.', 'warning');
        } else {
          showToast('مجوز اعلان داده نشد.', 'warning');
        }
      } catch (e) {
        console.error(e);
        showToast('خطا در درخواست مجوز اعلان.', 'error');
      }
    }

    async function maybeShowOverdueNotifications(forceFeedback = false) {
      if (!appSettings.notifOverdue) {
        if (forceFeedback) showToast('اعلان اقساط معوق در تنظیمات خاموش است.', 'info');
        return;
      }
      if (!('Notification' in window) || Notification.permission !== 'granted') {
        if (forceFeedback) showToast('مجوز اعلان فعال نیست.', 'warning');
        return;
      }
      // معوق + امروز + تا ۳ روز آینده
      const items = buildNotifications().filter(n => n.type === 'overdue' || n.type === 'soon');
      if (!items.length) {
        if (forceFeedback) showToast('قسط معوق یا نزدیک سررسیدی برای اعلان نیست.', 'info');
        return;
      }
      // حداکثر ۵ اعلان
      const batch = items.slice(0, 5);
      let shown = 0;
      for (let idx = 0; idx < batch.length; idx++) {
        const item = batch[idx];
        await new Promise(r => setTimeout(r, idx === 0 ? 400 : 700));
        const ok = await showSystemNotification(item.title || 'یادآوری قسط', {
          body: item.body || '',
          tag: 'vam-' + item.type + '-' + item.id,
          renotify: true,
          data: { loanId: item.loanId, notifId: item.id }
        });
        if (ok) shown++;
      }
      if (forceFeedback) {
        if (shown > 0) showToast(toPersianDigits(shown) + ' اعلان ارسال شد.', 'success');
        else showToast('مرورگر اعلان را نشان نداد. اگر PWA است، یک‌بار برنامه را ببندید و دوباره باز کنید.', 'warning');
      }
    }

    function payAllOverdue() {
      if (!currentLoan) return showToast('یک وام انتخاب کنید.', 'error');
      let count = 0;
      (currentLoan.installments || []).forEach(inst => {
        if (isOverdue(inst) && !inst.paid) {
          inst.paid = true;
          count++;
        }
      });
      if (!count) return showToast('قسط معوقی وجود ندارد.', 'info');
      persist();
      invalidateLoanStats(currentLoan.id);
      refreshAllViews('batch-payment');
      showToast(toPersianDigits(count) + ' قسط معوق پرداخت شد.', 'success');
    }

    function startEditInstAmount(num) {
      if (!currentLoan) return;
      const inst = (currentLoan.installments || []).find(x => x.number === num);
      if (!inst) return;
      const cell = document.querySelector(`[data-inst-amount="${num}"]`);
      if (!cell) return;
      const current = toDisplayAmount(inst.amount || 0);
      cell.innerHTML = `<input class="inst-amount-edit" type="text" inputmode="numeric" value="${toPersianDigits(numberWithCommas(current))}" oninput="formatNumber(this)" onkeydown="if(event.key==='Enter')saveInstAmount(${num}, this)" onblur="saveInstAmount(${num}, this)" />`;
      const inp = cell.querySelector('input');
      if (inp) { inp.focus(); inp.select(); }
    }
    function saveInstAmount(num, input) {
      if (!currentLoan) return;
      const inst = (currentLoan.installments || []).find(x => x.number === num);
      if (!inst) return;
      const val = toStoredAmount(parseNumber(input.value));
      if (val < 0) return showToast('مبلغ نامعتبر است.', 'error');
      inst.amount = val;
      persist();
      updateManageInstallmentTable();
      renderDashboard();
      showToast('مبلغ قسط ' + toPersianDigits(num) + ' به‌روز شد.', 'success');
    }

    function updateLastBackupInfo() {
      const el = document.getElementById('last-backup-info');
      if (!el) return;
      const ts = localStorage.getItem('vam_last_backup');
      if (!ts) {
        el.textContent = 'هنوز پشتیبان گرفته نشده است.';
        return;
      }
      try {
        const d = new Date(ts);
        el.textContent = 'آخرین پشتیبان: ' + toPersianDigits(d.toLocaleString('fa-IR'));
      } catch (e) {
        el.textContent = 'آخرین پشتیبان: ' + ts;
      }
    }

    function exportFullExcelBackup() {
      if (typeof XLSX === 'undefined') return showToast('کتابخانه اکسل در دسترس نیست.', 'error');
      if (!loans.length) return showToast('وامی برای خروجی وجود ندارد.', 'warning');
      const wb = XLSX.utils.book_new();
      // sheet 1: summary
      const summary = [
        ['گزارش کامل سیستم مدیریت وام'],
        ['تاریخ', reportDateJalali()],
        ['تعداد وام‌ها', loans.length],
        [],
        ['طرف حساب', 'نام وام', 'آیکون', 'مبلغ کل', 'مبلغ قسط', 'تعداد اقساط', 'پرداخت‌شده', 'مانده', 'تاریخ شروع', 'تاریخ تسویه', 'آخرین پرداخت']
      ];
      let sumInstallments = 0;
      let sumAmounts = 0;
      loans.forEach(loan => {
        const paid = (loan.installments || []).filter(i => i.paid).length;
        const remain = Math.max((loan.installmentCount || 0) - paid, 0);
        const settle = getLoanSettlementDate(loan);
        const lastPaymentStr = getLastPaymentDate(loan);
        const amt = Number(loan.amount) || 0;
        const instAmt = Number(loan.installmentAmount) || 0;
        sumAmounts += amt;
        sumInstallments += instAmt;
        summary.push([
          loan.party || '—',
          loan.name,
          loan.icon || 'پیش‌فرض',
          numberWithCommas(toDisplayAmount(amt)),
          numberWithCommas(toDisplayAmount(instAmt)),
          loan.installmentCount,
          paid, remain,
          formatDateToPersian(loan.startDate),
          settle ? formatDateToPersian(settle) : '—',
          lastPaymentStr
        ]);
      });
      summary.push([]);
      summary.push([
        'جمع',
        '',
        '',
        numberWithCommas(toDisplayAmount(sumAmounts)),
        numberWithCommas(toDisplayAmount(sumInstallments)),
        '', '', '', '', '', ''
      ]);
      XLSX.utils.book_append_sheet(wb, excelSheetFromAoA(summary, 'خلاصه'), 'خلاصه');
      // per-loan sheets (limit to avoid huge files)
      loans.slice(0, 20).forEach((loan, idx) => {
        const aoa = [
          ['اقساط وام: ' + (loan.name || '')],
          ['شماره', 'تاریخ سررسید', 'مبلغ', 'وضعیت', 'تاریخ پرداخت']
        ];
        (loan.installments || []).forEach(inst => {
          const raw = Number(inst.amount);
          const amt = Number.isFinite(raw) ? raw : (Number(loan.installmentAmount) || 0);
          aoa.push([inst.number, formatDateToPersian(inst.date), numberWithCommas(amt), inst.paid ? 'پرداخت‌شده' : 'پرداخت‌نشده', formatPaidAt(inst)]);
        });
        const name = ('قسط' + (idx + 1)).slice(0, 28);
        XLSX.utils.book_append_sheet(wb, excelSheetFromAoA(aoa, name), name);
      });
      downloadWorkbook(wb, `vam_full_backup_${reportDateForFilename()}_${loans.length}loans.xlsx`);
      localStorage.setItem('vam_last_backup', new Date().toISOString());
      updateLastBackupInfo();
      showToast('خروجی اکسل کامل ذخیره شد.', 'success');
    }

    async function shareLoanReport() {
      const sel = document.getElementById('report-loan-select');
      const id = sel?.value;
      if (!id) return showToast('یک وام انتخاب کنید.', 'error');
      const loan = loans.find(l => String(l.id) === String(id));
      if (!loan) return;
      const paid = (loan.installments || []).filter(i => i.paid).length;
      const remain = Math.max((loan.installmentCount || 0) - paid, 0);
      const lastPayment = getLastPaymentDate(loan);
      const text = `گزارش وام «${loan.name}»\nمبلغ کل: ${formatMoney(loan.amount)}\nاقساط: ${paid}/${loan.installmentCount}\nمانده: ${remain} قسط\nآخرین پرداخت: ${lastPayment}\nسیستم مدیریت وام`;
      try {
        if (navigator.share) {
          await navigator.share({ title: 'گزارش وام', text });
          showToast('اشتراک‌گذاری انجام شد.', 'success');
        } else {
          await navigator.clipboard.writeText(text);
          showToast('متن گزارش در کلیپ‌بورد کپی شد.', 'success');
        }
      } catch (e) {
        if (e.name !== 'AbortError') showToast('اشتراک‌گذاری لغو یا ناموفق بود.', 'info');
      }
    }


    // ============================================================
    //  NOTIFICATIONS (bell)
    // ============================================================
    function daysUntilDate(dateStr) {
      if (!dateStr) return null;
      const target = parseLocalDate(dateStr);
      const today = parseLocalDate(todayISO());
      if (isNaN(target.getTime()) || isNaN(today.getTime())) return null;
      return Math.round((target.getTime() - today.getTime()) / 86400000);
    }
    function getSeenNotificationIds() {
      const arr = safeParseJSON('vam_notif_seen', []);
      return Array.isArray(arr) ? arr : [];
    }
    function saveSeenNotificationIds(ids) {
      // keep list from growing forever
      const trimmed = ids.slice(-500);
      localStorage.setItem('vam_notif_seen', JSON.stringify(trimmed));
    }
    function buildNotifications() {
      const items = [];
      (loans || []).forEach(loan => {
        (loan.installments || []).forEach(inst => {
          if (inst.paid || !inst.date) return;
          const days = daysUntilDate(inst.date);
          if (days === null) return;
          if (days < 0) {
            items.push({
              id: `${loan.id}-${inst.number}-overdue`,
              type: 'overdue',
              loanId: loan.id,
              loanName: loan.name,
              instNumber: inst.number,
              date: inst.date,
              amount: inst.amount,
              days,
              title: 'قسط سررسید شده',
              body: `وام «${loan.name}» — قسط ${toPersianDigits(inst.number)} · ${formatDateToPersian(inst.date)} · ${formatMoney(inst.amount)} · ${toPersianDigits(Math.abs(days))} روز تأخیر`
            });
          } else if (days <= 3) {
            items.push({
              id: `${loan.id}-${inst.number}-soon`,
              type: 'soon',
              loanId: loan.id,
              loanName: loan.name,
              instNumber: inst.number,
              date: inst.date,
              amount: inst.amount,
              days,
              title: days === 0 ? 'قسط امروز سررسید می‌شود' : `فقط ${toPersianDigits(days)} روز تا سررسید`,
              body: `وام «${loan.name}» — قسط ${toPersianDigits(inst.number)} · ${formatDateToPersian(inst.date)} · ${formatMoney(inst.amount)}`
            });
          }
        });
      });
      // overdue first (most delayed first), then soon (soonest first)
      items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'overdue' ? -1 : 1;
        if (a.type === 'overdue') return a.days - b.days; // more negative (older) first
        return a.days - b.days; // smaller days first
      });
      return items;
    }
    function updateNotificationBadge() {
      const items = buildNotifications();
      const seen = new Set(getSeenNotificationIds());
      const unseen = items.filter(i => !seen.has(i.id)).length;
      const badge = document.getElementById('notif-badge');
      if (!badge) return;
      if (unseen > 0) {
        badge.textContent = toPersianDigits(unseen > 99 ? '99+' : String(unseen));
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
    function renderNotificationList() {
      const list = document.getElementById('notif-list');
      if (!list) return;
      const items = buildNotifications();
      const seen = new Set(getSeenNotificationIds());
      if (!items.length) {
        list.innerHTML = '<div class="notif-empty"><i class="fa-regular fa-bell-slash mb-2" style="font-size:1.4rem;display:block;"></i>اعلان فعالی نیست</div>';
        return;
      }
      list.innerHTML = items.map(item => {
        const isSeen = seen.has(item.id);
        const delayOrSoon = item.type === 'overdue'
          ? `<span class="meta-delay"><i class="fa-solid fa-hourglass-end"></i> ${toPersianDigits(Math.abs(item.days))} روز تأخیر</span>`
          : `<span class="meta-soon"><i class="fa-solid fa-hourglass-half"></i> ${item.days === 0 ? 'امروز' : toPersianDigits(item.days) + ' روز مانده'}</span>`;
        return `
          <div class="notif-item ${item.type} ${isSeen ? 'seen' : ''}" data-notif-id="${item.id}" onclick="onNotificationClick('${item.loanId}','${item.id}')">
            <div class="notif-item-title">
              <i class="fa-solid ${item.type === 'overdue' ? 'fa-circle-exclamation text-rose-500' : 'fa-clock text-amber-500'}"></i>
              ${item.title}
            </div>
            <div class="notif-item-loan">وام «${escapeHtml(item.loanName)}» — قسط ${toPersianDigits(item.instNumber)}</div>
            <div class="notif-item-meta">
              <span><i class="fa-regular fa-calendar"></i> ${formatDateToPersian(item.date)}</span>
              <span class="meta-amount"><i class="fa-solid fa-coins"></i> ${formatMoney(item.amount)}</span>
              ${delayOrSoon}
            </div>
          </div>`;
      }).join('');
    }
    function toggleNotifPanel() {
      const panel = document.getElementById('notif-panel');
      const overlay = document.getElementById('notif-overlay');
      if (!panel) return;
      const opening = panel.classList.contains('hidden');
      if (opening) {
        closeSideMenu();
        renderNotificationList();
        panel.classList.remove('hidden');
        overlay?.classList.remove('hidden');
        // mark visible as seen when opened
        markVisibleNotificationsSeen(false);
        updateNotificationBadge();
        renderNotificationList();
      } else {
        closeNotifPanel();
      }
    }
    function closeNotifPanel() {
      document.getElementById('notif-panel')?.classList.add('hidden');
      document.getElementById('notif-overlay')?.classList.add('hidden');
    }
    function markVisibleNotificationsSeen(updateUi = true) {
      const items = buildNotifications();
      const seen = new Set(getSeenNotificationIds());
      items.forEach(i => seen.add(i.id));
      saveSeenNotificationIds([...seen]);
      if (updateUi) {
        updateNotificationBadge();
        renderNotificationList();
      }
    }
    function markAllNotificationsSeen() {
      markVisibleNotificationsSeen(true);
      showToast('همه اعلان‌ها خوانده شد.', 'info');
    }
    function onNotificationClick(loanId, notifId) {
      const seen = new Set(getSeenNotificationIds());
      seen.add(notifId);
      saveSeenNotificationIds([...seen]);
      updateNotificationBadge();
      renderNotificationList();
      closeNotifPanel();
      // show neat detail box
      const items = buildNotifications();
      const item = items.find(i => i.id === notifId) || {
        id: notifId,
        loanId,
        title: 'اعلان',
        loanName: '',
        instNumber: '',
        date: '',
        amount: 0,
        days: 0,
        type: 'overdue'
      };
      // if not found in current (already paid?), still try to show from seen data, but simple: rebuild from loans
      showNotifDetail(item);
    }

    function showNotifDetail(item) {
      const overlay = document.getElementById('notif-detail-overlay');
      const box = document.getElementById('notif-detail-box');
      if (!overlay || !box) return;

      // if item incomplete, try to rebuild full info
      if (!item.loanName && item.loanId) {
        const full = buildNotifications().find(i => i.id === item.id);
        if (full) item = full;
        else {
          const loan = (loans || []).find(l => String(l.id) === String(item.loanId));
          if (loan) {
            item.loanName = loan.name;
            const inst = (loan.installments || []).find(i => String(i.number) === String(item.instNumber));
            if (inst) {
              item.date = inst.date;
              item.amount = inst.amount;
              item.days = daysUntilDate(inst.date);
            }
          }
        }
      }

      const isOverdue = item.type === 'overdue' || (item.days != null && item.days < 0);
      const statusText = isOverdue
        ? `${toPersianDigits(Math.abs(item.days || 0))} روز تأخیر`
        : (item.days === 0 ? 'امروز سررسید می‌شود' : `${toPersianDigits(item.days)} روز مانده`);
      const statusColor = isOverdue ? '#ef4444' : '#d97706';

      box.innerHTML = `
        <div class="notif-detail-header">
          <div class="notif-detail-title">
            <i class="fa-solid ${isOverdue ? 'fa-circle-exclamation' : 'fa-clock'}" style="color:${statusColor}"></i>
            ${item.title || (isOverdue ? 'قسط سررسید شده' : 'یادآوری قسط')}
          </div>
          <button type="button" class="notif-detail-close" onclick="closeNotifDetail()" aria-label="بستن">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="notif-detail-body">
          <div class="notif-detail-row">
            <span class="notif-detail-label">نام وام</span>
            <span class="notif-detail-value">«${escapeHtml(item.loanName || '—')}»</span>
          </div>
          <div class="notif-detail-row">
            <span class="notif-detail-label">شماره قسط</span>
            <span class="notif-detail-value">${toPersianDigits(item.instNumber || '—')}</span>
          </div>
          <div class="notif-detail-row">
            <span class="notif-detail-label">تاریخ سررسید</span>
            <span class="notif-detail-value">${item.date ? formatDateToPersian(item.date) : '—'}</span>
          </div>
          <div class="notif-detail-row">
            <span class="notif-detail-label">مبلغ قسط</span>
            <span class="notif-detail-value">${formatMoney(item.amount || 0)}</span>
          </div>
          <div class="notif-detail-row">
            <span class="notif-detail-label">وضعیت</span>
            <span class="notif-detail-value" style="color:${statusColor}">${statusText}</span>
          </div>
        </div>
        <div class="notif-detail-actions">
          <button type="button" class="notif-detail-btn-secondary" onclick="closeNotifDetail()">بستن</button>
          <button type="button" class="notif-detail-btn-primary" onclick="closeNotifDetail(); selectAndShowPage('${item.loanId}','manage-loans')">
            <i class="fa-solid fa-arrow-left me-1"></i>رفتن به وام
          </button>
        </div>
      `;
      overlay.classList.remove('hidden');
    }

    function closeNotifDetail() {
      document.getElementById('notif-detail-overlay')?.classList.add('hidden');
    }

    function addMonths(date, months) {
      const base = date instanceof Date ? date : new Date(date);
      const p = jalaliPartsFromDate(base);
      if (!p) return new Date(NaN);
      const total = (p.year * 12 + (p.month - 1)) + Number(months || 0);
      const year = Math.floor(total / 12);
      const month = (total % 12) + 1;
      const day = Math.min(p.day, jalaliDaysInMonth(year, month));
      return gregorianDateFromJalali(jalaliToDateString(year, month, day));
    }

    function debounce(func, wait) {
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(debounceTimer);
          func(...args);
        };
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(later, wait);
      };
    }

    // ============================================================
    //  CHART PLUGIN
    // ============================================================
    const shadowPlugin = {
      id: 'shadowPlugin',
      beforeDatasetsDraw(chart, args, opts){
        const { ctx } = chart;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,.04)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 6;
      },
      afterDatasetsDraw(chart){
        chart.ctx.restore();
      }
    };
    Chart.register(shadowPlugin);
    Chart.register(ChartDataLabels);
    Chart.defaults.font.family = 'Vazirmatn, Tahoma, Arial, sans-serif';
    Chart.defaults.font.size = 12;

    // ============================================================
    //  NAVIGATION + SIDE MENU
    // ============================================================
    function updateSideMenuState(pageId) {
      document.querySelectorAll('.side-menu-nav .nav-btn[data-page]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === pageId);
      });
    }

    function openSideMenu() {
      closeNotifPanel();
      updateSideMenuState(document.querySelector('main > section:not(.hidden)')?.id || 'dashboard');
      const menu = document.getElementById('side-menu');
      if (menu) {
        menu.classList.add('open');
        menu.setAttribute('aria-hidden', 'false');
      }
      document.getElementById('side-menu-overlay')?.classList.add('open');
      document.getElementById('menu-toggle')?.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
    function closeSideMenu() {
      const menu = document.getElementById('side-menu');
      if (!menu || !menu.classList.contains('open')) return;
      menu.classList.remove('open');
      document.getElementById('side-menu-overlay')?.classList.remove('open');
      document.getElementById('menu-toggle')?.classList.remove('active');
      menu.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
    /** بعد از انیمیشن بسته شدن منو اجرا شود */
    function afterSideMenuClose(fn, delayMs) {
      const menu = document.getElementById('side-menu');
      const isOpen = menu && menu.classList.contains('open');
      const delay = delayMs != null ? delayMs : MENU_TRANSITION_MS;
      if (isOpen) {
        closeSideMenu();
        setTimeout(fn, delay);
      } else {
        fn();
      }
    }
    function toggleSideMenu() {
      const menu = document.getElementById('side-menu');
      if (menu?.classList.contains('open')) closeSideMenu();
      else openSideMenu();
    }
    const MENU_TRANSITION_MS = 220;
    let menuNavTimer = null;
    function navigateTo(id) {
      // Close new mobile sidebar if open
      try { closeAppSidebar(); } catch(_){}
      const menu = document.getElementById('side-menu');
      const isOpen = menu && menu.classList.contains('open');
      if (menuNavTimer) {
        clearTimeout(menuNavTimer);
        menuNavTimer = null;
      }
      if (isOpen) {
        closeSideMenu();
        menuNavTimer = setTimeout(() => {
          menuNavTimer = null;
          showPage(id, true);
        }, MENU_TRANSITION_MS);
      } else {
        showPage(id, true);
      }
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        try { closeSideMenu(); } catch(_){}
        try { closeAppSidebar(); } catch(_){}
      }
    });

    // New permanent sidebar helpers
    function toggleAppSidebar() {
      const sb = document.getElementById('app-sidebar');
      const ov = document.getElementById('sidebar-overlay');
      if (!sb) return;
      sb.classList.toggle('open');
      if (ov) ov.classList.toggle('show', sb.classList.contains('open'));
    }
    function closeAppSidebar() {
      const sb = document.getElementById('app-sidebar');
      const ov = document.getElementById('sidebar-overlay');
      if (sb) sb.classList.remove('open');
      if (ov) ov.classList.remove('show');
    }
    window.toggleAppSidebar = toggleAppSidebar;
    window.closeAppSidebar = closeAppSidebar;

    function setActiveNav(id) {
      document.querySelectorAll('.app-sidebar .nav-item[data-page]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-page') === id);
      });
      // Also keep legacy side-menu in sync if present
      try { updateSideMenuState(id); } catch(_){}
    }

    let pageHistory = ['dashboard'];
    function updateBackButton() {
      const btn = document.getElementById('nav-back-btn');
      if (!btn) return;
      const cur = pageHistory[pageHistory.length - 1] || 'dashboard';
      if (cur === 'dashboard' || pageHistory.length <= 1) btn.classList.add('hidden');
      else btn.classList.remove('hidden');
    }
    function goBack() {
      if (pageHistory.length > 1) pageHistory.pop();
      const prev = pageHistory[pageHistory.length - 1] || 'dashboard';
      showPage(prev, false, true);
    }
    function showPage(id, fromMenu, isBack){
      if (!id) id = 'dashboard';
      if (!isBack) {
        const cur = pageHistory[pageHistory.length - 1];
        if (cur !== id) {
          pageHistory.push(id);
          if (pageHistory.length > 30) pageHistory.shift();
        }
      }
      setActiveNav(id);
      if (!fromMenu) {
        try { closeSideMenu(); } catch(_){}
        try { closeAppSidebar(); } catch(_){}
      }
      // Support both old main and new .app-content
      document.querySelectorAll('.app-content > section, main > section').forEach(s => s.classList.add('hidden'));
      document.getElementById(id)?.classList.remove('hidden');
      if (id==='dashboard') renderDashboard();
      if (id==='payment-receipts') { try { renderPaymentReceiptsList(); } catch(e){} }
      if (id==='manage-loans') { updateSelects(); loadLoanForManagement(); }
      if (id==='edit-loan') { updateSelects(); loadLoanForEdit(); }
      if (id==='reports') { updateSelects(); }
      if (id==='register-loan') clearRegisterForm();
      if (id==='backup-delete') { updateSelects(); updateLastBackupInfo(); updateBackupFolderStatus(); try { renderArchivedLoansList(); } catch(_){} }
      if (id==='calendar') { try { renderCalendar(); } catch(_){} }
      updateBackButton();
      // Scroll content to top on page change
      const content = document.getElementById('app-content');
      if (content) content.scrollTop = 0;
    }
    window.goBack = goBack;

    // Global search → re-render deck with filtered loans
    function filterLoansBySearch(q) {
      // value is already in the input; loanMatchesSearch reads it
      deckIndex = 0;
      try { renderLoanCards(); } catch (e) { console.warn(e); }
    }
    window.filterLoansBySearch = filterLoansBySearch;
    window.setDashFilter = setDashFilter;
    window.toggleDashFilterFab = toggleDashFilterFab;

    function updateSelects(){
      const ids = ['manage-loan-select','report-loan-select','delete-loan-select','edit-loan-select'];
      ids.forEach(id=>{
        const sel = document.getElementById(id); if (!sel) return;
        const prev = sel.value;
        sel.innerHTML = '<option value="">-- انتخاب وام --</option>';
        loans.forEach(loan=>{ 
          const opt=document.createElement('option'); 
          opt.value=loan.id; 
          opt.textContent=loan.name; 
          sel.appendChild(opt); 
        });
        if (prev) sel.value = prev;
      });
    }

    // ============================================================
    //  EDIT NAME - FIXED
    // ============================================================
    function startEditName(loanId) {
      editingLoanId = loanId;
      renderDashboard();
      // فوکوس روی input بعد از رندر
      setTimeout(() => {
        const input = document.querySelector(`.loan-name-input[data-loan-id="${loanId}"]`);
        if (input) {
          input.disabled = false;
          input.focus();
          input.select();
        }
      }, 150);
    }

    function saveNameEdit(loanId, input) {
      const newName = input.value.trim();
      if (!newName) {
        showToast('نام وام نمی‌تواند خالی باشد.', 'error');
        const loan = loans.find(l => l.id === loanId);
        if (loan) input.value = loan.name;
        return;
      }
      
      const loan = loans.find(l => l.id === loanId);
      if (loan) {
        loan.name = newName;
        persist();
        editingLoanId = null;
        refreshAllViews('rename-loan');
        showToast('نام وام با موفقیت ویرایش شد.', 'success');
      }
    }

    function cancelNameEdit(loanId) {
      editingLoanId = null;
      renderDashboard();
    }

    // ============================================================
    //  LOAN ICONS (لوگوهای پیش‌فرض بانک‌های ایرانی + سفارشی)
    // ============================================================
    const BANK_ICONS = [
      { id: 'melli',        name: 'ملی',           file: 'icons/banks/melli.svg',        color: '#c8102e' },
      { id: 'mellat',       name: 'ملت',           file: 'icons/banks/mellat.svg',       color: '#e31c23' },
      { id: 'saderat',      name: 'صادرات',        file: 'icons/banks/saderat.svg',      color: '#0066b3' },
      { id: 'tejarat',      name: 'تجارت',         file: 'icons/banks/tejarat.svg',      color: '#0033a0' },
      { id: 'sepah',        name: 'سپه',           file: 'icons/banks/sepah.svg',        color: '#1a5276' },
      { id: 'keshavarzi',   name: 'کشاورزی',       file: 'icons/banks/keshavarzi.svg',   color: '#2e7d32' },
      { id: 'maskan',       name: 'مسکن',          file: 'icons/banks/maskan.svg',       color: '#f57c00' },
      { id: 'refah',        name: 'رفاه',          file: 'icons/banks/refah.svg',        color: '#00838f' },
      { id: 'postbank',     name: 'پست‌بانک',      file: 'icons/banks/postbank.svg',     color: '#f9a825' },
      { id: 'parsian',      name: 'پارسیان',       file: 'icons/banks/parsian.svg',      color: '#6a1b9a' },
      { id: 'pasargad',     name: 'پاسارگاد',      file: 'icons/banks/pasargad.svg',     color: '#1b5e20' },
      { id: 'saman',        name: 'سامان',         file: 'icons/banks/saman.svg',        color: '#0277bd' },
      { id: 'eghtesad',     name: 'اقتصاد نوین',   file: 'icons/banks/eghtesad.svg',     color: '#ad1457' },
      { id: 'sina',         name: 'سینا',          file: 'icons/banks/sina.svg',         color: '#1565c0' },
      { id: 'ayandeh',      name: 'آینده',         file: 'icons/banks/ayandeh.svg',      color: '#00897b' },
      { id: 'shahr',        name: 'شهر',           file: 'icons/banks/shahr.svg',        color: '#e65100' },
      { id: 'day',          name: 'دی',            file: 'icons/banks/day.svg',          color: '#5d4037' },
      { id: 'karafarin',    name: 'کارآفرین',      file: 'icons/banks/karafarin.svg',    color: '#283593' },
      { id: 'khavarm',      name: 'خاورمیانه',     file: 'icons/banks/khavarm.svg',      color: '#00695c' },
      { id: 'iranzamin',    name: 'ایران‌زمین',    file: 'icons/banks/iranzamin.svg',    color: '#4527a0' },
      { id: 'sarmayeh',     name: 'سرمایه',        file: 'icons/banks/sarmayeh.svg',     color: '#37474f' },
      { id: 'tourism',      name: 'گردشگری',       file: 'icons/banks/tourism.svg',      color: '#c62828' },
      { id: 'hekmat',       name: 'حکمت ایرانیان', file: 'icons/banks/hekmat.svg',       color: '#4a148c' },
      { id: 'mehr',         name: 'مهر ایران',     file: 'icons/banks/mehr.svg',         color: '#bf360c' },
      { id: 'resalat',      name: 'رسالت',         file: 'icons/banks/resalat.svg',      color: '#0d47a1' },
      { id: 'kosar',        name: 'کوثر',          file: 'icons/banks/kosar.svg',        color: '#1b5e20' },
      { id: 'ghavamin',     name: 'قوامین',        file: 'icons/banks/ghavamin.svg',     color: '#33691e' },
      { id: 'ansar',        name: 'انصار',         file: 'icons/banks/ansar.svg',        color: '#b71c1c' },
      { id: 'tosee',        name: 'توسعه تعاون',   file: 'icons/banks/tosee.svg',        color: '#006064' },
      { id: 'sanat',        name: 'صنعت و معدن',   file: 'icons/banks/sanat.svg',        color: '#263238' },
      { id: 'toseesaderat', name: 'توسعه صادرات',  file: 'icons/banks/toseesaderat.svg', color: '#01579b' },
      { id: 'blu',          name: 'بلو بانک',      file: 'icons/banks/blu.svg',          color: '#00bcd4' }
    ];

    // آیکون‌های بانک که داخل بکاپ JSON نیز ذخیره می‌شوند؛ در Restore جایگزین نسخه فایل می‌شوند.
    let embeddedBankIconAssets = safeParseJSON('vam_bank_icon_assets', {});
    if (!embeddedBankIconAssets || typeof embeddedBankIconAssets !== 'object') embeddedBankIconAssets = {};

    function getBankIconById(id) {
      if (!id) return null;
      if (String(id).startsWith('custom:')) return { id, custom: true, dataUrl: id.slice(7) };
      const bank = BANK_ICONS.find(b => b.id === id) || null;
      if (!bank) return null;
      const embedded = embeddedBankIconAssets[id];
      if (embedded) return { ...bank, file: embedded, embedded: true };
      return bank;
    }

    async function collectBankIconAssets() {
      const assets = { ...(embeddedBankIconAssets || {}) };
      for (const bank of BANK_ICONS) {
        if (assets[bank.id] && String(assets[bank.id]).startsWith('data:')) continue;
        try {
          const response = await fetch(bank.file, { cache: 'force-cache' });
          if (!response.ok) continue;
          const svg = await response.text();
          if (svg && svg.includes('<svg')) {
            assets[bank.id] = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
          }
        } catch (e) {
          console.warn('Bank icon backup skipped:', bank.id, e);
        }
      }
      // ذخیره برای استفاده آفلاین و بکاپ‌های بعدی
      try {
        if (Object.keys(assets).length) {
          embeddedBankIconAssets = assets;
          localStorage.setItem('vam_bank_icon_assets', JSON.stringify(assets));
        }
      } catch (_) {}
      return assets;
    }


    function sanitizeLoanImageSrc(value) {
      const raw = String(value || '').trim();
      if (!raw) return '';
      // فقط تصاویر داخلی/داده‌ای مجازند؛ URLهای ناشناس یا javascript: هرگز وارد DOM نشوند.
      if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(raw)) return raw;
      if (/^data:image\/svg\+xml;/i.test(raw)) return raw;
      return '';
    }

    function renderLoanIconHTML(iconValue, sizeClass) {
      const cls = sizeClass || 'loan-card-icon';
      if (!iconValue) {
        return `<span class="${cls}" style="background:linear-gradient(135deg,#6366f1,#8b5cf6)"><i class="fa-solid fa-building-columns" style="font-size:0.75rem"></i></span>`;
      }
      if (String(iconValue).startsWith('custom:') || String(iconValue).startsWith('data:')) {
        const src = sanitizeLoanImageSrc(String(iconValue).startsWith('custom:') ? iconValue.slice(7) : iconValue);
        if (!src) return `<span class="${cls}" style="background:linear-gradient(135deg,#6366f1,#8b5cf6)"><i class="fa-solid fa-building-columns" style="font-size:0.75rem"></i></span>`;
        return `<span class="${cls}"><img src="${src}" alt="آیکون" /></span>`;
      }
      const bank = getBankIconById(iconValue);
      if (bank && bank.file) {
        return `<span class="${cls} loan-card-icon-logo"><img src="${bank.file}" alt="${bank.name}" /></span>`;
      }
      return `<span class="${cls}" style="background:linear-gradient(135deg,#6366f1,#8b5cf6)"><i class="fa-solid fa-building-columns" style="font-size:0.75rem"></i></span>`;
    }

    let activeLoanIconTarget = 'edit';

    function updateLoanIconPreview(iconValue, target = activeLoanIconTarget) {
      const prefix = target === 'create' ? 'loan' : 'edit-loan';
      const preview = document.getElementById(prefix + '-icon-preview');
      const hidden = document.getElementById(prefix + '-icon-value');
      if (hidden) hidden.value = iconValue || '';
      if (!preview) return;
      if (!iconValue) {
        preview.innerHTML = '<i class="fa-solid fa-building-columns"></i>';
        preview.style.background = 'linear-gradient(135deg,#6366f1,#8b5cf6)';
        return;
      }
      if (String(iconValue).startsWith('custom:') || String(iconValue).startsWith('data:')) {
        const src = String(iconValue).startsWith('custom:') ? iconValue.slice(7) : iconValue;
        preview.innerHTML = `<img src="${src}" alt="آیکون" />`;
        preview.style.background = '#fff';
        return;
      }
      const bank = getBankIconById(iconValue);
      if (bank && bank.file) {
        preview.innerHTML = `<img src="${bank.file}" alt="${bank.name}" />`;
        preview.style.background = '#fff';
        return;
      }
      preview.innerHTML = '<i class="fa-solid fa-building-columns"></i>';
      preview.style.background = 'linear-gradient(135deg,#6366f1,#8b5cf6)';
    }

    function updateEditIconPreview(iconValue) {
      activeLoanIconTarget = 'edit';
      updateLoanIconPreview(iconValue, 'edit');
    }

    function openLoanIconPicker() {
      const overlay = document.getElementById('loan-icon-picker-overlay');
      const grid = document.getElementById('loan-icon-grid');
      if (!overlay || !grid) return;
      const current = document.getElementById((activeLoanIconTarget === 'create' ? 'loan' : 'edit-loan') + '-icon-value')?.value || '';
      grid.innerHTML = BANK_ICONS.map(b => `
        <button type="button" class="loan-icon-item${current === b.id ? ' selected' : ''}" onclick="selectLoanIcon('${b.id}')" title="${b.name}">
          <span class="loan-icon-badge loan-icon-badge-img"><img src="${b.file}" alt="${b.name}" /></span>
          <span class="loan-icon-item-name">${b.name}</span>
        </button>
      `).join('');
      overlay.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }

    function closeLoanIconPicker() {
      const overlay = document.getElementById('loan-icon-picker-overlay');
      if (overlay) overlay.classList.add('hidden');
      document.body.style.overflow = '';
    }

    function selectLoanIcon(iconId) {
      updateLoanIconPreview(iconId || '', activeLoanIconTarget);
      closeLoanIconPicker();
    }

    function openCreateLoanIconPicker() {
      activeLoanIconTarget = 'create';
      openLoanIconPicker();
    }

    function clearLoanIcon() {
      updateLoanIconPreview('', 'edit');
    }

    function clearCreateLoanIcon() {
      updateLoanIconPreview('', 'create');
    }

    function onCustomLoanIconSelected(event) {
      const file = event.target?.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showToast('فقط فایل تصویر مجاز است.', 'error');
        return;
      }
      if (file.size > 512 * 1024) {
        showToast('حجم تصویر حداکثر ۵۱۲ کیلوبایت باشد.', 'error');
        event.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const img = new Image();
        img.onload = () => {
          const maxSize = 128;
          let w = img.width, h = img.height;
          if (w > maxSize || h > maxSize) {
            if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
            else { w = Math.round(w * maxSize / h); h = maxSize; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/png');
          updateLoanIconPreview('custom:' + compressed, activeLoanIconTarget);
          closeLoanIconPicker();
          showToast('آیکون سفارشی اضافه شد.', 'success');
        };
        img.onerror = () => showToast('خطا در خواندن تصویر.', 'error');
        img.src = dataUrl;
      };
      reader.onerror = () => showToast('خطا در خواندن فایل.', 'error');
      reader.readAsDataURL(file);
      event.target.value = '';
    }

    // ============================================================
    //  EDIT LOAN PAGE
    // ============================================================
    function loadLoanForEdit() {
      const sel = document.getElementById('edit-loan-select');
      const form = document.getElementById('edit-loan-form');
      const empty = document.getElementById('edit-loan-empty');
      if (!sel || !form || !empty) return;
      const id = sel.value;
      if (!id) {
        form.classList.add('hidden');
        empty.classList.remove('hidden');
        return;
      }
      const loan = (loans || []).find(l => String(l.id) === String(id));
      if (!loan) {
        form.classList.add('hidden');
        empty.classList.remove('hidden');
        return;
      }
      empty.classList.add('hidden');
      form.classList.remove('hidden');
      const setVal = (eid, v) => { const el = document.getElementById(eid); if (el) el.value = v; };
      setVal('edit-loan-name', loan.name || '');
      setVal('edit-loan-party', loan.party || '');
      setVal('edit-loan-amount', numberWithCommas(toDisplayAmount(loan.amount || 0)));
      setVal('edit-installment-amount', numberWithCommas(toDisplayAmount(loan.installmentAmount || 0)));
      setVal('edit-installment-count', toPersianDigits(String(loan.installmentCount || '')));
      setVal('edit-start-date', formatDateToPersian(loan.startDate) || loan.startDate || '');
      updateEditIconPreview(loan.icon || '');
    }

    function resetEditLoanForm() {
      const sel = document.getElementById('edit-loan-select');
      if (sel) sel.value = '';
      const form = document.getElementById('edit-loan-form');
      const empty = document.getElementById('edit-loan-empty');
      if (form) form.classList.add('hidden');
      if (empty) empty.classList.remove('hidden');
      updateEditIconPreview('');
    }

    function saveLoanEdit() {
      const sel = document.getElementById('edit-loan-select');
      const id = sel?.value;
      if (!id) return showToast('وامی انتخاب نشده است.', 'error');
      const loan = (loans || []).find(l => String(l.id) === String(id));
      if (!loan) return showToast('وام یافت نشد.', 'error');

      const name = (document.getElementById('edit-loan-name')?.value || '').trim();
      const party = (document.getElementById('edit-loan-party')?.value || '').trim();
      const amount = toStoredAmount(parseNumber(document.getElementById('edit-loan-amount')?.value));
      const installmentAmount = toStoredAmount(parseNumber(document.getElementById('edit-installment-amount')?.value));
      const installmentCount = parseNumber(document.getElementById('edit-installment-count')?.value) || 0;
      const startDateStr = parseUserDateInput(document.getElementById('edit-start-date')?.value?.trim() || '')
        || loan.startDate || '';
      const iconVal = document.getElementById('edit-loan-icon-value')?.value || '';

      if (!name) return showToast('نام وام نمی‌تواند خالی باشد.', 'error');
      if (amount <= 0) return showToast('مبلغ وام نامعتبر است.', 'error');
      if (installmentAmount <= 0) return showToast('مبلغ قسط نامعتبر است.', 'error');
      if (installmentCount <= 0) return showToast('تعداد اقساط نامعتبر است.', 'error');
      if (!startDateStr) return showToast('تاریخ شروع نامعتبر است.', 'error');

      const prevCount = Number(loan.installmentCount) || 0;
      const prevStart = String(loan.startDate || '');
      const prevInstAmt = Number(loan.installmentAmount) || 0;
      const structureChanged =
        installmentCount !== prevCount ||
        startDateStr !== prevStart ||
        installmentAmount !== prevInstAmt;

      loan.name = name;
      loan.party = party;
      loan.amount = amount;
      loan.installmentAmount = installmentAmount;
      loan.installmentCount = installmentCount;
      loan.startDate = startDateStr;
      loan.icon = iconVal || '';

      // همگام‌سازی اقساط با تعداد/تاریخ شروع/مبلغ جدید — حفظ وضعیت پرداخت تا جای ممکن
      if (structureChanged) {
        const oldInsts = Array.isArray(loan.installments) ? loan.installments : [];
        const startDate = parseLocalDate(startDateStr);
        const rebuilt = [];
        for (let i = 0; i < installmentCount; i++) {
          const number = i + 1;
          const prev = oldInsts.find(x => Number(x.number) === number) || oldInsts[i] || null;
          let dateStr = '';
          try {
            if (startDate && !Number.isNaN(startDate.getTime())) {
              dateStr = toLocalISO(addMonths(startDate, i)) || '';
            }
          } catch (_) {}
          const wasPaid = prev ? !!prev.paid : false;
          rebuilt.push({
            number,
            date: dateStr,
            amount: installmentAmount,
            paid: wasPaid,
            paidAt: wasPaid ? (prev && prev.paidAt ? prev.paidAt : null) : null,
            paidFrom: wasPaid ? (prev?.paidFrom || null) : null,
            receiptNo: wasPaid ? (prev?.receiptNo || null) : null
          });
        }
        loan.installments = rebuilt;
      }

      persist();
      invalidateLoanStats(loan.id);
      refreshAllViews('edit-loan');
      if (typeof v8Log === 'function') v8Log('edit', 'وام ویرایش شد', loan.name || '');
      showToast('وام با موفقیت ویرایش شد.', 'success');
    }

    // ============================================================
    //  LOAN CALCULATOR (فرمول بانکی / قرض‌الحسنه — مشابه باحساب)
    // ============================================================
    let lastCalcResult = null;

    /**
     * اقساط مساوی بانکی (PMT):
     * i = نرخ هر دوره، A = P * i(1+i)^n / ((1+i)^n - 1)
     * نرخ هر دوره از سود سالانه و فاصله اقساط به‌ماه به‌دست می‌آید.
     */
    function calcBankEqualInstallment(principal, annualRatePercent, count, intervalMonths) {
      const P = Number(principal) || 0;
      const n = Math.floor(Number(count) || 0);
      const m = Math.max(1, Number(intervalMonths) || 1);
      const annual = Number(annualRatePercent) || 0;
      if (P <= 0 || n <= 0) return null;
      if (annual <= 0) {
        const inst = Math.floor(P / n);
        const totalPay = P;
        return { installment: inst, totalPay, extra: 0, type: 'bank', exactLastInstallment: P - inst * (n - 1) };
      }
      const i = (annual / 100) * (m / 12); // نرخ هر دوره
      let inst;
      if (Math.abs(i) < 1e-12) {
        inst = P / n;
      } else {
        const factor = Math.pow(1 + i, n);
        inst = P * (i * factor) / (factor - 1);
      }
      inst = Math.round(inst);
      const totalPay = inst * n;
      return { installment: inst, totalPay, extra: totalPay - P, type: 'bank' };
    }

    /**
     * قرض‌الحسنه با کارمزد (روش استاندارد بانکی ایران — مشابه باحساب):
     * - هر سال: ۱ قسط کارمزد + ۱۱ قسط اصل
     * - تعداد اقساط اصل = n − years
     * - قسط اصل = اصل ÷ تعداد اقساط اصل
     * - کارمزد هر سال = نرخ٪ × مانده اصل در ابتدای آن سال
     * - کارمزد در اقساط ۱، ۱۳، ۲۵، ... دریافت می‌شود
     */
    function calcQarzInstallment(principal, feeRatePercent, count, intervalMonths) {
      const P = Number(principal) || 0;
      const n = Math.floor(Number(count) || 0);
      const m = Math.max(1, Number(intervalMonths) || 1);
      const fee = Number(feeRatePercent) || 0;
      if (P <= 0 || n <= 0) return null;

      // فقط برای فاصله ماهانه استاندارد (۱ ماه) روش بانکی اعمال می‌شود
      if (m !== 1) {
        // fallback برای فاصله غیرماهانه؛ با نرخ صفر جمع اقساط باید دقیقاً برابر اصل باشد.
        const years = (n * m) / 12;
        const totalFee = Math.round(P * (fee / 100) * years);
        const totalPay = P + totalFee;
        const base = Math.floor(totalPay / n);
        const exactLast = totalPay - base * (n - 1);
        return { installment: base, totalPay, extra: totalFee, type: 'qarz', totalFee, schedule: null, exactLastInstallment: exactLast };
      }

      // با کارمزد صفر هیچ قسط کارمزدی نداریم؛ تمام اقساط برای اصل وام هستند.
      if (fee <= 0) {
        const base = Math.floor(P / n);
        const schedule = [];
        let remaining = P;
        for (let i = 1; i <= n; i++) {
          const amount = i === n ? remaining : base;
          remaining = Math.max(0, remaining - amount);
          schedule.push({ number:i, amount, isFee:false, feePart:0, principalPart:amount, remainingAfter:remaining });
        }
        return { installment: base, totalPay: P, extra: 0, type:'qarz', totalFee:0, schedule, principalCount:n, years:Math.ceil(n/12) };
      }

      const years = Math.ceil(n / 12);
      const principalCount = n - years; // تعداد اقساط اصل
      if (principalCount <= 0) return null;

      const principalInst = Math.floor(P / principalCount); // مبلغ پایه قسط اصل؛ قسط آخر با مانده دقیق می‌شود

      // ساخت جدول اقساط و محاسبه کارمزد بر اساس مانده
      const schedule = [];
      let remaining = P;
      let totalFee = 0;
      let totalPay = 0;
      let principalPaidCount = 0;

      for (let i = 1; i <= n; i++) {
        const isFeeInstallment = ((i - 1) % 12 === 0); // اقساط ۱، ۱۳، ۲۵، ...
        let amount = 0;
        let feePart = 0;
        let principalPart = 0;

        if (isFeeInstallment && fee > 0) {
          // کارمزد سال جاری بر اساس مانده فعلی
          feePart = Math.round(remaining * (fee / 100));
          amount = feePart;
          totalFee += feePart;
        } else {
          // قسط اصل
          principalPart = principalInst;
          // آخرین قسط اصل را تنظیم کن تا جمع دقیقاً P شود
          if (principalPaidCount === principalCount - 1) {
            principalPart = remaining; // باقی‌مانده دقیق
          }
          amount = principalPart;
          remaining -= principalPart;
          if (remaining < 0) remaining = 0;
          principalPaidCount++;
        }

        totalPay += amount;
        schedule.push({
          number: i,
          amount,
          isFee: isFeeInstallment && fee > 0,
          feePart,
          principalPart,
          remainingAfter: Math.max(0, remaining)
        });
      }

      // مبلغ نمایشی «هر قسط» = قسط اصل (چون در باحساب هم همین‌طور نشان داده می‌شود)
      return {
        installment: principalInst,
        totalPay,
        extra: totalFee,
        type: 'qarz',
        totalFee,
        schedule,
        principalCount,
        years
      };
    }

    function runLoanCalculator() {
      const type = document.getElementById('calc-loan-type')?.value || 'bank';
      const amount = toStoredAmount(parseNumber(document.getElementById('calc-amount')?.value));
      const rate = parseNumber(document.getElementById('calc-rate')?.value);
      const count = parseNumber(document.getElementById('calc-count')?.value);
      const interval = parseNumber(document.getElementById('calc-interval')?.value) || 1;

      if (amount <= 0) return showToast('مبلغ وام را وارد کنید.', 'error');
      if (count <= 0) return showToast('تعداد اقساط را وارد کنید.', 'error');
      if (type === 'bank' && rate < 0) return showToast('نرخ سود نامعتبر است.', 'error');
      if (type === 'qarz' && rate < 0) return showToast('نرخ کارمزد نامعتبر است.', 'error');

      const result = type === 'qarz'
        ? calcQarzInstallment(amount, rate, count, interval)
        : calcBankEqualInstallment(amount, rate, count, interval);

      if (!result) return showToast('محاسبه ناموفق بود.', 'error');

      lastCalcResult = {
        ...result,
        amount,
        rate,
        count: Math.floor(count),
        interval,
        type
      };

      const box = document.getElementById('calc-result-box');
      if (box) box.classList.remove('hidden');
      const elInst = document.getElementById('calc-out-installment');
      const elTotal = document.getElementById('calc-out-total');
      const elExtra = document.getElementById('calc-out-extra');
      const elExtraLabel = document.getElementById('calc-out-extra-label');
      const elHint = document.getElementById('calc-out-hint');
      if (elInst) elInst.textContent = formatMoney(result.installment);
      if (elTotal) elTotal.textContent = formatMoney(result.totalPay);
      if (elExtra) elExtra.textContent = formatMoney(Math.max(0, result.extra));
      if (elExtraLabel) elExtraLabel.textContent = type === 'qarz' ? 'جمع کارمزد' : 'جمع سود';

      // نمایش اقساط کارمزد برای قرض‌الحسنه (مشابه باحساب)
      let feeScheduleHtml = '';
      if (type === 'qarz' && result.schedule && result.schedule.length) {
        const feeRows = result.schedule.filter(s => s.isFee && s.feePart > 0);
        if (feeRows.length) {
          feeScheduleHtml = '<div class="mt-3 text-xs border-t border-indigo-200/50 pt-3">' +
            '<div class="font-semibold text-slate-600 mb-1">به جز اقساط زیر (کارمزد سالانه):</div>' +
            feeRows.map(s =>
              '<div class="flex justify-between py-0.5"><span>مبلغ قسط ' + toPersianDigits(s.number) + '</span>' +
              '<span class="font-medium">' + formatMoney(s.amount) + '</span></div>'
            ).join('') +
            '</div>';
        }
      }

      if (elHint) {
        if (type === 'qarz') {
          elHint.innerHTML =
            'فرمول استاندارد بانکی: هر سال ۱ قسط کارمزد (بر اساس مانده) + ۱۱ قسط اصل. ' +
            'قسط اصل = اصل ÷ (تعداد اقساط − تعداد سال). می‌توانید قبل از ثبت، مبلغ قسط را دستی اصلاح کنید.' +
            feeScheduleHtml;
        } else {
          elHint.textContent = 'فرمول بانکی اقساط مساوی (PMT) با نرخ متناسب فاصله اقساط. ارقام رند شده‌اند؛ در صورت نیاز در فرم ثبت ویرایش کنید.';
        }
      }
      showToast('محاسبه انجام شد. در صورت تأیید، به فرم ثبت منتقل می‌شود.', 'success');
    }

    function applyCalcToRegisterForm() {
      if (!lastCalcResult) return showToast('ابتدا محاسبه را انجام دهید.', 'warning');
      const amountEl = document.getElementById('loan-amount');
      const instEl = document.getElementById('installment-amount');
      const countEl = document.getElementById('installment-count');
      if (amountEl) {
        amountEl.value = toPersianDigits(numberWithCommas(lastCalcResult.amount));
      }
      if (instEl) {
        instEl.value = toPersianDigits(numberWithCommas(lastCalcResult.installment));
      }
      if (countEl) {
        countEl.value = toPersianDigits(String(lastCalcResult.count));
      }
      // فوکوس روی نام وام برای تکمیل
      document.getElementById('loan-name')?.focus();
      showToast('مقادیر به فرم ثبت منتقل شد. در صورت نیاز ویرایش کنید و سپس ثبت کنید.', 'success');
      // اسکرول به فرم ثبت
      try {
        document.getElementById('loan-name')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (_) {}
    }

    function clearLoanCalculator() {
      lastCalcResult = null;
      ['calc-amount', 'calc-rate', 'calc-count'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      const box = document.getElementById('calc-result-box');
      if (box) box.classList.add('hidden');
      showToast('محاسبه پاک شد.', 'info');
    }

    // به‌روزرسانی برچسب نرخ هنگام تغییر نوع
    document.addEventListener('change', (e) => {
      if (e.target && e.target.id === 'calc-loan-type') {
        const label = document.getElementById('calc-rate-label');
        if (!label) return;
        const isQarz = e.target.value === 'qarz';
        // حفظ input داخل label
        const input = document.getElementById('calc-rate');
        label.childNodes[0].textContent = isQarz ? 'نرخ کارمزد سالانه (٪) ' : 'نرخ سود سالانه (٪) ';
        if (input && !input.value) input.placeholder = isQarz ? 'مثلاً: ۴' : 'مثلاً: ۱۸';
      }
    });

    // ============================================================
    //  REGISTER
    // ============================================================
    function clearRegisterForm(){
      ['loan-name','loan-party','loan-amount','installment-amount','installment-count','start-date'].forEach(id=>{ 
        const el=document.getElementById(id); 
        if(el) el.value=''; 
      });
      document.getElementById('installment-table-body').innerHTML='';
      currentLoan = null;
      updateLoanIconPreview('', 'create');
      updateSelects();
    }

    function createInstallmentTable(){
      const name = document.getElementById('loan-name').value.trim();
      const party = document.getElementById('loan-party')?.value.trim() || '';
      const amount = toStoredAmount(parseNumber(document.getElementById('loan-amount').value));
      const installmentAmount = toStoredAmount(parseNumber(document.getElementById('installment-amount').value));
      const installmentCount = parseNumber(document.getElementById('installment-count').value) || 0;
      const rawDate = document.getElementById('start-date').value.trim();
      const startDateStr = parseUserDateInput(rawDate);

      if (!name) return showToast('نام وام را وارد کنید.', 'error');
      if (amount<=0) return showToast('مبلغ وام معتبر نیست.', 'error');
      if (installmentAmount<=0) return showToast('مبلغ قسط معتبر نیست.', 'error');
      if (installmentCount<=0) return showToast('تعداد اقساط معتبر نیست.', 'error');
      if (!startDateStr) return showToast('فرمت تاریخ نامعتبر است. مثال: ۰۱-۰۱-۱۴۰۵ یا ۱۴۰۵/۰۱/۰۱', 'error');
      const startDate = parseLocalDate(startDateStr);
      if (isNaN(startDate.getTime())) return showToast('تاریخ شروع نامعتبر است.', 'error');

      // نمایش تاریخ نرمال‌شده با ارقام فارسی در فیلد
      const startDateEl = document.getElementById('start-date');
      if (startDateEl) startDateEl.value = formatDateToPersian(startDateStr);

      currentLoan = {
        id: currentLoan?.id || Date.now(),
        name, party, amount, installmentAmount, installmentCount, startDate: startDateStr,
        icon: document.getElementById('loan-icon-value')?.value || currentLoan?.icon || '',
        installments: []
      };

      // اگر محاسبه قرض‌الحسنه با جدول اقساط موجود باشد:
      // - اقساط کارمزد: مبلغ محاسبه‌شده (ثابت)
      // - اقساط اصل: مبلغ ویرایش‌شده‌ی فرم (installmentAmount)
      const useQarzSchedule = lastCalcResult &&
        lastCalcResult.type === 'qarz' &&
        Array.isArray(lastCalcResult.schedule) &&
        lastCalcResult.schedule.length === installmentCount &&
        lastCalcResult.amount === amount;

      for (let i = 0; i < installmentCount; i++) {
        const d = addMonths(startDate, i);
        let amt = installmentAmount;
        if (useQarzSchedule) {
          const s = lastCalcResult.schedule[i];
          // اگر قسط کارمزد است → مبلغ کارمزد محاسبه‌شده؛ وگرنه مبلغ ویرایش‌شده‌ی اصل
          amt = (s && s.isFee) ? (s.amount || 0) : installmentAmount;
        }
        currentLoan.installments.push({
          number: i + 1,
          date: toLocalISO(d),
          amount: amt,
          paid: false
        });
      }

      const tbody = document.getElementById('installment-table-body');
      tbody.innerHTML = (currentLoan.installments || []).map(inst=>`
        <tr class="border-b border-white/30 hover:bg-white/30">
          <td class="p-2 text-slate-700 text-center">${toPersianDigits(numberWithCommas(inst.number))}</td>
          <td class="p-2 text-slate-700 text-center">${formatDateToPersian(inst.date)}</td>
          <td class="p-2 text-slate-700 text-center">${formatMoney(inst.amount)}</td>
        </tr>`).join('');
      
      showToast('جدول اقساط با موفقیت ساخته شد.', 'success');
    }

    function saveLoanRegister(resetForm){
      const name = document.getElementById('loan-name').value.trim();
      const amount = toStoredAmount(parseNumber(document.getElementById('loan-amount').value));
      const installmentAmount = toStoredAmount(parseNumber(document.getElementById('installment-amount').value));
      const installmentCount = parseNumber(document.getElementById('installment-count').value) || 0;
      const startDateStr = parseUserDateInput(document.getElementById('start-date').value.trim())
        || (currentLoan && currentLoan.startDate) || '';

      if (!name || amount<=0 || installmentAmount<=0 || installmentCount<=0 || !startDateStr) {
        return showToast('اطلاعات فرم کامل نیست.', 'error');
      }

      const party = (document.getElementById('loan-party')?.value || '').trim() || (currentLoan?.party || '');
      const loan = {
        id: currentLoan?.id || Date.now(),
        name, party, amount, installmentAmount, installmentCount, startDate: startDateStr,
        installments: currentLoan?.installments?.length ? currentLoan.installments : [],
        icon: document.getElementById('loan-icon-value')?.value || currentLoan?.icon || ''
      };

      // اگر کاربر بعد از ساخت جدول، تعداد/مبلغ/تاریخ را تغییر داده باشد،
      // قبل از ذخیره جدول اقساط را با فرم فعلی همگام می‌کنیم.
      const firstInstDate = loan.installments?.[0]?.date || '';
      const staleTable = loan.installments.length !== installmentCount
        || firstInstDate !== startDateStr
        || Number(currentLoan?.installmentAmount || 0) !== installmentAmount
        || Number(loan.installments?.[0]?.amount || 0) <= 0;
      if (staleTable) {
        createInstallmentTable();
        loan.installments = currentLoan?.installments?.length ? currentLoan.installments : [];
      }

      const idx = loans.findIndex(l => String(l.id) === String(loan.id));
      if (idx>-1) loans[idx]=loan; else {
        loans.push(loan);
        loanOrder.push(loan.id);
      }
      persist();
      invalidateLoanStats(loan.id);
      refreshAllViews('save-loan');
      if (typeof v8Log === 'function') v8Log('create', 'وام جدید ثبت شد', loan.name || '');
      showToast('وام با موفقیت ذخیره شد.', 'success');
      if (resetForm) clearRegisterForm();
    }

    // ساخت جدول اقساط + ذخیره در یک مرحله
    function createAndSaveLoan() {
      createInstallmentTable();
      if (!currentLoan || !(currentLoan.installments || []).length) return;
      saveLoanRegister(true);
    }

    // ============================================================
    //  DRAG & DROP
    // ============================================================
    function initDragDrop() {
      const cards = document.querySelectorAll('.glass-card[draggable="true"]');
      
      cards.forEach(card => {
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('dragenter', handleDragEnter);
        card.addEventListener('dragleave', handleDragLeave);
        card.addEventListener('drop', handleDrop);
      });
    }

    function handleDragStart(e) {
      draggedElement = this;
      this.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', this.innerHTML);
    }

    function handleDragEnd(e) {
      this.classList.remove('dragging');
      document.querySelectorAll('.glass-card.drag-over').forEach(el => el.classList.remove('drag-over'));
    }

    function handleDragOver(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }

    function handleDragEnter(e) {
      e.preventDefault();
      if (this !== draggedElement) {
        this.classList.add('drag-over');
      }
    }

    function handleDragLeave(e) {
      this.classList.remove('drag-over');
    }

    function handleDrop(e) {
      e.preventDefault();
      this.classList.remove('drag-over');
      
      if (draggedElement && this !== draggedElement) {
        const container = document.getElementById('loans-cards-container');
        const children = Array.from(container.children);
        const fromIndex = children.indexOf(draggedElement);
        const toIndex = children.indexOf(this);
        
        if (fromIndex < 0 || toIndex < 0) {
          draggedElement = null;
          return;
        }
        
        if (fromIndex < toIndex) {
          this.parentNode.insertBefore(draggedElement, this.nextSibling);
        } else {
          this.parentNode.insertBefore(draggedElement, this);
        }
        
        // Re-read order from DOM after move (fixes incorrect saved order)
        const newOrder = Array.from(container.children)
          .map(card => card.dataset.loanId)
          .filter(id => id != null && id !== '');
        // حفظ نوع id اصلی در صورت امکان
        loanOrder = newOrder.map(id => {
          const n = Number(id);
          return Number.isFinite(n) && String(n) === String(id) ? n : id;
        });
        
        persist();
        if (typeof v8Log === 'function') v8Log('reorder', 'ترتیب وام‌ها تغییر کرد');
        showToast('ترتیب کارت‌ها ذخیره شد.', 'success');
      }
      
      draggedElement = null;
    }

    // ============================================================
    //  MANAGE
    // ============================================================
    function loadLoanForManagement(){
      const sel = document.getElementById('manage-loan-select');
      const id = sel.value;
      const tbody = document.getElementById('manage-installment-table-body');
      const listEl = document.getElementById('manage-installments-list');
      if (!id){
        currentLoan=null;
        if (tbody) tbody.innerHTML='';
        if (listEl) listEl.innerHTML='';
        return;
      }
      currentLoan = loans.find(l=> String(l.id) === String(id));
      // پاک کردن فیلتر جستجو هنگام انتخاب وام جدید تا اسکرول درست کار کند
      const filterEl = document.getElementById('manage-filter');
      if (filterEl) filterEl.value = '';
      updateManageInstallmentTable(true);
    }

    const debouncedUpdateManageInstallmentTable = debounce(updateManageInstallmentTable, 300);

    function updateManageInstallmentTable(autoScroll = false){
      const tbody = document.getElementById('manage-installment-table-body');
      const listEl = document.getElementById('manage-installments-list');
      const q = (document.getElementById('manage-filter').value || '').trim();
      if (!currentLoan){
        if (tbody) tbody.innerHTML='';
        if (listEl) listEl.innerHTML='';
        return;
      }

      const today=v8TodaySummary ? todayISO() : '';
      const list = (currentLoan.installments || []).filter(inst => {
        if(!q) return true;
        if(q==='__V8_OVERDUE__') return !inst.paid && isOverdue(inst);
        if(q==='__V8_TODAY__') return !inst.paid && inst.date===today;
        if(q==='__V8_WEEK__'){ const d=parseLocalDate(inst.date), t=parseLocalDate(today); const diff=(d-t)/86400000; return !inst.paid && diff>=0 && diff<=7; }
        return String(inst.number).includes(q) || String(inst.date).includes(q) || formatDateToPersian(inst.date).includes(q);
      });

      // قسط هدف برای اسکرول: اولویت با سررسیدشده، بعد اولین پرداخت‌نشده
      let targetNum = null;
      if (autoScroll && !q) {
        const overdueInst = (currentLoan.installments || []).find(i => !i.paid && isOverdue(i));
        const nextUnpaid = (currentLoan.installments || []).find(i => !i.paid);
        targetNum = overdueInst ? overdueInst.number : (nextUnpaid ? nextUnpaid.number : null);
      }

      // --- جدول دسکتاپ ---
      if (tbody) {
        const fragment = document.createDocumentFragment();
        list.forEach(inst=>{
          const overdue = isOverdue(inst);
          let rowCls = 'border-b border-white/30 hover:bg-white/30';
          if (inst.paid) rowCls += ' bg-emerald-50/50';
          else if (overdue) rowCls += ' animate-pulseDanger';
          
          let statusBadge = '';
          if (inst.paid) {
            statusBadge = '<span class="status-badge status-badge-paid">پرداخت‌شده</span>';
          } else if (overdue) {
            statusBadge = '<span class="status-badge status-badge-overdue">سررسید شده</span>';
          } else {
            statusBadge = '<span class="status-badge status-badge-unpaid">پرداخت‌نشده</span>';
          }
          
          const row = document.createElement('tr');
          row.className = rowCls;
          row.dataset.instNum = String(inst.number);
          row.innerHTML = `
            <td class="p-3 text-slate-700">${toPersianDigits(numberWithCommas(inst.number))}</td>
            <td class="p-3 text-slate-700">${formatDateToPersian(inst.date)}</td>
            <td class="p-3 text-slate-700" data-inst-amount="${inst.number}" onclick="startEditInstAmount(${inst.number})" title="کلیک برای ویرایش مبلغ" style="cursor:pointer;">${formatMoney(inst.amount)} <i class="fa-solid fa-pen text-xs text-slate-400 ms-1"></i></td>
            <td class="p-3">${statusBadge}</td>
            <td class="p-3">
              <button class="btn-glass text-xs px-3 py-1.5 ${inst.paid?'opacity-50 cursor-not-allowed':'btn-glass-success'}" ${inst.paid?'disabled':''} onclick="payInstallment(${inst.number})">
                <i class="fa-solid fa-check me-1"></i>ثبت
              </button>
              <button class="btn-glass text-xs px-3 py-1.5" onclick="toggleInstallment(${inst.number})">
                <i class="fa-solid fa-rotate me-1"></i>تغییر
              </button>
            </td>
          `;
          fragment.appendChild(row);
        });
        tbody.innerHTML = '';
        tbody.appendChild(fragment);
      }

      // --- کارت‌های موبایل ---
      if (listEl) {
        const cardsFrag = document.createDocumentFragment();
        if (list.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'text-center text-glass-light py-8 text-sm';
          empty.textContent = currentLoan ? 'قسطی یافت نشد.' : 'ابتدا یک وام انتخاب کنید.';
          cardsFrag.appendChild(empty);
        } else {
          list.forEach(inst => {
            const overdue = isOverdue(inst);
            let cardCls = 'inst-card';
            if (inst.paid) cardCls += ' paid';
            else if (overdue) cardCls += ' overdue';

            let statusBadge = '';
            if (inst.paid) {
              statusBadge = '<span class="status-badge status-badge-paid">پرداخت‌شده</span>';
            } else if (overdue) {
              statusBadge = '<span class="status-badge status-badge-overdue">سررسید شده</span>';
            } else {
              statusBadge = '<span class="status-badge status-badge-unpaid">پرداخت‌نشده</span>';
            }

            const card = document.createElement('div');
            card.className = cardCls;
            card.dataset.instNum = String(inst.number);
            card.innerHTML = `
              <div class="inst-card-top">
                <span class="inst-card-num">قسط ${toPersianDigits(numberWithCommas(inst.number))}</span>
                ${statusBadge}
              </div>
              <div class="inst-card-date"><i class="fa-regular fa-calendar me-1"></i>${formatDateToPersian(inst.date)}</div>
              <div class="inst-card-amount" data-inst-amount="${inst.number}" onclick="startEditInstAmount(${inst.number})" title="کلیک برای ویرایش" style="cursor:pointer;">${formatMoney(inst.amount)} <i class="fa-solid fa-pen text-xs text-slate-400"></i></div>
              <div class="inst-card-actions">
                <button class="btn-glass ${inst.paid?'opacity-50 cursor-not-allowed':'btn-glass-success'}" ${inst.paid?'disabled':''} onclick="payInstallment(${inst.number})">
                  <i class="fa-solid fa-check me-1"></i>ثبت پرداخت
                </button>
                <button class="btn-glass" onclick="toggleInstallment(${inst.number})">
                  <i class="fa-solid fa-rotate me-1"></i>تغییر وضعیت
                </button>
              </div>
            `;
            cardsFrag.appendChild(card);
          });
        }
        listEl.innerHTML = '';
        listEl.appendChild(cardsFrag);
      }

      // اسکرول خودکار به قسطی که باید پرداخت شود
      if (targetNum != null) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            const isMobile = window.innerWidth < 768;
            const selector = isMobile
              ? `#manage-installments-list [data-inst-num="${targetNum}"]`
              : `#manage-installment-table-body tr[data-inst-num="${targetNum}"]`;
            const el = document.querySelector(selector);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.style.transition = 'box-shadow 0.3s ease';
              el.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.45)';
              setTimeout(() => { el.style.boxShadow = ''; }, 1800);
            }
          }, 80);
        });
      }
    }

    async function payInstallment(num){
      if (!currentLoan) return;
      const inst = (currentLoan.installments || []).find(x=>x.number===num);
      if (!inst || inst.paid) return;
      const msg = `پرداخت قسط شماره ${toPersianDigits(num)} وام «${currentLoan.name}»\nمبلغ: ${formatMoney(inst.amount)}\nتاریخ سررسید: ${formatDateToPersian(inst.date)}`;
      const ok = await showConfirmGlass(msg, { okText: 'ثبت پرداخت', cancelText: 'انصراف' });
      if (!ok) return;
      inst.paid = true;
      inst.paidAt = new Date().toISOString();
      inst.paidFrom = null;
      persist();
      invalidateLoanStats(currentLoan.id);
      refreshAllViews('payment');
      if (typeof v8Log === 'function') v8Log('payment', `قسط ${toPersianDigits(num)} پرداخت شد`, currentLoan.name || '');
      showToast(`قسط شماره ${toPersianDigits(num)} پرداخت شد.`, 'success');
    }
    
    function toggleInstallment(num){
      if (!currentLoan) return;
      const inst = (currentLoan.installments || []).find(x=>x.number===num);
      if (inst){ 
        inst.paid = !inst.paid; 
        inst.paidAt = inst.paid ? new Date().toISOString() : null;
        if (!inst.paid) { inst.paidFrom = null; inst.receiptNo = null; }
        persist();
        invalidateLoanStats(currentLoan.id);
        refreshAllViews('payment-toggle');
        if (typeof v8Log === 'function') v8Log('toggle', `وضعیت قسط ${toPersianDigits(num)} تغییر کرد`, currentLoan.name || '');
        showToast(`وضعیت قسط ${toPersianDigits(num)} تغییر کرد.`, 'info');
      }
    }

    function saveManage(){
      if (!currentLoan) return showToast('ابتدا یک وام انتخاب کنید.', 'error');
      const idx = loans.findIndex(l => String(l.id) === String(currentLoan.id));
      if (idx>-1) loans[idx] = currentLoan;
      persist(); 
      invalidateLoanStats(currentLoan.id);
      refreshAllViews('manage-save');
      showToast('تغییرات اقساط ذخیره شد.', 'success');
    }

    async function batchPayInstallments(){
      if (!currentLoan) return showToast('یک وام انتخاب کنید.', 'error');
      const startRaw = document.getElementById('batch-pay-start')?.value;
      const countRaw = document.getElementById('batch-pay-count')?.value;
      let start = parseNumber(startRaw);
      const count = parseNumber(countRaw);
      if (!count || count <= 0) return showToast('تعداد اقساط نامعتبر است.', 'error');
      if (!start || start <= 0) {
        const idx = (currentLoan.installments || []).findIndex(x => !x.paid);
        start = idx >= 0 ? (currentLoan.installments[idx].number || (idx + 1)) : 1;
      }
      const ok = await showConfirmGlass(
        `پرداخت دسته‌ای ${toPersianDigits(count)} قسط از شماره ${toPersianDigits(start)}\nوام: ${currentLoan.name}`,
        { okText: 'ثبت پرداخت', cancelText: 'انصراف' }
      );
      if (!ok) return;
      let paid = 0;
      const paidIso = new Date().toISOString();
      (currentLoan.installments || []).forEach(inst => {
        if (inst.number >= start && !inst.paid && paid < count) {
          inst.paid = true;
          inst.paidAt = paidIso;
          inst.paidFrom = null;
          paid++;
        }
      });
      persist();
      updateManageInstallmentTable();
      renderDashboard();
      if (paid > 0) {
        if (typeof v8Log === 'function') v8Log('payment', `${toPersianDigits(paid)} قسط دسته‌ای پرداخت شد`, currentLoan.name || '');
      }
      showToast(`${toPersianDigits(paid)} قسط با موفقیت پرداخت شد.`, 'success');
    }

    // ============================================================
    //  REPORTS
    // ============================================================
    function showLoanReport(){
      const sel = document.getElementById('report-loan-select');
      const id = sel.value;
      document.getElementById('loan-report').classList.add('hidden');
      document.getElementById('all-loans-report').classList.add('hidden');
      if (!id) return;
      currentLoan = loans.find(l=> String(l.id) === String(id));
      if (!currentLoan) return;

      const paidCount = (currentLoan.installments || []).filter(i=>i.paid).length;
      const remainingCount = Math.max(currentLoan.installmentCount - paidCount, 0);
      const progress = (currentLoan.installmentCount > 0
        ? ((paidCount / currentLoan.installmentCount) * 100)
        : 0).toFixed(1);
      const settleDate = getLoanSettlementDate(currentLoan);

      document.getElementById('report-loan-name').textContent = currentLoan.name;
      document.getElementById('report-loan-amount').textContent = formatMoney(currentLoan.amount);
      document.getElementById('report-installment-amount').textContent = formatMoney(currentLoan.installmentAmount);
      document.getElementById('report-paid-count').textContent = toPersianDigits(numberWithCommas(paidCount));
      document.getElementById('report-remaining-count').textContent = toPersianDigits(numberWithCommas(remainingCount));
      document.getElementById('report-progress').textContent = toPersianDigits(progress) + '%';
      document.getElementById('report-end-date').textContent = settleDate ? formatDateToPersian(settleDate) : '—';

      const tbody = document.getElementById('report-installments-body');
      tbody.innerHTML = (currentLoan.installments || []).map(inst=>{
        const overdue = isOverdue(inst);
        let rowCls = 'border-b border-white/30 hover:bg-white/30';
        if (inst.paid) rowCls += ' bg-emerald-50/50';
        else if (overdue) rowCls += ' animate-pulseDanger';
        
        let statusBadge = '';
        if (inst.paid) {
          statusBadge = '<span class="status-badge status-badge-paid">پرداخت‌شده</span>';
        } else if (overdue) {
          statusBadge = '<span class="status-badge status-badge-overdue">سررسید شده</span>';
        } else {
          statusBadge = '<span class="status-badge status-badge-unpaid">پرداخت‌نشده</span>';
        }
        
        return `
          <tr class="${rowCls}">
            <td class="p-2 md:p-3 text-slate-700 text-center">${toPersianDigits(numberWithCommas(inst.number))}</td>
            <td class="p-2 md:p-3 text-slate-700 text-center whitespace-nowrap">${formatDateToPersian(inst.date)}</td>
            <td class="p-2 md:p-3 text-slate-700 text-center whitespace-nowrap">${formatMoney(inst.amount)}</td>
            <td class="p-2 md:p-3 text-center">${statusBadge}</td>
            <td class="p-2 md:p-3 text-slate-700 text-center whitespace-nowrap">${formatPaidAt(inst)}</td>
          </tr>`;
      }).join('');

      if (chartProgress) chartProgress.destroy();
      chartProgress = new Chart(document.getElementById('progress-chart'), {
        type: 'doughnut',
        data: { labels:['پرداخت‌شده','مانده'], datasets:[{
          data:[paidCount, remainingCount],
          offset: [4,10],
          borderWidth: 1,
          borderColor: ['#22c55e','#ef4444'],
          backgroundColor: ['rgba(34,197,94,0.2)', 'rgba(239,68,68,0.2)']
        }] },
        options: { 
          responsive: true, 
          plugins: { 
            legend: { labels: { color: '#475569' } },
            datalabels: {
              color: '#0f172a',
              font: { weight: 'bold', size: 10, family: 'Vazirmatn, Tahoma, Arial, sans-serif' },
              formatter: (value) => toPersianDigits(numberWithCommas(value))
            }
          }, 
          cutout: '55%' 
        }
      });

      document.getElementById('loan-report').classList.remove('hidden');
    }

    function showAllLoansReport(){
      document.getElementById('loan-report').classList.add('hidden');
      const tbody = document.getElementById('all-loans-table-body');
      const cards = document.getElementById('all-loans-cards');
      const box = document.getElementById('all-loans-report');
      if (tbody) tbody.innerHTML = '';
      if (cards) cards.innerHTML = '';

      if (!loans.length) {
        if (cards) cards.innerHTML = '<p class="text-center text-glass-light py-6">هیچ وامی ثبت نشده است.</p>';
        box.classList.remove('hidden');
        return;
      }

      const fragment = document.createDocumentFragment();
      let cardsHtml = '';

      loans.forEach(loan=>{
        const paid = (loan.installments || []).filter(i=>i.paid).length;
        const remainCount = Math.max((loan.installmentCount||0) - paid, 0);
        const settle = getLoanSettlementDate(loan);
        const settleStr = settle ? formatDateToPersian(settle) : '—';
        const lastPaymentStr = getLastPaymentDate(loan);
        const progress = (loan.installmentCount > 0 ? ((paid / loan.installmentCount) * 100) : 0).toFixed(1);

        const tr = document.createElement('tr');
        tr.className = "border-b border-white/30 hover:bg-white/30";
        tr.innerHTML = `
          <td class="p-3 text-slate-700">${escapeHtml(loan.name)}</td>
          <td class="p-3 text-slate-700">${formatMoney(loan.amount)}</td>
          <td class="p-3 text-slate-700">${formatMoney(loan.installmentAmount)}</td>
          <td class="p-3 text-slate-700">${toPersianDigits(numberWithCommas(loan.installmentCount))}</td>
          <td class="p-3 text-slate-700">${toPersianDigits(numberWithCommas(paid))}</td>
          <td class="p-3 text-slate-700">${toPersianDigits(numberWithCommas(remainCount))}</td>
          <td class="p-3 text-slate-700">${settleStr}</td>
          <td class="p-3 text-slate-700">${lastPaymentStr}</td>
        `;
        fragment.appendChild(tr);

        cardsHtml += `
          <div class="glass rounded-xl p-4 border border-white/30">
            <div class="flex items-center justify-between mb-3 gap-2">
              <h4 class="font-bold text-slate-800 text-base">${escapeHtml(loan.name)}</h4>
              <span class="text-xs px-2 py-1 rounded-full bg-indigo-100/60 text-indigo-700">${toPersianDigits(progress)}%</span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div class="text-glass-light">مبلغ وام</div>
              <div class="text-slate-800 font-medium text-left">${formatMoney(loan.amount)}</div>
              <div class="text-glass-light">مبلغ قسط</div>
              <div class="text-slate-800 font-medium text-left">${formatMoney(loan.installmentAmount)}</div>
              <div class="text-glass-light">تعداد اقساط</div>
              <div class="text-slate-800 font-medium text-left">${toPersianDigits(numberWithCommas(loan.installmentCount))}</div>
              <div class="text-glass-light">پرداختی</div>
              <div class="text-emerald-600 font-medium text-left">${toPersianDigits(numberWithCommas(paid))}</div>
              <div class="text-glass-light">مانده</div>
              <div class="text-rose-600 font-medium text-left">${toPersianDigits(numberWithCommas(remainCount))}</div>
              <div class="text-glass-light">تاریخ تسویه</div>
              <div class="text-slate-800 font-medium text-left">${settleStr}</div>
              <div class="text-glass-light">آخرین پرداخت</div>
              <div class="text-slate-800 font-medium text-left">${lastPaymentStr}</div>
            </div>
          </div>`;
      });

      if (tbody) tbody.appendChild(fragment);
      if (cards) cards.innerHTML = cardsHtml;
      box.classList.remove('hidden');
    }

    function printRepayment(){
      const sel = document.getElementById('report-loan-select');
      const id = sel.value;
      if (!id) return showToast('یک وام انتخاب کنید.', 'error');
      const loan = loans.find(l=> String(l.id) === String(id));
      if (!loan) return showToast('وام یافت نشد.', 'error');

      const paidCount = (loan.installments || []).filter(i => i.paid).length;
      const remain = Math.max((loan.installmentCount || 0) - paidCount, 0);
      const paidAmount = (loan.installments || []).filter(i => i.paid).reduce((s,i)=>s+(i.amount||0), 0);
      const remainAmount = (loan.installments || []).filter(i => !i.paid).reduce((s,i)=>s+(i.amount||0), 0);
      const settle = getLoanSettlementDate(loan);

      const rows = (loan.installments || []).map(inst=>{
        const rowStyle = inst.paid ? 'style="background:#ecfdf5;"' : (isOverdue(inst) ? 'style="background:#fef2f2;"' : '');
        return `
          <tr ${rowStyle}>
            <td>${toPersianDigits(numberWithCommas(inst.number))}</td>
            <td>${formatDateToPersian(inst.date)}</td>
            <td>${formatMoney(inst.amount)}</td>
            <td>${inst.paid ? 'پرداخت‌شده' : (isOverdue(inst) ? 'سررسید شده' : 'پرداخت‌نشده')}</td>
            <td>${formatPaidAt(inst)}</td>
          </tr>`;
      }).join('');

      const htmlDoc = buildPrintDocument({
        title: 'جدول بازپرداخت وام',
        subtitle: loan.name || '',
        meta: [
          ['مبلغ کل', formatMoney(loan.amount)],
          ['تعداد اقساط', toPersianDigits(loan.installmentCount)],
          ['پرداخت‌شده', toPersianDigits(paidCount) + ' قسط · ' + formatMoney(paidAmount)],
          ['مانده', toPersianDigits(remain) + ' قسط · ' + formatMoney(remainAmount)],
          ['تاریخ شروع', formatDateToPersian(loan.startDate)],
          ['تاریخ تسویه', settle ? formatDateToPersian(settle) : '—']
        ],
        tableHeaders: ['شماره', 'تاریخ سررسید', 'مبلغ', 'وضعیت', 'تاریخ پرداخت'],
        tableRowsHtml: rows
      });

      openPrintWindow(htmlDoc);
    }

    function printAllLoansReport(){
      if (!loans.length) return showToast('هیچ وامی ثبت نشده است.', 'error');
      const rows = loans.map(loan=>{
        const paid = (loan.installments || []).filter(i=>i.paid).length;
        const remainCount = Math.max((loan.installmentCount||0) - paid, 0);
        const settle = getLoanSettlementDate(loan);
        const endDateStr = settle ? formatDateToPersian(settle) : '—';
        const lastPaymentStr = getLastPaymentDate(loan);
        return `
          <tr>
            <td>${escapeHtml(loan.name || '—')}</td>
            <td>${formatMoney(loan.amount)}</td>
            <td>${formatMoney(loan.installmentAmount)}</td>
            <td>${toPersianDigits(numberWithCommas(loan.installmentCount))}</td>
            <td>${toPersianDigits(numberWithCommas(paid))}</td>
            <td>${toPersianDigits(numberWithCommas(remainCount))}</td>
            <td>${endDateStr}</td>
            <td>${lastPaymentStr}</td>
          </tr>`;
      }).join('');

      const htmlDoc = buildPrintDocument({
        title: 'گزارش وضعیت کل وام‌ها',
        subtitle: 'سیستم مدیریت وام',
        meta: [
          ['تعداد وام‌ها', toPersianDigits(loans.length)],
          ['تاریخ گزارش', reportDateJalali()]
        ],
        tableHeaders: ['نام وام', 'مبلغ کل', 'مبلغ قسط', 'تعداد', 'پرداختی', 'مانده', 'تسویه', 'آخرین پرداخت'],
        tableRowsHtml: rows
      });
      openPrintWindow(htmlDoc);
    }

    function buildPrintDocument({ title, subtitle, meta, tableHeaders, tableRowsHtml }) {
      const safeTitle = escapeHtml(title || '');
      const safeSub = escapeHtml(subtitle || '');
      const metaHtml = (meta || []).map(([k,v]) =>
        `<div class="meta-row"><span>${escapeHtml(k)}</span><strong>${escapeHtml(v)}</strong></div>`
      ).join('');
      const th = (tableHeaders || []).map(h => `<th>${escapeHtml(h)}</th>`).join('');
      // فونت‌های فارسی سیستم برای چاپ (Vazirmatn اگر نصب باشد، وگرنه Tahoma)
      return `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8">
<title>${safeTitle}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Vazirmatn, 'Vazir', Tahoma, 'Segoe UI', Arial, sans-serif; direction: rtl; color: #0f172a; margin: 0; padding: 16px; -webkit-font-smoothing: antialiased; }
  .header { text-align: center; border-bottom: 3px solid #4f46e5; padding-bottom: 12px; margin-bottom: 16px; }
  .header .logo { font-size: 28px; color: #4f46e5; }
  .header h1 { margin: 8px 0 4px; font-size: 20px; }
  .header .sub { color: #64748b; font-size: 14px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; margin-bottom: 16px; font-size: 13px; }
  .meta-row { display: flex; justify-content: space-between; gap: 8px; padding: 6px 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #cbd5e1; padding: 7px 6px; text-align: center; font-variant-numeric: tabular-nums; }
  th { background: #4f46e5; color: #fff; font-weight: 700; }
  tr:nth-child(even) td { background: #f8fafc; }
  .footer { margin-top: 18px; text-align: center; color: #94a3b8; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
    tr { break-inside: avoid; }
  }
</style></head><body>
  <div class="header">
    <div class="logo">🏦</div>
    <h1>${safeTitle}</h1>
    <div class="sub">${safeSub}</div>
  </div>
  <div class="meta-grid">${metaHtml}</div>
  <table>
    <thead><tr>${th}</tr></thead>
    <tbody>${tableRowsHtml || ''}</tbody>
  </table>
  <div class="footer">سیستم مدیریت وام · نسخه ${escapeHtml(APP_VERSION)} · ${reportDateJalali()} · ${new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'})}</div>
</body></html>` + '<' + 'script>window.onload=function(){setTimeout(function(){window.print()},200)}<' + '/script>';
    }

    function openPrintWindow(htmlDoc) {
      const win = window.open('', '_blank');
      if (!win) return showToast('پنجره چاپ مسدود شده است. اجازه پاپ‌آپ بدهید.', 'error');
      win.document.open();
      win.document.write(htmlDoc);
      win.document.close();
      try { setTimeout(() => { try { win.focus(); win.print(); } catch(e){} }, 300); } catch(e){}
    }

    function exportLoanPDF() {
      // PDF از طریق چاپ مرورگر (Save as PDF) — بدون وابستگی خارجی
      printRepayment();
      showToast('در پنجره چاپ، خروجی را «ذخیره به PDF» انتخاب کنید.', 'info');
    }

    function exportAllLoansPDF() {
      printAllLoansReport();
      showToast('در پنجره چاپ، خروجی را «ذخیره به PDF» انتخاب کنید.', 'info');
    }

    // کش محاسبات سنگین داشبورد؛ با تغییر اقساط فقط همان وام invalidate می‌شود.
    const loanStatsCache = new Map();
    function invalidateLoanStats(loanId) {
      if (loanId == null) loanStatsCache.clear();
      else loanStatsCache.delete(String(loanId));
    }
    function getLoanStats(loan) {
      const key = String(loan.id);
      const cached = loanStatsCache.get(key);
      if (cached && cached._loan === loan) return cached;
      const insts = Array.isArray(loan.installments) ? loan.installments : [];
      const fallback = Number(loan.installmentAmount) || 0;
      let paidCount = 0, paidAmount = 0, remainingAmount = 0;
      let next = null;
      if (insts.length) {
        for (const i of insts) {
          const raw = Number(i.amount);
          const amt = Number.isFinite(raw) ? raw : fallback;
          if (i.paid) paidCount++;
          if (i.paid) paidAmount += amt; else {
            remainingAmount += amt;
            if (i.date && (!next || String(i.date) < String(next.date))) next = i;
          }
        }
      } else {
        const count = Number(loan.installmentCount) || 0;
        remainingAmount = fallback * count;
      }
      const totalInst = Number(loan.installmentCount) || insts.length || 0;
      const stats = { _loan: loan, paidCount, totalInst, remainingCount: Math.max(totalInst-paidCount,0), paidAmount, remainingAmount, next };
      loanStatsCache.set(key, stats);
      return stats;
    }

    // Chart instances for dashboard (destroy/recreate to avoid leaks)
    let _dashMonthlyChart = null, _dashTrendChart = null;
    let _donutPaid = null, _donutRemaining = null, _donutOverdue = null;

    function renderDashboard(){
      updateSelects();
      
      const totalLoans = loans.length;
      const sumInstallmentAmounts = loans.reduce((s, l) => s + (Number(l.installmentAmount) || 0), 0);

      const el = (id) => document.getElementById(id);
      if (el('kpi-total-loans')) el('kpi-total-loans').textContent = toPersianDigits(numberWithCommas(totalLoans));
      if (el('kpi-total-installments')) el('kpi-total-installments').textContent = formatMoney(sumInstallmentAmounts);

      renderLoanCards();
    }

    function renderDashboardCharts() { /* removed */ }

    function renderDashboardCharts(paidCount, remainCount, overdueCount, allCount) {
      if (typeof Chart === 'undefined') return;

      // --- Monthly bar chart ---
      const monthNames = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
      const now = new Date();
      // Approximate Jalali months via simple offset (good enough for visual)
      const labels = [];
      const paidData = [];
      const dueData = [];
      for (let i = 2; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const m = d.getMonth();
        labels.push(monthNames[m] || ('ماه ' + (m+1)));
        let p = 0, due = 0;
        (loans || []).forEach(l => {
          (l.installments || []).forEach(inst => {
            if (!inst.date) return;
            const id = new Date(inst.date);
            if (id.getFullYear() === d.getFullYear() && id.getMonth() === d.getMonth()) {
              due += Number(inst.amount) || 0;
              if (inst.paid) p += Number(inst.amount) || 0;
            }
          });
        });
        paidData.push(p);
        dueData.push(due);
      }

      const mCtx = document.getElementById('dash-monthly-chart');
      if (mCtx) {
        if (_dashMonthlyChart) { try { _dashMonthlyChart.destroy(); } catch(_){} }
        _dashMonthlyChart = new Chart(mCtx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [
              { label: 'پرداخت‌شده', data: paidData, backgroundColor: 'rgba(13,148,136,0.80)', borderRadius: 8, borderSkipped: false },
              { label: 'سررسید', data: dueData, backgroundColor: 'rgba(20,184,166,0.28)', borderRadius: 8, borderSkipped: false }
            ]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top', rtl: true, labels: { font: { family: 'Vazirmatn' } } },
              tooltip: { rtl: true, titleFont: { family: 'Vazirmatn' }, bodyFont: { family: 'Vazirmatn' } } },
            scales: {
              x: { grid: { display: false }, ticks: { font: { family: 'Vazirmatn' } } },
              y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { family: 'Vazirmatn' }, callback: v => numberWithCommas(v) } }
            }
          }
        });
      }

      // --- Trend line (simple cumulative paid ratio over last 6 points) ---
      const tCtx = document.getElementById('dash-trend-chart');
      if (tCtx) {
        if (_dashTrendChart) { try { _dashTrendChart.destroy(); } catch(_){} }
        const trendLabels = ['','','','','',''];
        const trendData = [20, 35, 40, 55, 65, Math.min(100, paidCount > 0 ? Math.round((paidCount/(paidCount+remainCount||1))*100) : 0)];
        _dashTrendChart = new Chart(tCtx, {
          type: 'line',
          data: {
            labels: trendLabels,
            datasets: [{ data: trendData, borderColor: '#0d9488', backgroundColor: 'rgba(13,148,136,0.12)', fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2 }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: { x: { display: false }, y: { display: false, min: 0, max: 100 } }
          }
        });
      }

      // --- Professional Donuts (center % + rounded arcs) ---
      const centerTextPlugin = {
        id: 'centerText',
        afterDraw(chart) {
          const { ctx, chartArea: { width, height, top, left } } = chart;
          const value = chart.config.data.datasets[0].data[0] || 0;
          const color = chart.config.data.datasets[0].backgroundColor[0];
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const cx = left + width / 2;
          const cy = top + height / 2;
          // main percentage
          ctx.font = '800 1.35rem Vazirmatn, Tahoma, sans-serif';
          ctx.fillStyle = color;
          ctx.fillText(toPersianDigits(value) + '٪', cx, cy - 2);
          ctx.restore();
        }
      };

      function makeDonut(canvasId, value, color, trackColor, storeRef) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;
        if (storeRef) { try { storeRef.destroy(); } catch(_){} }
        const v = Math.max(0, Math.min(100, Number(value) || 0));
        return new Chart(ctx, {
          type: 'doughnut',
          data: {
            datasets: [{
              data: [v, Math.max(0.01, 100 - v)],
              backgroundColor: [color, trackColor || 'rgba(229,231,235,0.85)'],
              borderWidth: 0,
              borderRadius: 12,
              spacing: 0,
              hoverOffset: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '74%',
            rotation: -90,
            circumference: 360,
            plugins: {
              legend: { display: false },
              tooltip: { enabled: false },
              centerText: true
            },
            animation: {
              animateRotate: true,
              animateScale: true,
              duration: 1100,
              easing: 'easeOutQuart'
            },
            layout: { padding: 6 }
          },
          plugins: [centerTextPlugin]
        });
      }

      const paidPctVal = (paidCount > 0 || remainCount > 0)
        ? Math.round((paidCount / (paidCount + remainCount || 1)) * 100) : 0;
      const remainPctVal = (remainCount > 0 || paidCount > 0)
        ? Math.round((remainCount / (paidCount + remainCount || 1)) * 100) : 0;
      const overduePctVal = allCount > 0
        ? Math.round((overdueCount / allCount) * 100) : 0;

      _donutPaid = makeDonut('donut-paid', paidPctVal, '#f59e0b', 'rgba(245,158,11,0.12)', _donutPaid);
      _donutRemaining = makeDonut('donut-remaining', remainPctVal, '#8b5cf6', 'rgba(139,92,246,0.12)', _donutRemaining);
      _donutOverdue = makeDonut('donut-overdue', overduePctVal, '#0ea5e9', 'rgba(14,165,233,0.12)', _donutOverdue);
    }


    function getNextUnpaidInstallment(loan) {
      return loan ? getLoanStats(loan).next : null;
    }

    function refreshAllViews(reason = '') {
      try { invalidateLoanStats(); } catch (_) {}
      // پس از پرداخت: وام‌های کاملاً تسویه‌شده را به بایگانی منتقل کن
      try {
        if (reason === 'payment' || reason === 'batch-payment') {
          const settledIds = (loans || []).filter(isLoanSettled).map(l => l.id);
          settledIds.forEach(id => archiveLoanById(id, true));
          if (settledIds.length) {
            showToast(toPersianDigits(settledIds.length) + ' وام تسویه‌شده به بایگانی منتقل شد.', 'success');
          }
        }
      } catch (e) { console.warn('auto-archive', e); }
      // Rebind currentLoan to the canonical object in loans after any mutation.
      if (currentLoan?.id != null) {
        const canonical = (loans || []).find(l => String(l.id) === String(currentLoan.id));
        currentLoan = canonical || null;
      }
      try { renderDashboard(); } catch (e) { console.warn('refresh dashboard', e); }
      
      try { if (typeof updateReportAnalytics === 'function') updateReportAnalytics(); } catch (_) {}
      try { if (typeof renderCalendar === 'function') renderCalendar(); } catch (_) {}

      const visible = id => {
        const el = document.getElementById(id);
        return !!el && !el.classList.contains('hidden');
      };
      try {
        if (visible('manage-loans') && currentLoan) updateManageInstallmentTable(false);
      } catch (_) {}
      try {
        if (visible('reports')) {
          const allBox = document.getElementById('all-loans-report');
          const loanBox = document.getElementById('loan-report');
          if (allBox && !allBox.classList.contains('hidden')) showAllLoansReport();
          else if (loanBox && !loanBox.classList.contains('hidden')) showLoanReport();
        }
      } catch (_) {}
      return reason;
    }

    function quickPayFromDashboard(loanId, event) {
      if (event) {
        event.stopPropagation();
        event.preventDefault();
      }
      const loan = (loans || []).find(l => String(l.id) === String(loanId));
      if (!loan) return showToast('وام یافت نشد.', 'error');
      const next = getNextUnpaidInstallment(loan);
      if (!next) {
        showToast('همه اقساط این وام پرداخت شده‌اند.', 'info');
        return;
      }
      const msg = `پرداخت قسط شماره ${toPersianDigits(next.number)} وام «${loan.name}»\nمبلغ: ${formatMoney(next.amount)}\nتاریخ سررسید: ${formatDateToPersian(next.date)}`;
      showConfirmGlass(msg, { okText: 'ثبت پرداخت', cancelText: 'انصراف' }).then(ok => {
        if (!ok) return;
        next.paid = true;
        next.paidAt = new Date().toISOString();
        next.paidFrom = null;
        const canonicalLoan = (loans || []).find(l => String(l.id) === String(loan.id));
        if (canonicalLoan && canonicalLoan !== loan) {
          const canonicalInst = (canonicalLoan.installments || []).find(i => i.number === next.number);
          if (canonicalInst) {
            canonicalInst.paid = true;
            canonicalInst.paidAt = next.paidAt;
            canonicalInst.paidFrom = null;
          }
        }
        persist();
        invalidateLoanStats(loan.id);
        refreshAllViews('payment');
        if (typeof v8Log === 'function') v8Log('payment', `قسط ${toPersianDigits(next.number)} پرداخت شد`, loan.name || '');
        showToast(`قسط ${toPersianDigits(next.number)} پرداخت شد.`, 'success');
      });
    }

    let dashRenderTimer = null;
    function debouncedRenderLoanCards() {
      clearTimeout(dashRenderTimer);
      dashRenderTimer = setTimeout(renderLoanCards, 120);
    }

    function getLoanSmartStatus(loan, st = getLoanStats(loan)) {
      if (!loan) return {label:'نامشخص', class:'status-neutral', icon:'fa-solid fa-circle-question'};
      if (st.totalInst > 0 && st.paidCount >= st.totalInst) return {label:'تسویه‌شده', class:'status-done', icon:'fa-solid fa-circle-check'};
      const overdue = (loan.installments || []).filter(i => !i.paid && isOverdue(i));
      if (overdue.length) return {label:'معوق', class:'status-overdue', icon:'fa-solid fa-triangle-exclamation'};
      const next = st.next; const d = next ? daysUntilDate(next.date) : null;
      if (d !== null && d <= 3) return {label:'نزدیک سررسید', class:'status-soon', icon:'fa-solid fa-clock'};
      return {label:'منظم', class:'status-ok', icon:'fa-solid fa-circle-check'};
    }

    // ===== Stacked 3D Loan Deck =====
    let deckIndex = 0;
    let _deckSortedLoans = [];

    function deckNext() {
      if (!_deckSortedLoans.length) return;
      deckIndex = (deckIndex + 1) % _deckSortedLoans.length;
      applyDeckPositions();
    }
    function deckPrev() {
      if (!_deckSortedLoans.length) return;
      deckIndex = (deckIndex - 1 + _deckSortedLoans.length) % _deckSortedLoans.length;
      applyDeckPositions();
    }
    window.deckNext = deckNext;
    window.deckPrev = deckPrev;

    function applyDeckPositions() {
      const container = document.getElementById('loans-cards-container');
      if (!container) return;
      const cards = Array.from(container.querySelectorAll('.deck-card'));
      const n = cards.length;
      cards.forEach((card, i) => {
        // relative position from active
        let offset = i - deckIndex;
        if (offset > n / 2) offset -= n;
        if (offset < -n / 2) offset += n;
        card.classList.remove('deck-front', 'deck-back-1', 'deck-back-2', 'deck-back-3', 'deck-hidden');
        if (offset === 0) {
          card.classList.add('deck-front');
          card.style.zIndex = 50;
          card.style.pointerEvents = 'auto';
        } else if (offset === 1 || (offset === - (n - 1) && n > 1)) {
          card.classList.add('deck-back-1');
          card.style.zIndex = 40;
          card.style.pointerEvents = 'none';
        } else if (offset === 2 || (offset === - (n - 2) && n > 2)) {
          card.classList.add('deck-back-2');
          card.style.zIndex = 30;
          card.style.pointerEvents = 'none';
        } else if (Math.abs(offset) === 3) {
          card.classList.add('deck-back-3');
          card.style.zIndex = 20;
          card.style.pointerEvents = 'none';
        } else {
          card.classList.add('deck-hidden');
          card.style.zIndex = 1;
          card.style.pointerEvents = 'none';
        }
      });
      // indicators
      const ind = document.getElementById('deck-indicators');
      if (ind) {
        ind.innerHTML = _deckSortedLoans.map((_, i) =>
          `<button type="button" class="deck-dot ${i === deckIndex ? 'active' : ''}" onclick="deckGoTo(${i})" aria-label="کارت ${i+1}"></button>`
        ).join('');
      }
    }
    function deckGoTo(i) {
      deckIndex = i;
      applyDeckPositions();
    }
    window.deckGoTo = deckGoTo;

    function renderLoanCards() {
      const container = document.getElementById('loans-cards-container');
      if (!container) return;

      if (loans.length === 0) {
        container.innerHTML = `
          <div class="deck-empty text-center py-12 glass-card rounded-2xl p-12 border border-white/30">
            <i class="fa-solid fa-file-invoice text-6xl text-slate-300 mb-4"></i>
            <p class="text-slate-500 text-lg">هیچ وامی ثبت نشده است</p>
            <button class="mt-4 btn-glass btn-glass-primary" onclick="showPage('register-loan')">
              <i class="fa-solid fa-plus me-2"></i>ثبت اولین وام
            </button>
          </div>
        `;
        const ind = document.getElementById('deck-indicators');
        if (ind) ind.innerHTML = '';
        return;
      }

      // مرتب‌سازی بر اساس ترتیب ذخیره شده
      let sortedLoans = [...loans];
      if (loanOrder.length > 0) {
        const orderMap = new Map(loanOrder.map((id, i) => [String(id), i]));
        sortedLoans.sort((a, b) => {
          const indexA = orderMap.has(String(a.id)) ? orderMap.get(String(a.id)) : 999999;
          const indexB = orderMap.has(String(b.id)) ? orderMap.get(String(b.id)) : 999999;
          return indexA - indexB;
        });
      }
      // فیلتر و جستجو
      sortedLoans = sortedLoans.filter(loan => loanMatchesFilter(loan) && loanMatchesSearch(loan));
      _deckSortedLoans = sortedLoans;
      if (deckIndex >= sortedLoans.length) deckIndex = 0;

      if (sortedLoans.length === 0) {
        container.innerHTML = `
          <div class="deck-empty text-center py-10 glass-card rounded-2xl p-8 border border-white/30">
            <i class="fa-solid fa-filter-circle-xmark text-5xl text-slate-300 mb-3"></i>
            <p class="text-slate-500">وامی با این فیلتر/جستجو یافت نشد</p>
            <button class="mt-3 btn-glass" onclick="setDashFilter('all'); renderLoanCards();">نمایش همه</button>
          </div>`;
        const ind = document.getElementById('deck-indicators');
        if (ind) ind.innerHTML = '';
        return;
      }

      const tempDiv = document.createElement('div');
      
      for (let i = 0; i < sortedLoans.length; i++) {
        const loan = sortedLoans[i];
        const st = getLoanStats(loan);
        const paidCount = st.paidCount;
        const totalInst = st.totalInst;
        const remainingCount = st.remainingCount;
        const progressPercent = (totalInst > 0 ? ((paidCount / totalInst) * 100) : 0).toFixed(1);
        const paidAmount = st.paidAmount;
        const remainingAmount = st.remainingAmount;
        const statusInfo = getLoanSmartStatus(loan, st);
        
        const endDateStr = (() => {
          const s = getLoanSettlementDate(loan);
          return s ? formatDateToPersian(s) : '—';
        })();

        // سررسید بعدی (اولین قسط پرداخت‌نشده بر اساس تاریخ)
        const nextInst = getNextUnpaidInstallment(loan);
        let nextDueHtml = '';
        if (nextInst) {
          const days = daysUntilDate(nextInst.date);
          const isOd = days !== null && days < 0;
          const isToday = days === 0;
          let dueLabel = 'سررسید بعدی';
          let dueClass = 'text-indigo-600';
          let dueExtra = '';
          if (isOd) {
            dueLabel = 'سررسید معوق';
            dueClass = 'text-rose-600';
            dueExtra = `<span class="overdue-delay">${toPersianDigits(Math.abs(days))} روز تأخیر</span>`;
          } else if (isToday) {
            dueLabel = 'سررسید امروز';
            dueClass = 'text-amber-600';
          } else if (days !== null && days <= 3) {
            dueExtra = `<span class="due-soon-text">${toPersianDigits(days)} روز مانده</span>`;
            dueClass = 'text-amber-600';
          }
          if (isOd) {
            // همه اقساط معوق این وام
            const overdueList = (loan.installments || [])
              .filter(inst => isOverdue(inst))
              .map(inst => {
                const d = daysUntilDate(inst.date);
                return {
                  number: inst.number,
                  date: inst.date,
                  amount: Number(inst.amount) || 0,
                  daysLate: d !== null ? Math.abs(d) : 0
                };
              })
              .sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0)); // از قسط کمتر به بیشتر

            const odCount = overdueList.length;
            const odTotalAmount = overdueList.reduce((s, x) => s + x.amount, 0);
            const maxLate = overdueList.length ? Math.max(...overdueList.map(x => x.daysLate)) : Math.abs(days);

            if (odCount <= 1) {
              // یک قسط معوق — نمایش ساده
              const delayDays = toPersianDigits(maxLate);
              nextDueHtml = `
              <div class="next-due-row next-due-overdue">
                <div class="od-title">
                  <i class="fa-solid fa-triangle-exclamation"></i>
                  <span>سررسید معوق</span>
                </div>
                <div class="od-grid">
                  <div class="od-item">
                    <span class="od-key">تاریخ</span>
                    <span class="od-val od-date">${formatDateToPersian(nextInst.date)}</span>
                  </div>
                  <div class="od-item">
                    <span class="od-key">تعداد روز</span>
                    <span class="od-val overdue-delay">${delayDays} روز</span>
                  </div>
                  <div class="od-item">
                    <span class="od-key">مبلغ معوقه</span>
                    <span class="od-val od-amount">${formatMoney(nextInst.amount)}</span>
                  </div>
                </div>
              </div>`;
            } else {
              // چند قسط معوق — خلاصه + لیست کشویی
              const rowsHtml = overdueList.map(item => `
                  <div class="od-detail-row">
                    <span class="od-detail-num">${toPersianDigits(item.number)}</span>
                    <span class="od-detail-date">${formatDateToPersian(item.date)}</span>
                    <span class="od-detail-days overdue-delay">${toPersianDigits(item.daysLate)} روز</span>
                    <span class="od-detail-amt od-amount">${formatMoney(item.amount)}</span>
                  </div>`).join('');

              nextDueHtml = `
              <div class="next-due-row next-due-overdue">
                <div class="od-title">
                  <i class="fa-solid fa-triangle-exclamation"></i>
                  <span>${toPersianDigits(odCount)} قسط معوق</span>
                </div>
                <div class="od-grid">
                  <div class="od-item">
                    <span class="od-key">بیشترین تأخیر</span>
                    <span class="od-val overdue-delay">${toPersianDigits(maxLate)} روز</span>
                  </div>
                  <div class="od-item">
                    <span class="od-key">جمع مبلغ معوقه</span>
                    <span class="od-val od-amount">${formatMoney(odTotalAmount)}</span>
                  </div>
                </div>
                <details class="od-details" onclick="event.stopPropagation()" onmousedown="event.stopPropagation()">
                  <summary class="od-summary">
                    <i class="fa-solid fa-calendar-days"></i>
                    مشاهده تاریخ اقساط معوق
                    <i class="fa-solid fa-chevron-down od-chevron"></i>
                  </summary>
                  <div class="od-detail-list">
                    <div class="od-detail-head">
                      <span>#</span>
                      <span>تاریخ</span>
                      <span>تأخیر</span>
                      <span>مبلغ</span>
                    </div>
                    ${rowsHtml}
                  </div>
                </details>
              </div>`;
            }
          } else {
            nextDueHtml = `
              <div class="next-due-row next-due-normal">
                <span class="text-slate-500 shrink-0">${dueLabel}:</span>
                <span class="font-medium ${dueClass} next-due-normal-val">
                  <span class="od-date">${formatDateToPersian(nextInst.date)}</span>${dueExtra ? ` · ${dueExtra}` : ''}
                  <br><span class="text-slate-700 od-amount">${formatMoney(nextInst.amount)}</span>
                </span>
              </div>`;
          }
        } else if (remainingCount === 0 && totalInst > 0) {
          nextDueHtml = `
              <div class="flex justify-between">
                <span class="text-slate-500">سررسید بعدی:</span>
                <span class="font-medium text-emerald-600">تسویه کامل ✓</span>
              </div>`;
        }

        let statusColor = 'bg-rose-100/60 border-rose-200/60 text-rose-700';
        if (progressPercent >= 75) statusColor = 'bg-emerald-100/60 border-emerald-200/60 text-emerald-700';
        else if (progressPercent >= 50) statusColor = 'bg-amber-100/60 border-amber-200/60 text-amber-700';
        else if (progressPercent >= 25) statusColor = 'bg-blue-100/60 border-blue-200/60 text-blue-700';

        const isEditing = editingLoanId === loan.id;

        const cardHTML = `
          <div class="glass-card loan-card-compact rounded-2xl p-3 border border-white/30" draggable="true" data-loan-id="${loan.id}">
            <div class="loan-smart-status ${statusInfo.class}"><i class="fa-solid ${statusInfo.icon.replace("fa-solid ","")}"></i>${statusInfo.label}</div>
            <div class="flex justify-between items-start mb-2">
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <i class="fa-solid fa-grip-lines drag-handle text-xs"></i>
                ${renderLoanIconHTML(loan.icon)}
                <div class="flex items-center gap-2 flex-1 min-w-0">
                  ${isEditing ? `
                    <input 
                      type="text" 
                      class="loan-name-input" 
                      data-loan-id="${loan.id}" 
                      value="${escapeHtml(loan.name)}" 
                      disabled
                      onkeydown="if(event.key==='Enter') saveNameEdit(${loan.id}, this)"
                      onblur="setTimeout(() => { if(editingLoanId === ${loan.id}) cancelNameEdit(${loan.id}); }, 200)"
                    />
                    <button class="edit-name-btn text-emerald-500" onclick="saveNameEdit(${loan.id}, document.querySelector('.loan-name-input[data-loan-id=\\'${loan.id}\\']'))">
                      <i class="fa-solid fa-check"></i>
                    </button>
                    <button class="edit-name-btn text-rose-500" onclick="cancelNameEdit(${loan.id})">
                      <i class="fa-solid fa-xmark"></i>
                    </button>
                  ` : `
                    <div class="min-w-0"><h3 class="text-base font-bold text-slate-800 truncate">${escapeHtml(loan.name)}</h3>${loan.party ? `<div class="text-xs text-slate-500 mt-0.5 truncate"><i class="fa-solid fa-user me-1"></i>${escapeHtml(loan.party)}</div>` : ``}</div>
                    <button class="edit-name-btn" onclick="startEditName(${loan.id})" title="ویرایش نام وام">
                      <i class="fa-solid fa-pen text-xs"></i>
                    </button>
                  `}
                </div>
              </div>
              <span class="px-2.5 py-0.5 rounded-full text-xs ${statusColor} border shrink-0">
                ${toPersianDigits(progressPercent)}%
              </span>
            </div>
            
            <div class="loan-details space-y-1.5">
              <div class="flex justify-between">
                <span class="text-slate-500">مبلغ قسط:</span>
                <span class="font-medium text-slate-800">${formatMoney(loan.installmentAmount)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">پرداختی:</span>
                <span class="font-medium text-emerald-600">${toPersianDigits(numberWithCommas(paidCount))} قسط</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">مانده:</span>
                <span class="font-medium text-rose-600">${toPersianDigits(numberWithCommas(remainingCount))} قسط</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">تاریخ تسویه:</span>
                <span class="font-medium text-slate-800">${endDateStr}</span>
              </div>
              ${nextDueHtml}
            </div>

            <div class="mt-2.5 pt-2.5 border-t border-slate-200/50">
              <div class="flex justify-between text-xs text-slate-400 mb-1">
                <span>پیشرفت بازپرداخت</span>
                <span>${toPersianDigits(progressPercent)}%</span>
              </div>
              <div class="w-full bg-slate-200/50 rounded-full h-1.5">
                <div class="h-1.5 rounded-full ${statusColor.replace('text','bg').replace('border','bg')}" style="width: ${progressPercent}%"></div>
              </div>
            </div>

            <div class="mt-2.5 flex flex-wrap gap-1.5">
              ${nextInst ? `
              <button class="flex-1 min-w-[40%] btn-glass btn-glass-success text-sm" onclick="quickPayFromDashboard('${loan.id}', event)" title="ثبت پرداخت قسط بعدی">
                <i class="fa-solid fa-check me-1"></i>پرداخت سریع
              </button>` : ''}
              <button class="flex-1 min-w-[40%] btn-glass btn-glass-primary text-sm" onclick="selectAndShowPage('${loan.id}', 'manage-loans')">
                <i class="fa-solid fa-edit me-1"></i>مدیریت
              </button>
              <button class="flex-1 min-w-[40%] btn-glass text-sm" onclick="selectAndShowPage('${loan.id}', 'reports')">
                <i class="fa-solid fa-chart-bar me-1"></i>گزارش
              </button>
            </div>
          </div>
        `;
        
        tempDiv.innerHTML += cardHTML;
      }

      container.innerHTML = tempDiv.innerHTML;
      setTimeout(initDragDrop, 50);
      
      // فوکوس روی input در حال ویرایش
      if (editingLoanId) {
        setTimeout(() => {
          const input = document.querySelector(`.loan-name-input[data-loan-id="${editingLoanId}"]`);
          if (input) {
            input.disabled = false;
            input.focus();
            input.select();
          }
        }, 150);
      }
    }

    let _deckSwipeBound = false;
    function initDeckSwipe(container) {
      if (!container || _deckSwipeBound) return;
      _deckSwipeBound = true;
      let startX = 0, startY = 0, tracking = false;
      container.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button, input, details, a, select')) return;
        tracking = true;
        startX = e.clientX;
        startY = e.clientY;
      });
      container.addEventListener('pointerup', (e) => {
        if (!tracking) return;
        tracking = false;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
        // RTL: swipe left (negative dx in LTR coords from right) → next
        if (dx > 40) deckPrev();
        else if (dx < -40) deckNext();
      });
      container.addEventListener('pointerleave', () => { tracking = false; });
    }

    function selectAndShowPage(loanId, pageId) {
      const select = document.getElementById(pageId === 'manage-loans' ? 'manage-loan-select' : 'report-loan-select');
      if (select) {
        select.value = loanId;
        if (pageId === 'manage-loans') {
          loadLoanForManagement();
        } else if (pageId === 'reports') {
          showLoanReport();
        }
      }
      showPage(pageId);
    }

    // ============================================================
    //  DELETE & BACKUP
    // ============================================================
    function deleteLoan(){
      const sel = document.getElementById('delete-loan-select'); 
      const id = sel.value;
      if (!id) return showToast('یک وام انتخاب کنید.', 'error');
      const target = (loans || []).find(l => String(l.id) === String(id));
      const targetName = target?.name || '';
      showConfirmGlass('این وام حذف می‌شود. ادامه می‌دهید؟', {
        title: 'حذف وام',
        okText: 'حذف',
        cancelText: 'انصراف'
      }).then(ok => {
        if (!ok) return;
        loans = loans.filter(l=> String(l.id) !== String(id));
        loanOrder = loanOrder.filter(lid => String(lid) !== String(id));
        persist(); 
        currentLoan = null;
        invalidateLoanStats();
        refreshAllViews('delete-loan');
        if (typeof v8Log === 'function') v8Log('delete', 'وام حذف شد', targetName);
        showToast('وام با موفقیت حذف شد.', 'success');
      });
    }

    
    async function quickBackupSilent() {
      try {
        await backupData({ silent: true });
      } catch (e) {
        console.error(e);
        showToast('خطا در تهیه پشتیبان.', 'error');
      }
    }
    window.quickBackupSilent = quickBackupSilent;

async function backupData(opts = {}){
      // Full app backup (loans + settings + users + order + icons) for safer recovery
      // آیکون سفارشی هر وام داخل loan.icon است؛ آیکون‌های بانک نیز جداگانه داخل assets ذخیره می‌شوند.
      let iconAssets = {};
      try { iconAssets = await collectBankIconAssets(); } catch (_) {}
      if (!Object.keys(iconAssets).length) iconAssets = embeddedBankIconAssets || {};
      const payload = {
        backupVersion: BACKUP_VERSION,
        appVersion: APP_VERSION,
        schemaVersion: DATA_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        source: 'EasyVAM',
        data: {
          loans,
          loanOrder,
          settings: safeParseJSON('vam_app_settings', {}),
          users: safeParseJSON('vam_users', []),
          bankAccounts: getBankAccounts(),
          paymentReceipts: getPaymentReceiptsStore(),
          theme: localStorage.getItem('vam_theme') || 'light',
          iconAssets,
          iconBackupVersion: 3
        }
      };
      if (!payload.data.loans || payload.data.loans.length === 0) {
        return showToast('هیچ وامی برای پشتیبان‌گیری وجود ندارد.', 'warning');
      }

      // اول سعی می‌کنیم در پوشه انتخاب‌شده کاربر بنویسیم
      let savedToFolder = false;
      try {
        savedToFolder = await writeBackupToFolder(payload);
      } catch (e) {
        console.warn(e);
      }

      if (savedToFolder) {
        localStorage.setItem('vam_last_backup', new Date().toISOString());
        updateLastBackupInfo();
        showToast('نسخه پشتیبان در پوشه انتخاب‌شده (حافظه داخلی) ذخیره شد.', 'success');
        return;
      }

      // اگر پوشه در دسترس نبود → دانلود معمولی
      if (opts.preferFolder) {
        // کاربر تازه پوشه انتخاب کرده ولی نوشتن شکست خورده
        showToast('نوشتن در پوشه ممکن نشد. فایل به صورت دانلود ذخیره می‌شود.', 'warning');
      }
      const dataStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); 
      a.href = url; 
      a.download = `easyvam_full_backup_${APP_VERSION}_${toLocalISO(new Date())}_${loans.length}loans.json`; 
      a.click();
      URL.revokeObjectURL(url);
      localStorage.setItem('vam_last_backup', new Date().toISOString());
      updateLastBackupInfo();
      showToast('نسخه پشتیبان کامل با موفقیت دانلود شد.', 'success');
    }

    /** یادآوری پشتیبان اگر بیش از ۷ روز گذشته یا هرگز گرفته نشده */
    function maybeRemindBackup() {
      try {
        if (!loans || loans.length === 0) return;
        const ts = localStorage.getItem('vam_last_backup');
        const now = Date.now();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (!ts || (now - new Date(ts).getTime()) > sevenDays) {
          setTimeout(() => {
            showToast('پیشنهاد: برای جلوگیری از از دست رفتن داده‌ها، نسخه پشتیبان تهیه کنید.', 'warning');
          }, 4000);
        }
      } catch (e) {}
    }


    // ============================================================
    //  FILE SYSTEM ACCESS API — ذخیره مستقیم در پوشه کاربر
    // ============================================================
    let backupDirHandle = null; // in-memory cache of directory handle

    function isFileSystemAccessSupported() {
      return typeof window.showDirectoryPicker === 'function';
    }

    async function pickBackupFolder() {
      if (!isFileSystemAccessSupported()) {
        showToast('مرورگر شما از انتخاب پوشه پشتیبانی نمی‌کند. از Chrome یا Edge استفاده کنید.', 'warning');
        return;
      }
      try {
        const handle = await window.showDirectoryPicker({
          mode: 'readwrite',
          id: 'easyvam-backup-folder',
          startIn: 'documents'
        });
        // Request permission explicitly
        const perm = await handle.requestPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
          showToast('دسترسی نوشتن به پوشه داده نشد.', 'error');
          return;
        }
        backupDirHandle = handle;
        await idbSet('backupDirHandle', handle);
        updateBackupFolderStatus();
        showToast('پوشه ذخیره با موفقیت انتخاب شد. از این به بعد بکاپ‌ها آنجا ذخیره می‌شوند.', 'success');
        // Immediately write one backup
        await backupData({ preferFolder: true });
      } catch (e) {
        if (e && e.name === 'AbortError') return; // user cancelled
        console.error(e);
        showToast('انتخاب پوشه ناموفق بود: ' + (e.message || 'خطای ناشناخته'), 'error');
      }
    }

    async function clearBackupFolder() {
      backupDirHandle = null;
      try { await idbSet('backupDirHandle', null); } catch (_) {}
      // Also remove key if possible
      try {
        const db = await openIDB();
        if (db) {
          const tx = db.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).delete('backupDirHandle');
        }
      } catch (_) {}
      updateBackupFolderStatus();
      showToast('پوشه ذخیره لغو شد. بکاپ‌ها دوباره به صورت دانلود ذخیره می‌شوند.', 'info');
    }

    async function restoreBackupDirHandle() {
      try {
        if (!isFileSystemAccessSupported()) return;
        const stored = await idbGet('backupDirHandle');
        if (!stored) return;
        // Verify we still have permission
        let perm = await stored.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
          perm = await stored.requestPermission({ mode: 'readwrite' });
        }
        if (perm === 'granted') {
          backupDirHandle = stored;
        } else {
          backupDirHandle = null;
        }
      } catch (e) {
        console.warn('Could not restore directory handle', e);
        backupDirHandle = null;
      }
      updateBackupFolderStatus();
    }

    function updateBackupFolderStatus() {
      const el = document.getElementById('backup-folder-status');
      const btnClear = document.getElementById('btn-clear-folder');
      if (!el) return;
      if (!isFileSystemAccessSupported()) {
        el.innerHTML = '<span style="color:#f59e0b;">مرورگر از این قابلیت پشتیبانی نمی‌کند (Chrome/Edge پیشنهاد می‌شود)</span>';
        if (btnClear) btnClear.style.display = 'none';
        return;
      }
      if (backupDirHandle) {
        el.innerHTML = '<span style="color:#10b981;"><i class="fa-solid fa-circle-check me-1"></i>پوشه انتخاب شده — بکاپ‌ها مستقیماً در حافظه داخلی ذخیره می‌شوند</span>';
        if (btnClear) btnClear.style.display = '';
      } else {
        el.innerHTML = '<span style="color:#94a3b8;">هنوز پوشه‌ای انتخاب نشده (بکاپ به صورت دانلود ذخیره می‌شود)</span>';
        if (btnClear) btnClear.style.display = 'none';
      }
    }

    /** تلاش برای نوشتن فایل بکاپ داخل پوشه انتخاب‌شده */
    async function writeBackupToFolder(payload) {
      try {
        let handle = backupDirHandle;
        if (!handle) {
          handle = await idbGet('backupDirHandle');
          if (handle) backupDirHandle = handle;
        }
        if (!handle) return false;

        let perm = 'granted';
        try {
          if (typeof handle.queryPermission === 'function') {
            perm = await handle.queryPermission({ mode: 'readwrite' });
          }
          if (perm !== 'granted' && typeof handle.requestPermission === 'function') {
            perm = await handle.requestPermission({ mode: 'readwrite' });
          }
        } catch (permErr) {
          console.warn('permission check failed', permErr);
        }
        if (perm !== 'granted') return false;

        // نام فایل فقط با ارقام انگلیسی و کاراکتر امن
        const datePart = toEnglishDigits(toLocalISO(new Date()) || '').replace(/[^\d\-]/g, '') || String(Date.now());
        const countPart = String((payload.data?.loans || []).length);
        const fileName = `easyvam_backup_${APP_VERSION}_${datePart}_${countPart}loans.json`;

        const jsonStr = JSON.stringify(payload, null, 2);
        if (!jsonStr || jsonStr.length < 2) {
          console.warn('empty payload stringify');
          return false;
        }
        // Uint8Array قابل‌اعتمادتر از string روی اندروید/WebView
        const bytes = new TextEncoder().encode(jsonStr);

        const fileHandle = await handle.getFileHandle(fileName, { create: true });
        let wrote = false;

        // روش ۱: createWritable + Uint8Array
        try {
          const writable = await fileHandle.createWritable({ keepExistingData: false });
          try {
            await writable.write(bytes);
            // اطمینان از طول نهایی فایل
            if (typeof writable.truncate === 'function') {
              await writable.truncate(bytes.byteLength);
            }
            await writable.close();
            wrote = true;
          } catch (wErr) {
            try { await writable.abort(); } catch (_) {}
            throw wErr;
          }
        } catch (e1) {
          console.warn('writable write failed, trying Blob', e1);
          // روش ۲: Blob
          try {
            const writable = await fileHandle.createWritable({ keepExistingData: false });
            try {
              await writable.write(new Blob([bytes], { type: 'application/json;charset=utf-8' }));
              await writable.close();
              wrote = true;
            } catch (wErr2) {
              try { await writable.abort(); } catch (_) {}
              throw wErr2;
            }
          } catch (e2) {
            console.warn('Blob write failed', e2);
            return false;
          }
        }

        if (!wrote) return false;

        // تأیید: فایل نباید ۰ بایت باشد
        try {
          const file = await fileHandle.getFile();
          if (!file || file.size < 2) {
            console.warn('backup file size is 0 after write', file && file.size);
            // تلاش آخر: نوشتن با seek
            try {
              const writable = await fileHandle.createWritable({ keepExistingData: false });
              await writable.seek(0);
              await writable.write(bytes);
              await writable.truncate(bytes.byteLength);
              await writable.close();
              const file2 = await fileHandle.getFile();
              if (!file2 || file2.size < 2) return false;
            } catch (e3) {
              console.warn('retry write failed', e3);
              return false;
            }
          }
        } catch (verErr) {
          // بعضی محیط‌ها getFile بعد از write محدود است؛ اگر نوشتن بدون خطا بود قبول می‌کنیم
          console.warn('could not verify file size', verErr);
        }

        return true;
      } catch (e) {
        console.warn('writeBackupToFolder failed', e);
        return false;
      }
    }


    function coerceNumber(v, fallback = 0) {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (v === undefined || v === null || v === '') return fallback;
      const n = parseNumber(String(v));
      return Number.isFinite(n) ? n : fallback;
    }

    function normalizeImportedLoan(l) {
      if (!l || typeof l !== 'object' || Array.isArray(l)) return null;
      // پشتیبانی از نام فیلدهای قدیمی / جایگزین
      const id = (l.id != null && l.id !== '') ? l.id
        : (l.loanId != null ? l.loanId : (Date.now() + Math.floor(Math.random() * 10000)));
      const rawInst = l.installments || l.installmentList || l.qs || l.aghsat || [];
      let installments = Array.isArray(rawInst) ? rawInst.map((inst, idx) => {
        if (!inst || typeof inst !== 'object') {
          return { number: idx + 1, date: '', amount: 0, paid: false, paidAt: null, paidFrom: null, receiptNo: null };
        }
        const rawDate = inst.date || inst.dueDate || inst.due || inst.tarikh || '';
        let dateStr = '';
        try {
          const n = normalizeJalaliDateString(toEnglishDigits(String(rawDate)).replace(/[\/\.\s]/g, '-'));
          dateStr = n || String(rawDate || '');
        } catch (_) {
          dateStr = String(rawDate || '');
        }
        const paidFlag = !!(inst.paid ?? inst.isPaid ?? inst.pardakht);
        return {
          number: coerceNumber(inst.number ?? inst.num ?? inst.no ?? (idx + 1), idx + 1),
          date: dateStr,
          amount: coerceNumber(inst.amount ?? inst.mablagh ?? inst.value, coerceNumber(l.installmentAmount ?? l.installment_amount)),
          paid: paidFlag,
          paidAt: paidFlag ? (inst.paidAt || inst.paid_at || inst.pardakhtAt || null) : null,
          paidFrom: paidFlag ? (inst.paidFrom || inst.paid_from || inst.source || null) : null,
          receiptNo: paidFlag ? (inst.receiptNo || inst.receipt_no || inst.receipt || null) : null
        };
      }) : [];
      installments = installments
        .sort((a, b) => (a.number || 0) - (b.number || 0))
        .map((inst, idx) => ({ ...inst, number: idx + 1 }));
      const countFromArr = installments.length;
      let installmentCount = coerceNumber(
        l.installmentCount ?? l.installment_count ?? l.count ?? l.aqsatCount,
        0
      );
      if (countFromArr > 0) installmentCount = countFromArr;
      const startRaw = l.startDate || l.start_date || l.start || l.tarikhShoru || '';
      let startNorm = String(startRaw || '');
      try {
        startNorm = (typeof parseUserDateInput === 'function' ? parseUserDateInput(String(startRaw)) : '')
          || normalizeJalaliDateString(toEnglishDigits(String(startRaw)).replace(/[\/\.\s]/g, '-'))
          || String(startRaw || '');
      } catch (_) {}
      return {
        id,
        name: String(l.name || l.title || l.loanName || 'بدون نام'),
        party: String(l.party || l.side || l.counterparty || l.taraf || ''),
        amount: coerceNumber(l.amount ?? l.total ?? l.mablagh ?? l.loanAmount),
        installmentAmount: coerceNumber(l.installmentAmount ?? l.installment_amount ?? l.qestAmount),
        installmentCount,
        startDate: startNorm,
        icon: typeof l.icon === 'string' ? l.icon : '',
        installments
      };
    }

    function validateBackupEnvelope(data) {
      if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: true, legacy: true };
      const hasEnvelope = data.backupVersion != null || data.schemaVersion != null || data.source === 'EasyVAM';
      if (!hasEnvelope) return { ok: true, legacy: true };
      const backupVersion = Number(data.backupVersion || 1);
      const schemaVersion = Number(data.schemaVersion || 1);
      if (!Number.isFinite(backupVersion) || backupVersion < 1) return { ok: false, message: 'نسخه بکاپ نامعتبر است.' };
      if (backupVersion > BACKUP_VERSION) return { ok: false, message: `این بکاپ مربوط به نسخه جدیدتری است (v${backupVersion}). ابتدا برنامه را به‌روزرسانی کنید.` };
      if (!Number.isFinite(schemaVersion) || schemaVersion < 1) return { ok: false, message: 'نسخه ساختار داده نامعتبر است.' };
      if (schemaVersion > DATA_SCHEMA_VERSION) return { ok: false, message: `ساختار این بکاپ جدیدتر از برنامه است (Schema ${schemaVersion}).` };
      if (data.data != null && (typeof data.data !== 'object' || Array.isArray(data.data))) return { ok: false, message: 'بخش data در بکاپ معتبر نیست.' };
      return { ok: true, legacy: false, backupVersion, schemaVersion };
    }

    /** استخراج آرایه وام از انواع ساختار بکاپ قدیمی/جدید */
    function extractLoansFromBackup(data) {
      if (!data) return { loans: null, loanOrder: null, settings: null, theme: null, iconAssets: null, users: null, bankAccounts: null };
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (_) { return { loans: null, loanOrder: null, settings: null, theme: null, iconAssets: null, users: null, bankAccounts: null }; }
      }
      if (Array.isArray(data)) {
        return { loans: data, loanOrder: null, settings: null, theme: null, iconAssets: null, users: null, bankAccounts: null };
      }
      if (typeof data !== 'object') {
        return { loans: null, loanOrder: null, settings: null, theme: null, iconAssets: null, users: null, bankAccounts: null };
      }
      const candidates = [
        data.loans,
        data.data && data.data.loans,
        data.data,
        data.items,
        data.loanList,
        data.vamha,
        data.backup && data.backup.loans,
        data.payload && data.payload.loans
      ];
      let loansArr = null;
      for (const c of candidates) {
        if (Array.isArray(c)) { loansArr = c; break; }
      }
      if (!loansArr && (data.name || data.startDate || data.installments) && (data.amount != null || data.installmentAmount != null)) {
        loansArr = [data];
      }
      return {
        loans: loansArr,
        loanOrder: Array.isArray(data.loanOrder) ? data.loanOrder
          : (data.data && Array.isArray(data.data.loanOrder) ? data.data.loanOrder
          : (Array.isArray(data.order) ? data.order : null)),
        settings: data.settings || data.appSettings || (data.data && data.data.settings) || null,
        theme: data.theme || (data.data && data.data.theme) || null,
        users: Array.isArray(data.users) ? data.users : (data.data && Array.isArray(data.data.users) ? data.data.users : null),
        bankAccounts: Array.isArray(data.bankAccounts) ? data.bankAccounts
          : (data.data && Array.isArray(data.data.bankAccounts) ? data.data.bankAccounts : null),
        paymentReceipts: Array.isArray(data.paymentReceipts) ? data.paymentReceipts
          : (data.data && Array.isArray(data.data.paymentReceipts) ? data.data.paymentReceipts : null),
        iconAssets: (data.iconAssets && typeof data.iconAssets === 'object') ? data.iconAssets
          : (data.data && data.data.iconAssets && typeof data.data.iconAssets === 'object') ? data.data.iconAssets
          : (data.backup && data.backup.iconAssets ? data.backup.iconAssets : null)
      };
    }

    function importData(event){
      const file = event.target.files?.[0];
      if (!file) return showToast('فایل JSON را انتخاب کنید.', 'error');
      const name = (file.name || '').toLowerCase();
      if (name && !name.endsWith('.json') && !name.endsWith('.txt') && !name.endsWith('.backup')) {
        showToast('بهتر است فایل JSON پشتیبان را انتخاب کنید.', 'warning');
      }
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          let raw = e.target.result;
          if (raw == null) return showToast('فایل خالی است.', 'error');
          raw = String(raw).replace(/^\uFEFF/, '').trim();
          if (!raw) return showToast('فایل خالی است.', 'error');

          let data;
          try {
            data = JSON.parse(raw);
          } catch (parseErr) {
            try {
              data = JSON.parse(JSON.parse(raw));
            } catch (_) {
              throw new Error('فایل JSON معتبر نیست. مطمئن شوید بکاپ EasyVAM را انتخاب کرده‌اید.');
            }
          }

          const envelope = validateBackupEnvelope(data);
          if (!envelope.ok) return showToast(envelope.message, 'error');

          const extracted = extractLoansFromBackup(data);
          let importedLoans = extracted.loans;
          let importedOrder = extracted.loanOrder;
          let importedSettings = extracted.settings;
          let importedTheme = extracted.theme;
          let importedIconAssets = extracted.iconAssets;
          let importedUsers = extracted.users;
          let importedBankAccounts = extracted.bankAccounts;
          let importedPaymentReceipts = extracted.paymentReceipts;

          if (!importedLoans || !Array.isArray(importedLoans)) {
            return showToast('ساختار فایل نامعتبر است (آرایه وام پیدا نشد).', 'error');
          }
          if (!importedLoans.length) {
            return showToast('هیچ وامی داخل فایل پشتیبان نیست.', 'warning');
          }

          const normalized = importedLoans.map(normalizeImportedLoan).filter(Boolean);
          if (!normalized.length) {
            return showToast('وام‌های فایل قابل خواندن نبودند (فرمت ناشناخته).', 'error');
          }

          let updateCount = 0;
          let addCount = 0;
          normalized.forEach(nl => {
            if (loans.some(l => String(l.id) === String(nl.id))) updateCount++;
            else addCount++;
          });

          const msg = updateCount > 0
            ? `${toPersianDigits(normalized.length)} وام در فایل است: ${toPersianDigits(addCount)} جدید و ${toPersianDigits(updateCount)} جایگزین می‌شود. ادامه می‌دهید؟`
            : `${toPersianDigits(addCount)} وام جدید اضافه می‌شود. ادامه می‌دهید؟`;

          let ok = false;
          try {
            ok = await showConfirmGlass(msg, {
              title: 'بازیابی از پشتیبان',
              okText: 'تأیید و ادغام',
              cancelText: 'انصراف'
            });
          } catch (_) {
            ok = window.confirm(msg);
          }
          if (!ok) {
            showToast('بازیابی لغو شد.', 'info');
            return;
          }

          if (importedIconAssets && typeof importedIconAssets === 'object') {
            try {
              embeddedBankIconAssets = { ...embeddedBankIconAssets, ...importedIconAssets };
              localStorage.setItem('vam_bank_icon_assets', JSON.stringify(embeddedBankIconAssets));
            } catch (e) {
              console.warn('Could not restore bank icon assets', e);
            }
          }

          if (Array.isArray(importedUsers)) {
            try { localStorage.setItem('vam_users', JSON.stringify(importedUsers)); } catch(_) {}
          }
          if (Array.isArray(importedBankAccounts)) {
            try { setBankAccounts(importedBankAccounts); } catch(_) {}
          }
          if (Array.isArray(importedPaymentReceipts)) {
            try { setPaymentReceiptsStore(importedPaymentReceipts); } catch(_) {}
          }

          if (importedSettings && typeof importedSettings === 'object') {
            try {
              localStorage.setItem('vam_app_settings', JSON.stringify(importedSettings));
              appSettings = { ...appSettings, ...importedSettings };
            } catch(_){}
          }
          if (importedTheme) {
            try { localStorage.setItem('vam_theme', importedTheme); applyTheme(importedTheme); } catch(_){}
          }

          let addedCount = 0;
          let updatedCount = 0;
          const isFullNativeBackup = !extracted.legacy && Number(envelope.schemaVersion || 0) >= 4 && data?.source === 'EasyVAM';
          if (isFullNativeBackup) {
            updatedCount = normalized.filter(nl => loans.some(l => String(l.id) === String(nl.id))).length;
            addedCount = normalized.filter(nl => !loans.some(l => String(l.id) === String(nl.id))).length;
            loans = normalized;
            loanOrder = Array.isArray(importedOrder) && importedOrder.length
              ? importedOrder.filter(id => loans.some(l => String(l.id) === String(id)))
              : loans.map(l => l.id);
            loans.forEach(l => { if (!loanOrder.some(id => String(id) === String(l.id))) loanOrder.push(l.id); });
          } else {
            normalized.forEach(newLoan => {
              const idx = loans.findIndex(l => String(l.id) === String(newLoan.id));
              if (idx > -1) {
                loans[idx] = newLoan;
                updatedCount++;
              } else {
                loans.push(newLoan);
                if (!loanOrder.some(id => String(id) === String(newLoan.id))) loanOrder.push(newLoan.id);
                addedCount++;
              }
            });
          }
          if (!isFullNativeBackup && importedOrder && importedOrder.length) {
            const idSet = new Set(loans.map(l => String(l.id)));
            loanOrder = importedOrder.filter(id => idSet.has(String(id)));
            loans.forEach(l => {
              if (!loanOrder.some(id => String(id) === String(l.id))) loanOrder.push(l.id);
            });
          }
          persist();
          try { updateSelects(); } catch(_){}
          try { renderDashboard(); } catch(_){}
          showToast(`${toPersianDigits(addedCount)} وام جدید · ${toPersianDigits(updatedCount)} به‌روزرسانی شد.`, 'success');
        } catch (err) {
          console.error('importData failed', err);
          showToast(`خطا در خواندن فایل: ${err.message || 'نامشخص'}`, 'error');
        }
      };
      reader.onerror = () => showToast('خواندن فایل ناموفق بود.', 'error');
      reader.readAsText(file, 'UTF-8');
      setTimeout(() => { try { event.target.value = ''; } catch(_){} }, 500);
    }

    // ============================================================
    //  THEME
    // ============================================================
    function applyTheme(theme) {
      const isDark = theme === 'dark';
      document.body.classList.toggle('dark-theme', isDark);
      localStorage.setItem('vam_theme', isDark ? 'dark' : 'light');
      const icon = document.getElementById('theme-icon');
      const label = document.getElementById('theme-label');
      if (icon) icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
      if (label) label.textContent = isDark ? 'تم روشن' : 'تم تاریک';
    }
    function toggleTheme() {
      const next = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
      applyTheme(next);
      showToast(next === 'dark' ? 'تم تاریک فعال شد' : 'تم روشن فعال شد', 'info');
    }

    // ============================================================
    //  ACCOUNT / AUTH (multi-user)
    // ============================================================
    function migrateUsersIfNeeded() {
      let users = safeParseJSON('vam_users', null);
      if (Array.isArray(users)) return users;
      // migrate old single account
      const old = safeParseJSON('vam_account', null);
      users = [];
      if (old && old.username) {
        users.push({
          id: Date.now(),
          username: old.username,
          passwordHash: old.passwordHash || '',
          fingerprint: !!old.fingerprint,
          fingerprintRegistered: !!old.fingerprintRegistered
        });
      }
      localStorage.setItem('vam_users', JSON.stringify(users));
      return users;
    }
    function getUsers() {
      return migrateUsersIfNeeded();
    }
    function saveUsers(users) {
      localStorage.setItem('vam_users', JSON.stringify(users));
    }
    function getAccount() {
      // current logged-in user, or first user (compat)
      const users = getUsers();
      const uid = sessionStorage.getItem('vam_user_id') || localStorage.getItem('vam_last_user_id');
      if (uid) {
        const u = users.find(x => String(x.id) === String(uid));
        if (u) return u;
      }
      return users[0] || null;
    }
    function getUserById(id) {
      return getUsers().find(u => String(u.id) === String(id)) || null;
    }
    function getUserCredKey(userId) {
      return 'vam_webauthn_cred_' + userId;
    }
    const PBKDF2_ITERS = 100000;

    function bytesToHex(buf) {
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    function hexToBytes(hex) {
      const out = new Uint8Array(Math.floor(String(hex || '').length / 2));
      for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16) || 0;
      return out;
    }

    /** هش legacy (نسخه‌های قدیمی): SHA-256 بدون salt */
    async function hashPasswordLegacy(pw) {
      if (!pw) return '';
      try {
        const enc = new TextEncoder().encode(pw);
        const buf = await crypto.subtle.digest('SHA-256', enc);
        return bytesToHex(buf);
      } catch (e) {
        // fallback ضعیف‌تر فقط وقتی WebCrypto نیست
        return fallbackIterHash(pw, 'legacy-salt', 5000);
      }
    }

    /** هش تکرارشونده بدون WebCrypto (بهتر از یک حلقه ساده) */
    function fallbackIterHash(pw, salt, rounds) {
      let s = String(salt) + '|' + String(pw);
      for (let r = 0; r < rounds; r++) {
        let h = 2166136261;
        for (let i = 0; i < s.length; i++) {
          h ^= s.charCodeAt(i);
          h = Math.imul(h, 16777619);
        }
        s = (h >>> 0).toString(16) + s.slice(0, 48);
      }
      let out = '';
      for (let i = 0; i < 32; i++) {
        let h = 0;
        const chunk = s + ':' + i;
        for (let j = 0; j < chunk.length; j++) h = ((h << 5) - h + chunk.charCodeAt(j)) | 0;
        out += ((h >>> 0) & 0xff).toString(16).padStart(2, '0');
      }
      return out;
    }

    /**
     * هش امن رمز: PBKDF2-SHA256 + salt تصادفی
     * فرمت ذخیره: pbkdf2$<iters>$<saltHex>$<hashHex>
     * سازگار با هش‌های قدیمی (SHA-256 خالص) در verifyPassword
     */
    async function hashPassword(pw, existingSaltHex) {
      if (!pw) return '';
      try {
        if (!crypto?.subtle) throw new Error('no-subtle');
        const salt = existingSaltHex
          ? hexToBytes(existingSaltHex)
          : crypto.getRandomValues(new Uint8Array(16));
        const keyMaterial = await crypto.subtle.importKey(
          'raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']
        );
        const bits = await crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
          keyMaterial,
          256
        );
        return `pbkdf2$${PBKDF2_ITERS}$${bytesToHex(salt)}$${bytesToHex(bits)}`;
      } catch (e) {
        const saltHex = existingSaltHex || bytesToHex(
          (typeof crypto !== 'undefined' && crypto.getRandomValues)
            ? crypto.getRandomValues(new Uint8Array(16))
            : Uint8Array.from({ length: 16 }, (_, i) => (Date.now() + i * 17) & 0xff)
        );
        const hash = fallbackIterHash(pw, saltHex, 12000);
        return `fbk$${saltHex}$${hash}`;
      }
    }

    async function verifyPassword(pw, stored) {
      if (!stored) return !pw;
      if (!pw) return false;
      // فرمت جدید PBKDF2
      if (stored.startsWith('pbkdf2$')) {
        const parts = stored.split('$');
        if (parts.length !== 4) return false;
        const saltHex = parts[2];
        const recomputed = await hashPassword(pw, saltHex);
        return recomputed === stored;
      }
      // fallback بدون WebCrypto
      if (stored.startsWith('fbk$')) {
        const parts = stored.split('$');
        if (parts.length !== 3) return false;
        const saltHex = parts[1];
        const hash = fallbackIterHash(pw, saltHex, 12000);
        return `fbk$${saltHex}$${hash}` === stored;
      }
      // سازگاری با هش قدیمی SHA-256
      const legacy = await hashPasswordLegacy(pw);
      return legacy === stored;
    }

    function fillLoginUserSelect() {
      const sel = document.getElementById('login-username');
      if (!sel) return;
      const users = getUsers();
      const prev = sel.value;
      sel.innerHTML = '';
      if (!users.length) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '— هنوز کاربری نیست —';
        sel.appendChild(opt);
        updateLoginAvatarUI(null);
        return;
      }
      users.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = u.username;
        sel.appendChild(opt);
      });
      const last = localStorage.getItem('vam_last_user_id');
      if (prev && users.some(u => String(u.id) === String(prev))) sel.value = prev;
      else if (last && users.some(u => String(u.id) === String(last))) sel.value = last;
      updateLoginAvatarUI(getUserById(sel.value));
    }
    function onLoginUserChange() {
      updateLoginAvatarUI(getUserById(document.getElementById('login-username')?.value));
      checkFingerprintUi();
    }
    function updateLoginAvatarUI(user) {
      const img = document.getElementById('login-avatar-img');
      const fb = document.getElementById('login-avatar-fallback');
      const nameEl = document.getElementById('login-welcome-name');
      if (nameEl) nameEl.textContent = user?.username ? ('سلام، ' + user.username) : 'خوش آمدید';
      if (!img || !fb) return;
      if (user?.avatar) {
        img.src = user.avatar;
        img.classList.add('show');
        fb.classList.add('hide');
      } else {
        img.removeAttribute('src');
        img.classList.remove('show');
        fb.classList.remove('hide');
      }
    }
    function compressImageFile(file, maxSize, quality) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('خواندن فایل ناموفق بود'));
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            let w = img.width, h = img.height;
            const scale = Math.min(1, (maxSize || 240) / Math.max(w, h));
            w = Math.round(w * scale);
            h = Math.round(h * scale);
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', quality || 0.72));
          };
          img.onerror = () => reject(new Error('تصویر نامعتبر است'));
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    }
    async function onLoginAvatarSelected(event) {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      const user = getUserById(document.getElementById('login-username')?.value);
      if (!user) return showToast('ابتدا یک کاربر انتخاب کنید.', 'warning');
      try {
        const dataUrl = await compressImageFile(file, 240, 0.7);
        saveUsers(getUsers().map(u => String(u.id) === String(user.id) ? { ...u, avatar: dataUrl } : u));
        updateLoginAvatarUI(getUserById(user.id));
        renderUsersList();
        showToast('عکس پروفایل ذخیره شد.', 'success');
      } catch (e) {
        showToast(e.message || 'خطا در ذخیره عکس', 'error');
      }
    }
    async function onAccountAvatarSelected(event) {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      try {
        const dataUrl = await compressImageFile(file, 240, 0.7);
        document.getElementById('acc-avatar-data').value = dataUrl;
        const img = document.getElementById('acc-avatar-img');
        const fb = document.getElementById('acc-avatar-fallback');
        if (img) { img.src = dataUrl; img.classList.add('show'); }
        if (fb) fb.classList.add('hide');
      } catch (e) {
        showToast(e.message || 'خطا در انتخاب عکس', 'error');
      }
    }
    function setAccountAvatarPreview(avatar) {
      const img = document.getElementById('acc-avatar-img');
      const fb = document.getElementById('acc-avatar-fallback');
      const hidden = document.getElementById('acc-avatar-data');
      if (hidden) hidden.value = avatar || '';
      if (!img || !fb) return;
      if (avatar) {
        img.src = avatar;
        img.classList.add('show');
        fb.classList.add('hide');
      } else {
        img.removeAttribute('src');
        img.classList.remove('show');
        fb.classList.remove('hide');
      }
    }

    async function openAccountModal(userId) {
      const menu = document.getElementById('side-menu');
      if (menu && menu.classList.contains('open')) {
        closeSideMenu();
        await new Promise(r => setTimeout(r, 290));
      }
      closeUsersModal();
      const isNew = userId === null || userId === undefined || userId === '';
      const user = isNew ? null : (userId ? getUserById(userId) : getAccount());
      document.getElementById('acc-user-id').value = user ? user.id : '';
      document.getElementById('acc-username').value = user ? user.username : '';
      document.getElementById('acc-password').value = '';
      document.getElementById('acc-password2').value = '';
      document.getElementById('acc-fingerprint').checked = !!(user && user.fingerprint);
      setAccountAvatarPreview(user?.avatar || '');
      document.getElementById('account-modal-title').innerHTML = user
        ? '<i class="fa-solid fa-user-shield me-2 text-indigo-500"></i>ویرایش کاربر'
        : '<i class="fa-solid fa-user-plus me-2 text-indigo-500"></i>افزودن کاربر';
      const delBtn = document.getElementById('btn-delete-account');
      if (delBtn) delBtn.style.display = user ? 'inline-flex' : 'none';

      const statusEl = document.getElementById('webauthn-status');
      if (statusEl) {
        statusEl.textContent = 'در حال بررسی پشتیبانی دستگاه...';
        const avail = await isWebAuthnAvailable();
        const stored = user ? safeParseJSON(getUserCredKey(user.id), null) : null;
        if (!avail.ok) {
          const map = {
            secure: '⚠️ WebAuthn فقط روی HTTPS یا localhost فعال است.',
            api: '⚠️ این مرورگر از WebAuthn پشتیبانی نمی‌کند.',
            platform: '⚠️ بیومتریک این دستگاه در دسترس نیست.'
          };
          statusEl.textContent = map[avail.reason] || '⚠️ WebAuthn در دسترس نیست.';
          statusEl.style.color = '#f59e0b';
        } else if (stored?.rawId && user?.fingerprintRegistered) {
          statusEl.textContent = '✓ اثر انگشت برای این کاربر ثبت شده است.';
          statusEl.style.color = '#22c55e';
        } else {
          statusEl.textContent = '✓ دستگاه آماده ثبت اثر انگشت است.';
          statusEl.style.color = '#22c55e';
        }
      }
      document.getElementById('account-modal').classList.add('open');
    }
    function closeAccountModal() {
      document.getElementById('account-modal').classList.remove('open');
    }
    function openAccountModalFromLogin() {
      // allow editing selected user or create new
      const sel = document.getElementById('login-username');
      const id = sel?.value;
      if (id) openAccountModal(id);
      else openAccountModal(null);
    }
    function openUsersModalFromLogin() {
      openUsersModal();
    }

    async function saveAccountSettings() {
      const editId = document.getElementById('acc-user-id').value;
      const username = document.getElementById('acc-username').value.trim();
      const pw = document.getElementById('acc-password').value;
      const pw2 = document.getElementById('acc-password2').value;
      const fingerprint = document.getElementById('acc-fingerprint').checked;
      if (!username) return showToast('نام کاربری را وارد کنید.', 'error');

      let users = getUsers();
      const isNew = !editId;
      if (users.some(u => u.username === username && String(u.id) !== String(editId))) {
        return showToast('این نام کاربری قبلاً ثبت شده است.', 'error');
      }

      let passwordHash = '';
      if (isNew) {
        if (!pw || pw.length < 4) return showToast('برای کاربر جدید رمز حداقل ۴ کاراکتر لازم است.', 'error');
        if (pw !== pw2) return showToast('تکرار رمز مطابقت ندارد.', 'error');
        passwordHash = await hashPassword(pw);
      } else {
        const existing = getUserById(editId);
        passwordHash = existing?.passwordHash || '';
        if (pw || pw2) {
          if (pw.length < 4) return showToast('رمز باید حداقل ۴ کاراکتر باشد.', 'error');
          if (pw !== pw2) return showToast('تکرار رمز مطابقت ندارد.', 'error');
          passwordHash = await hashPassword(pw);
        }
      }

      const existingUser = isNew ? null : getUserById(editId);
      const avatarData = document.getElementById('acc-avatar-data')?.value || existingUser?.avatar || '';

      let user = {
        id: isNew ? Date.now() : Number(editId) || editId,
        username,
        passwordHash,
        avatar: avatarData,
        fingerprint: false,
        fingerprintRegistered: false
      };

      if (fingerprint) {
        try {
          await registerFingerprint(username, user.id);
          user.fingerprint = true;
          user.fingerprintRegistered = true;
        } catch (e) {
          console.warn(e);
          user.fingerprint = false;
          user.fingerprintRegistered = false;
          showToast(webAuthnErrorMessage(e) + ' — کاربر بدون اثر انگشت ذخیره شد.', 'warning');
        }
      } else {
        localStorage.removeItem(getUserCredKey(user.id));
      }

      if (isNew) users.push(user);
      else users = users.map(u => String(u.id) === String(user.id) ? user : u);
      saveUsers(users);
      // keep legacy single-account key in sync with first/current user
      localStorage.setItem('vam_account', JSON.stringify(user));
      fillLoginUserSelect();
      closeAccountModal();
      renderUsersList();
      showToast(isNew ? 'کاربر جدید اضافه شد.' : 'کاربر به‌روزرسانی شد.', 'success');
    }

    function deleteCurrentEditingUser() {
      const editId = document.getElementById('acc-user-id').value;
      if (!editId) return;
      showConfirmGlass('این کاربر حذف شود؟', {
        title: 'حذف کاربر',
        okText: 'حذف',
        cancelText: 'انصراف'
      }).then(ok => {
        if (!ok) return;
        let users = getUsers().filter(u => String(u.id) !== String(editId));
        saveUsers(users);
        localStorage.removeItem(getUserCredKey(editId));
        if (sessionStorage.getItem('vam_user_id') === String(editId)) {
          sessionStorage.removeItem('vam_logged_in');
          sessionStorage.removeItem('vam_user_id');
        }
        closeAccountModal();
        fillLoginUserSelect();
        renderUsersList();
        showToast('کاربر حذف شد.', 'success');
      });

    }
    function clearAccountSettings() {
      deleteCurrentEditingUser();
    }

    function openUsersModal() {
      afterSideMenuClose(() => {
        closeAccountModal();
        renderUsersList();
        document.getElementById('users-modal').classList.add('open');
      });
    }
    function closeUsersModal() {
      document.getElementById('users-modal')?.classList.remove('open');
    }
    function renderUsersList() {
      const box = document.getElementById('users-list');
      if (!box) return;
      const users = getUsers();
      const currentId = sessionStorage.getItem('vam_user_id');
      if (!users.length) {
        box.innerHTML = '<p class="text-sm" style="color:#94a3b8;text-align:center;padding:12px;">هنوز کاربری ثبت نشده است.</p>';
        return;
      }
      box.innerHTML = users.map(u => {
        const isCurrent = String(u.id) === String(currentId);
        const av = u.avatar
          ? `<img src="${u.avatar}" alt="" style="width:42px;height:42px;border-radius:50%;object-fit:cover;border:2px solid rgba(99,102,241,.35);" />`
          : `<div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#e0e7ff,#c7d2fe);display:flex;align-items:center;justify-content:center;color:#4f46e5;"><i class="fa-solid fa-user"></i></div>`;
        return `
          <div class="glass rounded-xl p-3 border border-white/30 flex items-center justify-between gap-2">
            <div class="flex items-center gap-3 min-w-0">
              ${av}
              <div class="min-w-0">
                <div class="font-semibold text-slate-800 truncate">${u.username}${isCurrent ? ' <span class="text-xs text-indigo-500">(فعلی)</span>' : ''}</div>
                <div class="text-xs" style="color:#94a3b8;">
                  ${u.passwordHash ? 'رمز: دارد' : 'رمز: ندارد'}
                  ${u.fingerprintRegistered ? ' · اثر انگشت: فعال' : ''}
                </div>
              </div>
            </div>
            <div class="flex gap-1 shrink-0">
              <button class="btn-glass text-xs px-2 py-1" onclick="openAccountModal('${u.id}')" title="ویرایش">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="btn-glass btn-glass-danger text-xs px-2 py-1" onclick="deleteUserById('${u.id}')" title="حذف">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>`;
      }).join('');
    }
    function deleteUserById(id) {
      showConfirmGlass('این کاربر حذف شود؟', {
        title: 'حذف کاربر',
        okText: 'حذف',
        cancelText: 'انصراف'
      }).then(ok => {
        if (!ok) return;
        let users = getUsers().filter(u => String(u.id) !== String(id));
        saveUsers(users);
        localStorage.removeItem(getUserCredKey(id));
        if (sessionStorage.getItem('vam_user_id') === String(id)) {
          sessionStorage.removeItem('vam_logged_in');
          sessionStorage.removeItem('vam_user_id');
        }
        fillLoginUserSelect();
        renderUsersList();
        showToast('کاربر حذف شد.', 'success');
      });

    }

    // ---------- WebAuthn helpers ----------
    let webAuthnAbortController = null;
    let webAuthnInProgress = false;

    function bufferToBase64url(buf) {
      const bytes = new Uint8Array(buf);
      let str = '';
      for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
      return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    function base64urlToBuffer(base64url) {
      const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
      const base64 = (base64url + pad).replace(/-/g, '+').replace(/_/g, '/');
      const raw = atob(base64);
      const buf = new ArrayBuffer(raw.length);
      const view = new Uint8Array(buf);
      for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
      return buf;
    }
    function getRpId() {
      const host = location.hostname;
      if (!host || host === 'localhost' || host === '127.0.0.1') return host || undefined;
      return host;
    }
    async function isWebAuthnAvailable() {
      if (!window.isSecureContext) return { ok: false, reason: 'secure' };
      if (!window.PublicKeyCredential) return { ok: false, reason: 'api' };
      try {
        if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
          const uvpa = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          if (!uvpa) return { ok: false, reason: 'platform' };
        }
      } catch (e) {
        return { ok: false, reason: 'platform' };
      }
      return { ok: true };
    }
    function webAuthnErrorMessage(err) {
      const name = err?.name || '';
      const msg = (err?.message || '').toString();
      if (name === 'NotAllowedError') return 'عملیات توسط کاربر لغو شد یا زمان آن تمام شد.';
      if (name === 'InvalidStateError') return 'این اثر انگشت قبلاً ثبت شده است.';
      if (name === 'NotSupportedError') return 'اثر انگشت در این دستگاه پشتیبانی نمی‌شود.';
      if (name === 'SecurityError') return 'برای اثر انگشت باید برنامه روی HTTPS یا localhost اجرا شود.';
      if (name === 'AbortError' || /already pending|request is already pending/i.test(msg)) {
        return 'درخواست اثر انگشت قبلی هنوز در جریان است. لطفاً صبر کنید یا دوباره تلاش کنید.';
      }
      return msg || 'خطای ناشناخته در WebAuthn';
    }
    async function registerFingerprint(username, userId) {
      const avail = await isWebAuthnAvailable();
      if (!avail.ok) {
        const map = {
          secure: 'برای اثر انگشت باید از HTTPS یا localhost استفاده کنید.',
          api: 'مرورگر از WebAuthn پشتیبانی نمی‌کند.',
          platform: 'احراز هویت بیومتریک روی این دستگاه در دسترس نیست.'
        };
        throw new Error(map[avail.reason] || 'WebAuthn در دسترس نیست');
      }
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const uid = userId || Date.now();
      const userIdBytes = new TextEncoder().encode(String(uid));
      const rpId = getRpId();
      const publicKey = {
        challenge,
        rp: { name: 'سیستم مدیریت وام', ...(rpId ? { id: rpId } : {}) },
        user: { id: userIdBytes, name: username || 'user', displayName: username || 'کاربر' },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 }
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'discouraged',
          requireResidentKey: false
        },
        timeout: 60000,
        attestation: 'none'
      };
      const existing = safeParseJSON(getUserCredKey(uid), null);
      if (existing?.rawId) {
        publicKey.excludeCredentials = [{
          type: 'public-key',
          id: base64urlToBuffer(existing.rawId),
          transports: existing.transports || ['internal']
        }];
      }
      const cred = await navigator.credentials.create({ publicKey });
      if (!cred) throw new Error('ثبت اثر انگشت انجام نشد.');
      const rawId = bufferToBase64url(cred.rawId);
      const transports = cred.response?.getTransports?.() || ['internal'];
      localStorage.setItem(getUserCredKey(uid), JSON.stringify({
        id: cred.id,
        rawId,
        transports,
        type: cred.type,
        username: username || 'user',
        userId: uid,
        createdAt: new Date().toISOString()
      }));
      return true;
    }
    async function loginWithFingerprint() {
      // جلوگیری از درخواست همزمان (علت خطای "A request is already pending")
      if (webAuthnInProgress) {
        return;
      }
      // لغو درخواست قبلی در صورت وجود
      if (webAuthnAbortController) {
        try { webAuthnAbortController.abort(); } catch (_) {}
        webAuthnAbortController = null;
      }

      webAuthnInProgress = true;
      const controller = new AbortController();
      webAuthnAbortController = controller;

      try {
        const avail = await isWebAuthnAvailable();
        if (!avail.ok) {
          const map = {
            secure: 'اثر انگشت فقط روی HTTPS یا localhost کار می‌کند.',
            api: 'مرورگر از WebAuthn پشتیبانی نمی‌کند.',
            platform: 'بیومتریک این دستگاه در دسترس نیست.'
          };
          return showToast(map[avail.reason] || 'WebAuthn در دسترس نیست', 'error');
        }
        const sel = document.getElementById('login-username');
        const userId = sel?.value;
        const user = getUserById(userId);
        if (!user) return showToast('کاربر را انتخاب کنید.', 'error');
        const stored = safeParseJSON(getUserCredKey(user.id), null);
        if (!stored?.rawId) return showToast('برای این کاربر اثر انگشت ثبت نشده است.', 'warning');

        const challenge = crypto.getRandomValues(new Uint8Array(32));
        const rpId = getRpId();
        const assertion = await navigator.credentials.get({
          publicKey: {
            challenge,
            timeout: 60000,
            userVerification: 'required',
            allowCredentials: [{
              type: 'public-key',
              id: base64urlToBuffer(stored.rawId),
              transports: stored.transports || ['internal']
            }],
            ...(rpId ? { rpId } : {})
          },
          signal: controller.signal
        });
        if (!assertion) return showToast('ورود با اثر انگشت انجام نشد.', 'error');
        sessionStorage.setItem('vam_logged_in', '1');
        sessionStorage.setItem('vam_user_id', String(user.id));
        localStorage.setItem('vam_last_user_id', String(user.id));
        closeUsersModal();
        closeAccountModal();
        hideLoginScreen();
        showToast('ورود با اثر انگشت موفق بود. خوش آمدید ' + user.username, 'success');
      } catch (e) {
        // AbortError ناشی از لغو عمدی را نادیده بگیر
        if (e?.name === 'AbortError') return;
        console.warn('WebAuthn login error:', e);
        showToast(webAuthnErrorMessage(e), 'error');
      } finally {
        if (webAuthnAbortController === controller) {
          webAuthnAbortController = null;
        }
        webAuthnInProgress = false;
      }
    }
    async function checkFingerprintUi() {
      const fpBtn = document.getElementById('btn-fingerprint-login');
      const pwBtn = document.getElementById('btn-password-login');
      if (!fpBtn) return;
      const sel = document.getElementById('login-username');
      const user = getUserById(sel?.value);
      const stored = user ? safeParseJSON(getUserCredKey(user.id), null) : null;
      const avail = await isWebAuthnAvailable();
      const show = !!(user?.fingerprint && stored?.rawId && avail.ok);
      fpBtn.style.display = show ? 'inline-flex' : 'none';
      // وقتی اثرانگشت فعال است، دکمه رمز را ثانویه نشان بده تا اولویت با اثرانگشت باشد
      if (pwBtn) {
        if (show) {
          pwBtn.classList.remove('login-btn-primary');
          pwBtn.classList.add('login-btn-secondary');
        } else {
          pwBtn.classList.remove('login-btn-secondary');
          pwBtn.classList.add('login-btn-primary');
        }
      }
    }
    function showLoginScreen() {
      const users = getUsers();
      const screen = document.getElementById('login-screen');
      // if no users at all, don't block app
      if (!users.length) {
        screen.classList.add('hidden');
        return;
      }
      // if users exist but none has password, still show for selection? require at least one passwordHash
      const needAuth = users.some(u => u.passwordHash);
      if (!needAuth) {
        screen.classList.add('hidden');
        return;
      }
      fillLoginUserSelect();
      screen.classList.remove('hidden');
      checkFingerprintUi().then(() => {
        // اولویت ورود با اثرانگشت: بلافاصله پس از آماده‌شدن UI، بدون تاخیر درخواست اثرانگشت
        const fpBtn = document.getElementById('btn-fingerprint-login');
        if (fpBtn && fpBtn.style.display !== 'none') {
          // آنی — بدون setTimeout تا برنامه باز شد مستقیم روی اثر انگشت برود
          if (!document.getElementById('login-screen')?.classList.contains('hidden')) {
            loginWithFingerprint();
          }
        } else {
          document.getElementById('login-password')?.focus();
        }
      });
    }
    function hideLoginScreen() {
      document.getElementById('login-screen')?.classList.add('hidden');
    }
    async function doLogin() {
      const users = getUsers();
      if (!users.length) { hideLoginScreen(); return; }
      const sel = document.getElementById('login-username');
      const user = getUserById(sel?.value);
      if (!user) return showToast('کاربر را انتخاب کنید.', 'error');
      if (!user.passwordHash) {
        sessionStorage.setItem('vam_logged_in', '1');
        sessionStorage.setItem('vam_user_id', String(user.id));
        localStorage.setItem('vam_last_user_id', String(user.id));
        closeUsersModal();
        closeAccountModal();
        hideLoginScreen();
        return showToast('خوش آمدید ' + user.username, 'success');
      }
      const pw = document.getElementById('login-password').value;
      const ok = await verifyPassword(pw, user.passwordHash);
      if (ok) {
        // ارتقای خودکار هش قدیمی به PBKDF2
        if (user.passwordHash && !String(user.passwordHash).startsWith('pbkdf2$') && !String(user.passwordHash).startsWith('fbk$')) {
          try {
            const users = getUsers();
            const idx = users.findIndex(u => String(u.id) === String(user.id));
            if (idx > -1) {
              users[idx].passwordHash = await hashPassword(pw);
              localStorage.setItem('vam_users', JSON.stringify(users));
            }
          } catch (_) {}
        }
        sessionStorage.setItem('vam_logged_in', '1');
        sessionStorage.setItem('vam_user_id', String(user.id));
        localStorage.setItem('vam_last_user_id', String(user.id));
        closeUsersModal();
        closeAccountModal();
        hideLoginScreen();
        showToast('خوش آمدید ' + user.username, 'success');
      } else {
        showToast('رمز عبور نادرست است.', 'error');
      }
    }
    function exitApp() {
      afterSideMenuClose(() => {
      showConfirmGlass('از برنامه خارج می‌شوید؟', {
        title: 'خروج',
        okText: 'خروج',
        cancelText: 'انصراف'
      }).then(ok => {
        if (!ok) return;
        sessionStorage.removeItem('vam_logged_in');
        sessionStorage.removeItem('vam_user_id');
        const users = getUsers();
        if (users.some(u => u.passwordHash)) {
          showLoginScreen();
          showToast('از حساب خارج شدید.', 'info');
        } else {
          forceCloseApp(true);
        }
      });
      });
    }
    function forceCloseApp(skipConfirm) {
      const runClose = () => {
        sessionStorage.removeItem('vam_logged_in');
        sessionStorage.removeItem('vam_user_id');
        try {
          if (navigator.app && typeof navigator.app.exitApp === 'function') {
            navigator.app.exitApp();
            return;
          }
        } catch (e) {}
        try { window.close(); } catch (e) {}
        try {
          window.open('', '_self');
          window.close();
        } catch (e) {}
        document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:Vazirmatn,Tahoma,sans-serif;background:#0f172a;color:#e2e8f0;text-align:center;padding:24px"><div><div style="font-size:40px;margin-bottom:12px">👋</div><p>می‌توانید این تب را ببندید.</p></div></div>';
      };
      if (skipConfirm) {
        runClose();
        return;
      }
      showConfirmGlass('خروج کامل از برنامه؟', {
        title: 'خروج',
        okText: 'خروج',
        cancelText: 'انصراف'
      }).then(ok => { if (ok) runClose(); });
    }

    // ============================================================
    //  EXCEL EXPORT (Persian RTL + bordered tables)
    // ============================================================
    function excelSheetFromAoA(aoa, sheetName) {
      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // approximate column widths (RTL friendly)
      const colWidths = [];
      aoa.forEach(row => {
        (row || []).forEach((cell, i) => {
          const len = String(cell ?? '').length;
          colWidths[i] = Math.max(colWidths[i] || 14, Math.min(len + 4, 48));
        });
      });
      // ensure at least width for all columns in range
      const maxCols = Math.max(0, ...aoa.map(r => (r || []).length));
      for (let i = 0; i < maxCols; i++) {
        if (!colWidths[i]) colWidths[i] = 14;
      }
      ws['!cols'] = colWidths.map(w => ({ wch: w }));

      // RTL sheet view
      if (!ws['!views']) ws['!views'] = [];
      ws['!views'].push({ rightToLeft: true, showGridLines: true });

      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      // ارتفاع ردیف‌ها برای وسط‌چین عمودی
      ws['!rows'] = [];
      for (let R = range.s.r; R <= range.e.r; ++R) {
        ws['!rows'][R] = { hpt: 22, hpx: 22 };
      }

      const border = {
        top:    { style: 'thin', color: { rgb: '94A3B8' } },
        bottom: { style: 'thin', color: { rgb: '94A3B8' } },
        left:   { style: 'thin', color: { rgb: '94A3B8' } },
        right:  { style: 'thin', color: { rgb: '94A3B8' } }
      };
      const centerAlign = {
        horizontal: 'center',
        vertical: 'center',
        wrapText: true,
        readingOrder: 2
      };

      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const addr = XLSX.utils.encode_cell({ r: R, c: C });
          // سلول خالی هم بساز تا استایل وسط‌چین اعمال شود
          if (!ws[addr]) {
            ws[addr] = { t: 's', v: '' };
          }
          if (typeof ws[addr] === 'object') {
            ws[addr].s = ws[addr].s || {};
            ws[addr].s.alignment = { ...centerAlign };
            ws[addr].s.border = border;
            if (typeof ws[addr].v === 'number' && Number.isFinite(ws[addr].v)) {
              ws[addr].z = '#,##0';
            }
            ws[addr].s.font = { name: 'Vazirmatn', sz: 11, color: { rgb: '0F172A' } };
            // ردیف عنوان / هدر جدول
            const row0 = aoa[R] && aoa[R][0];
            const isHeader =
              R === 0 ||
              (typeof row0 === 'string' && (
                row0.includes('شماره') ||
                row0.includes('نام وام') ||
                row0.includes('گزارش')
              ));
            if (isHeader) {
              ws[addr].s.font = { bold: true };
              ws[addr].s.fill = { patternType: 'solid', fgColor: { rgb: 'EEF2FF' } };
            }
          }
        }
      }

      return ws;
    }
    function downloadWorkbook(wb, filename) {
      // force workbook-level RTL
      if (!wb.Workbook) wb.Workbook = {};
      if (!wb.Workbook.Views) wb.Workbook.Views = [];
      wb.Workbook.Views[0] = { RTL: true };
      XLSX.writeFile(wb, filename, { bookType: 'xlsx', compression: true, cellStyles: true });
    }
    function exportLoanExcel() {
      if (typeof XLSX === 'undefined') return showToast('کتابخانه اکسل در دسترس نیست.', 'error');
      const sel = document.getElementById('report-loan-select');
      const id = sel?.value;
      if (!id) return showToast('یک وام انتخاب کنید.', 'error');
      const loan = loans.find(l => String(l.id) === String(id));
      if (!loan) return showToast('وام یافت نشد.', 'error');

      const paidCount = (loan.installments || []).filter(i => i.paid).length;
      const remain = Math.max((loan.installmentCount || 0) - paidCount, 0);
      const settle = getLoanSettlementDate(loan);

      const header = [
        ['گزارش بازپرداخت وام'],
        ['نام وام', loan.name],
        ['مبلغ وام (' + currencyLabel() + ')', numberWithCommas(Number(loan.amount) || 0)],
        ['مبلغ هر قسط (' + currencyLabel() + ')', numberWithCommas(Number(loan.installmentAmount) || 0)],
        ['تعداد اقساط', loan.installmentCount],
        ['پرداخت‌شده', paidCount],
        ['مانده', remain],
        ['تاریخ تسویه', settle ? formatDateToPersian(settle) : '—'],
        ['تاریخ گزارش', reportDateJalali()],
        [],
        ['شماره قسط', 'تاریخ سررسید', 'مبلغ (' + currencyLabel() + ')', 'وضعیت', 'تاریخ پرداخت']
      ];
      const rows = (loan.installments || []).map(inst => {
        const raw = Number(inst.amount);
        const amt = Number.isFinite(raw) ? raw : (Number(loan.installmentAmount) || 0);
        return [
          inst.number,
          formatDateToPersian(inst.date),
          numberWithCommas(amt),
          inst.paid ? 'پرداخت‌شده' : (isOverdue(inst) ? 'سررسید شده' : 'پرداخت‌نشده'),
          formatPaidAt(inst)
        ];
      });
      const aoa = header.concat(rows);
      const ws = excelSheetFromAoA(aoa, 'بازپرداخت');
      // merge title
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
      // print setup A4
      ws['!pageSetup'] = { paperSize: 9, orientation: 'portrait', fitToWidth: 1, fitToHeight: 0 };
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'بازپرداخت');
      downloadWorkbook(wb, `bazpardakht_${safeFilename(loan.name, 'loan')}.xlsx`);
      showToast('فایل اکسل ذخیره شد.', 'success');
    }
    function exportAllLoansExcel() {
      if (typeof XLSX === 'undefined') return showToast('کتابخانه اکسل در دسترس نیست.', 'error');
      if (!loans.length) return showToast('هیچ وامی ثبت نشده است.', 'error');
      const aoa = [
        ['گزارش کل وام‌ها'],
        ['تاریخ گزارش', reportDateJalali()],
        [],
        ['نام وام', 'مبلغ وام', 'مبلغ قسط', 'تعداد اقساط', 'پرداختی', 'مانده', 'تاریخ تسویه', 'آخرین پرداخت']
      ];
      let sumInstallments = 0;
      let sumAmounts = 0;
      loans.forEach(loan => {
        const paid = (loan.installments || []).filter(i => i.paid).length;
        const remain = Math.max((loan.installmentCount || 0) - paid, 0);
        const settle = getLoanSettlementDate(loan);
        const lastPaymentStr = getLastPaymentDate(loan);
        const amt = Number(loan.amount) || 0;
        const instAmt = Number(loan.installmentAmount) || 0;
        sumAmounts += amt;
        sumInstallments += instAmt;
        aoa.push([
          String(loan.name || 'بدون نام'),
          amt,
          instAmt,
          Number(loan.installmentCount) || 0,
          paid,
          remain,
          settle ? formatDateToPersian(settle) : '—',
          lastPaymentStr
        ]);
      });
      aoa.push([]);
      aoa.push([
        'جمع',
        sumAmounts,
        sumInstallments,
        '',
        '',
        '',
        '',
        ''
      ]);
      const ws = excelSheetFromAoA(aoa, 'وام‌ها');
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
      ws['!pageSetup'] = { paperSize: 9, orientation: 'portrait', fitToWidth: 1, fitToHeight: 0 };
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'وام‌ها');
      downloadWorkbook(wb, `gozaresh_vamha_${reportDateForFilename()}.xlsx`);
      showToast('فایل اکسل کل وام‌ها ذخیره شد.', 'success');
    }

    // ============================================================
    //  INIT
    // ============================================================
    (function init(){
      if (loanOrder.length === 0 && loans.length > 0) {
        loanOrder = loans.map(l => l.id);
        localStorage.setItem('loanOrder', JSON.stringify(loanOrder));
      }
      // نام و عنوان با نسخه برنامه
      applyAppBranding();
      // theme
      applyTheme(localStorage.getItem('vam_theme') || 'light');
      // migrate users + auth gate
      migrateUsersIfNeeded();
      const users = getUsers();
      const needAuth = users.some(u => u.passwordHash);
      if (needAuth && sessionStorage.getItem('vam_logged_in') !== '1') {
        showLoginScreen();
      } else {
        hideLoginScreen();
      }
      applyCompactFromSettings();
      refreshCurrencyLabels();
      renderDashboard();
      showPage('dashboard');

      // Enter key on login
      document.getElementById('login-password')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doLogin();
      });

      // تقویم شمسی برای فیلد تاریخ شروع ثبت وام
      initJalaliDatePicker();

      // Register Service Worker + soft update
      window.addEventListener('load', () => registerServiceWorkerWithUpdate());

      // Auto-lock + notifications + backup info
      setupActivityWatchers();
      resetAutoLockTimer();
      updateLastBackupInfo();
      // بازیابی handle پوشه بکاپ (اگر قبلاً انتخاب شده)
      restoreBackupDirHandle().then(() => updateBackupFolderStatus()).catch(() => {});
      // بازیابی از IndexedDB در صورت نیاز + یادآوری پشتیبان
      tryRecoverFromIDB().then((recovered) => {
        if (recovered) {
          try { updateSelects(); renderDashboard(); } catch(_){}
          showToast('داده‌ها از حافظه پایدار بازیابی شدند.', 'info');
        }
        maybeRemindBackup();
      }).catch(() => { maybeRemindBackup(); });
      setTimeout(() => { try { maybeShowOverdueNotifications(); } catch(e){} }, 2500);
    })();


/* ============================================================
   V8.3.18 — ساعت و تاریخ زنده تهران، کاملاً آفلاین
   ============================================================ */
const TEHRAN_TIME_ZONE = 'Asia/Tehran';
let tehranClockTimer = null;

function updateTehranClock() {
  const timeEl = document.getElementById('tehran-time');
  const dateEl = document.getElementById('tehran-date');
  const weekdayEl = document.getElementById('tehran-weekday');
  const horArrow = document.getElementById('h-arrow');
  const minArrow = document.getElementById('m-arrow');
  const secArrow = document.getElementById('s-arrow');
  if (!timeEl || !dateEl) return;

  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: TEHRAN_TIME_ZONE,
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }).formatToParts(now);
    const get = (t) => Number((parts.find(p => p.type === t) || {}).value || 0);
    const h = get('hour'), m = get('minute'), s = get('second');

    // منطق همان کد کاربر: deg=6
    const deg = 6;
    const hDegree = h * 30;
    const mDegree = m * deg;
    const sDegree = s * deg;
    const hourHand = document.querySelector('.user-analog-clock .clock-hour');
    const minuteHand = document.querySelector('.user-analog-clock .clock-minute');
    const secondHand = document.querySelector('.user-analog-clock .clock-second');
    if (hourHand) hourHand.style.transform = 'rotate(' + (hDegree + mDegree / 12) + 'deg)';
    if (minuteHand) minuteHand.style.transform = 'rotate(' + mDegree + 'deg)';
    if (secondHand) secondHand.style.transform = 'rotate(' + sDegree + 'deg)';
    /* Keep the legacy IDs present for compatibility with existing code. */
    if (horArrow) horArrow.dataset.angle = String(hDegree + mDegree / 12);
    if (minArrow) minArrow.dataset.angle = String(mDegree);
    if (secArrow) secArrow.dataset.angle = String(sDegree);

    // نمایش دیجیتال 24 ساعته فارسی (تهران)
    const digital = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
      timeZone: TEHRAN_TIME_ZONE,
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }).format(now);
    timeEl.textContent = (typeof toPersianDigits === 'function') ? toPersianDigits(digital) : digital;

    const dateParts = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      timeZone: TEHRAN_TIME_ZONE,
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(now);
    dateEl.textContent = (typeof toPersianDigits === 'function') ? toPersianDigits(dateParts) : dateParts;

    if (weekdayEl) {
      weekdayEl.textContent = new Intl.DateTimeFormat('fa-IR', {
        timeZone: TEHRAN_TIME_ZONE,
        weekday: 'long'
      }).format(now);
    }
  } catch (e) {
    console.warn('tehran clock', e);
  }
}


function startTehranClock() {
  if (tehranClockTimer) clearInterval(tehranClockTimer);
  updateTehranClock();
  // هم‌تراز با ثانیه بعدی؛ بدون نیاز به اینترنت یا API خارجی.
  const delay = 1000 - (Date.now() % 1000);
  setTimeout(() => {
    updateTehranClock();
    tehranClockTimer = setInterval(updateTehranClock, 1000);
  }, delay);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startTehranClock, { once: true });
} else {
  startTehranClock();
}
window.addEventListener('pageshow', updateTehranClock);
window.addEventListener('focus', updateTehranClock);

/* ============================================================
   v4 PRO UX LAYER — امکانات 1 تا 13
   ============================================================ */
let calendarState = (() => {
  const p = jalaliPartsFromDate(new Date()) || {year:1405,month:1,day:1};
  return {year:p.year, month:p.month, selected:null};
})();

function loanDetailsIcon(loan){
  const html = renderLoanIconHTML(loan?.icon || '');
  return html || '<i class="fa-solid fa-building-columns"></i>';
}

function openLoanDetails(loanId){
  const loan=(loans||[]).find(l=>String(l.id)===String(loanId));
  if(!loan) return showToast('وام یافت نشد.','error');
  const st=getLoanStats(loan);
  const overdue=(loan.installments||[]).filter(i=>!i.paid && isOverdue(i));
  const timeline=[...(loan.installments||[])].filter(i=>i.paid).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,12);
  document.getElementById('detail-loan-name').textContent=loan.name;
  document.getElementById('detail-loan-sub').textContent=`${toPersianDigits(st.paidCount)} از ${toPersianDigits(st.totalInst)} قسط پرداخت شده`;
  document.getElementById('detail-loan-icon').innerHTML=loanDetailsIcon(loan);
  const progress=st.totalInst?Math.round(st.paidCount/st.totalInst*100):0;
  const body=document.getElementById('loan-details-body');
  body.innerHTML=`
    <div class="detail-stat-grid mb-4">
      <div class="detail-stat"><small>مبلغ وام</small><strong>${formatMoney(loan.amount)}</strong></div>
      <div class="detail-stat"><small>پرداخت‌شده</small><strong class="text-emerald-600">${formatMoney(st.paidAmount)}</strong></div>
      <div class="detail-stat"><small>مانده</small><strong class="text-rose-600">${formatMoney(st.remainingAmount)}</strong></div>
      <div class="detail-stat"><small>پیشرفت</small><strong>${toPersianDigits(progress)}٪</strong></div>
    </div>
    <div class="grid md:grid-cols-2 gap-4 mb-4">
      <div class="glass-card rounded-2xl p-4"><div class="font-black mb-2">اطلاعات وام</div>
        <div class="text-sm space-y-2 text-slate-600"><div class="flex justify-between"><span>قسط</span><b>${formatMoney(loan.installmentAmount)}</b></div><div class="flex justify-between"><span>تعداد</span><b>${toPersianDigits(loan.installmentCount)}</b></div><div class="flex justify-between"><span>شروع</span><b>${formatDateToPersian(loan.startDate)}</b></div><div class="flex justify-between"><span>تسویه</span><b>${getLoanSettlementDate(loan)?formatDateToPersian(getLoanSettlementDate(loan)):'—'}</b></div></div>
      </div>
      <div class="glass-card rounded-2xl p-4"><div class="font-black mb-2">وضعیت</div>
        <div class="text-sm space-y-2"><div class="flex justify-between"><span>مانده اقساط</span><b class="text-rose-600">${toPersianDigits(st.remainingCount)}</b></div><div class="flex justify-between"><span>معوق</span><b class="text-red-600">${toPersianDigits(overdue.length)}</b></div><div class="h-3 bg-slate-100 rounded-full overflow-hidden mt-3"><div class="h-full bg-indigo-500 rounded-full" style="width:${progress}%"></div></div></div>
      </div>
    </div>
    <div class="flex flex-wrap gap-2 mb-5"><button class="btn-glass btn-glass-success" onclick="closeLoanDetails(); quickPayFromDashboard('${loan.id}',event)"><i class="fa-solid fa-check me-1"></i>پرداخت سریع</button><button class="btn-glass btn-glass-primary" onclick="closeLoanDetails(); selectAndShowPage('${loan.id}','manage-loans')"><i class="fa-solid fa-list-check me-1"></i>مدیریت اقساط</button><button class="btn-glass" onclick="exportInstallmentsToPhoneCalendar('${loan.id}')"><i class="fa-solid fa-mobile-screen-button me-1"></i>افزودن به تقویم گوشی</button><button class="btn-glass" onclick="closeLoanDetails(); selectAndShowPage('${loan.id}','reports')"><i class="fa-solid fa-print me-1"></i>گزارش و چاپ</button></div>
    <div><h3 class="font-black text-slate-800 mb-2">تاریخچه پرداخت‌ها</h3><div class="timeline">${timeline.length?timeline.map(i=>`<div class="timeline-item"><div class="timeline-content"><div class="flex justify-between gap-2"><b>قسط ${toPersianDigits(i.number)}</b><span class="text-xs text-slate-500">${formatDateToPersian(i.date)}</span></div><div class="text-sm text-emerald-600 font-bold mt-1">${formatMoney(i.amount)}</div></div></div>`).join(''):'<div class="text-sm text-slate-500">هنوز پرداختی ثبت نشده است.</div>'}</div></div>`;
  document.getElementById('loan-details-overlay').classList.remove('hidden');
}
function closeLoanDetails(){document.getElementById('loan-details-overlay')?.classList.add('hidden');}

function quickPayNextGlobal(){
  openQuickPayLoanPicker();
}
function openQuickPayLoanPicker(){
  const overlay=document.getElementById('quick-pay-loan-overlay');
  const list=document.getElementById('quick-pay-loan-list');
  if(!overlay||!list)return;
  const candidates=(loans||[]).map(l=>{
    const inst=getNextUnpaidInstallment(l);
    return inst?{loan:l,inst,days:daysUntilDate(inst.date)}:null;
  }).filter(Boolean).sort((a,b)=>a.days-b.days);
  if(!candidates.length){
    showToast('قسط پرداخت‌نشده‌ای وجود ندارد.','info');
    return;
  }
  list.innerHTML=candidates.map(x=>{
    const overdue=x.days<0;
    const status=overdue?`<span class="qp-status overdue">${toPersianDigits(Math.abs(x.days))} روز معوق</span>`:`<span class="qp-status upcoming">${x.days===0?'امروز':('تا '+toPersianDigits(x.days)+' روز')}</span>`;
    return `<button type="button" class="quick-pay-loan-card" onclick="chooseQuickPayLoan('${escapeHtml(String(x.loan.id))}')">
      <span class="qp-icon"><i class="fa-solid fa-building-columns"></i></span>
      <span class="qp-main"><b>${escapeHtml(x.loan.name||'وام بدون نام')}</b><small>قسط ${toPersianDigits(x.inst.number)} · ${formatDateToPersian(x.inst.date)} · ${formatMoney(x.inst.amount)}</small></span>
      ${status}<i class="fa-solid fa-chevron-left qp-arrow"></i>
    </button>`;
  }).join('');
  overlay.classList.remove('hidden');
  requestAnimationFrame(()=>overlay.classList.add('show'));
}
function chooseQuickPayLoan(loanId){
  closeQuickPayLoanPicker();
  setTimeout(()=>quickPayFromDashboard(loanId),120);
}
function closeQuickPayLoanPicker(){
  const overlay=document.getElementById('quick-pay-loan-overlay');
  if(!overlay)return;
  overlay.classList.remove('show');
  setTimeout(()=>overlay.classList.add('hidden'),220);
}

function renderDashboardAlerts(){
  const alertEl=document.getElementById('dashboard-alerts'), nextEl=document.getElementById('dashboard-next-payment'); if(!alertEl||!nextEl)return;
  const overdue=[]; const upcoming=[];
  (loans||[]).forEach(l=>(l.installments||[]).forEach(i=>{
    if(i.paid||!i.date)return;
    const d=daysUntilDate(i.date), x={loan:l,inst:i,days:d};
    if(d<0)overdue.push(x); else if(d<=7)upcoming.push(x);
  }));
  overdue.sort((a,b)=>a.days-b.days); upcoming.sort((a,b)=>a.days-b.days);

  const groups={};
  overdue.forEach(x=>{
    const id=String(x.loan.id);
    if(!groups[id])groups[id]={loan:x.loan,items:[]};
    groups[id].items.push(x);
  });
  const overdueGroups=Object.values(groups).sort((a,b)=>{
    const ad=Math.min(...a.items.map(x=>x.days)), bd=Math.min(...b.items.map(x=>x.days));
    return ad-bd;
  });

  const tabs=overdueGroups.map((g,idx)=>`
    <button type="button" class="overdue-loan-tab ${idx===0?'active':''}" onclick="selectOverdueLoanTab('${escapeHtml(String(g.loan.id))}',this)">
      <span class="overdue-tab-name">${escapeHtml(g.loan.name||'بدون نام')}</span>
      <span class="overdue-tab-count">${toPersianDigits(g.items.length)}</span>
    </button>`).join('');

  const panels=overdueGroups.map((g,idx)=>{
    const total=g.items.reduce((sum,x)=>sum+Number(x.inst.amount||0),0);
    const maxDelay=Math.max(...g.items.map(x=>Math.abs(x.days)));
    return `<div class="overdue-loan-panel ${idx===0?'active':''}" data-overdue-loan="${escapeHtml(String(g.loan.id))}">
      <div class="overdue-loan-summary">
        <div><b>${escapeHtml(g.loan.name||'بدون نام')}</b><small>${toPersianDigits(g.items.length)} قسط معوق · ${formatMoney(total)} · حداکثر ${toPersianDigits(maxDelay)} روز تأخیر</small></div>
        <button class="btn-glass text-xs" onclick="openLoanDetails('${escapeHtml(String(g.loan.id))}')"><i class="fa-solid fa-eye me-1"></i>جزئیات</button>
      </div>
      <div class="overdue-loan-list">
        ${g.items.map(x=>`<div class="overdue-loan-item">
          <div><b>قسط ${toPersianDigits(x.inst.number)}</b><small>${formatDateToPersian(x.inst.date)} · ${toPersianDigits(Math.abs(x.days))} روز تأخیر</small></div>
          <span>${formatMoney(x.inst.amount)}</span>
        </div>`).join('')}
      </div>
      <button class="btn-glass btn-glass-success text-xs w-full mt-2" onclick="quickPayFromDashboard('${escapeHtml(String(g.loan.id))}',event)"><i class="fa-solid fa-check me-1"></i>پرداخت سریع</button>
    </div>`;
  }).join('');

  alertEl.innerHTML=`
    <div class="smart-alert-title"><i class="fa-solid fa-bell text-rose-500 me-1"></i>هشدار اقساط</div>
    <div class="smart-alert-row"><span class="smart-alert-muted">اقساط معوق</span><span class="smart-alert-value text-rose-600">${toPersianDigits(overdue.length)}</span></div>
    <div class="smart-alert-row"><span class="smart-alert-muted">وام‌های دارای معوق</span><span class="smart-alert-value text-rose-600">${toPersianDigits(overdueGroups.length)}</span></div>
    <div class="smart-alert-row"><span class="smart-alert-muted">۷ روز آینده</span><span class="smart-alert-value text-amber-600">${toPersianDigits(upcoming.length)}</span></div>
    ${overdueGroups.length?`<div class="overdue-loan-tabs" role="tablist">${tabs}</div><div class="overdue-loan-panels">${panels}</div>`:`<div class="text-center text-slate-500 text-sm py-3">قسط معوقی وجود ندارد.</div>`}
  `;

  const n=upcoming[0]||overdue[0];
  nextEl.innerHTML=n?`<div class="smart-alert-title"><i class="fa-solid fa-calendar-check text-indigo-500 me-1"></i>${n.days<0?'نزدیک‌ترین معوقه':'نزدیک‌ترین قسط'}</div><div class="smart-alert-row"><span><b>${escapeHtml(n.loan.name)}</b><br><span class="smart-alert-muted">قسط ${toPersianDigits(n.inst.number)} · ${formatDateToPersian(n.inst.date)}</span></span><span class="smart-alert-value">${formatMoney(n.inst.amount)}</span></div><button class="btn-glass btn-glass-success text-xs" onclick="quickPayFromDashboard('${escapeHtml(String(n.loan.id))}',event)">پرداخت سریع</button>`:`<div class="text-center text-slate-500 text-sm py-4">قسط آینده‌ای ثبت نشده است.</div>`;
}
function selectOverdueLoanTab(loanId,btn){
  const root=btn?.closest('#dashboard-alerts');
  if(!root)return;
  root.querySelectorAll('.overdue-loan-tab').forEach(x=>x.classList.remove('active'));
  root.querySelectorAll('.overdue-loan-panel').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');
  root.querySelector(`.overdue-loan-panel[data-overdue-loan="${CSS.escape(String(loanId))}"]`)?.classList.add('active');
}

function renderGlobalSearch(){
  const q=toEnglishDigits((document.getElementById('global-search')?.value||'').trim()).toLowerCase();
  const box=document.getElementById('global-search-results'); if(!box)return;
  if(!q){box.classList.add('hidden');box.innerHTML='';return;}
  const results=[];
  (loans||[]).forEach(l=>{
    const loanHit=String(l.name||'').toLowerCase().includes(q)||String(l.amount||'').includes(q)||String(l.id||'').includes(q);
    if(loanHit)results.push({type:'loan',loan:l,text:`وام ${l.name}`,sub:`${formatMoney(l.amount)} · ${toPersianDigits((l.installments||[]).length)} قسط`});
    (l.installments||[]).forEach(i=>{if(results.length>=12)return;const hay=`${i.number} ${i.amount} ${i.date}`.toLowerCase();if(hay.includes(q))results.push({type:'inst',loan:l,inst:i,text:`قسط ${toPersianDigits(i.number)} · ${l.name}`,sub:`${formatDateToPersian(i.date)} · ${formatMoney(i.amount)}`});});
  });
  box.classList.remove('hidden'); box.innerHTML=results.length?results.slice(0,12).map(r=>`<div class="global-result" onclick="${r.type==='loan'?`openLoanDetails('${r.loan.id}')`:`selectAndShowPage('${r.loan.id}','manage-loans')`}"><i class="fa-solid ${r.type==='loan'?'fa-building-columns':'fa-calendar-check'} text-indigo-500"></i><div><b class="block text-sm">${escapeHtml(r.text)}</b><span class="text-xs text-slate-500">${escapeHtml(r.sub)}</span></div></div>`).join(''):'<div class="text-center text-sm text-slate-500 py-4">نتیجه‌ای پیدا نشد.</div>';
}

function updateReportAnalytics(){
  let paid=0,remain=0,overdue=0; (loans||[]).forEach(l=>{const s=getLoanStats(l);paid+=s.paidAmount;remain+=s.remainingAmount;overdue+=(l.installments||[]).filter(i=>!i.paid&&isOverdue(i)).length;});
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=typeof v==='number'&&id!=='report-kpi-overdue'&&id!=='report-kpi-loans'?formatMoney(v):toPersianDigits(numberWithCommas(v));};
  set('report-kpi-loans',loans.length);set('report-kpi-paid',paid);set('report-kpi-remain',remain);set('report-kpi-overdue',overdue);
}

function renderCalendar(){
  const grid=document.getElementById('calendar-grid'), title=document.getElementById('calendar-month-title'); if(!grid||!title)return;
  const y=calendarState.year,m=calendarState.month; const monthNames=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند']; title.textContent=`${monthNames[m-1]} ${toPersianDigits(y)}`;
  const first=gregorianDateFromJalali(jalaliToDateString(y,m,1)); const dow=(first.getUTCDay()+1)%7; const days=jalaliDaysInMonth(y,m); const heads=['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
  let html=heads.map(x=>`<div class="cal-head">${x}</div>`).join(''); for(let i=0;i<dow;i++)html+='<div class="cal-cell empty"></div>';
  for(let d=1;d<=days;d++){const iso=jalaliToDateString(y,m,d);const insts=[];(loans||[]).forEach(l=>(l.installments||[]).forEach(i=>{if(i.date===iso)insts.push({loan:l,inst:i});}));const overdue=insts.some(x=>!x.inst.paid&&isOverdue(x.inst));const today=iso===todayISO();html+=`<div class="cal-cell ${today?'cal-today':''}" onclick="selectCalendarDay('${iso}')"><div class="cal-day ${overdue?'cal-overdue':''}">${toPersianDigits(d)}</div>${insts.length?`<div class="cal-count ${overdue?'cal-overdue':''}"><i class="fa-solid fa-circle"></i> ${toPersianDigits(insts.length)}</div>`:''}</div>`;}
  grid.innerHTML=html; if(calendarState.selected)renderCalendarDay(calendarState.selected);
}
function changeCalendarMonth(delta){calendarState.month+=delta;if(calendarState.month>12){calendarState.month=1;calendarState.year++}if(calendarState.month<1){calendarState.month=12;calendarState.year--}calendarState.selected=null;renderCalendar();}
function selectCalendarDay(iso){calendarState.selected=iso;renderCalendarDay(iso);}
function renderCalendarDay(iso){const el=document.getElementById('calendar-day-list');if(!el)return;const rows=[];(loans||[]).forEach(l=>(l.installments||[]).forEach(i=>{if(i.date===iso)rows.push({loan:l,inst:i});}));el.innerHTML=`<div class="font-black text-slate-800">اقساط ${formatDateToPersian(iso)}</div>`+(rows.length?rows.map(x=>`<div class="calendar-day-card flex flex-wrap items-center justify-between gap-2"><div><b>${escapeHtml(x.loan.name)}</b><div class="text-xs text-slate-500">قسط ${toPersianDigits(x.inst.number)} · ${x.inst.paid?'پرداخت‌شده':'پرداخت‌نشده'}</div></div><div class="flex items-center gap-2"><b>${formatMoney(x.inst.amount)}</b>${!x.inst.paid?`<button class="btn-glass btn-glass-success text-xs" onclick="quickPayFromDashboard('${x.loan.id}',event)">پرداخت</button>`:''}<button class="btn-glass text-xs" onclick="openLoanDetails('${x.loan.id}')">جزئیات</button></div></div>`).join(''):'<div class="text-sm text-slate-500 mt-2">برای این روز قسطی ثبت نشده است.</div>');}


// ============================================================
//  EXPORT INSTALLMENTS TO PHONE CALENDAR (.ics)
//  تولید فایل تقویم برای افزودن یادآوری اقساط به تقویم گوشی
// ============================================================
function icsEscape(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function icsFormatDateUTC(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${day}T${h}${min}${s}Z`;
}

/** تاریخ شمسی YYYY-MM-DD → YYYYMMDD میلادی برای رویداد تمام‌روز */
function jalaliToIcsDate(jalaliStr) {
  const g = gregorianDateFromJalali(jalaliStr);
  if (Number.isNaN(g.getTime())) return null;
  const y = g.getUTCFullYear();
  const m = String(g.getUTCMonth() + 1).padStart(2, '0');
  const d = String(g.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function buildInstallmentVEvent(loan, inst, alarmDaysBefore) {
  const dateVal = jalaliToIcsDate(inst.date);
  if (!dateVal) return '';
  // رویداد ساعت‌دار: همان روز سررسید ساعت ۲۰:۰۰ (۸ شب) به وقت تهران
  const startLocal = dateVal + 'T200000';
  const endLocal = dateVal + 'T201500';
  const uid = `vam-${loan.id}-inst-${inst.number}@easyvam.local`;
  const summary = `قسط ${inst.number} — ${loan.name || 'وام'}`;
  const descParts = [
    `وام: ${loan.name || '—'}`,
    `شماره قسط: ${inst.number}`,
    `مبلغ: ${formatMoney(inst.amount)}`,
    `تاریخ سررسید (شمسی): ${formatDateToPersian(inst.date)}`,
    `ساعت یادآوری: ۲۰:۰۰`,
    loan.bank ? `بانک/طرف حساب: ${loan.bank}` : '',
    'یادآوری از سیستم مدیریت وام (EasyVam)'
  ].filter(Boolean);
  const alarm = Number.isFinite(alarmDaysBefore) && alarmDaysBefore >= 0
    ? Math.round(alarmDaysBefore)
    : 0;
  // همان ساعت شروع رویداد (۸ شب): اگر ۰ روز → سر وقت؛ اگر N روز → N روز قبل ساعت ۸ شب
  const alarmTrigger = alarm === 0 ? '-PT0S' : `-P${alarm}D`;
  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsFormatDateUTC(new Date())}`,
    `DTSTART;TZID=Asia/Tehran:${startLocal}`,
    `DTEND;TZID=Asia/Tehran:${endLocal}`,
    `SUMMARY:${icsEscape(summary)}`,
    `DESCRIPTION:${icsEscape(descParts.join('\\n'))}`,
    'LOCATION:پرداخت قسط',
    'CATEGORIES:Installment,Loan,EasyVam',
    'STATUS:CONFIRMED',
    'CLASS:PUBLIC',
    'TRANSP:OPAQUE',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape('یادآوری قسط — ' + summary)}`,
    `TRIGGER:${alarmTrigger}`,
    'END:VALARM',
    'END:VEVENT'
  ].join('\r\n');
}

/**
 * ساخت محتوای ICS از اقساط پرداخت‌نشده
 * @param {object|null} onlyLoan - اگر مشخص باشد فقط اقساط همان وام
 * @param {number} alarmDaysBefore - چند روز قبل یادآوری (پیش‌فرض ۱)
 */
function buildInstallmentsIcs(onlyLoan = null, alarmDaysBefore = 1) {
  const source = onlyLoan ? [onlyLoan] : (loans || []);
  const events = [];
  source.forEach(loan => {
    (loan.installments || []).forEach(inst => {
      if (inst.paid || !inst.date) return;
      const ev = buildInstallmentVEvent(loan, inst, alarmDaysBefore);
      if (ev) events.push(ev);
    });
  });
  if (!events.length) return null;
  const calName = onlyLoan
    ? `اقساط وام ${onlyLoan.name || ''}`
    : 'یادآوری اقساط وام‌ها';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EasyVam//Installment Reminders//FA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-TIMEZONE:Asia/Tehran',
    `X-WR-CALNAME:${icsEscape(calName)}`,
    `X-WR-CALDESC:${icsEscape('یادآوری سررسید اقساط از سیستم مدیریت وام')}`,
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Tehran',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0330',
    'TZOFFSETTO:+0330',
    'TZNAME:IRST',
    'DTSTART:19700101T000000',
    'END:STANDARD',
    'END:VTIMEZONE',
    ...events,
    'END:VCALENDAR'
  ].join('\r\n');
}

function downloadIcsFile(content, filename) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'vam_installments.ics';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try { URL.revokeObjectURL(url); } catch (_) {}
    a.remove();
  }, 1500);
}

/**
 * خروجی تقویم گوشی — همه اقساط پرداخت‌نشده یا یک وام خاص
 * @param {string|null} loanId
 * @param {number} alarmDaysBefore
 */

function openCalendarLoanPicker() {
  const ov = document.getElementById('calendar-loan-picker');
  const list = document.getElementById('calendar-loan-picker-list');
  if (!ov || !list) {
    exportCalendarToPhone();
    return;
  }
  const active = (loans || []).filter(l => {
    const insts = l.installments || [];
    return insts.some(i => !i.paid);
  });
  if (!active.length) {
    showToast('قسط پرداخت‌نشده‌ای برای افزودن به تقویم نیست.', 'info');
    return;
  }
  list.innerHTML = active.map(l => {
    const remain = (l.installments || []).filter(i => !i.paid).length;
    return `<button type="button" class="cal-loan-pick-btn" onclick="pickCalendarLoan('${String(l.id).replace(/'/g, '')}')">
      <b>${escapeHtml(l.name || 'وام')}</b>
      <div class="text-xs text-slate-500">${escapeHtml(l.party || '')} · ${toPersianDigits(remain)} قسط باقی‌مانده</div>
    </button>`;
  }).join('');
  ov.classList.add('open');
}
function closeCalendarLoanPicker() {
  document.getElementById('calendar-loan-picker')?.classList.remove('open');
}
function pickCalendarLoan(loanId) {
  closeCalendarLoanPicker();
  exportInstallmentsToPhoneCalendar(loanId);
}
window.openCalendarLoanPicker = openCalendarLoanPicker;
window.closeCalendarLoanPicker = closeCalendarLoanPicker;
window.pickCalendarLoan = pickCalendarLoan;

function exportInstallmentsToPhoneCalendar(loanId = null, alarmDaysBefore) {
  try {
    const days = (alarmDaysBefore == null)
      ? getCalendarAlarmDays()
      : (Number.isFinite(Number(alarmDaysBefore)) ? Math.round(Number(alarmDaysBefore)) : getCalendarAlarmDays());
    const loan = loanId ? (loans || []).find(l => String(l.id) === String(loanId)) : null;
    if (loanId && !loan) {
      showToast('وام پیدا نشد.', 'error');
      return;
    }
    const ics = buildInstallmentsIcs(loan, days);
    if (!ics) {
      showToast('قسط پرداخت‌نشده‌ای برای افزودن به تقویم وجود ندارد.', 'info');
      return;
    }
    const count = (ics.match(/BEGIN:VEVENT/g) || []).length;
    const base = loan
      ? `اقساط_${safeFilename(loan.name, 'loan')}`
      : `اقساط_همه_وامها`;
    const fname = `${base}_${toLocalISO(new Date())}.ics`.replace(/\s+/g, '_');
    downloadIcsFile(ics, fname);
    const alarmLabel = days === 0
      ? 'همان روز ساعت ۲۰:۰۰'
      : (toPersianDigits(days) + ' روز قبل ساعت ۲۰:۰۰');
    showToast(
      toPersianDigits(count) + ' رویداد ساخته شد (یادآوری: ' + alarmLabel + '). فایل را در Google Calendar باز کنید.',
      'success'
    );
    try {
      if (typeof v8Log === 'function') v8Log('export', 'خروجی تقویم گوشی', fname);
    } catch (_) {}
  } catch (e) {
    console.error('exportInstallmentsToPhoneCalendar', e);
    showToast('خطا در ساخت فایل تقویم.', 'error');
  }
}

/** میان‌بر از صفحه تقویم */
function getCalendarAlarmDays() {
  const n = Number(appSettings && appSettings.calendarAlarmDays);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

function onCalendarAlarmChange() {
  const el = document.getElementById('calendar-alarm-days');
  if (!el) return;
  const raw = parseInt(el.value, 10);
  appSettings.calendarAlarmDays = Number.isFinite(raw) && raw >= 0 ? raw : 0;
  try { localStorage.setItem('vam_app_settings', JSON.stringify(appSettings)); } catch (_) {}
  const setEl = document.getElementById('set-calendar-alarm');
  if (setEl) setEl.value = String(appSettings.calendarAlarmDays);
}

function syncCalendarAlarmSelect() {
  const days = getCalendarAlarmDays();
  const el = document.getElementById('calendar-alarm-days');
  if (el) el.value = String(days);
  const setEl = document.getElementById('set-calendar-alarm');
  if (setEl) setEl.value = String(days);
}

function exportCalendarToPhone() {
  // مقدار انتخاب‌شده روی صفحه تقویم اولویت دارد
  const el = document.getElementById('calendar-alarm-days');
  if (el) {
    const raw = parseInt(el.value, 10);
    if (Number.isFinite(raw) && raw >= 0) {
      appSettings.calendarAlarmDays = raw;
      try { localStorage.setItem('vam_app_settings', JSON.stringify(appSettings)); } catch (_) {}
    }
  }
  exportInstallmentsToPhoneCalendar(null, getCalendarAlarmDays());
}


// Enhance the existing dashboard renderer without replacing its stable core.
const __v76_renderDashboard = renderDashboard;
renderDashboard = function(){
  __v76_renderDashboard();
  
  try { updateReportAnalytics(); } catch (e) {}
  if (typeof renderV8Today === 'function') renderV8Today();
  
};

// Add details action to cards after the stable card renderer finishes.
const __v76_renderLoanCards = renderLoanCards;
renderLoanCards = function(){ __v76_renderLoanCards(); document.querySelectorAll('#loans-cards-container [data-loan-id]').forEach(card=>{const id=card.getAttribute('data-loan-id');const actions=card.querySelector('.mt-4.flex.flex-wrap.gap-2:last-child');if(actions&&!actions.querySelector('.v76-details-btn')){const b=document.createElement('button');b.className='v76-details-btn flex-1 min-w-[40%] btn-glass text-sm';b.innerHTML='<i class="fa-solid fa-eye me-1"></i>جزئیات';b.onclick=(e)=>{e.stopPropagation();openLoanDetails(id)};actions.prepend(b);}}); };

// Hook calendar into page navigation while preserving v4 navigation.
const __v76_navigateTo = navigateTo;
navigateTo = function(id){ __v76_navigateTo(id); if(id==='calendar') setTimeout(function(){ renderCalendar(); try{syncCalendarAlarmSelect();}catch(e){} },30); if(id==='reports') setTimeout(updateReportAnalytics,30); };

// Calendar initial state and live updates.
setTimeout(()=>{try{renderCalendar();syncCalendarAlarmSelect();updateReportAnalytics();}catch(e){}},120);

/* ========================= v4 PRO CORE ========================= */
function v8Log(type, title, detail=''){
  try{
    operationHistory.unshift({id:Date.now()+Math.random(), type, title, detail, at:new Date().toISOString()});
    operationHistory.splice(80);
    localStorage.setItem('vam_operation_history', JSON.stringify(operationHistory));
  }catch(e){}
}

function v8TodaySummary(){
  const iso=todayISO(); let overdue=0,today=0,week=0,paidMonth=0; const now=new Date();
  (loans||[]).forEach(l=>(l.installments||[]).forEach(i=>{
    if(i.paid){ const d=i.paidAt?new Date(i.paidAt):null; if(d&&d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()) paidMonth++; return; }
    if(isOverdue(i)) overdue++;
    if(i.date===iso) today++;
    const d=parseLocalDate(i.date); const t=parseLocalDate(iso); if(d&&!isNaN(d)&&t&&!isNaN(t)){const diff=(d-t)/86400000;if(diff>0&&diff<=7)week++;}
  }));
  return {overdue,today,week,paidMonth};
}
function renderV8Today(){
  const el=document.getElementById('v8-today-center'); if(!el)return; const x=v8TodaySummary();
  el.innerHTML=`<div class="v8-today-head v8-today-head-center"><div><span>مرکز عملیات امروز</span><h3>امروز چه خبر؟</h3></div></div><div class="v8-today-grid v8-today-info"><div class="v8-today-stat"><b>${toPersianDigits(x.overdue)}</b><small>قسط معوق</small></div><div class="v8-today-stat"><b>${toPersianDigits(x.today)}</b><small>قسط امروز</small></div><div class="v8-today-stat"><b>${toPersianDigits(x.week)}</b><small>تا ۷ روز آینده</small></div><div class="v8-today-stat"><b>${toPersianDigits(x.paidMonth)}</b><small>پرداخت این ماه</small></div></div>`;
}
function getMonthlyReceivable(){ const now=new Date(); let total=0,paid=0; (loans||[]).forEach(l=>(l.installments||[]).forEach(i=>{const d=parseLocalDate(i.date);if(d&&d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()){total+=Number(i.amount)||0;if(i.paid)paid+=Number(i.amount)||0;}}));return {total,paid,remain:Math.max(total-paid,0),pct:total?Math.round(paid/total*100):0}; }
function renderV8Liquidity(){ const el=document.getElementById('v8-liquidity'); if(!el)return; const x=getMonthlyReceivable();el.innerHTML=`<div class="v8-liq-title"><span>مبلغ قابل وصول این ماه</span><b>${formatMoney(x.remain)}</b></div><div class="v8-progress"><span style="width:${x.pct}%"></span></div><small>${formatMoney(x.paid)} از ${formatMoney(x.total)} وصول شده · ${toPersianDigits(x.pct)}٪</small>`; }
function validateLoanIntegrity(loan){
  const issues=[]; const amount=Number(loan.amount)||0; const count=Number(loan.installmentCount)||0; const insts=loan.installments||[];
  if(count>0 && insts.length!==count) issues.push(`تعداد اقساط (${insts.length}) با مقدار ثبت‌شده (${count}) برابر نیست`);
  const seen=new Set(); insts.forEach(i=>{if(seen.has(i.number))issues.push(`قسط شماره ${i.number} تکراری است`);seen.add(i.number);if((Number(i.amount)||0)<0)issues.push(`مبلغ قسط ${i.number} منفی است`);});
  const total=insts.reduce((a,i)=>a+(Number(i.amount)||0),0); if(amount>0&&total>0&&total<amount) issues.push('جمع اقساط از مبلغ وام کمتر است');
  return issues;
}
function renderV8Integrity(){ const el=document.getElementById('v8-integrity'); if(!el)return; const rows=[];(loans||[]).forEach(l=>{const issues=validateLoanIntegrity(l);if(issues.length)rows.push({l,issues});});el.innerHTML=rows.length?`<div class="v8-integrity-head">⚠️ ${toPersianDigits(rows.length)} وام دارای مغایرت است</div>`+rows.slice(0,8).map(r=>`<div class="v8-integrity-row"><b>${escapeHtml(r.l.name)}</b><span>${escapeHtml(r.issues[0])}</span><button onclick="openLoanDetails('${r.l.id}')">بررسی</button></div>`).join(''):'<div class="v8-integrity-ok">✓ مغایرت مالی یا ساختاری پیدا نشد</div>';}
function renderV8History(){ const el=document.getElementById('v8-history-list');if(!el)return;el.innerHTML=operationHistory.slice(0,12).map(x=>{const d=new Date(x.at);return `<div class="v8-history-item"><i class="fa-solid fa-circle-check"></i><div><b>${escapeHtml(x.title)}</b><small>${escapeHtml(x.detail||'')} · ${toPersianDigits(d.toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'}))}</small></div></div>`}).join('')||'<div class="text-sm text-slate-500 py-4 text-center">هنوز عملیاتی ثبت نشده است.</div>';}
function openV8History(){document.getElementById('v8-history-overlay')?.classList.remove('hidden');}
function closeV8History(){document.getElementById('v8-history-overlay')?.classList.add('hidden');}
function applyManageQuickFilter(type){const inp=document.getElementById('manage-filter');if(!inp)return; inp.value= type==='overdue'?'__V8_OVERDUE__':type==='today'?'__V8_TODAY__':type==='week'?'__V8_WEEK__':''; if(typeof updateManageInstallmentTable==='function')updateManageInstallmentTable();}
function v8GlobalShortcut(e){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();document.getElementById('global-search')?.focus();document.getElementById('global-search')?.select();}if(e.key==='Escape'){closeV8History();}}
document.addEventListener('keydown',v8GlobalShortcut);
// v4: عملیات اصلی خودشان پس از موفقیت لاگ و رندر لازم را انجام می‌دهند.
// از Wrapperهای تودرتو و Renderهای تکراری جلوگیری شد تا UI روان‌تر بماند.
setTimeout(()=>{try{renderV8Today();}catch(e){}},120);

function printPaymentReceipt(loan, inst, receiptNo){
  const paidAt = inst?.paidAt ? new Date(inst.paidAt) : new Date();
  const datePaid = Number.isNaN(paidAt.getTime()) ? new Date() : paidAt;
  const fmtDate = d => toPersianDigits(d.toLocaleDateString('fa-IR'));
  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>رسید پرداخت ${escapeHtml(receiptNo)}</title>
  <style>@page{size:A5;margin:12mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;background:#fff;color:#172033;margin:0}.receipt{max-width:620px;margin:0 auto;border:1px solid #dbe3ee;border-radius:18px;padding:24px}.brand{text-align:center;border-bottom:1px solid #e5eaf1;padding-bottom:14px;margin-bottom:18px}.brand h1{font-size:22px;margin:0 0 5px}.ok{text-align:center;font-size:42px;color:#10b981;margin:8px 0}.title{text-align:center;font-size:18px;font-weight:700;margin-bottom:18px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.item{border:1px solid #e5eaf1;border-radius:10px;padding:10px}.item small{display:block;color:#64748b;font-size:11px;margin-bottom:4px}.item b{font-size:13px}.item .ba-num-ltr,bdo.ba-num-ltr{direction:ltr!important;unicode-bidi:bidi-override!important;display:inline-block;text-align:left;font-variant-numeric:tabular-nums;letter-spacing:.04em}.amount{grid-column:1/-1;text-align:center;background:#f0fdf4;border-color:#bbf7d0}.amount b{font-size:22px;color:#047857}.no{text-align:center;margin-top:16px;color:#64748b;font-size:12px}.footer{text-align:center;margin-top:20px;padding-top:12px;border-top:1px dashed #cbd5e1;color:#64748b;font-size:10px}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head>
  <body><div class="receipt"><div class="brand"><h1>سیستم مدیریت وام</h1><div>رسید ثبت پرداخت</div></div><div class="ok">✓</div><div class="title">پرداخت با موفقیت ثبت شد</div>
  <div class="grid"><div class="item"><small>طرف حساب</small><b>${escapeHtml(loan?.party||'—')}</b></div><div class="item"><small>نام وام</small><b>${escapeHtml(loan?.name||'—')}</b></div><div class="item"><small>شماره قسط</small><b>${toPersianDigits(inst?.number ?? '—')}</b></div><div class="item"><small>تاریخ سررسید</small><b>${inst?.date ? formatDateToPersian(inst.date) : '—'}</b></div><div class="item amount"><small>مبلغ پرداختی</small><b>${formatMoney(inst?.amount || 0)}</b></div><div class="item"><small>تاریخ پرداخت</small><b>${fmtDate(datePaid)}</b></div><div class="item"><small>شماره رسید</small><b>${escapeHtml(receiptNo||'—')}</b></div><div class="item" style="grid-column:1/-1"><small>حساب / کارت مبدأ</small><div style="margin-top:4px;direction:ltr;unicode-bidi:isolate;text-align:left">${formatPaidFromHtml(inst?.paidFrom)}</div></div></div>
  <div class="footer">این رسید به‌صورت آفلاین در برنامه ثبت شده است.</div></div><script>window.onload=function(){setTimeout(function(){window.focus();window.print()},250)};<\/script></body></html>`;
  const w = window.open('', '_blank', 'width=760,height=900');
  if (!w) { showToast('مرورگر اجازه باز کردن پنجره چاپ را نداد. لطفاً پنجره‌های بازشو را مجاز کنید.', 'error'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

function openPaymentReceipt(loan, inst, existingNo, opts){
  const box=document.getElementById('payment-receipt-box'), ov=document.getElementById('payment-receipt-overlay');
  if(!box||!ov)return;
  opts = opts || {};
  const editable = !!opts.editable;
  const receiptNo = existingNo || inst?.receiptNo || ('R-'+Date.now().toString().slice(-8));
  try {
    if (typeof savePaymentReceiptRecord === 'function') {
      savePaymentReceiptRecord(loan, inst, receiptNo);
      try { if (typeof persist === 'function') persist(); } catch(_) {}
    } else if (inst) {
      inst.receiptNo = receiptNo;
    }
  } catch(_) {}

  const partyVal = escapeHtml(loan?.party || '');
  const paidAtInput = (typeof paidAtToInputValue === 'function')
    ? paidAtToInputValue(inst?.paidAt)
    : '';
  const paidFromDisplay = formatPaidFromDisplay(inst?.paidFrom || '');
  const paidFromVal = escapeHtml(paidFromDisplay === '—' ? '' : paidFromDisplay);
  let paidAtLabel = '—';
  try {
    paidAtLabel = formatDateToPersian(toLocalISO(new Date(inst?.paidAt || Date.now())));
  } catch (_) {
    paidAtLabel = toPersianDigits(new Date(inst?.paidAt || Date.now()).toLocaleDateString('fa-IR'));
  }

  const partyBlock = editable
    ? `<div class="rcpt-edit-field"><small>طرف حساب</small><input type="text" id="rcpt-edit-party" class="rcpt-edit-input" value="${partyVal}" /></div>`
    : `<div><small>طرف حساب</small><b>${partyVal || '—'}</b></div>`;

  const paidAtBlock = editable
    ? `<div class="rcpt-edit-field"><small>تاریخ پرداخت</small>
        <div class="rcpt-date-row">
          <input type="text" id="rcpt-edit-paidat" class="rcpt-edit-input" value="${escapeHtml(paidAtInput)}" placeholder="مثال: ۱۴۰۵/۰۷/۱۶" autocomplete="off" />
          <button type="button" class="date-picker-btn rcpt-date-btn" id="rcpt-edit-paidat-btn" title="انتخاب تاریخ" aria-label="باز کردن تقویم شمسی">
            <i class="fa-solid fa-calendar-days"></i>
          </button>
        </div>
      </div>`
    : `<div><small>تاریخ پرداخت</small><b>${paidAtLabel}</b></div>`;

  const paidFromBlock = editable
    ? `<div class="pr-paidfrom-row rcpt-edit-field" style="grid-column:1/-1">
        <small>حساب / کارت مبدأ</small>
        <select id="rcpt-edit-paidfrom-select" class="rcpt-edit-input ps-select" dir="rtl"></select>
        <input type="text" id="rcpt-edit-paidfrom" class="rcpt-edit-input ba-number-input" dir="ltr" value="${paidFromVal}" oninput="onBankNumberInput(event)" placeholder="یا ورود دستی شماره / عنوان" style="margin-top:5px" />
      </div>`
    : `<div style="grid-column:1/-1" class="pr-paidfrom-row"><small>حساب / کارت مبدأ</small><div class="pr-paidfrom-val">${formatPaidFromHtml(inst?.paidFrom)}</div></div>`;

  const actions = editable
    ? `<div class="payment-receipt-actions">
        <button type="button" class="btn-glass btn-glass-success rcpt-confirm-btn" onclick="window.confirmReceiptEdits && window.confirmReceiptEdits()" title="تأیید ویرایش">
          <i class="fa-solid fa-check"></i> تأیید
        </button>
        <button type="button" class="btn-glass" onclick="printPaymentReceipt(window.__lastPaymentReceipt.loan, window.__lastPaymentReceipt.inst, window.__lastPaymentReceipt.no)">
          <i class="fa-solid fa-print me-1"></i>چاپ رسید
        </button>
        <button type="button" class="btn-glass btn-glass-primary" onclick="closePaymentReceipt()">بستن</button>
      </div>`
    : `<div class="payment-receipt-actions">
        <button type="button" class="btn-glass" onclick="printPaymentReceipt(window.__lastPaymentReceipt.loan, window.__lastPaymentReceipt.inst, window.__lastPaymentReceipt.no)">
          <i class="fa-solid fa-print me-1"></i>چاپ رسید
        </button>
        <button type="button" class="btn-glass btn-glass-primary" onclick="closePaymentReceipt()">بستن</button>
      </div>`;

  const okCls = editable ? 'payment-receipt-ok rcpt-ok-compact' : 'payment-receipt-ok';
  box.innerHTML=`<div class="payment-receipt-head"><div><span class="text-xs text-emerald-600 font-bold">رسید پرداخت</span><h3>${editable ? 'مشاهده و ویرایش رسید' : 'پرداخت با موفقیت ثبت شد'}</h3></div><button type="button" class="loan-icon-picker-close" onclick="closePaymentReceipt()"><i class="fa-solid fa-xmark"></i></button></div>
  <div class="${okCls}"><i class="fa-solid fa-circle-check"></i></div>
  <div class="payment-receipt-grid">
    ${partyBlock}
    <div><small>نام وام</small><b>${escapeHtml(loan?.name||'—')}</b></div>
    <div><small>شماره قسط</small><b>${toPersianDigits(inst?.number)}</b></div>
    <div><small>مبلغ پرداختی</small><b>${formatMoney(inst?.amount)}</b></div>
    <div><small>تاریخ سررسید</small><b>${inst?.date ? formatDateToPersian(inst.date) : '—'}</b></div>
    ${paidAtBlock}
    ${paidFromBlock}
  </div><div class="payment-receipt-no">شماره رسید: ${receiptNo}</div>
  ${actions}`;
  window.__lastPaymentReceipt={
    loan,
    inst,
    no: receiptNo,
    editable,
    receiptStoreId: opts.receiptStoreId || null
  };
  ov.classList.remove('hidden');
  if (editable) {
    try { fillRcptPaidFromSelect(inst?.paidFrom || ''); } catch (e) { console.warn(e); }
    try { bindRcptJalaliDatePicker(); } catch (e) { console.warn(e); }
  }
}
function closePaymentReceipt(){document.getElementById('payment-receipt-overlay')?.classList.add('hidden');}

// اطمینان از دسترسی سراسری دکمه‌های مودال رسید (onclick در HTML)
window.openPaymentReceipt = openPaymentReceipt;
window.closePaymentReceipt = closePaymentReceipt;
window.printPaymentReceipt = printPaymentReceipt;
try {
  if (typeof confirmReceiptEdits === 'function') window.confirmReceiptEdits = confirmReceiptEdits;
  if (typeof viewStoredPaymentReceipt === 'function') window.viewStoredPaymentReceipt = viewStoredPaymentReceipt;
  if (typeof printStoredPaymentReceipt === 'function') window.printStoredPaymentReceipt = printStoredPaymentReceipt;
  if (typeof rebuildPaymentReceiptsFromLoans === 'function') window.rebuildPaymentReceiptsFromLoans = rebuildPaymentReceiptsFromLoans;
} catch (e) { console.warn('receipt globals', e); }

