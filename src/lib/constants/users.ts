import { Crown, Shield, UserCheck, Users } from "lucide-react";

export const USER_ROLE_META: Record<
    string,
    {
        label: string;
        variant: "default" | "secondary" | "outline";
        icon: typeof Crown;
    }
> = {
    OWNER: { label: "Owner", variant: "default", icon: Crown },
    ADMIN: { label: "Admin", variant: "default", icon: Shield },
    ACCOUNTANT: { label: "Accountant", variant: "secondary", icon: UserCheck },
    MEMBER: { label: "Member", variant: "secondary", icon: Users },
    VIEWER: { label: "Viewer", variant: "outline", icon: Users },
};
