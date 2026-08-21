import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { inputClasses } from "./ui/Field";

export default function PasswordInput({ value, onChange, className, ...inputProps }) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        className={inputClasses(`pr-10 ${className || ""}`)}
        {...inputProps}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text cursor-pointer"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
