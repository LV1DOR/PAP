'use client';
import { useRouter } from 'next/navigation';
import ReportForm from '@/components/reports/ReportForm';

export default function NewReportPage() {
  const router = useRouter();

  const handleSuccess = (reportId) => {
    // Redirect to report detail page on success
    router.push(`/reports/${reportId}`);
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Create New Report</h1>
      <ReportForm onSuccess={handleSuccess} />
    </div>
  );
}
