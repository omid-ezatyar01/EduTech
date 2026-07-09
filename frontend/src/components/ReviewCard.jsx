import { Star } from "lucide-react";

export default function ReviewCard({ review }) {
  const rating = Math.max(0, Math.min(5, Math.round(Number(review?.rating || 0))));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-lg font-black text-primary-700">
          {review.name.charAt(0)}
        </div>
        <div>
          <h4 className="font-black text-slate-950">{review.name}</h4>
          <p className="mt-0.5 text-xs font-bold text-slate-500">
            {review.course}
          </p>
        </div>
        <div className="ms-auto flex text-amber-400">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              fill={i < rating ? "currentColor" : "none"}
              className={i < rating ? "" : "text-slate-300"}
              key={i}
              size={15}
            />
          ))}
        </div>
      </div>
      <p className="mt-5 font-medium leading-7 text-slate-600">
        “{review.text}”
      </p>
    </div>
  );
}
