export const usd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export const ago = (input: string | number | Date) => {
  const d = new Date(input).getTime();
  const sec = Math.max(1, Math.floor((Date.now() - d) / 1000));
  const table: [number, string][] = [
    [60, "s"],
    [60, "m"],
    [24, "h"],
    [7, "d"],
    [4.345, "w"],
    [12, "mo"],
    [1e9, "y"],
  ];
  let v = sec,
    unit = "s";
  for (const [k, u] of table) {
    if (v < k) break;
    v = Math.floor(v / k);
    unit = u;
  }
  return `${v}${unit} ago`;
};
