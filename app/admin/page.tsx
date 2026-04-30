import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listPendingGeneratedQuestions } from "@/db/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GenerateForm } from "./GenerateForm";
import { PendingReviewList } from "./PendingReviewList";
import { ALL_DIFFICULTIES, ALL_SCENARIOS } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") notFound();

  const pending = await listPendingGeneratedQuestions();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admin</h1>
          <p className="text-sm text-muted-foreground">
            Generate new practice questions with Claude and review them before
            they enter the live bank. Approved questions appear in
            everyone&apos;s practice and mock-exam pools immediately.
          </p>
        </div>
        <Link href="/admin/resources">
          <Button variant="outline">Learning resources →</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate questions</CardTitle>
        </CardHeader>
        <CardContent>
          <GenerateForm
            scenarios={ALL_SCENARIOS}
            difficulties={ALL_DIFFICULTIES}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Pending review ({pending.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PendingReviewList items={pending} />
        </CardContent>
      </Card>
    </div>
  );
}
