export type SimpleMarket = {
  id: string;
  title: string;
  priceCents: number;
  url: string; // <-- add this
};

export type Mover = {
  id: string;
  title: string;
  deltaPct: number;
  url: string; // <-- add this
};
