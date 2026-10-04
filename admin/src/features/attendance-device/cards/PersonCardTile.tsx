import { memo } from "react";
import { CheckCircle2, CreditCard, Keyboard, Trash2, User } from "lucide-react";
import { useText, useLang, localizeDigits } from "@madrasha/shared-ui/src/i18n";
import type { CardPerson } from "../types";
import { deviceCardsText } from "./deviceCards.text";
import { PinCardChips } from "./cardParts";
import { personSubtitle } from "./cardUtils";

type Props = {
  person: CardPerson;
  /** Briefly highlighted right after a card was linked. */
  justSaved?: boolean;
  onEnroll: (person: CardPerson) => void;
  onManual: (person: CardPerson) => void;
  onRemoveCard: (person: CardPerson) => void;
};

const actionBtn =
  "inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

/** One person in the card grid: photo, identity, PIN/card chips and actions. */
function PersonCardTile({ person, justSaved, onEnroll, onManual, onRemoveCard }: Props) {
  const t = useText(deviceCardsText);
  const lang = useLang();
  const hasCard = Boolean(person.card_number);

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md dark:bg-slate-900 ${
        justSaved ? "border-emerald-300 ring-2 ring-emerald-200 dark:border-emerald-800 dark:ring-emerald-900/60" : "border-slate-200 dark:border-slate-800"
      }`}
    >
      <div className="flex gap-3 p-3">
        <div className="relative h-[72px] w-[54px] shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
          {person.image ? (
            <img src={person.image} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300 dark:text-slate-600">
              <User className="h-7 w-7" strokeWidth={1.25} />
            </div>
          )}
          {justSaved ? (
            <CheckCircle2 className="absolute bottom-0.5 end-0.5 h-4 w-4 rounded-full bg-white text-emerald-600" />
          ) : (
            !hasCard && (
              <span className="absolute start-1 top-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white dark:ring-slate-800" />
            )
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100" title={person.name}>
            {person.name}
          </div>
          <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
            {personSubtitle(person) || "—"}
            {person.roll != null && person.roll !== "" && ` · ${t.roll(localizeDigits(person.roll, lang))}`}
          </div>
          <div className="mt-1.5">
            <PinCardChips person={person} />
          </div>
        </div>
      </div>

      <div className="mt-auto flex gap-1.5 border-t border-slate-100 p-2 dark:border-slate-800">
        <button
          type="button"
          onClick={() => onEnroll(person)}
          className={`${actionBtn} bg-indigo-600 text-white hover:bg-indigo-500`}
          title={t.enrollOnMachine}
        >
          <CreditCard className="h-3.5 w-3.5" /> {t.enrollOnMachine}
        </button>
        <button
          type="button"
          onClick={() => onManual(person)}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          title={t.typeNumber}
          aria-label={t.typeNumber}
        >
          <Keyboard className="h-3.5 w-3.5" />
        </button>
        {hasCard && (
          <button
            type="button"
            onClick={() => onRemoveCard(person)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-950/40"
            title={t.removeCard}
            aria-label={t.removeCard}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(PersonCardTile);
