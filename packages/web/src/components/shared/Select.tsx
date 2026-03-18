import * as RadixSelect from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  className?: string;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  className = "",
}: SelectProps) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange}>
      <RadixSelect.Trigger
        className={`inline-flex items-center justify-between gap-2 rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors hover:border-border-focus focus:border-border-focus ${className}`}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown className="h-4 w-4 text-text-muted" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          className="z-50 overflow-hidden rounded-lg border border-border-default bg-bg-elevated shadow-xl"
          position="popper"
          sideOffset={4}
        >
          <RadixSelect.Viewport className="p-1">
            {options.map((opt) => (
              <RadixSelect.Item
                key={opt.value}
                value={opt.value}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-text-secondary outline-none data-[highlighted]:bg-accent-blue/10 data-[highlighted]:text-text-primary data-[state=checked]:text-accent-blue"
              >
                <RadixSelect.ItemIndicator className="w-4">
                  <Check className="h-3.5 w-3.5" />
                </RadixSelect.ItemIndicator>
                <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
