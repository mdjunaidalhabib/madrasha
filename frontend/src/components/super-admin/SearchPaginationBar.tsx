import Button from "../ui/Button";
import Input from "../ui/Input";

export default function SearchPaginationBar({
  q,
  setQ,
  clear,
  page,
  totalPages,
  total,
  disablePrev,
  disableNext,
  prev,
  next,
}: {
  q: string;
  setQ: (v: string) => void;
  clear: () => void;
  page: number;
  totalPages: number;
  total: number;
  disablePrev: boolean;
  disableNext: boolean;
  prev: () => void;
  next: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search by name/slug..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button variant="secondary" onClick={clear}>
          Clear
        </Button>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-600">
          Page <b>{page}</b> / <b>{totalPages}</b>
          {total ? (
            <span>
              {" "}
              • Total: <b>{total}</b>
            </span>
          ) : null}
        </span>
        <Button variant="secondary" disabled={disablePrev} onClick={prev}>
          Prev
        </Button>
        <Button variant="secondary" disabled={disableNext} onClick={next}>
          Next
        </Button>
      </div>
    </div>
  );
}
