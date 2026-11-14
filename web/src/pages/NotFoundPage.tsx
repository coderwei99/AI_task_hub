import { NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-3xl font-semibold">404</h1>
      <p className="text-sm text-muted-foreground">{t('notFound.message')}</p>
      <Button asChild variant="outline">
        <NavLink to="/projects">{t('notFound.back')}</NavLink>
      </Button>
    </div>
  );
}