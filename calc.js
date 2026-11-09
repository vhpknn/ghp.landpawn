// landpawn/calc.js
// สูตรคำนวณล้วนๆ ไม่แตะหน้าจอ ทุกฟังก์ชันรับอัตรา R (จาก rates.js) เป็นพารามิเตอร์
const LP = (function () {
  const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
  const num = (x, d = 0) => (isFinite(parseFloat(x)) ? parseFloat(x) : d);

  function defaults() {
    return {
      appraisal: 2500000, ratio: 0.7, loan: null, plots: 1,
      heldYears: 5, residential: true, houseReg1y: false,
      depositorType: 'person', buyerType: 'person',
      brokerPct: 0.03, brokerToBuyer: false,
      interestPct: 0.15, years: 1, oldDebt: 0,
      share: { fee: 1, stamp: 1, sbt: 1, wht: 1 },
      redeemShare: { wht: 0, stamp: 1, fee: 1 },
      startDate: '', elapsedMonths: 6, oppPct: 0,
      renewals: 0, renewYears: 1, renewInterestPct: null, renewBrokerPct: 0, renewShare: 1
    };
  }

  function loanOf(i) {
    return i.loan != null && i.loan !== '' ? num(i.loan) : r2(num(i.appraisal) * num(i.ratio));
  }

  function whtPerson(appraisal, heldYears, R) {
    const y = Math.min(Math.max(1, Math.ceil(num(heldYears, 1))), R.wthMaxYears || 99);
    const ex = R.wthExpense[Math.min(y, R.wthExpense.length) - 1];
    const netIncome = appraisal * (1 - ex);
    const perYear = netIncome / y;
    let tax = 0, prev = 0;
    for (const b of R.wthBrackets) {
      const top = b.upTo == null ? Infinity : b.upTo;
      if (perYear > prev) tax += (Math.min(perYear, top) - prev) * b.rate;
      prev = top;
    }
    return { tax: r2(tax * y), expensePct: ex, netIncome: r2(netIncome), perYear: r2(perYear), yearsUsed: y };
  }

  function higherOf(appraisal, price) { return Math.max(appraisal, price); }

  function regBase(appraisal, price, R) {
    if (R.regFeeBase === 'appraisal') return appraisal;
    if (R.regFeeBase === 'price') return price;
    return higherOf(appraisal, price);
  }

  function sbtApplies(i, R) {
    const exempt = num(i.heldYears) >= R.sbtHeldYears || (!!i.residential && !!i.houseReg1y);
    return !exempt;
  }

  function split(amount, share) {
    const s = Math.min(1, Math.max(0, num(share, 1)));
    const dep = r2(amount * s);
    return { depositor: dep, buyer: r2(amount - dep) };
  }

  function contractDay(i, R) {
    const appraisal = num(i.appraisal), loan = loanOf(i), plots = Math.max(1, num(i.plots, 1));
    const hi = higherOf(appraisal, loan), sh = i.share || {};
    const sbtOn = sbtApplies(i, R);
    const items = [];
    const add = (key, label, amount, share, note) => {
      const a = r2(amount), p = split(a, share);
      items.push({ key, label, amount: a, depositor: p.depositor, buyer: p.buyer, note: note || '' });
    };
    add('reg', 'ค่าจดทะเบียนขายฝาก', R.regFeePct * regBase(appraisal, loan, R), sh.fee,
      (R.regFeePct * 100) + '% ฐาน ' + regBase(appraisal, loan, R).toLocaleString('th-TH'));
    let wht;
    if (i.depositorType === 'company') {
      wht = { tax: r2(R.wthCompanyPct * hi) };
      add('wht', 'ภาษีหัก ณ ที่จ่าย (นิติบุคคล)', wht.tax, sh.wht, (R.wthCompanyPct * 100) + '% ของราคาที่สูงกว่า');
    } else {
      wht = whtPerson(appraisal, i.heldYears, R);
      add('wht', 'ภาษีเงินได้หัก ณ ที่จ่าย', wht.tax, sh.wht,
        'ถือครอง ' + wht.yearsUsed + ' ปี หักเหมา ' + Math.round(wht.expensePct * 100) + '%');
    }
    add('sbt', 'ภาษีธุรกิจเฉพาะ', sbtOn ? R.sbtPct * hi : 0, sh.sbt, sbtOn ? (R.sbtPct * 100) + '% ของราคาที่สูงกว่า' : 'ได้รับยกเว้น');
    add('stamp', 'อากรแสตมป์', sbtOn ? 0 : R.stampPct * hi, sh.stamp, sbtOn ? 'ไม่เสีย (เสียภาษีธุรกิจเฉพาะแล้ว)' : (R.stampPct * 100) + '% ของราคาที่สูงกว่า');
    add('paper', 'ค่าคำขอและค่าพยาน', (R.requestFee + R.witnessFee) * plots, 1, plots + ' แปลง');

    const brokerAmt = r2(num(i.brokerPct) * loan);
    const govTotal = r2(items.reduce((s, x) => s + x.amount, 0));
    const depGov = r2(items.reduce((s, x) => s + x.depositor, 0));
    const buyGov = r2(items.reduce((s, x) => s + x.buyer, 0));
    const depCost = r2(depGov + brokerAmt);
    const oldDebt = num(i.oldDebt);
    const net = r2(loan - oldDebt - depCost);
    const years = num(i.years, 1);
    const totalInterest = r2(loan * num(i.interestPct) * years);
    const redemptionPrice = r2(loan + totalInterest);
    const rd = redemption(i, R);
    const financeCost = r2(redemptionPrice + rd.depositor - net);
    const effRate = net > 0 && years > 0 ? financeCost / net / years : null;
    return {
      appraisal, loan, hi, sbtOn, wht, items, brokerAmt, govTotal, depGov, buyGov,
      depositorCost: depCost, oldDebt, net, netPctOfAppraisal: appraisal ? net / appraisal : 0,
      annualInterest: r2(loan * num(i.interestPct)), monthlyInterest: r2(loan * num(i.interestPct) / 12),
      totalInterest, redemptionPrice, redemptionDayDepositor: rd.depositor, financeCost, effRate,
      buyerOutlay: r2(loan + buyGov - (i.brokerToBuyer ? brokerAmt : 0)),
      buyerBenefitPct: num(i.interestPct) + (i.brokerToBuyer && years > 0 ? num(i.brokerPct) / years : 0)
    };
  }

  function redemption(i, R, opts) {
    opts = opts || {};
    const appraisal = num(i.appraisal), loan = loanOf(i), plots = Math.max(1, num(i.plots, 1));
    const price = opts.price != null ? opts.price : r2(loan * (1 + num(i.interestPct) * num(i.years, 1)));
    const held = opts.heldYears != null ? opts.heldYears : Math.max(1, Math.ceil(num(i.years, 1)));
    const hi = higherOf(appraisal, price), sh = i.redeemShare || {};
    const items = [];
    const add = (key, label, amount, share, note) => {
      const a = r2(amount), p = split(a, share);
      items.push({ key, label, amount: a, depositor: p.depositor, buyer: p.buyer, note: note || '' });
    };
    if (i.buyerType === 'company') add('wht', 'ภาษีหัก ณ ที่จ่าย (นิติบุคคล)', R.wthCompanyPct * hi, sh.wht, (R.wthCompanyPct * 100) + '% ของราคาที่สูงกว่า');
    else {
      const w = whtPerson(appraisal, held, R);
      add('wht', 'ภาษีเงินได้หัก ณ ที่จ่าย', w.tax, sh.wht, 'นับ ' + w.yearsUsed + ' ปี จากวันทำสัญญาถึงวันไถ่');
    }
    add('stamp', 'อากรแสตมป์', R.stampPct * hi, sh.stamp, (R.stampPct * 100) + '% ของราคาที่สูงกว่า');
    add('fee', 'ค่าจดทะเบียนไถ่ถอน คำขอ พยาน', (R.redeemFee + R.requestFee + R.witnessFee) * plots, sh.fee, plots + ' แปลง');
    return {
      price, items, total: r2(items.reduce((s, x) => s + x.amount, 0)),
      depositor: r2(items.reduce((s, x) => s + x.depositor, 0)),
      buyer: r2(items.reduce((s, x) => s + x.buyer, 0))
    };
  }

  function earlyRedemption(i, R) {
    const loan = loanOf(i), term = num(i.years, 1) * 12;
    const el = Math.min(Math.max(0, num(i.elapsedMonths)), term), remain = term - el;
    const accrued = r2(loan * num(i.interestPct) * el / 12);
    const oppPct = Math.min(Math.max(0, num(i.oppPct)), R.oppCostCapPct);
    const opp = r2(loan * oppPct * remain / 12);
    const price = r2(loan + accrued + opp);
    const rd = redemption(i, R, { price, heldYears: Math.max(1, Math.ceil(el / 12)) });
    return { elapsed: el, remain, accrued, opp, oppPct, price, costs: rd, totalPay: r2(price + rd.depositor) };
  }

  function schedule(i, R) {
    const loan = loanOf(i), years = Math.max(0, Math.floor(num(i.years)));
    const ann = r2(loan * num(i.interestPct)), brk = r2(num(i.brokerPct) * loan);
    const rows = []; let cum = 0;
    for (let y = 1; y <= years; y++) {
      const b = i.brokerToBuyer && y === 1 ? brk : 0;
      const tot = r2(ann + b); cum = r2(cum + tot);
      rows.push({ year: y, interest: ann, broker: b, total: tot, cumulative: cum });
    }
    return rows;
  }

  function addMonths(iso, n) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return '';
    const y = +m[1], mo = +m[2] - 1, d = +m[3];
    const last = new Date(Date.UTC(y, mo + n + 1, 0)).getUTCDate();
    const t = new Date(Date.UTC(y, mo + n, Math.min(d, last)));
    return t.toISOString().slice(0, 10);
  }

  function noticeDates(startISO, years, R) {
    const term = Math.round(num(years) * 12), maturity = addMonths(startISO, term);
    if (!maturity) return null;
    return {
      maturity,
      noticeFrom: addMonths(maturity, -R.noticeMonthsMax),
      noticeTo: addMonths(maturity, -R.noticeMonthsMin),
      graceUntil: addMonths(maturity, R.graceMonths)
    };
  }

  function validate(i, R) {
    const out = [], loan = loanOf(i), years = num(i.years), ratio = num(i.ratio);
    const err = m => out.push({ level: 'error', msg: m }), warn = m => out.push({ level: 'warn', msg: m }), info = m => out.push({ level: 'info', msg: m });
    if (!(num(i.appraisal) > 0)) err('ใส่ราคาประเมินมากกว่า 0');
    if (!(loan > 0)) err('วงเงินรับฝากต้องมากกว่า 0');
    if (loan > num(i.appraisal) && num(i.appraisal) > 0) warn('วงเงินสูงกว่าราคาประเมิน ตรวจตัวเลขอีกครั้ง');
    if (i.loan == null || i.loan === '') {
      if (ratio > 0.7) warn('สัดส่วนรับฝากสูงกว่า 70% ของราคาประเมิน ความเสี่ยงสูง');
      else if (ratio > 0 && ratio < 0.5) info('สัดส่วนรับฝากต่ำกว่า 50% ของราคาประเมิน');
    }
    if (num(i.interestPct) > R.interestCapPct + 1e-9) err('ดอกเบี้ยเกินเพดาน ' + (R.interestCapPct * 100) + '% ต่อปี');
    const benefit = num(i.interestPct) + (i.brokerToBuyer && years > 0 ? num(i.brokerPct) / years : 0);
    if (benefit > R.interestCapPct + 1e-9 && num(i.interestPct) <= R.interestCapPct + 1e-9)
      warn('ดอกเบี้ยรวมค่าปากถุงที่ผู้ซื้อฝากได้รับเฉลี่ย ' + (benefit * 100).toFixed(2) + '% ต่อปี เกินเพดาน ' + (R.interestCapPct * 100) + '%');
    if (years < R.minYears || years > R.maxYears) warn('ระยะเวลาไถ่ควรอยู่ระหว่าง ' + R.minYears + ' ถึง ' + R.maxYears + ' ปี');
    if (num(i.heldYears) < 0) err('ปีถือครองต้องไม่ติดลบ');
    const nRen = Math.max(0, Math.floor(num(i.renewals)));
    if (nRen > 0) {
      const ry = num(i.renewYears, 1) > 0 ? num(i.renewYears, 1) : 1, tot = years + nRen * ry;
      if (tot > R.maxYears + 1e-9) err('ระยะเวลารวมหลังต่อสัญญา ' + tot + ' ปี เกินกฎหมาย ' + R.maxYears + ' ปี');
      if (i.renewInterestPct != null && i.renewInterestPct !== '' && num(i.renewInterestPct) > R.interestCapPct + 1e-9)
        err('ดอกเบี้ยตอนต่อสัญญาเกินเพดาน ' + (R.interestCapPct * 100) + '% ต่อปี');
    }
    if (sbtApplies(i, R)) info('ต้องเสียภาษีธุรกิจเฉพาะ ' + (R.sbtPct * 100) + '% (ไม่เสียอากรแสตมป์)');
    return out;
  }

  // แผนต่อสัญญารายปี: ต่อ n ครั้ง แล้วไถ่ถอนที่ปลายช่วงสุดท้าย
  function renewalPlan(i, R) {
    const loan = loanOf(i), plots = Math.max(1, num(i.plots, 1));
    const n = Math.max(0, Math.floor(num(i.renewals)));
    const y0 = num(i.years, 1), ry = num(i.renewYears, 1) > 0 ? num(i.renewYears, 1) : 1;
    const r0 = num(i.interestPct);
    const r1 = (i.renewInterestPct == null || i.renewInterestPct === '') ? r0 : num(i.renewInterestPct);
    const feeAll = r2((R.extendFee + R.requestFee + R.witnessFee) * plots);
    const feeShare = split(feeAll, i.renewShare);
    const brokerAmt = r2(num(i.renewBrokerPct) * loan);
    const cd = contractDay(i, R);
    const events = [], periods = [];
    let cum = 0, paidDep = 0, totalInterest = 0, renewFees = 0, renewBroker = 0;
    for (let k = 1; k <= n + 1; k++) {
      const yrs = k === 1 ? y0 : ry, rate = k === 1 ? r0 : r1;
      const interest = r2(loan * rate * yrs);
      const start = addMonths(i.startDate, Math.round(cum * 12));
      cum += yrs;
      const end = addMonths(i.startDate, Math.round(cum * 12));
      periods.push({ no: k, years: yrs, rate, interest, start, end });
      totalInterest += interest;
      if (k <= n) {
        const dep = r2(interest + feeShare.depositor + brokerAmt);
        paidDep += dep; renewFees += feeAll; renewBroker += brokerAmt;
        events.push({
          kind: 'renew', no: k, date: end, interest, fee: feeAll, feeDepositor: feeShare.depositor,
          broker: brokerAmt, cashDepositor: dep,
          noticeFrom: addMonths(end, -R.noticeMonthsMax), noticeTo: addMonths(end, -R.noticeMonthsMin)
        });
      }
    }
    const last = periods[periods.length - 1];
    const price = r2(loan + last.interest);
    const rd = redemption(i, R, { price, heldYears: Math.max(1, Math.ceil(cum)) });
    const finalCash = r2(price + rd.depositor);
    paidDep = r2(paidDep + finalCash);
    const net = cd.net, financeCost = r2(paidDep - net);
    const effRate = net > 0 && cum > 0 ? financeCost / net / cum : null;
    const warnings = [];
    if (cum > R.maxYears + 1e-9) warnings.push({ level: 'error', msg: 'ระยะเวลารวม ' + cum + ' ปี เกินกฎหมาย ' + R.maxYears + ' ปี' });
    if (r0 > R.interestCapPct + 1e-9 || r1 > R.interestCapPct + 1e-9) warnings.push({ level: 'error', msg: 'ดอกเบี้ยเกินเพดาน ' + (R.interestCapPct * 100) + '% ต่อปี' });
    if (n > 0 && !addMonths(i.startDate, 0)) warnings.push({ level: 'warn', msg: 'ใส่วันที่ทำสัญญาเพื่อดูวันที่ต้องจดทะเบียนต่อสัญญา' });
    return {
      n, totalYears: cum, periods, events, netStart: net,
      final: { date: last.end, price, costs: rd, cashDepositor: finalCash },
      totalPaidDepositor: paidDep, totalInterest: r2(totalInterest), renewFees: r2(renewFees), renewBroker: r2(renewBroker),
      financeCost, effRate, warnings
    };
  }

  function daysBetween(aISO, bISO) {
    const p = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; };
    return Math.round((p(bISO) - p(aISO)) / 86400000);
  }

  // สมุดบันทึกการต่อสัญญาจริง: ledger = [{ date, years, interest, fee, note }]
  function ledgerSummary(inp, ledger, R, todayISO) {
    const L = ledger || [], loan = loanOf(inp), y0 = num(inp.years, 1), flags = [];
    let prevEnd = addMonths(inp.startDate, Math.round(y0 * 12)), years = y0, interest = 0, fees = 0;
    L.forEach((x, k) => {
      const ey = num(x.years);
      if (x.date && prevEnd && x.date > prevEnd) flags.push('ครั้งที่ ' + (k + 1) + ' จดทะเบียนวันที่ ' + x.date + ' หลังวันครบกำหนดเดิม ' + prevEnd);
      if (ey > 0 && loan > 0 && num(x.interest) / (loan * ey) > R.interestCapPct + 1e-9) flags.push('ครั้งที่ ' + (k + 1) + ' ดอกเบี้ยเกินเพดานต่อปี');
      years += ey; interest += num(x.interest); fees += num(x.fee);
      prevEnd = addMonths(inp.startDate, Math.round(years * 12));
    });
    if (years > R.maxYears + 1e-9) flags.push('ระยะเวลารวม ' + years + ' ปี เกิน ' + R.maxYears + ' ปี');
    const maturity = prevEnd;
    const days = maturity && todayISO ? daysBetween(todayISO, maturity) : null;
    const remainYears = Math.max(0, R.maxYears - years);
    let status = 'ok';
    if (days != null) status = days < 0 ? 'expired' : days <= 30 ? 'urgent' : days <= 90 ? 'soon' : 'ok';
    return {
      count: L.length, totalYears: years, remainYears, maturity,
      noticeFrom: addMonths(maturity, -R.noticeMonthsMax), noticeTo: addMonths(maturity, -R.noticeMonthsMin),
      graceUntil: addMonths(maturity, R.graceMonths),
      interestPaid: r2(interest), feesPaid: r2(fees), totalPaid: r2(interest + fees),
      daysLeft: days, status, canRenew: remainYears > 1e-9 && (days == null || days >= 0), flags
    };
  }

  function defaultRenewal(inp, ledger, R, todayISO) {
    const s = ledgerSummary(inp, ledger, R, todayISO), loan = loanOf(inp), plots = Math.max(1, num(inp.plots, 1));
    const ry = num(inp.renewYears, 1) > 0 ? num(inp.renewYears, 1) : 1;
    const yrs = Math.min(ry, s.remainYears);
    const rate = (inp.renewInterestPct == null || inp.renewInterestPct === '') ? num(inp.interestPct) : num(inp.renewInterestPct);
    return { date: todayISO || '', years: yrs, interest: r2(loan * rate * yrs), fee: r2((R.extendFee + R.requestFee + R.witnessFee) * plots) };
  }

  return { r2, defaults, loanOf, whtPerson, sbtApplies, contractDay, redemption, earlyRedemption, schedule, addMonths, noticeDates, validate, renewalPlan, ledgerSummary, defaultRenewal, daysBetween };
})();
if (typeof module !== 'undefined') module.exports = LP;