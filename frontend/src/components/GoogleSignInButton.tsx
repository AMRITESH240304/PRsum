import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
let gsiInitialized = false;
let activeCredentialHandler: ((credential: string) => void) | null = null;

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (
            element: HTMLElement,
            options: Record<string, string | boolean>
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export function GoogleSignInButton({
  onCredential,
  compact = false,
}: {
  onCredential: (credential: string) => void;
  compact?: boolean;
}) {
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeCredentialHandler = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !buttonRef.current) {
      return;
    }

    const initializeButton = () => {
      if (!window.google || !buttonRef.current) {
        return false;
      }

      if (!gsiInitialized) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            activeCredentialHandler?.(response.credential);
          },
        });
        gsiInitialized = true;
      }

      buttonRef.current.innerHTML = "";

      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: compact ? "medium" : "large",
        shape: "pill",
        width: compact ? "200" : "280",
        text: "signin_with",
      });

      return true;
    };

    if (initializeButton()) {
      return;
    }

    const interval = window.setInterval(() => {
      if (initializeButton()) {
        window.clearInterval(interval);
      }
    }, 100);

    return () => window.clearInterval(interval);
  }, [compact]);

  return (
    <div className="flex items-center gap-2">
      <div ref={buttonRef} />
      {!GOOGLE_CLIENT_ID && (
        <Button variant="outline" size={compact ? "sm" : "default"} disabled>
          Missing Google client ID
        </Button>
      )}
    </div>
  );
}
