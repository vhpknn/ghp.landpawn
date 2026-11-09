// landpawn/app.js  ส่วนหน้าจอ: อ่านฟอร์ม แสดงผล บันทึกเคส ต่อสัญญา ตั้งค่า สำรองข้อมูล
const KEY = 'landpawn.v1';
const $ = id => document.getElementById(id);
const fmt = (x, d = 0) => (x == null || !isFinite(x)) ? '-' : Number(x).toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (x, d = 2) => (x == null || !isFinite(x)) ? '-' : fmt(x * 100, d) + '%';
const p100 = x => Math.round(x * 1e6) / 1e4;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const dshow = s => { if (!s) return '-'; const [y, m, d] = s.split('-'); return d + '/' + m + '/' + (+y + 543); };
const clone = o => JSON.parse(JSON.stringify(o));
const tbl = (head, rows) => '<table><tr>' + head.map(h => '<th>' + h + '</th>').join('') + '</tr>' +
  rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</table>';

function mergeRates(r) { return Object.assign(clone(DEFAULT_RATES), r || {}); }
function fresh() { const d = LP.defaults(); d.startDate = today(); return { cur: d, rates: mergeRates(), cases: [], nextId: 1, ledgerCase: null }; }
function load() {
  try {
    const j = JSON.parse(localStorage.getItem(KEY));
    if (j && j.cur) {
      j.rates = mergeRates(j.rates); j.cases = j.cases || []; j.nextId = j.nextId || 1;
      j.cases.forEach(x => { if (!Array.isArray(x.ledger)) x.ledger = []; });
      j.cur = Object.assign(LP.defaults(), j.cur); return j;
    }
  } catch (e) { }
  return fresh();
}
let S = load();
function save() { localStorage.setItem(KEY, JSON.stringify(S)); }

function fillForm() {
  const i = S.cur, set = (id, v) => { $(id).value = v; };
  set('f_name', i.name || ''); set('f_appr', i.appraisal); set('f_plots', i.plots);
  set('f_ratio', p100(i.ratio)); set('f_loan', i.loan == null ? '' : i.loan);
  set('f_dtype', i.depositorType); set('f_btype', i.buyerType); set('f_held', i.heldYears);
  set('f_resi', i.residential ? '1' : '0'); set('f_reg', i.houseReg1y ? '1' : '0');
  set('f_int', p100(i.interestPct)); set('f_years', i.years); set('f_broker', p100(i.brokerPct));
  set('f_bb', i.brokerToBuyer ? '1' : '0'); set('f_debt', i.oldDebt); set('f_start', i.startDate || '');
  set('f_ren_n', i.renewals); set('f_ren_y', i.renewYears);
  set('f_ren_int', i.renewInterestPct == null ? '' : p100(i.renewInterestPct));
  set('f_ren_brk', p100(i.renewBrokerPct)); set('f_ren_share', i.renewShare);
  set('s_fee', i.share.fee); set('s_stamp', i.share.stamp); set('s_sbt', i.share.sbt); set('s_wht', i.share.wht);
  set('r_wht', i.redeemShare.wht); set('r_stamp', i.redeemShare.stamp); set('r_fee', i.redeemShare.fee);
  set('f_elapsed', i.elapsedMonths); set('f_opp', p100(i.oppPct));
}
function readForm() {
  const g = id => $(id).value, n = id => parseFloat($(id).value), i = S.cur;
  i.name = g('f_name'); i.appraisal = n('f_appr') || 0; i.plots = n('f_plots') || 1;
  i.ratio = (n('f_ratio') || 0) / 100; const l = g('f_loan'); i.loan = l === '' ? null : (parseFloat(l) || 0);
  i.depositorType = g('f_dtype'); i.buyerType = g('f_btype'); i.heldYears = n('f_held') || 0;
  i.residential = g('f_resi') === '1'; i.houseReg1y = g('f_reg') === '1';
  i.interestPct = (n('f_int') || 0) / 100; i.years = n('f_years') || 0; i.brokerPct = (n('f_broker') || 0) / 100;
  i.brokerToBuyer = g('f_bb') === '1'; i.oldDebt = n('f_debt') || 0; i.startDate = g('f_start');
  i.renewals = Math.max(0, Math.floor(n('f_ren_n') || 0)); i.renewYears = n('f_ren_y') || 1;
  const ri = g('f_ren_int'); i.renewInterestPct = ri === '' ? null : (parseFloat(ri) || 0) / 100;
  i.renewBrokerPct = (n('f_ren_brk') || 0) / 100; i.renewShare = +g('f_ren_share');
  i.share = { fee: +g('s_fee'), stamp: +g('s_stamp'), sbt: +g('s_sbt'), wht: +g('s_wht') };
  i.redeemShare = { wht: +g('r_wht'), stamp: +g('r_stamp'), fee: +g('r_fee') };
  i.elapsedMonths = n('f_elapsed') || 0; i.oppPct = (n('f_opp') || 0) / 100;
}

function renderDay(c, i) {
  const rows = c.items.map(x => [esc(x.label) + '<div class="small">' + esc(x.note) + '</div>', fmt(x.amount), fmt(x.depositor), fmt(x.buyer)]);
  rows.push(['ค่าปากถุง/นายหน้า<div class="small">' + pct(i.brokerPct) + ' ของวงเงิน' + (i.brokerToBuyer ? ' (เข้าผู้ซื้อฝาก)' : '') + '</div>', fmt(c.brokerAmt), fmt(c.brokerAmt), '0']);
  let h = tbl(['รายการ', 'รวม', 'ผู้ขายฝากจ่าย', 'ผู้ซื้อฝากจ่าย'], rows);
  h += '<table class="sum"><tr><td>วงเงินรับฝาก (ราคาขายฝาก)</td><td>' + fmt(c.loan) + '</td></tr>' +
    '<tr><td>หัก ค่าใช้จ่ายส่วนผู้ขายฝาก</td><td class="bad">−' + fmt(c.depositorCost) + '</td></tr>' +
    '<tr><td>หัก หนี้เดิมที่ไถ่ถอน</td><td class="bad">−' + fmt(c.oldDebt) + '</td></tr>' +
    '<tr class="tot"><td>เงินสุทธิที่ผู้ขายฝากได้รับ</td><td class="' + (c.net >= 0 ? 'ok' : 'bad') + '">' + fmt(c.net) + '</td></tr>' +
    '<tr><td>คิดเป็นของราคาประเมิน</td><td>' + pct(c.netPctOfAppraisal) + '</td></tr>' +
    '<tr><td>ผู้ซื้อฝากจ่ายออกสุทธิ (รวมค่าใช้จ่ายส่วนของตน)</td><td>' + fmt(c.buyerOutlay) + '</td></tr></table>';
  $('day').innerHTML = h;
}
function renderTerm(c, i, R) {
  const capTxt = c.buyerBenefitPct > R.interestCapPct + 1e-9 ? '<span class="bad">' + pct(c.buyerBenefitPct) + ' (เกินเพดาน)</span>' : pct(c.buyerBenefitPct);
  $('term').innerHTML = '<table class="sum">' +
    '<tr><td>ดอกเบี้ยต่อปี</td><td>' + fmt(c.annualInterest) + '</td></tr>' +
    '<tr><td>ดอกเบี้ยต่อเดือน</td><td>' + fmt(c.monthlyInterest) + '</td></tr>' +
    '<tr><td>ดอกเบี้ยรวมตลอดสัญญา (' + fmt(i.years, 2) + ' ปี ไม่ทบต้น)</td><td>' + fmt(c.totalInterest) + '</td></tr>' +
    '<tr class="tot"><td>สินไถ่เมื่อครบกำหนด</td><td>' + fmt(c.redemptionPrice) + '</td></tr>' +
    '<tr><td>ค่าใช้จ่ายวันไถ่ส่วนผู้ขายฝาก</td><td>' + fmt(c.redemptionDayDepositor) + '</td></tr>' +
    '<tr><td>ต้นทุนการเงินรวมของผู้ขายฝาก</td><td>' + fmt(c.financeCost) + '</td></tr>' +
    '<tr><td>ต้นทุนเฉลี่ยต่อปีของผู้ขายฝาก (เทียบเงินสุทธิที่ได้)</td><td>' + (c.effRate == null ? '-' : pct(c.effRate)) + '</td></tr>' +
    '<tr><td>ผลตอบแทนเฉลี่ยต่อปีของผู้ซื้อฝาก (ดอกเบี้ย + ปากถุงที่เข้าตน)</td><td>' + capTxt + '</td></tr></table>';
  const sc = LP.schedule(i, R);
  $('sched').innerHTML = sc.length ? tbl(['ปี', 'ดอกเบี้ย', 'ปากถุง', 'รวมปีนี้', 'สะสม'],
    sc.map(r => [r.year, fmt(r.interest), fmt(r.broker), fmt(r.total), fmt(r.cumulative)])) : '<div class="small">ใส่ระยะเวลาไถ่อย่างน้อย 1 ปี</div>';
}
function renderRed(i, R) {
  const r = LP.redemption(i, R);
  $('red').innerHTML = '<div class="small">คิดที่สินไถ่ครบกำหนด ' + fmt(r.price) + ' บาท</div>' +
    tbl(['รายการ', 'รวม', 'ผู้ขายฝากจ่าย', 'ผู้ซื้อฝากจ่าย'],
      r.items.map(x => [esc(x.label) + '<div class="small">' + esc(x.note) + '</div>', fmt(x.amount), fmt(x.depositor), fmt(x.buyer)])) +
    '<table class="sum"><tr class="tot"><td>ผู้ขายฝากเตรียมเงินวันไถ่</td><td>' + fmt(r.price + r.depositor) + '</td></tr>' +
    '<tr><td>ผู้ซื้อฝากได้รับสินไถ่ หลังจ่ายส่วนของตน</td><td>' + fmt(r.price - r.buyer) + '</td></tr></table>' +
    '<div class="small">ภาษีหัก ณ ที่จ่ายวันไถ่ นับปีจากวันทำสัญญาถึงวันไถ่ ยกเว้นภาษีธุรกิจเฉพาะ</div>';
}
function renderEarly(i, R) {
  const e = LP.earlyRedemption(i, R);
  $('early').innerHTML = '<table class="sum">' +
    '<tr><td>ผ่านไป / เหลือ (เดือน)</td><td>' + fmt(e.elapsed, 1) + ' / ' + fmt(e.remain, 1) + '</td></tr>' +
    '<tr><td>ดอกเบี้ยตามส่วนเวลา</td><td>' + fmt(e.accrued) + '</td></tr>' +
    '<tr><td>ค่าเสียโอกาส (' + pct(e.oppPct) + ' ต่อปี ตามเวลาที่เหลือ)</td><td>' + fmt(e.opp) + '</td></tr>' +
    '<tr class="tot"><td>สินไถ่ก่อนกำหนด</td><td>' + fmt(e.price) + '</td></tr>' +
    '<tr><td>ค่าใช้จ่ายวันไถ่ส่วนผู้ขายฝาก</td><td>' + fmt(e.costs.depositor) + '</td></tr>' +
    '<tr class="tot"><td>เงินที่ผู้ขายฝากต้องเตรียมรวม</td><td>' + fmt(e.totalPay) + '</td></tr></table>' +
    '<div class="small">ค่าเสียโอกาสต้องตกลงไว้ในสัญญา กฎหมายกำหนดเพดานตามค่าที่ตั้งไว้ในส่วนตั้งค่า</div>';
}
function renderDates(i, R) {
  const d = LP.noticeDates(i.startDate, i.years, R);
  $('dates').innerHTML = d ? '<table class="sum">' +
    '<tr><td>วันที่ทำสัญญา</td><td>' + dshow(i.startDate) + '</td></tr>' +
    '<tr class="tot"><td>ครบกำหนดไถ่</td><td>' + dshow(d.maturity) + '</td></tr>' +
    '<tr><td>ผู้ซื้อฝากต้องส่งหนังสือแจ้งระหว่าง</td><td>' + dshow(d.noticeFrom) + ' ถึง ' + dshow(d.noticeTo) + '</td></tr>' +
    '<tr><td>ถ้าไม่ได้แจ้ง ผู้ขายฝากไถ่ได้ถึง</td><td>' + dshow(d.graceUntil) + '</td></tr></table>' +
    '<div class="small">วันที่แสดงเป็น วัน/เดือน/พ.ศ.</div>' : '<div class="small">ใส่วันที่ทำสัญญาและระยะเวลาไถ่</div>';
}

// 7) แผนต่อสัญญารายปี
function renderPlan(i, R) {
  const p = LP.renewalPlan(i, R);
  let h = p.warnings.map(w => '<div class="note ' + w.level + '">' + esc(w.msg) + '</div>').join('');
  if (p.n === 0) {
    $('plan').innerHTML = h + '<div class="small">ใส่จำนวนครั้งที่ต่อสัญญามากกว่า 0 ในส่วนข้อมูลสัญญา เพื่อดูแผนต่อสัญญารายปี</div>';
    return;
  }
  const rows = [['วันทำสัญญา (รับเงินสุทธิ)', dshow(i.startDate), '-', '-', '<span class="ok">+' + fmt(p.netStart) + '</span>']];
  p.events.forEach(e => rows.push([
    'ต่อสัญญาครั้งที่ ' + e.no + '<div class="small">ผู้ซื้อฝากแจ้งระหว่าง ' + dshow(e.noticeFrom) + ' ถึง ' + dshow(e.noticeTo) + '</div>',
    dshow(e.date), fmt(e.interest), fmt(e.feeDepositor + e.broker), '−' + fmt(e.cashDepositor)]));
  rows.push(['ไถ่ถอนเมื่อครบ ' + fmt(p.totalYears, 2) + ' ปี<div class="small">สินไถ่ ' + fmt(p.final.price) + ' + ค่าใช้จ่ายไถ่ส่วนผู้ขายฝาก ' + fmt(p.final.costs.depositor) + '</div>',
    dshow(p.final.date), fmt(p.periods[p.periods.length - 1].interest), fmt(p.final.costs.depositor), '−' + fmt(p.final.cashDepositor)]);
  h += tbl(['รายการ', 'วันที่ต้องจดก่อน', 'ดอก', 'ธรรมเนียม/นายหน้า', 'เงินสดผู้ขายฝาก'], rows);
  const one = LP.contractDay(Object.assign({}, i, { years: p.totalYears }), R);
  h += '<table class="sum">' +
    '<tr><td>ระยะเวลารวม</td><td>' + fmt(p.totalYears, 2) + ' ปี</td></tr>' +
    '<tr><td>ดอกเบี้ยรวม</td><td>' + fmt(p.totalInterest) + '</td></tr>' +
    '<tr><td>ค่าธรรมเนียมต่อสัญญารวม (ทั้งสองฝ่าย)</td><td>' + fmt(p.renewFees) + '</td></tr>' +
    '<tr><td>ผู้ขายฝากจ่ายรวมหลังรับเงินวันแรก</td><td>' + fmt(p.totalPaidDepositor) + '</td></tr>' +
    '<tr class="tot"><td>ต้นทุนการเงินรวมของผู้ขายฝาก</td><td>' + fmt(p.financeCost) + '</td></tr>' +
    '<tr><td>ต้นทุนเฉลี่ยต่อปี</td><td>' + (p.effRate == null ? '-' : pct(p.effRate)) + '</td></tr>' +
    '<tr><td>เทียบสัญญาเดียว ' + fmt(p.totalYears, 2) + ' ปี: ต้นทุนการเงิน</td><td>' + fmt(one.financeCost) + '</td></tr></table>' +
    '<div class="small">ดอกที่จ่ายตอนต่อสัญญานับรวมในผลตอบแทนผู้ซื้อฝาก ผู้ซื้อฝากต้องยินยอมเซ็นหนังสือต่อสัญญาและจดทะเบียนก่อนครบกำหนดทุกครั้ง</div>';
  $('plan').innerHTML = h;
}

// 8) สมุดบันทึกการต่อสัญญาจริง
function ledgerCase() { return S.cases.find(x => x.id === S.ledgerCase) || null; }
function renderLedger(R) {
  const sel = $('l_case');
  if (!S.cases.some(x => x.id === S.ledgerCase)) S.ledgerCase = S.cases.length ? S.cases[0].id : null;
  sel.innerHTML = S.cases.length ? S.cases.map(x => '<option value="' + x.id + '">' + esc(x.name) + '</option>').join('') : '<option value="">(ยังไม่มีเคสที่บันทึก)</option>';
  sel.value = S.ledgerCase == null ? '' : String(S.ledgerCase);
  const c = ledgerCase();
  if (!c) { $('l_sum').innerHTML = '<div class="small">บันทึกเคสในส่วน เคสที่บันทึกไว้ ก่อน แล้วกลับมาเลือกที่นี่</div>'; $('l_list').innerHTML = ''; return; }
  const s = LP.ledgerSummary(c.input, c.ledger, R, today());
  const st = { expired: ['bad', 'เลยกำหนดแล้ว ' + Math.abs(s.daysLeft) + ' วัน'], urgent: ['bad', 'เหลือ ' + s.daysLeft + ' วัน ต้องจดทะเบียนต่อหรือไถ่ก่อนครบกำหนด'], soon: ['', 'เหลือ ' + s.daysLeft + ' วัน เริ่มเตรียมเอกสารต่อสัญญา'], ok: ['ok', s.daysLeft == null ? '-' : 'เหลือ ' + fmt(s.daysLeft) + ' วัน'] }[s.status];
  $('l_sum').innerHTML = s.flags.map(f => '<div class="note warn">' + esc(f) + '</div>').join('') +
    '<table class="sum">' +
    '<tr><td>วันที่ทำสัญญาเดิม / ระยะเวลาเดิม</td><td>' + dshow(c.input.startDate) + ' / ' + fmt(c.input.years, 2) + ' ปี</td></tr>' +
    '<tr><td>ต่อสัญญาแล้ว</td><td>' + s.count + ' ครั้ง</td></tr>' +
    '<tr><td>ระยะเวลารวมปัจจุบัน</td><td>' + fmt(s.totalYears, 2) + ' ปี (ต่อได้อีกไม่เกิน ' + fmt(s.remainYears, 2) + ' ปี)</td></tr>' +
    '<tr class="tot"><td>ครบกำหนดไถ่ปัจจุบัน</td><td>' + dshow(s.maturity) + '</td></tr>' +
    '<tr><td>สถานะ</td><td class="' + st[0] + '">' + esc(st[1]) + '</td></tr>' +
    '<tr><td>ผู้ซื้อฝากต้องแจ้งระหว่าง</td><td>' + dshow(s.noticeFrom) + ' ถึง ' + dshow(s.noticeTo) + '</td></tr>' +
    '<tr><td>ถ้าไม่ได้แจ้ง ไถ่ได้ถึง</td><td>' + dshow(s.graceUntil) + '</td></tr>' +
    '<tr><td>ดอกจ่ายสะสม / ค่าธรรมเนียมสะสม</td><td>' + fmt(s.interestPaid) + ' / ' + fmt(s.feesPaid) + '</td></tr>' +
    '<tr class="tot"><td>จ่ายสะสมจากการต่อสัญญา</td><td>' + fmt(s.totalPaid) + '</td></tr></table>';
  $('l_list').innerHTML = c.ledger.length ? tbl(['ครั้งที่', 'วันที่จดทะเบียน', 'ต่อ (ปี)', 'ดอก', 'ธรรมเนียม', 'หมายเหตุ', ''],
    c.ledger.map((x, k) => [k + 1, dshow(x.date), fmt(x.years, 2), fmt(x.interest), fmt(x.fee), esc(x.note || ''),
      '<button class="sm red" data-act="ldel" data-k="' + k + '">ลบ</button>'])) : '<div class="small">ยังไม่มีการต่อสัญญา</div>';
}

function renderCases(R) {
  if (!S.cases.length) { $('cases').innerHTML = '<div class="small">ยังไม่มีเคสที่บันทึก</div>'; return; }
  const rows = S.cases.map(x => {
    let c, s; try { c = LP.contractDay(x.input, R); s = LP.ledgerSummary(x.input, x.ledger, R, today()); } catch (e) { c = null; }
    const btn = '<button class="sm b-blue" data-act="load" data-id="' + x.id + '">โหลด</button><button class="sm red" data-act="del" data-id="' + x.id + '">ลบ</button>';
    if (!c) return [esc(x.name), '-', '-', '-', '-', '-', btn];
    const cls = s.status === 'expired' || s.status === 'urgent' ? 'bad' : '';
    return [esc(x.name) + '<div class="small">' + dshow(x.savedAt) + '</div>', fmt(c.loan), fmt(c.net), fmt(c.depositorCost),
      '<span class="' + cls + '">' + dshow(s.maturity) + '</span><div class="small">' + (s.daysLeft == null ? '' : s.daysLeft < 0 ? 'เลยกำหนด' : 'อีก ' + fmt(s.daysLeft) + ' วัน') + '</div>',
      s.count + ' ครั้ง', btn];
  });
  $('cases').innerHTML = tbl(['เคส', 'วงเงิน', 'เงินสุทธิ', 'ค่าใช้จ่าย', 'ครบกำหนดปัจจุบัน', 'ต่อแล้ว', ''], rows);
}

function render() {
  readForm(); save();
  const i = S.cur, R = S.rates, V = LP.validate(i, R);
  $('warn').innerHTML = V.map(v => '<div class="note ' + (v.level === 'info' ? '' : v.level) + '">' + esc(v.msg) + '</div>').join('');
  renderCases(R);
  renderLedger(R);
  renderEarly(i, R);
  if (!(i.appraisal > 0 && LP.loanOf(i) > 0)) {
    ['day', 'term', 'red', 'dates', 'plan'].forEach(k => { $(k).innerHTML = '<div class="small">ใส่ราคาประเมินและสัดส่วนหรือวงเงินก่อน</div>'; });
    $('sched').innerHTML = '';
    return;
  }
  const c = LP.contractDay(i, R);
  renderDay(c, i); renderTerm(c, i, R); renderRed(i, R); renderDates(i, R); renderPlan(i, R);
}

// ตั้งค่าอัตรา
function parseBr(t) {
  const rows = t.split('\n').map(s => s.trim()).filter(Boolean).map(s => {
    const p = s.split(':').map(x => x.trim());
    const up = (p[0] === '-' || p[0] === '') ? null : parseFloat(p[0].replace(/,/g, ''));
    const rate = parseFloat(p[1]) / 100;
    if ((up !== null && !(up > 0)) || !isFinite(rate) || rate < 0) throw new Error('บรรทัดไม่ถูกต้อง: ' + s);
    return { upTo: up, rate };
  });
  if (!rows.length || rows[rows.length - 1].upTo !== null) throw new Error('บรรทัดสุดท้ายต้องเป็น - (ไม่จำกัด)');
  for (let k = 1; k < rows.length; k++) {
    if (rows[k - 1].upTo === null || (rows[k].upTo !== null && rows[k].upTo <= rows[k - 1].upTo)) throw new Error('เงินได้สูงสุดต้องเรียงจากน้อยไปมาก');
  }
  return rows;
}
function fillRates() {
  const R = S.rates, set = (id, v) => { $(id).value = v; };
  set('rt_reg', p100(R.regFeePct)); set('rt_regb', R.regFeeBase); set('rt_stamp', p100(R.stampPct)); set('rt_sbt', p100(R.sbtPct));
  set('rt_sbty', R.sbtHeldYears); set('rt_co', p100(R.wthCompanyPct)); set('rt_req', R.requestFee); set('rt_wit', R.witnessFee);
  set('rt_red', R.redeemFee); set('rt_ext', R.extendFee); set('rt_exp', R.wthExpense.map(p100).join(',')); set('rt_maxy', R.wthMaxYears);
  set('rt_br', R.wthBrackets.map(b => (b.upTo == null ? '-' : b.upTo) + ':' + p100(b.rate)).join('\n'));
  set('rt_cap', p100(R.interestCapPct)); set('rt_opp', p100(R.oppCostCapPct)); set('rt_miny', R.minYears); set('rt_maxyr', R.maxYears);
  set('rt_nmin', R.noticeMonthsMin); set('rt_nmax', R.noticeMonthsMax); set('rt_grace', R.graceMonths);
  $('ratesInfo').textContent = 'อัตราตั้งต้นอัปเดตข้อมูล ' + dshow(DEFAULT_RATES.updated) + ' ตรวจกับหน่วยงานก่อนใช้งานจริง';
}
$('ratesSave').onclick = () => {
  try {
    const f = id => { const v = parseFloat($(id).value); if (!isFinite(v) || v < 0) throw new Error('ค่าในช่องไม่ถูกต้อง'); return v; };
    const exp = $('rt_exp').value.split(',').map(s => parseFloat(s) / 100);
    if (!exp.length || exp.some(x => !isFinite(x) || x < 0 || x > 1)) throw new Error('ค่าใช้จ่ายเหมาต้องเป็นตัวเลข 0 ถึง 100 คั่นด้วยจุลภาค');
    const R = S.rates;
    R.regFeePct = f('rt_reg') / 100; R.regFeeBase = $('rt_regb').value; R.stampPct = f('rt_stamp') / 100; R.sbtPct = f('rt_sbt') / 100;
    R.sbtHeldYears = f('rt_sbty'); R.wthCompanyPct = f('rt_co') / 100; R.requestFee = f('rt_req'); R.witnessFee = f('rt_wit');
    R.redeemFee = f('rt_red'); R.extendFee = f('rt_ext'); R.wthExpense = exp; R.wthMaxYears = f('rt_maxy'); R.wthBrackets = parseBr($('rt_br').value);
    R.interestCapPct = f('rt_cap') / 100; R.oppCostCapPct = f('rt_opp') / 100; R.minYears = f('rt_miny'); R.maxYears = f('rt_maxyr');
    R.noticeMonthsMin = f('rt_nmin'); R.noticeMonthsMax = f('rt_nmax'); R.graceMonths = f('rt_grace');
    save(); fillRates(); render(); alert('บันทึกอัตราแล้ว');
  } catch (e) { alert(e.message); }
};
$('ratesReset').onclick = () => { if (confirm('คืนอัตราทั้งหมดเป็นค่าตั้งต้น?')) { S.rates = mergeRates(); save(); fillRates(); render(); } };

// เคส
$('caseSave').onclick = () => {
  readForm();
  const nm = (S.cur.name || '').trim() || ('เคส ' + S.nextId);
  const copy = clone(S.cur); copy.name = nm;
  const id = S.nextId++;
  S.cases.push({ id, name: nm, savedAt: today(), input: copy, ledger: [] });
  S.ledgerCase = id;
  save(); render();
};
$('cases').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  const id = +b.dataset.id;
  if (b.dataset.act === 'load') {
    const c = S.cases.find(x => x.id === id);
    if (c) { S.cur = Object.assign(LP.defaults(), clone(c.input)); fillForm(); render(); }
  }
  if (b.dataset.act === 'del' && confirm('ลบเคสนี้ (รวมสมุดต่อสัญญา)?')) { S.cases = S.cases.filter(x => x.id !== id); save(); render(); }
};

// สมุดต่อสัญญา
$('l_case').onchange = () => { S.ledgerCase = +$('l_case').value || null; save(); renderLedger(S.rates); };
$('l_fill').onclick = () => {
  const c = ledgerCase(); if (!c) { alert('เลือกเคสก่อน'); return; }
  const d = LP.defaultRenewal(c.input, c.ledger, S.rates, today());
  $('l_date').value = d.date; $('l_years').value = d.years; $('l_int').value = d.interest; $('l_fee').value = d.fee;
};
$('l_add').onclick = () => {
  const c = ledgerCase(); if (!c) { alert('เลือกเคสก่อน'); return; }
  const date = $('l_date').value, years = parseFloat($('l_years').value), interest = parseFloat($('l_int').value) || 0, fee = parseFloat($('l_fee').value) || 0;
  if (!date) { alert('ใส่วันที่จดทะเบียนต่อสัญญา'); return; }
  if (!(years > 0)) { alert('ใส่จำนวนปีที่ต่อมากกว่า 0'); return; }
  const s = LP.ledgerSummary(c.input, c.ledger, S.rates, today());
  if (years > s.remainYears + 1e-9) { alert('ต่อได้อีกไม่เกิน ' + fmt(s.remainYears, 2) + ' ปี (ระยะเวลารวมต้องไม่เกิน ' + S.rates.maxYears + ' ปี)'); return; }
  c.ledger.push({ id: Date.now(), date, years, interest, fee, note: $('l_note').value.trim() });
  c.ledger.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  ['l_date', 'l_years', 'l_int', 'l_fee', 'l_note'].forEach(k => { $(k).value = ''; });
  save(); render();
};
$('l_list').onclick = e => {
  const b = e.target.closest('button'); if (!b || b.dataset.act !== 'ldel') return;
  const c = ledgerCase(); if (!c) return;
  if (confirm('ลบรายการต่อสัญญานี้?')) { c.ledger.splice(+b.dataset.k, 1); save(); render(); }
};

// สำรองข้อมูล
function dl(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); }
$('exp').onclick = () => dl('landpawn-backup-' + today() + '.json', JSON.stringify(S), 'application/json');
$('expCsv').onclick = () => {
  const rows = [['id', 'name', 'saved', 'appraisal', 'loan', 'net', 'depositor_cost', 'maturity', 'renewals', 'renewal_paid']];
  S.cases.forEach(x => {
    const c = LP.contractDay(x.input, S.rates), s = LP.ledgerSummary(x.input, x.ledger, S.rates, today());
    rows.push([x.id, '"' + String(x.name).replace(/"/g, '""') + '"', x.savedAt, c.appraisal, c.loan, c.net, c.depositorCost, s.maturity, s.count, s.totalPaid]);
  });
  dl('landpawn-cases-' + today() + '.csv', rows.map(r => r.join(',')).join('\n'), 'text/csv');
};
$('imp').onclick = () => $('impFile').click();
$('impFile').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const j = JSON.parse(r.result);
      if (!j.cur || !j.rates || !Array.isArray(j.cases)) throw 0;
      if (confirm('แทนที่ข้อมูลปัจจุบันด้วยไฟล์สำรอง?')) { localStorage.setItem(KEY, JSON.stringify(j)); S = load(); init(); }
    } catch (x) { alert('ไฟล์ไม่ถูกต้อง'); }
  };
  r.readAsText(f);
};
$('reset').onclick = () => { if (confirm('ล้างข้อมูลทั้งหมด? แนะนำให้ส่งออกไฟล์สำรองก่อน') && confirm('ยืนยันอีกครั้ง')) { localStorage.removeItem(KEY); S = load(); init(); } };

function net() { $('net').textContent = navigator.onLine ? 'ออนไลน์' : 'ออฟไลน์'; }
addEventListener('online', net); addEventListener('offline', net);
document.querySelectorAll('[data-in]').forEach(el => { el.addEventListener('input', render); el.addEventListener('change', render); });
document.querySelectorAll('details[data-k]').forEach(d => {
  const k = 'landpawn.open.' + d.dataset.k, v = localStorage.getItem(k);
  if (v !== null) d.open = v === '1';
  d.addEventListener('toggle', () => localStorage.setItem(k, d.open ? '1' : '0'));
});
function init() { fillForm(); fillRates(); net(); render(); }
init();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js');