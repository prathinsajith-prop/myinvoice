import { type LucideIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <Icon className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
            {action && (
                <Button className="mt-4" size="sm" onClick={action.onClick}>
                    <Plus className="mr-2 h-4 w-4" />
                    {action.label}
                </Button>
            )}
        </div>
    );
}
