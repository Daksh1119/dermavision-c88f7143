import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

type Props = React.ComponentProps<typeof Input> & {
  toggleAriaLabel?: string;
};

const PasswordInput = React.forwardRef<HTMLInputElement, Props>(
  ({ className, disabled, toggleAriaLabel = "Toggle password visibility", ...props }, ref) => {
    const [show, setShow] = React.useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={show ? "text" : "password"}
          className={(className ? className + " " : "") + "pr-10"}
          disabled={disabled}
          {...props}
        />
        <button
          type="button"
          aria-label={toggleAriaLabel}
          aria-pressed={show}
          onClick={() => setShow((s) => !s)}
          disabled={disabled}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground disabled:opacity-50"
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";

export default PasswordInput;