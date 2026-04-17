"use client";

import * as React from "react";
import { format, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
    /** Current value as Date or YYYY-MM-DD string */
    value?: Date | string;
    /** Callback with YYYY-MM-DD string (matches native input[type=date] behaviour) */
    onChange?: (dateStr: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    id?: string;
}

export function DatePicker({
    value,
    onChange,
    placeholder = "Pick a date",
    disabled,
    className,
    id,
}: DatePickerProps) {
    const [open, setOpen] = React.useState(false);

    const dateValue = React.useMemo(() => {
        if (!value) return undefined;
        if (value instanceof Date) return value;
        // Parse YYYY-MM-DD string
        const parsed = parse(value, "yyyy-MM-dd", new Date());
        return isNaN(parsed.getTime()) ? undefined : parsed;
    }, [value]);

    const handleSelect = (day: Date | undefined) => {
        if (day) {
            onChange?.(format(day, "yyyy-MM-dd"));
        } else {
            onChange?.("");
        }
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateValue && "text-muted-foreground",
                        className
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateValue ? format(dateValue, "dd MMM yyyy") : placeholder}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={dateValue}
                    onSelect={handleSelect}
                    initialFocus
                />
            </PopoverContent>
        </Popover>
    );
}
