import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient();

async function main() {
    const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
    console.log("Found orgs:", orgs.length);
    let inserted = 0;
    for (const org of orgs) {
        const existing = await prisma.documentSequence.findFirst({
            where: { organizationId: org.id, documentType: "DELIVERY_NOTE" },
        });
        if (!existing) {
            await prisma.documentSequence.create({
                data: {
                    organizationId: org.id,
                    documentType: "DELIVERY_NOTE",
                    prefix: "DLV",
                    nextSequence: 1,
                    padLength: 4,
                },
            });
            console.log("Inserted DELIVERY_NOTE sequence for:", org.name);
            inserted++;
        } else {
            console.log("Already exists for:", org.name);
        }
    }
    console.log("Done. Inserted:", inserted);
    await prisma.$disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
