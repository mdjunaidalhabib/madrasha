import Button from "./Button";

export default function ErrorState({
  title = "Something went wrong",
  message = "Please try again.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-100 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-2xl">
        ⚠️
      </div>
      <h3 className="mt-3 text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-600">{message}</p>
      {onRetry && (
        <div className="mt-5 flex justify-center">
          <Button onClick={onRetry}>Retry</Button>
        </div>
      )}
    </div>
  );
}
