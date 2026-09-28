import { useText } from "@madrasha/shared-ui/src/i18n";
import ToggleSection from "./ToggleSection";
import { createMadrasaText } from "./createMadrasa.text";

type Item = {
  key: string;
  label: string;
};

type Group = {
  title: string;
  items: Item[];
};

type Props = {
  groups: Group[];
  books: string[];
  setBooks: React.Dispatch<React.SetStateAction<string[]>>;
};

export default function BooksSection({ groups, books, setBooks }: Props) {
  const t = useText(createMadrasaText);
  if (!groups.length) return null;

  return <ToggleSection title={t.books} groups={groups} selected={books} setSelected={setBooks} />;
}
