// ===========================================
// Loading Page
// ===========================================

export default function Loading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" />
        <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce animation-delay-100" />
        <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce animation-delay-200" />
      </div>
      <p className="text-gray-500 mt-4">Chargement...</p>
    </div>
  );
}
