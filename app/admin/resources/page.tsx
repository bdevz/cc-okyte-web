import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { listLearningResources } from "@/db/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ALL_SCENARIOS } from "@/lib/content";
import { AddResourceForm } from "./AddResourceForm";
import { FetchResourcesForm } from "./FetchResourcesForm";
import { ResourceList } from "./ResourceList";

export const dynamic = "force-dynamic";

export default async function AdminResourcesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") notFound();

  const [pending, approved] = await Promise.all([
    listLearningResources({ status: "pending_review" }),
    listLearningResources({ status: "approved", limit: 50 }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Learning resources</h1>
          <p className="text-sm text-muted-foreground">
            Curate the &ldquo;Learn more&rdquo; cards shown to teammates after a
            wrong answer or weak mock-exam domain.
          </p>
        </div>
        <Link href="/admin">
          <Button variant="outline">Back to admin</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add a resource manually</CardTitle>
        </CardHeader>
        <CardContent>
          <AddResourceForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Find resources with Claude (web search)</CardTitle>
        </CardHeader>
        <CardContent>
          <FetchResourcesForm scenarios={ALL_SCENARIOS} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending review ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ResourceList items={pending} pending />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Approved ({approved.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ResourceList items={approved} pending={false} />
        </CardContent>
      </Card>
    </div>
  );
}
