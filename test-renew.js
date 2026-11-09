// landpawn/test-renew.js  รัน: node test-renew.js
const R = require('./rates.js');
const LP = require('./calc.js');
let bad = 0;
const eq = (name, got, want, tol = 0.01) => {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) bad++;
  console.log((ok ? 'ผ่าน ' : 'ไม่ผ่าน ') + name + ' = ' + got + (ok ? '' : ' (ควรเป็น ' + want + ')'));
};
const eqs = (name, got, want) => {
  const ok = got === want; if (!ok) bad++;
  console.log((ok ? 'ผ่าน ' : 'ไม่ผ่าน ') + name + ' = ' + got + (ok ? '' : ' (ควรเป็น ' + want + ')'));
};

// แผนต่อสัญญารายปี: ต่อ 2 ครั้ง รวม 3 ปี (ปากถุง 3% ตอนทำสัญญา)
const p = LP.renewalPlan(Object.assign(LP.defaults(), { years: 1, renewals: 2, startDate: '2026-11-08' }), R);
eq('ต่อสัญญา: เงินสุทธิวันแรก', p.netStart, 1591225);
eq('ต่อสัญญา: จ่ายครั้งที่ 1', p.events[0].cashDepositor, 262575);
eq('ต่อสัญญา: จ่ายครั้งที่ 2', p.events[1].cashDepositor, 262575);
eq('ต่อสัญญา: วันไถ่จ่ายรวม', p.final.cashDepositor, 2025075);
eq('ต่อสัญญา: ต้นทุนการเงินรวม', p.financeCost, 959000);
eq('ต่อสัญญา: ต้นทุนต่อปี %', p.effRate * 100, 20.09, 0.01);
eqs('ต่อสัญญา: วันไถ่', p.final.date, '2029-11-08');
eqs('ต่อสัญญา: ต้องจดก่อน (ครั้งที่ 1)', p.events[0].date, '2027-11-08');
eq('ต่อสัญญา: ภาษีวันไถ่ถือ 3 ปี (ผู้ซื้อ)', p.final.costs.buyer, 28750);
const base1 = Object.assign(LP.defaults(), { years: 1 });
eq('ไม่ต่อ: ต้นทุนเท่าสัญญาปกติ', LP.renewalPlan(base1, R).financeCost, LP.contractDay(base1, R).financeCost);
const pb = LP.renewalPlan(Object.assign(LP.defaults(), { years: 1, renewals: 10 }), R);
eqs('ต่อเกิน 10 ปี มี error', pb.warnings.some(x => x.level === 'error'), true);
eqs('validate เตือนเกิน 10 ปี', LP.validate(Object.assign(LP.defaults(), { years: 1, renewals: 10 }), R).some(x => x.level === 'error'), true);

// สมุดบันทึกการต่อสัญญาจริง
const inpL = Object.assign(LP.defaults(), { years: 1, startDate: '2026-11-08' });
const led = [{ date: '2027-10-20', years: 1, interest: 262500, fee: 75 }];
const sL = LP.ledgerSummary(inpL, led, R, '2027-11-01');
eqs('สมุด: ครบกำหนดใหม่', sL.maturity, '2028-11-08');
eq('สมุด: จำนวนครั้ง', sL.count, 1);
eq('สมุด: ปีรวม', sL.totalYears, 2);
eq('สมุด: จ่ายสะสม', sL.totalPaid, 262575);
eq('สมุด: เหลือต่อได้ (ปี)', sL.remainYears, 8);
eqs('สมุด: สถานะ ok', sL.status, 'ok');
eqs('สมุด: ใกล้ครบ 19 วัน = urgent', LP.ledgerSummary(inpL, [], R, '2027-10-20').status, 'urgent');
eqs('สมุด: เลยกำหนด = expired', LP.ledgerSummary(inpL, [], R, '2027-11-20').status, 'expired');
eqs('สมุด: จดหลังครบกำหนด มีธง', LP.ledgerSummary(inpL, [{ date: '2027-12-01', years: 1, interest: 262500, fee: 75 }], R, '2027-12-02').flags.length > 0, true);
const dr = LP.defaultRenewal(inpL, led, R, '2028-10-20');
eq('สมุด: ดอกแนะนำ', dr.interest, 262500);
eq('สมุด: ธรรมเนียมแนะนำ', dr.fee, 75);

console.log(bad ? ('\nไม่ผ่าน ' + bad + ' รายการ') : '\nผ่านทุกรายการ');
process.exit(bad ? 1 : 0);