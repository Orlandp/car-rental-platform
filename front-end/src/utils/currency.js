export function formatKES(amount) {
  const value = Number(amount) || 0;
  return `KSh ${value.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
