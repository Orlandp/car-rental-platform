import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((opts) => {
    const options = typeof opts === "string" ? { message: opts } : opts;
    setState(options);
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function close(result) {
    setState(null);
    resolver.current?.(result);
    resolver.current = null;
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => close(false)}
        >
          <Card
            className="w-full max-w-sm p-6 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-full bg-danger-bg p-2">
                <AlertTriangle className="size-5 text-danger-text" />
              </div>
              <div>
                <h2 className="font-semibold text-text">{state.title || "Are you sure?"}</h2>
                <p className="mt-1 text-sm text-muted">{state.message}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => close(false)}>
                {state.cancelLabel || "Cancel"}
              </Button>
              <Button
                variant={state.danger === false ? "primary" : "danger"}
                onClick={() => close(true)}
              >
                {state.confirmLabel || "Confirm"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
