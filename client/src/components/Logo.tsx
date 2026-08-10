export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-500 font-display text-lg font-extrabold text-white">
        S
      </span>
      <span className="font-display text-xl font-bold tracking-tight text-ink">
        Service<span className="text-teal-500">Pro</span>
      </span>
    </div>
  );
}
