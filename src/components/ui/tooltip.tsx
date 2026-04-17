"use client";

import { Tooltip as TooltipPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

function TooltipProvider({ children, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
    return <TooltipPrimitive.Provider delayDuration={300} {...props}>{children}</TooltipPrimitive.Provider>;
}

function Tooltip({ children, ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
    return <TooltipPrimitive.Root {...props}>{children}</TooltipPrimitive.Root>;
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
    return <TooltipPrimitive.Trigger {...props} />;
}

function TooltipContent({
    className,
    sideOffset = 4,
    ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
    return (
        <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
                sideOffset={sideOffset}
                className={cn(
                    "z-50 overflow-hidden rounded-md bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 border",
                    className
                )}
                {...props}
            />
        </TooltipPrimitive.Portal>
    );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
