import { Button } from '@/components/ui/button';
import { FileText, GanttChartSquare } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="flex justify-center">
          <GanttChartSquare className="h-16 w-16 text-primary" />
        </div>
        <h1 className="font-headline text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
          ContractTime
        </h1>
        <p className="text-lg text-muted-foreground">
          Streamline Your Agreements. Manage contracts, track deadlines, and
          ensure timely execution with ease.
        </p>
        <div className="flex flex-col gap-4">
          <Button asChild size="lg">
            <Link href="/dashboard">Login &rarr;</Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            This is a demo application. Clicking login will take you to the dashboard.
          </p>
        </div>
      </div>
      <footer className="absolute bottom-4 text-center text-sm text-muted-foreground">
        <p>Built for professionals who value their time.</p>
      </footer>
    </div>
  );
}
