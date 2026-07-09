export default function TeacherMessagesCard({ language, messages = [] }) {
  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <h3 className="text-lg font-black text-[#0F172A]">
        {language === "fa" ? "پیام‌های اخیر" : "Recent Messages"}
      </h3>

      <div className="mt-4 space-y-3">
        {messages.length ? (
          messages.map((message) => (
            <div
              key={message.id}
              className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-extrabold text-[#0F172A]">
                  {message.studentName || (language === "fa" ? "شاگرد" : "Student")}
                </p>
                <p className="text-xs font-semibold text-slate-400">
                  {message.timeLabel || "-"}
                </p>
              </div>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {message.text || (language === "fa" ? "بدون متن پیام" : "No message text")}
              </p>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-4 py-8 text-center text-sm font-semibold text-slate-500">
            {language === "fa" ? "هنوز پیام اخیر وجود ندارد." : "No recent messages yet."}
          </div>
        )}
      </div>
    </section>
  );
}
