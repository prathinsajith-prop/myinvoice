import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface StatCardProps {
    label: string;
    children: React.ReactNode;
}

export function StatCard({ label, children }: StatCardProps) {
    return (
        <Card className="gap-1 py-4">
            <CardHeader className="pb-0 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                    {label}
                </CardTitle>
            </CardHeader>
            <CardContent className="px-4">
                <div className="text-xl font-bold">{children}</div>
            </CardContent>
        </Card>
    );
}
