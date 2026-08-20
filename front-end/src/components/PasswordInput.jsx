import { useState } from "react";

export default function PasswordInput({ value, onChange, ...inputProps }) {
  const [show, setShow] = useState(false);

  return (
    <div className="password-input">
      <input type={show ? "text" : "password"} value={value} onChange={onChange} {...inputProps} />
      <button type="button" className="password-toggle" onClick={() => setShow((s) => !s)}>
        {show ? "Hide password" : "Show password"}
      </button>
    </div>
  );
}
