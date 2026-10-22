import { AccountForm } from "@components/auth/AccountForm";

export default function RegisterPage() {
  return (
    <div className="px-4 py-12">
      <AccountForm mode="register" />
    </div>
  );
}
