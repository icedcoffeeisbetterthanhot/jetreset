import { AccountForm } from "@components/auth/AccountForm";

export default function SignInPage() {
  return (
    <div className="px-4 py-12">
      <AccountForm mode="login" />
    </div>
  );
}
