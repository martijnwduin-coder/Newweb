import { Suspense } from "react";
import { LoginForm } from "./form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
