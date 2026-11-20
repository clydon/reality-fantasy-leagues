// Round 5 (B2, Designs needed 30): a team row's end in a game drafted by an auction: the points, and what they cost under them
// ("paid 5", "filled at 1": a place the bids didn't fill, at the lowest price). One part for Your team and every person's sheet.

const fmt = (n: number) => String(Math.round(n * 10) / 10);

export function PriceEnd({ points, paid }: { points: number; paid?: { price: number; filled: boolean } }) {
  return (
    <span className="flex flex-none flex-col items-end leading-none">
      <b className="type-num text-[22px]">{fmt(points)}</b>
      {paid && (
        <small className="mt-1 text-[11.5px] text-muted-foreground">
          {paid.filled ? "filled at" : "paid"} {paid.price}
        </small>
      )}
    </span>
  );
}
