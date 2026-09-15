const dayOffsets = { 'Lun': 0n, 'Mar': 60n, 'Mie': 120n, 'Jue': 180n, 'Vie': 240n, 'Sab': 300n, 'Dom': 360n };
function sessionToBitmask(sessions) {
  let mask = 0n;
  for (const s of sessions) {
    const dayOffset = dayOffsets[s.day];
    if (dayOffset === undefined) continue;
    const startSlot = Math.max(0, Math.floor((s.startMinutes - 420) / 15));
    const endSlot = Math.max(0, Math.ceil((s.endMinutes - 420) / 15));
    for (let i = startSlot; i < endSlot; i++) {
       mask |= (1n << (dayOffset + BigInt(i)));
    }
  }
  return mask;
}

const sec = {
  sessions: [
    { day: 'Lun', startMinutes: 600, endMinutes: 720 }
  ]
};

const newMask = [0n, 0n, 0n, 0n, 0n, 0n, 0n];
let temp = sessionToBitmask(sec.sessions);
for (let d = 0; d < 7; d++) {
  newMask[d] |= (temp & 0x0FFFFFFFFFFFFFFFn);
  temp >>= 60n;
}
console.log("Success! newMask =", newMask);
