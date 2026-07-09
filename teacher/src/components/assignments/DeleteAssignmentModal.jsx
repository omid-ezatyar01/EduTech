export default function DeleteAssignmentModal({ open, item, onClose, onConfirm }) {
  if (!open || !item) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/60 p-3" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="text-lg font-black text-[#0F172A]">حذف تمرین</h3>
        <p className="mt-2 text-sm text-slate-600">آیا از حذف «{item.title}» مطمئن هستید؟</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-xl border border-[#E2E8F0] text-sm font-semibold text-slate-700">لغو</button>
          <button type="button" onClick={() => onConfirm(item)} className="h-10 rounded-xl bg-[#EF4444] text-sm font-semibold text-white">حذف تمرین</button>
        </div>
      </div>
    </div>
  );
}
