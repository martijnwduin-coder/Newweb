import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <div className="text-sm text-muted">404</div>
        <h1 className="mt-1 text-xl font-semibold">Page not found</h1>
        <Link href="/" className="mt-4 inline-block text-sm underline">
          Back to the dashboard
        </Link>
      </div>
    </div>
  );
}
