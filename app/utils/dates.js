// utils/dates.js
export const fmtDate = (value) => {
  if (!value) return "-";
  const t = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(t) || t <= 0) return "-";
  const d = new Date(t);
  return isNaN(d.getTime()) ? "-" : d.toISOString().slice(0, 10);
};
//junk control
