import { redirect } from "next/navigation";
import { requireAccountIdentity } from "@server/authService";
import { AuthRequiredError } from "@server/authErrors";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  let account;
  try {
    account = await requireAccountIdentity();
  } catch (error) {
    if (error instanceof AuthRequiredError) redirect("/account/sign-in");
    throw error;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 md:px-6 md:py-16">
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-dark">Account</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-surface-strong">
          Account settings
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          View the details for your JetReset account.
        </p>
      </header>

      <section
        aria-labelledby="account-details-heading"
        className="rounded-lg border border-slate-200 bg-surface p-6 shadow-sm"
      >
        <h2 id="account-details-heading" className="text-lg font-semibold text-surface-strong">
          Account information
        </h2>
        <dl className="mt-5 divide-y divide-slate-200">
          <div className="flex flex-wrap justify-between gap-2 py-4">
            <dt className="text-sm font-medium text-slate-600">Username</dt>
            <dd className="text-sm font-semibold text-surface-strong">@{account.username}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2 py-4">
            <dt className="text-sm font-medium text-slate-600">Sign-in method</dt>
            <dd className="text-sm text-surface-strong">Username and password</dd>
          </div>
        </dl>
        <p className="mt-4 rounded-md bg-surface-muted p-4 text-sm leading-6 text-slate-600">
          JetReset does not collect email addresses. Password recovery is not available, so keep
          your password somewhere safe.
        </p>
      </section>
    </div>
  );
}
