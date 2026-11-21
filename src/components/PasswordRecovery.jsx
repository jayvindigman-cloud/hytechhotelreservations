import { useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { auth } from "../Firebase";
import { requestPasswordReset } from "../hotel-api";

const support = "mailto:hytechhotel@gmail.com";

export function PasswordRecovery({ initialEmail, onBack }) {
  const [email, setEmail] = useState(initialEmail);
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setState("sending");
    setError("");
    try {
      await requestPasswordReset(email);
      setState("sent");
    } catch (failure) {
      setError(failure.code === "auth/too-many-requests" ? "Too many requests. Please wait before trying again." : "The reset link could not be requested. Try again or contact hotel support.");
      setState("idle");
    }
  }

  return (
    <section className="password-recovery" aria-label="Password recovery">
      <h2>Reset your password</h2>
      {state === "sent" ? (
        <div role="status">
          <p><strong>Check your email</strong></p>
          <p>If this address has an eligible account, you’ll receive a link to choose a new password. Check your spam folder as well.</p>
          <button type="button" className="hotel-action secondary" onClick={() => setState("idle")}>Use a different email or resend</button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <p>Enter the email you use to sign in with a password.</p>
          <label>Account email<input type="email" required autoComplete="email" value={email} disabled={state === "sending"}
            onChange={(event) => setEmail(event.target.value)} /></label>
          {error && <p role="alert">{error}</p>}
          <button type="submit" className="hotel-action" disabled={state === "sending"}>{state === "sending" ? "Requesting..." : "Email me a reset link"}</button>
        </form>
      )}
      <p>For Google-only accounts, sign in with Google or recover your password through Google.</p>
      <div className="account-actions">
        <button type="button" className="hotel-action secondary" onClick={() => onBack(email)}>Back to sign in</button>
        <a className="hotel-action secondary" href={support}>Contact hotel support</a>
      </div>
    </section>
  );
}

export function ChangePassword({ email }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (next !== confirm) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const user = auth.currentUser;
      if (!user || user.email !== email) throw new Error("Your session expired. Sign in and try again.");
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(email, current));
      await updatePassword(user, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setOpen(false);
      setMessage("Your password was changed.");
    } catch (failure) {
      setError(["auth/invalid-credential", "auth/wrong-password"].includes(failure.code)
        ? "The current password is incorrect." : failure.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendLink() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await requestPasswordReset(email);
      setMessage("Check your email for a link to choose a new password.");
    } catch {
      setError("The reset link could not be requested. Try again or contact hotel support.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="profile-password">
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      {!open ? <button type="button" className="hotel-action secondary" onClick={() => setOpen(true)}>Change password</button> : (
        <form onSubmit={submit}>
          <h4>Change password</h4>
          <label>Current password<input type="password" autoComplete="current-password" required value={current}
            onChange={(event) => setCurrent(event.target.value)} /></label>
          <label>New password<input type="password" autoComplete="new-password" minLength={6} required value={next}
            onChange={(event) => setNext(event.target.value)} /></label>
          <label>Confirm new password<input type="password" autoComplete="new-password" minLength={6} required value={confirm}
            onChange={(event) => setConfirm(event.target.value)} /></label>
          <div className="account-actions">
            <button className="hotel-action" disabled={busy}>Save new password</button>
            <button type="button" className="hotel-action secondary" disabled={busy} onClick={sendLink}>Forgot current password?</button>
            <button type="button" className="hotel-action secondary" disabled={busy} onClick={() => {
              setOpen(false); setCurrent(""); setNext(""); setConfirm(""); setError("");
            }}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}
