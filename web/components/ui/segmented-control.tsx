'use client';

import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { cn } from '@/lib/utils';

type Option = { value: string; label: string };
export function SegmentedControl({ value, onValueChange, options, disabled, label }: { value: string; onValueChange: (value: string) => void; options: Option[]; disabled?: boolean; label: string }) {
  return <ToggleGroup.Root type="single" value={value} onValueChange={next => { if (next || value) onValueChange(next || value); }} disabled={disabled} aria-label={label} className="segmented-control">
    {options.map(option => <ToggleGroup.Item key={option.value} value={option.value} className={cn('segmented-item', value === option.value && 'segmented-item-active')}>{option.label}</ToggleGroup.Item>)}
  </ToggleGroup.Root>;
}
