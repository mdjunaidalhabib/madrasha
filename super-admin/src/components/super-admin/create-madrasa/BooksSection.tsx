import ToggleSection from "./ToggleSection";

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
  if (!groups.length) return null;

  return <ToggleSection title="Books" groups={groups} selected={books} setSelected={setBooks} />;
}
