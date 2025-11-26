import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function HomePage() {
  return (
    <main className="space-y-6">
      <h1 className="text-4xl font-bold text-brand-700">CivicLens</h1>
      <Card>
        <CardHeader>
          <CardTitle>Welcome to CivicLens</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            Report community issues and track their progress. More features coming step by step.
          </p>
          <Button>Get Started</Button>
        </CardContent>
      </Card>
    </main>
  );
}
