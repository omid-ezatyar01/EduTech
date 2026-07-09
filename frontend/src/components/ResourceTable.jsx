import {
  Eye,
  Download,
  FileText,
  PlaySquare,
  Headphones,
  Image as ImageIcon,
  File,
  Link2,
} from "lucide-react";

const iconMap = {
  PDF: { Icon: FileText, color: "bg-red-50 text-red-600" },
  MP4: { Icon: PlaySquare, color: "bg-blue-50 text-blue-600" },
  Video: { Icon: PlaySquare, color: "bg-blue-50 text-blue-600" },
  MP3: { Icon: Headphones, color: "bg-teal-50 text-teal-600" },
  PNG: { Icon: ImageIcon, color: "bg-purple-50 text-purple-600" },
  DOCX: { Icon: File, color: "bg-blue-50 text-blue-600" },
  Link: { Icon: Link2, color: "bg-emerald-50 text-emerald-600" },
};

export default function ResourceTable({
  resources,
  onPreview,
  onDownload,
  language = "fa",
}) {
  const isFa = language === "fa";
  const t = {
    resource: isFa ? "منبع" : "Resource",
    course: isFa ? "کورس" : "Course",
    typeAndSize: isFa ? "نوع و اندازه" : "Type & Size",
    addedDate: isFa ? "تاریخ اضافه‌شدن" : "Added Date",
    actions: isFa ? "عملیات" : "Actions",
    preview: isFa ? "پیش‌نمایش" : "Preview",
    download: isFa ? "دانلود" : "Download",
  };

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Desktop Table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/50 font-bold text-slate-500">
            <tr>
              <th className="px-6 py-4 text-start font-bold">{t.resource}</th>
              <th className="px-6 py-4 text-start font-bold">{t.course}</th>
              <th className="px-6 py-4 text-start font-bold">{t.typeAndSize}</th>
              <th className="px-6 py-4 text-start font-bold">{t.addedDate}</th>
              <th className="px-6 py-4 text-end font-bold">{t.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
            {resources.map((res) => {
              const { Icon, color } = iconMap[res.type] || {
                Icon: File,
                color: "bg-slate-50 text-slate-600",
              };
              return (
                <tr key={res.id} className="transition hover:bg-slate-50/50">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm ${color}`}
                      >
                        <Icon size={20} />
                      </div>
                      <div>
                        <p className="font-black text-slate-950">{res.title}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500 max-w-[200px] truncate">
                          {res.description}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">{res.course}</td>
                  <td className="px-6 py-5">
                    <span className="inline-block rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black tracking-wider text-slate-600 mr-2">
                      {res.type}
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      {res.size}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <p className="font-bold text-slate-700">{res.addedDate}</p>
                    <p className="text-xs font-bold text-slate-400 mt-1">
                      {res.addedTime}
                    </p>
                  </td>
                  <td className="px-6 py-5 text-end">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onPreview(res)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-primary-600"
                        title={t.preview}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => onDownload(res)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary-200 bg-primary-50 text-primary-600 transition hover:bg-primary-600 hover:text-white"
                        title={t.download}
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden flex flex-col divide-y divide-slate-100">
        {resources.map((res) => {
          const { Icon, color } = iconMap[res.type] || {
            Icon: File,
            color: "bg-slate-50 text-slate-600",
          };
          return (
            <div key={res.id} className="p-4">
              <div className="flex gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm ${color}`}
                >
                  <Icon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-slate-950 truncate">
                    {res.title}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-500 truncate">
                    {res.course}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600">
                      {res.type}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {res.size} • {res.addedDate}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => onPreview(res)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50"
                >
                  <Eye size={16} /> {t.preview}
                </button>
                <button
                  onClick={() => onDownload(res)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-50 text-primary-700 py-2.5 text-xs font-black hover:bg-primary-100"
                >
                  <Download size={16} /> {t.download}
                </button>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
