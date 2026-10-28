/**
 * Money utilities for handling INR amounts using integer paise
 * 1 INR = 100 paise
 * Prevents JavaScript floating-point inaccuracies
 */

const toPaise = (inr) => {
  if (inr === undefined || inr === null || isNaN(inr)) {
    return 0;
  }
  const numeric = typeof inr === 'string' ? parseFloat(inr) : inr;
  return Math.round(numeric * 100);
};

const toINR = (paise) => {
  if (paise === undefined || paise === null || isNaN(paise)) {
    return 0;
  }
  return Math.round(paise) / 100;
};

const formatINR = (paise) => {
  const inr = toINR(paise);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: inr % 1 === 0 ? 0 : 2,
  }).format(inr);
};

module.exports = {
  toPaise,
  toINR,
  formatINR,
};
