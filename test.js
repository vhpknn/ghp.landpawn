// landpawn/test.js  รัน: node test.js
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

// 1) ตัวอย่างหลัก: ประเมิน 2.5 ล้าน รับฝาก 70% ถือครอง 5 ปี มีชื่อในทะเบียนบ้านครบ 1 ปี ปากถุง 5%
const a = Object.assign(LP.defaults(), { brokerPct: 0.05, houseReg1y: true, heldYears: 5 });
const c = LP.contractDay(a, R);
eq('วงเงิน', c.loan, 1750000);
eq('ค่าจดทะเบียน', c.items[0].amount, 50000);
eq('ภาษีหัก ณ ที่จ่าย', c.items[1].amount, 43750);
eq('ภาษีธุรกิจเฉพาะ', c.items[2].amount, 0);
eq('อากรแสตมป์', c.items[3].amount, 12500);
eq('ค่าคำขอ+พยาน', c.items[4].amount, 25);
eq('ค่าปากถุง', c.brokerAmt, 87500);
eq('รวมค่าใช้จ่ายผู้ขายฝาก', c.depositorCost, 193775);
eq('เงินสุทธิ', c.net, 1556225);
eq('ดอกเบี้ยต่อปี', c.annualInterest, 262500);
eq('ดอกเบี้ยต่อเดือน', c.monthlyInterest, 21875);

// 2) ไม่เข้าข่ายยกเว้น: ถือ 3 ปี ไม่มีชื่อในทะเบียนบ้าน
const b = Object.assign(LP.defaults(), { heldYears: 3, houseReg1y: false, brokerPct: 0 });
const cb = LP.contractDay(b, R);
eq('SBT 3.3% ของ 2.5 ล้าน', cb.items[2].amount, 82500);
eq('อากรแสตมป์เป็น 0', cb.items[3].amount, 0);
eq('ภาษีหัก ณ ที่จ่าย 3 ปี', cb.items[1].amount, 28750);

// 3) ภาษีหัก ณ ที่จ่ายข้ามขั้นบันได: ประเมิน 10 ล้าน ถือ 1 ปี
eq('WHT ข้ามขั้น', LP.whtPerson(10000000, 1, R).tax, 82500);
// 4) ตัวอย่างจริงจากบทความ: ประเมิน 1,979,390 ถือ 2 ปี ได้ประมาณ 15,836
eq('WHT ตัวอย่างจริง', LP.whtPerson(1979390, 2, R).tax, 15836, 2);

// 5) วันไถ่ถอน: ถือ 1 ปี
const r = LP.redemption(Object.assign(LP.defaults(), { years: 1 }), R);
eq('ไถ่: WHT 1 ปี', r.items[0].amount, 10000);
eq('ไถ่: อากรแสตมป์', r.items[1].amount, 12500);
eq('ไถ่: ค่าธรรมเนียม', r.items[2].amount, 75);

// 6) ไถ่ก่อนกำหนด: 6 เดือนจาก 2 ปี ค่าเสียโอกาส 2%
const e = LP.earlyRedemption(Object.assign(LP.defaults(), { years: 2, elapsedMonths: 6, oppPct: 0.02 }), R);
eq('ดอกเบี้ยค้าง 6 เดือน', e.accrued, 131250);
eq('ค่าเสียโอกาส 18 เดือน', e.opp, 52500);
eq('สินไถ่ก่อนกำหนด', e.price, 1933750);

// 7) วันครบกำหนดและหนังสือแจ้ง
const n = LP.noticeDates('2026-11-08', 2, R);
eqs('ครบกำหนด', n.maturity, '2028-11-08');
eqs('แจ้งได้ตั้งแต่', n.noticeFrom, '2028-05-08');
eqs('แจ้งภายใน', n.noticeTo, '2028-08-08');
eqs('ไถ่ได้ถึง (ไม่แจ้ง)', n.graceUntil, '2029-05-08');
eqs('สิ้นเดือน', LP.addMonths('2026-08-31', 6), '2027-02-28');

// 8) ตารางรายปี
const s = LP.schedule(Object.assign(LP.defaults(), { years: 3 }), R);
eq('รายปี 3 ปี รวมสะสม', s[2].cumulative, 787500);

// 9) คำเตือน
const w = LP.validate(Object.assign(LP.defaults(), { interestPct: 0.18 }), R);
eqs('ดอกเบี้ยเกินเพดาน', w.some(x => x.level === 'error'), true);

console.log(bad ? ('\nไม่ผ่าน ' + bad + ' รายการ') : '\nผ่านทุกรายการ');
process.exit(bad ? 1 : 0);