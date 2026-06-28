import { useState } from "react";

export interface VaultState {
  exists: boolean;
  locked: boolean;
  factors: Array<"passphrase" | "webauthn-prf">;
  prfSupported: boolean;
  unprotected: boolean;
}

export interface VaultPanelProps {
  state: VaultState;
  busy: boolean;
  onSetupPassphrase: (passphrase: string) => void;
  onAddPassphrase: (passphrase: string) => void;
  onAddBiometric: () => void;
  onUnlockPassphrase: (passphrase: string) => void;
  onUnlockBiometric: () => void;
  onLock: () => void;
}

export function VaultPanel(props: VaultPanelProps) {
  const { state, busy } = props;
  const hasPassphrase = state.factors.includes("passphrase");
  const hasPrf = state.factors.includes("webauthn-prf");

  return (
    <section className="settings-section">
      <h3>Credential protection</h3>

      {!state.exists ? (
        <>
          {state.unprotected && (
            <p className="banner-warn">
              Storage credentials are saved <strong>unencrypted</strong> on this device. Set up
              protection to encrypt them at rest.
            </p>
          )}
          <p className="muted small">
            Encrypt your stored access keys with a passphrase or this device&apos;s biometrics /
            security key. There is <strong>no recovery</strong> if you lose it — you&apos;ll simply
            re-enter the credentials.
          </p>
          <PassphraseForm
            label="Enable protection"
            busy={busy}
            confirm
            onSubmit={props.onSetupPassphrase}
          />
          {state.prfSupported && (
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={props.onAddBiometric}
            >
              Use biometrics / security key
            </button>
          )}
        </>
      ) : (
        <>
          <div className="vault-status">
            <span className={state.locked ? "pill pill-locked" : "pill pill-unlocked"}>
              {state.locked ? "Locked" : "Unlocked"}
            </span>
            <span className="muted small">
              {state.factors
                .map((f) => (f === "passphrase" ? "passphrase" : "biometrics"))
                .join(" · ")}
            </span>
          </div>

          {state.locked ? (
            <>
              {hasPrf && (
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={props.onUnlockBiometric}
                >
                  Unlock with biometrics / security key
                </button>
              )}
              {hasPassphrase && (
                <PassphraseForm
                  label="Unlock"
                  busy={busy}
                  onSubmit={props.onUnlockPassphrase}
                />
              )}
            </>
          ) : (
            <>
              <button type="button" className="btn" disabled={busy} onClick={props.onLock}>
                Lock now
              </button>
              {!hasPrf && state.prfSupported && (
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busy}
                  onClick={props.onAddBiometric}
                >
                  Add biometrics / security key
                </button>
              )}
              {!hasPassphrase && (
                <PassphraseForm
                  label="Add passphrase"
                  busy={busy}
                  confirm
                  onSubmit={props.onAddPassphrase}
                />
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function PassphraseForm({
  label,
  busy,
  confirm,
  onSubmit,
}: {
  label: string;
  busy: boolean;
  confirm?: boolean;
  onSubmit: (passphrase: string) => void;
}) {
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [err, setErr] = useState<string | null>(null);

  return (
    <form
      className="vault-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (pass.length < 8) {
          setErr("Use at least 8 characters.");
          return;
        }
        if (confirm && pass !== pass2) {
          setErr("Passphrases do not match.");
          return;
        }
        setErr(null);
        onSubmit(pass);
        setPass("");
        setPass2("");
      }}
    >
      <input
        type="password"
        placeholder="Passphrase"
        value={pass}
        onChange={(e) => setPass(e.target.value)}
        autoComplete="new-password"
      />
      {confirm && (
        <input
          type="password"
          placeholder="Confirm passphrase"
          value={pass2}
          onChange={(e) => setPass2(e.target.value)}
          autoComplete="new-password"
        />
      )}
      {err && <span className="muted small error-text">{err}</span>}
      <button type="submit" className="btn" disabled={busy}>
        {label}
      </button>
    </form>
  );
}
