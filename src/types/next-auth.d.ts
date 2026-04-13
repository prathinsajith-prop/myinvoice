import { type DefaultSession } from "next-auth";
import { type MemberRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      twoFactorEnabled: boolean;
      organizationId?: string;
      organizationSlug?: string;
      role?: string;
      organizations: Array<{
        id: string;
        name: string;
        slug: string;
        role: string;
      }>;
    } & DefaultSession["user"];
  }

  interface User {
    twoFactorEnabled?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    twoFactorEnabled?: boolean;
    organizationId?: string;
    organizationSlug?: string;
    role?: string;
    organizations?: Array<{
      id: string;
      name: string;
      slug: string;
      role: string;
    }>;
  }
}
