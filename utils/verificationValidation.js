// Centralized validation helpers with robust normalization.

function verhoeffValidate(numStr) {
  // Verhoeff tables
  const d = [
    [0,1,2,3,4,5,6,7,8,9],
    [1,2,3,4,0,6,7,8,9,5],
    [2,3,4,0,1,7,8,9,5,6],
    [3,4,0,1,2,8,9,5,6,7],
    [4,0,1,2,3,9,5,6,7,8],
    [5,9,8,7,6,0,4,3,2,1],
    [6,5,9,8,7,1,0,4,3,2],
    [7,6,5,9,8,2,1,0,4,3],
    [8,7,6,5,9,3,2,1,0,4],
    [9,8,7,6,5,4,3,2,1,0],
  ];
  const p = [
    [0,1,2,3,4,5,6,7,8,9],
    [1,5,7,6,2,8,3,0,9,4],
    [5,8,0,3,7,9,6,1,4,2],
    [8,9,1,6,0,4,3,5,2,7],
    [9,4,5,3,1,2,6,8,7,0],
    [4,2,8,6,5,7,3,9,0,1],
    [2,7,9,3,8,0,6,4,1,5],
    [7,0,4,6,9,1,3,2,5,8],
  ];
  let c = 0;
  const reversed = numStr.split('').reverse().map((ch) => ch.charCodeAt(0) - 48);
  for (let i = 0; i < reversed.length; i++) {
    const num = reversed[i];
    if (num < 0 || num > 9) return false;
    c = d[c][p[i % 8][num]];
  }
  return c === 0;
}

export function isValidAadhaar(input) {
  const digits = String(input || '').replace(/\D/g, '');
  if (digits.length !== 12) return false;
  // optional: Aadhaar first digit is typically 2-9
  if (!/^[2-9]/.test(digits)) return false;
  return verhoeffValidate(digits);
}

export function isValidPassport(value) {
  const s = String(value || '').trim().toUpperCase();
  // Simple generic check: 6–9 alphanumeric characters
  // Adjust per your country’s format if needed
  return /^[A-Z0-9]{6,9}$/.test(s);
}