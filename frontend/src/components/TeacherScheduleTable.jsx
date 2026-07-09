export default function TeacherScheduleTable({ schedule, labels }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-start text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
          <tr>
            <th className="px-6 py-4 text-start">{labels.day}</th>
            <th className="px-6 py-4 text-start">{labels.course}</th>
            <th className="px-6 py-4 text-start">{labels.time}</th>
            <th className="px-6 py-4 text-start">{labels.status}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
          {schedule.map((row, idx) => (
            <tr className="transition hover:bg-slate-50/50" key={idx}>
              <td className="px-6 py-4">{row.day}</td>
              <td className="px-6 py-4">{row.course}</td>
              <td className="px-6 py-4">{row.time}</td>
              <td className="px-6 py-4">
                <span className="inline-flex rounded-lg bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">
                  {row.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
