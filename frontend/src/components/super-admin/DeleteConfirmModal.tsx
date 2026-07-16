import { useState } from "react";
import Button from "../ui/Button";

export default function DeleteConfirmModal({ stats, onConfirm, onClose }: any) {
  const [text, setText] = useState("");

  const valid = text === "DELETE";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded shadow w-full max-w-[420px] space-y-4">
        <h3 className="font-bold text-lg text-red-600">Permanent Delete Warning</h3>

        <div className="text-sm space-y-1 bg-gray-50 p-3 rounded">
          <p>Students: {stats.students}</p>
          <p>Users: {stats.users}</p>
          <p>Accounts: {stats.accounts}</p>
        </div>

        <p className="text-sm text-gray-600">
          This action cannot be undone.
          <br />
          Type <b>DELETE</b> to confirm.
        </p>

        <input
          className="border p-2 w-full rounded"
          placeholder="Type DELETE"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" disabled={!valid} onClick={onConfirm}>
            Permanently Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
