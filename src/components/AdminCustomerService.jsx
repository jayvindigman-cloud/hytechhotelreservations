import { useState } from "react";
import { requestPasswordReset } from "../hotel-api";

export default function AdminCustomerService({ initialEmail }) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function send(event) {
    event.preventDefault();
    const address = email.trim();
    if (!address || busy || !window.confirm("Request a password reset link for " + address + "?")) return;
    setBusy(true);
    setResult(null);
    try {
      await requestPasswordReset(address);
      setResult({ text: "If this address has an eligible account, the guest can check their inbox or spam folder for a link to choose a new password." });
    } catch (error) {
      setResult({ error: true, text: error.code === "auth/too-many-requests"
        ? "Too many requests. Please wait before requesting another link." : "The reset request failed. Check the email address and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-directory hotel-glass">
      <h3>Customer Service</h3>
      <div className="password-recovery">
        <h4>Help a guest reset their password</h4>
        <p>Use the email the guest enters on the website. The guest chooses a new password through the email link.</p>
        <form onSubmit={send}>
          <label>Guest account email<input type="email" required value={email} disabled={busy} onChange={(event) => setEmail(event.target.value)} /></label>
          <button type="submit" className="hotel-action" disabled={busy}>{busy ? "Requesting..." : "Send reset link"}</button>
        </form>
        {result && <p className="account-notice" role={result.error ? "alert" : "status"}>{result.text}</p>}
        <p>Guests with Google-only accounts should use Continue with Google or Google account recovery.</p>
      </div>
    </section>
  );
}
